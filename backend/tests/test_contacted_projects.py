import pytest
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.main import app
from bson import ObjectId

client = TestClient(app)

class FakeUser:
    def __init__(self, id="user123", roles=None):
        self.id = id
        self.roles = roles or []

@pytest.fixture(autouse=True)
def clear_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_non_professional_forbidden():
    async def override_user():
        return FakeUser(id="user1", roles=["client"]) 

    app.dependency_overrides[__import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user

    response = client.get("/api/professional/contacted-projects")
    assert response.status_code == 403


def test_no_contacts_returns_empty():
    async def override_user():
        return FakeUser(id="user123", roles=["professional"]) 

    class FakeContacts:
        async def distinct(self, field, filter):
            return []

    class FakeDB:
        def __init__(self):
            self.contacts = FakeContacts()
            self.projects = None

    async def override_db():
        return FakeDB()

    app.dependency_overrides[__import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user
    app.dependency_overrides[__import__("app.core.database", fromlist=["get_database"]).get_database] = override_db

    response = client.get("/api/professional/contacted-projects")
    assert response.status_code == 200
    assert response.json() == []


def test_returns_only_contacted_and_allowed():
    user_id = "user123"

    async def override_user():
        return FakeUser(id=user_id, roles=["professional"]) 

    # prepare fake project documents
    p1 = {"_id": "p1", "title": "Project 1"}  # no professional_id -> should be included
    p2_oid = ObjectId("507f1f77bcf86cd799439011")
    p2 = {"_id": p2_oid, "title": "Project 2", "professional_id": user_id}  # assigned to user -> include
    p3 = {"_id": "p3", "title": "Project 3", "professional_id": "other"}  # assigned to other -> exclude

    project_list = [p1, p2, p3]

    class FakeContacts:
        async def distinct(self, field, filter):
            # return ids as strings (mix of string and ObjectId string)
            return ["p1", str(p2_oid), "p3"]

    class FakeCursor:
        def __init__(self, items):
            self._items = items
        def skip(self, n):
            return self
        def limit(self, l):
            return self
        async def __aiter__(self):
            for x in self._items:
                yield x

    class FakeProjects:
        def __init__(self, projects):
            self._projects = projects
        def find(self, query):
            # emulate DB filtering based on query
            allowed_raw = query.get("_id", {}).get("$in", [])
            allowed = set(str(x) for x in allowed_raw)
            user = user_id
            results = []
            for p in self._projects:
                if str(p["_id"]) not in allowed:
                    continue
                prof = p.get("professional_id")
                if prof is None or prof == "" or prof == user:
                    results.append(p.copy())
            return FakeCursor(results)

    class FakeDB:
        def __init__(self):
            self.contacts = FakeContacts()
            self.projects = FakeProjects(project_list)

    async def override_db():
        return FakeDB()

    app.dependency_overrides[__import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user
    app.dependency_overrides[__import__("app.core.database", fromlist=["get_database"]).get_database] = override_db

    response = client.get("/api/professional/contacted-projects")
    assert response.status_code == 200
    data = response.json()
    # expect two projects: p1 and p2
    ids = set([item["_id"] for item in data])
    assert "p1" in ids
    assert str(p2_oid) in ids
    assert "p3" not in ids


def test_pagination_behaviour():
    user_id = "user123"

    async def override_user():
        return FakeUser(id=user_id, roles=["professional"]) 

    # create 3 projects that match
    pks = [f"p{i}" for i in range(1, 5)]
    projects = [{"_id": pk, "title": f"Project {pk}"} for pk in pks]

    class FakeContacts:
        async def distinct(self, field, filter):
            return pks

    class FakeCursor:
        def __init__(self, items):
            self._items = items
        def skip(self, n):
            return self
        def limit(self, l):
            return self
        async def __aiter__(self):
            for x in self._items:
                yield x

    class FakeProjects:
        def find(self, query):
            # return all projects in the allowed set
            allowed_raw = query.get("_id", {}).get("$in", [])
            allowed = set(str(x) for x in allowed_raw)
            results = [p for p in projects if str(p["_id"]) in allowed]
            return FakeCursor(results)

    class FakeDB:
        def __init__(self):
            self.contacts = FakeContacts()
            self.projects = FakeProjects()

    async def override_db():
        return FakeDB()

    app.dependency_overrides[__import__("app.core.security", fromlist=["get_current_user"]).get_current_user] = override_user
    app.dependency_overrides[__import__("app.core.database", fromlist=["get_database"]).get_database] = override_db

    # skip=1, limit=1 -> should return a single project (the second)
    response = client.get("/api/professional/contacted-projects?skip=1&limit=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
