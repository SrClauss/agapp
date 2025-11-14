import httpx
from fastapi import HTTPException, status
from app.core.config import settings

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

async def verify_turnstile_token(token: str) -> bool:
    """
    Verifica o token do Cloudflare Turnstile.

    Args:
        token: Token gerado pelo widget Turnstile

    Returns:
        bool: True se a verificação foi bem-sucedida, False caso contrário

    Raises:
        HTTPException: Se houver erro na comunicação com a API
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token Turnstile é obrigatório"
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": settings.turnstile_secret_key,
                    "response": token,
                },
                timeout=10.0
            )

            result = response.json()

            if not result.get("success"):
                error_codes = result.get("error-codes", [])
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Verificação Turnstile falhou: {', '.join(error_codes)}"
                )

            return True

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Erro ao comunicar com o serviço Turnstile: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao verificar Turnstile: {str(e)}"
        )
