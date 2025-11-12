"""
Endpoints de pagamento para usuários (via Asaas)
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone

from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.config import PlanConfig, CreditPackage, FeaturedPricing
from app.services.asaas import asaas_service
from app.crud import config as config_crud
from app.crud.project import get_project

router = APIRouter(prefix="/api/payments", tags=["payments"])


# ==================== SCHEMAS ====================

class SubscriptionPaymentRequest(BaseModel):
    plan_id: str
    billing_type: str  # PIX or CREDIT_CARD
    cycle_months: int = 1  # 1, 3, 6, or 12 months


class CreditPackagePaymentRequest(BaseModel):
    package_id: str
    billing_type: str  # PIX or CREDIT_CARD


class FeaturedProjectPaymentRequest(BaseModel):
    project_id: str
    duration_days: int  # 7, 15, or 30
    billing_type: str  # PIX or CREDIT_CARD


class PaymentResponse(BaseModel):
    payment_id: str
    status: str
    value: float
    billing_type: str
    due_date: str
    invoice_url: Optional[str] = None
    pix_qrcode: Optional[str] = None
    pix_payload: Optional[str] = None


# ==================== PUBLIC ENDPOINTS (Pricing Info) ====================

@router.get("/plans", response_model=List[PlanConfig])
async def get_available_plans(
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar planos de assinatura disponíveis"""
    return await config_crud.get_all_plan_configs(db, active_only=True)


