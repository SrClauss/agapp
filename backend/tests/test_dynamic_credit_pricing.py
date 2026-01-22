"""
Tests for dynamic credit pricing system.

Tests cover:
- 3/2/1 credit pricing based on project age
- Pricing for projects with existing contacts
- Atomic locking to prevent race conditions
- Transaction recording
"""

import pytest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace


@pytest.mark.asyncio
async def test_new_project_0_24h_costs_3_credits():
    """Test that a brand new project (0-24h) costs 3 credits"""
    from app.utils.credit_pricing import calculate_contact_cost
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=12)
            }
    
    class MockContacts:
        def find(self, query):
            class FakeCursor:
                async def to_list(self, length):
                    return []
            return FakeCursor()
    
    db = SimpleNamespace(projects=MockProjects(), contacts=MockContacts())
    
    credits, reason = await calculate_contact_cost(db, "project1", "prof1")
    
    assert credits == 3
    assert reason == "new_project_0_24h"


@pytest.mark.asyncio
async def test_new_project_24_36h_costs_2_credits():
    """Test that a project 24-36h old costs 2 credits"""
    from app.utils.credit_pricing import calculate_contact_cost
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=30)
            }
    
    class MockContacts:
        def find(self, query):
            class FakeCursor:
                async def to_list(self, length):
                    return []
            return FakeCursor()
    
    db = SimpleNamespace(projects=MockProjects(), contacts=MockContacts())
    
    credits, reason = await calculate_contact_cost(db, "project1", "prof1")
    
    assert credits == 2
    assert reason == "new_project_24_36h"


@pytest.mark.asyncio
async def test_new_project_36h_plus_costs_1_credit():
    """Test that a project older than 36h costs 1 credit"""
    from app.utils.credit_pricing import calculate_contact_cost
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=48)
            }
    
    class MockContacts:
        def find(self, query):
            class FakeCursor:
                async def to_list(self, length):
                    return []
            return FakeCursor()
    
    db = SimpleNamespace(projects=MockProjects(), contacts=MockContacts())
    
    credits, reason = await calculate_contact_cost(db, "project1", "prof1")
    
    assert credits == 1
    assert reason == "new_project_36h_plus"


@pytest.mark.asyncio
async def test_contacted_project_within_24h_costs_2_credits():
    """Test that a project with existing contact within 24h costs 2 credits"""
    from app.utils.credit_pricing import calculate_contact_cost
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=10)
            }
    
    class MockContacts:
        def find(self, query):
            class FakeCursor:
                async def to_list(self, length):
                    # Return one existing contact created 12 hours ago
                    return [{
                        "_id": "contact1",
                        "professional_id": "other_prof",
                        "created_at": datetime.now(timezone.utc) - timedelta(hours=12)
                    }]
            return FakeCursor()
    
    db = SimpleNamespace(projects=MockProjects(), contacts=MockContacts())
    
    credits, reason = await calculate_contact_cost(db, "project1", "prof1")
    
    assert credits == 2
    assert reason == "contacted_project_0_24h_after_first"


@pytest.mark.asyncio
async def test_contacted_project_after_24h_costs_1_credit():
    """Test that a project with existing contact older than 24h costs 1 credit"""
    from app.utils.credit_pricing import calculate_contact_cost
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=40)
            }
    
    class MockContacts:
        def find(self, query):
            class FakeCursor:
                async def to_list(self, length):
                    # Return one existing contact created 30 hours ago
                    return [{
                        "_id": "contact1",
                        "professional_id": "other_prof",
                        "created_at": datetime.now(timezone.utc) - timedelta(hours=30)
                    }]
            return FakeCursor()
    
    db = SimpleNamespace(projects=MockProjects(), contacts=MockContacts())
    
    credits, reason = await calculate_contact_cost(db, "project1", "prof1")
    
    assert credits == 1
    assert reason == "contacted_project_24h_plus_after_first"


@pytest.mark.asyncio
async def test_validate_and_deduct_credits_success():
    """Test successful credit deduction with atomic locking"""
    from app.utils.credit_pricing import validate_and_deduct_credits
    
    # Mock successful update
    class MockSubscriptions:
        async def find_one_and_update(self, query, update, **kwargs):
            # Simulate successful atomic update
            return {
                "_id": "sub1",
                "user_id": "user1",
                "credits": 7  # After deducting 3 from 10
            }
    
    db = SimpleNamespace(subscriptions=MockSubscriptions())
    
    success, error = await validate_and_deduct_credits(db, "user1", 3)
    
    assert success is True
    assert error is None


@pytest.mark.asyncio
async def test_validate_and_deduct_credits_insufficient():
    """Test insufficient credits scenario"""
    from app.utils.credit_pricing import validate_and_deduct_credits
    
    # Mock failed update due to insufficient credits
    class MockSubscriptions:
        async def find_one_and_update(self, query, update, **kwargs):
            # Return None to indicate update failed
            return None
        
        async def find_one(self, query):
            # Return subscription with insufficient credits
            return {
                "_id": "sub1",
                "user_id": "user1",
                "credits": 1
            }
    
    db = SimpleNamespace(subscriptions=MockSubscriptions())
    
    success, error = await validate_and_deduct_credits(db, "user1", 3)
    
    assert success is False
    assert "Insufficient credits" in error


@pytest.mark.asyncio
async def test_validate_and_deduct_credits_no_subscription():
    """Test no subscription scenario"""
    from app.utils.credit_pricing import validate_and_deduct_credits
    
    # Mock no subscription
    class MockSubscriptions:
        async def find_one_and_update(self, query, update, **kwargs):
            return None
        
        async def find_one(self, query):
            return None
    
    db = SimpleNamespace(subscriptions=MockSubscriptions())
    
    success, error = await validate_and_deduct_credits(db, "user1", 3)
    
    assert success is False
    assert error == "No active subscription"


@pytest.mark.asyncio
async def test_record_credit_transaction():
    """Test credit transaction recording"""
    from app.utils.credit_pricing import record_credit_transaction
    
    inserted_doc = None
    
    class MockTransactions:
        async def insert_one(self, doc):
            nonlocal inserted_doc
            inserted_doc = doc
    
    db = SimpleNamespace(credit_transactions=MockTransactions())
    
    tx_id = await record_credit_transaction(
        db,
        user_id="user1",
        credits=-3,
        transaction_type="contact",
        metadata={"project_id": "proj1", "pricing_reason": "new_project_0_24h"}
    )
    
    assert tx_id is not None
    assert inserted_doc is not None
    assert inserted_doc["user_id"] == "user1"
    assert inserted_doc["credits"] == -3
    assert inserted_doc["type"] == "contact"
    assert inserted_doc["metadata"]["project_id"] == "proj1"
    assert inserted_doc["metadata"]["pricing_reason"] == "new_project_0_24h"
