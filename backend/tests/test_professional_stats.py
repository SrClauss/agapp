import pytest
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class FakeUser:
    def __init__(self, id="user123", roles=None, credits=0):
        self.id = id
        self.roles = roles or []
        self.credits = credits

@pytest.fixture(autouse=True)
def clear_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_non_professional_forbidden():
    async def override_user():
        return FakeUser(id="user1", roles=["client"], credits=0)
    app.dependency_overrides["app.core.security.get_current_user" if False else __import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user

    response = client.get("/api/professional/stats")
    assert response.status_code == 403


def test_professional_stats_returns_values(monkeypatch):
    async def override_user():
        return FakeUser(id="user123", roles=["professional"], credits=5)

    class FakeCollection:
        def __init__(self, count=0, find_one_result=None):
            self._count = count
            self._find_one = find_one_result
        async def count_documents(self, filter):
            return self._count
        async def find_one(self, filter):
            return self._find_one

    class FakeDB:
        def __init__(self):
            self.subscriptions = FakeCollection(count=1, find_one_result={"credits": 7})
            self.contacts = FakeCollection(count=3)
            self.projects = FakeCollection(count=4)

    async def override_db():
        return FakeDB()

    app.dependency_overrides[__import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user
    app.dependency_overrides[__import__("app.core.database", fromlist=["get_database"]).get_database] = override_db

    response = client.get("/api/professional/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["active_subscriptions"] == 1
    assert data["credits_available"] == 7
    assert data["contacts_received"] == 3
    assert data["projects_completed"] == 4
