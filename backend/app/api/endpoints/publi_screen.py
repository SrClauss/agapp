from fastapi import APIRouter, Depends, HTTPException, Form, Request, status, UploadFile, File
from fastapi.responses import JSONResponse
from typing import Literal
from app.core.database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.publi_screen_ad import PubliScreenAd
from app.core.security import get_current_user_from_request
from app.models.user import User

router = APIRouter()
admin_router = APIRouter()


# mobile endpoints
@router.get("/{ad_type}/check")
async def mobile_check(ad_type: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ad_type.startswith("publi_screen_"):
        raise HTTPException(status_code=404, detail="Not a publiscreen ad type")
    target = "client" if "client" in ad_type else "professional"
    ad = await db.publi_screen_ads.find_one({"target": target, "is_active": True}, sort=[("priority", -1)])
    exists = bool(ad)
    return JSONResponse({"ad_type": ad_type, "exists": exists, "configured": exists})


@router.get("/{ad_type}")
async def mobile_get(ad_type: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ad_type.startswith("publi_screen_"):
        raise HTTPException(status_code=404, detail="Not a publiscreen ad type")
    target = "client" if "client" in ad_type else "professional"
    raw = await db.publi_screen_ads.find_one({"target": target, "is_active": True}, sort=[("priority", -1)])
    if raw:
        try:
            ad = PubliScreenAd(**raw)
        except Exception:
            ad = None
        if ad:
            return JSONResponse(ad.dict(by_alias=True, exclude_none=True))
    return JSONResponse(status_code=204, content=None)


# admin endpoints
@admin_router.post("/publi_screen")
async def admin_create_or_update(
    alias: str = Form(...),
    target: Literal["client", "professional"] = Form(...),
    html: str = Form(''),
    pressables: str = Form('[]'),  # JSON string
    priority: int = Form(0),
    is_active: bool = Form(True),
    package: UploadFile = File(None),  # optional zip file with html/css/js/images
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_user_from_request)
):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage publiscreen ads")
    import json
    try:
        press_objs = json.loads(pressables)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid pressables JSON")
    ad_obj = {
        "alias": alias,
        "target": target,
        "html": html or None,
        "pressables": press_objs,
        "priority": priority,
        "is_active": is_active
    }
    # if a package blob was sent, read and encode to base64
    if package:
        import base64
        contents = await package.read()
        ad_obj["zip_base64"] = base64.b64encode(contents).decode('utf-8')
    ad = PubliScreenAd(**ad_obj)
    await db.publi_screen_ads.update_one({"alias": alias}, {"$set": ad.dict(by_alias=True, exclude_none=True)}, upsert=True)
    return JSONResponse({"ok": True, "alias": alias})

@admin_router.get("/publi_screen/{alias}")
async def admin_get(alias: str, db: AsyncIOMotorDatabase = Depends(get_database), current_user: User = Depends(get_current_user_from_request)):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    ad = await db.publi_screen_ads.find_one({"alias": alias})
    if not ad:
        raise HTTPException(status_code=404, detail="Not found")
    return JSONResponse(ad)

@admin_router.delete("/publi_screen/{alias}")
async def admin_delete(alias: str, db: AsyncIOMotorDatabase = Depends(get_database), current_user: User = Depends(get_current_user_from_request)):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    await db.publi_screen_ads.delete_one({"alias": alias})
    return JSONResponse({"ok": True})
