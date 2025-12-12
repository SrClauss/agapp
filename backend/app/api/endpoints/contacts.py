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

@router.post("/{project_id}", response_model=Contact, status_code=201)
async def create_contact_for_project(
    project_id: str,
    contact: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Professional creates contact to accept/propose for a project.
    This deducts 1 credit from the professional's account.
    """
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Ensure user is a professional
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only professionals can create contacts")
    
    # Check if contact already exists
    existing_contact = await db.contacts.find_one({
        "project_id": project_id,
        "professional_id": str(current_user.id)
    })
    if existing_contact:
        raise HTTPException(status_code=400, detail="Contact already exists for this project")
    
    # Check credits
    has_credits = await validate_user_credits(str(current_user.id))
    if not has_credits:
        raise HTTPException(status_code=400, detail="Insufficient credits")
    
    # Get subscription to deduct credits
    subscription = await get_user_subscription(db, str(current_user.id))
    if subscription:
        new_credits = subscription.credits - 1
        from app.crud.subscription import update_subscription
        from app.schemas.subscription import SubscriptionUpdate
        await update_subscription(db, str(subscription.id), SubscriptionUpdate(credits=new_credits))
    
    # Create contact
    db_contact = await create_contact(db, contact, str(current_user.id), project_id, str(project.client_id), 1)
    
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