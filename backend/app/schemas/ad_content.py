from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class AdContentCreate(BaseModel):
    """Schema for creating ad content"""
    alias: str = Field(..., description="Unique identifier/alias")
    type: Literal["publi_screen", "banner"]
    target: Literal["client", "professional", "both"]
    title: str
    description: Optional[str] = None
    priority: int = 0
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AdContentUpdate(BaseModel):
    """Schema for updating ad content"""
    alias: Optional[str] = None
    type: Optional[Literal["publi_screen", "banner"]] = None
    target: Optional[Literal["client", "professional", "both"]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AdContentResponse(BaseModel):
    """Schema for ad content response"""
    id: str
    alias: str
    type: Literal["publi_screen", "banner"]
    target: Literal["client", "professional", "both"]
    index_html: str
    css_files: list[str]
    js_files: list[str]
    image_files: list[str]
    title: str
    description: Optional[str]
    is_active: bool
    priority: int
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    views: int
    clicks: int
    created_at: datetime
    updated_at: datetime


class AdContentWithFiles(BaseModel):
    """Schema for ad content with actual file contents"""
    id: str
    alias: str
    type: Literal["publi_screen", "banner"]
    html: str = Field(..., description="HTML content")
    css: str = Field(default="", description="Combined CSS content")
    js: str = Field(default="", description="Combined JS content")
    images: dict[str, str] = Field(default_factory=dict, description="Image filename to base64 data URL mapping")
