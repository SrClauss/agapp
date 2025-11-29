from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any, Tuple
from bson import ObjectId
from datetime import datetime
from app.models.category import Category, CategoryCreate, CategoryUpdate
import re

async def get_categories(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
    query_filter: Optional[Dict[str, Any]] = None,
    active_only: bool = True
) -> List[Category]:
    """Buscar categorias com filtros opcionais"""
    filter_query = query_filter or {}

    if active_only:
        filter_query["is_active"] = True

    cursor = db.categories.find(filter_query).skip(skip).limit(limit).sort("name", 1)
    categories = []

    async for category in cursor:
        category["_id"] = str(category["_id"])
        categories.append(Category(**category))

    return categories

async def get_category(db: AsyncIOMotorDatabase, category_id: str) -> Optional[Category]:
    """Buscar uma categoria por ID"""
    try:
        category = await db.categories.find_one({"_id": ObjectId(category_id)})
        if category:
            category["_id"] = str(category["_id"])
            return Category(**category)
        return None
    except Exception:
        return None

async def get_category_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[Category]:
    """Buscar uma categoria por nome"""
    category = await db.categories.find_one({"name": name})
    if category:
        category["_id"] = str(category["_id"])
        return Category(**category)
    return None

async def create_category(db: AsyncIOMotorDatabase, category_data: CategoryCreate) -> Category:
    """Criar uma nova categoria"""
    category_dict = {
        "name": category_data.name,
        "tags": category_data.tags,
        "subcategories": [sub.dict() for sub in category_data.subcategories],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True,
        "default_remote_execution": False
    }

    result = await db.categories.insert_one(category_dict)
    category_dict["_id"] = str(result.inserted_id)

    return Category(**category_dict)

async def update_category(
    db: AsyncIOMotorDatabase,
    category_id: str,
    category_data: CategoryUpdate
) -> Optional[Category]:
    """Atualizar uma categoria existente"""
    try:
        update_dict = {k: v for k, v in category_data.dict(exclude_unset=True).items()}
        update_dict["updated_at"] = datetime.utcnow()

        result = await db.categories.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": update_dict}
        )

        if result.modified_count > 0:
            return await get_category(db, category_id)
        return None
    except Exception:
        return None

async def delete_category(db: AsyncIOMotorDatabase, category_id: str) -> bool:
    """Deletar uma categoria (soft delete - marca como inativa)"""
    try:
        result = await db.categories.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    except Exception:
        return False

async def delete_category_permanent(db: AsyncIOMotorDatabase, category_id: str) -> bool:
    """Deletar uma categoria permanentemente"""
    try:
        result = await db.categories.delete_one({"_id": ObjectId(category_id)})
        return result.deleted_count > 0
    except Exception:
        return False

async def add_subcategory(
    db: AsyncIOMotorDatabase,
    category_id: str,
    subcategory: str
) -> Optional[Category]:
    """Adicionar uma subcategoria a uma categoria existente"""
    try:
        result = await db.categories.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$addToSet": {"subcategories": subcategory},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        if result.modified_count > 0:
            return await get_category(db, category_id)
        return None
    except Exception:
        return None

async def remove_subcategory(
    db: AsyncIOMotorDatabase,
    category_id: str,
    subcategory: str
) -> Optional[Category]:
    """Remover uma subcategoria de uma categoria existente"""
    try:
        result = await db.categories.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$pull": {"subcategories": subcategory},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        if result.modified_count > 0:
            return await get_category(db, category_id)
        return None
    except Exception:
        return None

async def search_categories_by_tags(
    db: AsyncIOMotorDatabase,
    search_query: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Buscar categorias e subcategorias por tags.
    Retorna resultados ordenados por número de tags em comum (ranking).

    Exemplo: Se buscar "conserto televisão", retorna:
    - Categoria com tags ["conserto", "televisão"] = 2 matches (primeiro)
    - Categoria com tags ["conserto"] = 1 match (segundo)
    """
    # Normalizar e dividir a query em termos de busca
    search_terms = [term.strip().lower() for term in re.split(r'\s+', search_query) if term.strip()]

    if not search_terms:
        return []

    # Buscar todas as categorias ativas
    cursor = db.categories.find({"is_active": True})
    results = []

    async for category in cursor:
        category_id = str(category["_id"])
        category_name = category.get("name", "")
        category_tags = [tag.lower() for tag in category.get("tags", [])]

        # Calcular matches nas tags da categoria principal
        category_matches = sum(1 for term in search_terms if any(term in tag for tag in category_tags))

        if category_matches > 0:
            results.append({
                "type": "category",
                "id": category_id,
                "name": category_name,
                "tags": category.get("tags", []),
                "match_count": category_matches,
                "parent_category": None
            })

        # Verificar subcategorias
        for subcategory in category.get("subcategories", []):
            if isinstance(subcategory, dict):
                sub_name = subcategory.get("name", "")
                sub_tags = [tag.lower() for tag in subcategory.get("tags", [])]

                # Calcular matches nas tags da subcategoria
                sub_matches = sum(1 for term in search_terms if any(term in tag for tag in sub_tags))

                if sub_matches > 0:
                    results.append({
                        "type": "subcategory",
                        "id": category_id,
                        "name": sub_name,
                        "tags": subcategory.get("tags", []),
                        "match_count": sub_matches,
                        "parent_category": category_name
                    })

    # Ordenar por número de matches (decrescente)
    results.sort(key=lambda x: x["match_count"], reverse=True)

    return results[:limit]
