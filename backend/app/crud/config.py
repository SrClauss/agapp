from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import ulid
from datetime import datetime

from app.models.config import PlanConfig, CreditPackage, FeaturedPricing, PaymentWebhook
from app.schemas.config import (
    PlanConfigCreate,
    PlanConfigUpdate,
    CreditPackageCreate,
    CreditPackageUpdate,
    FeaturedPricingCreate,
    FeaturedPricingUpdate,
)


# ==================== PLAN CONFIG CRUD ====================

async def create_plan_config(db: AsyncIOMotorDatabase, plan: PlanConfigCreate) -> PlanConfig:
    """Criar nova configuração de plano"""
    plan_dict = plan.model_dump()
    plan_dict["_id"] = ulid.new().str
    plan_dict["created_at"] = datetime.utcnow()
    plan_dict["updated_at"] = datetime.utcnow()

    await db.plan_configs.insert_one(plan_dict)
    return PlanConfig(**plan_dict)


async def get_plan_config(db: AsyncIOMotorDatabase, plan_id: str) -> Optional[PlanConfig]:
    """Buscar plano por ID"""
    plan_dict = await db.plan_configs.find_one({"_id": plan_id})
    if plan_dict:
        return PlanConfig(**plan_dict)
    return None


async def get_all_plan_configs(
    db: AsyncIOMotorDatabase,
    active_only: bool = False
) -> List[PlanConfig]:
    """Listar todos os planos"""
    query = {"is_active": True} if active_only else {}
    cursor = db.plan_configs.find(query).sort("monthly_price", 1)
    plans = await cursor.to_list(length=None)
    return [PlanConfig(**plan) for plan in plans]


async def update_plan_config(
    db: AsyncIOMotorDatabase,
    plan_id: str,
    plan_update: PlanConfigUpdate
) -> Optional[PlanConfig]:
    """Atualizar configuração de plano"""
    update_data = {k: v for k, v in plan_update.model_dump().items() if v is not None}

    if not update_data:
        return await get_plan_config(db, plan_id)

    update_data["updated_at"] = datetime.utcnow()

    result = await db.plan_configs.find_one_and_update(
        {"_id": plan_id},
        {"$set": update_data},
        return_document=True
    )

    if result:
        return PlanConfig(**result)
    return None


