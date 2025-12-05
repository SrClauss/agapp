from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.crud.category import search_categories_and_subcategories_suggestions
import re

router = APIRouter()

@router.get("/suggestions", response_model=List[Dict[str, Any]])
async def get_search_suggestions(
    q: str = Query(..., min_length=1, description="Termo de busca para sugestões"),
    limit: int = Query(10, ge=1, le=50, description="Limite de sugestões"),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Buscar sugestões de categorias e subcategorias em tempo real.

    Este endpoint é otimizado para buscas incrementais (enquanto o usuário digita).

    **Diferenças do endpoint `/categories/search`:**
    - Retorna menos resultados (padrão 10 vs 20)
    - Busca também por nome (não apenas tags)
    - Otimizado para respostas rápidas

    **Funcionamento:**
    - Busca em nomes de categorias e subcategorias
    - Busca em tags de categorias e subcategorias
    - Ordena por relevância (match exato > match parcial)
    - Retorna apenas categorias ativas

    **Formato de retorno:**
    Cada sugestão contém:
    - `type`: "category" ou "subcategory"
    - `id`: ID da categoria (se subcategoria, ID da categoria pai)
    - `name`: Nome da categoria/subcategoria
    - `tags`: Lista de tags
    - `match_count`: Número de termos que deram match
    - `parent_category`: Nome da categoria pai (apenas para subcategorias)
    - `match_type`: "exact_name", "partial_name" ou "tag"

    **Exemplos:**
    - `q=progra` → Retorna "Programação", "Programação Web", etc.
    - `q=conserto tv` → Retorna categorias com tags ["conserto", "televisão"]
    """
    if not q or not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Termo de busca não pode estar vazio"
        )

    results = await search_categories_and_subcategories_suggestions(db, q.strip(), limit)
    return results
