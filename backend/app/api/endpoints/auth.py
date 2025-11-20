from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, verify_password, get_current_user
from app.crud.user import get_user_by_email, create_user, get_user_in_db_by_email
from app.schemas.user import UserCreate, Token, User, LoginRequest, GoogleLoginRequest
from app.utils.validators import validate_email_unique, validate_roles
from app.utils.turnstile import verify_turnstile_token
from motor.motor_asyncio import AsyncIOMotorDatabase
from google.oauth2 import id_token
from google.auth.transport import requests
import os

router = APIRouter()

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    # Verify Turnstile token
    if user.turnstile_token:
        await verify_turnstile_token(user.turnstile_token)

    # Validate email uniqueness
    existing_user = await get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate roles
    if not validate_roles(user.roles):
        raise HTTPException(status_code=400, detail="Invalid roles")

    # Create user
    db_user = await create_user(db, user)

    return db_user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncIOMotorDatabase = Depends(get_database)):
    user = await get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/login-with-turnstile", response_model=Token)
async def login_with_turnstile(login_data: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    # Verify Turnstile token
    if login_data.turnstile_token:
        await verify_turnstile_token(login_data.turnstile_token)

    user = await get_user_by_email(db, login_data.username)
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: str = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    # In a real implementation, validate refresh token
    access_token = create_access_token(subject=current_user)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=Token)
async def google_login(google_data: GoogleLoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Autentica usuário usando token do Google OAuth.
    Se o usuário não existe, cria uma nova conta automaticamente.
    """
    try:
        # Verificar o token ID do Google
        # GOOGLE_AUDIENCE_CLIENT_IDS deve ser uma string com os IDs separados por vírgula
        # ex: "id_web.apps...,id_android.apps...,id_ios.apps..."
        audience_str = os.getenv("GOOGLE_AUDIENCE_CLIENT_IDS", "")
        if not audience_str:
            raise HTTPException(
                status_code=500, 
                detail="GOOGLE_AUDIENCE_CLIENT_IDS não configurado no backend."
            )

        # A biblioteca do Google espera uma lista de IDs de cliente como 'audience'
        valid_audience = [client_id.strip() for client_id in audience_str.split(',')]

        # Verificar o token ID com o Google
        idinfo = id_token.verify_oauth2_token(
            google_data.idToken,
            requests.Request(),
            audience=valid_audience
        )

        # Extrair informações do usuário do token
        google_email = idinfo.get('email')
        google_name = idinfo.get('name', '')
        google_sub = idinfo.get('sub')  # ID único do Google

        if not google_email:
            raise HTTPException(status_code=400, detail="Email não encontrado no token do Google")

        # Verificar se o usuário já existe
        user = await get_user_in_db_by_email(db, google_email)

        if not user:
            # Criar novo usuário com dados do Google
            # Para CPF, usar um valor temporário (deve ser completado depois)
            new_user = UserCreate(
                email=google_email,
                full_name=google_name,
                password=google_sub,  # Usar o Google Sub como senha (nunca será usado para login direto)
                cpf="000.000.000-00",  # CPF temporário - usuário deve atualizar depois
                phone=None,
                roles=["client"]
            )
            user = await create_user(db, new_user)

        # Criar tokens de acesso
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user
        }

    except ValueError as e:
        # Token inválido
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token do Google inválido: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar login com Google: {str(e)}"
        )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Retorna informações do usuário autenticado"""
    return current_user