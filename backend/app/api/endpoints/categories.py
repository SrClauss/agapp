from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.category import Category, CategoryCreate, CategoryUpdate
from app.schemas.user import User
from app.crud.category import (
    get_categories,
    get_category,
    get_category_by_name,
    create_category,
    update_category,
    delete_category,
    add_subcategory,
    remove_subcategory,
    search_categories_by_tags
)

router = APIRouter()

@router.get("/", response_model=List[Category])
async def list_categories(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Listar todas as categorias disponíveis.

    - **skip**: Quantidade de registros a pular (paginação)
    - **limit**: Quantidade máxima de registros a retornar
    - **active_only**: Retornar apenas categorias ativas
    """
    return await get_categories(db, skip=skip, limit=limit, active_only=active_only)

@router.get("/{category_id}", response_model=Category)
async def get_category_detail(
    category_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Buscar uma categoria específica por ID.
    """
    category = await get_category(db, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada"
        )
    return category

@router.post("/", response_model=Category, status_code=status.HTTP_201_CREATED)
async def create_new_category(
    category_data: CategoryCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    """
    Criar uma nova categoria.
    Requer autenticação de administrador.
    """
    # Verificar se é admin
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem criar categorias"
        )

    # Verificar se já existe categoria com mesmo nome
    existing = await get_category_by_name(db, category_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma categoria com este nome"
        )

    return await create_category(db, category_data)

@router.put("/{category_id}", response_model=Category)
async def update_category_data(
    category_id: str,
    category_data: CategoryUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    """
    Atualizar uma categoria existente.
    Requer autenticação de administrador.
    """
    # Verificar se é admin
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem atualizar categorias"
        )

    category = await update_category(db, category_id, category_data)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada"
        )

    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category_endpoint(
    category_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    """
    Deletar uma categoria (soft delete).
    Requer autenticação de administrador.
    """
    # Verificar se é admin
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem deletar categorias"
        )

    deleted = await delete_category(db, category_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada"
        )

@router.post("/{category_id}/subcategories", response_model=Category)
async def add_subcategory_endpoint(
    category_id: str,
    subcategory: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    """
    Adicionar uma subcategoria a uma categoria existente.
    Requer autenticação de administrador.
    """
    # Verificar se é admin
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem adicionar subcategorias"
        )

    category = await add_subcategory(db, category_id, subcategory)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada"
        )

    return category

@router.delete("/{category_id}/subcategories/{subcategory}", response_model=Category)
async def remove_subcategory_endpoint(
    category_id: str,
    subcategory: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user)
):
    """
    Remover uma subcategoria de uma categoria existente.
    Requer autenticação de administrador.
    """
    # Verificar se é admin
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem remover subcategorias"
        )

    category = await remove_subcategory(db, category_id, subcategory)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada"
        )

    return category

@router.get("/search", response_model=List[Dict[str, Any]])
async def search_categories(
    q: str = Query(..., description="Termo de busca (ex: 'conserto televisão')"),
    limit: int = Query(20, ge=1, le=100, description="Limite de resultados"),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Buscar categorias e subcategorias por tags.

    Retorna resultados ordenados por relevância (número de tags em comum).

    Exemplo: Buscar "conserto televisão" retorna:
    - Categorias/subcategorias com tags ["conserto", "televisão"] primeiro (2 matches)
    - Categorias/subcategorias com tags ["conserto"] ou ["televisão"] depois (1 match)

    Cada resultado contém:
    - type: "category" ou "subcategory"
    - name: Nome da categoria/subcategoria
    - tags: Lista de tags
    - match_count: Número de tags que deram match
    - parent_category: Nome da categoria pai (apenas para subcategorias)
    """
    if not q or not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Termo de busca não pode estar vazio"
        )

    results = await search_categories_by_tags(db, q, limit)
    return results



