"""
CRUD operations para Anúncios
"""
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from ulid import ULID

from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate


async def create_announcement(
    db: AsyncIOMotorDatabase,
    announcement: AnnouncementCreate,
    created_by: str
) -> Announcement:
    """Cria novo anúncio"""
    now = datetime.utcnow()

    announcement_dict = {
        "_id": str(ULID()),
        "title": announcement.title,
        "description": announcement.description,
        "image_url": announcement.image_url,
        "type": announcement.type,
        "cta_text": announcement.cta_text,
        "cta_link": announcement.cta_link,
        "target_audience": announcement.target_audience,
        "priority": announcement.priority,
        "start_date": announcement.start_date,
        "end_date": announcement.end_date,
        "is_active": announcement.is_active,
        "html_content": announcement.html_content,
        "views_count": 0,
        "clicks_count": 0,
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }

    await db.announcements.insert_one(announcement_dict)
    return Announcement(**announcement_dict)


async def get_announcement_by_id(
    db: AsyncIOMotorDatabase,
    announcement_id: str
) -> Optional[Announcement]:
    """Busca anúncio por ID"""
    announcement = await db.announcements.find_one({"_id": announcement_id})
    if announcement:
        return Announcement(**announcement)
    return None


async def get_all_announcements(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 50
) -> List[Announcement]:
    """Lista todos os anúncios (admin)"""
    cursor = db.announcements.find().skip(skip).limit(limit).sort([
        ("priority", -1),
        ("created_at", -1)
    ])

    announcements = []
    async for doc in cursor:
        announcements.append(Announcement(**doc))

    return announcements


async def get_active_announcements(
    db: AsyncIOMotorDatabase,
    user_role: Optional[str] = None
) -> List[Announcement]:
    """Lista anúncios ativos para o usuário"""
    now = datetime.utcnow()

    # Base query: ativos e dentro do período
    query = {
        "is_active": True,
        "start_date": {"$lte": now},
        "end_date": {"$gte": now}
    }

    # Filtrar por audiência
    if user_role:
        query["$or"] = [
            {"target_audience": "all"},
            {"target_audience": user_role},
            {"target_audience": {"$in": [user_role, "all"]}}
        ]
    else:
        query["target_audience"] = "all"

    cursor = db.announcements.find(query).sort([
        ("priority", -1),
        ("start_date", -1)
    ])

    announcements = []
    async for doc in cursor:
        announcements.append(Announcement(**doc))

    return announcements


async def get_announcements_by_type(
    db: AsyncIOMotorDatabase,
    announcement_type: str,
    user_role: Optional[str] = None,
    limit: int = 10
) -> List[Announcement]:
    """Lista anúncios ativos de um tipo específico"""
    now = datetime.utcnow()

    query = {
        "is_active": True,
        "type": announcement_type,
        "start_date": {"$lte": now},
        "end_date": {"$gte": now}
    }

    # Filtrar por audiência
    if user_role:
        query["$or"] = [
            {"target_audience": "all"},
            {"target_audience": user_role},
            {"target_audience": {"$in": [user_role, "all"]}}
        ]
    else:
        query["target_audience"] = "all"

    cursor = db.announcements.find(query).sort([
        ("priority", -1),
        ("start_date", -1)
    ]).limit(limit)

    announcements = []
    async for doc in cursor:
        announcements.append(Announcement(**doc))

    return announcements


async def update_announcement(
    db: AsyncIOMotorDatabase,
    announcement_id: str,
    announcement_update: AnnouncementUpdate
) -> Optional[Announcement]:
    """Atualiza anúncio"""
    update_data = announcement_update.model_dump(exclude_unset=True)
    if not update_data:
        return await get_announcement_by_id(db, announcement_id)

    update_data["updated_at"] = datetime.utcnow()

    result = await db.announcements.update_one(
        {"_id": announcement_id},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    return await get_announcement_by_id(db, announcement_id)


async def delete_announcement(
    db: AsyncIOMotorDatabase,
    announcement_id: str
) -> bool:
    """Deleta anúncio (soft delete - marca como inativo)"""
    result = await db.announcements.update_one(
        {"_id": announcement_id},
        {"$set": {
            "is_active": False,
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def delete_announcement_permanent(
    db: AsyncIOMotorDatabase,
    announcement_id: str
) -> bool:
    """Deleta anúncio permanentemente"""
    result = await db.announcements.delete_one({"_id": announcement_id})
    return result.deleted_count > 0


async def increment_view_count(
    db: AsyncIOMotorDatabase,
    announcement_id: str
) -> bool:
    """Incrementa contador de visualizações"""
    result = await db.announcements.update_one(
        {"_id": announcement_id},
        {"$inc": {"views_count": 1}}
    )
    return result.modified_count > 0


async def increment_click_count(
    db: AsyncIOMotorDatabase,
    announcement_id: str
) -> bool:
    """Incrementa contador de cliques"""
    result = await db.announcements.update_one(
        {"_id": announcement_id},
        {"$inc": {"clicks_count": 1}}
    )
    return result.modified_count > 0


async def get_announcement_stats(db: AsyncIOMotorDatabase) -> dict:
    """Retorna estatísticas de anúncios"""
    now = datetime.utcnow()

    total = await db.announcements.count_documents({})
    active = await db.announcements.count_documents({
        "is_active": True,
        "start_date": {"$lte": now},
        "end_date": {"$gte": now}
    })

    # Anúncios mais visualizados
    top_viewed = []
    cursor = db.announcements.find().sort("views_count", -1).limit(5)
    async for doc in cursor:
        top_viewed.append({
            "id": doc["_id"],
            "title": doc["title"],
            "views": doc["views_count"],
            "clicks": doc["clicks_count"]
        })

    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "top_viewed": top_viewed
    }