@router.get("/credit-packages", response_model=List[CreditPackage])
async def get_available_credit_packages(
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar pacotes de créditos disponíveis"""
    return await config_crud.get_all_credit_packages(db, active_only=True)


@router.get("/featured-pricing", response_model=List[FeaturedPricing])
async def get_featured_pricing_options(
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Listar opções de preço para projetos destacados"""
    return await config_crud.get_all_featured_pricings(db, active_only=True)


# ==================== SUBSCRIPTION PAYMENTS ====================

@router.post("/subscription", response_model=PaymentResponse)
async def create_subscription_payment(
    request: SubscriptionPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Criar pagamento de assinatura

    Args:
        plan_id: ID do plano escolhido
        billing_type: PIX ou CREDIT_CARD
        cycle_months: 1, 3, 6 ou 12 meses (com descontos)
    """
    # Buscar plano
    plan = await config_crud.get_plan_config(db, request.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Plano não está ativo")

    # Calcular valor com desconto
    base_value = plan.monthly_price
    discount_percent = 0

    if request.cycle_months == 3:
        discount_percent = plan.discount_3_months
    elif request.cycle_months == 6:
        discount_percent = plan.discount_6_months
    elif request.cycle_months == 12:
        discount_percent = plan.discount_12_months

    discount_value = base_value * (discount_percent / 100)
    monthly_value = base_value - discount_value

    # Verificar se usuário já tem assinatura ativa
    existing_subscription = await db.subscriptions.find_one({
        "user_id": str(current_user.id),
        "status": "active"
    })

    if existing_subscription:
        raise HTTPException(
            status_code=400,
            detail="Você já possui uma assinatura ativa. Cancele a atual antes de criar uma nova."
        )

    # Criar ou buscar cliente no Asaas
    customer_id = await asaas_service.get_or_create_customer(current_user)

    # Criar referência externa
    external_reference = f"subscription:{current_user.id}:{plan.id}"

    # Criar pagamento no Asaas
    if request.billing_type == "PIX":
        result = await asaas_service.create_pix_payment(
            customer_id=customer_id,
            value=monthly_value,
            description=f"Assinatura {plan.name} - {request.cycle_months} meses",
            external_reference=external_reference
        )
        payment = result["payment"]
        pix_data = result["pix"]

        return PaymentResponse(
            payment_id=payment["id"],
            status=payment["status"],
            value=monthly_value,
            billing_type="PIX",
            due_date=payment["dueDate"],
            invoice_url=payment.get("invoiceUrl"),
            pix_qrcode=pix_data.get("encodedImage"),
            pix_payload=pix_data.get("payload")
        )

    elif request.billing_type == "CREDIT_CARD":
        # Para cartão, criar assinatura recorrente
        subscription = await asaas_service.create_subscription(
            customer_id=customer_id,
            value=monthly_value,
            cycle="MONTHLY",
            description=f"Assinatura {plan.name}",
            billing_type="CREDIT_CARD",
            external_reference=external_reference,
            next_due_date=datetime.now(timezone.utc) + timedelta(days=30)
        )

        return PaymentResponse(
            payment_id=subscription["id"],
            status=subscription["status"],
            value=monthly_value,
            billing_type="CREDIT_CARD",
            due_date=subscription["nextDueDate"],
            invoice_url=subscription.get("invoiceUrl")
        )

    else:
        raise HTTPException(status_code=400, detail="Método de pagamento inválido")


@router.get("/subscription/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Verificar status da assinatura do usuário"""
    subscription = await db.subscriptions.find_one({
        "user_id": str(current_user.id)
    })

    if not subscription:
        return {
            "has_subscription": False,
            "status": None
        }

    return {
        "has_subscription": True,
        "status": subscription.get("status"),
        "plan_name": subscription.get("plan_name"),
        "credits_per_week": subscription.get("credits_per_week"),
        "next_renewal": subscription.get("next_renewal"),
        "monthly_price": subscription.get("monthly_price")
    }


@router.post("/subscription/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Cancelar assinatura ativa"""
    subscription = await db.subscriptions.find_one({
        "user_id": str(current_user.id),
        "status": "active"
    })

    if not subscription:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada")

    # Cancelar no Asaas
    asaas_subscription_id = subscription.get("asaas_subscription_id")
    if asaas_subscription_id:
        try:
            await asaas_service.cancel_subscription(asaas_subscription_id)
        except Exception as e:
            # Log mas não falha - o cancelamento local é mais importante
            print(f"Erro ao cancelar no Asaas: {str(e)}")

    # Cancelar localmente
    await db.subscriptions.update_one(
        {"_id": subscription["_id"]},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return {"status": "cancelled", "message": "Assinatura cancelada com sucesso"}


# ==================== CREDIT PACKAGE PAYMENTS ====================

@router.post("/credits", response_model=PaymentResponse)
async def create_credit_package_payment(
    request: CreditPackagePaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar pagamento de pacote de créditos"""
    # Buscar pacote
    package = await config_crud.get_credit_package(db, request.package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")

    if not package.is_active:
        raise HTTPException(status_code=400, detail="Pacote não está ativo")

    # Criar ou buscar cliente no Asaas
    customer_id = await asaas_service.get_or_create_customer(current_user)

    # Criar referência externa
    external_reference = f"credits:{current_user.id}:{package.id}"

    # Descrição detalhada
    description = f"Pacote {package.name} - {package.credits} créditos"
    if package.bonus_credits > 0:
        description += f" + {package.bonus_credits} bônus"

    # Criar pagamento
    if request.billing_type == "PIX":
        result = await asaas_service.create_pix_payment(
            customer_id=customer_id,
            value=package.price,
            description=description,
            external_reference=external_reference
        )
        payment = result["payment"]
        pix_data = result["pix"]

        return PaymentResponse(
            payment_id=payment["id"],
            status=payment["status"],
            value=package.price,
            billing_type="PIX",
            due_date=payment["dueDate"],
            invoice_url=payment.get("invoiceUrl"),
            pix_qrcode=pix_data.get("encodedImage"),
            pix_payload=pix_data.get("payload")
        )

    elif request.billing_type == "CREDIT_CARD":
        payment = await asaas_service.create_payment(
            customer_id=customer_id,
            value=package.price,
            description=description,
            billing_type="CREDIT_CARD",
            external_reference=external_reference
        )

        return PaymentResponse(
            payment_id=payment["id"],
            status=payment["status"],
            value=package.price,
            billing_type="CREDIT_CARD",
            due_date=payment["dueDate"],
            invoice_url=payment.get("invoiceUrl")
        )

    else:
        raise HTTPException(status_code=400, detail="Método de pagamento inválido")


# ==================== FEATURED PROJECT PAYMENTS ====================

@router.post("/featured-project", response_model=PaymentResponse)
async def create_featured_project_payment(
    request: FeaturedProjectPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar pagamento para destacar projeto"""
    # Verificar se projeto existe e pertence ao usuário
    project = await get_project(db, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    if project.client_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Você não é dono deste projeto")

    # Verificar se projeto já está destacado
    if project.is_featured and project.featured_until and project.featured_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail=f"Projeto já está destacado até {project.featured_until.strftime('%d/%m/%Y')}"
        )

    # Buscar preço
    pricing = await config_crud.get_featured_pricing_by_duration(db, request.duration_days)
    if not pricing:
        raise HTTPException(status_code=404, detail="Opção de duração não disponível")

    if not pricing.is_active:
        raise HTTPException(status_code=400, detail="Esta opção não está disponível no momento")

    # Criar ou buscar cliente no Asaas
    customer_id = await asaas_service.get_or_create_customer(current_user)

    # Criar referência externa
    external_reference = f"featured:{current_user.id}:{project.id}:{request.duration_days}"

    # Criar pagamento
    description = f"Projeto Destacado - {request.duration_days} dias - {project.title}"

    if request.billing_type == "PIX":
        result = await asaas_service.create_pix_payment(
            customer_id=customer_id,
            value=pricing.price,
            description=description,
            external_reference=external_reference
        )
        payment = result["payment"]
        pix_data = result["pix"]

        return PaymentResponse(
            payment_id=payment["id"],
            status=payment["status"],
            value=pricing.price,
            billing_type="PIX",
            due_date=payment["dueDate"],
            invoice_url=payment.get("invoiceUrl"),
            pix_qrcode=pix_data.get("encodedImage"),
            pix_payload=pix_data.get("payload")
        )

    elif request.billing_type == "CREDIT_CARD":
        payment = await asaas_service.create_payment(
            customer_id=customer_id,
            value=pricing.price,
            description=description,
            billing_type="CREDIT_CARD",
            external_reference=external_reference
        )

        return PaymentResponse(
            payment_id=payment["id"],
            status=payment["status"],
            value=pricing.price,
            billing_type="CREDIT_CARD",
            due_date=payment["dueDate"],
            invoice_url=payment.get("invoiceUrl")
        )

    else:
        raise HTTPException(status_code=400, detail="Método de pagamento inválido")


# ==================== PAYMENT STATUS ====================

@router.get("/status/{payment_id}")
async def get_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Verificar status de um pagamento específico"""
    try:
        payment = await asaas_service.get_payment(payment_id)

        return {
            "payment_id": payment["id"],
            "status": payment["status"],
            "value": payment["value"],
            "billing_type": payment["billingType"],
            "due_date": payment["dueDate"],
            "payment_date": payment.get("paymentDate"),
            "invoice_url": payment.get("invoiceUrl")
        }

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Pagamento não encontrado: {str(e)}")


@router.get("/history")
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Buscar histórico de pagamentos do usuário"""
    # Buscar transações de créditos
    credit_transactions = await db.credit_transactions.find({
        "user_id": str(current_user.id)
    }).sort("created_at", -1).limit(20).to_list(length=None)

    # Buscar histórico de assinatura
    subscription_history = await db.subscriptions.find({
        "user_id": str(current_user.id)
    }).sort("created_at", -1).to_list(length=None)

    return {
        "credit_purchases": credit_transactions,
        "subscriptions": subscription_history
    }
