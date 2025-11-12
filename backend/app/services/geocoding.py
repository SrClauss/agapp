import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"

async def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    params = {
        "address": address,
        "key": settings.google_maps_api_key
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(GOOGLE_MAPS_API_URL, params=params)
        data = response.json()
    
    if data["status"] == "OK" and data["results"]:
        result = data["results"][0]
        location = result["geometry"]["location"]
        return {
            "address": result["formatted_address"],
            "coordinates": [location["lng"], location["lat"]]
        }
    return None

async def reverse_geocode(latitude: float, longitude: float) -> Optional[str]:
    params = {
        "latlng": f"{latitude},{longitude}",
        "key": settings.google_maps_api_key
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(GOOGLE_MAPS_API_URL, params=params)
        data = response.json()
    
    if data["status"] == "OK" and data["results"]:
        return data["results"][0]["formatted_address"]
    return None