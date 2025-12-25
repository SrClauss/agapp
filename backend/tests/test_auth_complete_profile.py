import pytest
import asyncio
from types import SimpleNamespace

from app.api.endpoints import auth as auth_module
from app.schemas.user import UserUpdate

@pytest.mark.asyncio
async def test_complete_profile_calls_firebase_and_updates_user(monkeypatch):
    called = {"firebase": False, "updated": False}

    async def fake_update_user(db, user_id, update_dict):
        called["updated"] = True
        return {"_id": user_id, **update_dict}

    def fake_create_or_update_firebase_user(email, password, display_name=None):
        called["firebase"] = True
        assert email == "test@example.com"
        assert password == "newsecret"
        return "firebase-uid"

    monkeypatch.setattr(auth_module, "update_user", fake_update_user)
    # patch firebase helper
    import app.core.firebase as firebase_mod
    monkeypatch.setattr(firebase_mod, "create_or_update_firebase_user", fake_create_or_update_firebase_user)

    profile = UserUpdate(password="newsecret", full_name="Nome Test")
    current_user = SimpleNamespace(id="user-1", email="test@example.com", full_name="Old Name")

    # Call handler
    res = await auth_module.complete_profile(profile, current_user=current_user, db=None)

    assert called["firebase"] is True
    assert called["updated"] is True
    assert res["_id"] == "user-1"
    assert res["is_profile_complete"] is True
