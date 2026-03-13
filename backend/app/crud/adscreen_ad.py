from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import Binary
import ulid
from datetime import datetime

from app.models.adscreen_ad import AdScreenAd


async def get_or_create_adscreen(
    db: AsyncIOMotorDatabase,
    target: str,
    user_id: Optional[str] = None
) -> AdScreenAd:
    """Get existing adscreen or create new one for target"""
    adscreen_dict = await db.adscreen_ads.find_one({"target": target})
    
    if adscreen_dict:
        return AdScreenAd(**adscreen_dict)
    
    # Create new adscreen
    new_adscreen = {
        "_id": ulid.new().str,
        "target": target,
        "zip_data": None,
        "zip_filename": "",
        "zip_size": 0,
        "action_type": "none",
        "action_value": None,
        "version": 1,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": user_id,
        "updated_by": user_id
    }
    
    await db.adscreen_ads.insert_one(new_adscreen)
    return AdScreenAd(**new_adscreen)


async def update_adscreen(
    db: AsyncIOMotorDatabase,
    target: str,
    zip_bytes: bytes,
    filename: str,
    action_type: str = "none",
    action_value: Optional[str] = None,
    user_id: Optional[str] = None
) -> Optional[AdScreenAd]:
    """Update adscreen with new ZIP and increment version"""
    # Convert bytes to BSON Binary
    zip_binary = Binary(zip_bytes)
    
    # Check if adscreen exists
    existing = await db.adscreen_ads.find_one({"target": target})
    
    if existing:
        # Update existing document
        result = await db.adscreen_ads.find_one_and_update(
            {"target": target},
            {
                "$set": {
                    "zip_data": zip_binary,
                    "zip_filename": filename,
                    "zip_size": len(zip_bytes),
                    "action_type": action_type,
                    "action_value": action_value,
                    "updated_at": datetime.utcnow(),
                    "updated_by": user_id
                },
                "$inc": {"version": 1}
            },
            return_document=True
        )
    else:
        # Create new document
        new_adscreen = {
            "_id": ulid.new().str,
            "target": target,
            "zip_data": zip_binary,
            "zip_filename": filename,
            "zip_size": len(zip_bytes),
            "action_type": action_type,
            "action_value": action_value,
            "version": 1,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": user_id,
            "updated_by": user_id
        }
        await db.adscreen_ads.insert_one(new_adscreen)
        result = new_adscreen
    
    if result:
        return AdScreenAd(**result)
    return None


async def get_adscreen_by_target(
    db: AsyncIOMotorDatabase,
    target: str,
    include_zip: bool = False
) -> Optional[AdScreenAd]:
    """
    Get adscreen by target
    Set include_zip=False to exclude heavy zip_data field
    """
    projection = None
    if not include_zip:
        projection = {"zip_data": 0}
    
    adscreen_dict = await db.adscreen_ads.find_one({"target": target}, projection)
    if adscreen_dict:
        return AdScreenAd(**adscreen_dict)
    return None


async def get_adscreen_version(
    db: AsyncIOMotorDatabase,
    target: str
) -> Optional[Dict[str, Any]]:
    """Get only version and updated_at for sync check"""
    result = await db.adscreen_ads.find_one(
        {"target": target},
        {"version": 1, "updated_at": 1, "_id": 0}
    )
    return result


async def clear_adscreen(
    db: AsyncIOMotorDatabase,
    target: str,
    user_id: Optional[str] = None
) -> Optional[AdScreenAd]:
    """Clear adscreen ZIP and increment version"""
    result = await db.adscreen_ads.find_one_and_update(
        {"target": target},
        {
            "$set": {
                "zip_data": None,
                "zip_filename": "",
                "zip_size": 0,
                "action_type": "none",
                "action_value": None,
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            },
            "$inc": {"version": 1}
        },
        return_document=True
    )
    
    if result:
        return AdScreenAd(**result)
    return None


async def delete_adscreen(
    db: AsyncIOMotorDatabase,
    target: str
) -> bool:
    """Permanently delete adscreen"""
    result = await db.adscreen_ads.delete_one({"target": target})
    return result.deleted_count > 0
