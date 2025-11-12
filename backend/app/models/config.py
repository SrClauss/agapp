from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PlanConfig(BaseModel):
    """Configuração de Plano de Assinatura"""
    id: str = Field(alias="_id")
    name: str  # Basic, Pro, Enterprise
    weekly_credits: int  # Créditos renovados toda semana
    monthly_price: float  # Preço mensal (BRL)
    description: str
    features: List[str] = []
    # Descontos para assinaturas mais longas
    discount_3_months: float = 0.0  # % desconto para 3 meses
    discount_6_months: float = 0.0  # % desconto para 6 meses
    discount_12_months: float = 0.0  # % desconto para 12 meses
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True


class CreditPackage(BaseModel):
    """Pacote Avulso de Créditos"""
    id: str = Field(alias="_id")
    name: str  # Ex: "Pacote 10 créditos", "Pacote 50 créditos"
    credits: int  # Quantidade de créditos
    price: float  # Preço (BRL)
    bonus_credits: int = 0  # Créditos bônus
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0  # Ordem de exibição
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True


class FeaturedPricing(BaseModel):
    """Preços de Projetos Destacados"""
    id: str = Field(alias="_id")
    duration_days: int  # 7, 15 ou 30
    price: float  # Preço (BRL)
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True


class PaymentWebhook(BaseModel):
    """Log de Webhooks Asaas (para estatísticas e debug)"""
    id: str = Field(alias="_id")
    event_type: str  # PAYMENT_RECEIVED, PAYMENT_CONFIRMED, etc
    payment_id: str  # ID do pagamento no Asaas
    customer_id: Optional[str] = None  # ID do customer no Asaas
    user_id: Optional[str] = None  # ID do usuário no nosso sistema
    value: float
    status: str
    billing_type: str  # CREDIT_CARD, PIX, BOLETO
    payload: dict  # Payload completo do webhook
    processed: bool = False
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
