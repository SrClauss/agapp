from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Plan Config Schemas
class PlanConfigBase(BaseModel):
    name: str
    weekly_credits: int
    monthly_price: float
    description: str
    features: List[str] = []
    discount_3_months: float = 0.0
    discount_6_months: float = 0.0
    discount_12_months: float = 0.0
    is_active: bool = True


class PlanConfigCreate(PlanConfigBase):
    pass


class PlanConfigUpdate(BaseModel):
    name: Optional[str] = None
    weekly_credits: Optional[int] = None
    monthly_price: Optional[float] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None
    discount_3_months: Optional[float] = None
    discount_6_months: Optional[float] = None
    discount_12_months: Optional[float] = None
    is_active: Optional[bool] = None


# Credit Package Schemas
class CreditPackageBase(BaseModel):
    name: str
    credits: int
    price: float
    bonus_credits: int = 0
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class CreditPackageCreate(CreditPackageBase):
    pass


class CreditPackageUpdate(BaseModel):
    name: Optional[str] = None
    credits: Optional[int] = None
    price: Optional[float] = None
    bonus_credits: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# Featured Pricing Schemas
class FeaturedPricingBase(BaseModel):
    duration_days: int
    price: float
    description: Optional[str] = None
    is_active: bool = True


class FeaturedPricingCreate(FeaturedPricingBase):
    pass


class FeaturedPricingUpdate(BaseModel):
    price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# System-wide configuration schema
class SystemConfig(BaseModel):
    max_inperson_radius_km: float = 50.0
    # thresholds: list of dicts like {"max_hours": 12, "credits": 3}
    thresholds: List[dict] = []


class SystemConfigUpdate(BaseModel):
    max_inperson_radius_km: Optional[float] = None
    thresholds: Optional[List[dict]] = None
