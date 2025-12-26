import httpx
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.schemas.turnstile import TurnstileVerifyRequest, TurnstileVerifyResponse

router = APIRouter()

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

@router.post("/verify-turnstile", response_model=TurnstileVerifyResponse)
async def verify_turnstile(request: TurnstileVerifyRequest):
    """
    Verifica o token do Cloudflare Turnstile chamando a API de verificação.

    Este endpoint recebe o token gerado pelo widget Turnstile no frontend
    e valida sua autenticidade com a Cloudflare usando a SECRET_KEY.
    """
    import logging
    logger = logging.getLogger(__name__)

    if not request.token:
        raise HTTPException(status_code=400, detail="Token é obrigatório")

    try:
        logger.info("verify-turnstile called; token len=%s", len(request.token))
        # TEMP DEBUG: log prefix of token to diagnose invalid-input-response issues (remove after debugging)
        try:
            token_preview = (request.token[:200] + '...') if len(request.token) > 200 else request.token
        except Exception:
            token_preview = '<unreadable token>'
        logger.info("verify-turnstile received token preview: %s", token_preview)
        async with httpx.AsyncClient() as client:
            # Enviar requisição para a API do Turnstile
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": settings.turnstile_secret_key,
                    "response": request.token,
                },
                timeout=10.0
            )

            result = response.json()
            logger.info("turnstile verify response: %s", {k: result.get(k) for k in ['success','error-codes','hostname','challenge_ts']})

            # Verificar se a validação foi bem-sucedida
            if result.get("success"):
                return TurnstileVerifyResponse(
                    success=True,
                    message="Verificação bem-sucedida",
                    challenge_ts=result.get("challenge_ts"),
                    hostname=result.get("hostname"),
                    action=result.get("action"),
                    cdata=result.get("cdata")
                )
            else:
                # Se falhou, retornar os códigos de erro
                error_codes = result.get("error-codes", [])
                logger.warning("turnstile verification failed: %s", error_codes)
                return TurnstileVerifyResponse(
                    success=False,
                    message=f"Verificação falhou: {', '.join(error_codes)}",
                    error_codes=error_codes
                )

    except httpx.RequestError as e:
        logger.error("turnstile httpx request error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Erro ao comunicar com o serviço Turnstile: {str(e)}"
        )
    except Exception as e:
        logger.exception("turnstile verify unexpected error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao verificar Turnstile: {str(e)}"
        )
