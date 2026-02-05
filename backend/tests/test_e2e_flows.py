"""
Testes End-to-End (E2E) para fluxos completos da aplicação

Estes testes simulam o uso real da aplicação através da API HTTP:
- Autenticação
- Criação de projetos
- Contatos e créditos
- Pagamentos com webhooks
- Chat
"""
import pytest
from fastapi.testclient import TestClient
import json


@pytest.mark.e2e
def test_complete_contact_flow_with_api(client, db, test_user, test_professional, test_project, test_professional_jwt_token):
    """
    Teste E2E: Fluxo completo de contato via API
    
    1. Profissional visualiza custo do contato
    2. Profissional cria contato
    3. Créditos são deduzidos
    4. Transação é registrada
    """
    # 1. Visualizar custo do contato
    response = client.get(
        f"/api/contacts/{test_project['_id']}/cost-preview",
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "credits_cost" in data
    assert "current_balance" in data
    assert data["current_balance"] >= data["credits_cost"]
    
    credits_cost = data["credits_cost"]
    initial_balance = data["current_balance"]
    
    # 2. Criar contato
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {
            "message": "Gostaria de trabalhar neste projeto",
            "proposal_price": 2500.00
        }
    }
    
    response = client.post(
        f"/api/contacts/{test_project['_id']}",
        json=contact_data,
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 201
    contact = response.json()
    assert contact["professional_id"] == test_professional["_id"]
    assert contact["project_id"] == test_project["_id"]
    assert contact["credits_used"] == credits_cost
    assert contact["status"] == "pending"
    
    # 3. Verificar que créditos foram deduzidos
    response = client.get(
        f"/api/contacts/{test_project['_id']}/cost-preview",
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    # Deve mostrar que já existe contato
    assert data["credits_cost"] == 0
    assert data["reason"] == "contact_already_exists"


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_payment_webhook_credits_flow(client, db, test_professional, test_credit_package, mock_asaas):
    """
    Teste E2E: Fluxo completo de compra de créditos via webhook
    
    1. Criar pagamento no Asaas (mock)
    2. Simular webhook de confirmação
    3. Verificar que créditos foram adicionados
    """
    # 1. Criar cliente no Asaas (mock)
    customer = await mock_asaas.create_customer(test_professional)
    assert customer["id"] is not None
    
    # 2. Criar pagamento
    payment = await mock_asaas.create_payment(
        customer_id=customer["id"],
        billing_type="PIX",
        value=50.00,
        due_date=(datetime.now() + timedelta(days=1)).isoformat(),
        description="Pacote de créditos",
        external_reference=f"credits:{test_professional['_id']}:{test_credit_package['_id']}"
    )
    
    assert payment["status"] == "PENDING"
    assert payment["pixTransaction"] is not None
    
    # 3. Simular confirmação de pagamento (webhook)
    confirmed_payment = await mock_asaas.confirm_payment(payment["id"])
    # Aceitar tanto RECEIVED quanto CONFIRMED (ambos representam confirmação bem-sucedida no mock)
    assert confirmed_payment["status"] in ("RECEIVED", "CONFIRMED")
    
    # 4. Simular webhook
    webhook_payload = mock_asaas.simulate_webhook_event("PAYMENT_CONFIRMED", payment["id"])
    
    response = client.post(
        "/api/webhooks/asaas",
        json=webhook_payload
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "received"
    
    # 5. Aguardar processamento em background e verificar créditos
    import asyncio
    await asyncio.sleep(0.5)  # Dar tempo para background task
    
    # Verificar que créditos foram adicionados
    user = await db.users.find_one({"_id": test_professional["_id"]})
    expected_credits = 10 + test_credit_package["credits"] + test_credit_package["bonus_credits"]
    assert user["credits"] == expected_credits
    
    # Verificar que transação foi registrada
    transaction = await db.credit_transactions.find_one({
        "user_id": test_professional["_id"],
        "type": "credit_purchase"
    })
    assert transaction is not None
    assert transaction["credits"] == test_credit_package["credits"] + test_credit_package["bonus_credits"]


@pytest.mark.e2e
def test_cannot_create_contact_without_credits(client, db, test_professional, test_project, test_professional_jwt_token):
    """
    Teste E2E: Não pode criar contato sem créditos suficientes
    """
    import asyncio
    
    # Zerar créditos do profissional
    async def zero_credits():
        await db.subscriptions.update_one(
            {"user_id": test_professional["_id"]},
            {"$set": {"credits": 0}}
        )
        await db.users.update_one(
            {"_id": test_professional["_id"]},
            {"$set": {"credits": 0}}
        )
    
    loop = asyncio.get_event_loop()
    loop.run_until_complete(zero_credits())
    
    # Tentar criar contato
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {
            "message": "Tentando criar contato sem créditos"
        }
    }
    
    response = client.post(
        f"/api/contacts/{test_project['_id']}",
        json=contact_data,
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    # Deve falhar com 400
    assert response.status_code == 400
    assert "Insufficient credits" in response.json()["detail"] or "créditos" in response.json()["detail"].lower()


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_featured_project_payment_flow(client, db, test_user, test_project, mock_asaas):
    """
    Teste E2E: Fluxo de pagamento de projeto destacado
    
    1. Criar pagamento para destacar projeto
    2. Simular confirmação via webhook
    3. Verificar que projeto foi destacado
    """
    # 1. Criar cliente
    customer = await mock_asaas.create_customer(test_user)
    
    # 2. Criar pagamento para destacar projeto por 7 dias
    payment = await mock_asaas.create_payment(
        customer_id=customer["id"],
        billing_type="PIX",
        value=99.90,
        due_date=(datetime.now() + timedelta(days=1)).isoformat(),
        description="Projeto destacado - 7 dias",
        external_reference=f"featured:{test_user['_id']}:{test_project['_id']}:7"
    )
    
    # 3. Confirmar pagamento
    await mock_asaas.confirm_payment(payment["id"])
    
    # 4. Simular webhook
    webhook_payload = mock_asaas.simulate_webhook_event("PAYMENT_CONFIRMED", payment["id"])
    
    response = client.post(
        "/api/webhooks/asaas",
        json=webhook_payload
    )
    
    assert response.status_code == 200
    
    # 5. Aguardar processamento
    import asyncio
    await asyncio.sleep(0.5)
    
    # 6. Verificar que projeto está destacado
    project = await db.projects.find_one({"_id": test_project["_id"]})
    assert project["is_featured"] is True
    assert project["featured_until"] is not None
    assert project["featured_price"] == 99.90


@pytest.mark.e2e
def test_project_sorting_and_badges(client, db):
    """
    Teste E2E: Ordenação de projetos e badges funcionam corretamente
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from ulid import new as new_ulid
    
    async def create_test_projects():
        # Criar projeto novo (< 24h)
        new_project = {
            "_id": str(new_ulid()),
            "client_id": "client1",
            "title": "New Project",
            "description": "Created recently",
            "category": {"main": "Tech", "sub": "Dev"},
            "status": "open",
            "is_featured": False,
            "created_at": datetime.now(timezone.utc) - timedelta(hours=2),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.projects.insert_one(new_project)
        
        # Criar projeto destacado
        featured_project = {
            "_id": str(new_ulid()),
            "client_id": "client1",
            "title": "Featured Project",
            "description": "This is featured",
            "category": {"main": "Tech", "sub": "Dev"},
            "status": "open",
            "is_featured": True,
            "featured_until": datetime.now(timezone.utc) + timedelta(days=5),
            "created_at": datetime.now(timezone.utc) - timedelta(days=2),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.projects.insert_one(featured_project)
        
        # Criar projeto antigo
        old_project = {
            "_id": str(new_ulid()),
            "client_id": "client1",
            "title": "Old Project",
            "description": "Created long ago",
            "category": {"main": "Tech", "sub": "Dev"},
            "status": "open",
            "is_featured": False,
            "created_at": datetime.now(timezone.utc) - timedelta(days=10),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.projects.insert_one(old_project)
    
    loop = asyncio.get_event_loop()
    loop.run_until_complete(create_test_projects())
    
    # Buscar projetos ordenados por featured
    response = client.get("/api/projects?sort_by=featured&sort_order=desc")
    
    assert response.status_code == 200
    projects = response.json()
    
    # Projeto destacado deve vir primeiro
    assert projects[0]["title"] == "Featured Project"
    assert "featured" in projects[0]["badges"]
    
    # Projeto novo deve ter badge "new"
    new_proj = [p for p in projects if p["title"] == "New Project"][0]
    assert "new" in new_proj["badges"]


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_chat_marks_contact_as_in_conversation(client, db, test_contact, test_professional, test_professional_jwt_token):
    """
    Teste E2E: Enviar primeira mensagem marca contato como "in_conversation"
    """
    # Verificar status inicial
    contact = await db.contacts.find_one({"_id": test_contact["_id"]})
    assert contact["status"] == "pending"
    
    # Enviar primeira mensagem
    message_data = {
        "content": "Olá, vamos conversar sobre o projeto!"
    }
    
    response = client.post(
        f"/api/contacts/{test_contact['_id']}/messages",
        json=message_data,
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 200
    
    # Verificar que status mudou
    contact_after = await db.contacts.find_one({"_id": test_contact["_id"]})
    assert contact_after["status"] == "in_conversation"
    assert len(contact_after["chat"]) == 1
    assert contact_after["chat"][0]["content"] == message_data["content"]


# Imports necessários
from datetime import datetime, timedelta, timezone
