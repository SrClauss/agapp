from fastapi import APIRouter, Depends, HTTPException, Form, Request, status
from fastapi.responses import JSONResponse
from typing import Literal
from app.core.database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.banner import Banner
from app.core.security import get_current_user_from_request
from app.models.user import User

# routers for banners
router = APIRouter()
admin_router = APIRouter()


@router.get("/{ad_type}/check")
async def banner_mobile_check(ad_type: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Mobile endpoint to check if a banner exists in the database."""
    if not ad_type.startswith("banner_"):
        raise HTTPException(status_code=404, detail="Not a banner ad type")
    target = "client" if "client" in ad_type else "professional"
    banner = await db.ad_contents.find_one({
        "target": target,
        "is_active": True
    }, sort=[("position", 1)])
    exists = bool(banner)
    return JSONResponse({"ad_type": ad_type, "exists": exists, "configured": exists})


@router.get("/{ad_type}")
async def banner_mobile_get(ad_type: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Mobile endpoint returning banner metadata (base64 + navigation).

    Falls back to legacy file logic if no valid DB banner is found.
    """
    if not ad_type.startswith("banner_"):
        raise HTTPException(status_code=404, detail="Not a banner ad type")
    target = "client" if "client" in ad_type else "professional"
    raw = await db.ad_contents.find_one({
        # "type" field removed, only target is stored
        "target": target,
        "is_active": True
    }, sort=[("position", 1)])
    if raw and raw.get("base64"):
        try:
            banner = Banner(**raw)
        except Exception:
            banner = None
        if banner:
            return JSONResponse({
                "ad_type": ad_type,
                "alias": banner.alias,
                "base64": banner.base64,
                "onPress_type": banner.onPress_type,
                "onPress_link": banner.onPress_link,
                "onPress_stack": banner.onPress_stack,
                "target": banner.target,
                "position": banner.position,
            })
    # otherwise, caller should fall back to file-based handling (handled in ads.py)
    location = None
    return JSONResponse(status_code=204, content=None)


@admin_router.post("/banner-metadata")
async def admin_save_banner_metadata(
    adType: str = Form(...),
    onPress_type: str = Form(None),
    onPress_link: str = Form(None),
    onPress_stack: str = Form(None),
    position: int = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user_from_request)
):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can modify banner metadata")

    target = "client" if "client" in adType else "professional"
    query = {"target": target}
    banner_obj = {
        "target": target,
        "onPress_type": onPress_type,
        "onPress_link": onPress_link,
        "onPress_stack": onPress_stack,
        "position": position,
        "is_active": True,
        "alias": f"banner_{target}_home"
    }
    banner_doc = Banner(**banner_obj).dict(by_alias=True, exclude_none=True)
    await db.ad_contents.update_one(query, {"$set": banner_doc}, upsert=True)
    return JSONResponse({"ok": True})
