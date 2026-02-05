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
# Prioridade: MONGODB_URL > TEST_MONGODB_URL > localhost
if "MONGODB_URL" not in os.environ:
    os.environ["MONGODB_URL"] = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")

# Prioridade: DATABASE_NAME > MONGODB_DB_NAME > TEST_MONGODB_DB_NAME > agapp_test  
if "MONGODB_DB_NAME" not in os.environ:
    os.environ["MONGODB_DB_NAME"] = os.getenv("DATABASE_NAME", os.getenv("TEST_MONGODB_DB_NAME", "agapp_test"))

os.environ["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
os.environ["PAYMENT_TEST_MODE"] = "true"


# ==================== FIXTURES DE SETUP ====================

@pytest.fixture(scope="session")
def event_loop():
    """Criar event loop para toda a sessão de testes e registrá-lo como corrente"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    # Registrar como loop corrente para compatibilidade com código que usa
    # `asyncio.get_event_loop()` diretamente.
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()
    # Limpar referência ao loop corrente
    asyncio.set_event_loop(None)


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
def client(db, event_loop):
    """
    Fixture: Cliente HTTP de teste do FastAPI que utiliza o banco de testes `db`.

    Substitui a dependência `get_database` no app para retornar a instância de teste.
    """
    from app.main import app
    from app.core.database import get_database as _get_database

    # Override para que endpoints usem o banco de teste `db`
    import asyncio as _asyncio

    # Criar proxy thread-safe do db para ser usado no TestClient (que roda em outro loop)
    class _CursorProxy:
        def __init__(self, coll, loop, query=None):
            self._coll = coll
            self._loop = loop
            self._query = query or {}
            self._skip = 0
            self._limit = None
        def skip(self, n):
            self._skip = int(n)
            return self
        def limit(self, l):
            self._limit = int(l)
            return self
        async def __aiter__(self):
            # Executar to_list no loop de teste e iterar sobre o resultado
            fut = _asyncio.run_coroutine_threadsafe(self._coll.find(self._query).to_list(length=None), self._loop)
            results = fut.result()
            # Aplicar skip/limit localmente
            items = results[self._skip:]
            if self._limit is not None:
                items = items[:self._limit]
            for it in items:
                yield it

    class _CollectionProxy:
        def __init__(self, coll, loop):
            self._coll = coll
            self._loop = loop
        def find(self, query=None):
            return _CursorProxy(self._coll, self._loop, query=query or {})
        def find_one(self, *args, **kwargs):
            async def _inner():
                return await self._coll.find_one(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()
        def count_documents(self, *args, **kwargs):
            async def _inner():
                return await self._coll.count_documents(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()
        def insert_one(self, *args, **kwargs):
            async def _inner():
                return await self._coll.insert_one(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()
        def update_one(self, *args, **kwargs):
            async def _inner():
                return await self._coll.update_one(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()
        def delete_one(self, *args, **kwargs):
            async def _inner():
                return await self._coll.delete_one(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()
        def insert_many(self, *args, **kwargs):
            async def _inner():
                return await self._coll.insert_many(*args, **kwargs)
            fut = _asyncio.run_coroutine_threadsafe(_inner(), self._loop)
            return fut.result()

    class _DBProxy:
        def __init__(self, db, loop):
            self._db = db
            self._loop = loop
            # Mapear coleções usadas frequentemente
            self.users = _CollectionProxy(db.users, loop)
            self.projects = _CollectionProxy(db.projects, loop)
            self.contacts = _CollectionProxy(db.contacts, loop)
            self.subscriptions = _CollectionProxy(db.subscriptions, loop)
            # Coleções opcionais
            if hasattr(db, 'credit_transactions'):
                self.credit_transactions = _CollectionProxy(db.credit_transactions, loop)

    app.dependency_overrides[_get_database] = lambda: _DBProxy(db, event_loop)

    # Se estiver em ambiente de teste com o mock do Firebase disponível, aplicar para que
    # chamadas FCM sejam roteadas para o mock (garante que notificações sejam capturadas).
    try:
        import tests.mocks.firebase_mock as mock_fb
        import app.core.firebase as firebase_mod
        firebase_mod.messaging.send = mock_fb.send
        firebase_mod.messaging.send_multicast = mock_fb.send_multicast
        firebase_mod._firebase_app = "mock"
    except Exception:
        # não bloquear se não puder aplicar o mock
        pass

    with TestClient(app) as test_client:
        yield test_client

    # Limpar overrides após o teste
    app.dependency_overrides.clear()


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
