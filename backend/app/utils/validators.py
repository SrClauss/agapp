from typing import List
from app.core.database import get_database
from app.crud.user import get_user_by_email

async def validate_user_credits(user_id: str, required_credits: int = 1) -> bool:
    db = await get_database()
    from app.crud.subscription import get_user_subscription
    subscription = await get_user_subscription(db, user_id)
    if not subscription or subscription.credits < required_credits:
        return False
    return True

async def validate_email_unique(email: str, exclude_user_id: str = None) -> bool:
    db = await get_database()
    user = await get_user_by_email(db, email)
    if user and (exclude_user_id is None or str(user.id) != exclude_user_id):
        return False
    return True

def validate_roles(roles: List[str]) -> bool:
    valid_roles = ["client", "professional", "admin"]
    return all(role in valid_roles for role in roles)