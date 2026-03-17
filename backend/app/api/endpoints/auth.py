from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
import httpx
import urllib.parse
import logging
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Dict, Any

router = APIRouter()

GOOGLE_OAUTH_SESSION_TTL_SECONDS = 60
google_oauth_sessions: Dict[str, Dict[str, Any]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _cleanup_google_oauth_sessions() -> None:
    now = _utc_now()
    expired = [
        session_id
        for session_id, data in google_oauth_sessions.items()
        if data.get("expires_at") and data["expires_at"] <= now
    ]
    for session_id in expired:
        del google_oauth_sessions[session_id]

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


@router.post("/google/session")
async def create_google_oauth_session(request: Request):
    """Cria uma sessão de login Google para fluxo mobile com polling."""
    _cleanup_google_oauth_sessions()

    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_OAUTH_CLIENT_ID não configurado no backend.")

    session_id = uuid.uuid4().hex
    now = _utc_now()
    expires_at = now + timedelta(seconds=GOOGLE_OAUTH_SESSION_TTL_SECONDS)

    google_oauth_sessions[session_id] = {
        "status": "pending",
        "created_at": now,
        "expires_at": expires_at,
        "access_token": None,
        "refresh_token": None,
    }

    redirect_uri = "https://agilizapro.cloud/auth/google/callback"
    scope = "openid email profile"
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": session_id,
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)

    return {
        "session_id": session_id,
        "auth_url": auth_url,
        "expires_in": GOOGLE_OAUTH_SESSION_TTL_SECONDS,
    }


@router.get("/google/session/{session_id}")
async def get_google_oauth_session_status(session_id: str):
    """Consulta status da sessão Google OAuth para polling do app mobile."""
    _cleanup_google_oauth_sessions()

    session = google_oauth_sessions.get(session_id)
    if not session:
        return {"status": "expired"}

    now = _utc_now()
    expires_at = session.get("expires_at")
    if expires_at and expires_at <= now:
        del google_oauth_sessions[session_id]
        return {"status": "expired"}

    remaining = int((expires_at - now).total_seconds()) if expires_at else 0
    status_value = session.get("status", "pending")

    if status_value == "authorized":
        access_token = session.get("access_token")
        refresh_token = session.get("refresh_token")
        del google_oauth_sessions[session_id]
        return {
            "status": "authorized",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": max(remaining, 0),
        }

    return {
        "status": status_value,
        "expires_in": max(remaining, 0),
    }


@router.get("/google/start")
async def google_oauth_start(request: Request, redirect_uri: str | None = None, next: str | None = None):
    """Redirecta o usuário para a tela de consentimento do Google.

    Accepts `redirect_uri` (preferred) or `next` (legacy) to define where backend
    should redirect after OAuth callback with app tokens.
    """
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_OAUTH_CLIENT_ID não configurado no backend.")

    # Store app redirect URI in state BEFORE overwriting the parameter
    state_target = redirect_uri or next or ""
    state = urllib.parse.quote_plus(state_target)
    
    # Build redirect_uri to our backend callback (HTTPS forçado)
    backend_redirect_uri = "https://agilizapro.cloud/auth/google/callback"
    
    scope = "openid email profile"
    
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": backend_redirect_uri,
        "scope": scope,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(auth_url)


