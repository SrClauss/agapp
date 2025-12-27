from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, timedelta
from ulid import new as new_ulid
from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate

async def get_subscription(db: AsyncIOMotorDatabase, subscription_id: str) -> Optional[Subscription]:
    subscription = await db.subscriptions.find_one({"_id": subscription_id})
    return Subscription(**subscription) if subscription else None

async def get_user_subscription(db: AsyncIOMotorDatabase, user_id: str) -> Optional[Subscription]:
    # Try with string first
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    
    # If not found and user_id looks like ObjectId, try as ObjectId string representation
    if not subscription and ObjectId.is_valid(user_id):
        subscription = await db.subscriptions.find_one({"user_id": str(ObjectId(user_id)), "status": "active"})
    
    # Try with ObjectId directly as fallback
    if not subscription:
        try:
            subscription = await db.subscriptions.find_one({"user_id": ObjectId(user_id), "status": "active"})
        except:
            pass
    
    return Subscription(**subscription) if subscription else None

async def create_subscription(db: AsyncIOMotorDatabase, subscription: SubscriptionCreate, user_id: str) -> Subscription:
    subscription_dict = subscription.dict()
    subscription_dict["_id"] = str(new_ulid())
    # Normalize user_id: if it's an ObjectId, convert to string representation
    if ObjectId.is_valid(user_id):
        subscription_dict["user_id"] = str(ObjectId(user_id))
    else:
        subscription_dict["user_id"] = user_id
    subscription_dict["expires_at"] = datetime.utcnow() + timedelta(days=30)  # Exemplo: 30 dias
    # Garantir status padrão como active para que consultas por status funcionem
    subscription_dict.setdefault("status", "active")
    subscription_dict.setdefault("created_at", datetime.utcnow())
    subscription_dict.setdefault("updated_at", datetime.utcnow())

    await db.subscriptions.insert_one(subscription_dict)
    return Subscription(**subscription_dict)

async def update_subscription(db: AsyncIOMotorDatabase, subscription_id: str, subscription_update: SubscriptionUpdate) -> Optional[Subscription]:
    update_data = {k: v for k, v in subscription_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.subscriptions.update_one({"_id": subscription_id}, {"$set": update_data})
    subscription = await get_subscription(db, subscription_id)
    return subscription

async def add_credits_to_user(db: AsyncIOMotorDatabase, user_id: str, credits: int) -> Optional[Subscription]:
    subscription = await get_user_subscription(db, user_id)
    if subscription:
        new_credits = subscription.credits + credits
        await db.subscriptions.update_one(
            {"_id": subscription.id},
            {"$set": {"credits": new_credits, "updated_at": datetime.utcnow()}}
        )
        # Refresh from database to get updated values
        subscription = await get_subscription(db, subscription.id)
        return subscription
    return None

async def get_subscriptions(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, query_filter: dict = None) -> List[Subscription]:
    if query_filter is None:
        query_filter = {}
    subscriptions = []
    async for subscription in db.subscriptions.find(query_filter).skip(skip).limit(limit):
        subscriptions.append(Subscription(**subscription))
    return subscriptions

async def update_subscription(db: AsyncIOMotorDatabase, subscription_id: str, subscription_update: SubscriptionUpdate) -> Optional[Subscription]:
    update_data = {k: v for k, v in subscription_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.subscriptions.update_one({"_id": subscription_id}, {"$set": update_data})
    subscription = await get_user_subscription(db, subscription_id)
    return subscription

async def delete_subscription(db: AsyncIOMotorDatabase, subscription_id: str) -> bool:
    result = await db.subscriptions.delete_one({"_id": subscription_id})
    return result.deleted_count > 0