"""
Mock do serviço Asaas para testes

Simula a API do Asaas sem fazer requisições HTTP reais.
Útil para testes de integração e e2e.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, timezone
from ulid import new as new_ulid


class MockAsaasService:
    """Mock do serviço Asaas que simula respostas da API"""
    
    def __init__(self):
        self.api_key = "mock_api_key"
        self.environment = "sandbox"
        self.base_url = "https://sandbox.asaas.com/api/v3"
        
        # Armazenamento em memória para simular banco de dados do Asaas
        self.customers: Dict[str, Dict] = {}
        self.payments: Dict[str, Dict] = {}
        self.subscriptions: Dict[str, Dict] = {}
        
        # Contadores para gerar IDs
        self._customer_counter = 1000
        self._payment_counter = 2000
        self._subscription_counter = 3000
    
    def _generate_customer_id(self) -> str:
        """Gera ID único de cliente"""
        self._customer_counter += 1
        return f"cus_{self._customer_counter}"
    
    def _generate_payment_id(self) -> str:
        """Gera ID único de pagamento"""
        self._payment_counter += 1
        return f"pay_{self._payment_counter}"
    
    def _generate_subscription_id(self) -> str:
        """Gera ID único de assinatura"""
        self._subscription_counter += 1
        return f"sub_{self._subscription_counter}"
    
    async def create_customer(self, user=None, **kwargs) -> Dict[str, Any]:
        """
        Mock: Criar cliente no Asaas
        Aceita um objeto `user` (com atributos) ou kwargs (name, email, cpf_cnpj, phone)
        """
        customer_id = self._generate_customer_id()

        # Se kwargs foram passados, usá-los; caso contrário, tentar extrair do objeto user
        name = kwargs.get('name') or (user.full_name if hasattr(user, 'full_name') else (user.get('name') if isinstance(user, dict) else None)) or 'Test User'
        email = kwargs.get('email') or (user.email if hasattr(user, 'email') else (user.get('email') if isinstance(user, dict) else None)) or 'test@example.com'
        phone = kwargs.get('phone') or (user.phone if hasattr(user, 'phone') else (user.get('phone') if isinstance(user, dict) else None))
        cpf = kwargs.get('cpf') or kwargs.get('cpf_cnpj') or (user.cpf if hasattr(user, 'cpf') else (user.get('cpf') if isinstance(user, dict) else None))
        external_ref = kwargs.get('external_reference') or (str(user.id) if hasattr(user, 'id') else (str(user.get('_id')) if isinstance(user, dict) and user.get('_id') else None))

        customer = {
            "id": customer_id,
            "name": name,
            "email": email,
            "phone": phone,
            "cpfCnpj": cpf,
            "externalReference": external_ref,
            "dateCreated": datetime.now(timezone.utc).isoformat(),
            "notificationDisabled": False,
        }

        self.customers[customer_id] = customer
        return customer
    
    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Mock: Buscar cliente"""
        if customer_id not in self.customers:
            raise Exception(f"Cliente não encontrado: {customer_id}")
        return self.customers[customer_id]
    
    async def get_customer_by_external_reference(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Mock: Buscar cliente por referência externa"""
        for customer in self.customers.values():
            if customer.get("externalReference") == user_id:
                return customer
        return None
    
    async def update_customer(self, customer_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mock: Atualizar cliente"""
        if customer_id not in self.customers:
            raise Exception(f"Cliente não encontrado: {customer_id}")
        
        self.customers[customer_id].update(data)
        return self.customers[customer_id]
    
    async def create_payment(
        self,
        customer_id: str,
        billing_type: str,
        value: float,
        due_date: Optional[str] = None,
        description: str = "",
        external_reference: Optional[str] = None,
        installment_count: Optional[int] = None,
        discount: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Criar cobrança/pagamento. `due_date` é opcional para conveniência em testes."""
        """
        Mock: Criar cobrança/pagamento
        """
        payment_id = self._generate_payment_id()
        
        payment = {
            "id": payment_id,
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "dueDate": due_date,
            "description": description,
            "externalReference": external_reference,
            "status": "PENDING",  # PENDING, RECEIVED, CONFIRMED, OVERDUE, etc.
            "dateCreated": datetime.now(timezone.utc).isoformat(),
            "invoiceUrl": f"https://sandbox.asaas.com/i/{payment_id}",
            "bankSlipUrl": f"https://sandbox.asaas.com/b/{payment_id}" if billing_type == "BOLETO" else None,
            "installmentCount": installment_count,
            "discount": discount,
        }
        
        # Simular PIX
        if billing_type == "PIX":
            payment["pixTransaction"] = {
                "qrCode": {
                    "payload": f"00020126{payment_id}",
                    "encodedImage": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                },
                "expirationDate": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            }
        
        self.payments[payment_id] = payment
        return payment
    
    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Mock: Buscar pagamento"""
        if payment_id not in self.payments:
            raise Exception(f"Pagamento não encontrado: {payment_id}")
        return self.payments[payment_id]

    def get_payments(self) -> List[Dict[str, Any]]:
        """Retornar todos os pagamentos mockados"""
        return list(self.payments.values())

    def get_customers(self) -> List[Dict[str, Any]]:
        """Retornar todos os customers mockados"""
        return list(self.customers.values())
    
    async def confirm_payment(self, payment_id: str) -> Dict[str, Any]:
        """Mock: Confirmar pagamento manualmente (para testes)"""
        if payment_id not in self.payments:
            raise Exception(f"Pagamento não encontrado: {payment_id}")
        
        # Marcar como confirmado (CONFIRMED) para compatibilidade com testes
        self.payments[payment_id]["status"] = "CONFIRMED"
        self.payments[payment_id]["paymentDate"] = datetime.now(timezone.utc).isoformat()
        self.payments[payment_id]["confirmedDate"] = datetime.now(timezone.utc).isoformat()
        
        return self.payments[payment_id]
    
    async def delete_payment(self, payment_id: str) -> Dict[str, Any]:
        """Mock: Deletar pagamento"""
        if payment_id not in self.payments:
            raise Exception(f"Pagamento não encontrado: {payment_id}")
        
        self.payments[payment_id]["deleted"] = True
        return {"deleted": True}
    
    async def create_subscription(
        self,
        customer_id: str,
        billing_type: str,
        value: float,
        next_due_date: str,
        cycle: str,
        description: str,
        external_reference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mock: Criar assinatura recorrente
        """
        subscription_id = self._generate_subscription_id()
        
        subscription = {
            "id": subscription_id,
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "nextDueDate": next_due_date,
            "cycle": cycle,  # WEEKLY, MONTHLY, etc.
            "description": description,
            "externalReference": external_reference,
            "status": "ACTIVE",
            "dateCreated": datetime.now(timezone.utc).isoformat(),
        }
        
        self.subscriptions[subscription_id] = subscription
        return subscription
    
    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Mock: Buscar assinatura"""
        if subscription_id not in self.subscriptions:
            raise Exception(f"Assinatura não encontrada: {subscription_id}")
        return self.subscriptions[subscription_id]
    
    async def update_subscription(self, subscription_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mock: Atualizar assinatura"""
        if subscription_id not in self.subscriptions:
            raise Exception(f"Assinatura não encontrada: {subscription_id}")
        
        self.subscriptions[subscription_id].update(data)
        return self.subscriptions[subscription_id]
    
    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Mock: Cancelar assinatura"""
        if subscription_id not in self.subscriptions:
            raise Exception(f"Assinatura não encontrada: {subscription_id}")
        
        self.subscriptions[subscription_id]["status"] = "INACTIVE"
        return self.subscriptions[subscription_id]
    
    def verify_webhook_signature(self, payload: str, signature: str, webhook_token: str) -> bool:
        """
        Mock: Verificar assinatura de webhook
        Em produção, isso validaria a assinatura HMAC
        No mock, sempre retorna True para facilitar testes
        """
        return True
    
    def simulate_webhook_event(
        self,
        event_type: str,
        payment_id: str
    ) -> Dict[str, Any]:
        """
        Utilitário de teste: Simular evento de webhook
        
        Retorna payload no formato que o Asaas enviaria
        """
        if payment_id not in self.payments:
            raise Exception(f"Pagamento não encontrado: {payment_id}")
        
        payment = self.payments[payment_id]
        
        return {
            "event": event_type,
            "payment": payment
        }
    
    def reset(self):
        """Limpar todos os dados (útil entre testes)"""
        self.customers.clear()
        self.payments.clear()
        self.subscriptions.clear()
        self._customer_counter = 1000
        self._payment_counter = 2000
        self._subscription_counter = 3000


# Instância global para uso em testes
mock_asaas_service = MockAsaasService()
