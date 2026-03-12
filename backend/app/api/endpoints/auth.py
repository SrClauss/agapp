from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, verify_password, get_current_user, get_current_user_from_token
from app.crud.user import get_user_by_email, create_user, get_user_in_db_by_email, update_user
from app.schemas.user import UserCreate, Token, User, LoginRequest, GoogleLoginRequest, UserUpdate
from app.utils.validators import validate_email_unique, validate_roles
from app.utils.turnstile import verify_turnstile_token
from motor.motor_asyncio import AsyncIOMotorDatabase
from google.oauth2 import id_token
from google.auth.transport import requests
import os
import uuid
import urllib.parse
import httpx

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
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Login com proteção Turnstile.

    - Tenta obter `turnstile_token` do form (campo `turnstile_token`) ou do header `X-Turnstile-Token`.
    - Se o request já vier autenticado (Authorization: Bearer <token> válido), permite bypass do Turnstile (útil para auto-login após update de perfil).
    """
    # Check for Authorization header to allow an authenticated bypass (e.g., auto-login)
    bypass_turnstile = False
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            # Valida token e obtém usuário atual para autorizar bypass
            await get_current_user_from_token(token, db)
            bypass_turnstile = True
        except Exception:
            bypass_turnstile = False

    # Extract turnstile token from form or header
    turnstile_token = None
    try:
        form = await request.form()
        turnstile_token = form.get("turnstile_token")
    except Exception:
        turnstile_token = None

    if not bypass_turnstile:
        # Allow token via header as fallback
        if not turnstile_token:
            turnstile_token = request.headers.get("X-Turnstile-Token")
        if not turnstile_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Turnstile token is required for login")
        await verify_turnstile_token(turnstile_token)

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
        # Suporta dois fluxos:
        # 1. idToken  - verificado via google.oauth2.id_token (fluxo nativo)
        # 2. accessToken - verificado chamando o userinfo endpoint do Google (fluxo web/Expo)
        if google_data.idToken:
            audience_str = os.getenv("GOOGLE_AUDIENCE_CLIENT_IDS", "")
            if not audience_str:
                raise HTTPException(
                    status_code=500,
                    detail="GOOGLE_AUDIENCE_CLIENT_IDS não configurado no backend."
                )
            valid_audience = [client_id.strip() for client_id in audience_str.split(',')]
            idinfo = id_token.verify_oauth2_token(
                google_data.idToken,
                requests.Request(),
                audience=valid_audience
            )
        elif google_data.accessToken:
            import httpx
            async with httpx.AsyncClient() as http:
                resp = await http.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {google_data.accessToken}"},
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="accessToken do Google inválido ou expirado")
            idinfo = resp.json()
        else:
            raise HTTPException(status_code=400, detail="Forneça idToken ou accessToken")

        # Extrair informações do usuário do token
        google_email = idinfo.get('email')
        google_name = idinfo.get('name', '')
        google_picture = idinfo.get('picture', '')
        google_sub = idinfo.get('sub')  # ID único do Google

        if not google_email:
            raise HTTPException(status_code=400, detail="Google token inválido")

        # Continua o fluxo original...
        existing = await get_user_by_email(db, google_email)
        if existing:
            user = existing
        else:
            # Criar usuário com CPF temporário
            user_create = UserCreate(
                email=google_email,
                full_name=google_name,
                cpf="000.000.000-00",
                password=str(uuid.uuid4()),
                turnstile_token=None,
            )
            user = await create_user(db, user_create)

        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))

        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": user}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Fluxo OAuth server-side para Expo Go (sem proxy auth.expo.io, sem módulos nativos)
# ---------------------------------------------------------------------------
# Passo 1: app abre /auth/google/start?return_url=<deep_link>
# Passo 2: backend redireciona para Google com redirect_uri = este servidor
# Passo 3: Google chama /auth/google/callback?code=...&state=...
# Passo 4: backend troca code por token, cria usuário, redireciona para return_url?token=JWT
# ---------------------------------------------------------------------------

_GOOGLE_CLIENT_ID  = "36227471485-8bogr7vvdga110v3c9ha29gu3khom83c.apps.googleusercontent.com"
_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET_WEB", "")
_BACKEND_BASE = os.getenv("BACKEND_PUBLIC_URL", "https://agilizapro.cloud")


@router.get("/google/start")
async def google_oauth_start(return_url: str):
    """Inicia o fluxo OAuth server-side. O app passa seu deep link como return_url."""
    if not _GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_SECRET_WEB não configurado")

    redirect_uri = f"{_BACKEND_BASE}/auth/google/callback"
    state = urllib.parse.quote(return_url, safe="")

    params = urllib.parse.urlencode({
        "client_id": _GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
async def google_oauth_callback(code: str, state: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Recebe o code do Google, troca por tokens, cria usuário e redireciona para o app."""
    if not _GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_SECRET_WEB não configurado")

    return_url = urllib.parse.unquote(state)
    redirect_uri = f"{_BACKEND_BASE}/auth/google/callback"

    # Trocar code por tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": _GOOGLE_CLIENT_ID,
                "client_secret": _GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Erro ao trocar code: {token_resp.text}")

    token_data = token_resp.json()
    access_token_google = token_data.get("access_token")

    # Buscar perfil do usuário
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token_google}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Erro ao buscar perfil do Google")

    userinfo = userinfo_resp.json()
    google_email   = userinfo.get("email")
    google_name    = userinfo.get("name", "")
    google_picture = userinfo.get("picture", "")

    if not google_email:
        raise HTTPException(status_code=400, detail="Google não retornou email")

    # Criar ou encontrar usuário
    existing = await get_user_by_email(db, google_email)
    if existing:
        user = existing
    else:
        user_create = UserCreate(
            email=google_email,
            full_name=google_name,
            cpf="000.000.000-00",
            password=str(uuid.uuid4()),
            turnstile_token=None,
        )
        user = await create_user(db, user_create)

    # Gerar JWT da aplicação
    app_token = create_access_token(subject=str(user.id))

    # Redirecionar de volta para o deep link do app com o token
    separator = "&" if "?" in return_url else "?"
    final_url = f"{return_url}{separator}token={app_token}&email={urllib.parse.quote(google_email)}"
    return RedirectResponse(final_url)


from fastapi import Request

@router.get("/turnstile-site-key")
async def get_turnstile_site_key(request: Request):
    """Retorna a chave pública do Turnstile e a URL hospedada (/turnstile) para uso no cliente"""
    from app.core.config import settings
    # Construir URL absoluta para a página hospedada /turnstile
    try:
        turnstile_url = request.url_for("turnstile_page")
    except Exception:
        # Fallback: construir a partir do host
        base = str(request.base_url).rstrip('/')
        turnstile_url = f"{base}/turnstile"
    # Garantir que retornamos uma string (Request.url_for pode retornar um objeto URL em alguns ambientes)
    turnstile_url = str(turnstile_url)
    return {"site_key": settings.turnstile_site_key, "turnstile_url": turnstile_url}

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
        logger.info("About to call update_user with update_dict keys: %s", list(update_dict.keys()))
        if 'cpf' in update_dict:
            logger.info("CPF in update_dict before calling update_user: %s", _mask(update_dict['cpf']))
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
    logger = logging.getLogger(__name__)
    logger.info("DEBUG: current_user dict: %s", current_user.dict())
    return current_user