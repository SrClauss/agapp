from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.contact import get_contact, get_contacts_by_user, create_contact, update_contact, get_contacts, delete_contact
from app.crud.project import get_project
from app.schemas.contact import Contact, ContactCreate, ContactUpdate
from app.schemas.user import User
from app.utils.validators import validate_user_credits
from app.crud.subscription import get_user_subscription
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

router = APIRouter()

@router.get("/{project_id}/cost-preview")
async def preview_contact_cost(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Preview the credit cost for creating a contact on a project.
    Returns the number of credits that will be deducted and the pricing reason.
    """
    from app.utils.credit_pricing import calculate_contact_cost
    
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Ensure user is a professional
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only professionals can view contact costs")
    
    # Check if contact already exists
    existing_contact = await db.contacts.find_one({
        "project_id": project_id,
        "professional_id": str(current_user.id)
    })
    if existing_contact:
        return {
            "credits_cost": 0,
            "reason": "contact_already_exists",
            "message": "You already have a contact with this project"
        }
    
    # Calculate cost and get current balance from subscriptions
    from app.utils.credit_pricing import get_user_credits
    
    try:
        credits_cost, pricing_reason = await calculate_contact_cost(db, project_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Get current balance from subscriptions (single source of truth)
    current_balance = await get_user_credits(db, str(current_user.id))
    
    return {
        "credits_cost": credits_cost,
        "reason": pricing_reason,
        "current_balance": current_balance,
        "can_afford": current_balance >= credits_cost
    }

@router.post("/{project_id}", response_model=Contact, status_code=201)
async def create_contact_for_project(
    project_id: str,
    contact: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Professional creates contact to accept/propose for a project.
    Deducts credits based on dynamic pricing (3/2/1 credits depending on project age and history).
    Uses atomic locking to prevent race conditions.
    """
    from app.utils.credit_pricing import (
        calculate_contact_cost,
        validate_and_deduct_credits,
        record_credit_transaction
    )
    
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Ensure user is a professional
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only professionals can create contacts")
    
    # Check if contact already exists (with atomic check to prevent duplicates)
    existing_contact = await db.contacts.find_one({
        "project_id": project_id,
        "professional_id": str(current_user.id)
    })
    if existing_contact:
        raise HTTPException(status_code=400, detail="Contact already exists for this project")
    
    # Calculate dynamic credit cost
    try:
        credits_needed, pricing_reason = await calculate_contact_cost(db, project_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Atomically validate and deduct credits (with locking)
    success, error_msg = await validate_and_deduct_credits(db, str(current_user.id), credits_needed)
    if not success:
        raise HTTPException(status_code=400, detail=error_msg or "Insufficient credits")
    
    # Create contact with the actual credits used
    db_contact = await create_contact(db, contact, str(current_user.id), project_id, str(project.client_id), credits_needed)
    
    # Record the credit transaction
    await record_credit_transaction(
        db,
        user_id=str(current_user.id),
        credits=-credits_needed,
        transaction_type="contact",
        metadata={
            "project_id": project_id,
            "contact_id": str(db_contact.id),
            "pricing_reason": pricing_reason
        }
    )
    
    # Send push notification to client
    try:
        from app.core.firebase import send_multicast_notification
        client = await db.users.find_one({"_id": str(project.client_id)})
        if client and client.get("fcm_tokens"):
            fcm_tokens = [token_obj["token"] for token_obj in client["fcm_tokens"] if "token" in token_obj]
            if fcm_tokens:
                await send_multicast_notification(
                    fcm_tokens=fcm_tokens,
                    title="Nova Proposta Recebida",
                    body=f"{current_user.full_name} demonstrou interesse no seu projeto: {project.title}",
                    data={
                        "type": "new_contact",
                        "contact_id": str(db_contact.id),
                        "project_id": project_id,
                        "professional_id": str(current_user.id)
                    }
                )
    except Exception as e:
        print(f"Error sending push notification: {e}")
    
    return db_contact

@router.get("/history", response_model=List[Contact])
async def read_contact_history(
    user_type: str = "professional",
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Get contact history for current user.
    user_type: 'professional' or 'client'
    """
    contacts = await get_contacts_by_user(db, str(current_user.id), user_type)
    return contacts

@router.get("/{contact_id}", response_model=Contact)
async def get_contact_details(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """Get detailed information about a specific contact"""
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Check if user is involved in the contact
    if str(current_user.id) not in [str(contact.professional_id), str(contact.client_id)]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return contact

@router.post("/{contact_id}/messages", response_model=dict)
async def send_contact_message(
    contact_id: str,
    message: dict,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Send a message in a contact chat.
    This is a REST endpoint alternative to WebSocket for sending messages.
    """
    from ulid import new as new_ulid
    from datetime import datetime, timezone
    
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Check if user is involved in the contact
    if str(current_user.id) not in [str(contact.professional_id), str(contact.client_id)]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create message
    msg = {
        "id": str(new_ulid()),
        "sender_id": str(current_user.id),
        "content": message.get("content", ""),
        "created_at": datetime.now(timezone.utc),
    }
    
    # Add message to contact chat
    await db.contacts.update_one(
        {"_id": contact_id},
        {"$push": {"chat": msg}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    # Mark contact as "in_conversation" if it's the first user message
    from app.utils.contact_helpers import is_first_user_message
    contact_dict = await db.contacts.find_one({"_id": contact_id})
    if contact_dict:
        contact_messages = contact_dict.get("chat", [])
        if is_first_user_message(contact_messages):
            await db.contacts.update_one(
                {"_id": contact_id},
                {"$set": {"status": "in_conversation"}}
            )
    
    # Send push notification to the other party
    try:
        from app.core.firebase import send_multicast_notification
        recipient_id = str(contact.client_id) if str(current_user.id) == str(contact.professional_id) else str(contact.professional_id)
        recipient = await db.users.find_one({"_id": recipient_id})
        
        if recipient and recipient.get("fcm_tokens"):
            fcm_tokens = [token_obj["token"] for token_obj in recipient["fcm_tokens"] if "token" in token_obj]
            if fcm_tokens:
                await send_multicast_notification(
                    fcm_tokens=fcm_tokens,
                    title=f"Nova mensagem de {current_user.full_name}",
                    body=message.get("content", "")[:100],
                    data={
                        "type": "new_message",
                        "contact_id": contact_id,
                        "sender_id": str(current_user.id),
                        "message_id": msg["id"]
                    }
                )
    except Exception as e:
        print(f"Error sending push notification: {e}")
    
    return {"message": "Message sent successfully", "message_id": msg["id"]}

@router.put("/{contact_id}/status", response_model=Contact)
async def update_contact_status(
    contact_id: str,
    contact_update: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Check if user is involved in the contact
    if str(current_user.id) not in [str(contact.professional_id), str(contact.client_id)]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updated_contact = await update_contact(db, contact_id, contact_update)
    if not updated_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return updated_contact

# Admin endpoints
@router.get("/admin/", response_model=List[Contact])
async def read_contacts_admin(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Any = Depends(get_database)
):
    contacts = await get_contacts(db, skip=skip, limit=limit)
    return contacts

@router.get("/admin/{contact_id}", response_model=Contact)
async def read_contact_admin(
    contact_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Any = Depends(get_database)
):
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.put("/admin/{contact_id}", response_model=Contact)
async def update_contact_admin(
    contact_id: str,
    contact_update: ContactUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Any = Depends(get_database)
):
    contact = await update_contact(db, contact_id, contact_update)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.delete("/admin/{contact_id}")
async def delete_contact_admin(
    contact_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Any = Depends(get_database)
):
    success = await delete_contact(db, contact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted successfully"}

@router.get("/admin/aggregated", response_model=List[dict])
async def read_contacts_with_aggregation(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Any = Depends(get_database)
):
    """
    Retrieve contacts with aggregated client and professional names.
    """
    pipeline = [
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "client_id",
                "foreignField": "_id",
                "as": "client_info"
            }
        },
        {
            "$lookup": {
                "from": "users",
                "localField": "professional_id",
                "foreignField": "_id",
                "as": "professional_info"
            }
        },
        {
            "$project": {
                "_id": 1,
                "status": 1,
                "created_at": 1,
                "updated_at": 1,
                "client_name": {"$arrayElemAt": ["$client_info.name", 0]},
                "professional_name": {"$arrayElemAt": ["$professional_info.name", 0]}
            }
        }
    ]

    contacts = await db.contacts.aggregate(pipeline).to_list(length=limit)
    return contacts