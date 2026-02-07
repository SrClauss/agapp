"""
Tests for credit refund system when projects are deleted.

Tests cover:
- Refunding credits when a client deletes a project
- Refunding credits when admin deletes a project
- Handling projects with no contacts (no refunds needed)
- Handling projects with multiple contacts (multiple refunds)
- Verifying transaction records are created correctly
- Verifying final credit balances are correct
"""

import pytest
from datetime import datetime, timezone, timedelta
from ulid import new as new_ulid


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project_with_no_contacts_no_refunds(db):
    """
    Test that deleting a project with no contacts doesn't create any refund transactions
    """
    from app.crud.project import delete_project
    
    # Create a project with no contacts
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "contacts": []  # No contacts
    }
    await db.projects.insert_one(project)
    
    # Count transactions before deletion
    tx_count_before = await db.credit_transactions.count_documents({})
    
    # Delete project
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify project was deleted
    deleted_project = await db.projects.find_one({"_id": project_id})
    assert deleted_project is None
    
    # Verify no new transactions were created
    tx_count_after = await db.credit_transactions.count_documents({})
    assert tx_count_after == tx_count_before


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project_with_single_contact_refunds_credits(db):
    """
    Test that deleting a project with one contact refunds credits to the professional
    """
    from app.crud.project import delete_project
    
    # Create a professional user
    prof_id = str(new_ulid())
    professional = {
        "_id": prof_id,
        "email": "prof@test.com",
        "full_name": "Test Professional",
        "roles": ["professional"],
        "credits": 5,  # Initial credits after spending some
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(professional)
    
    # Create a project with one contact
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": prof_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 3,  # Professional spent 3 credits
                "status": "pending",
                "contact_details": {"message": "I'm interested"},
                "created_at": datetime.now(timezone.utc)
            }
        ],
        "liberado_por": [prof_id]
    }
    await db.projects.insert_one(project)
    
    # Delete project
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify project was deleted
    deleted_project = await db.projects.find_one({"_id": project_id})
    assert deleted_project is None
    
    # Verify professional's credits were refunded
    updated_prof = await db.users.find_one({"_id": prof_id})
    assert updated_prof["credits"] == 8  # 5 + 3 refunded
    
    # Verify refund transaction was created
    refund_tx = await db.credit_transactions.find_one({
        "user_id": prof_id,
        "type": "refund",
        "metadata.project_id": project_id
    })
    assert refund_tx is not None
    assert refund_tx["credits"] == 3
    assert refund_tx["transaction_type"] == "refund"
    assert refund_tx["metadata"]["reason"] == "project_deleted"
    assert refund_tx["metadata"]["original_credits_used"] == 3


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project_with_multiple_contacts_refunds_all(db):
    """
    Test that deleting a project with multiple contacts refunds credits to all professionals
    """
    from app.crud.project import delete_project
    
    # Create three professional users
    prof1_id = str(new_ulid())
    prof2_id = str(new_ulid())
    prof3_id = str(new_ulid())
    
    professionals = [
        {
            "_id": prof1_id,
            "email": "prof1@test.com",
            "full_name": "Professional 1",
            "roles": ["professional"],
            "credits": 7,  # After spending 3 credits
            "created_at": datetime.now(timezone.utc)
        },
        {
            "_id": prof2_id,
            "email": "prof2@test.com",
            "full_name": "Professional 2",
            "roles": ["professional"],
            "credits": 8,  # After spending 2 credits
            "created_at": datetime.now(timezone.utc)
        },
        {
            "_id": prof3_id,
            "email": "prof3@test.com",
            "full_name": "Professional 3",
            "roles": ["professional"],
            "credits": 9,  # After spending 1 credit
            "created_at": datetime.now(timezone.utc)
        }
    ]
    await db.users.insert_many(professionals)
    
    # Create a project with three contacts
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": prof1_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 3,
                "status": "pending",
                "contact_details": {"message": "I'm interested"},
                "created_at": datetime.now(timezone.utc)
            },
            {
                "professional_id": prof2_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 2,
                "status": "pending",
                "contact_details": {"message": "I can help"},
                "created_at": datetime.now(timezone.utc)
            },
            {
                "professional_id": prof3_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 1,
                "status": "pending",
                "contact_details": {"message": "Available"},
                "created_at": datetime.now(timezone.utc)
            }
        ],
        "liberado_por": [prof1_id, prof2_id, prof3_id]
    }
    await db.projects.insert_one(project)
    
    # Delete project
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify project was deleted
    deleted_project = await db.projects.find_one({"_id": project_id})
    assert deleted_project is None
    
    # Verify all professionals' credits were refunded
    prof1 = await db.users.find_one({"_id": prof1_id})
    prof2 = await db.users.find_one({"_id": prof2_id})
    prof3 = await db.users.find_one({"_id": prof3_id})
    
    assert prof1["credits"] == 10  # 7 + 3
    assert prof2["credits"] == 10  # 8 + 2
    assert prof3["credits"] == 10  # 9 + 1
    
    # Verify all refund transactions were created
    refund_txs = []
    async for tx in db.credit_transactions.find({"type": "refund", "metadata.project_id": project_id}):
        refund_txs.append(tx)
    
    assert len(refund_txs) == 3
    
    # Verify individual transactions
    prof1_tx = next((tx for tx in refund_txs if tx["user_id"] == prof1_id), None)
    prof2_tx = next((tx for tx in refund_txs if tx["user_id"] == prof2_id), None)
    prof3_tx = next((tx for tx in refund_txs if tx["user_id"] == prof3_id), None)
    
    assert prof1_tx["credits"] == 3
    assert prof2_tx["credits"] == 2
    assert prof3_tx["credits"] == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project_without_refund_flag(db):
    """
    Test that delete_project with refund_credits=False skips refunds
    """
    from app.crud.project import delete_project
    
    # Create a professional user
    prof_id = str(new_ulid())
    professional = {
        "_id": prof_id,
        "email": "prof@test.com",
        "full_name": "Test Professional",
        "roles": ["professional"],
        "credits": 5,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(professional)
    
    # Create a project with one contact
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": prof_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 3,
                "status": "pending",
                "contact_details": {"message": "I'm interested"},
                "created_at": datetime.now(timezone.utc)
            }
        ]
    }
    await db.projects.insert_one(project)
    
    # Delete project WITHOUT refunding
    result = await delete_project(db, project_id, refund_credits=False)
    assert result is True
    
    # Verify project was deleted
    deleted_project = await db.projects.find_one({"_id": project_id})
    assert deleted_project is None
    
    # Verify professional's credits were NOT refunded
    updated_prof = await db.users.find_one({"_id": prof_id})
    assert updated_prof["credits"] == 5  # Unchanged
    
    # Verify no refund transaction was created
    refund_tx = await db.credit_transactions.find_one({
        "user_id": prof_id,
        "type": "refund",
        "metadata.project_id": project_id
    })
    assert refund_tx is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_nonexistent_project_returns_false(db):
    """
    Test that deleting a non-existent project returns False
    """
    from app.crud.project import delete_project
    
    # Try to delete a project that doesn't exist
    result = await delete_project(db, "nonexistent_project_id")
    assert result is False


