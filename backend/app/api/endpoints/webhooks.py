"""
Webhook handlers para integração Asaas
Documentação: https://docs.asaas.com/reference/webhooks
"""
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
import logging
import os
from typing import Dict, Any

from app.core.database import get_database
from app.services.asaas import asaas_service
from app.crud import config as config_crud
from app.crud.user import get_user
from app.models.user import User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


async def process_webhook_background(
    event_type: str,
    payment_data: Dict[str, Any],
    db: AsyncIOMotorDatabase
):
    """Processa webhook em background"""
    try:
        # Registrar webhook no banco
        webhook = await config_crud.create_payment_webhook(
            db=db,
            event_type=event_type,
            payment_id=payment_data.get("id"),
            value=payment_data.get("value", 0),
            status=payment_data.get("status"),
            billing_type=payment_data.get("billingType"),
            payload=payment_data,
            user_id=None,  # Será preenchido durante processamento
        )

        # Processar evento
        await process_payment_event(event_type, payment_data, db)

        # Marcar webhook como processado
        await config_crud.mark_webhook_as_processed(db, webhook.id)

        logger.info(f"Webhook processado com sucesso: {event_type} - Payment: {payment_data.get('id')}")

    except Exception as e:
        logger.error(f"Erro ao processar webhook: {str(e)}", exc_info=True)


async def process_payment_event(
    event_type: str,
    payment_data: Dict[str, Any],
    db: AsyncIOMotorDatabase
):
    """
    Processa eventos de pagamento do Asaas

    Eventos principais:
    - PAYMENT_CREATED: Pagamento criado
    - PAYMENT_UPDATED: Pagamento atualizado
    - PAYMENT_CONFIRMED: Pagamento confirmado (PIX)
    - PAYMENT_RECEIVED: Pagamento recebido (Cartão)
    - PAYMENT_OVERDUE: Pagamento vencido
    - PAYMENT_DELETED: Pagamento deletado
    - PAYMENT_RESTORED: Pagamento restaurado
    - PAYMENT_REFUNDED: Pagamento estornado
    """
    payment_id = payment_data.get("id")
    status = payment_data.get("status")
    external_reference = payment_data.get("externalReference")

    logger.info(f"Processando evento: {event_type} - Payment: {payment_id} - Status: {status}")

    # Eventos que indicam pagamento bem-sucedido
    if event_type in ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"] and status in ["RECEIVED", "CONFIRMED"]:
        await handle_payment_success(payment_data, db)

    # Pagamento vencido
    elif event_type == "PAYMENT_OVERDUE":
        await handle_payment_overdue(payment_data, db)

    # Pagamento estornado
    elif event_type == "PAYMENT_REFUNDED":
        await handle_payment_refund(payment_data, db)


async def handle_payment_success(payment_data: Dict[str, Any], db: AsyncIOMotorDatabase):
    """Processar pagamento bem-sucedido"""
    external_reference = payment_data.get("externalReference")
    if not external_reference:
        logger.warning(f"Pagamento sem referência externa: {payment_data.get('id')}")
        return

    # External reference format: "subscription:{user_id}:{plan_id}" ou "credits:{user_id}:{package_id}" ou "featured:{user_id}:{project_id}"
    parts = external_reference.split(":")
    payment_type = parts[0]

    if payment_type == "subscription":
        await process_subscription_payment(payment_data, parts, db)
    elif payment_type == "credits":
        await process_credit_package_payment(payment_data, parts, db)
    elif payment_type == "featured":
        await process_featured_payment(payment_data, parts, db)
    else:
        logger.warning(f"Tipo de pagamento desconhecido: {payment_type}")


