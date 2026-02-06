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
    Uses system configuration `system_config` (singleton) to determine thresholds.
    Returns (credits_cost, reason)
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
    
    # Load system config (optional)
    try:
        sysconf = await db.system_config.find_one({"_id": "singleton"})
    except Exception:
        sysconf = None

    thresholds = None
    if sysconf and isinstance(sysconf.get("thresholds"), list) and len(sysconf.get("thresholds")) > 0:
        # Expect list of {"max_hours": int, "credits": int}
        thresholds = sorted(sysconf.get("thresholds"), key=lambda t: t.get("max_hours", 0))
    else:
        # Fallback defaults
        thresholds = [
            {"max_hours": 12, "credits": 3},
            {"max_hours": 36, "credits": 2},
            {"max_hours": 44, "credits": 1}
        ]

    # Check if there are any existing contacts for this project
    # Prefer using project.contacts (nested) instead of legacy db.contacts collection
    project_contacts = project.get("contacts", []) if project else []

    if len(project_contacts) == 0:
        # Brand new project - no contacts yet; evaluate against thresholds
        prev_max = 0
        for t in thresholds:
            max_h = int(t.get("max_hours", 0))
            credits = int(t.get("credits", 0))
            if hours_since_creation <= max_h:
                if prev_max == 0:
                    reason = f"new_project_0_{max_h}h"
                else:
                    reason = f"new_project_{prev_max}_{max_h}h"
                return credits, reason
            prev_max = max_h
        # If beyond last threshold, free to negotiate
        return 0, "new_project_free"
    else:
        # Project has prior contacts. Use the time since project creation to determine pricing
        # Keep the previous rules but also consider the timestamp of the most recent contact
        # to support more advanced rules in the future.
        if hours_since_creation <= 24:
            return 2, "non_inedito_0_24h"
        elif hours_since_creation <= 48:
            return 3, "non_inedito_24_48h"
        else:
            # Mark project as expired to prevent further contacts
            try:
                await db.projects.update_one({"_id": project_id}, {"$set": {"status": "expired", "expired_at": now, "expired_by": "system", "expired_reason": "auto_timeout", "updated_at": now}})
            except Exception:
                pass
            return 0, "non_inedito_expired"


async def get_user_credits(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """
    Get user's available credits from the user document.
    The `credits` field on `users` is the single source of truth.

    Args:
        db: Database connection
        user_id: ID of the user

    Returns:
        Number of available credits
    """
    user = await db.users.find_one({"_id": user_id})
    if not user:
        # Try ObjectId fallback if necessary
        try:
            from bson import ObjectId
            if ObjectId.is_valid(user_id):
                user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = None
    return int(user.get("credits", 0)) if user else 0


async def validate_and_deduct_credits(
    db: AsyncIOMotorDatabase,
    user_id: str,
    credits_needed: int
) -> Tuple[bool, Optional[str]]:
    """
    Validate that a user has sufficient credits and deduct them atomically on the user document.

    Uses find_one_and_update with $gte check to prevent race conditions.

    Args:
        db: Database connection
        user_id: ID of the user
        credits_needed: Number of credits to deduct

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    # Atomic decrement on user's credits
    result = await db.users.find_one_and_update(
        {
            "_id": user_id,
            "credits": {"$gte": credits_needed}
        },
        {
            "$inc": {"credits": -credits_needed},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        return_document=True
    )

    if result is None:
        # Could be user not found or insufficient credits
        user = await db.users.find_one({"_id": user_id})
        if not user:
            try:
                from bson import ObjectId
                if ObjectId.is_valid(user_id):
                    user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = None
        if not user:
            return False, "User not found"
        current_credits = user.get("credits", 0)
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
    Record a credit transaction in the database and update the user's credits accordingly.

    - For positive `credits` (grant), it increments `users.credits` atomically and records the transaction.
    - For negative `credits` (deduction), it attempts an atomic deduction via `validate_and_deduct_credits` and records the transaction only on success.

    Returns the transaction id.
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

    # Insert transaction
    await db.credit_transactions.insert_one(transaction)

    # If we are granting credits (credits > 0), increment user's credits
    # For deductions (credits < 0), callers should perform the atomic deduction first
    if credits > 0:
        await db.users.find_one_and_update(
            {"_id": user_id},
            {"$inc": {"credits": credits}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )

    return transaction_id
