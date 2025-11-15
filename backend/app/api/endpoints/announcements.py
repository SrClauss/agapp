"""
Endpoints de Anúncios
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import aiofiles
from pathlib import Path

from app.core.database import get_database
from app.core.security import get_current_user
from app.crud import announcement as announcement_crud
from app.crud.user import get_user_by_id
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
    AnnouncementPublic,
    AnnouncementInteraction
)

router = APIRouter()

# Diretório para upload de imagens
UPLOAD_DIR = Path("static/announcements")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def get_current_admin(
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Verifica se usuário é admin"""
    user = await get_user_by_id(db, current_user_id)
    if not user or "admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage announcements"
        )
    return user


# Endpoints Públicos (para usuários autenticados)


@router.get("/active", response_model=List[AnnouncementPublic])
async def get_active_announcements(
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista anúncios ativos para o usuário"""
    # Determina o role do usuário
    user = await get_user_by_id(db, current_user_id)
    user_role = None

    if user:
        if "professional" in user.roles:
            user_role = "professional"
        elif "client" in user.roles:
            user_role = "client"

    announcements = await announcement_crud.get_active_announcements(db, user_role)
    return announcements


@router.get("/type/{announcement_type}", response_model=List[AnnouncementPublic])
async def get_announcements_by_type(
    announcement_type: str,
    limit: int = Query(10, ge=1, le=50),
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista anúncios ativos de um tipo específico"""
    if announcement_type not in ["banner", "card", "modal", "feature"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid announcement type"
        )

    user = await get_user_by_id(db, current_user_id)
    user_role = None

    if user:
        if "professional" in user.roles:
            user_role = "professional"
        elif "client" in user.roles:
            user_role = "client"

    announcements = await announcement_crud.get_announcements_by_type(
        db, announcement_type, user_role, limit
    )
    return announcements


@router.post("/interaction")
async def register_interaction(
    interaction: AnnouncementInteraction,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Registra interação com anúncio (view/click)"""
    if interaction.interaction_type == "view":
        success = await announcement_crud.increment_view_count(db, interaction.announcement_id)
    elif interaction.interaction_type == "click":
        success = await announcement_crud.increment_click_count(db, interaction.announcement_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid interaction type"
        )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )

    return {"message": "Interaction registered successfully"}


# Endpoints Admin


@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    announcement: AnnouncementCreate,
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Cria novo anúncio (admin)"""
    new_announcement = await announcement_crud.create_announcement(
        db, announcement, admin_user.id
    )
    return new_announcement


@router.get("/", response_model=List[AnnouncementResponse])
async def list_all_announcements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista todos os anúncios (admin)"""
    announcements = await announcement_crud.get_all_announcements(db, skip, limit)
    return announcements


@router.get("/stats")
async def get_announcement_stats(
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retorna estatísticas de anúncios (admin)"""
    stats = await announcement_crud.get_announcement_stats(db)
    return stats


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: str,
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtém detalhes de um anúncio (admin)"""
    announcement = await announcement_crud.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )
    return announcement


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    announcement_update: AnnouncementUpdate,
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualiza anúncio (admin)"""
    announcement = await announcement_crud.update_announcement(
        db, announcement_id, announcement_update
    )
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )
    return announcement


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    permanent: bool = Query(False),
    admin_user=Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Deleta anúncio (admin)"""
    if permanent:
        success = await announcement_crud.delete_announcement_permanent(db, announcement_id)
    else:
        success = await announcement_crud.delete_announcement(db, announcement_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )

    return {"message": "Announcement deleted successfully"}


@router.post("/upload-image")
async def upload_announcement_image(
    file: UploadFile = File(...),
    admin_user=Depends(get_current_admin),
):
    """Upload de imagem para anúncio (admin)"""
    # Validar tipo de arquivo
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Validar tamanho (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB"
        )

    # Gerar nome único
    from ulid import ULID
    unique_filename = f"{ULID()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    # Salvar arquivo
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Retornar URL
    image_url = f"/static/announcements/{unique_filename}"
    return {"image_url": image_url, "filename": unique_filename}
