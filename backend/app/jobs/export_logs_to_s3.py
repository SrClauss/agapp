"""
Job de exportação de logs para S3.
Exporta os arquivos de log de anúncios e endpoints críticos para um bucket S3.

Execução:
    python -m app.jobs.export_logs_to_s3

Cron (uma vez ao dia):
    0 3 * * * cd /path/to/backend && python -m app.jobs.export_logs_to_s3
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Retorna cliente boto3 S3 configurado, ou None se boto3 não estiver disponível."""
    try:
        import boto3
        aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

        if not aws_access_key or not aws_secret_key:
            logger.warning("AWS credentials not configured; skipping S3 export")
            return None

        return boto3.client(
            "s3",
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region,
        )
    except ImportError:
        logger.warning("boto3 not installed; skipping S3 export. Install with: pip install boto3")
        return None


def export_logs_to_s3(log_dir: str = "logs", bucket: Optional[str] = None) -> dict:
    """
    Exporta todos os arquivos .log do diretório de logs para o S3.

    Args:
        log_dir: Diretório com os arquivos de log
        bucket: Nome do bucket S3 (usa AWS_S3_BUCKET_LOGS env var como padrão)

    Returns:
        dict com resultados da exportação
    """
    bucket = bucket or os.getenv("AWS_S3_BUCKET_LOGS")
    if not bucket:
        logger.warning("AWS_S3_BUCKET_LOGS not configured; skipping S3 export")
        return {"exported": 0, "skipped": 0, "errors": [], "reason": "no_bucket_configured"}

    s3_client = _get_s3_client()
    if not s3_client:
        return {"exported": 0, "skipped": 0, "errors": [], "reason": "s3_unavailable"}

    log_path = Path(log_dir)
    if not log_path.exists():
        logger.warning(f"Log directory {log_dir} does not exist; skipping S3 export")
        return {"exported": 0, "skipped": 0, "errors": [], "reason": "log_dir_not_found"}

    # Prefix no S3: logs/YYYY-MM-DD/HH-MM-SS/
    timestamp_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d/%H-%M-%S")
    s3_prefix = f"logs/{timestamp_prefix}"

    exported = 0
    errors = []
    log_files = list(log_path.glob("*.log"))

    for log_file in log_files:
        s3_key = f"{s3_prefix}/{log_file.name}"
        try:
            s3_client.upload_file(
                Filename=str(log_file),
                Bucket=bucket,
                Key=s3_key,
                ExtraArgs={"ContentType": "application/json"},
            )
            logger.info(f"Exported {log_file.name} → s3://{bucket}/{s3_key}")
            exported += 1
        except Exception as e:
            logger.error(f"Failed to export {log_file.name}: {e}")
            errors.append({"file": log_file.name, "error": str(e)})

    return {
        "exported": exported,
        "total_files": len(log_files),
        "errors": errors,
        "s3_prefix": s3_prefix,
        "bucket": bucket,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = export_logs_to_s3()
    print(f"S3 export result: {result}")
