"""
Schemas para Tickets de Suporte
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MessageCreate(BaseModel):
    """Schema para criar mensagem"""
    message: str = Field(..., min_length=1, max_length=5000)
    attachments: List[str] = Field(default=[])


class TicketCreate(BaseModel):
    """Schema para criar ticket"""
    subject: str = Field(..., min_length=5, max_length=200)
    category: str = Field(..., pattern="^(technical|payment|general|complaint)$")
    message: str = Field(..., min_length=10, max_length=5000)
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    related_project_id: Optional[str] = None
    related_payment_id: Optional[str] = None


class TicketUpdate(BaseModel):
    """Schema para atualizar ticket (atendente)"""
    status: Optional[str] = Field(None, pattern="^(open|in_progress|waiting_user|resolved|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|normal|high|urgent)$")
    category: Optional[str] = Field(None, pattern="^(technical|payment|general|complaint)$")
    tags: Optional[List[str]] = None


class TicketAssign(BaseModel):
    """Schema para atribuir ticket a atendente"""
    attendant_id: str


class TicketRating(BaseModel):
    """Schema para avaliar atendimento"""
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class MessageResponse(BaseModel):
    """Schema de resposta de mensagem"""
    id: str
    sender_id: str
    sender_type: str
    sender_name: str
    message: str
    attachments: List[str]
    created_at: datetime
    read_at: Optional[datetime]


class TicketResponse(BaseModel):
    """Schema de resposta de ticket"""
    id: str = Field(alias="_id")
    user_id: str
    user_name: str
    user_email: str
    user_type: str
    subject: str
    category: str
    priority: str
    status: str
    attendant_id: Optional[str]
    attendant_name: Optional[str]
    assigned_at: Optional[datetime]
    messages: List[MessageResponse]
    rating: Optional[int]
    rating_comment: Optional[str]
    rated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    tags: List[str]
    related_project_id: Optional[str]
    related_payment_id: Optional[str]

    class Config:
        populate_by_name = True
        from_attributes = True


class TicketListResponse(BaseModel):
    """Schema resumido para listagem"""
    id: str = Field(alias="_id")
    user_name: str
    subject: str
    category: str
    priority: str
    status: str
    attendant_name: Optional[str]
    unread_messages: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
