from pydantic import BaseModel, Field, root_validator, ValidationError
from typing import List, Optional, Dict
from datetime import datetime

class Subcategory(BaseModel):
    name: str
    tags: List[str] = []  # Tags de busca para a subcategoria

class Category(BaseModel):
    id: str = Field(alias="_id")
    name: str  # Nome da categoria principal (ex: "Programação", "Serviços Jurídicos")
    tags: List[str] = []  # Tags de busca para a categoria principal
    subcategories: List[Subcategory] = []  # Lista de subcategorias com suas tags
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    default_remote_execution: bool = False  # Categorias que por padrão permitem execução remota
    icon_name: Optional[str] = None  # Nome do ícone (ex: "hammer-wrench", "code-braces")
    icon_library: Optional[str] = None  # Biblioteca do ícone (ex: "MaterialCommunityIcons", "FontAwesome")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class CategoryCreate(BaseModel):
    name: str
    tags: List[str] = []
    subcategories: List[Subcategory] = []
    icon_name: Optional[str] = None
    icon_library: Optional[str] = None

    @root_validator(pre=True)
    def validate_icon_name(cls, values):
        from app.utils.material_icons import is_valid_material_icon
        icon_name = values.get('icon_name')
        icon_library = values.get('icon_library')
        if icon_name and icon_library == 'MaterialIcons':
            if not is_valid_material_icon(icon_name):
                raise ValueError(f'Invalid Material Icon name: {icon_name}')
        return values

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    subcategories: Optional[List[Subcategory]] = None
    is_active: Optional[bool] = None
    default_remote_execution: Optional[bool] = None
    icon_name: Optional[str] = None
    icon_library: Optional[str] = None

    @root_validator(pre=True)
    def validate_icon_name_update(cls, values):
        from app.utils.material_icons import is_valid_material_icon
        icon_name = values.get('icon_name')
        icon_library = values.get('icon_library')
        # icon_name may be None for partial updates; only validate when provided
        if icon_name is not None and icon_library == 'MaterialIcons':
            if not is_valid_material_icon(icon_name):
                raise ValueError(f'Invalid Material Icon name: {icon_name}')
        return values
