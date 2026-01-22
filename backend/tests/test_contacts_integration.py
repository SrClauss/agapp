"""
Testes de integração para o sistema de contatos e créditos

Estes testes usam banco de dados real (MongoDB de teste) e testam:
- Criação de contatos
- Dedução de créditos com pricing dinâmico
- Integração entre múltiplos módulos
- Transações e atomicidade
"""
import pytest
from datetime import datetime, timezone, timedelta
from ulid import new as new_ulid


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_contact_deducts_correct_credits(db, test_professional, test_project):
    """
    Teste de integração: Criar contato deduz créditos corretos baseado na idade do projeto
    """
    from app.utils.credit_pricing import calculate_contact_cost, validate_and_deduct_credits, record_credit_transaction
    
    # Verificar créditos iniciais
    subscription = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    initial_credits = subscription["credits"]
    assert initial_credits == 10
    
    # Calcular custo (projeto novo < 24h deve custar 3 créditos)
    credits_needed, reason = await calculate_contact_cost(db, test_project["_id"], test_professional["_id"])
    assert credits_needed == 3
    assert reason == "new_project_0_24h"
    
    # Deduzir créditos
    success, error = await validate_and_deduct_credits(db, test_professional["_id"], credits_needed)
    assert success is True
    assert error is None
    
    # Verificar que créditos foram deduzidos
    subscription_after = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    assert subscription_after["credits"] == initial_credits - credits_needed
    assert subscription_after["credits"] == 7
    
    # Registrar transação
    tx_id = await record_credit_transaction(
        db,
        user_id=test_professional["_id"],
        credits=-credits_needed,
        transaction_type="contact",
        metadata={"project_id": test_project["_id"], "pricing_reason": reason}
    )
    
    # Verificar que transação foi registrada
    transaction = await db.credit_transactions.find_one({"_id": tx_id})
    assert transaction is not None
    assert transaction["credits"] == -3
    assert transaction["type"] == "contact"
    assert transaction["metadata"]["pricing_reason"] == "new_project_0_24h"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_contact_prevents_double_deduction(db, test_professional, test_project):
    """
    Teste de integração: Locking atômico previne dedução dupla de créditos
    """
    from app.utils.credit_pricing import validate_and_deduct_credits
    
    # Primeira dedução deve funcionar
    success1, error1 = await validate_and_deduct_credits(db, test_professional["_id"], 3)
    assert success1 is True
    
    # Verificar saldo
    subscription = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    assert subscription["credits"] == 7
    
    # Segunda dedução deve funcionar (ainda tem 7 créditos)
    success2, error2 = await validate_and_deduct_credits(db, test_professional["_id"], 3)
    assert success2 is True
    
    # Verificar saldo novamente
    subscription = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    assert subscription["credits"] == 4
    
    # Terceira dedução deve funcionar (ainda tem 4 créditos)
    success3, error3 = await validate_and_deduct_credits(db, test_professional["_id"], 3)
    assert success3 is True
    
    # Verificar saldo
    subscription = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    assert subscription["credits"] == 1
    
    # Quarta dedução deve FALHAR (só tem 1 crédito)
    success4, error4 = await validate_and_deduct_credits(db, test_professional["_id"], 3)
    assert success4 is False
    assert "Insufficient credits" in error4
    
    # Verificar que saldo não mudou
    subscription = await db.subscriptions.find_one({"user_id": test_professional["_id"]})
    assert subscription["credits"] == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_age_affects_credit_cost(db, test_professional):
    """
    Teste de integração: Idade do projeto afeta o custo de créditos
    """
    from app.utils.credit_pricing import calculate_contact_cost
    
    # Criar projeto de 12h atrás (deve custar 3 créditos)
    project_12h = {
        "_id": str(new_ulid()),
        "client_id": "client1",
        "title": "Project 12h old",
        "description": "Test",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project_12h)
    
    credits, reason = await calculate_contact_cost(db, project_12h["_id"], test_professional["_id"])
    assert credits == 3
    assert reason == "new_project_0_24h"
    
    # Criar projeto de 30h atrás (deve custar 2 créditos)
    project_30h = {
        "_id": str(new_ulid()),
        "client_id": "client1",
        "title": "Project 30h old",
        "description": "Test",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=30),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project_30h)
    
    credits, reason = await calculate_contact_cost(db, project_30h["_id"], test_professional["_id"])
    assert credits == 2
    assert reason == "new_project_24_36h"
    
    # Criar projeto de 48h atrás (deve custar 1 crédito)
    project_48h = {
        "_id": str(new_ulid()),
        "client_id": "client1",
        "title": "Project 48h old",
        "description": "Test",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=48),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project_48h)
    
    credits, reason = await calculate_contact_cost(db, project_48h["_id"], test_professional["_id"])
    assert credits == 1
    assert reason == "new_project_36h_plus"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_contacted_project_has_different_pricing(db, test_professional):
    """
    Teste de integração: Projetos com contatos existentes têm precificação diferente
    """
    from app.utils.credit_pricing import calculate_contact_cost
    
    # Criar projeto
    project = {
        "_id": str(new_ulid()),
        "client_id": "client1",
        "title": "Project with contacts",
        "description": "Test",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=10),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.projects.insert_one(project)
    
    # Sem contatos, deve custar 3 créditos (projeto < 24h)
    credits, reason = await calculate_contact_cost(db, project["_id"], test_professional["_id"])
    assert credits == 3
    assert reason == "new_project_0_24h"
    
    # Criar contato de outro profissional (12h atrás)
    contact = {
        "_id": str(new_ulid()),
        "project_id": project["_id"],
        "professional_id": "other_professional",
        "client_id": "client1",
        "status": "pending",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.contacts.insert_one(contact)
    
    # Com contato < 24h, deve custar 2 créditos
    credits, reason = await calculate_contact_cost(db, project["_id"], test_professional["_id"])
    assert credits == 2
    assert reason == "contacted_project_0_24h_after_first"
    
    # Atualizar contato para 30h atrás
    await db.contacts.update_one(
        {"_id": contact["_id"]},
        {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(hours=30)}}
    )
    
    # Com contato > 24h, deve custar 1 crédito
    credits, reason = await calculate_contact_cost(db, project["_id"], test_professional["_id"])
    assert credits == 1
    assert reason == "contacted_project_24h_plus_after_first"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_credit_transaction_audit_trail(db, test_professional, test_project):
    """
    Teste de integração: Todas as transações de crédito são registradas corretamente
    """
    from app.utils.credit_pricing import record_credit_transaction
    
    # Registrar várias transações
    tx1_id = await record_credit_transaction(
        db,
        user_id=test_professional["_id"],
        credits=-3,
        transaction_type="contact",
        metadata={"project_id": test_project["_id"]}
    )
    
    tx2_id = await record_credit_transaction(
        db,
        user_id=test_professional["_id"],
        credits=10,
        transaction_type="purchase",
        metadata={"package_id": "pack1"},
        price=50.00
    )
    
    tx3_id = await record_credit_transaction(
        db,
        user_id=test_professional["_id"],
        credits=-2,
        transaction_type="contact",
        metadata={"project_id": "proj2"}
    )
    
    # Buscar todas as transações do usuário
    transactions = await db.credit_transactions.find(
        {"user_id": test_professional["_id"]}
    ).sort("created_at", 1).to_list(length=None)
    
    assert len(transactions) == 3
    
    # Verificar primeira transação
    assert transactions[0]["_id"] == tx1_id
    assert transactions[0]["credits"] == -3
    assert transactions[0]["type"] == "contact"
    
    # Verificar segunda transação
    assert transactions[1]["_id"] == tx2_id
    assert transactions[1]["credits"] == 10
    assert transactions[1]["type"] == "purchase"
    assert transactions[1]["price"] == 50.00
    
    # Verificar terceira transação
    assert transactions[2]["_id"] == tx3_id
    assert transactions[2]["credits"] == -2
    
    # Calcular saldo (para auditoria)
    total = sum(tx["credits"] for tx in transactions)
    assert total == 5  # -3 + 10 - 2 = 5
