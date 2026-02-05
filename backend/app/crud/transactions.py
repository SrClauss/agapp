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
    # Se db for None (ex.: testes unitários que não precisam persistir), apenas retorne o objeto
    if db is None:
        return CreditTransaction(**tx_dict)

    # Se existir coleção `credit_transactions`, preferimos inserir nela (compatível com testes)
    if hasattr(db, 'credit_transactions'):
        await db.credit_transactions.insert_one(tx_dict)
        return CreditTransaction(**tx_dict)

    # Fallback: embutir transação no documento do usuário (legacy)
    if hasattr(db, 'users'):
        await db.users.update_one(
            {"_id": tx.user_id},
            {"$push": {"credit_transactions": tx_dict}}
        )

    return CreditTransaction(**tx_dict)

async def get_credit_transactions_by_user(db: AsyncIOMotorDatabase, user_id: str, skip: int = 0, limit: int = 50) -> List[CreditTransaction]:
    user_doc = await db.users.find_one({"_id": user_id}, {"credit_transactions": 1})
    if not user_doc or "credit_transactions" not in user_doc:
        return []
    transactions = user_doc["credit_transactions"]
    # Sort by created_at descending and apply pagination
    sorted_tx = sorted(transactions, key=lambda x: x.get("created_at", datetime.min), reverse=True)
    paginated = sorted_tx[skip:skip + limit]
    return [CreditTransaction(**tx) for tx in paginated]

async def get_credit_transaction(db: AsyncIOMotorDatabase, tx_id: str) -> Optional[CreditTransaction]:
    doc = await db.credit_transactions.find_one({"_id": tx_id})
    return CreditTransaction(**doc) if doc else None