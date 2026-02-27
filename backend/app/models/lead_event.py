"""
Modelo para rastreamento de eventos de lead.
Registra timestamps de criação do projeto → contato (lead) → primeira mensagem → conclusão.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LeadEvent(BaseModel):
    """Representa um evento na jornada de um lead."""
    id: str = Field(alias="_id")
    project_id: str
    contact_id: str
    professional_id: str
    client_id: str

    # Timestamps de cada etapa
    project_created_at: Optional[datetime] = None   # Quando o projeto foi criado
    contact_created_at: Optional[datetime] = None   # Quando o profissional entrou em contato (lead)
    first_message_at: Optional[datetime] = None     # Quando a primeira mensagem foi enviada no chat
    project_closed_at: Optional[datetime] = None    # Quando o projeto foi concluído

    # Durations (em minutos) para métricas
    minutes_to_first_contact: Optional[float] = None  # project_created → contact
    minutes_to_first_message: Optional[float] = None  # contact → first_message
    minutes_to_close: Optional[float] = None          # project_created → close

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }
