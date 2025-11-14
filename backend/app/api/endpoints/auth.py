from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.database import get_database
from app.core.security import create_access_token, create_refresh_token, verify_password, get_current_user
from app.crud.user import get_user_by_email, create_user
from app.schemas.user import UserCreate, Token, User, LoginRequest
from app.utils.validators import validate_email_unique, validate_roles
from app.utils.turnstile import verify_turnstile_token
from motor.motor_asyncio import AsyncIOMotorDatabase

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