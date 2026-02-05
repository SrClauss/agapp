"""
Utility functions for dynamic credit pricing based on project age and contact history.

Pricing Rules:
- New projects (0-24h): 3 credits
- Recent projects (24-36h): 2 credits  
- Older projects (36-48h+): 1 credit
- Projects with prior contacts by ANY professional: 2 credits (0-24h after first contact), 1 credit after
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase


async def calculate_contact_cost(
    db: AsyncIOMotorDatabase,
    project_id: str,
    professional_id: str
) -> Tuple[int, str]:
    """
    Calculate the credit cost for creating a contact on a project.
    
    Args:
        db: Database connection
        project_id: ID of the project
        professional_id: ID of the professional making contact
        
    Returns:
        Tuple of (credits_cost, reason)
    """
    # Get project
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        raise ValueError("Project not found")
    
    project_created_at = project.get("created_at")
    if not project_created_at:
        # Fallback to 1 credit if no creation date
        return 1, "no_creation_date"
    
    # Ensure timezone awareness
    if project_created_at.tzinfo is None:
        project_created_at = project_created_at.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    hours_since_creation = (now - project_created_at).total_seconds() / 3600
    
    # Check if there are any existing contacts for this project
    existing_contacts = await db.contacts.find({"project_id": project_id}).to_list(length=None)
    
    if len(existing_contacts) == 0:
        # Brand new project - no contacts yet
        if hours_since_creation <= 24:
            return 3, "new_project_0_24h"
        elif hours_since_creation <= 36:
            return 2, "new_project_24_36h"
        else:
            return 1, "new_project_36h_plus"
    else:
        # Project has prior contacts
        # Find the earliest contact
        first_contact = min(existing_contacts, key=lambda c: c.get("created_at", now))
        first_contact_at = first_contact.get("created_at")
        
        if not first_contact_at:
            # Fallback if no creation date on contact
            return 1, "contacted_project_unknown_time"
        
        # Ensure timezone awareness
        if first_contact_at.tzinfo is None:
            first_contact_at = first_contact_at.replace(tzinfo=timezone.utc)
        
        hours_since_first_contact = (now - first_contact_at).total_seconds() / 3600
        
        if hours_since_first_contact <= 24:
            return 2, "contacted_project_0_24h_after_first"
        else:
            return 1, "contacted_project_24h_plus_after_first"


async def validate_and_deduct_credits(
    db: AsyncIOMotorDatabase,
    user_id: str,
    credits_needed: int
) -> Tuple[bool, Optional[str]]:
    """
    Validate that a user has sufficient credits and deduct them atomically.
    
    Uses findOneAndUpdate with $gte check to prevent race conditions.
    
    Args:
        db: Database connection
        user_id: ID of the user
        credits_needed: Number of credits to deduct
        
    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    # Use findOneAndUpdate with atomic decrement
    result = await db.subscriptions.find_one_and_update(
        {
            "user_id": user_id,
            "credits": {"$gte": credits_needed}
        },
        {
            "$inc": {"credits": -credits_needed},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        return_document=True
    )
    
    if result is None:
        # Either subscription doesn't exist or insufficient credits
        subscription = await db.subscriptions.find_one({"user_id": user_id})
        if not subscription:
            return False, "No active subscription"
        else:
            current_credits = subscription.get("credits", 0)
            return False, f"Insufficient credits (have {current_credits}, need {credits_needed})"
    
    return True, None


async def record_credit_transaction(
    db: AsyncIOMotorDatabase,
    user_id: str,
    credits: int,
    transaction_type: str,
    metadata: Optional[dict] = None,
    price: float = 0.0
) -> str:
    """
    Record a credit transaction in the database.
    
    Args:
        db: Database connection
        user_id: ID of the user
        credits: Number of credits (positive for additions, negative for deductions)
        transaction_type: Type of transaction (e.g., "contact", "purchase", "refund")
        metadata: Additional metadata (e.g., project_id, contact_id)
        price: Price paid (if applicable)
        
    Returns:
        Transaction ID
    """
    from ulid import new as new_ulid
    
    transaction_id = str(new_ulid())
    transaction = {
        "_id": transaction_id,
        "user_id": user_id,
        # Mantemos 'type' por compatibilidade e adicionamos 'transaction_type' esperado pelos testes
        "type": transaction_type,
        "transaction_type": transaction_type,
        "credits": credits,
        "price": price,
        "currency": "BRL",
        "metadata": metadata or {},
        "status": "completed",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.credit_transactions.insert_one(transaction)
    return transaction_id
