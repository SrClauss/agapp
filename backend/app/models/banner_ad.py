from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class BannerImage(BaseModel):
    """Modelo para uma imagem individual do banner"""
    filename: str
    data: str  # Base64 encoded image
    size: int  # Size in bytes
    mime_type: str  # image/jpeg, image/png, etc
    action_type: str = "none"  # "none", "external", "internal"
    action_value: Optional[str] = None  # URL or stack name
    order: int = 0  # Display order


class BannerAd(BaseModel):
    """
    Banner Ad Model - Stores multiple images per target (client/professional)
    Images are stored as Base64 strings in MongoDB
    """
    id: str = Field(alias="_id")
    target: str  # "client" or "professional"
    images: List[BannerImage] = []
    version: int = 1  # Auto-incremented on each change
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None  # User ID who created
    updated_by: Optional[str] = None  # User ID who last updated

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
