"""
Modelo de Atendente do SAC
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class Attendant(BaseModel):
    """Modelo de atendente do suporte"""
    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    password_hash: str
    is_active: bool = True
    role: str = "attendant"  # attendant, supervisor, admin
    photo_url: Optional[str] = None
    phone: Optional[str] = None

    # Estatísticas
    tickets_attended: int = 0
    average_rating: float = 0.0

    # Status online
    is_online: bool = False
    last_seen: Optional[datetime] = None

    # Metadados
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None  # ID do admin que criou

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "01HF8X9Z2P3Q4R5S6T7U8V9W0X",
                "name": "João Silva",
                "email": "joao.silva@agilizapro.cloud",
                "password_hash": "$2b$12$...",
                "is_active": True,
                "role": "attendant",
                "tickets_attended": 150,
                "average_rating": 4.8,
                "is_online": True,
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-15T10:00:00Z"
            }
        }
