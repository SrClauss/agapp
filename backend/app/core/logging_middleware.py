"""
Middleware de log para endpoints críticos (auth, pagamentos, contatos).
Registra entradas, saídas e erros nos endpoints críticos no formato JSON.
"""
import json
import logging
import time
from datetime import datetime, timezone
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import Message

logger = logging.getLogger("critical_endpoints")

# Prefixos de path considerados críticos para auditoria
CRITICAL_PREFIXES = (
    "/auth/",
    "/api/auth/",
    "/api/payments/",
    "/api/payments",
    "/contacts/",
    "/api/contacts",
    "/projects/",
    "/api/projects/",
    "/support/tickets",
    "/api/support/",
)


def _is_critical(path: str) -> bool:
    for prefix in CRITICAL_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


class CriticalEndpointLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware que loga requests para endpoints críticos."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        if not _is_critical(path):
            return await call_next(request)

        # Mask Authorization header for safe logging
        auth = request.headers.get("authorization", "")
        masked_auth = ""
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
            if len(token) > 12:
                masked_auth = f"Bearer {token[:6]}...{token[-6:]}"
            else:
                masked_auth = "Bearer [REDACTED]"

        start = time.time()
        log_entry: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "method": request.method,
            "path": path,
            "query": str(request.query_params) or None,
            "auth": masked_auth or None,
            "client_ip": request.client.host if request.client else None,
        }

        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start) * 1000, 1)
            log_entry["status"] = response.status_code
            log_entry["duration_ms"] = duration_ms

            level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(level, json.dumps(log_entry, ensure_ascii=False))
            return response

        except Exception as exc:
            duration_ms = round((time.time() - start) * 1000, 1)
            log_entry["error"] = str(exc)
            log_entry["duration_ms"] = duration_ms
            logger.error(json.dumps(log_entry, ensure_ascii=False))
            raise