@pytest.mark.integration
@pytest.mark.asyncio
async def test_refund_ignores_contacts_with_zero_credits(db):
    """
    Test that refund logic ignores contacts where credits_used is 0 or missing
    """
    from app.crud.project import delete_project
    
    # Create a professional user
    prof_id = str(new_ulid())
    professional = {
        "_id": prof_id,
        "email": "prof@test.com",
        "full_name": "Test Professional",
        "roles": ["professional"],
        "credits": 10,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(professional)
    
    # Create a project with a contact that has 0 credits_used
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": prof_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 0,  # Zero credits - should not refund
                "status": "pending",
                "contact_details": {"message": "Free contact"},
                "created_at": datetime.now(timezone.utc)
            }
        ]
    }
    await db.projects.insert_one(project)
    
    # Delete project
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify professional's credits unchanged
    updated_prof = await db.users.find_one({"_id": prof_id})
    assert updated_prof["credits"] == 10
    
    # Verify no refund transaction was created
    refund_tx = await db.credit_transactions.find_one({
        "user_id": prof_id,
        "type": "refund"
    })
    assert refund_tx is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_refund_handles_missing_professional_gracefully(db):
    """
    Test that refund logic handles missing professionals without failing.
    When a professional doesn't exist, the refund should be skipped and no transaction created.
    """
    from app.crud.project import delete_project
    
    # Create a project with a contact referencing a non-existent professional
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": "nonexistent_prof_id",
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 3,
                "status": "pending",
                "contact_details": {"message": "I'm interested"},
                "created_at": datetime.now(timezone.utc)
            }
        ]
    }
    await db.projects.insert_one(project)
    
    # Delete project - should not fail even though professional doesn't exist
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify project was deleted
    deleted_project = await db.projects.find_one({"_id": project_id})
    assert deleted_project is None
    
    # Verify no refund transaction was created (professional doesn't exist)
    refund_tx = await db.credit_transactions.find_one({
        "user_id": "nonexistent_prof_id",
        "type": "refund"
    })
    # Based on implementation, refund is skipped when user doesn't exist
    assert refund_tx is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_refund_transaction_records_correct_metadata(db):
    """
    Test that refund transactions contain all required metadata
    """
    from app.crud.project import delete_project
    
    # Create a professional user
    prof_id = str(new_ulid())
    professional = {
        "_id": prof_id,
        "email": "prof@test.com",
        "full_name": "Test Professional",
        "roles": ["professional"],
        "credits": 5,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(professional)
    
    # Create a project with one contact
    project_id = str(new_ulid())
    project = {
        "_id": project_id,
        "client_id": "client1",
        "title": "Test Project",
        "description": "Test description",
        "category": {"main": "Tech", "sub": "Dev"},
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "contacts": [
            {
                "professional_id": prof_id,
                "client_id": "client1",
                "contact_type": "proposal",
                "credits_used": 3,
                "status": "pending",
                "contact_details": {"message": "I'm interested"},
                "created_at": datetime.now(timezone.utc)
            }
        ]
    }
    await db.projects.insert_one(project)
    
    # Delete project
    result = await delete_project(db, project_id)
    assert result is True
    
    # Verify refund transaction has correct metadata
    refund_tx = await db.credit_transactions.find_one({
        "user_id": prof_id,
        "type": "refund"
    })
    assert refund_tx is not None
    assert refund_tx["credits"] == 3
    assert refund_tx["transaction_type"] == "refund"
    assert refund_tx["status"] == "completed"
    assert "metadata" in refund_tx
    assert refund_tx["metadata"]["project_id"] == project_id
    assert refund_tx["metadata"]["reason"] == "project_deleted"
    assert refund_tx["metadata"]["original_credits_used"] == 3
    assert "created_at" in refund_tx
