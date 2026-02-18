"""
Contact management endpoints for professionals and clients to manage their conversations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from ulid import new as new_ulid

from app.core.database import get_database
from app.core.security import get_current_user
from app.schemas.user import User
from app.models.project import Contact
import logging

router = APIRouter(prefix="/contacts", tags=["contacts"])

@router.get("/history")
async def get_contact_history(
    user_type: str = Query("professional", regex="^(professional|client)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> List[Dict[str, Any]]:
    """
    Get contact history for the current user (either as professional or client).
    Returns all contacts with their chat messages.
    """
    user_id = str(current_user.id)
    
    # Determine query based on user type
    if user_type == "professional":
        if "professional" not in current_user.roles:
            raise HTTPException(status_code=403, detail="User is not a professional")
        query = {"contacts.professional_id": user_id}
    else:  # client
        if "client" not in current_user.roles:
            raise HTTPException(status_code=403, detail="User is not a client")
        query = {"contacts.client_id": user_id}
    
    # Find all projects with contacts for this user
    projects = []
    async for project in db.projects.find(query):
        # Filter contacts to only include those involving this user
        relevant_contacts = []
        for contact in project.get("contacts", []):
            is_participant = (
                str(contact.get("professional_id")) == user_id or
                str(contact.get("client_id")) == user_id
            )
            if is_participant:
                # Build contact ID from project_id and contact index
                contact_index = project["contacts"].index(contact)
                contact_dict = dict(contact)
                contact_dict["id"] = f"{project['_id']}_{contact_index}"
                contact_dict["project_id"] = str(project["_id"])
                contact_dict["project_title"] = project.get("title", "")
                
                # Calculate unread count for this user
                unread_count = 0
                for msg in contact.get("chat", []):
                    if str(msg.get("sender_id")) != user_id and not msg.get("read", False):
                        unread_count += 1
                contact_dict["unread_count"] = unread_count
                
                relevant_contacts.append(contact_dict)
        
        projects.extend(relevant_contacts)
    
    # Sort by most recent message
    projects.sort(
        key=lambda x: x.get("updated_at", x.get("created_at", datetime.min.replace(tzinfo=timezone.utc))), 
        reverse=True
    )
    
    return projects


@router.get("/{contact_id}")
async def get_contact_details(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Get details of a specific contact including chat messages.
    contact_id format: "{project_id}_{contact_index}"
    """
    # Parse contact_id
    try:
        parts = contact_id.rsplit("_", 1)
        if len(parts) != 2:
            raise ValueError("Invalid contact_id format")
        project_id, contact_index_str = parts
        contact_index = int(contact_index_str)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    # Find project
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get contact
    contacts = project.get("contacts", [])
    if contact_index < 0 or contact_index >= len(contacts):
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = contacts[contact_index]
    
    # Verify authorization
    user_id = str(current_user.id)
    is_participant = (
        str(contact.get("professional_id")) == user_id or
        str(contact.get("client_id")) == user_id
    )
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not authorized to view this contact")
    
    # Build response
    contact_dict = dict(contact)
    contact_dict["id"] = contact_id
    contact_dict["project_id"] = project_id
    contact_dict["project_title"] = project.get("title", "")
    
    return contact_dict


@router.post("/{contact_id}/messages")
async def send_contact_message(
    contact_id: str,
    body: Dict[str, str],
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Send a message in a contact chat.
    """
    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")
    
    # Parse contact_id
    try:
        parts = contact_id.rsplit("_", 1)
        if len(parts) != 2:
            raise ValueError("Invalid contact_id format")
        project_id, contact_index_str = parts
        contact_index = int(contact_index_str)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    # Find project
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get contact
    contacts = project.get("contacts", [])
    if contact_index < 0 or contact_index >= len(contacts):
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = contacts[contact_index]
    
    # Verify authorization
    user_id = str(current_user.id)
    is_participant = (
        str(contact.get("professional_id")) == user_id or
        str(contact.get("client_id")) == user_id
    )
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this contact")
    
    # Create message
    message = {
        "id": str(new_ulid()),
        "sender_id": user_id,
        "content": content,
        "created_at": datetime.now(timezone.utc),
        "read": False,  # New field for unread tracking
    }
    
    # Update project with new message
    update_path = f"contacts.{contact_index}.chat"
    result = await db.projects.update_one(
        {"_id": project_id},
        {
            "$push": {update_path: message},
            "$set": {
                f"contacts.{contact_index}.updated_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to send message")
    
    # Send WebSocket notification to the other participant
    try:
        from app.api.websockets.manager import manager
        from app.core.firebase import send_multicast_notification
        
        other_user_id = str(contact.get("client_id")) if user_id == str(contact.get("professional_id")) else str(contact.get("professional_id"))
        
        payload = {
            "type": "new_message",
            "contact_id": contact_id,
            "message": message,
            "project_id": project_id,
        }
        
        # Try WebSocket first
        sent_via_ws = await manager.send_personal_message(other_user_id, payload)
        
        # If user is offline, send push notification
        if not sent_via_ws:
            other_user = await db.users.find_one({"_id": other_user_id})
            if other_user and other_user.get("fcm_tokens"):
                fcm_tokens = [t["token"] for t in other_user["fcm_tokens"] if "token" in t]
                if fcm_tokens:
                    await send_multicast_notification(
                        fcm_tokens=fcm_tokens,
                        title=f"Nova mensagem de {current_user.full_name}",
                        body=content[:100],
                        data={"type": "new_message", "contact_id": contact_id, "project_id": project_id}
                    )
    except Exception as e:
        logging.warning(f"Failed to send notification for message: {e}")
    
    return {"message": "Message sent successfully", "message_id": message["id"]}


@router.post("/{contact_id}/messages/mark-read")
async def mark_contact_messages_as_read(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, str]:
    """
    Mark all messages from other user in this contact as read.
    """
    # Parse contact_id
    try:
        parts = contact_id.rsplit("_", 1)
        if len(parts) != 2:
            raise ValueError("Invalid contact_id format")
        project_id, contact_index_str = parts
        contact_index = int(contact_index_str)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid contact_id format")
    
    # Find project
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get contact
    contacts = project.get("contacts", [])
    if contact_index < 0 or contact_index >= len(contacts):
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = contacts[contact_index]
    
    # Verify authorization
    user_id = str(current_user.id)
    is_participant = (
        str(contact.get("professional_id")) == user_id or
        str(contact.get("client_id")) == user_id
    )
    if not is_participant:
        raise HTTPException(status_code=403, detail="Not authorized to mark messages as read")
    
    # Mark messages from other user as read
    chat = contact.get("chat", [])
    updated_chat = []
    for msg in chat:
        if str(msg.get("sender_id")) != user_id:
            msg["read"] = True
        updated_chat.append(msg)
    
    # Update project
    update_path = f"contacts.{contact_index}.chat"
    await db.projects.update_one(
        {"_id": project_id},
        {"$set": {update_path: updated_chat}}
    )
    
    return {"message": "Messages marked as read"}
