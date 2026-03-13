from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AdScreenAd(BaseModel):
    """
    AdScreen Ad Model - Stores one ZIP file per target (client/professional)
    ZIP is stored as Binary (BSON) in MongoDB
    """
    id: str = Field(alias="_id")
    target: str  # "client" or "professional"
    zip_data: Optional[bytes] = None  # ZIP file stored as Binary
    zip_filename: str = ""
    zip_size: int = 0  # Size in bytes
    action_type: str = "none"  # "none", "external", "internal"
    action_value: Optional[str] = None  # URL or stack name
    version: int = 1  # Auto-incremented on each change
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None  # User ID who created
    updated_by: Optional[str] = None  # User ID who last updated

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
