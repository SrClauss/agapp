"""
Schemas de Anúncios
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class AnnouncementCreate(BaseModel):
    """Schema para criar anúncio"""
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=1000)
    image_url: Optional[str] = None
    type: str = Field(..., pattern="^(banner|card|modal|feature)$")
    cta_text: Optional[str] = Field(None, max_length=50)
    cta_link: Optional[str] = Field(None, max_length=500)
    target_audience: List[str] = Field(default=["all"])
    priority: int = Field(default=5, ge=1, le=10)
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    html_content: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    """Schema para atualizar anúncio"""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=1000)
    image_url: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(banner|card|modal|feature)$")
    cta_text: Optional[str] = Field(None, max_length=50)
    cta_link: Optional[str] = Field(None, max_length=500)
    target_audience: Optional[List[str]] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    html_content: Optional[str] = None


class AnnouncementResponse(BaseModel):
    """Schema de resposta do anúncio"""
    id: str = Field(alias="_id")
    title: str
    description: str
    image_url: Optional[str] = None
    type: str
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    target_audience: List[str]
    priority: int
    start_date: datetime
    end_date: datetime
    is_active: bool
    html_content: Optional[str] = None
    views_count: int
    clicks_count: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AnnouncementPublic(BaseModel):
    """Schema público do anúncio (sem dados internos)"""
    id: str = Field(alias="_id")
    title: str
    description: str
    image_url: Optional[str] = None
    type: str
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    priority: int
    html_content: Optional[str] = None

    class Config:
        populate_by_name = True


class AnnouncementInteraction(BaseModel):
    """Schema para registrar interação (view/click)"""
    announcement_id: str
    interaction_type: str = Field(..., pattern="^(view|click)$")
