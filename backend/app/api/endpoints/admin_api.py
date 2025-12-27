from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.core.security import get_current_admin_user
from app.crud.user import get_users
from app.crud.project import get_projects
from app.crud.contact import get_contacts
from app.crud.subscription import get_subscriptions, create_subscription, add_credits_to_user
from app.crud import config as config_crud
from app.schemas.subscription import SubscriptionCreate, Subscription
from app.crud.transactions import create_credit_transaction
from app.models.user import User
from app.models.project import Project
from app.models.contact import Contact
from app.models.subscription import Subscription
from app.models.config import PlanConfig, CreditPackage, FeaturedPricing
from app.schemas.config import (
    PlanConfigCreate,
    PlanConfigUpdate,
    CreditPackageCreate,
    CreditPackageUpdate,
    FeaturedPricingCreate,
    FeaturedPricingUpdate,
)
from app.core.database import get_database

router = APIRouter(prefix="/api/admin", tags=["admin-api"])

@router.get("/users", response_model=List[User])
async def get_admin_users_api(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    role: str = Query(""),
    status: str = Query(""),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get users data for admin panel (JSON API)"""
    # Build query filter
    query_filter = {}

    if search:
        query_filter["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    if role:
        query_filter["roles"] = role

    if status:
        if status == "active":
            query_filter["is_active"] = True
        elif status == "inactive":
            query_filter["is_active"] = False

    users = await get_users(db, skip=skip, limit=limit, query_filter=query_filter)
    return users

@router.get("/projects", response_model=List[dict])
async def get_admin_projects_api(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get projects data for admin panel (JSON API)"""
    # Build query filter
    query_filter = {}

    if search:
        query_filter["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    if status:
        query_filter["status"] = status

    projects = await get_projects(db, skip=skip, limit=limit, query_filter=query_filter)

    # Aggregate with user names
    result = []
    for project in projects:
        project_dict = project.dict()
        
        # Get client name
        if project.client_id:
            client = await db.users.find_one({"_id": project.client_id})
            project_dict["client_name"] = client.get("full_name", "Unknown") if client else "Unknown"
        else:
            project_dict["client_name"] = "Unknown"
            
        # Get professional name
        if project.professional_id:
            professional = await db.users.find_one({"_id": project.professional_id})
            project_dict["professional_name"] = professional.get("full_name", "Unknown") if professional else "Unknown"
        else:
            project_dict["professional_name"] = "Unknown"
        
        result.append(project_dict)

    return result

@router.get("/contacts", response_model=List[dict])
async def get_admin_contacts_api(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get contacts data for admin panel (JSON API)"""
    # Build query filter
    query_filter = {}

    if search:
        query_filter["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"message": {"$regex": search, "$options": "i"}}
        ]

    contacts = await get_contacts(db, skip=skip, limit=limit, query_filter=query_filter)

    # Return contacts as dicts with dummy names for now
    result = []
    for contact in contacts:
        contact_dict = contact.dict()
        contact_dict["client_name"] = "Test Client"
        contact_dict["professional_name"] = "Test Professional"
        result.append(contact_dict)

    return result

@router.get("/subscriptions", response_model=List[Subscription])
async def get_admin_subscriptions_api(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get subscriptions data for admin panel (JSON API)"""
    # Build query filter
    query_filter = {}

    if search:
        query_filter["$or"] = [
            {"plan_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    if status:
        query_filter["status"] = status

    subscriptions = await get_subscriptions(db, skip=skip, limit=limit, query_filter=query_filter)

    # Aggregate with user names
    for subscription in subscriptions:
        if subscription.user_id:
            user = await db.users.find_one({"_id": subscription.user_id})
            subscription.user_name = user.get("full_name", "Unknown") if user else "Unknown"

    return subscriptions

@router.get("/dashboard")
async def get_admin_dashboard_api(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get dashboard statistics for admin panel (JSON API)"""
    # Get counts
    total_users = await db.users.count_documents({})
    total_projects = await db.projects.count_documents({})
    total_contacts = await db.contacts.count_documents({})
    total_subscriptions = await db.subscriptions.count_documents({})

    # Get recent activity (last 10 items from each collection)
    recent_users = await db.users.find({}).sort("created_at", -1).limit(5).to_list(length=None)
    recent_projects = await db.projects.find({}).sort("created_at", -1).limit(5).to_list(length=None)
    recent_contacts = await db.contacts.find({}).sort("created_at", -1).limit(5).to_list(length=None)

    return {
        "stats": {
            "total_users": total_users,
            "total_projects": total_projects,
            "total_contacts": total_contacts,
            "total_subscriptions": total_subscriptions
        },
        "recent_activity": {
            "users": recent_users,
            "projects": recent_projects,
            "contacts": recent_contacts
        }
    }


# ==================== PLAN CONFIG ENDPOINTS ====================

@router.get("/config/plans", response_model=List[PlanConfig])
async def get_plans(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar todos os planos de assinatura"""
    return await config_crud.get_all_plan_configs(db, active_only=active_only)


@router.get("/config/plans/{plan_id}", response_model=PlanConfig)
async def get_plan(
    plan_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Buscar plano específico"""
    plan = await config_crud.get_plan_config(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plan


@router.post("/config/plans", response_model=PlanConfig, status_code=201)
async def create_plan(
    plan: PlanConfigCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar novo plano de assinatura"""
    return await config_crud.create_plan_config(db, plan)


@router.put("/config/plans/{plan_id}", response_model=PlanConfig)
async def update_plan(
    plan_id: str,
    plan_update: PlanConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualizar plano de assinatura"""
    plan = await config_crud.update_plan_config(db, plan_id, plan_update)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plan


@router.delete("/config/plans/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Desativar plano de assinatura"""
    success = await config_crud.delete_plan_config(db, plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plano não encontrado")


# ==================== CREDIT PACKAGE ENDPOINTS ====================

@router.get("/config/credit-packages", response_model=List[CreditPackage])
async def get_credit_packages(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar todos os pacotes de créditos"""
    return await config_crud.get_all_credit_packages(db, active_only=active_only)


@router.get("/config/credit-packages/{package_id}", response_model=CreditPackage)
async def get_credit_package(
    package_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Buscar pacote específico"""
    package = await config_crud.get_credit_package(db, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")
    return package


@router.post("/config/credit-packages", response_model=CreditPackage, status_code=201)
async def create_credit_package(
    package: CreditPackageCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar novo pacote de créditos"""
    return await config_crud.create_credit_package(db, package)


@router.put("/config/credit-packages/{package_id}", response_model=CreditPackage)
async def update_credit_package(
    package_id: str,
    package_update: CreditPackageUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualizar pacote de créditos"""
    package = await config_crud.update_credit_package(db, package_id, package_update)
    if not package:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")
    return package


@router.delete("/config/credit-packages/{package_id}", status_code=204)
async def delete_credit_package(
    package_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Desativar pacote de créditos"""
    success = await config_crud.delete_credit_package(db, package_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")


# ==================== ADMIN USER GRANT ENDPOINTS ====================
@router.post("/users/{user_id}/grant-plan", response_model=Subscription, status_code=201)
async def grant_plan_to_user(
    user_id: str,
    payload: dict,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Conceder plano gratuito a um usuário (somente planos com preço 0)"""
    plan_id = payload.get('plan_id') if isinstance(payload, dict) else None
    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id é obrigatório")

    plan = await config_crud.get_plan_config(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    if float(plan.monthly_price) != 0.0:
        raise HTTPException(status_code=400, detail="Apenas planos gratuitos podem ser concedidos via admin")

    sub_create = SubscriptionCreate(plan_name=plan.name, credits=plan.weekly_credits, price=0.0)
    subscription = await create_subscription(db, sub_create, user_id)

    # record admin grant transaction
    from app.schemas.transaction import CreditTransactionCreate
    tx = CreditTransactionCreate(
        user_id=user_id,
        type="admin_grant",
        credits=plan.weekly_credits,
        price=0.0,
        package_name=plan.name,
        metadata={"granted_by": str(current_user.id) if hasattr(current_user, 'id') else None}
    )
    await create_credit_transaction(db, tx)

    return subscription


@router.post("/users/{user_id}/grant-package", response_model=Subscription, status_code=201)
async def grant_package_to_user(
    user_id: str,
    payload: dict,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Conceder pacote de créditos gratuito a um usuário (aplica créditos ou cria assinatura com créditos)"""
    package_id = payload.get('package_id') if isinstance(payload, dict) else None
    if not package_id:
        raise HTTPException(status_code=400, detail="package_id é obrigatório")

    pkg = await config_crud.get_credit_package(db, package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")

    if float(pkg.price) != 0.0:
        raise HTTPException(status_code=400, detail="Apenas pacotes gratuitos podem ser concedidos via admin")

    total_credits = int(pkg.credits) + int(pkg.bonus_credits or 0)

    # Try to add credits to existing subscription
    subscription = await add_credits_to_user(db, user_id, total_credits)
    if subscription:
        # record transaction
        from app.schemas.transaction import CreditTransactionCreate
        tx = CreditTransactionCreate(
            user_id=user_id,
            type="admin_grant",
            credits=total_credits,
            price=0.0,
            package_name=pkg.name,
            metadata={"granted_by": str(current_user.id) if hasattr(current_user, 'id') else None}
        )
        await create_credit_transaction(db, tx)
        return subscription

    # If no active subscription, create one with these credits
    sub_create = SubscriptionCreate(plan_name=pkg.name, credits=total_credits, price=0.0)
    subscription = await create_subscription(db, sub_create, user_id)

    # record transaction for creation
    from app.schemas.transaction import CreditTransactionCreate
    tx = CreditTransactionCreate(
        user_id=user_id,
        type="admin_grant",
        credits=total_credits,
        price=0.0,
        package_name=pkg.name,
        metadata={"granted_by": str(current_user.id) if hasattr(current_user, 'id') else None}
    )
    await create_credit_transaction(db, tx)

    return subscription


# ==================== FEATURED PRICING ENDPOINTS ====================

@router.get("/config/featured-pricing", response_model=List[FeaturedPricing])
async def get_featured_pricings(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar todos os preços de projetos destacados"""
    return await config_crud.get_all_featured_pricings(db, active_only=active_only)


@router.get("/config/featured-pricing/{pricing_id}", response_model=FeaturedPricing)
async def get_featured_pricing(
    pricing_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Buscar preço específico"""
    pricing = await config_crud.get_featured_pricing(db, pricing_id)
    if not pricing:
        raise HTTPException(status_code=404, detail="Preço não encontrado")
    return pricing


@router.post("/config/featured-pricing", response_model=FeaturedPricing, status_code=201)
async def create_featured_pricing(
    pricing: FeaturedPricingCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar novo preço de projeto destacado"""
    return await config_crud.create_featured_pricing(db, pricing)


@router.put("/config/featured-pricing/{pricing_id}", response_model=FeaturedPricing)
async def update_featured_pricing(
    pricing_id: str,
    pricing_update: FeaturedPricingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualizar preço de projeto destacado"""
    pricing = await config_crud.update_featured_pricing(db, pricing_id, pricing_update)
    if not pricing:
        raise HTTPException(status_code=404, detail="Preço não encontrado")
    return pricing


@router.delete("/config/featured-pricing/{pricing_id}", status_code=204)
async def delete_featured_pricing(
    pricing_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Desativar preço de projeto destacado"""
    success = await config_crud.delete_featured_pricing(db, pricing_id)
    if not success:
        raise HTTPException(status_code=404, detail="Preço não encontrado")