from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.subscription import get_user_subscription, create_subscription, add_credits_to_user, get_subscriptions, update_subscription, delete_subscription
from app.schemas.subscription import Subscription, SubscriptionCreate, AddCredits, SubscriptionPlan, SubscriptionUpdate
from app.schemas.user import User
from app.services.payment import create_subscription_payment
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

PLANS = [
    SubscriptionPlan(name="Basic", credits=10, price=29.90, description="10 créditos para contatar profissionais"),
    SubscriptionPlan(name="Pro", credits=50, price=99.90, description="50 créditos para contatar profissionais"),
    SubscriptionPlan(name="Enterprise", credits=200, price=299.90, description="200 créditos para contatar profissionais"),
]

@router.get("/plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans():
    return PLANS

@router.post("/subscribe", response_model=Subscription)
async def subscribe_to_plan(
    subscription: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Process payment (simulated)
    payment_result = await create_subscription_payment(subscription.plan_name, str(current_user.id))
    if not payment_result["success"]:
        raise HTTPException(status_code=400, detail="Payment failed")
    
    # Create subscription
    db_subscription = await create_subscription(db, subscription, str(current_user.id))
    return db_subscription

@router.get("/me", response_model=Subscription)
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    subscription = await get_user_subscription(db, str(current_user.id))
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return subscription

@router.post("/add-credits", response_model=Subscription)
async def add_credits(
    add_credits: AddCredits,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Process payment (simulated)
    payment_result = await create_subscription_payment("credits", str(current_user.id))
    if not payment_result["success"]:
        raise HTTPException(status_code=400, detail="Payment failed")
    
    subscription = await add_credits_to_user(db, str(current_user.id), add_credits.credits)
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return subscription

# Admin endpoints
@router.get("/admin/", response_model=List[Subscription])
async def read_subscriptions_admin(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    subscriptions = await get_subscriptions(db, skip=skip, limit=limit)
    return subscriptions

@router.get("/admin/{subscription_id}", response_model=Subscription)
async def read_subscription_admin(
    subscription_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    subscription = await get_user_subscription(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription

@router.put("/admin/{subscription_id}", response_model=Subscription)
async def update_subscription_admin(
    subscription_id: str,
    subscription_update: SubscriptionUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    subscription = await update_subscription(db, subscription_id, subscription_update)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription

@router.delete("/admin/{subscription_id}")
async def delete_subscription_admin(
    subscription_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    success = await delete_subscription(db, subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription deleted successfully"}