from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SubscriptionBase(BaseModel):
    plan_name: str
    credits: int
    price: float
    currency: str = "BRL"

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    credits: Optional[int] = None
    status: Optional[str] = None

class SubscriptionInDBBase(SubscriptionBase):
    id: str
    user_id: str
    status: str
    expires_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Subscription(SubscriptionInDBBase):
    pass

class SubscriptionPlan(BaseModel):
    name: str
    credits: int
    price: float
    currency: str = "BRL"
    description: str

class AddCredits(BaseModel):
    credits: int