"""
Tests for contacts API endpoints
"""
import pytest
from httpx import ASGITransport, AsyncClient
from datetime import datetime, timezone


@pytest.fixture
async def async_client(db):
    """Create async HTTP client for testing"""
    from app.main import app
    from app.core.database import get_database
    
    # Override database dependency
    app.dependency_overrides[get_database] = lambda: db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client
    
    # Clean up
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_contacts_history_endpoint_exists(async_client, test_professional, test_professional_jwt_token):
    """Test that /contacts/history endpoint exists and returns data"""
    response = await async_client.get(
        "/contacts/history",
        params={"user_type": "professional"},
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    # Should return 200 even if empty
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_contacts_get_contact_by_id(async_client, test_professional, test_project, test_professional_jwt_token, db):
    """Test getting a specific contact by ID"""
    # First create a contact
    from app.crud.project import create_contact_in_project
    
    project = await db.projects.find_one({"_id": test_project["_id"]})
    
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {"message": "I'm interested"}
    }
    
    await create_contact_in_project(
        db, 
        test_project["_id"], 
        contact_data, 
        test_professional["_id"], 
        project["client_id"],
        1
    )
    
    # Now try to get the contact
    contact_id = f"{test_project['_id']}_{test_professional['_id']}"
    response = await async_client.get(
        f"/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == contact_id
    assert data["project_id"] == test_project["_id"]
    assert data["professional_id"] == test_professional["_id"]


@pytest.mark.asyncio
async def test_send_message_in_contact(async_client, test_professional, test_project, test_professional_jwt_token, db):
    """Test sending a message in a contact"""
    # First create a contact
    from app.crud.project import create_contact_in_project
    
    project = await db.projects.find_one({"_id": test_project["_id"]})
    
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {"message": "I'm interested"}
    }
    
    await create_contact_in_project(
        db, 
        test_project["_id"], 
        contact_data, 
        test_professional["_id"], 
        project["client_id"],
        1
    )
    
    # Now send a message
    contact_id = f"{test_project['_id']}_{test_professional['_id']}"
    response = await async_client.post(
        f"/contacts/{contact_id}/messages",
        json={"content": "Hello from test"},
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "message_id" in data
    assert data["message"] == "Message sent successfully"


@pytest.mark.asyncio
async def test_mark_messages_as_read(async_client, test_professional, test_user, test_project, test_professional_jwt_token, test_jwt_token, db):
    """Test marking messages as read"""
    # First create a contact
    from app.crud.project import create_contact_in_project
    
    project = await db.projects.find_one({"_id": test_project["_id"]})
    
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {"message": "I'm interested"}
    }
    
    await create_contact_in_project(
        db, 
        test_project["_id"], 
        contact_data, 
        test_professional["_id"], 
        project["client_id"],
        1
    )
    
    # Professional sends a message
    contact_id = f"{test_project['_id']}_{test_professional['_id']}"
    await async_client.post(
        f"/contacts/{contact_id}/messages",
        json={"content": "Hello from professional"},
        headers={"Authorization": f"Bearer {test_professional_jwt_token}"}
    )
    
    # Client marks messages as read
    response = await async_client.post(
        f"/contacts/{contact_id}/messages/mark-read",
        headers={"Authorization": f"Bearer {test_jwt_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "message" in data


@pytest.mark.asyncio
async def test_idempotency_key_in_contact_creation(async_client, test_professional, test_project, test_professional_jwt_token, db):
    """Test that idempotency key prevents duplicate contact creation"""
    idempotency_key = f"test-key-{datetime.now(timezone.utc).timestamp()}"
    
    contact_data = {
        "contact_type": "proposal",
        "contact_details": {"message": "I'm interested"}
    }
    
    # Create contact first time
    response1 = await async_client.post(
        f"/projects/{test_project['_id']}/contacts",
        json=contact_data,
        headers={
            "Authorization": f"Bearer {test_professional_jwt_token}",
            "Idempotency-Key": idempotency_key
        }
    )
    
    assert response1.status_code == 200
    contact1 = response1.json()
    
    # Try to create again with same idempotency key
    response2 = await async_client.post(
        f"/projects/{test_project['_id']}/contacts",
        json=contact_data,
        headers={
            "Authorization": f"Bearer {test_professional_jwt_token}",
            "Idempotency-Key": idempotency_key
        }
    )
    
    assert response2.status_code == 200
    contact2 = response2.json()
    
    # Should return the same contact
    assert contact1["id"] == contact2["id"]
