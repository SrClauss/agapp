from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.user import get_user, update_user, get_professionals_nearby, get_users, delete_user
from pydantic import BaseModel
from app.schemas.user import User, UserUpdate, UserCreate, AddressGeocode, AddressGeocodeResult, ProfessionalSettings, ProfessionalSettingsUpdate, FCMTokenRegister
from app.services.geocoding import geocode_address
from app.services.geocoding import reverse_geocode
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

router = APIRouter()

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/me/evaluations", response_model=List[dict])
async def get_my_evaluations(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Retorna todas as avaliações recebidas pelo usuário atual.
    """
    from bson import ObjectId
    
    evaluations = []
    async for evaluation in db.evaluations.find({"professional_id": str(current_user.id)}).sort("created_at", -1):
        # Buscar nome do cliente
        client_id = evaluation.get("client_id")
        client = None
        if client_id:
            # Try string ID first
            client = await db.users.find_one({"_id": client_id})
            # Try ObjectId if string didn't work
            if not client and ObjectId.is_valid(client_id):
                client = await db.users.find_one({"_id": ObjectId(client_id)})
        
        evaluations.append({
            "id": str(evaluation["_id"]),
            "client_id": str(evaluation["client_id"]),
            "client_name": client.get("full_name") if client else None,
            "project_id": str(evaluation["project_id"]),
            "rating": evaluation["rating"],
            "comment": evaluation.get("comment"),
            "created_at": evaluation["created_at"]
        })
    
    return evaluations

@router.put("/me", response_model=User)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Proibir alteração do CPF se já estiver definido
    update_data = user_update.model_dump(exclude_unset=True)
    from app.utils.validators import is_valid_cpf, is_temporary_cpf

    if 'cpf' in update_data and current_user.cpf and (not is_temporary_cpf(current_user.cpf)) and update_data['cpf'] != current_user.cpf:
        raise HTTPException(status_code=400, detail="CPF não pode ser alterado uma vez cadastrado")

    # Se CPF está sendo definido agora (ou atualizando um CPF temporário), validar formato
    if 'cpf' in update_data and (not current_user.cpf or is_temporary_cpf(current_user.cpf)):
        if not is_valid_cpf(update_data.get('cpf')):
            raise HTTPException(status_code=400, detail="CPF inválido")

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

@router.post("/address/geocode", response_model=AddressGeocodeResult)
async def geocode_user_address(geocode: AddressGeocode):
    result = await geocode_address(geocode.address)
    if not result:
        raise HTTPException(status_code=400, detail="Could not geocode address")
    # result expected to contain address, coordinates, provider, raw
    return AddressGeocodeResult(
        address=result.get("address"),
        coordinates=result.get("coordinates"),
        provider=result.get("provider"),
        raw=result.get("raw")
    )


class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float


@router.post('/address/reverse')
async def reverse_user_address(req: ReverseGeocodeRequest):
    # Importar dentro da função para permitir monkeypatch em testes
    from app.services.geocoding import reverse_geocode
    address = await reverse_geocode(req.latitude, req.longitude)
    if not address:
        raise HTTPException(status_code=400, detail='Could not reverse geocode coordinates')
    return {"address": address}


@router.get('/professional/stats')
async def professional_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retorna estatísticas relevantes para o profissional autenticado"""
    if 'professional' not in current_user.roles:
        raise HTTPException(status_code=403, detail='User is not a professional')

    user_id = str(current_user.id)

    # Active subscriptions count
    active_subs = await db.subscriptions.count_documents({"user_id": user_id, "status": "active"})

    # Credits available: always from subscriptions (single source of truth)
    from app.utils.credit_pricing import get_user_credits
    credits_available = await get_user_credits(db, user_id)

    # Contacts received (as professional)
    contacts_received = await db.contacts.count_documents({"professional_id": user_id})

    # Projects completed by professional
    projects_completed = await db.projects.count_documents({"professional_id": user_id, "status": "completed"})

    return {
        "active_subscriptions": active_subs,
        "credits_available": credits_available,
        "contacts_received": contacts_received,
        "projects_completed": projects_completed
    }

@router.get("/me/professional-settings", response_model=ProfessionalSettings)
async def get_professional_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retorna as configurações do prestador de serviços"""
    try:
        if "professional" not in current_user.roles:
            raise HTTPException(status_code=403, detail="User is not a professional")

        # Buscar usuário atualizado do banco
        user = await db.users.find_one({"_id": str(current_user.id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        professional_info = user.get("professional_info", {})
        settings = professional_info.get("settings", {})

        return ProfessionalSettings(**settings) if settings else ProfessionalSettings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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


# Public user info (minimal) - used by clients to display simple profile info for other users
@router.get("/public/{user_id}")
async def read_user_public(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Return minimal public info for a user (id, full_name, avatar_url, phone). No auth required.

    Fallback logic: try by string _id first; if not found and looks like 24-char hex ObjectId (not UUID), try ObjectId(user_id).
    """
    logging.info(f"[PUBLIC USER] Lookup requested: user_id={user_id} (len={len(user_id)})")

    user = await db.users.find_one({"_id": user_id}, {"full_name": 1, "avatar_url": 1, "phone": 1})
    if user:
        logging.info(f"[PUBLIC USER] Found by string _id: {user_id}")
    else:
        # Try fallback ONLY for 24-char hex strings (ObjectId format), NOT UUIDs
        # UUIDs have hyphens and are 36 chars, ObjectIds are 24 hex chars
        from bson import ObjectId
        if len(user_id) == 24 and all(c in '0123456789abcdef' for c in user_id.lower()):
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)}, {"full_name": 1, "avatar_url": 1, "phone": 1})
                if user:
                    logging.info(f"[PUBLIC USER] Found by ObjectId fallback: {user_id}")
            except Exception as e:
                logging.warning(f"[PUBLIC USER] ObjectId conversion failed for {user_id}: {e}")
        else:
            logging.info(f"[PUBLIC USER] Not attempting ObjectId conversion (wrong format): {user_id}")

    if not user:
        logging.warning(f"[PUBLIC USER] NOT FOUND: user_id={user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    logging.info(f"[PUBLIC USER] Returning: id={user.get('_id')} name={user.get('full_name')}")
    return {
        "id": str(user.get("_id")),
        "full_name": user.get("full_name"),
        "avatar_url": user.get("avatar_url"),
        "phone": user.get("phone")
    }

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