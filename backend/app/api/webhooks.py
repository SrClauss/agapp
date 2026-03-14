from fastapi import APIRouter, HTTPException, Request
import os
import requests

router = APIRouter()

@router.post("/webhook/asaas")
async def asaas_webhook(request: Request):
    try:
        # Lê o corpo da requisição
        payload = await request.json()

        # Valida o token de autenticação
        auth_token = request.headers.get("Authorization")
        if auth_token != f"Bearer {os.getenv('ASAAS_WEBHOOK_TOKEN')}":
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Processa o evento 'Pagamento Confirmado'
        if payload.get("event") == "PAYMENT_CONFIRMED":
            payment_data = payload.get("payment")
            # Adicione aqui a lógica para tratar o pagamento confirmado
            print(f"Pagamento confirmado: {payment_data}")

        return {"status": "success"}

    except Exception as e:
        print(f"Erro ao processar webhook: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar webhook")