from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
from ulid import new as new_ulid
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate

async def get_contact(db: AsyncIOMotorDatabase, contact_id: str) -> Optional[Contact]:
    contact = await db.contacts.find_one({"_id": contact_id})
    return Contact(**contact) if contact else None

async def get_contacts_by_user(db: AsyncIOMotorDatabase, user_id: str, user_type: str = "professional") -> List[Contact]:
    if user_type == "professional":
        query = {"professional_id": user_id}
    else:
        query = {"client_id": user_id}
    
    contacts = []
    async for contact in db.contacts.find(query):
        contacts.append(Contact(**contact))
    return contacts

async def create_contact(db: AsyncIOMotorDatabase, contact: ContactCreate, professional_id: str, project_id: str, client_id: str, credits_used: int) -> Contact:
    contact_dict = contact.dict()
    contact_dict["_id"] = str(new_ulid())
    contact_dict["professional_id"] = professional_id
    contact_dict["project_id"] = project_id
    contact_dict["client_id"] = client_id
    contact_dict["credits_used"] = credits_used
    contact_dict["status"] = "pending"
    contact_dict["chat"] = []
    
    # Fetch professional and client names and add to document
    professional = await db.users.find_one({"_id": professional_id})
    client = await db.users.find_one({"_id": client_id})
    contact_dict["professional_name"] = professional.get("name") if professional else None
    contact_dict["client_name"] = client.get("name") if client else None
    
    await db.contacts.insert_one(contact_dict)
    return Contact(**contact_dict)

async def update_contact(db: AsyncIOMotorDatabase, contact_id: str, contact_update: ContactUpdate) -> Optional[Contact]:
    update_data = {k: v for k, v in contact_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.contacts.update_one({"_id": contact_id}, {"$set": update_data})
    contact = await get_contact(db, contact_id)

    # If contact status changed to an accepted/open state, ensure project chat exists
    try:
        new_status = update_data.get("status")
    except Exception:
        new_status = None

    if new_status and new_status in ["accepted", "open", "active", "liberado"]:
        # create chat structure inside project if missing for this professional
        if contact and contact.project_id:
            project = await db.projects.find_one({"_id": contact.project_id})
            if project:
                # Add professional to liberado_por if not already
                liberado_por = project.get("liberado_por", [])
                if str(contact.professional_id) not in liberado_por:
                    liberado_por.append(str(contact.professional_id))
                    await db.projects.update_one({"_id": contact.project_id}, {"$set": {"liberado_por": liberado_por}})
                
                # Create chat for this professional if not exists
                chats = project.get("chat", [])
                chat_exists = any(c.get("professional_id") == str(contact.professional_id) for c in chats)
                if not chat_exists:
                    new_chat = {
                        "professional_id": str(contact.professional_id),
                        "messages": [{
                            "id": str(new_ulid()),
                            "sender_id": "system",
                            "content": "Chat criado - Projeto liberado para comunicação",
                            "created_at": datetime.utcnow(),
                            "system": True
                        }]
                    }
                    chats.append(new_chat)
                    await db.projects.update_one({"_id": contact.project_id}, {"$set": {"chat": chats}})

    return contact

async def get_contacts(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, query_filter: dict = None) -> List[Contact]:
    if query_filter is None:
        query_filter = {}
    contacts = []
    async for contact in db.contacts.find(query_filter).skip(skip).limit(limit):
        contacts.append(Contact(**contact))
    return contacts

async def delete_contact(db: AsyncIOMotorDatabase, contact_id: str) -> bool:
    result = await db.contacts.delete_one({"_id": contact_id})
    return result.deleted_count > 0