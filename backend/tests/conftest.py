"""
Configurações e fixtures globais para testes pytest

Este arquivo fornece fixtures compartilhadas entre todos os testes:
- Mock do banco de dados MongoDB
- Mock do Asaas
- Mock do Firebase
- Cliente HTTP de teste (TestClient)
- Usuários e dados de teste
"""
import pytest
import asyncio
from typing import AsyncGenerator, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import os

# Configurar variáveis de ambiente para testes
os.environ["MONGODB_URL"] = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")
os.environ["MONGODB_DB_NAME"] = os.getenv("TEST_MONGODB_DB_NAME", "agapp_test")
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["PAYMENT_TEST_MODE"] = "true"


# ==================== FIXTURES DE SETUP ====================

@pytest.fixture(scope="session")
def event_loop():
    """Criar event loop para toda a sessão de testes"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db() -> AsyncGenerator:
    """
    Fixture: Conexão com banco de dados de teste
    
    Cria uma conexão limpa para cada teste e limpa após o teste.
    """
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    database = client[os.getenv("MONGODB_DB_NAME")]
    
    yield database
    
    # Limpar banco após cada teste
    await database.client.drop_database(os.getenv("MONGODB_DB_NAME"))
    client.close()


@pytest.fixture
def client():
    """
    Fixture: Cliente HTTP de teste do FastAPI
    
    Permite fazer requisições HTTP aos endpoints da API.
    """
    from app.main import app
    with TestClient(app) as test_client:
        yield test_client


# ==================== FIXTURES DE MOCKS ====================

@pytest.fixture
def mock_asaas():
    """
    Fixture: Mock do serviço Asaas
    
    Reseta o mock antes e depois de cada teste.
    """
    from tests.mocks.asaas_mock import mock_asaas_service
    
    mock_asaas_service.reset()
    yield mock_asaas_service
    mock_asaas_service.reset()


@pytest.fixture
def mock_firebase():
    """
    Fixture: Mock do Firebase Cloud Messaging
    
    Reseta o mock antes e depois de cada teste.
    """
    from tests.mocks.firebase_mock import mock_firebase_messaging
    
    mock_firebase_messaging.reset()
    yield mock_firebase_messaging
    mock_firebase_messaging.reset()


# ==================== FIXTURES DE DADOS DE TESTE ====================

@pytest.fixture
async def test_user(db) -> Dict[str, Any]:
    """
    Fixture: Usuário de teste (cliente)
    
    Cria um usuário básico no banco para testes.
    """
    from ulid import new as new_ulid
    
    user_id = str(new_ulid())
    user = {
        "_id": user_id,
        "email": "test@example.com",
        "full_name": "Test User",
        "phone": "11999999999",
        "cpf": "12345678900",
        "roles": ["client"],
        "credits": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.users.insert_one(user)
    return user


@pytest.fixture
async def test_professional(db) -> Dict[str, Any]:
    """
    Fixture: Profissional de teste
    
    Cria um profissional com créditos no banco para testes.
    """
    from ulid import new as new_ulid
    
    user_id = str(new_ulid())
    user = {
        "_id": user_id,
        "email": "professional@example.com",
        "full_name": "Test Professional",
        "phone": "11888888888",
        "cpf": "98765432100",
        "roles": ["professional"],
        "credits": 10,  # Iniciar com 10 créditos
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.users.insert_one(user)
    
    # Criar subscription para o profissional
    subscription = {
        "_id": str(new_ulid()),
        "user_id": user_id,
        "plan_name": "Test Plan",
        "status": "active",
        "credits": 10,
        "credits_per_week": 10,
        "monthly_price": 99.90,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.subscriptions.insert_one(subscription)
    
    return user


@pytest.fixture
async def test_project(db, test_user) -> Dict[str, Any]:
    """
    Fixture: Projeto de teste
    
    Cria um projeto aberto no banco para testes.
    """
    from ulid import new as new_ulid
    
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": test_user["_id"],
        "client_name": test_user["full_name"],
        "title": "Test Project",
        "description": "This is a test project",
        "category": {"main": "Technology", "sub": "Web Development"},
        "skills_required": ["Python", "FastAPI"],
        "budget_min": 1000.0,
        "budget_max": 5000.0,
        "status": "open",
        "location": {
            "address": {"formatted": "São Paulo, SP"},
            "coordinates": {"type": "Point", "coordinates": [-46.6333, -23.5505]}
        },
        "remote_execution": False,
        "is_featured": False,
        "liberado_por": [],
        "chat": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.projects.insert_one(project)
    return project


@pytest.fixture
async def test_contact(db, test_project, test_professional) -> Dict[str, Any]:
    """
    Fixture: Contato de teste
    
    Cria um contato entre profissional e projeto.
    """
    from ulid import new as new_ulid
    
    contact_id = str(new_ulid())
    contact = {
        "_id": contact_id,
        "professional_id": test_professional["_id"],
        "professional_name": test_professional["full_name"],
        "client_id": test_project["client_id"],
        "client_name": test_project["client_name"],
        "project_id": test_project["_id"],
        "contact_type": "proposal",
        "credits_used": 1,
        "status": "pending",
        "contact_details": {"message": "I'm interested in this project"},
        "chat": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.contacts.insert_one(contact)
    return contact


@pytest.fixture
def test_jwt_token(test_user) -> str:
    """
    Fixture: Token JWT de teste
    
    Gera um token válido para o usuário de teste.
    """
    from app.core.security import create_access_token
    
    token = create_access_token(data={"sub": test_user["_id"]})
    return token


@pytest.fixture
def test_professional_jwt_token(test_professional) -> str:
    """
    Fixture: Token JWT de teste para profissional
    
    Gera um token válido para o profissional de teste.
    """
    from app.core.security import create_access_token
    
    token = create_access_token(data={"sub": test_professional["_id"]})
    return token


# ==================== FIXTURES DE CONFIGURAÇÃO ====================

@pytest.fixture
async def test_credit_package(db) -> Dict[str, Any]:
    """
    Fixture: Pacote de créditos de teste
    """
    from ulid import new as new_ulid
    
    package_id = str(new_ulid())
    package = {
        "_id": package_id,
        "name": "Pacote Teste",
        "credits": 10,
        "bonus_credits": 2,
        "price": 50.00,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.credit_packages.insert_one(package)
    return package


@pytest.fixture
async def test_plan(db) -> Dict[str, Any]:
    """
    Fixture: Plano de assinatura de teste
    """
    from ulid import new as new_ulid
    
    plan_id = str(new_ulid())
    plan = {
        "_id": plan_id,
        "name": "Plano Teste",
        "weekly_credits": 10,
        "monthly_price": 99.90,
        "is_active": True,
        "features": ["Feature 1", "Feature 2"],
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.plan_configs.insert_one(plan)
    return plan


# ==================== MARKERS DE TESTE ====================

def pytest_configure(config):
    """Configurar markers customizados"""
    config.addinivalue_line("markers", "unit: Unit tests with mocks")
    config.addinivalue_line("markers", "integration: Integration tests with real database")
    config.addinivalue_line("markers", "e2e: End-to-end tests with full application")
    config.addinivalue_line("markers", "slow: Slow running tests")
