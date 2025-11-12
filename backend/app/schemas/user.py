from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    cpf: str
    phone: Optional[str] = None
    roles: List[str] = Field(default=["client"])

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    professional_info: Optional[Dict[str, Any]] = None

class UserInDBBase(UserBase):
    id: str = Field(alias="_id")
    is_active: bool
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

class TokenData(BaseModel):
    email: Optional[str] = None

class AddressGeocode(BaseModel):
    address: str