async def process_subscription_payment(
    payment_data: Dict[str, Any],
    reference_parts: list,
    db: AsyncIOMotorDatabase
):
    """Processar pagamento de assinatura"""
    user_id = reference_parts[1]
    plan_id = reference_parts[2]

    # Buscar usuário
    user = await get_user(db, user_id)
    if not user:
        logger.error(f"Usuário não encontrado: {user_id}")
        return

    # Buscar plano
    plan = await config_crud.get_plan_config(db, plan_id)
    if not plan:
        logger.error(f"Plano não encontrado: {plan_id}")
        return

    # Buscar ou criar assinatura do usuário
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": {"$in": ["active", "pending"]}
    })

    if subscription:
        # Atualizar assinatura existente
        await db.subscriptions.update_one(
            {"_id": subscription["_id"]},
            {
                "$set": {
                    "status": "active",
                    "plan_name": plan.name,
                    "plan_id": plan_id,
                    "credits": plan.weekly_credits,
                    "credits_per_week": plan.weekly_credits,
                    "monthly_price": payment_data.get("value"),
                    "next_renewal": datetime.now(timezone.utc) + timedelta(days=7),  # Próxima renovação semanal
                    "last_payment_date": datetime.now(timezone.utc),
                    "asaas_payment_id": payment_data.get("id"),
                    "asaas_subscription_id": payment_data.get("subscription"),
                    "updated_at": datetime.now(timezone.utc),
                }
            }
        )
    else:
        # Criar nova assinatura
        subscription_data = {
            "user_id": user_id,
            "plan_name": plan.name,
            "plan_id": plan_id,
            "status": "active",
            "credits": plan.weekly_credits,
            "credits_per_week": plan.weekly_credits,
            "monthly_price": payment_data.get("value"),
            "start_date": datetime.now(timezone.utc),
            "next_renewal": datetime.now(timezone.utc) + timedelta(days=7),
            "last_payment_date": datetime.now(timezone.utc),
            "asaas_payment_id": payment_data.get("id"),
            "asaas_subscription_id": payment_data.get("subscription"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.subscriptions.insert_one(subscription_data)

    # Adicionar créditos ao usuário
    await db.users.update_one(
        {"_id": user_id},
        {
            "$inc": {"credits": plan.weekly_credits},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )

    logger.info(f"Assinatura ativada para usuário {user_id} - Plano: {plan.name} - Créditos: {plan.weekly_credits}")


async def process_credit_package_payment(
    payment_data: Dict[str, Any],
    reference_parts: list,
    db: AsyncIOMotorDatabase
):
    """Processar pagamento de pacote de créditos"""
    user_id = reference_parts[1]
    package_id = reference_parts[2]

    # Buscar usuário
    user = await get_user(db, user_id)
    if not user:
        logger.error(f"Usuário não encontrado: {user_id}")
        return

    # Buscar pacote
    package = await config_crud.get_credit_package(db, package_id)
    if not package:
        logger.error(f"Pacote não encontrado: {package_id}")
        return

    # Calcular total de créditos (base + bônus)
    total_credits = package.credits + package.bonus_credits

    # Adicionar créditos ao usuário
    await db.users.update_one(
        {"_id": user_id},
        {
            "$inc": {"credits": total_credits},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )

    # Registrar transação
    transaction_data = {
        "user_id": user_id,
        "type": "credit_purchase",
        "credits": total_credits,
        "value": payment_data.get("value"),
        "package_id": package_id,
        "package_name": package.name,
        "asaas_payment_id": payment_data.get("id"),
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
    }
    await db.credit_transactions.insert_one(transaction_data)

    logger.info(f"Créditos adicionados ao usuário {user_id} - Pacote: {package.name} - Créditos: {total_credits}")


async def process_featured_payment(
    payment_data: Dict[str, Any],
    reference_parts: list,
    db: AsyncIOMotorDatabase
):
    """Processar pagamento de projeto destacado"""
    user_id = reference_parts[1]
    project_id = reference_parts[2]
    duration_days = int(reference_parts[3]) if len(reference_parts) > 3 else 7

    # Buscar projeto
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        logger.error(f"Projeto não encontrado: {project_id}")
        return

    # Verificar se o usuário é dono do projeto
    if project.get("client_id") != user_id:
        logger.error(f"Usuário {user_id} não é dono do projeto {project_id}")
        return

    # Ativar projeto destacado
    featured_until = datetime.now(timezone.utc) + timedelta(days=duration_days)

    await db.projects.update_one(
        {"_id": project_id},
        {
            "$set": {
                "is_featured": True,
                "featured_until": featured_until,
                "featured_price": payment_data.get("value"),
                "featured_purchased_at": datetime.now(timezone.utc),
                "featured_payment_id": payment_data.get("id"),
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )

    logger.info(f"Projeto {project_id} destacado por {duration_days} dias até {featured_until}")


async def handle_payment_overdue(payment_data: Dict[str, Any], db: AsyncIOMotorDatabase):
    """Processar pagamento vencido"""
    external_reference = payment_data.get("externalReference")
    if not external_reference:
        return

    parts = external_reference.split(":")
    payment_type = parts[0]

    # Para assinaturas vencidas, suspender acesso
    if payment_type == "subscription":
        user_id = parts[1]
        await db.subscriptions.update_one(
            {"user_id": user_id, "status": "active"},
            {
                "$set": {
                    "status": "overdue",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        logger.warning(f"Assinatura suspensa por falta de pagamento: {user_id}")


async def handle_payment_refund(payment_data: Dict[str, Any], db: AsyncIOMotorDatabase):
    """Processar estorno de pagamento"""
    external_reference = payment_data.get("externalReference")
    if not external_reference:
        return

    parts = external_reference.split(":")
    payment_type = parts[0]

    if payment_type == "credits":
        # Estornar créditos
        user_id = parts[1]
        package_id = parts[2]

        package = await config_crud.get_credit_package(db, package_id)
        if package:
            total_credits = package.credits + package.bonus_credits
            await db.users.update_one(
                {"_id": user_id},
                {
                    "$inc": {"credits": -total_credits},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
            logger.info(f"Créditos estornados do usuário {user_id}: {total_credits}")

    elif payment_type == "subscription":
        # Cancelar assinatura
        user_id = parts[1]
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        logger.info(f"Assinatura cancelada devido a estorno: {user_id}")


@router.post("/asaas")
async def asaas_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Endpoint para receber webhooks do Asaas

    Eventos documentados em: https://docs.asaas.com/reference/eventos-webhook
    """
    # Obter corpo da requisição
    body = await request.body()
    payload = body.decode("utf-8")

    # Verificar assinatura do webhook (opcional mas recomendado)
    signature = request.headers.get("X-Asaas-Signature", "")
    webhook_token = os.getenv("ASAAS_WEBHOOK_TOKEN", "")

    if webhook_token and signature:
        is_valid = asaas_service.verify_webhook_signature(payload, signature, webhook_token)
        if not is_valid:
            logger.warning("Assinatura de webhook inválida")
            raise HTTPException(status_code=401, detail="Assinatura inválida")

    # Parse JSON
    try:
        data = await request.json()
    except Exception as e:
        logger.error(f"Erro ao parsear JSON do webhook: {str(e)}")
        raise HTTPException(status_code=400, detail="JSON inválido")

    event_type = data.get("event")
    payment_data = data.get("payment", {})

    if not event_type or not payment_data:
        logger.warning("Webhook sem event ou payment")
        raise HTTPException(status_code=400, detail="Dados incompletos")

    # Processar em background para responder rapidamente
    background_tasks.add_task(
        process_webhook_background,
        event_type,
        payment_data,
        db
    )

    return {"status": "received"}
