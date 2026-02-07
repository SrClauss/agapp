"""
Unit tests for credit refund system when projects are deleted (using mocks).

These tests use mocks instead of a real database to ensure they run quickly
and don't require MongoDB to be running.
"""

import pytest
from datetime import datetime, timezone
from types import SimpleNamespace


@pytest.mark.asyncio
async def test_refund_credits_for_project_with_no_contacts():
    """
    Test that refund_credits_for_project returns 0 when project has no contacts
    """
    from app.crud.project import refund_credits_for_project
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "contacts": []  # No contacts
            }
    
    db = SimpleNamespace(projects=MockProjects())
    
    refund_count = await refund_credits_for_project(db, "project1")
    assert refund_count == 0


@pytest.mark.asyncio
async def test_refund_credits_for_project_with_one_contact():
    """
    Test that refund_credits_for_project refunds credits to one professional
    """
    from app.crud.project import refund_credits_for_project
    
    refunded_users = []
    
    class MockUsers:
        async def find_one(self, query):
            # Return user exists
            return {"_id": query["_id"], "credits": 5}
        
        async def find_one_and_update(self, query, update, return_document=None):
            refunded_users.append({
                "user_id": query["_id"],
                "credits_added": update["$inc"]["credits"]
            })
            return {"_id": query["_id"], "credits": 8}  # Simulate updated user
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "contacts": [
                    {
                        "professional_id": "prof1",
                        "credits_used": 3
                    }
                ]
            }
    
    class MockTransactions:
        async def insert_one(self, doc):
            return SimpleNamespace(inserted_id=doc.get('_id'))
    
    db = SimpleNamespace(
        projects=MockProjects(),
        users=MockUsers(),
        credit_transactions=MockTransactions()
    )
    
    refund_count = await refund_credits_for_project(db, "project1")
    
    assert refund_count == 1
    assert len(refunded_users) == 1
    assert refunded_users[0]["user_id"] == "prof1"
    assert refunded_users[0]["credits_added"] == 3


@pytest.mark.asyncio
async def test_refund_credits_for_project_with_multiple_contacts():
    """
    Test that refund_credits_for_project refunds credits to multiple professionals
    """
    from app.crud.project import refund_credits_for_project
    
    refunded_users = []
    
    class MockUsers:
        async def find_one(self, query):
            # Return user exists
            return {"_id": query["_id"], "credits": 5}
        
        async def find_one_and_update(self, query, update, return_document=None):
            refunded_users.append({
                "user_id": query["_id"],
                "credits_added": update["$inc"]["credits"]
            })
            return {"_id": query["_id"], "credits": 10}
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "contacts": [
                    {"professional_id": "prof1", "credits_used": 3},
                    {"professional_id": "prof2", "credits_used": 2},
                    {"professional_id": "prof3", "credits_used": 1}
                ]
            }
    
    class MockTransactions:
        async def insert_one(self, doc):
            return SimpleNamespace(inserted_id=doc.get('_id'))
    
    db = SimpleNamespace(
        projects=MockProjects(),
        users=MockUsers(),
        credit_transactions=MockTransactions()
    )
    
    refund_count = await refund_credits_for_project(db, "project1")
    
    assert refund_count == 3
    assert len(refunded_users) == 3
    
    # Verify all professionals were refunded
    assert refunded_users[0]["user_id"] == "prof1"
    assert refunded_users[0]["credits_added"] == 3
    assert refunded_users[1]["user_id"] == "prof2"
    assert refunded_users[1]["credits_added"] == 2
    assert refunded_users[2]["user_id"] == "prof3"
    assert refunded_users[2]["credits_added"] == 1