async def delete_plan_config(db: AsyncIOMotorDatabase, plan_id: str) -> bool:
    """Deletar configuração de plano (soft delete - marca como inativo)"""
    result = await db.plan_configs.update_one(
        {"_id": plan_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


# ==================== CREDIT PACKAGE CRUD ====================

async def create_credit_package(
    db: AsyncIOMotorDatabase,
    package: CreditPackageCreate
) -> CreditPackage:
    """Criar novo pacote de créditos"""
    package_dict = package.model_dump()
    package_dict["_id"] = ulid.new().str
    package_dict["created_at"] = datetime.utcnow()
    package_dict["updated_at"] = datetime.utcnow()

    await db.credit_packages.insert_one(package_dict)
    return CreditPackage(**package_dict)


async def get_credit_package(
    db: AsyncIOMotorDatabase,
    package_id: str
) -> Optional[CreditPackage]:
    """Buscar pacote por ID"""
    package_dict = await db.credit_packages.find_one({"_id": package_id})
    if package_dict:
        return CreditPackage(**package_dict)
    return None


async def get_all_credit_packages(
    db: AsyncIOMotorDatabase,
    active_only: bool = False
) -> List[CreditPackage]:
    """Listar todos os pacotes de créditos"""
    query = {"is_active": True} if active_only else {}
    cursor = db.credit_packages.find(query).sort("sort_order", 1)
    packages = await cursor.to_list(length=None)
    return [CreditPackage(**pkg) for pkg in packages]


async def update_credit_package(
    db: AsyncIOMotorDatabase,
    package_id: str,
    package_update: CreditPackageUpdate
) -> Optional[CreditPackage]:
    """Atualizar pacote de créditos"""
    update_data = {k: v for k, v in package_update.model_dump().items() if v is not None}

    if not update_data:
        return await get_credit_package(db, package_id)

    update_data["updated_at"] = datetime.utcnow()

    result = await db.credit_packages.find_one_and_update(
        {"_id": package_id},
        {"$set": update_data},
        return_document=True
    )

    if result:
        return CreditPackage(**result)
    return None


async def delete_credit_package(db: AsyncIOMotorDatabase, package_id: str) -> bool:
    """Deletar pacote de créditos (soft delete - marca como inativo)"""
    result = await db.credit_packages.update_one(
        {"_id": package_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


# ==================== FEATURED PRICING CRUD ====================

async def create_featured_pricing(
    db: AsyncIOMotorDatabase,
    pricing: FeaturedPricingCreate
) -> FeaturedPricing:
    """Criar nova configuração de preço para projetos destacados"""
    pricing_dict = pricing.model_dump()
    pricing_dict["_id"] = ulid.new().str
    pricing_dict["created_at"] = datetime.utcnow()
    pricing_dict["updated_at"] = datetime.utcnow()

    await db.featured_pricings.insert_one(pricing_dict)
    return FeaturedPricing(**pricing_dict)


async def get_featured_pricing(
    db: AsyncIOMotorDatabase,
    pricing_id: str
) -> Optional[FeaturedPricing]:
    """Buscar preço por ID"""
    pricing_dict = await db.featured_pricings.find_one({"_id": pricing_id})
    if pricing_dict:
        return FeaturedPricing(**pricing_dict)
    return None


async def get_featured_pricing_by_duration(
    db: AsyncIOMotorDatabase,
    duration_days: int
) -> Optional[FeaturedPricing]:
    """Buscar preço por duração"""
    pricing_dict = await db.featured_pricings.find_one({
        "duration_days": duration_days,
        "is_active": True
    })
    if pricing_dict:
        return FeaturedPricing(**pricing_dict)
    return None


async def get_all_featured_pricings(
    db: AsyncIOMotorDatabase,
    active_only: bool = False
) -> List[FeaturedPricing]:
    """Listar todos os preços de projetos destacados"""
    query = {"is_active": True} if active_only else {}
    cursor = db.featured_pricings.find(query).sort("duration_days", 1)
    pricings = await cursor.to_list(length=None)
    return [FeaturedPricing(**pricing) for pricing in pricings]


async def update_featured_pricing(
    db: AsyncIOMotorDatabase,
    pricing_id: str,
    pricing_update: FeaturedPricingUpdate
) -> Optional[FeaturedPricing]:
    """Atualizar preço de projeto destacado"""
    update_data = {k: v for k, v in pricing_update.model_dump().items() if v is not None}

    if not update_data:
        return await get_featured_pricing(db, pricing_id)

    update_data["updated_at"] = datetime.utcnow()

    result = await db.featured_pricings.find_one_and_update(
        {"_id": pricing_id},
        {"$set": update_data},
        return_document=True
    )

    if result:
        return FeaturedPricing(**result)
    return None


async def delete_featured_pricing(db: AsyncIOMotorDatabase, pricing_id: str) -> bool:
    """Deletar preço de projeto destacado (soft delete - marca como inativo)"""
    result = await db.featured_pricings.update_one(
        {"_id": pricing_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


# ==================== PAYMENT WEBHOOK CRUD ====================

async def create_payment_webhook(
    db: AsyncIOMotorDatabase,
    event_type: str,
    payment_id: str,
    value: float,
    status: str,
    billing_type: str,
    payload: dict,
    user_id: Optional[str] = None,
) -> PaymentWebhook:
    """Registrar webhook do Asaas"""
    webhook_dict = {
        "_id": str(ulid.new()),
        "event_type": event_type,
        "payment_id": payment_id,
        "user_id": user_id,
        "value": value,
        "status": status,
        "billing_type": billing_type,
        "payload": payload,
        "processed": False,
        "created_at": datetime.utcnow(),
    }

    await db.payment_webhooks.insert_one(webhook_dict)
    return PaymentWebhook(**webhook_dict)


async def get_payment_webhook(
    db: AsyncIOMotorDatabase,
    webhook_id: str
) -> Optional[PaymentWebhook]:
    """Buscar webhook por ID"""
    webhook_dict = await db.payment_webhooks.find_one({"_id": webhook_id})
    if webhook_dict:
        return PaymentWebhook(**webhook_dict)
    return None


async def get_webhooks_by_payment_id(
    db: AsyncIOMotorDatabase,
    payment_id: str
) -> List[PaymentWebhook]:
    """Buscar todos os webhooks de um pagamento"""
    cursor = db.payment_webhooks.find({"payment_id": payment_id}).sort("created_at", -1)
    webhooks = await cursor.to_list(length=None)
    return [PaymentWebhook(**webhook) for webhook in webhooks]


async def mark_webhook_as_processed(
    db: AsyncIOMotorDatabase,
    webhook_id: str
) -> bool:
    """Marcar webhook como processado"""
    result = await db.payment_webhooks.update_one(
        {"_id": webhook_id},
        {"$set": {"processed": True, "processed_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


async def get_unprocessed_webhooks(
    db: AsyncIOMotorDatabase,
    limit: int = 100
) -> List[PaymentWebhook]:
    """Buscar webhooks não processados"""
    cursor = db.payment_webhooks.find({"processed": False}).sort("created_at", 1).limit(limit)
    webhooks = await cursor.to_list(length=None)
    return [PaymentWebhook(**webhook) for webhook in webhooks]
