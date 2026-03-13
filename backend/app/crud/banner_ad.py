from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import ulid
from datetime import datetime

from app.models.banner_ad import BannerAd, BannerImage


async def get_or_create_banner(
    db: AsyncIOMotorDatabase,
    target: str,
    user_id: Optional[str] = None
) -> BannerAd:
    """Get existing banner or create new one for target"""
    banner_dict = await db.banner_ads.find_one({"target": target})
    
    if banner_dict:
        return BannerAd(**banner_dict)
    
    # Create new banner
    new_banner = {
        "_id": ulid.new().str,
        "target": target,
        "images": [],
        "version": 1,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": user_id,
        "updated_by": user_id
    }
    
    await db.banner_ads.insert_one(new_banner)
    return BannerAd(**new_banner)


async def add_image_to_banner(
    db: AsyncIOMotorDatabase,
    target: str,
    image_data_base64: str,
    filename: str,
    mime_type: str,
    size: int,
    action_type: str = "none",
    action_value: Optional[str] = None,
    order: int = 0,
    user_id: Optional[str] = None
) -> Optional[BannerAd]:
    """Add image to banner and increment version"""
    image_data = {
        "filename": filename,
        "data": image_data_base64,
        "size": size,
        "mime_type": mime_type,
        "action_type": action_type,
        "action_value": action_value,
        "order": order
    }
    
    result = await db.banner_ads.find_one_and_update(
        {"target": target},
        {
            "$push": {"images": image_data},
            "$inc": {"version": 1},
            "$set": {
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            }
        },
        return_document=True
    )
    
    if result:
        return BannerAd(**result)
    return None


async def remove_image_from_banner(
    db: AsyncIOMotorDatabase,
    target: str,
    filename: str,
    user_id: Optional[str] = None
) -> Optional[BannerAd]:
    """Remove image from banner and increment version"""
    result = await db.banner_ads.find_one_and_update(
        {"target": target},
        {
            "$pull": {"images": {"filename": filename}},
            "$inc": {"version": 1},
            "$set": {
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            }
        },
        return_document=True
    )
    
    if result:
        return BannerAd(**result)
    return None


async def get_banner_by_target(
    db: AsyncIOMotorDatabase,
    target: str
) -> Optional[BannerAd]:
    """Get banner by target"""
    banner_dict = await db.banner_ads.find_one({"target": target})
    if banner_dict:
        return BannerAd(**banner_dict)
    return None


async def get_banner_version(
    db: AsyncIOMotorDatabase,
    target: str
) -> Optional[Dict[str, Any]]:
    """Get only version and updated_at for sync check"""
    result = await db.banner_ads.find_one(
        {"target": target},
        {"version": 1, "updated_at": 1, "_id": 0}
    )
    return result


async def clear_banner(
    db: AsyncIOMotorDatabase,
    target: str,
    user_id: Optional[str] = None
) -> Optional[BannerAd]:
    """Clear all images from banner and increment version"""
    result = await db.banner_ads.find_one_and_update(
        {"target": target},
        {
            "$set": {
                "images": [],
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            },
            "$inc": {"version": 1}
        },
        return_document=True
    )
    
    if result:
        return BannerAd(**result)
    return None


async def update_banner_images(
    db: AsyncIOMotorDatabase,
    target: str,
    images: list,
    user_id: Optional[str] = None
) -> Optional[BannerAd]:
    """Replace all images in banner and increment version"""
    result = await db.banner_ads.find_one_and_update(
        {"target": target},
        {
            "$set": {
                "images": images,
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            },
            "$inc": {"version": 1}
        },
        return_document=True
    )
    
    if result:
        return BannerAd(**result)
    return None


async def update_image_action(
    db: AsyncIOMotorDatabase,
    target: str,
    filename: str,
    action_type: str,
    action_value: Optional[str] = None,
    user_id: Optional[str] = None
) -> Optional[BannerAd]:
    """Update action for a specific image in banner and increment version"""
    result = await db.banner_ads.find_one_and_update(
        {
            "target": target,
            "images.filename": filename
        },
        {
            "$set": {
                "images.$.action_type": action_type,
                "images.$.action_value": action_value,
                "updated_at": datetime.utcnow(),
                "updated_by": user_id
            },
            "$inc": {"version": 1}
        },
        return_document=True
    )
    
    if result:
        return BannerAd(**result)
    return None
