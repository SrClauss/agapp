from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class Banner(BaseModel):
    """Database model for lightweight banners.

    This model is used exclusively for the new banner workflow; publiscreens
    continue to live as files stored under the `ads` directory.
    """

    id: Optional[str] = Field(alias="_id")
    alias: str
    target: Literal["client", "professional"]

    # image encoded as base64; we only support one image per banner right now
    base64: Optional[str] = None

    # action when the banner is pressed
    onPress_type: Optional[Literal["external_link", "stack"]] = None
    onPress_link: Optional[str] = None
    onPress_stack: Optional[str] = None

    # ordering within a carousel; 1-based
    position: Optional[int] = None

    # active flag & priority (legacy field retained for future filtering)
    is_active: bool = True
    priority: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }
