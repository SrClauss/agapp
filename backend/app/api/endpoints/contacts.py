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
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
    return db_contact

@router.get("/history", response_model=List[Contact])
async def read_contact_history(
    user_type: str = "professional",
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    contacts = await get_contacts_by_user(db, str(current_user.id), user_type)
    return contacts

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