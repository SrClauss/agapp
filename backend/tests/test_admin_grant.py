import pytest
from types import SimpleNamespace
from fastapi import HTTPException

from app.api.endpoints import admin_api


@pytest.mark.asyncio
async def test_grant_plan_to_user_success(monkeypatch):
    # Fake plan returned by config_crud
    fake_plan = SimpleNamespace(id="plan-1", name="FreePlan", weekly_credits=10, monthly_price=0.0)

    async def fake_get_plan_config(db, plan_id):
        assert plan_id == "plan-1"
        return fake_plan

    async def fake_create_subscription(db, subscription_create, user_id):
        # Return a dict-like subscription
        return {"id": "sub-1", "user_id": user_id, "plan_name": subscription_create.plan_name, "credits": subscription_create.credits, "price": subscription_create.price, "status": "active"}

    monkeypatch.setattr(admin_api, "config_crud", SimpleNamespace(get_plan_config=fake_get_plan_config))
    monkeypatch.setattr(admin_api, "create_subscription", fake_create_subscription)

    payload = {"plan_id": "plan-1"}
    current_user = SimpleNamespace(roles=["admin"])  # not used but required
    res = await admin_api.grant_plan_to_user("user-123", payload, current_user=current_user, db=None)

    assert res["user_id"] == "user-123"
    assert res["plan_name"] == "FreePlan"
    assert res["credits"] == 10


@pytest.mark.asyncio
async def test_grant_plan_to_user_requires_free(monkeypatch):
    fake_plan = SimpleNamespace(id="plan-2", name="PaidPlan", weekly_credits=20, monthly_price=29.9)

    async def fake_get_plan_config(db, plan_id):
        return fake_plan

    monkeypatch.setattr(admin_api, "config_crud", SimpleNamespace(get_plan_config=fake_get_plan_config))

    payload = {"plan_id": "plan-2"}
    current_user = SimpleNamespace(roles=["admin"])

    with pytest.raises(HTTPException) as exc:
        await admin_api.grant_plan_to_user("user-123", payload, current_user=current_user, db=None)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_grant_package_to_user_adds_credits_or_creates_subscription(monkeypatch):
    fake_pkg = SimpleNamespace(id="pkg-1", name="FreePkg", credits=5, bonus_credits=1, price=0.0)

    async def fake_get_credit_package(db, package_id):
        assert package_id == "pkg-1"
        return fake_pkg

    # Simulate no active subscription => add_credits_to_user returns None, create_subscription is called
    async def fake_add_credits_to_user(db, user_id, credits):
        return None

    async def fake_create_subscription(db, subscription_create, user_id):
        return {"id": "sub-2", "user_id": user_id, "plan_name": subscription_create.plan_name, "credits": subscription_create.credits, "price": subscription_create.price, "status": "active"}

    monkeypatch.setattr(admin_api, "config_crud", SimpleNamespace(get_credit_package=fake_get_credit_package))
    monkeypatch.setattr(admin_api, "add_credits_to_user", fake_add_credits_to_user)
    monkeypatch.setattr(admin_api, "create_subscription", fake_create_subscription)

    payload = {"package_id": "pkg-1"}
    current_user = SimpleNamespace(roles=["admin"])

    res = await admin_api.grant_package_to_user("user-456", payload, current_user=current_user, db=None)

    assert res["user_id"] == "user-456"
    assert res["credits"] == 6  # 5 + 1 bonus
