#!/usr/bin/env python3
"""
Migration script to embed credit_transactions into user documents.
Run this script once after deploying the updated code.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def migrate_credit_transactions():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    print("Starting migration of credit_transactions to user documents...")

    # Aggregate existing transactions by user_id
    pipeline = [
        {"$group": {"_id": "$user_id", "transactions": {"$push": "$$ROOT"}}}
    ]
    results = await db.credit_transactions.aggregate(pipeline).to_list(None)

    migrated_count = 0
    for result in results:
        user_id = result["_id"]
        transactions = result["transactions"]
        # Update user document
        await db.users.update_one(
            {"_id": user_id},
            {"$set": {"credit_transactions": transactions}}
        )
        migrated_count += 1
        print(f"Migrated {len(transactions)} transactions for user {user_id}")

    # Drop the old collection
    await db.credit_transactions.drop()
    print(f"Migration completed. Migrated data for {migrated_count} users.")
    print("Dropped old credit_transactions collection.")

if __name__ == "__main__":
    asyncio.run(migrate_credit_transactions())