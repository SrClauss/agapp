import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"

async def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    # Try providers in order: Google (if key configured) then Nominatim
    # Google
    if getattr(settings, "google_maps_api_key", None):
        params = {"address": address, "key": settings.google_maps_api_key}
        async with httpx.AsyncClient() as client:
            response = await client.get(GOOGLE_MAPS_API_URL, params=params)
            data = response.json()

        if data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            location = result["geometry"]["location"]
            return {
                "address": result.get("formatted_address"),
                "coordinates": [location.get("lng"), location.get("lat")],
                "raw": result,
                "provider": "google",
            }

    # Fallback: Nominatim (OpenStreetMap)
    try:
        params = {"q": address, "format": "json", "limit": 1, "addressdetails": 1}
        headers = {"User-Agent": "agilizapro/1.0 (+https://agilizapro.net)"}
        async with httpx.AsyncClient() as client:
            response = await client.get(NOMINATIM_SEARCH_URL, params=params, headers=headers)
            data = response.json()
        if isinstance(data, list) and len(data) > 0:
            res = data[0]
            # Nominatim returns lat/lon as strings
            lat = float(res.get("lat"))
            lon = float(res.get("lon"))
            formatted = res.get("display_name")
            return {
                "address": formatted,
                "coordinates": [lon, lat],
                "raw": res,
                "provider": "nominatim",
            }
    except Exception:
        # If any provider fails, return None to let caller handle
        return None

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