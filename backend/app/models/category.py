from pydantic import BaseModel, Field
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

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class CategoryCreate(BaseModel):
    name: str
    tags: List[str] = []
    subcategories: List[Subcategory] = []

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    subcategories: Optional[List[Subcategory]] = None
    is_active: Optional[bool] = None
    default_remote_execution: Optional[bool] = None
