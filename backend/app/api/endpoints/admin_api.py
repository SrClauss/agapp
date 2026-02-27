from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.core.security import get_current_admin_user
from app.crud.user import get_users
from app.crud.project import get_projects
from app.crud.subscription import get_subscriptions, create_subscription, add_credits_to_user
from app.crud import config as config_crud
from app.schemas.subscription import SubscriptionCreate, Subscription
from app.crud.transactions import create_credit_transaction
from app.models.user import User
from app.models.project import Project
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
    """Get contacts data for admin panel (aggregated from projects.contacts)"""
    match = {"contacts": {"$exists": True, "$ne": []}}
    if search:
        match["$or"] = [
            {"contacts.contact_details.message": {"$regex": search, "$options": "i"}},
            {"contacts.professional_name": {"$regex": search, "$options": "i"}},
            {"contacts.client_name": {"$regex": search, "$options": "i"}}
        ]

    pipeline = [
        {"$match": match},
        {"$unwind": "$contacts"},
        {"$sort": {"contacts.created_at": -1}},
        {"$skip": int(skip)},
        {"$limit": int(limit)},
        {"$project": {"project_id": "$_id", "project_title": "$title", "contact": "$contacts"}}
    ]

    contacts = []
    async for doc in db.projects.aggregate(pipeline):
        c = doc.get("contact", {})
        contact_dict = {
            "id": f"{str(doc['project_id'])}_{str(c.get('created_at')) if c.get('created_at') else ''}",
            "project_id": str(doc['project_id']),
            "project_title": doc.get("project_title"),
            "professional_id": c.get("professional_id"),
            "professional_name": c.get("professional_name"),
            "client_id": c.get("client_id"),
            "client_name": c.get("client_name"),
            "status": c.get("status"),
            "created_at": c.get("created_at"),
            "contact_details": c.get("contact_details", {}),
            "last_message": c.get("chats", [])[-1] if c.get("chats") else None
        }
        contacts.append(contact_dict)

    return contacts

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

    # Total contacts via aggregation over projects
    agg = await db.projects.aggregate([
        {"$project": {"n": {"$size": {"$ifNull": ["$contacts", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$n"}}}
    ]).to_list(length=1)
    total_contacts = agg[0]["total"] if agg else 0

    total_subscriptions = await db.subscriptions.count_documents({})

    # Get recent activity (last 5 users, projects, contacts)
    recent_users = await db.users.find({}).sort("created_at", -1).limit(5).to_list(length=None)
    recent_projects = await db.projects.find({}).sort("created_at", -1).limit(5).to_list(length=None)

    # recent contacts: unwind and sort
    recent_contacts = []
    pipeline = [
        {"$match": {"contacts": {"$exists": True, "$ne": []}}},
        {"$unwind": "$contacts"},
        {"$sort": {"contacts.created_at": -1}},
        {"$limit": 5},
        {"$project": {"project_id": "$_id", "title": "$title", "contact": "$contacts"}}
    ]
    async for doc in db.projects.aggregate(pipeline):
        recent_contacts.append(doc)

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


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/conversion")
async def get_conversion_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Dashboard de analytics de conversão:
    - Total projetos criados no período
    - Total de contatos (leads) gerados
    - Taxa de conversão projeto → lead
    - Total de projetos concluídos (status closed)
    - Taxa de conversão lead → conclusão
    - Distribuição de status dos projetos
    - Receita estimada de créditos consumidos
    """
    from datetime import datetime, timezone, timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total projects in period
    total_projects = await db.projects.count_documents({
        "created_at": {"$gte": since}
    })

    # Projects with at least one contact (lead generated)
    projects_with_leads = await db.projects.count_documents({
        "created_at": {"$gte": since},
        "contacts": {"$exists": True, "$ne": []}
    })

    # Closed projects
    closed_projects = await db.projects.count_documents({
        "created_at": {"$gte": since},
        "status": "closed"
    })

    # Total contacts / leads in period
    agg_contacts = await db.contacts.count_documents({
        "created_at": {"$gte": since}
    })

    # Credits consumed in period (from credit_transactions)
    credit_agg = await db.credit_transactions.aggregate([
        {"$match": {"created_at": {"$gte": since}, "type": "usage"}},
        {"$group": {"_id": None, "total_credits": {"$sum": "$credits"}}}
    ]).to_list(length=1)
    credits_consumed = abs(credit_agg[0]["total_credits"]) if credit_agg else 0

    # Project status distribution
    status_pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_dist_raw = await db.projects.aggregate(status_pipeline).to_list(length=None)
    status_distribution = {doc["_id"]: doc["count"] for doc in status_dist_raw}

    # Conversion rates
    lead_rate = round((projects_with_leads / total_projects * 100), 1) if total_projects else 0
    close_rate = round((closed_projects / projects_with_leads * 100), 1) if projects_with_leads else 0

    # New users in period
    new_users = await db.users.count_documents({"created_at": {"$gte": since}})

    # Active subscriptions
    active_subscriptions = await db.subscriptions.count_documents({"status": "active"})

    return {
        "period_days": days,
        "since": since.isoformat(),
        "projects": {
            "total_created": total_projects,
            "with_leads": projects_with_leads,
            "closed": closed_projects,
            "lead_conversion_rate_pct": lead_rate,
            "close_conversion_rate_pct": close_rate,
            "status_distribution": status_distribution,
        },
        "contacts": {
            "total_leads": agg_contacts,
            "credits_consumed": credits_consumed,
        },
        "users": {
            "new_registrations": new_users,
            "active_subscriptions": active_subscriptions,
        }
    }


@router.get("/analytics/ads")
async def get_ads_analytics(
    current_user: User = Depends(get_current_admin_user),
):
    """Relatório de impressões e cliques de anúncios.
    Lê os arquivos de log de ads e retorna as métricas agregadas.
    """
    import os
    import json
    from collections import defaultdict

    log_dir = "logs"
    impressions_file = os.path.join(log_dir, "ad_impressions.log")
    clicks_file = os.path.join(log_dir, "ad_clicks.log")

    def parse_log(filepath: str):
        events = []
        if not os.path.exists(filepath):
            return events
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except OSError:
            pass
        return events

    impressions = parse_log(impressions_file)
    clicks = parse_log(clicks_file)

    # Aggregate by ad_type
    imp_by_type: dict = defaultdict(int)
    clk_by_type: dict = defaultdict(int)

    for ev in impressions:
        ad_type = ev.get("ad_type", "unknown")
        imp_by_type[ad_type] += 1

    for ev in clicks:
        ad_type = ev.get("ad_type", "unknown")
        clk_by_type[ad_type] += 1

    all_types = set(list(imp_by_type.keys()) + list(clk_by_type.keys()))
    report = []
    for ad_type in sorted(all_types):
        imps = imp_by_type.get(ad_type, 0)
        clks = clk_by_type.get(ad_type, 0)
        ctr = round(clks / imps * 100, 2) if imps else 0
        report.append({
            "ad_type": ad_type,
            "impressions": imps,
            "clicks": clks,
            "ctr_pct": ctr,
        })

    return {
        "total_impressions": len(impressions),
        "total_clicks": len(clicks),
        "overall_ctr_pct": round(len(clicks) / len(impressions) * 100, 2) if impressions else 0,
        "by_ad_type": report,
    }


@router.post("/analytics/export-logs-s3")
async def trigger_s3_log_export(
    current_user: User = Depends(get_current_admin_user),
):
    """Exporta os arquivos de log para S3. Requer variáveis de ambiente AWS configuradas."""
    from app.jobs.export_logs_to_s3 import export_logs_to_s3
    import asyncio

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, export_logs_to_s3)
    return result