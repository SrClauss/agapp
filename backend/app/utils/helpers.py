from typing import Any, Dict
from bson import ObjectId

def convert_object_ids_to_strings(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: convert_object_ids_to_strings(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_object_ids_to_strings(item) for item in data]
    elif isinstance(data, ObjectId):
        return str(data)
    else:
        return data

def calculate_distance(coord1: list, coord2: list) -> float:
    # Simplified distance calculation (Haversine formula)
    from math import radians, sin, cos, sqrt, atan2
    
    lat1, lon1 = radians(coord1[1]), radians(coord1[0])
    lat2, lon2 = radians(coord2[1]), radians(coord2[0])
    
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    # Radius of Earth in kilometers
    R = 6371.0
    return R * c