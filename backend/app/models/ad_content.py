from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime


class AdContent(BaseModel):
    """Representação de um anúncio armazenado no banco de dados.

    Originalmente os anúncios eram arquivos estáticos, mas agora também
    há um formato novo mais simples para banners que ficam em base64.
    """

    id: Optional[str] = Field(alias="_id")
    alias: str
    type: Literal["banner", "publi_screen", "image"] = "banner"
    target: Literal["client", "professional"]

    # campos antigos (podem ser usados para fallback ou publicidade HTML)
    index_html: Optional[str] = None
    css_files: Optional[List[str]] = None
    js_files: Optional[List[str]] = None
    image_files: Optional[List[str]] = None
    title: Optional[str] = None
    description: Optional[str] = None

    # novos campos para banner leve
    base64: Optional[str] = None
    onPress_type: Optional[Literal["external_link", "stack"]]
    onPress_link: Optional[str] = None
    onPress_stack: Optional[str] = None
    position: Optional[int] = None  # ordem no carrossel

    # controles gerais
    is_active: bool = True
    priority: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }
