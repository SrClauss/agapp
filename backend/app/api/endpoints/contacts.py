"""
API endpoints for contacts management
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone
from ulid import new as new_ulid

from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.crud.project import get_project

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/history")
async def get_contact_history(
    user_type: str = "professional",
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get contact history for current user.
    Returns all contacts where user is either professional or client.
    """
    # Build query based on user type
    if user_type == "professional":
        # Get all projects where this user is a professional in contacts
        pipeline = [
            {"$match": {"contacts.professional_id": str(current_user.id)}},
            {"$unwind": "$contacts"},
            {"$match": {"contacts.professional_id": str(current_user.id)}},
            {"$project": {
                "id": {"$concat": [{"$toString": "$_id"}, "_", {"$toString": "$contacts.professional_id"}]},
                "project_id": {"$toString": "$_id"},
                "project_title": "$title",
                "professional_id": "$contacts.professional_id",
                "professional_name": "$contacts.professional_name",
                "client_id": "$contacts.client_id",
                "client_name": "$contacts.client_name",
                "contact_type": "$contacts.contact_type",
                "credits_used": "$contacts.credits_used",
                "status": "$contacts.status",
                "contact_details": "$contacts.contact_details",
                "chat": "$contacts.chats",
                "created_at": "$contacts.created_at",
                "updated_at": "$contacts.updated_at",
            }},
            {"$sort": {"updated_at": -1}}
        ]
    else:  # client
        # Get all projects owned by this client that have contacts
        pipeline = [
            {"$match": {"client_id": str(current_user.id), "contacts": {"$exists": True, "$ne": []}}},
            {"$unwind": "$contacts"},
            {"$project": {
                "id": {"$concat": [{"$toString": "$_id"}, "_", {"$toString": "$contacts.professional_id"}]},
                "project_id": {"$toString": "$_id"},
                "project_title": "$title",
                "professional_id": "$contacts.professional_id",
                "professional_name": "$contacts.professional_name",
                "client_id": "$contacts.client_id",
                "client_name": "$contacts.client_name",
                "contact_type": "$contacts.contact_type",
                "credits_used": "$contacts.credits_used",
                "status": "$contacts.status",
                "contact_details": "$contacts.contact_details",
                "chat": "$contacts.chats",
                "created_at": "$contacts.created_at",
                "updated_at": "$contacts.updated_at",
            }},
            {"$sort": {"updated_at": -1}}
        ]
    
    contacts = await db.projects.aggregate(pipeline).to_list(length=None)
    
    # Calculate unread count for each contact
    for contact in contacts:
        # Count messages where sender is not current user and read_at is None
        unread_count = 0
        if contact.get("chat"):
            for msg in contact["chat"]:
                if msg.get("sender_id") != str(current_user.id) and not msg.get("read_at"):
                    unread_count += 1
        contact["unread_count"] = unread_count
    
    return contacts


@router.get("/{contact_id}")
async def get_contact_details(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get specific contact details.
    Contact ID format: {project_id}_{professional_id}
    """
    # Parse contact_id to get project_id and professional_id
    parts = contact_id.rsplit("_", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    project_id, professional_id = parts
    
    # Get project
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find contact in project
    contact = None
    for c in project.contacts:
        if c.professional_id == professional_id:
            contact = c
            break
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Verify user is authorized (either professional or client)
    if str(current_user.id) not in [contact.professional_id, contact.client_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this contact")
    
    # Convert to dict
    contact_dict = contact.dict() if hasattr(contact, 'dict') else dict(contact)
    contact_dict["id"] = contact_id
    contact_dict["project_id"] = project_id
    contact_dict["project_title"] = project.title
    
    # Calculate unread count
    unread_count = 0
    if contact_dict.get("chat"):
        for msg in contact_dict["chat"]:
            if msg.get("sender_id") != str(current_user.id) and not msg.get("read_at"):
                unread_count += 1
    contact_dict["unread_count"] = unread_count
    
    return contact_dict


@router.post("/{contact_id}/messages")
async def send_contact_message(
    contact_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Send a message in a contact chat.
    Contact ID format: {project_id}_{professional_id}
    """
    content = body.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")
    
    # Parse contact_id
    parts = contact_id.rsplit("_", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    project_id, professional_id = parts
    
    # Get project
    project_doc = await db.projects.find_one({"_id": project_id})
    if not project_doc:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find contact index in project
    contact_index = None
    contact_data = None
    for i, c in enumerate(project_doc.get("contacts", [])):
        if c.get("professional_id") == professional_id:
            contact_index = i
            contact_data = c
            break
    
    if contact_index is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Verify user is authorized
    if str(current_user.id) not in [contact_data.get("professional_id"), contact_data.get("client_id")]:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this contact")
    
    # Create message
    message = {
        "id": str(new_ulid()),
        "sender_id": str(current_user.id),
        "content": content,
        "created_at": datetime.now(timezone.utc),
        "read_at": None
    }
    
    # Add message to contact chat
    result = await db.projects.update_one(
        {"_id": project_id, f"contacts.{contact_index}.professional_id": professional_id},
        {
            "$push": {f"contacts.{contact_index}.chats": message},
            "$set": {f"contacts.{contact_index}.updated_at": datetime.now(timezone.utc)}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to send message")
    
    # Send WebSocket notification (best-effort)
    try:
        from app.api.websockets.manager import manager
        
        # Determine recipient (the other party)
        recipient_id = contact_data.get("client_id") if str(current_user.id) == contact_data.get("professional_id") else contact_data.get("professional_id")
        
        payload = {
            "type": "new_message",
            "contact_id": contact_id,
            "message": {
                "id": message["id"],
                "sender_id": message["sender_id"],
                "content": message["content"],
                "created_at": message["created_at"].isoformat(),
            }
        }
        
        import json
        await manager.send_personal_message(json.dumps(payload), recipient_id)
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")
    
    return {"message": "Message sent successfully", "message_id": message["id"]}


@router.post("/{contact_id}/messages/mark-read")
async def mark_contact_messages_as_read(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Mark all unread messages in a contact as read.
    Contact ID format: {project_id}_{professional_id}
    """
    # Parse contact_id
    parts = contact_id.rsplit("_", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    project_id, professional_id = parts
    
    # Get project
    project_doc = await db.projects.find_one({"_id": project_id})
    if not project_doc:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find contact
    contact_data = None
    contact_index = None
    for i, c in enumerate(project_doc.get("contacts", [])):
        if c.get("professional_id") == professional_id:
            contact_data = c
            contact_index = i
            break
    
    if not contact_data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Verify user is authorized
    if str(current_user.id) not in [contact_data.get("professional_id"), contact_data.get("client_id")]:
        raise HTTPException(status_code=403, detail="Not authorized to mark messages in this contact")
    
    # Mark all messages from other user as read
    now = datetime.now(timezone.utc)
    
    # Update messages in the contact's chat array using two separate updates
    # MongoDB array filters don't support complex $or within the same filter object
    # First, mark messages where read_at is null
    result1 = await db.projects.update_one(
        {
            "_id": project_id,
            f"contacts.{contact_index}.professional_id": professional_id
        },
        {
            "$set": {
                f"contacts.{contact_index}.chats.$[msg].read_at": now
            }
        },
        array_filters=[
            {
                "msg.sender_id": {"$ne": str(current_user.id)},
                "msg.read_at": None
            }
        ]
    )
    
    # Then, mark messages where read_at doesn't exist
    result2 = await db.projects.update_one(
        {
            "_id": project_id,
            f"contacts.{contact_index}.professional_id": professional_id
        },
        {
            "$set": {
                f"contacts.{contact_index}.chats.$[msg].read_at": now
            }
        },
        array_filters=[
            {
                "msg.sender_id": {"$ne": str(current_user.id)},
                "msg.read_at": {"$exists": False}
            }
        ]
    )
    
    total_modified = result1.modified_count + result2.modified_count
    return {"message": "Messages marked as read", "modified_count": total_modified}
