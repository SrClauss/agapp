from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.mongodb_url)
database = client[settings.database_name]

async def get_database():
    return database