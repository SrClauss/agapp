"""
Testes de Integração - Fluxo Completo
=======================================

Testes que cobrem fluxos completos de usuário:
1. Cliente cria serviço → Profissional usa créditos para contactar → Troca de mensagens → Fechamento do serviço
2. Profissional compra créditos via Asaas
3. Notificações push durante o fluxo

Requer MongoDB rodando.
"""
import pytest
from datetime import datetime, timezone, timedelta
from ulid import new as new_ulid
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import create_access_token, hash_password


@pytest.mark.integration
@pytest.mark.asyncio
async def test_complete_service_workflow(db: AsyncIOMotorDatabase, mock_firebase):
    """
    Teste de Integração: Fluxo Completo de Serviço
    
    Fluxo:
    1. Criar categoria (se não existir)
    2. Criar cliente
    3. Cliente cria projeto remoto
    4. Criar profissional com créditos
    5. Profissional se registra na categoria
    6. Profissional usa créditos para abrir contato
    7. Troca de mensagens entre cliente e profissional
    8. Cliente fecha o serviço
    9. Cliente avalia o profissional
    
    Verifica:
    - Dedução correta de créditos
    - Registro de transações
    - Mensagens são armazenadas
    - Status de contato muda para "in_conversation"
    - Projeto é fechado corretamente
    - Avaliação é registrada
    """
    # ==================== 1. Criar Categoria ====================
    category_id = str(new_ulid())
    category = {
        "_id": category_id,
        "name": "Programação",
        "tags": ["programacao", "desenvolvimento", "software"],
        "subcategories": [
            {
                "name": "Desenvolvimento Web",
                "tags": ["web", "frontend", "backend", "fullstack"]
            },
            {
                "name": "Mobile",
                "tags": ["android", "ios", "react-native", "flutter"]
            }
        ],
        "is_active": True,
        "default_remote_execution": True,
        "icon_name": "code-braces",
        "icon_library": "MaterialCommunityIcons",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.categories.insert_one(category)
    
    # ==================== 2. Criar Cliente ====================
    client_id = str(new_ulid())
    client_password = hash_password("client123")
    client = {
        "_id": client_id,
        "email": "client@test.com",
        "hashed_password": client_password,
        "full_name": "Cliente Test",
        "phone": "11987654321",
        "cpf": "11122233344",
        "roles": ["client"],
        "is_active": True,
        "is_profile_complete": True,
        "credits": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "fcm_tokens": [{"token": "client_fcm_token_123", "created_at": datetime.now(timezone.utc)}],
    }
    await db.users.insert_one(client)
    
    # ==================== 3. Cliente Cria Projeto Remoto ====================
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": client_id,
        "client_name": client["full_name"],
        "title": "Desenvolver Sistema Web",
        "description": "Preciso de um sistema web para gestão de estoque",
        "category": {
            "main": "Programação",
            "sub": "Desenvolvimento Web"
        },
        "skills_required": ["Python", "FastAPI", "React"],
        "budget_min": 3000.0,
        "budget_max": 8000.0,
        "status": "open",
        "location": {
            "address": {"formatted": "São Paulo, SP"},
            "coordinates": None  # Remoto, não precisa de coordenadas
        },
        "remote_execution": True,
        "is_featured": False,
        "liberado_por": [],
        "chat": [],
        "attachments": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project)
    
    # ==================== 4. Criar Profissional com Créditos ====================
    professional_id = str(new_ulid())
    professional_password = hash_password("prof123")
    professional = {
        "_id": professional_id,
        "email": "professional@test.com",
        "hashed_password": professional_password,
        "full_name": "Profissional Test",
        "phone": "11999887766",
        "cpf": "55566677788",
        "roles": ["professional"],
        "is_active": True,
        "is_profile_complete": True,
        "credits": 0,  # Será atualizado via subscription
        "professional_info": {
            "skills": ["Python", "FastAPI", "React", "PostgreSQL"],
            "experience": "5 anos de experiência em desenvolvimento web",
            "portfolio": "https://github.com/professional",
            "subcategories": ["Desenvolvimento Web", "Mobile"],
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "fcm_tokens": [{"token": "prof_fcm_token_456", "created_at": datetime.now(timezone.utc)}],
    }
    await db.users.insert_one(professional)
    
    # Criar subscription para o profissional com créditos
    subscription_id = str(new_ulid())
    subscription = {
        "_id": subscription_id,
        "user_id": professional_id,
        "plan_name": "Plano Profissional",
        "status": "active",
        "credits": 10,  # 10 créditos disponíveis
        "credits_per_week": 10,
        "monthly_price": 99.90,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.subscriptions.insert_one(subscription)
    
    # ==================== 5. Profissional Usa Créditos para Contactar ====================
    from app.utils.credit_pricing import (
        calculate_contact_cost,
        validate_and_deduct_credits,
        record_credit_transaction
    )
    
    # Calcular custo (projeto novo = 3 créditos)
    credits_cost, pricing_reason = await calculate_contact_cost(db, project_id, professional_id)
    assert credits_cost == 3, "Projeto novo deve custar 3 créditos"
    assert "new_project" in pricing_reason
    
    # Validar e deduzir créditos atomicamente
    success, error_msg = await validate_and_deduct_credits(db, professional_id, credits_cost)
    assert success is True, f"Dedução de créditos falhou: {error_msg}"
    assert error_msg is None
    
    # Verificar que os créditos foram deduzidos
    updated_subscription = await db.subscriptions.find_one({"user_id": professional_id})
    assert updated_subscription["credits"] == 7, "Deve ter 7 créditos restantes (10 - 3)"
    
    # Criar contato
    contact_id = str(new_ulid())
    contact = {
        "_id": contact_id,
        "professional_id": professional_id,
        "professional_name": professional["full_name"],
        "client_id": client_id,
        "client_name": client["full_name"],
        "project_id": project_id,
        "contact_type": "proposal",
        "credits_used": credits_cost,
        "status": "pending",
        "contact_details": {
            "message": "Olá! Tenho 5 anos de experiência em desenvolvimento web e gostaria de trabalhar no seu projeto.",
            "proposal_price": 5000.0,
        },
        "chat": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.contacts.insert_one(contact)
    
    # Registrar transação de crédito
    await record_credit_transaction(
        db,
        user_id=professional_id,
        credits=-credits_cost,
        transaction_type="contact",
        metadata={
            "project_id": project_id,
            "contact_id": contact_id,
            "pricing_reason": pricing_reason
        }
    )
    
    # Verificar que a transação foi registrada
    transactions = await db.credit_transactions.find({"user_id": professional_id}).to_list(None)
    assert len(transactions) == 1
    assert transactions[0]["credits"] == -3
    assert transactions[0]["transaction_type"] == "contact"
    assert transactions[0]["metadata"]["project_id"] == project_id
    
    # Verificar que notificação push foi "enviada" (via mock)
    # Na implementação real, o endpoint de contacts.py envia notificação para o cliente
    
    # ==================== 6. Troca de Mensagens ====================
    from app.utils.contact_helpers import is_first_user_message
    
    # Profissional envia primeira mensagem
    msg1_id = str(new_ulid())
    msg1 = {
        "id": msg1_id,
        "sender_id": professional_id,
        "content": "Olá! Vi seu projeto e tenho interesse em ajudá-lo.",
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$push": {"chat": msg1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Verificar se é a primeira mensagem de usuário
    contact_after_msg1 = await db.contacts.find_one({"_id": contact_id})
    messages = contact_after_msg1.get("chat", [])
    assert is_first_user_message(messages) is True, "Primeira mensagem de usuário detectada"
    
    # Marcar contato como "in_conversation"
    await db.contacts.update_one(
        {"_id": contact_id},
        {"$set": {"status": "in_conversation"}}
    )
    
    # Cliente responde
    msg2_id = str(new_ulid())
    msg2 = {
        "id": msg2_id,
        "sender_id": client_id,
        "content": "Olá! Que bom! Você tem experiência com FastAPI?",
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$push": {"chat": msg2},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Profissional responde novamente
    msg3_id = str(new_ulid())
    msg3 = {
        "id": msg3_id,
        "sender_id": professional_id,
        "content": "Sim! Trabalho com FastAPI há 3 anos e já desenvolvi vários sistemas web.",
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$push": {"chat": msg3},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Verificar que as mensagens foram armazenadas
    contact_with_messages = await db.contacts.find_one({"_id": contact_id})
    assert len(contact_with_messages["chat"]) == 3
    assert contact_with_messages["status"] == "in_conversation"
    assert contact_with_messages["chat"][0]["sender_id"] == professional_id
    assert contact_with_messages["chat"][1]["sender_id"] == client_id
    assert contact_with_messages["chat"][2]["sender_id"] == professional_id
    
    # ==================== 7. Cliente Fecha o Serviço ====================
    final_budget = 5500.0
    
    await db.projects.update_one(
        {"_id": project_id},
        {
            "$set": {
                "status": "closed",
                "final_budget": final_budget,
                "closed_by": professional_id,
                "closed_by_name": professional["full_name"],
                "closed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )
    
    # Atualizar contato para "completed"
    await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$set": {
                "status": "completed",
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )
    
    # Verificar que o projeto foi fechado
    closed_project = await db.projects.find_one({"_id": project_id})
    assert closed_project["status"] == "closed"
    assert closed_project["final_budget"] == final_budget
    assert closed_project["closed_by"] == professional_id
    assert closed_project["closed_at"] is not None
    
    # ==================== 8. Cliente Avalia o Profissional ====================
    evaluation = {
        "id": str(new_ulid()),
        "project_id": project_id,
        "client_id": client_id,
        "rating": 5,
        "comment": "Excelente trabalho! Entregou no prazo e com qualidade.",
        "created_at": datetime.now(timezone.utc),
    }
    
    # Adicionar avaliação ao profissional
    await db.users.update_one(
        {"_id": professional_id},
        {
            "$push": {"evaluations": evaluation},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Calcular média de avaliações (usando mean truncado)
    professional_with_eval = await db.users.find_one({"_id": professional_id})
    evaluations = professional_with_eval.get("evaluations", [])
    
    if evaluations:
        ratings = [e["rating"] for e in evaluations]
        # Truncated mean: remove lowest and highest, then average
        if len(ratings) > 2:
            ratings_sorted = sorted(ratings)
            truncated_ratings = ratings_sorted[1:-1]
            average_rating = sum(truncated_ratings) / len(truncated_ratings)
        else:
            average_rating = sum(ratings) / len(ratings)
        
        await db.users.update_one(
            {"_id": professional_id},
            {"$set": {"average_rating": round(average_rating, 2)}}
        )
    
    # Verificar que a avaliação foi registrada
    final_professional = await db.users.find_one({"_id": professional_id})
    assert len(final_professional["evaluations"]) == 1
    assert final_professional["evaluations"][0]["rating"] == 5
    assert final_professional["average_rating"] == 5.0
    
    # ==================== 9. Verificações Finais ====================
    # Verificar saldo final de créditos do profissional
    final_subscription = await db.subscriptions.find_one({"user_id": professional_id})
    assert final_subscription["credits"] == 7, "Deve ter 7 créditos restantes"
    
    # Verificar que todas as transações foram registradas
    all_transactions = await db.credit_transactions.find({"user_id": professional_id}).to_list(None)
    assert len(all_transactions) == 1
    
    print("✅ Teste de fluxo completo passou!")
    print(f"   - Categoria criada: {category['name']}")
    print(f"   - Cliente criado: {client['full_name']}")
    print(f"   - Projeto criado: {project['title']}")
    print(f"   - Profissional criado: {professional['full_name']}")
    print(f"   - Créditos usados: {credits_cost} (razão: {pricing_reason})")
    print(f"   - Mensagens trocadas: 3")
    print(f"   - Projeto fechado com valor: R$ {final_budget}")
    print(f"   - Avaliação: 5 estrelas")
    print(f"   - Créditos restantes: {final_subscription['credits']}")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_credit_purchase_with_asaas_webhook(db: AsyncIOMotorDatabase, mock_asaas):
    """
    Teste de Integração: Compra de Créditos via Asaas
    
    Fluxo:
    1. Criar profissional
    2. Criar pacote de créditos
    3. Profissional inicia compra de créditos
    4. Mock Asaas processa pagamento
    5. Webhook Asaas confirma pagamento
    6. Créditos são adicionados à conta do profissional
    
    Verifica:
    - Pagamento é criado corretamente
    - Webhook é processado
    - Créditos são adicionados
    - Transação é registrada
    """
    # ==================== 1. Criar Profissional ====================
    professional_id = str(new_ulid())
    professional_password = hash_password("prof123")
    professional = {
        "_id": professional_id,
        "email": "professional_buyer@test.com",
        "hashed_password": professional_password,
        "full_name": "Profissional Comprador",
        "phone": "11998765432",
        "cpf": "12345678901",
        "roles": ["professional"],
        "is_active": True,
        "is_profile_complete": True,
        "credits": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(professional)
    
    # Criar subscription inicial
    subscription_id = str(new_ulid())
    subscription = {
        "_id": subscription_id,
        "user_id": professional_id,
        "plan_name": "Plano Básico",
        "status": "active",
        "credits": 2,  # Apenas 2 créditos restantes
        "credits_per_week": 5,
        "monthly_price": 49.90,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.subscriptions.insert_one(subscription)
    
    # ==================== 2. Criar Pacote de Créditos ====================
    package_id = str(new_ulid())
    package = {
        "_id": package_id,
        "name": "Pacote 10 Créditos",
        "credits": 10,
        "bonus_credits": 2,  # 2 créditos de bônus
        "price": 50.00,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.credit_packages.insert_one(package)
    
    # ==================== 3. Profissional Inicia Compra ====================
    # Criar customer no Asaas (mock)
    asaas_customer = await mock_asaas.create_customer(
        name=professional["full_name"],
        email=professional["email"],
        cpf_cnpj=professional["cpf"],
        phone=professional["phone"],
    )
    assert asaas_customer is not None
    assert asaas_customer["name"] == professional["full_name"]
    
    # Criar pagamento no Asaas (mock)
    external_reference = f"credits:{professional_id}:{package_id}"
    asaas_payment = await mock_asaas.create_payment(
        customer_id=asaas_customer["id"],
        billing_type="PIX",
        value=package["price"],
        description=f"Compra de {package['name']}",
        external_reference=external_reference,
    )
    assert asaas_payment is not None
    assert asaas_payment["value"] == package["price"]
    assert asaas_payment["status"] == "PENDING"
    
    # Registrar pagamento pendente no banco
    payment_id = str(new_ulid())
    payment_record = {
        "_id": payment_id,
        "user_id": professional_id,
        "asaas_payment_id": asaas_payment["id"],
        "asaas_customer_id": asaas_customer["id"],
        "amount": package["price"],
        "credits_to_add": package["credits"] + package["bonus_credits"],  # 12 créditos total
        "package_id": package_id,
        "status": "pending",
        "external_reference": external_reference,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payments.insert_one(payment_record)
    
    # ==================== 4. Mock Asaas Processa Pagamento ====================
    # Simular confirmação de pagamento no Asaas
    confirmed_payment = await mock_asaas.confirm_payment(asaas_payment["id"])
    assert confirmed_payment["status"] == "CONFIRMED"
    assert confirmed_payment["paymentDate"] is not None
    
    # ==================== 5. Webhook Asaas Confirma Pagamento ====================
    # Simular webhook do Asaas
    webhook_event = mock_asaas.simulate_webhook_event("PAYMENT_CONFIRMED", asaas_payment["id"])
    assert webhook_event["event"] == "PAYMENT_CONFIRMED"
    assert webhook_event["payment"]["id"] == asaas_payment["id"]
    assert webhook_event["payment"]["externalReference"] == external_reference
    
    # Processar webhook (simular o que o endpoint /webhooks/asaas faria)
    payment_data = webhook_event["payment"]
    
    # Extrair external_reference para identificar o usuário e pacote
    ref_parts = payment_data["externalReference"].split(":")
    assert ref_parts[0] == "credits"
    user_id_from_ref = ref_parts[1]
    package_id_from_ref = ref_parts[2]
    
    assert user_id_from_ref == professional_id
    assert package_id_from_ref == package_id
    
    # Buscar pagamento pendente
    pending_payment = await db.payments.find_one({"asaas_payment_id": payment_data["id"]})
    assert pending_payment is not None
    assert pending_payment["status"] == "pending"
    
    # Adicionar créditos ao profissional
    credits_to_add = pending_payment["credits_to_add"]
    result = await db.subscriptions.update_one(
        {"user_id": user_id_from_ref},
        {"$inc": {"credits": credits_to_add}}
    )
    assert result.modified_count == 1
    
    # Atualizar status do pagamento
    await db.payments.update_one(
        {"_id": pending_payment["_id"]},
        {
            "$set": {
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )
    
    # Registrar transação de crédito
    from app.utils.credit_pricing import record_credit_transaction
    await record_credit_transaction(
        db,
        user_id=user_id_from_ref,
        credits=credits_to_add,
        transaction_type="purchase",
        metadata={
            "payment_id": str(pending_payment["_id"]),
            "asaas_payment_id": payment_data["id"],
            "package_id": package_id_from_ref,
            "amount_paid": payment_data["value"],
        }
    )
    
    # ==================== 6. Verificações Finais ====================
    # Verificar que os créditos foram adicionados
    final_subscription = await db.subscriptions.find_one({"user_id": professional_id})
    assert final_subscription["credits"] == 14, "Deve ter 14 créditos (2 iniciais + 12 comprados)"
    
    # Verificar que o pagamento foi confirmado
    final_payment = await db.payments.find_one({"_id": payment_id})
    assert final_payment["status"] == "confirmed"
    assert final_payment["confirmed_at"] is not None
    
    # Verificar que a transação foi registrada
    transactions = await db.credit_transactions.find({"user_id": professional_id}).to_list(None)
    assert len(transactions) == 1
    assert transactions[0]["credits"] == 12
    assert transactions[0]["transaction_type"] == "purchase"
    assert transactions[0]["metadata"]["package_id"] == package_id
    
    # Verificar dados no mock Asaas
    asaas_customers = mock_asaas.get_customers()
    assert len(asaas_customers) == 1
    
    asaas_payments = mock_asaas.get_payments()
    assert len(asaas_payments) == 1
    assert asaas_payments[0]["status"] == "CONFIRMED"
    
    print("✅ Teste de compra de créditos via Asaas passou!")
    print(f"   - Profissional: {professional['full_name']}")
    print(f"   - Pacote comprado: {package['name']}")
    print(f"   - Valor pago: R$ {package['price']}")
    print(f"   - Créditos adicionados: {credits_to_add} (10 + 2 bônus)")
    print(f"   - Saldo inicial: 2 créditos")
    print(f"   - Saldo final: {final_subscription['credits']} créditos")
    print(f"   - Asaas customer ID: {asaas_customer['id']}")
    print(f"   - Asaas payment ID: {asaas_payment['id']}")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_push_notification_flow(db: AsyncIOMotorDatabase, mock_firebase):
    """
    Teste de Integração: Fluxo de Notificações Push
    
    Fluxo:
    1. Criar cliente e profissional com FCM tokens
    2. Profissional cria contato → Cliente recebe notificação
    3. Cliente envia mensagem → Profissional recebe notificação
    4. Projeto é fechado → Profissional recebe notificação
    
    Verifica:
    - Notificações são enviadas via Firebase mock
    - Tokens FCM são usados corretamente
    - Dados corretos são enviados nas notificações
    """
    # ==================== 1. Criar Cliente com FCM Token ====================
    client_id = str(new_ulid())
    client = {
        "_id": client_id,
        "email": "client_notif@test.com",
        "hashed_password": hash_password("client123"),
        "full_name": "Cliente Notificações",
        "phone": "11987654321",
        "cpf": "11122233344",
        "roles": ["client"],
        "is_active": True,
        "credits": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "fcm_tokens": [
            {"token": "client_fcm_abc123", "created_at": datetime.now(timezone.utc)}
        ],
    }
    await db.users.insert_one(client)
    
    # ==================== 2. Criar Profissional com FCM Token ====================
    professional_id = str(new_ulid())
    professional = {
        "_id": professional_id,
        "email": "prof_notif@test.com",
        "hashed_password": hash_password("prof123"),
        "full_name": "Profissional Notificações",
        "phone": "11999887766",
        "cpf": "55566677788",
        "roles": ["professional"],
        "is_active": True,
        "credits": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "fcm_tokens": [
            {"token": "prof_fcm_xyz789", "created_at": datetime.now(timezone.utc)}
        ],
    }
    await db.users.insert_one(professional)
    
    # Criar subscription para profissional
    subscription_id = str(new_ulid())
    await db.subscriptions.insert_one({
        "_id": subscription_id,
        "user_id": professional_id,
        "credits": 10,
        "plan_name": "Test Plan",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    })
    
    # ==================== 3. Criar Projeto ====================
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": client_id,
        "client_name": client["full_name"],
        "title": "Teste de Notificações",
        "description": "Projeto para testar notificações push",
        "category": {"main": "Serviços", "sub": "Consultoria"},
        "status": "open",
        "location": {
            "address": {"formatted": "São Paulo, SP"},
        },
        "remote_execution": True,
        "is_featured": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project)
    
    # ==================== 4. Profissional Cria Contato → Notificação para Cliente ====================
    contact_id = str(new_ulid())
    contact = {
        "_id": contact_id,
        "professional_id": professional_id,
        "professional_name": professional["full_name"],
        "client_id": client_id,
        "client_name": client["full_name"],
        "project_id": project_id,
        "contact_type": "proposal",
        "credits_used": 3,
        "status": "pending",
        "contact_details": {"message": "Tenho interesse no projeto"},
        "chat": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.contacts.insert_one(contact)
    
    # Simular envio de notificação (como faz o endpoint contacts.py)
    from app.core.firebase import send_multicast_notification
    
    client_fcm_tokens = [token_obj["token"] for token_obj in client["fcm_tokens"]]
    await send_multicast_notification(
        fcm_tokens=client_fcm_tokens,
        title="Nova Proposta Recebida",
        body=f"{professional['full_name']} demonstrou interesse no seu projeto: {project['title']}",
        data={
            "type": "new_contact",
            "contact_id": contact_id,
            "project_id": project_id,
            "professional_id": professional_id,
        }
    )
    
    # Verificar que a notificação foi "enviada"
    client_messages = mock_firebase.get_sent_messages("client_fcm_abc123")
    assert len(client_messages) == 1
    assert client_messages[0].notification.title == "Nova Proposta Recebida"
    assert professional["full_name"] in client_messages[0].notification.body
    assert client_messages[0].data["type"] == "new_contact"
    assert client_messages[0].data["contact_id"] == contact_id
    
    # ==================== 5. Cliente Envia Mensagem → Notificação para Profissional ====================
    msg_id = str(new_ulid())
    message = {
        "id": msg_id,
        "sender_id": client_id,
        "content": "Olá! Vamos conversar sobre o projeto.",
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.contacts.update_one(
        {"_id": contact_id},
        {"$push": {"chat": message}}
    )
    
    # Enviar notificação para o profissional
    prof_fcm_tokens = [token_obj["token"] for token_obj in professional["fcm_tokens"]]
    await send_multicast_notification(
        fcm_tokens=prof_fcm_tokens,
        title=f"Nova mensagem de {client['full_name']}",
        body=message["content"][:100],
        data={
            "type": "new_message",
            "contact_id": contact_id,
            "sender_id": client_id,
            "message_id": msg_id,
        }
    )
    
    # Verificar que a notificação foi "enviada"
    prof_messages = mock_firebase.get_sent_messages("prof_fcm_xyz789")
    assert len(prof_messages) == 1
    assert prof_messages[0].notification.title == f"Nova mensagem de {client['full_name']}"
    assert prof_messages[0].notification.body == message["content"]
    assert prof_messages[0].data["type"] == "new_message"
    assert prof_messages[0].data["message_id"] == msg_id
    
    # ==================== 6. Projeto é Fechado → Notificação para Profissional ====================
    await db.projects.update_one(
        {"_id": project_id},
        {
            "$set": {
                "status": "closed",
                "closed_by": professional_id,
                "closed_at": datetime.now(timezone.utc),
            }
        }
    )
    
    # Enviar notificação
    await send_multicast_notification(
        fcm_tokens=prof_fcm_tokens,
        title="Projeto Concluído",
        body=f"O projeto '{project['title']}' foi concluído. Aguardando avaliação do cliente.",
        data={
            "type": "project_closed",
            "project_id": project_id,
            "contact_id": contact_id,
        }
    )
    
    # Verificar que a notificação foi "enviada"
    prof_messages_final = mock_firebase.get_sent_messages("prof_fcm_xyz789")
    assert len(prof_messages_final) == 2  # 1 mensagem + 1 fechamento
    assert prof_messages_final[1].notification.title == "Projeto Concluído"
    assert project["title"] in prof_messages_final[1].notification.body
    assert prof_messages_final[1].data["type"] == "project_closed"
    
    # ==================== 7. Verificações Finais ====================
    # Verificar total de notificações enviadas
    all_messages = mock_firebase.get_all_sent_messages()
    assert len(all_messages) == 3  # 1 para cliente + 2 para profissional
    
    # Verificar que os tokens foram usados corretamente
    assert any(msg.token == "client_fcm_abc123" for msg in all_messages)
    assert any(msg.token == "prof_fcm_xyz789" for msg in all_messages)
    
    print("✅ Teste de notificações push passou!")
    print(f"   - Cliente: {client['full_name']} (token: {client_fcm_tokens[0][:20]}...)")
    print(f"   - Profissional: {professional['full_name']} (token: {prof_fcm_tokens[0][:20]}...)")
    print(f"   - Notificações enviadas: {len(all_messages)}")
    print(f"     1. Nova proposta → Cliente")
    print(f"     2. Nova mensagem → Profissional")
    print(f"     3. Projeto concluído → Profissional")
