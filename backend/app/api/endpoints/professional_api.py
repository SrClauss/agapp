from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.database import get_database
from app.schemas.user import User
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict

router = APIRouter(prefix="/api/professional", tags=["professional"])

@router.get("/stats")
async def professional_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict:
    """Retorna estatísticas relevantes para o profissional autenticado"""
    if 'professional' not in current_user.roles:
        raise HTTPException(status_code=403, detail='User is not a professional')

    user_id = str(current_user.id)

    # Active subscriptions count
    active_subscriptions = await db.subscriptions.count_documents({"user_id": user_id, "status": "active"})

    # Credits available: try active subscription then fallback to user.credits
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    credits_available = int(subscription.get('credits', 0)) if subscription else getattr(current_user, 'credits', 0)

    # Contacts received (as professional)
    contacts_received = await db.contacts.count_documents({"professional_id": user_id})

    # Projects completed by professional
    projects_completed = await db.projects.count_documents({"professional_id": user_id, "status": "completed"})

    return {
        "active_subscriptions": active_subscriptions,
        "credits_available": credits_available,
        "contacts_received": contacts_received,
        "projects_completed": projects_completed
    }
