from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timezone
import json
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.security import get_current_user
from app.schemas.user import User
from app.utils.contact_helpers import is_first_user_message
from app.api.websockets.manager import manager
from ulid import new as new_ulid

router = APIRouter()


async def _find_contact_in_projects(db: AsyncIOMotorDatabase, contact_id: str):
    project_doc = await db.projects.find_one(
        {"contacts.contact_id": contact_id},
        {
            "contacts": 1,
            "_id": 1,
            "title": 1,
            "client_id": 1,
            "client_name": 1,
        },
    )
    if not project_doc:
        return None, None, None

    contacts = project_doc.get("contacts", [])
    for idx, c in enumerate(contacts):
        if str(c.get("contact_id", "")) == str(contact_id):
            return project_doc, c, idx

    return project_doc, None, None


@router.get("/contacts/history", response_model=List[Dict[str, Any]])
async def get_contact_history(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get contact history for the current user (as professional or client)."""
    user_id = str(current_user.id)
    query = {
        "$or": [
            {"contacts.professional_id": user_id},
            {"contacts.client_id": user_id},
        ]
    }
    projects = await db.projects.find(
        query,
        {
            "contacts": 1,
            "_id": 1,
            "title": 1,
            "client_id": 1,
            "client_name": 1,
        },
    ).to_list(length=200)

    contacts: List[Dict[str, Any]] = []
    for project in projects:
        for c in project.get("contacts", []):
            professional_id = str(c.get("professional_id", ""))
            client_id = str(c.get("client_id", ""))
            if user_id not in (professional_id, client_id):
                continue

            chat = c.get("chat", []) or []
            unread_count = sum(
                1
                for msg in chat
                if str(msg.get("sender_id", "")) != user_id and not msg.get("read_at")
            )

            contact_id = c.get("contact_id")
            if not contact_id:
                # Sem migração: se não existir id antigo, não expõe no histórico
                continue

            contacts.append(
                {
                    "id": contact_id,
                    "professional_id": professional_id,
                    "professional_name": c.get("professional_name", ""),
                    "project_id": project.get("_id"),
                    "client_id": client_id,
                    "client_name": c.get("client_name") or project.get("client_name", ""),
                    "contact_type": c.get("contact_type", "proposal"),
                    "credits_used": c.get("credits_used", 0),
                    "status": c.get("status", "pending"),
                    "contact_details": c.get("contact_details", {}),
                    "chat": chat,
                    "created_at": c.get("created_at"),
                    "updated_at": c.get("updated_at"),
                    "unread_count": unread_count,
                }
            )

    contacts.sort(key=lambda item: item.get("updated_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return contacts[:100]


@router.get("/contacts/{contact_id}", response_model=Dict[str, Any])
async def get_contact_detail(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get details of a specific contact including the chat history."""
    project_doc, contact, _ = await _find_contact_in_projects(db, contact_id)
    if not contact or not project_doc:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = str(current_user.id)
    if user_id not in (str(contact.get("professional_id")), str(contact.get("client_id"))):
        raise HTTPException(status_code=403, detail="Not authorized to view this contact")

    return {
        "id": contact.get("contact_id"),
        "professional_id": str(contact.get("professional_id", "")),
        "professional_name": contact.get("professional_name", ""),
        "project_id": project_doc.get("_id"),
        "client_id": str(contact.get("client_id", "")),
        "client_name": contact.get("client_name") or project_doc.get("client_name", ""),
        "contact_type": contact.get("contact_type", "proposal"),
        "credits_used": contact.get("credits_used", 0),
        "status": contact.get("status", "pending"),
        "contact_details": contact.get("contact_details", {}),
        "chat": contact.get("chat", []),
        "created_at": contact.get("created_at"),
        "updated_at": contact.get("updated_at"),
    }


@router.post("/contacts/{contact_id}/messages", response_model=Dict[str, Any])
async def send_contact_message(
    contact_id: str,
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a message in a contact chat. Sends a push notification to the other participant."""
    project_doc, contact, contact_idx = await _find_contact_in_projects(db, contact_id)
    if not contact or project_doc is None or contact_idx is None:
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

    now = datetime.now(timezone.utc)
    await db.projects.update_one(
        {"_id": project_doc.get("_id")},
        {
            "$push": {f"contacts.{contact_idx}.chat": msg},
            "$set": {
                f"contacts.{contact_idx}.updated_at": now,
            },
        },
    )

    # Mark contact as "in_conversation" if this is the first user message
    _, updated_contact, _ = await _find_contact_in_projects(db, contact_id)
    if updated_contact:
        contact_messages = updated_contact.get("chat", [])
        if is_first_user_message(contact_messages) and updated_contact.get("status") == "pending":
            await db.projects.update_one(
                {"_id": project_doc.get("_id")},
                {"$set": {f"contacts.{contact_idx}.status": "in_conversation"}},
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

    # Broadcast via WebSocket to both participants for real-time delivery
    ws_payload = json.dumps({
        "type": "new_message",
        "contact_id": contact_id,
        "message": msg_out,
    })
    for rid in [professional_id, client_id]:
        try:
            await manager.send_personal_message(ws_payload, rid)
        except Exception:
            pass  # WebSocket delivery is best-effort; push notification is the fallback

    return {"message": "Message sent", "message_id": msg_out["id"], "data": msg_out}


@router.post("/contacts/{contact_id}/messages/mark-read", response_model=Dict[str, Any])
async def mark_contact_messages_as_read(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Mark all messages in a contact as read for the current user."""
    project_doc, contact, contact_idx = await _find_contact_in_projects(db, contact_id)
    if not contact or project_doc is None or contact_idx is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    user_id = str(current_user.id)
    if user_id not in (str(contact.get("professional_id")), str(contact.get("client_id"))):
        raise HTTPException(status_code=403, detail="Not authorized to access this contact")

    now = datetime.now(timezone.utc)
    messages = contact.get("chat", []) or []
    changed = False
    for msg in messages:
        if str(msg.get("sender_id", "")) != user_id and not msg.get("read_at"):
            msg["read_at"] = now
            changed = True

    if changed:
        await db.projects.update_one(
            {"_id": project_doc.get("_id")},
            {
                "$set": {
                    f"contacts.{contact_idx}.chat": messages,
                    f"contacts.{contact_idx}.updated_at": now,
                }
            },
        )

    return {"message": "Messages marked as read"}
