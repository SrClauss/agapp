from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.user import get_user, update_user, get_professionals_nearby, get_users, delete_user
from app.schemas.user import User, UserUpdate, UserCreate, AddressGeocode
from app.services.geocoding import geocode_address
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=User)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user = await update_user(db, str(current_user.id), user_update)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/professionals/nearby", response_model=list[User])
async def get_nearby_professionals(
    latitude: float,
    longitude: float,
    radius_km: float = 10,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    professionals = await get_professionals_nearby(db, longitude, latitude, radius_km)
    return professionals

@router.post("/address/geocode")
async def geocode_user_address(geocode: AddressGeocode):
    result = await geocode_address(geocode.address)
    if not result:
        raise HTTPException(status_code=400, detail="Could not geocode address")
    return result

# Admin endpoints
@router.get("/admin/", response_model=List[User])
async def read_users_admin(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    users = await get_users(db, skip=skip, limit=limit)
    return users

@router.get("/admin/{user_id}", response_model=User)
async def read_user_admin(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/admin/{user_id}", response_model=User)
async def update_user_admin(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user = await update_user(db, user_id, user_update)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/admin/{user_id}")
async def delete_user_admin(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    success = await delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}