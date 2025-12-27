from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class CreditTransaction(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    type: str  # purchase, grant, refund
    credits: int
    price: float = 0.0
    currency: str = "BRL"
    package_name: Optional[str] = None
    payment_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    status: str = "completed"  # pending/completed/refunded
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True

class PaymentRecord(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    payment_id: str
    value: float
    billing_type: str
    status: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True