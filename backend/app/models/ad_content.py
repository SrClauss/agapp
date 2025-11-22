from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from ulid import ULID


class AdContent(BaseModel):
    """
    Model for advertising content (PubliScreens and Banners)
    Stores HTML/CSS/JS files that can be displayed in the mobile app
    """
    id: str = Field(default_factory=lambda: str(ULID()))
    alias: str = Field(..., description="Unique identifier for this ad content (e.g., 'publi_client_promo', 'banner_home')")
    type: Literal["publi_screen", "banner"] = Field(..., description="Type of ad content")
    target: Literal["client", "professional", "both"] = Field(..., description="Target audience")

    # File paths (relative to ads directory)
    index_html: str = Field(..., description="Path to index.html file")
    css_files: list[str] = Field(default_factory=list, description="List of CSS file paths")
    js_files: list[str] = Field(default_factory=list, description="List of JS file paths")
    image_files: list[str] = Field(default_factory=list, description="List of image file paths")

    # Metadata
    title: str = Field(..., description="Admin-friendly title for this ad")
    description: Optional[str] = Field(None, description="Description of this ad content")
    is_active: bool = Field(default=True, description="Whether this ad is currently active")

    # Display settings
    priority: int = Field(default=0, description="Display priority (higher = shown first)")
    start_date: Optional[datetime] = Field(None, description="When to start showing this ad")
    end_date: Optional[datetime] = Field(None, description="When to stop showing this ad")

    # Statistics
    views: int = Field(default=0, description="Number of times this ad was viewed")
    clicks: int = Field(default=0, description="Number of times this ad was clicked")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(datetime.timezone.utc))

    class Config:
        json_schema_extra = {
            "example": {
                "alias": "publi_client_welcome",
                "type": "publi_screen",
                "target": "client",
                "index_html": "publi_client_welcome/index.html",
                "css_files": ["publi_client_welcome/style.css"],
                "js_files": ["publi_client_welcome/script.js"],
                "image_files": ["publi_client_welcome/logo.png"],
                "title": "Cliente Welcome Screen",
                "description": "Full screen ad shown to clients after login",
                "is_active": True,
                "priority": 10
            }
        }


class AdAssignment(BaseModel):
    """
    Maps which ad content should be shown in which location
    """
    id: str = Field(default_factory=lambda: str(ULID()))
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ] = Field(..., description="Where this ad should be displayed")
    ad_content_id: str = Field(..., description="Reference to AdContent.id")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(datetime.timezone.utc))

    class Config:
        json_schema_extra = {
            "example": {
                "location": "publi_screen_client",
                "ad_content_id": "01HQWX2K3M4N5P6Q7R8S9T0V1W"
            }
        }
