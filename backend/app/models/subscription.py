from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Subscription(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    plan_name: str
    credits: int
    price: float
    currency: str = "BRL"
    status: str = "active"  # active, expired, cancelled
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True

class SubscriptionPlan(BaseModel):
    name: str
    credits: int
    price: float
    currency: str = "BRL"
    description: str