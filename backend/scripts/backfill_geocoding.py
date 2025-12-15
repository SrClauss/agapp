"""Script to backfill projects missing location.coordinates using geocoding service.

Usage:
  python3 backend/scripts/backfill_geocoding.py --dry-run
"""
import asyncio
from app.core.database import get_database
from app.services.geocoding import geocode_address
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)

async def run(dry_run=True, limit=1000):
    db = await get_database()
    cursor = db.projects.find({"location.coordinates": {"$exists": False}, "location.address": {"$exists": True}})
    count = 0
    async for proj in cursor:
        if limit and count >= limit:
            break
        proj_id = proj.get("_id")
        address_obj = proj.get("location", {}).get("address")
        # Try to extract string
        addr_str = None
        if isinstance(address_obj, str):
            addr_str = address_obj
        elif isinstance(address_obj, dict):
            addr_str = address_obj.get("formatted") or ", ".join([v for k,v in address_obj.items() if v and isinstance(v,str)])
        if not addr_str:
            logging.info(f"[{proj_id}] No address string available; skipping")
            continue
        geocoded = await geocode_address(addr_str)
        if not geocoded:
            logging.info(f"[{proj_id}] Could not geocode: {addr_str}")
            continue
        lng, lat = geocoded["coordinates"]
        update = {
            "location.coordinates": {"type": "Point", "coordinates": [lng, lat]},
            "location.geocode_source": geocoded.get("provider"),
            "location.raw_geocode": geocoded.get("raw")
        }
        if not dry_run:
            await db.projects.update_one({"_id": proj_id}, {"$set": update})
            logging.info(f"[{proj_id}] Updated with coordinates: {[lng, lat]}")
        else:
            logging.info(f"[DRY] Would update {proj_id} with {update}")
        count += 1

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', default=False)
    parser.add_argument('--limit', type=int, default=1000)
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit))
