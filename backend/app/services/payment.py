"""
Placeholder para serviço de pagamentos.
Implementar integração com gateway de pagamento quando/ se necessário.
"""

from typing import Dict, Any

async def process_payment(amount: float, currency: str = "BRL") -> Dict[str, Any]:
    # Simula processamento de pagamento (no-op)
    return {"success": True, "transaction_id": "simulated_txn_123"}

async def create_subscription_payment(plan: str, user_id: str) -> Dict[str, Any]:
    # Simula criação de pagamento/assinatura (no-op)
    return {"success": True, "subscription_id": "simulated_sub_123"}