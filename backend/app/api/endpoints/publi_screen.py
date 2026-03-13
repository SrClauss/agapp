from fastapi import APIRouter, Depends, HTTPException, Form, Request, status, UploadFile, File, Header
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
    """Retorna apenas existência e etag — sem blob. Usado pelo mobile para checar
    se precisa baixar o anúncio completo."""
    if not ad_type.startswith("publi_screen_"):
        raise HTTPException(status_code=404, detail="Not a publiscreen ad type")
    target = "client" if "client" in ad_type else "professional"
    raw = await db.publi_screen_ads.find_one(
        {"target": target, "is_active": True},
        sort=[("priority", -1)],
        projection={"_id": 0, "zip_blob": 0}  # nunca retorna o blob aqui
    )
    if not raw:
        return JSONResponse({"ad_type": ad_type, "exists": False, "configured": False, "etag": None})
    import hashlib
    updated_at = str(raw.get("updated_at", ""))
    etag = hashlib.md5(updated_at.encode()).hexdigest()
    return JSONResponse({"ad_type": ad_type, "exists": True, "configured": True, "etag": etag})


@router.get("/{ad_type}")
async def mobile_get(request: Request, ad_type: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Retorna o anúncio completo (com zip_base64). Suporta ETag / If-None-Match:
    se o cliente enviar If-None-Match igual ao etag atual, responde 304 (sem corpo)."""
    import base64 as b64mod, hashlib
    if not ad_type.startswith("publi_screen_"):
        raise HTTPException(status_code=404, detail="Not a publiscreen ad type")
    target = "client" if "client" in ad_type else "professional"
    raw = await db.publi_screen_ads.find_one({"target": target, "is_active": True}, sort=[("priority", -1)])
    if not raw:
        return JSONResponse(status_code=204, content=None)

    updated_at = str(raw.get("updated_at", ""))
    etag = hashlib.md5(updated_at.encode()).hexdigest()

    # Se o cliente já tem esta versão, economiza todo o tráfego do blob
    if_none_match = request.headers.get("if-none-match", "")
    if if_none_match and if_none_match.strip('"') == etag:
        from fastapi.responses import Response
        return Response(status_code=304, headers={"ETag": f'"{etag}"'})

    try:
        ad = PubliScreenAd(**raw)
    except Exception:
        return JSONResponse(status_code=204, content=None)

    data = ad.dict(by_alias=True, exclude_none=True)
    blob = data.pop('zip_blob', None)
    if blob and isinstance(blob, (bytes, bytearray)):
        data['zip_base64'] = b64mod.b64encode(blob).decode('utf-8')
    data['etag'] = etag

    return JSONResponse(data, headers={"ETag": f'"{etag}"'})


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
    # if a package blob was sent, save it directly as a binary blob
    if package:
        contents = await package.read()
            ad_obj["zip_blob"] = contents  # Save raw binary data
    # Sempre atualiza updated_at ao salvar para invalidar o ETag
    from datetime import datetime as dt
    ad_obj["updated_at"] = dt.utcnow()
    ad = PubliScreenAd(**ad_obj)
    await db.publi_screen_ads.update_one({"alias": alias}, {"$set": ad.dict(by_alias=True, exclude_none=True)}, upsert=True)
    return JSONResponse({"ok": True, "alias": alias})

@admin_router.get("/publi_screen/{alias}")
async def admin_get(alias: str, db: AsyncIOMotorDatabase = Depends(get_database), current_user: User = Depends(get_current_user_from_request)):
    import base64 as b64mod
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    raw = await db.publi_screen_ads.find_one({"alias": alias})
    if not raw:
        raise HTTPException(status_code=404, detail="Not found")
    raw.pop('_id', None)
    blob = raw.pop('zip_blob', None)
    if blob and isinstance(blob, (bytes, bytearray)):
        raw['has_zip'] = True
        raw['zip_size_bytes'] = len(blob)
    return JSONResponse(raw)

@admin_router.delete("/publi_screen/{alias}")
async def admin_delete(alias: str, db: AsyncIOMotorDatabase = Depends(get_database), current_user: User = Depends(get_current_user_from_request)):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    await db.publi_screen_ads.delete_one({"alias": alias})
    return JSONResponse({"ok": True})
