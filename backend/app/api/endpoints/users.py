from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.user import get_user, update_user, get_professionals_nearby, get_users, delete_user
from app.schemas.user import User, UserUpdate, UserCreate, AddressGeocode, ProfessionalSettings, ProfessionalSettingsUpdate, FCMTokenRegister
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

@router.get("/me/professional-settings", response_model=ProfessionalSettings)
async def get_professional_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retorna as configurações do prestador de serviços"""
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="User is not a professional")

    # Buscar usuário atualizado do banco
    user = await db.users.find_one({"_id": str(current_user.id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    professional_info = user.get("professional_info", {})
    settings = professional_info.get("settings", {})

    return ProfessionalSettings(**settings) if settings else ProfessionalSettings()

@router.put("/me/professional-settings", response_model=User)
async def update_professional_settings(
    settings: ProfessionalSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualiza as configurações do prestador de serviços"""
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="User is not a professional")

    # Geocode establishment address if provided
    if settings.establishment_address:
        geocoded = await geocode_address(settings.establishment_address)
        if geocoded and "coordinates" in geocoded:
            settings.establishment_coordinates = geocoded["coordinates"]

    # Buscar professional_info atual
    user = await db.users.find_one({"_id": str(current_user.id)})
    professional_info = user.get("professional_info", {})
    current_settings = professional_info.get("settings", {})

    # Merge settings (mantém valores não-nulos)
    updated_settings = {**current_settings}
    for key, value in settings.dict(exclude_none=True).items():
        updated_settings[key] = value

    # Atualizar no banco
    professional_info["settings"] = updated_settings

    await db.users.update_one(
        {"_id": str(current_user.id)},
        {"$set": {"professional_info": professional_info}}
    )

    # Retornar usuário atualizado
    updated_user = await get_user(db, str(current_user.id))
    return updated_user

@router.get("/me/professional/project-counts", response_model=List)
async def get_professional_project_counts(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Retorna contagem de projetos por categoria/subcategoria baseado nas 
    subcategorias cadastradas pelo profissional e sua localização.
    
    Para projetos não-remotos: filtra por localização + subcategorias
    Para projetos remotos: filtra apenas por subcategorias
    """
    from app.schemas.user import CategoryProjectCounts, SubcategoryProjectCount
    
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="User is not a professional")
    
    # Buscar configurações do profissional
    user = await db.users.find_one({"_id": str(current_user.id)})
    professional_info = user.get("professional_info", {})
    settings = professional_info.get("settings", {})
    
    subcategories = settings.get("subcategories", [])
    if not subcategories:
        return []
    
    coords = settings.get("establishment_coordinates")
    radius_km = settings.get("service_radius_km", 10)
    
    # Buscar todas as categorias para agrupar subcategorias
    categories_map = {}
    async for category in db.categories.find({"is_active": True}):
        cat_name = category.get("name")
        cat_subs = category.get("subcategories", [])
        for sub in cat_subs:
            categories_map[sub] = cat_name
    
    # Agrupar contagens por categoria
    category_counts = {}
    
    for subcategory in subcategories:
        category_name = categories_map.get(subcategory, "Outros")
        
        # Contagem de projetos não-remotos (se houver coordenadas)
        non_remote_count = 0
        if coords and len(coords) == 2:
            non_remote_query = {
                "category.sub": subcategory,
                "remote_execution": False,
                "status": "open",
                "location.coordinates": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": coords
                        },
                        "$maxDistance": radius_km * 1000
                    }
                }
            }
            non_remote_count = await db.projects.count_documents(non_remote_query)
        
        # Contagem de projetos remotos
        remote_query = {
            "category.sub": subcategory,
            "remote_execution": True,
            "status": "open"
        }
        remote_count = await db.projects.count_documents(remote_query)
        
        total_count = non_remote_count + remote_count
        
        if category_name not in category_counts:
            category_counts[category_name] = {
                "category": category_name,
                "total_count": 0,
                "subcategory_counts": []
            }
        
        category_counts[category_name]["total_count"] += total_count
        category_counts[category_name]["subcategory_counts"].append({
            "subcategory": subcategory,
            "count": total_count
        })
    
    # Converter para lista
    result = list(category_counts.values())
    return result

@router.post("/me/fcm-token")
async def register_fcm_token(
    token_data: FCMTokenRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Registra FCM token para notificações push

    O token é adicionado à lista de tokens do usuário (suporta múltiplos dispositivos).
    Se o token já existe, não duplica.
    """
    from datetime import datetime

    # Criar objeto de token com metadados
    token_obj = {
        "token": token_data.fcm_token,
        "device_id": token_data.device_id,
        "device_name": token_data.device_name,
        "registered_at": datetime.utcnow()
    }

    # Remover token antigo do mesmo device_id (se houver)
    if token_data.device_id:
        await db.users.update_one(
            {"_id": str(current_user.id)},
            {"$pull": {"fcm_tokens": {"device_id": token_data.device_id}}}
        )

    # Adicionar novo token
    await db.users.update_one(
        {"_id": str(current_user.id)},
        {"$addToSet": {"fcm_tokens": token_obj}}
    )

    return {"message": "FCM token registered successfully"}

@router.delete("/me/fcm-token/{fcm_token}")
async def unregister_fcm_token(
    fcm_token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Remove FCM token (logout do dispositivo)

    Útil quando o usuário faz logout em um dispositivo específico.
    """
    result = await db.users.update_one(
        {"_id": str(current_user.id)},
        {"$pull": {"fcm_tokens": {"token": fcm_token}}}
    )

    if result.modified_count > 0:
        return {"message": "FCM token removed successfully"}
    else:
        return {"message": "Token not found or already removed"}

@router.get("/me/fcm-tokens")
async def list_fcm_tokens(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista todos os tokens FCM registrados do usuário"""
    user = await db.users.find_one({"_id": str(current_user.id)})
    tokens = user.get("fcm_tokens", [])

    return {
        "tokens": tokens,
        "count": len(tokens)
    }

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