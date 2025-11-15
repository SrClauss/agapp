"""
Endpoints de Autenticação para Atendentes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import JWTError, jwt

from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, get_current_user
from app.crud import attendant as attendant_crud
from app.schemas.attendant import (
    AttendantLogin,
    AttendantResponse,
    AttendantPasswordUpdate,
    AttendantCreate,
    AttendantUpdate
)
from app.schemas.user import Token
from app.core.config import settings

router = APIRouter()
templates = Jinja2Templates(directory="templates")


# HTML Pages
@router.get("/login", response_class=HTMLResponse)
async def attendant_login_page(request: Request):
    """Página de login para atendentes"""
    return templates.TemplateResponse("attendant_login.html", {"request": request})


@router.get("/dashboard", response_class=HTMLResponse)
async def attendant_dashboard_page(request: Request):
    """Dashboard para atendentes"""
    return templates.TemplateResponse("attendant_dashboard.html", {"request": request})


# API Endpoints
async def get_current_attendant(
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Dependency para obter atendente atual"""
    attendant = await attendant_crud.get_attendant_by_id(db, current_user_id)
    if not attendant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendant not found"
        )
    if not attendant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendant is not active"
        )
    return attendant


@router.post("/login", response_model=Token)
async def login_attendant(
    login_data: AttendantLogin,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Login de atendente"""
    attendant = await attendant_crud.authenticate_attendant(
        db,
        login_data.email,
        login_data.password
    )

    if not attendant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Marca como online
    await attendant_crud.update_online_status(db, attendant.id, True)

    # Gera tokens
    access_token = create_access_token(subject=str(attendant.id))
    refresh_token = create_refresh_token(subject=str(attendant.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout_attendant(
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Logout de atendente - marca como offline"""
    await attendant_crud.update_online_status(db, attendant.id, False)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=AttendantResponse)
async def get_current_attendant_info(
    attendant=Depends(get_current_attendant)
):
    """Retorna informações do atendente atual"""
    return attendant


@router.put("/me", response_model=AttendantResponse)
async def update_current_attendant(
    attendant_update: AttendantUpdate,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualiza dados do atendente atual"""
    updated_attendant = await attendant_crud.update_attendant(
        db,
        attendant.id,
        attendant_update
    )

    if not updated_attendant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update attendant"
        )

    return updated_attendant


@router.put("/me/password")
async def update_attendant_password(
    password_update: AttendantPasswordUpdate,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualiza senha do atendente"""
    # Verifica senha atual
    if not attendant_crud.verify_password(
        password_update.current_password,
        attendant.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Atualiza senha
    success = await attendant_crud.update_password(
        db,
        attendant.id,
        password_update.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update password"
        )

    return {"message": "Password updated successfully"}


# Endpoints administrativos (requerem role admin)
@router.post("/create", response_model=AttendantResponse)
async def create_attendant(
    attendant_data: AttendantCreate,
    current_attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Cria novo atendente (apenas admin)"""
    if current_attendant.role not in ["admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create attendants"
        )

    # Verifica se email já existe
    existing = await attendant_crud.get_attendant_by_email(db, attendant_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Cria atendente
    new_attendant = await attendant_crud.create_attendant(
        db,
        attendant_data,
        created_by=current_attendant.id
    )

    return new_attendant


@router.get("/list", response_model=list[AttendantResponse])
async def list_attendants(
    skip: int = 0,
    limit: int = 50,
    current_attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista todos os atendentes (apenas admin/supervisor)"""
    if current_attendant.role not in ["admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list attendants"
        )

    attendants = await attendant_crud.get_all_attendants(db, skip, limit)
    return attendants


@router.get("/available", response_model=list[AttendantResponse])
async def get_available_attendants(
    limit: int = 10,
    current_attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista atendentes disponíveis para atribuição"""
    if current_attendant.role not in ["admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view available attendants"
        )

    attendants = await attendant_crud.get_available_attendants(db, limit)
    return attendants


@router.delete("/{attendant_id}")
async def delete_attendant(
    attendant_id: str,
    current_attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Desativa atendente (apenas admin)"""
    if current_attendant.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete attendants"
        )

    success = await attendant_crud.delete_attendant(db, attendant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendant not found"
        )

    return {"message": "Attendant deleted successfully"}
