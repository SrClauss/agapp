from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, verify_password, get_current_user
from app.crud.user import get_user_by_email, create_user, get_user_in_db_by_email, update_user
from app.schemas.user import UserCreate, Token, User, LoginRequest, GoogleLoginRequest, UserUpdate
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
        google_picture = idinfo.get('picture', '')
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
                roles=["client"],
                is_profile_complete=False,  # Novo campo
                avatar_url=google_picture  # Novo campo
            )
            await create_user(db, new_user)
            # Recarregar usuário do banco para garantir todos os campos preenchidos (is_active, timestamps, etc.)
            user = await get_user_in_db_by_email(db, google_email)

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

@router.put("/complete-profile", response_model=User)
async def complete_profile(
    profile_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Completa o perfil do usuário autenticado.
    Atualiza campos como phone, cpf, full_name, password, roles e marca como completo.
    """
    import logging
    logger = logging.getLogger(__name__)
    from app.crud.user import get_password_hash
    from app.core.firebase import create_or_update_firebase_user

    # Validar roles se fornecidas
    if profile_data.roles and not validate_roles(profile_data.roles):
        raise HTTPException(status_code=400, detail="Invalid roles")

    # Preparar dados de atualização (somente campos setados)
    update_dict = profile_data.model_dump(exclude_unset=True)

    # Log resumo para depuração (mascarando valores sensíveis como CPF)
    def _mask(val: str | None) -> str | None:
        if not val:
            return None
        s = str(val)
        return '***' + s[-2:]

    logger.info("complete-profile called for user %s (%s); incoming fields: %s", current_user.id, current_user.email, list(update_dict.keys()))
    if 'cpf' in update_dict:
        logger.info("CPF update requested. current CPF: %s, incoming CPF (masked): %s", _mask(current_user.cpf), _mask(update_dict.get('cpf')))

    # Proibir alteração de CPF se já existir e não for temporário
    from app.utils.validators import is_valid_cpf, is_temporary_cpf

    if 'cpf' in update_dict and current_user.cpf and (not is_temporary_cpf(current_user.cpf)) and update_dict['cpf'] != current_user.cpf:
        logger.warning("Attempt to change CPF for user %s blocked (current: %s, incoming masked: %s)", current_user.id, _mask(current_user.cpf), _mask(update_dict.get('cpf')))
        raise HTTPException(status_code=400, detail="CPF não pode ser alterado uma vez cadastrado")

    # Se CPF está sendo definido agora (ou atualizando um CPF temporário), validar formato
    if 'cpf' in update_dict and (not current_user.cpf or is_temporary_cpf(current_user.cpf)):
        if not is_valid_cpf(update_dict.get('cpf')):
            logger.warning("Invalid CPF provided for user %s: %s", current_user.id, _mask(update_dict.get('cpf')))
            raise HTTPException(status_code=400, detail="CPF inválido")

    # Capturar senha limpa antes de fazer hash (se fornecida)
    raw_password = None
    if 'password' in update_dict:
        raw_password = update_dict['password']
        update_dict['hashed_password'] = get_password_hash(update_dict.pop('password'))

    # Marcar perfil como completo
    update_dict['is_profile_complete'] = True

    # Log seguro: não incluir valores sensíveis
    safe_fields = {k: v for k, v in update_dict.items() if k != 'hashed_password'}
    logger.debug("Completing profile for user %s with fields: %s", current_user.id, safe_fields)

    # Se havia senha, sincronizar com Firebase Auth (não bloquear o usuário em caso de falha)
    if raw_password:
        try:
            create_or_update_firebase_user(current_user.email, raw_password, display_name=update_dict.get('full_name') or current_user.full_name)
            logger.info("Firebase user created/updated for %s", current_user.email)
        except Exception as e:
            logger.warning("Firebase user sync failed for %s: %s", current_user.email, str(e))

    # Atualizar usuário
    try:
        updated_user = await update_user(db, current_user.id, update_dict)
    except Exception as e:
        logger.error("Error updating user %s: %s", current_user.id, str(e))
        raise HTTPException(status_code=500, detail="Error updating user")

    if not updated_user:
        logger.warning("User not found when updating profile: %s", current_user.id)
        raise HTTPException(status_code=404, detail="User not found")

    # Log resultado do CPF após atualização (mascarado)
    logger.info("Profile updated for user %s; CPF after update (masked): %s", current_user.id, _mask(getattr(updated_user, 'cpf', None)))

    logger.debug("Profile updated for user %s", current_user.id)
    return updated_user

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Retorna informações do usuário autenticado"""
    return current_user