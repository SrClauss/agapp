"""
Background job to remove featured status from expired projects.

This script should be run periodically (e.g., via cron job every hour)
to check for projects where featured_until has passed and remove the featured status.

Usage:
    python -m app.jobs.expire_featured_projects
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def expire_featured_projects():
    """
    Find all projects where is_featured=True and featured_until < now,
    then set is_featured=False.
    """
    try:
        # Connect to database
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_DB_NAME]
        
        now = datetime.now(timezone.utc)
        
        # Find expired featured projects
        result = await db.projects.update_many(
            {
                "is_featured": True,
                "featured_until": {"$lt": now}
            },
            {
                "$set": {
                    "is_featured": False,
                    "updated_at": now
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Expired {result.modified_count} featured project(s)")
        else:
            logger.info("No featured projects to expire")
        
        # Close connection
        client.close()
        
        return result.modified_count
        
    except Exception as e:
        logger.error(f"Error expiring featured projects: {e}")
        raise


def main():
    """Entry point for command line execution"""
    asyncio.run(expire_featured_projects())


if __name__ == "__main__":
    main()
