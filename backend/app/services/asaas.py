"""
Serviço de integração com Asaas (Gateway de Pagamento)
Documentação: https://docs.asaas.com
"""
import os
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from app.models.user import User
from app.core.config import settings


class AsaasService:
    """Serviço para integração com API Asaas"""

    def __init__(self):
        self.api_key = settings.asaas_api_key
        self.environment = os.getenv("ASAAS_ENVIRONMENT", "sandbox")  # sandbox or production

        # Base URLs
        if self.environment == "sandbox":
            self.base_url = "https://sandbox.asaas.com/api/v3"
        else:
            self.base_url = "https://www.asaas.com/api/v3"

        self.headers = {
            "access_token": self.api_key,
            "Content-Type": "application/json"
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Faz requisição HTTP para API Asaas"""
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient() as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=self.headers, params=params)
                elif method == "POST":
                    response = await client.post(url, headers=self.headers, json=data)
                elif method == "PUT":
                    response = await client.put(url, headers=self.headers, json=data)
                elif method == "DELETE":
                    response = await client.delete(url, headers=self.headers)
                else:
                    raise ValueError(f"Método HTTP inválido: {method}")

                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError as e:
                error_data = e.response.json() if e.response.content else {}
                raise Exception(f"Erro na API Asaas: {e.response.status_code} - {error_data}")
            except Exception as e:
                raise Exception(f"Erro ao comunicar com Asaas: {str(e)}")

    # ==================== CUSTOMER MANAGEMENT ====================

    async def create_customer(self, user: User) -> Dict[str, Any]:
        """
        Criar cliente no Asaas
        Documentação: https://docs.asaas.com/reference/criar-novo-cliente
        """
        data = {
            "name": user.full_name,
            "email": user.email,
            "phone": user.phone if user.phone else None,
            "cpfCnpj": user.cpf if hasattr(user, 'cpf') and user.cpf else None,
            "externalReference": str(user.id),  # ID interno do usuário
            "notificationDisabled": False,
        }

        # Remove campos None
        data = {k: v for k, v in data.items() if v is not None}

        return await self._make_request("POST", "/customers", data=data)

    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Buscar cliente no Asaas"""
        return await self._make_request("GET", f"/customers/{customer_id}")

    async def get_customer_by_external_reference(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Buscar cliente pelo ID interno (externalReference)"""
        params = {"externalReference": user_id}
        result = await self._make_request("GET", "/customers", params=params)

        if result.get("data") and len(result["data"]) > 0:
            return result["data"][0]
        return None

    async def update_customer(self, customer_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Atualizar cliente no Asaas"""
        return await self._make_request("PUT", f"/customers/{customer_id}", data=data)

    async def get_or_create_customer(self, user: User) -> str:
        """
        Busca cliente existente ou cria novo
        Retorna o ID do cliente no Asaas
        """
        # Tentar buscar cliente existente
        existing = await self.get_customer_by_external_reference(str(user.id))
        if existing:
            return existing["id"]

        # Criar novo cliente
        customer = await self.create_customer(user)
        return customer["id"]

    # ==================== PAYMENT GENERATION ====================

    async def create_payment(
        self,
        customer_id: str,
        value: float,
        description: str,
        due_date: Optional[datetime] = None,
        billing_type: str = "PIX",  # PIX, CREDIT_CARD, BOLETO
        external_reference: Optional[str] = None,
        installment_count: Optional[int] = None,
        installment_value: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Criar cobrança no Asaas
        Documentação: https://docs.asaas.com/reference/criar-nova-cobranca

        Args:
            customer_id: ID do cliente no Asaas
            value: Valor da cobrança em BRL
            description: Descrição da cobrança
            due_date: Data de vencimento (para boleto)
            billing_type: PIX, CREDIT_CARD, BOLETO
            external_reference: Referência externa (nosso ID interno)
            installment_count: Número de parcelas (apenas cartão)
            installment_value: Valor de cada parcela (apenas cartão)
        """
        if not due_date:
            due_date = datetime.now() + timedelta(days=7)

        data = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "dueDate": due_date.strftime("%Y-%m-%d"),
            "description": description,
            "externalReference": external_reference,
        }

        # Parcelamento (apenas para cartão de crédito)
        if billing_type == "CREDIT_CARD" and installment_count:
            data["installmentCount"] = installment_count
            data["installmentValue"] = installment_value or (value / installment_count)

        return await self._make_request("POST", "/payments", data=data)

    async def create_pix_payment(
        self,
        customer_id: str,
        value: float,
        description: str,
        external_reference: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Criar cobrança PIX
        Retorna QR Code e payload PIX Copia e Cola
        """
        payment = await self.create_payment(
            customer_id=customer_id,
            value=value,
            description=description,
            billing_type="PIX",
            external_reference=external_reference,
        )

        # Buscar QR Code PIX
        payment_id = payment["id"]
        qr_code = await self._make_request("GET", f"/payments/{payment_id}/pixQrCode")

        return {
            "payment": payment,
            "pix": qr_code
        }

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Buscar cobrança específica"""
        return await self._make_request("GET", f"/payments/{payment_id}")

    async def get_payment_status(self, payment_id: str) -> str:
        """
        Verificar status de pagamento
        Possíveis valores: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, RECEIVED_IN_CASH, REFUND_REQUESTED, CHARGEBACK_REQUESTED, CHARGEBACK_DISPUTE, AWAITING_CHARGEBACK_REVERSAL, DUNNING_REQUESTED, DUNNING_RECEIVED, AWAITING_RISK_ANALYSIS
        """
        payment = await self.get_payment(payment_id)
        return payment.get("status")

    async def cancel_payment(self, payment_id: str) -> Dict[str, Any]:
        """Cancelar cobrança"""
        return await self._make_request("DELETE", f"/payments/{payment_id}")

    # ==================== SUBSCRIPTION MANAGEMENT ====================

    async def create_subscription(
        self,
        customer_id: str,
        value: float,
        cycle: str = "MONTHLY",  # WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
        description: str = "",
        billing_type: str = "CREDIT_CARD",
        external_reference: Optional[str] = None,
        next_due_date: Optional[datetime] = None,
        discount_value: Optional[float] = None,
        discount_duration_cycles: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Criar assinatura recorrente
        Documentação: https://docs.asaas.com/reference/criar-nova-assinatura

        Args:
            customer_id: ID do cliente no Asaas
            value: Valor da mensalidade
            cycle: Ciclo de cobrança (MONTHLY para mensal)
            description: Descrição da assinatura
            billing_type: PIX, CREDIT_CARD, BOLETO
            external_reference: Referência externa
            next_due_date: Data do próximo vencimento
            discount_value: Valor do desconto
            discount_duration_cycles: Duração do desconto em ciclos (ex: 3 para desconto nos primeiros 3 meses)
        """
        if not next_due_date:
            next_due_date = datetime.now() + timedelta(days=30)

        data = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "nextDueDate": next_due_date.strftime("%Y-%m-%d"),
            "cycle": cycle,
            "description": description,
            "externalReference": external_reference,
        }

        # Aplicar desconto se fornecido
        if discount_value is not None:
            data["discount"] = {
                "value": discount_value,
                "dueDateLimitDays": 0,  # Desconto aplicado imediatamente
                "type": "FIXED"  # Desconto fixo em reais
            }

        return await self._make_request("POST", "/subscriptions", data=data)

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Buscar assinatura específica"""
        return await self._make_request("GET", f"/subscriptions/{subscription_id}")

    async def update_subscription(
        self,
        subscription_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Atualizar assinatura"""
        return await self._make_request("PUT", f"/subscriptions/{subscription_id}", data=data)

    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancelar assinatura"""
        return await self._make_request("DELETE", f"/subscriptions/{subscription_id}")

    async def get_subscription_payments(
        self,
        subscription_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Listar pagamentos de uma assinatura

        Args:
            subscription_id: ID da assinatura
            status: Filtrar por status (PENDING, RECEIVED, CONFIRMED, etc)
        """
        params = {"subscription": subscription_id}
        if status:
            params["status"] = status

        result = await self._make_request("GET", "/payments", params=params)
        return result.get("data", [])

    # ==================== WEBHOOK VERIFICATION ====================

    def verify_webhook_signature(
        self,
        payload: str,
        signature: str,
        webhook_token: str
    ) -> bool:
        """
        Verificar assinatura de webhook
        Documentação: https://docs.asaas.com/reference/webhooks

        Args:
            payload: Corpo da requisição (string JSON)
            signature: Header X-Asaas-Signature
            webhook_token: Token configurado no painel Asaas
        """
        import hmac
        import hashlib

        expected_signature = hmac.new(
            webhook_token.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_signature, signature)

    # ==================== UTILITY METHODS ====================

    async def get_payment_methods(self) -> List[str]:
        """Retorna métodos de pagamento disponíveis"""
        return ["PIX", "CREDIT_CARD"]

    async def calculate_installments(
        self,
        value: float,
        max_installments: int = 12
    ) -> List[Dict[str, Any]]:
        """
        Calcular opções de parcelamento

        Returns:
            Lista com opções de parcelamento:
            [
                {"installments": 1, "installment_value": 100.00, "total": 100.00},
                {"installments": 2, "installment_value": 50.00, "total": 100.00},
                ...
            ]
        """
        options = []
        for i in range(1, max_installments + 1):
            installment_value = round(value / i, 2)
            total = installment_value * i

            options.append({
                "installments": i,
                "installment_value": installment_value,
                "total": total
            })

        return options


# Singleton instance
asaas_service = AsaasService()
