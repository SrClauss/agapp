from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    cpf: str
    phone: Optional[str] = None
    roles: List[str] = Field(default=["client"])
    is_profile_complete: bool = False  # Novo campo
    avatar_url: Optional[str] = None  # URL pública do avatar (por ex, do Google)

class UserCreate(UserBase):
    password: str
    turnstile_token: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    professional_info: Optional[Dict[str, Any]] = None
    roles: Optional[List[str]] = None
    is_profile_complete: Optional[bool] = None  # Novo campo opcional para updates
    avatar_url: Optional[str] = None  # Novo campo opcional

class UserInDBBase(UserBase):
    id: str = Field(alias="_id")
    is_active: bool
    is_profile_complete: bool = False  # Novo campo
    credits: int = 0  # Créditos para contatar profissionais
    created_at: datetime
    updated_at: datetime
    coordinates: Optional[List[float]] = None
    subscription: Optional[Dict[str, Any]] = None
    evaluations: List[Dict[str, Any]] = []  # List of evaluations received (for professionals)
    average_rating: Optional[float] = None  # Calculated truncated mean

    class Config:
        from_attributes = True
        populate_by_name = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str
    user: Optional[User] = None

class TokenData(BaseModel):
    email: Optional[str] = None

class AddressGeocode(BaseModel):
    address: str


class AddressGeocodeResult(BaseModel):
    address: str
    coordinates: List[float]
    provider: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

class LoginRequest(BaseModel):
    username: str  # Email
    password: str
    turnstile_token: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    idToken: str

class ProfessionalSettings(BaseModel):
    """Configurações específicas do prestador de serviços"""
    establishment_name: Optional[str] = None
    establishment_address: Optional[str] = None
    establishment_coordinates: Optional[List[float]] = None  # [longitude, latitude]
    service_radius_km: Optional[float] = 10  # Raio padrão de atuação em km
    accepts_remote: bool = True  # Aceita trabalhos remotos
    portfolio_url: Optional[str] = None
    skills: Optional[List[str]] = []
    bio: Optional[str] = None
    subcategories: Optional[List[str]] = []  # Subcategories the professional works with

class ProfessionalSettingsUpdate(BaseModel):
    """Update professional settings"""
    establishment_name: Optional[str] = None
    establishment_address: Optional[str] = None
    establishment_coordinates: Optional[List[float]] = None
    service_radius_km: Optional[float] = None
    accepts_remote: Optional[bool] = None
    portfolio_url: Optional[str] = None
    skills: Optional[List[str]] = None
    bio: Optional[str] = None
    subcategories: Optional[List[str]] = None  # Subcategories the professional works with

class SubcategoryProjectCount(BaseModel):
    """Project count per subcategory"""
    subcategory: str
    count: int

class CategoryProjectCounts(BaseModel):
    """Project counts grouped by category"""
    category: str
    total_count: int
    subcategory_counts: List[SubcategoryProjectCount]

class FCMTokenRegister(BaseModel):
    """Schema para registrar FCM token"""
    fcm_token: str = Field(..., min_length=20)
    device_id: Optional[str] = None
    device_name: Optional[str] = None  # Ex: "Samsung Galaxy S21", "iPhone 13"