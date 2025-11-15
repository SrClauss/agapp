"""
Modelo de Ticket de Suporte
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SupportMessage(BaseModel):
    """Mensagem em um ticket"""
    id: str
    sender_id: str
    sender_type: str  # user, attendant
    sender_name: str
    message: str
    attachments: List[str] = []
    created_at: datetime
    read_at: Optional[datetime] = None


class SupportTicket(BaseModel):
    """Ticket de suporte"""
    id: str = Field(alias="_id")

    # Usuário
    user_id: str
    user_name: str
    user_email: str
    user_type: str  # client, professional

    # Ticket
    subject: str
    category: str  # technical, payment, general, complaint
    priority: str = "normal"  # low, normal, high, urgent
    status: str = "open"  # open, in_progress, waiting_user, resolved, closed

    # Atendimento
    attendant_id: Optional[str] = None
    attendant_name: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # Mensagens
    messages: List[SupportMessage] = []

    # Avaliação
    rating: Optional[int] = None  # 1-5
    rating_comment: Optional[str] = None
    rated_at: Optional[datetime] = None

    # Metadados
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    # Tags e referências
    tags: List[str] = []
    related_project_id: Optional[str] = None
    related_payment_id: Optional[str] = None

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "01HF8X9Z2P3Q4R5S6T7U8V9W0X",
                "user_id": "user123",
                "user_name": "Maria Santos",
                "user_email": "maria@example.com",
                "user_type": "client",
                "subject": "Problema com pagamento",
                "category": "payment",
                "priority": "high",
                "status": "in_progress",
                "attendant_id": "att123",
                "attendant_name": "João Silva",
                "messages": [],
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-15T10:30:00Z"
            }
        }
