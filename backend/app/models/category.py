from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Category(BaseModel):
    id: str = Field(alias="_id")
    name: str  # Nome da categoria principal (ex: "Programação", "Serviços Jurídicos")
    subcategories: List[str] = []  # Lista de subcategorias (ex: ["Desenvolvimento Web", "App Mobile"])
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    default_remote_execution: bool = False  # Categorias que por padrão permitem execução remota

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class CategoryCreate(BaseModel):
    name: str
    subcategories: List[str] = []

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    subcategories: Optional[List[str]] = None
    is_active: Optional[bool] = None
    default_remote_execution: Optional[bool] = None
