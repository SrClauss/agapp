from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class ContractTemplate(BaseModel):
    id: str = Field(alias="_id")
    title: str
    description: Optional[str] = None
    template_text: str  # Text with placeholders like {{client_name}}, {{project_title}}, etc.
    variables: list[str] = []  # List of variable names used in the template
    created_by: str  # user_id
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "01HF8X9Z2P3Q4R5S6T7U8V9W0X",
                "title": "Contrato de Prestação de Serviços Gerais",
                "description": "Modelo padrão para prestação de serviços",
                "template_text": "CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nPelo presente instrumento particular, de um lado {{client_name}}, doravante denominado CONTRATANTE, e de outro lado {{professional_name}}, doravante denominado CONTRATADO...",
                "variables": ["client_name", "professional_name", "project_title", "project_description", "budget_min", "budget_max"],
                "created_by": "01HF8X9Z2P3Q4R5S6T7U8V9W0X",
                "created_at": "2025-01-15T12:00:00Z",
                "updated_at": "2025-01-15T12:00:00Z"
            }
        }