@router.get("/google/callback", name="google_callback")
async def google_oauth_callback(request: Request, code: str | None = None, state: str | None = None, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Recebe o `code` do Google, troca por tokens no backend, cria/atualiza usuário e emite JWTs.

    If a `state` deep-link was provided on /google/start, returns an HTML page that triggers
    a deep-link to the mobile app with the tokens. Otherwise returns JSON.
    """
    if not code:
        token_param = request.query_params.get("token")
        if token_param:
            html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Login concluído</title>
</head>
<body style=\"font-family: system-ui, sans-serif; text-align:center; padding:40px;\">
    <h2>Login concluído</h2>
    <p>Você pode fechar esta janela.</p>
</body>
</html>"""
            return HTMLResponse(content=html_content)

        error_param = request.query_params.get("error")
        if error_param:
            raise HTTPException(status_code=400, detail=f"Google OAuth error: {error_param}")

        raise HTTPException(status_code=400, detail="Missing code in callback")

    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not configured")

    try:
        # redirect_uri usado no /start (sempre o backend callback)
        backend_redirect_uri = "https://agilizapro.cloud/auth/google/callback"
        
        print(f"[OAuth Callback] Exchanging code for tokens...")

        token_endpoint = "https://oauth2.googleapis.com/token"
        async with httpx.AsyncClient() as client:
            resp = await client.post(token_endpoint, data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": backend_redirect_uri,
                "grant_type": "authorization_code",
            }, headers={"Accept": "application/json"})
            resp.raise_for_status()
            token_data = resp.json()

        id_token_str = token_data.get("id_token")
        if not id_token_str:
            raise HTTPException(status_code=400, detail="id_token not returned by Google")

        # Verify ID token
        audience_str = os.getenv("GOOGLE_AUDIENCE_CLIENT_IDS", "")
        if audience_str:
            valid_audience = [c.strip() for c in audience_str.split(',')]
        else:
            valid_audience = [client_id]

        idinfo = id_token.verify_oauth2_token(id_token_str, requests.Request(), audience=valid_audience)

        google_email = idinfo.get('email')
        google_name = idinfo.get('name', '')
        google_picture = idinfo.get('picture', '')

        if not google_email:
            raise HTTPException(status_code=400, detail="Google token inválido")

        # Upsert user
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

        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))

        # Fluxo polling: state contém session_id
        if state and state in google_oauth_sessions:
            session = google_oauth_sessions.get(state)
            if session:
                session["status"] = "authorized"
                session["access_token"] = access_token
                session["refresh_token"] = refresh_token
                print(f"[OAuth Callback] Session {state} authorized")

                html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Login concluído</title>
    <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #f5f5f5; }
        .container { max-width: 420px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #4CAF50; margin-bottom: 12px; }
        p { color: #666; line-height: 1.5; }
    </style>
</head>
<body>
    <div class=\"container\">
        <h1>✓ Login concluído</h1>
        <p>Você já pode voltar para o aplicativo.</p>
        <p>Esta janela pode ser fechada.</p>
    </div>
</body>
</html>"""
                return HTMLResponse(content=html_content)

        # If state has a redirect target, redirect directly with tokens in query params.
        if state:
            target = urllib.parse.unquote_plus(state)
            if target:
                separator = '&' if '?' in target else '?'
                query = urllib.parse.urlencode({
                    "token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                })
                final_redirect = f"{target}{separator}{query}"
                print(f"[OAuth Callback] Redirecting to app callback: {final_redirect}")
                return RedirectResponse(url=final_redirect)

        # Otherwise return JSON
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": user}

    except HTTPException:
        raise
    except Exception as e:
        if state and state in google_oauth_sessions:
            session = google_oauth_sessions.get(state)
            if session:
                session["status"] = "failed"
        print(f"[OAuth Callback] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/google/exchange", response_model=Token)
async def google_oauth_exchange(request: Request, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Endpoint oficial para troca de authorization code por tokens JWT.
    
    Conforme documentação do expo-auth-session:
    1. Mobile obtém authorization code do Google usando useAuthRequest()
    2. Mobile envia code + redirect_uri para este endpoint
    3. Backend troca code por tokens do Google
    4. Backend verifica, cria/atualiza usuário
    5. Backend retorna seus próprios JWTs para o mobile
    
    Body JSON esperado:
    {
      "code": "authorization_code_from_google",
      "redirect_uri": "redirect_uri_usado_no_oauth"
    }
    """
    try:
        body = await request.json()
        code = body.get("code")
        redirect_uri = body.get("redirect_uri")
        
        if not code:
            raise HTTPException(status_code=400, detail="Missing code parameter")
        if not redirect_uri:
            raise HTTPException(status_code=400, detail="Missing redirect_uri parameter")
        
        print(f"[Google Exchange] Received code exchange request with redirect_uri: {redirect_uri}")
        
        # Obter credenciais OAuth do backend
        client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            raise HTTPException(
                status_code=500, 
                detail="GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not configured"
            )
        
        # Trocar code por tokens com o Google
        token_endpoint = "https://oauth2.googleapis.com/token"
        async with httpx.AsyncClient() as client:
            resp = await client.post(token_endpoint, data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }, headers={"Accept": "application/json"})
            
            if resp.status_code != 200:
                error_detail = resp.text
                print(f"[Google Exchange] Error from Google: {error_detail}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to exchange code with Google: {error_detail}"
                )
            
            token_data = resp.json()
        
        # Extrair id_token do response
        id_token_str = token_data.get("id_token")
        if not id_token_str:
            raise HTTPException(status_code=400, detail="id_token not returned by Google")
        
        print("[Google Exchange] Successfully exchanged code for tokens")
        
        # Verificar id_token com o Google
        audience_str = os.getenv("GOOGLE_AUDIENCE_CLIENT_IDS", "")
        if audience_str:
            valid_audience = [c.strip() for c in audience_str.split(',')]
        else:
            valid_audience = [client_id]
        
        idinfo = id_token.verify_oauth2_token(
            id_token_str, 
            requests.Request(), 
            audience=valid_audience
        )
        
        # Extrair informações do usuário
        google_email = idinfo.get('email')
        google_name = idinfo.get('name', '')
        google_picture = idinfo.get('picture', '')
        
        if not google_email:
            raise HTTPException(status_code=400, detail="Email not found in Google token")
        
        print(f"[Google Exchange] Verified user: {google_email}")
        
        # Upsert usuário no banco de dados
        existing = await get_user_by_email(db, google_email)
        if existing:
            user = existing
            print(f"[Google Exchange] Existing user found: {user.id}")
        else:
            # Criar novo usuário com dados do Google
            user_create = UserCreate(
                email=google_email,
                full_name=google_name,
                cpf="000.000.000-00",  # CPF temporário
                password=str(uuid.uuid4()),  # Senha aleatória (não será usada)
                turnstile_token=None,
            )
            user = await create_user(db, user_create)
            print(f"[Google Exchange] New user created: {user.id}")
        
        # Gerar nossos próprios JWTs
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        
        print(f"[Google Exchange] Tokens generated for user {user.id}")
        
        return {
            "access_token": access_token, 
            "refresh_token": refresh_token, 
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Google Exchange] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


from fastapi import Request

@router.get("/turnstile-site-key")
async def get_turnstile_site_key(request: Request):
    """Retorna a chave pública do Turnstile e a URL hospedada (/turnstile) para uso no cliente"""
    from app.core.config import settings
    
    # Forçar HTTPS em produção (quando não é localhost)
    host = request.headers.get('host', request.url.hostname or 'localhost')
    is_localhost = 'localhost' in host or '127.0.0.1' in host or '0.0.0.0' in host
    
    # Sempre usar HTTPS em produção, mesmo que o request venha via proxy HTTP
    # GARANTIR HTTPS para domínios de produção
    if is_localhost:
        scheme = 'http'
    elif 'agilizapro.cloud' in host or 'agilizapro.net' in host:
        # Sempre HTTPS para domínios de produção
        scheme = 'https'
    else:
        # Forçar HTTPS por padrão para qualquer outro domínio
        scheme = 'https'
    
    turnstile_url = f"{scheme}://{host}/turnstile"
    
    # Log para debug
    print(f"[turnstile-site-key] host={host}, is_localhost={is_localhost}, scheme={scheme}, url={turnstile_url}")
    
    # Limpar quebras de linha/acidentes de formatação que podem ocorrer em alguns ambientes
    turnstile_url = turnstile_url.replace("\n", "").replace("\r", "").strip()

    # Também garantir que a chave não venha com espaços acidentais
    site_key = str(settings.turnstile_site_key).strip()

    return {"site_key": site_key, "turnstile_url": turnstile_url}

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