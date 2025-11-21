from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from ulid import ULID

class User(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr = Field(..., unique=True)
    hashed_password: str
    full_name: str
    cpf: str  # Não único, pois uma pessoa pode ter múltiplas contas
    phone: Optional[str] = None
    roles: List[str] = Field(default=["client"])  # ["client", "professional"]
    is_active: bool = True
    is_profile_complete: bool = False  # Novo campo
    credits: int = 0  # Créditos para contatar profissionais
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Perfil de endereço
    address: Optional[Dict[str, Any]] = None  # {street, city, state, zip_code, country}
    coordinates: Optional[List[float]] = None  # [longitude, latitude] GeoJSON

    # Info profissional (se role inclui "professional")
    professional_info: Optional[Dict[str, Any]] = None  # {skills, experience, portfolio, etc.}

    # Assinatura
    subscription: Optional[Dict[str, Any]] = None  # {plan, credits, expires_at}

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True

class UserInDB(User):
    pass