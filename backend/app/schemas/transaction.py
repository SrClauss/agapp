from pydantic import BaseModel
from typing import Optional, Dict, Any

class CreditTransactionCreate(BaseModel):
    user_id: str
    type: str
    credits: int
    price: float = 0.0
    package_name: Optional[str] = None
    payment_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class CreditTransactionOut(BaseModel):
    id: str
    user_id: str
    type: str
    credits: int
    price: float
    package_name: Optional[str]
    payment_id: Optional[str]
    metadata: Optional[Dict[str, Any]]
    status: str
    created_at: str

class PaymentRecordCreate(BaseModel):
    user_id: str
    payment_id: str
    value: float
    billing_type: str
    status: str

class PaymentRecordOut(BaseModel):
    id: str
    user_id: str
    payment_id: str
    value: float
    billing_type: str
    status: str
    created_at: str