from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import get_current_admin_user
from app.core.database import get_database
from app.crud import config as config_crud
from app.models.user import User

router = APIRouter()

@router.get("/config/system")
async def get_system_config_api(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get singleton system configuration"""
    return await config_crud.get_system_config(db)


@router.put("/config/system")
async def update_system_config_api(
    payload: dict,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update singleton system configuration"""
    return await config_crud.update_system_config(db, payload)
