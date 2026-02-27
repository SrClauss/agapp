from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.security import get_current_user
from app.schemas.user import User
from app.utils.contact_helpers import is_first_user_message
from ulid import new as new_ulid

router = APIRouter()


@router.get("/contacts/history", response_model=List[Dict[str, Any]])
async def get_contact_history(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get contact history for the current user (as professional or client)."""
    user_id = str(current_user.id)
    contacts = await db.contacts.find(
        {"$or": [{"professional_id": user_id}, {"client_id": user_id}]}
    ).sort("updated_at", -1).to_list(length=100)

    for c in contacts:
        c["id"] = c.pop("_id", c.get("id", ""))
    return contacts


@router.get("/contacts/{contact_id}", response_model=Dict[str, Any])
async def get_contact_detail(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get details of a specific contact including the chat history."""
    contact = await db.contacts.find_one({"_id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = str(current_user.id)
    if user_id not in (str(contact.get("professional_id")), str(contact.get("client_id"))):
        raise HTTPException(status_code=403, detail="Not authorized to view this contact")

    contact["id"] = contact.pop("_id", contact.get("id", ""))
    return contact


@router.post("/contacts/{contact_id}/messages", response_model=Dict[str, Any])
async def send_contact_message(
    contact_id: str,
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a message in a contact chat. Sends a push notification to the other participant."""
    contact = await db.contacts.find_one({"_id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = str(current_user.id)
    professional_id = str(contact.get("professional_id", ""))
    client_id = str(contact.get("client_id", ""))

    if user_id not in (professional_id, client_id):
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this contact")

    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    msg = {
        "id": str(new_ulid()),
        "sender_id": user_id,
        "content": content,
        "created_at": datetime.now(timezone.utc),
    }

    await db.contacts.update_one(
        {"_id": contact_id},
        {"$push": {"chat": msg}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )

    # Mark contact as "in_conversation" if this is the first user message
    updated_contact = await db.contacts.find_one({"_id": contact_id})
    if updated_contact:
        contact_messages = updated_contact.get("chat", [])
        if is_first_user_message(contact_messages) and updated_contact.get("status") == "pending":
            await db.contacts.update_one(
                {"_id": contact_id},
                {"$set": {"status": "in_conversation"}},
            )

    # Track first_message_at in lead_events (best-effort)
    try:
        existing_event = await db.lead_events.find_one({"contact_id": contact_id})
        if existing_event and not existing_event.get("first_message_at"):
            first_msg_at = msg["created_at"]
            contact_created_at = existing_event.get("contact_created_at")
            minutes_to_first_message = None
            if contact_created_at:
                delta = (first_msg_at - contact_created_at).total_seconds() / 60
                minutes_to_first_message = round(delta, 1)
            await db.lead_events.update_one(
                {"contact_id": contact_id},
                {"$set": {
                    "first_message_at": first_msg_at,
                    "minutes_to_first_message": minutes_to_first_message,
                    "updated_at": first_msg_at,
                }},
            )
    except Exception as _lead_exc:
        pass  # lead_events tracking is best-effort; errors logged at caller level

    # Send push notification to the OTHER participant
    recipient_id = client_id if user_id == professional_id else professional_id
    try:
        recipient = await db.users.find_one({"_id": recipient_id})
        if recipient and recipient.get("fcm_tokens"):
            from app.core.firebase import send_multicast_notification

            fcm_tokens = [t["token"] for t in recipient["fcm_tokens"] if "token" in t]
            if fcm_tokens:
                sender_name = current_user.full_name or "Usuário"
                await send_multicast_notification(
                    fcm_tokens=fcm_tokens,
                    title="Nova Mensagem",
                    body=f"{sender_name}: {content[:100]}",
                    data={
                        "type": "new_message",
                        "contact_id": contact_id,
                        "sender_id": user_id,
                    },
                )
    except Exception:
        pass  # Push notifications are best-effort

    # Serialize datetime for JSON response
    msg_out = dict(msg)
    if isinstance(msg_out.get("created_at"), datetime):
        msg_out["created_at"] = msg_out["created_at"].isoformat()

    return {"message": "Message sent", "message_id": msg_out["id"], "data": msg_out}


@router.post("/contacts/{contact_id}/messages/mark-read", response_model=Dict[str, Any])
async def mark_contact_messages_as_read(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Mark all messages in a contact as read for the current user."""
    contact = await db.contacts.find_one({"_id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = str(current_user.id)
    if user_id not in (str(contact.get("professional_id")), str(contact.get("client_id"))):
        raise HTTPException(status_code=403, detail="Not authorized to access this contact")

    now = datetime.now(timezone.utc)
    await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$set": {
                "chat.$[msg].read_at": now,
                "updated_at": now,
            }
        },
        array_filters=[
            {
                "msg.sender_id": {"$ne": user_id},
                "msg.read_at": None,
            }
        ],
    )

    return {"message": "Messages marked as read"}
