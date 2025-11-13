from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.security import get_current_user
from app.core.database import get_database
from app.schemas.user import User
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import uuid
from datetime import datetime
from ulid import new as new_ulid

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Upload media file and return URL and tags for chat insertion.
    Returns format: { url: "...", tags: "<ULID.image>url</ULID.image>" }
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "audio/mpeg", "audio/wav"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Validate file size (max 10MB)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    if file_size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{str(new_ulid())}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Generate URL (assuming files are served from /uploads/)
    file_url = f"/uploads/{unique_filename}"
    
    # Generate tags for chat insertion
    media_type = "image" if file.content_type.startswith("image/") else "video" if file.content_type.startswith("video/") else "audio"
    tag_id = str(new_ulid())
    tags = f"<{tag_id}.{media_type}>{file_url}</{tag_id}.{media_type}>"
    
    return {
        "url": file_url,
        "tags": tags,
        "filename": file.filename,
        "size": file_size,
        "type": file.content_type
    }