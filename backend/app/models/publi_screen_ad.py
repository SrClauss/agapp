from pydantic import BaseModel, Field, validator
from typing import Optional, Literal, List
from datetime import datetime
from uuid import uuid4
import re


def _validate_html_structure(html: Optional[str]) -> Optional[str]:
    # allow missing html if zip package is provided; validation occurs elsewhere if needed
    if not html:
        return html

    # basic check: must not contain inline <script> tags, only external js references
    if re.search(r"<script[^>]*>[^<]+</script>", html, flags=re.IGNORECASE):
        raise ValueError("HTML must not include inline <script> tags")
    # must contain at least one <script src="..."></script>
    if not re.search(r"<script[^>]+src=", html, flags=re.IGNORECASE):
        raise ValueError("HTML must reference an external JS file via <script src='...'>")
    return html


class Pressable(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    onPress_type: Literal["external_link", "stack"]
    onPress_link: Optional[str] = None
    onPress_stack: Optional[str] = None

    @validator('onPress_link', always=True)
    def link_required_if_external(cls, v, values):
        if values.get('onPress_type') == 'external_link' and not v:
            raise ValueError('onPress_link is required for external_link')
        return v

    @validator('onPress_stack', always=True)
    def stack_required_if_stack(cls, v, values):
        if values.get('onPress_type') == 'stack' and not v:
            raise ValueError('onPress_stack is required for stack')
        return v


class PubliScreenAd(BaseModel):
    id: Optional[str] = Field(alias="_id")
    alias: str
    target: Literal["client", "professional"]
    html: Optional[str] = None
    base64: Optional[str] = None
    zip_base64: Optional[str] = None  # zipped folder (html/css/js/images) encoded in base64
    onClose_redirect: Optional[str] = None
    pressables: List[Pressable] = []
    is_active: bool = True
    priority: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    _check_html = validator('html', allow_reuse=True)(_validate_html_structure)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }
