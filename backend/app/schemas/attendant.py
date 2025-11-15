"""
Schemas para Atendente
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class AttendantBase(BaseModel):
    """Base para atendente"""
    name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    role: str = Field(default="attendant", pattern="^(attendant|supervisor|admin)$")


class AttendantCreate(AttendantBase):
    """Schema para criar atendente"""
    password: str = Field(..., min_length=6)


class AttendantUpdate(BaseModel):
    """Schema para atualizar atendente"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = Field(None, pattern="^(attendant|supervisor|admin)$")
    photo_url: Optional[str] = None


class AttendantPasswordUpdate(BaseModel):
    """Schema para atualizar senha"""
    current_password: str
    new_password: str = Field(..., min_length=6)


class AttendantLogin(BaseModel):
    """Schema para login de atendente"""
    email: EmailStr
    password: str


class AttendantResponse(AttendantBase):
    """Schema de resposta de atendente"""
    id: str = Field(alias="_id")
    is_active: bool
    tickets_attended: int
    average_rating: float
    is_online: bool
    last_seen: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        from_attributes = True


class AttendantPublicInfo(BaseModel):
    """Informações públicas do atendente (para usuários)"""
    id: str = Field(alias="_id")
    name: str
    photo_url: Optional[str]
    is_online: bool
    average_rating: float

    class Config:
        populate_by_name = True
