"""
Modelo de Anúncios da Plataforma
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Announcement(BaseModel):
    """Modelo de anúncio interno da plataforma"""
    id: str = Field(alias="_id")
    title: str
    description: str
    image_url: Optional[str] = None
    type: str  # "banner", "card", "modal", "feature"
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None  # "screen:BuyCredits" or "url:https://..."
    target_audience: List[str] = ["all"]  # ["client", "professional", "all"]
    priority: int = 5  # 1-10, maior = mais importante
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    html_content: Optional[str] = None  # Conteúdo HTML customizado (opcional)
    views_count: int = 0
    clicks_count: int = 0
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