@pytest.mark.asyncio
async def test_refund_credits_skips_zero_credits():
    """
    Test that refund_credits_for_project skips contacts with 0 or negative credits
    """
    from app.crud.project import refund_credits_for_project
    
    refunded_users = []
    
    class MockUsers:
        async def find_one(self, query):
            # Return user exists
            return {"_id": query["_id"], "credits": 5}
        
        async def find_one_and_update(self, query, update, return_document=None):
            refunded_users.append(query["_id"])
            return {"_id": query["_id"], "credits": 10}
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "contacts": [
                    {"professional_id": "prof1", "credits_used": 3},
                    {"professional_id": "prof2", "credits_used": 0},  # Should be skipped
                    {"professional_id": "prof3", "credits_used": -1},  # Should be skipped
                ]
            }
    
    class MockTransactions:
        async def insert_one(self, doc):
            return SimpleNamespace(inserted_id=doc.get('_id'))
    
    db = SimpleNamespace(
        projects=MockProjects(),
        users=MockUsers(),
        credit_transactions=MockTransactions()
    )
    
    refund_count = await refund_credits_for_project(db, "project1")
    
    # Only prof1 should be refunded
    assert refund_count == 1
    assert len(refunded_users) == 1
    assert refunded_users[0] == "prof1"


@pytest.mark.asyncio
async def test_refund_credits_for_nonexistent_project():
    """
    Test that refund_credits_for_project returns 0 for non-existent project
    """
    from app.crud.project import refund_credits_for_project
    
    class MockProjects:
        async def find_one(self, query):
            return None  # Project not found
    
    db = SimpleNamespace(projects=MockProjects())
    
    refund_count = await refund_credits_for_project(db, "nonexistent")
    assert refund_count == 0


@pytest.mark.asyncio
async def test_delete_project_with_refund_flag_true():
    """
    Test that delete_project calls refund when refund_credits=True (default)
    """
    from app.crud.project import delete_project
    
    refund_called = []
    
    class MockProjects:
        async def find_one(self, query):
            return {
                "_id": "project1",
                "contacts": [{"professional_id": "prof1", "credits_used": 3}]
            }
        
        async def delete_one(self, query):
            return SimpleNamespace(deleted_count=1)
    
    class MockUsers:
        async def find_one(self, query):
            return {"_id": query["_id"], "credits": 5}
        
        async def find_one_and_update(self, query, update, return_document=None):
            refund_called.append(True)
            return {"_id": query["_id"], "credits": 8}
    
    class MockTransactions:
        async def insert_one(self, doc):
            return SimpleNamespace(inserted_id=doc.get('_id'))
    
    db = SimpleNamespace(
        projects=MockProjects(),
        users=MockUsers(),
        credit_transactions=MockTransactions()
    )
    
    result = await delete_project(db, "project1", refund_credits=True)
    
    assert result is True
    assert len(refund_called) == 1  # Refund was called


@pytest.mark.asyncio
async def test_delete_project_with_refund_flag_false():
    """
    Test that delete_project skips refund when refund_credits=False
    """
    from app.crud.project import delete_project
    
    refund_called = []
    
    class MockProjects:
        async def find_one(self, query):
            # Track that this was called (refund logic would call this)
            refund_called.append(True)
            return {"_id": "project1", "contacts": []}
        
        async def delete_one(self, query):
            return SimpleNamespace(deleted_count=1)
    
    db = SimpleNamespace(projects=MockProjects())
    
    result = await delete_project(db, "project1", refund_credits=False)
    
    assert result is True
    # Since refund_credits=False, find_one for refund should not be called
    assert len(refund_called) == 0


@pytest.mark.asyncio
async def test_delete_project_returns_false_when_not_found():
    """
    Test that delete_project returns False when project doesn't exist
    """
    from app.crud.project import delete_project
    
    class MockProjects:
        async def find_one(self, query):
            return None
        
        async def delete_one(self, query):
            return SimpleNamespace(deleted_count=0)
    
    db = SimpleNamespace(projects=MockProjects())
    
    result = await delete_project(db, "nonexistent", refund_credits=True)
    assert result is False
