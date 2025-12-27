from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from ulid import new as new_ulid
from app.models.transaction import CreditTransaction
from app.schemas.transaction import CreditTransactionCreate
from typing import Optional, List

async def create_credit_transaction(db: AsyncIOMotorDatabase, tx: CreditTransactionCreate) -> CreditTransaction:
    tx_dict = tx.dict()
    tx_dict["_id"] = str(new_ulid())
    tx_dict["created_at"] = datetime.utcnow()
    tx_dict["status"] = tx_dict.get("status", "completed") if isinstance(tx_dict.get("status"), str) else "completed"
    await db.credit_transactions.insert_one(tx_dict)
    return CreditTransaction(**tx_dict)

async def get_credit_transactions_by_user(db: AsyncIOMotorDatabase, user_id: str, skip: int = 0, limit: int = 50) -> List[CreditTransaction]:
    cursor = db.credit_transactions.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(CreditTransaction(**doc))
    return results

async def get_credit_transaction(db: AsyncIOMotorDatabase, tx_id: str) -> Optional[CreditTransaction]:
    doc = await db.credit_transactions.find_one({"_id": tx_id})
    return CreditTransaction(**doc) if doc else None