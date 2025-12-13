from datetime import datetime, timedelta
from typing import Any, Union
import bcrypt
import logging
from jose import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.core.database import get_database
from app.crud.user import get_user, get_user_in_db_by_email
from motor.motor_asyncio import AsyncIOMotorDatabase

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

async def authenticate_user(db: AsyncIOMotorDatabase, email: str, password: str):
    """Authenticate user by email and password"""
    user = await get_user_in_db_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

async def get_current_user_from_token(token: str, db: AsyncIOMotorDatabase):
    """Get current user from JWT token (used internally)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception:
        logging.error("Invalid token provided")
        raise credentials_exception

    user = await get_user(db, user_id)
    if user is None:
        raise credentials_exception
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get current user from Authorization header"""
    return await get_current_user_from_token(token, db)

async def get_current_user_from_request(request: Request, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Obtém o usuário atual a partir do Authorization header ou cookie.

    Aceita os formatos de token no cookie:
    - "Bearer <jwt>"
    - "<jwt>"
    E remove aspas caso presentes.
    """
    # Tenta primeiro via Authorization header
    authorization = request.headers.get("Authorization")
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    else:
        # Tenta via cookie
        token = request.cookies.get("access_token")
        if token:
            token = token.strip().strip('"').strip("'")
            if token.lower().startswith("bearer "):
                token = token.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await get_current_user_from_token(token, db)

async def get_current_admin_user(current_user = Depends(get_current_user_from_request)):
    """Verifica se o usuário atual é admin"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin access required.",
        )
    return current_user