"""
Timezone utility functions for consistent datetime handling.
"""

from datetime import datetime, timezone


def ensure_utc(dt: datetime) -> datetime:
    """
    Ensure a datetime object has UTC timezone.
    
    If the datetime is naive (no timezone), assumes it's UTC.
    If the datetime has a timezone, converts it to UTC.
    
    Args:
        dt: datetime object
        
    Returns:
        datetime object with UTC timezone
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Naive datetime - assume UTC
        return dt.replace(tzinfo=timezone.utc)
    else:
        # Aware datetime - convert to UTC
        return dt.astimezone(timezone.utc)
