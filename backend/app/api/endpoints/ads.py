from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status, Query
from fastapi.responses import JSONResponse, HTMLResponse, Response
from typing import List, Optional
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
import io
import zipfile

from app.core.security import get_current_user_from_request
from app.core.database import get_database
from app.models.user import User
from app.crud import banner_ad as banner_crud
from app.crud import adscreen_ad as adscreen_crud
from app.core.ads_stacks import get_stacks_for_target, validate_stack_for_target
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()
admin_router = APIRouter()
mobile_router = APIRouter()

# Setup loggers for ad tracking at module level
def _setup_ad_logger(name: str, filename: str) -> logging.Logger:
    """Setup a dedicated logger for ad tracking."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        log_dir = Path(__file__).resolve().parents[3] / "logs"
        log_dir.mkdir(exist_ok=True)
        handler = logging.FileHandler(log_dir / filename)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger

# Initialize loggers once at module level
click_logger = _setup_ad_logger("ad_clicks", "ad_clicks.log")
impression_logger = _setup_ad_logger("ad_impressions", "ad_impressions.log")

# Constants
ASPECT_RATIO_TOLERANCE = 0.05
MIN_BANNER_RATIO = 2.5
MAX_ZIP_SIZE_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_BANNER_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ============================================================================
# IMAGE VALIDATION FUNCTIONS
# ============================================================================

def validate_image_dimensions(image_content: bytes) -> tuple[int, int, float]:
    """
    Validate image dimensions and return (width, height, aspect_ratio).
    Raises HTTPException if image is invalid.
    """
    try:
        img = Image.open(io.BytesIO(image_content))
        width, height = img.size

        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "invalid_dimensions",
                    "message": "Dimensões da imagem inválidas",
                    "details": {
                        "width": width,
                        "height": height,
                        "explanation": "A imagem deve ter largura e altura maiores que zero"
                    }
                }
            )

        aspect_ratio = width / height
        return width, height, aspect_ratio
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_image_file",
                "message": "Arquivo de imagem inválido ou corrompido",
                "details": {
                    "error_details": str(e),
                    "suggestion": "Verifique se o arquivo é uma imagem válida (PNG, JPG, GIF, WebP ou SVG)"
                }
            }
        )


def validate_minimum_aspect_ratio(width: int, height: int) -> None:
    """
    Validate that image has minimum aspect ratio (width/height >= MIN_BANNER_RATIO).
    Raises HTTPException if validation fails.
    """
    aspect_ratio = width / height
    min_allowed = MIN_BANNER_RATIO * (1 - ASPECT_RATIO_TOLERANCE)
    
    if aspect_ratio < min_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_aspect_ratio",
                "message": "Imagem rejeitada: proporção incorreta para banners",
                "details": {
                    "uploaded_dimensions": f"{width}x{height}",
                    "uploaded_ratio": f"{aspect_ratio:.2f}:1",
                    "minimum_required": f"{MIN_BANNER_RATIO}:1",
                    "minimum_allowed_with_tolerance": f"{min_allowed:.2f}:1",
                    "explanation": f"Para banners, a largura deve ser pelo menos {MIN_BANNER_RATIO}x maior que a altura",
                    "examples": [
                        "1200x480 (2.50:1)",
                        "1080x420 (2.57:1)",
                        "900x360 (2.50:1)",
                        "1500x600 (2.50:1)"
                    ],
                    "suggestion": f"Aceita-se a partir de {MIN_BANNER_RATIO}:1"
                }
            }
        )


# ============================================================================
# ADMIN ENDPOINTS - STACKS CONFIGURATION
# ============================================================================

@admin_router.get("/stacks/{target}")
async def get_available_stacks(
    target: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get available navigation stacks for a target.
    Used by admin UI to populate stack selector dropdown.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access stacks configuration"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    stacks = get_stacks_for_target(target)
    return {
        "target": target,
        "stacks": [
            {"name": name, "description": desc}
            for name, desc in stacks.items()
        ]
    }


# ============================================================================
# ADMIN ENDPOINTS - BANNER ADS (MongoDB Storage)
# ============================================================================

@admin_router.post("/banner/upload")
async def upload_banner_images(
    target: str = Form(...),
    files: List[UploadFile] = File(...),
    action_type: str = Form("none"),
    action_value: str = Form(""),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Upload multiple images to banner (stored as Base64 in MongoDB).
    Automatically increments version on each image added.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload banner images"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    # Validate stack if action_type is internal
    if action_type == "internal" and action_value:
        if not validate_stack_for_target(target, action_value):
            valid_stacks = list(get_stacks_for_target(target).keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "invalid_stack",
                    "message": f"Stack '{action_value}' não é válida para target '{target}'",
                    "valid_stacks": valid_stacks
                }
            )
    
    # Ensure banner exists
    await banner_crud.get_or_create_banner(db, target, current_user.id)
    
    uploaded_images = []
    
    for file in files:
        # Validate file type
        fname = file.filename or ""
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext not in ("png", "jpg", "jpeg", "gif", "webp", "svg"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image format: {fname}. Accepted: PNG, JPG, JPEG, GIF, WebP, SVG"
            )
        
        # Read file content
        content = await file.read()
        
        # Check size
        if len(content) > MAX_BANNER_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image {fname} is too large (max 10 MB)"
            )
        
        # Validate dimensions for non-SVG
        if ext != "svg":
            width, height, aspect_ratio = validate_image_dimensions(content)
            validate_minimum_aspect_ratio(width, height)
        
        # Convert to Base64
        image_base64 = base64.b64encode(content).decode('utf-8')
        
        # Determine MIME type
        mime_map = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "webp": "image/webp",
            "svg": "image/svg+xml"
        }
        mime_type = mime_map.get(ext, "image/png")
        
        # Add to database (increments version automatically)
        result = await banner_crud.add_image_to_banner(
            db,
            target,
            image_base64,
            fname,
            mime_type,
            len(content),
            action_type,
            action_value if action_value else None,
            len(uploaded_images),  # order
            current_user.id
        )
        
        if result:
            uploaded_images.append(fname)
    
    # Get updated banner
    banner = await banner_crud.get_banner_by_target(db, target)
    
    return {
        "message": f"{len(uploaded_images)} image(s) uploaded successfully",
        "uploaded_files": uploaded_images,
        "version": banner.version if banner else 0,
        "total_images": len(banner.images) if banner else 0
    }


@admin_router.get("/banner/{target}")
async def get_banner_state(
    target: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current state of banner for a target (client or professional).
    Returns images with Base64 data for preview.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access banner state"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    banner = await banner_crud.get_banner_by_target(db, target)
    
    if not banner or not banner.images:
        return {
            "is_configured": False,
            "target": target,
            "version": 0,
            "images": []
        }
    
    return {
        "is_configured": True,
        "target": target,
        "version": banner.version,
        "images": [
            {
                "filename": img.filename,
                "data": img.data,
                "mime_type": img.mime_type,
                "action_type": img.action_type,
                "action_value": img.action_value,
                "order": img.order,
                "size": img.size
            }
            for img in banner.images
        ],
        "created_at": banner.created_at.isoformat(),
        "updated_at": banner.updated_at.isoformat()
    }


@admin_router.delete("/banner/{target}/{filename}")
async def delete_banner_image(
    target: str,
    filename: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete a specific image from banner by filename.
    Automatically increments version.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete banner images"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    result = await banner_crud.remove_image_from_banner(db, target, filename, current_user.id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image '{filename}' not found in banner '{target}'"
        )
    
    # Get updated banner
    banner = await banner_crud.get_banner_by_target(db, target)
    
    return {
        "message": f"Image '{filename}' deleted successfully",
        "version": banner.version if banner else 0,
        "remaining_images": len(banner.images) if banner else 0
    }


@admin_router.put("/banner/{target}/image/{filename}/action")
async def update_banner_image_action(
    target: str,
    filename: str,
    action_type: str = Form(...),
    action_value: str = Form(""),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update action for a specific banner image.
    Allows individual editing of each image's action without re-uploading.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update banner image actions"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    if action_type not in ["none", "external", "internal"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action_type must be 'none', 'external', or 'internal'"
        )
    
    # Validate stack if action_type is internal
    if action_type == "internal" and action_value:
        if not validate_stack_for_target(target, action_value):
            valid_stacks = list(get_stacks_for_target(target).keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "invalid_stack",
                    "message": f"Stack '{action_value}' não é válida para target '{target}'",
                    "valid_stacks": valid_stacks
                }
            )
    
    result = await banner_crud.update_image_action(
        db,
        target,
        filename,
        action_type,
        action_value if action_value else None,
        current_user.id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image '{filename}' not found in banner '{target}'"
        )
    
    return {
        "message": f"Action for image '{filename}' updated successfully",
        "action_type": action_type,
        "action_value": action_value,
        "version": result.version
    }


@admin_router.delete("/banner/{target}")
async def clear_banner(
    target: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Clear all images from banner.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can clear banner"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    result = await banner_crud.clear_banner(db, target)
    
    return {
        "message": f"Banner '{target}' cleared successfully",
        "deleted": result
    }


# ============================================================================
# ADMIN ENDPOINTS - ADSCREEN ADS (MongoDB Storage)
# ============================================================================

@admin_router.post("/adscreen/upload")
async def upload_adscreen_zip(
    target: str = Form(...),
    file: UploadFile = File(...),
    action_type: str = Form("none"),
    action_value: str = Form(""),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Upload AdScreen ZIP file (stored as Binary in MongoDB).
    Automatically increments version on upload.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload adscreen"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    # Validate stack if action_type is internal
    if action_type == "internal" and action_value:
        if not validate_stack_for_target(target, action_value):
            valid_stacks = list(get_stacks_for_target(target).keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "invalid_stack",
                    "message": f"Stack '{action_value}' não é válida para target '{target}'",
                    "valid_stacks": valid_stacks
                }
            )
    
    # Validate file type
    fname = file.filename or ""
    if not fname.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ZIP files are accepted for AdScreen"
        )
    
    # Read file content
    content = await file.read()
    
    # Check size
    if len(content) > MAX_ZIP_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"ZIP file is too large (max 20 MB)"
        )
    
    # Update or create AdScreen in database
    await adscreen_crud.update_adscreen(
        db,
        target,
        content,
        fname,
        action_type,
        action_value if action_value else None,
        current_user.id
    )
    
    # Get updated adscreen
    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=False)
    
    return {
        "message": f"AdScreen ZIP uploaded successfully",
        "filename": fname,
        "version": adscreen.version if adscreen else 0,
        "size": len(content)
    }


@admin_router.get("/adscreen/{target}")
async def get_adscreen_state(
    target: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current state of AdScreen for a target (client or professional).
    Does not return ZIP data (too large for admin preview).
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access adscreen state"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=False)
    
    if not adscreen:
        return {
            "is_configured": False,
            "target": target,
            "version": 0
        }
    
    return {
        "is_configured": True,
        "target": target,
        "version": adscreen.version,
        "zip_filename": adscreen.zip_filename,
        "zip_size": adscreen.zip_size,
        "action_type": adscreen.action_type,
        "action_value": adscreen.action_value,
        "created_at": adscreen.created_at.isoformat(),
        "updated_at": adscreen.updated_at.isoformat()
    }


@admin_router.delete("/adscreen/{target}")
async def clear_adscreen(
    target: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Clear AdScreen for target.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can clear adscreen"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    result = await adscreen_crud.clear_adscreen(db, target)
    
    return {
        "message": f"AdScreen '{target}' cleared successfully",
        "deleted": result
    }


@admin_router.get("/adscreen/{target}/preview")
async def preview_adscreen(
    target: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Serve AdScreen HTML for preview (extracts index.html from ZIP).
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview adscreen"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=True)
    
    if not adscreen or not adscreen.zip_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AdScreen configured for this target"
        )
    
    try:
        # Extract index.html from ZIP
        zip_bytes = io.BytesIO(adscreen.zip_data)
        with zipfile.ZipFile(zip_bytes, 'r') as zip_ref:
            # Try to find index.html
            index_file = None
            for name in zip_ref.namelist():
                if name.lower().endswith('index.html'):
                    index_file = name
                    break
            
            if not index_file:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No index.html found in ZIP"
                )
            
            html_content = zip_ref.read(index_file).decode('utf-8')
            
            # Add base tag to fix relative paths
            base_tag = f'<base href="/ads-admin/adscreen/{target}/preview/">'
            if '<head>' in html_content.lower():
                html_content = html_content.replace('<head>', f'<head>\n{base_tag}', 1)
            elif '<html>' in html_content.lower():
                html_content = html_content.replace('<html>', f'<html>\n<head>{base_tag}</head>', 1)
            else:
                html_content = f'<head>{base_tag}</head>\n{html_content}'
            
            return HTMLResponse(content=html_content)
    
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid ZIP file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting HTML: {str(e)}"
        )


@admin_router.get("/adscreen/{target}/preview/{file_path:path}")
async def preview_adscreen_file(
    target: str,
    file_path: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Serve individual files from AdScreen ZIP for preview.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview adscreen"
        )
    
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=True)
    
    if not adscreen or not adscreen.zip_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AdScreen configured for this target"
        )
    
    try:
        zip_bytes = io.BytesIO(adscreen.zip_data)
        with zipfile.ZipFile(zip_bytes, 'r') as zip_ref:
            # Try to find the file (case-insensitive)
            file_found = None
            for name in zip_ref.namelist():
                if name.lower() == file_path.lower() or name.endswith(file_path):
                    file_found = name
                    break
            
            if not file_found:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{file_path}' not found in ZIP"
                )
            
            file_content = zip_ref.read(file_found)
            
            # Determine media type based on extension
            import mimetypes
            media_type, _ = mimetypes.guess_type(file_found)
            if not media_type:
                media_type = "application/octet-stream"
            
            return Response(content=file_content, media_type=media_type)
    
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid ZIP file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting file: {str(e)}"
        )


# ============================================================================
# MOBILE ENDPOINTS - BANNER ADS (MongoDB Storage)
# ============================================================================

@mobile_router.get("/banner/{target}/version")
async def get_banner_version(
    target: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current version of banner for mobile sync check.
    Public endpoint (no authentication required).
    """
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    version = await banner_crud.get_banner_version(db, target)
    return {"version": version}


@mobile_router.get("/banner/{target}")
async def sync_banner(
    target: str,
    current_version: Optional[int] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Sync banner images for mobile app.
    Returns images only if current_version is outdated or None.
    Otherwise returns up_to_date flag.
    """
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    banner = await banner_crud.get_banner_by_target(db, target)
    
    if not banner or not banner.images:
        return {
            "version": 0,
            "up_to_date": True,
            "images": []
        }
    
    # Check if client needs update
    if current_version is None or current_version < banner.version:
        return {
            "version": banner.version,
            "images": [
                {
                    "filename": img.filename,
                    "data": img.data,
                    "mime_type": img.mime_type,
                    "action_type": img.action_type,
                    "action_value": img.action_value,
                    "order": img.order
                }
                for img in banner.images
            ],
            "updated_at": banner.updated_at.isoformat(),
            "up_to_date": False
        }
    
    return {
        "version": banner.version,
        "up_to_date": True
    }


# ============================================================================
# MOBILE ENDPOINTS - ADSCREEN ADS (MongoDB Storage)
# ============================================================================

@mobile_router.get("/adscreen/{target}/version")
async def get_adscreen_version(
    target: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current version of AdScreen for mobile sync check.
    Public endpoint (no authentication required).
    """
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    version = await adscreen_crud.get_adscreen_version(db, target)
    return {"version": version}


@mobile_router.get("/adscreen/{target}")
async def sync_adscreen(
    target: str,
    current_version: Optional[int] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Sync AdScreen ZIP for mobile app.
    Returns ZIP (as Base64) only if current_version is outdated or None.
    Otherwise returns up_to_date flag.
    """
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )
    
    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=True)
    
    if not adscreen or not adscreen.zip_data:
        return {
            "version": 0,
            "up_to_date": True,
            "zip_data": None
        }
    
    # Check if client needs update
    if current_version is None or current_version < adscreen.version:
        # Convert binary to Base64 for transmission
        zip_base64 = base64.b64encode(adscreen.zip_data).decode('utf-8')
        
        return {
            "version": adscreen.version,
            "zip_data": zip_base64,
            "zip_filename": adscreen.zip_filename,
            "zip_size": adscreen.zip_size,
            "action_type": adscreen.action_type,
            "action_value": adscreen.action_value,
            "updated_at": adscreen.updated_at.isoformat(),
            "up_to_date": False
        }
    
    return {
        "version": adscreen.version,
        "up_to_date": True
    }


@mobile_router.get("/adscreen/{target}/serve/{file_path:path}")
async def serve_adscreen_file(
    target: str,
    file_path: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Serve individual files from AdScreen ZIP for mobile WebView.
    Public endpoint (no authentication required).
    Allows the mobile app WebView to load the AdScreen HTML and its assets
    directly from the server-side ZIP without needing local extraction.
    """
    if target not in ["client", "professional"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target must be 'client' or 'professional'"
        )

    adscreen = await adscreen_crud.get_adscreen_by_target(db, target, include_zip=True)

    if not adscreen or not adscreen.zip_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AdScreen configured for this target"
        )

    # Default to index.html if no path or empty path
    search_path = file_path.strip("/") if file_path else "index.html"
    if not search_path:
        search_path = "index.html"

    try:
        zip_bytes = io.BytesIO(adscreen.zip_data)
        with zipfile.ZipFile(zip_bytes, 'r') as zip_ref:
            file_found = None
            for name in zip_ref.namelist():
                # Match by exact name or by basename (case-insensitive)
                if name.lower() == search_path.lower() or name.lower().endswith("/" + search_path.lower()):
                    file_found = name
                    break

            if not file_found:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{search_path}' not found in ZIP"
                )

            file_content = zip_ref.read(file_found)

            import mimetypes
            media_type, _ = mimetypes.guess_type(file_found)
            if not media_type:
                media_type = "application/octet-stream"

            return Response(content=file_content, media_type=media_type)

    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid ZIP file"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting file: {str(e)}"
        )


# ==========================================================================
# MOBILE ENDPOINTS - AD CLICK / IMPRESSION TRACKING
# ==========================================================================

@mobile_router.post("/click/{ad_type}")
async def track_ad_click(ad_type: str, request: Request):
    """Track ad clicks for mobile ads."""
    click_logger.info({
        "ad_type": ad_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "remote_addr": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    })
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@mobile_router.post("/impression/{ad_type}")
async def track_ad_impression(ad_type: str, request: Request):
    """Track ad impressions for mobile ads."""
    impression_logger.info({
        "ad_type": ad_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "remote_addr": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    })
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# INCLUDE SUBROUTERS
# ============================================================================

router.include_router(admin_router, prefix="/ads-admin", tags=["ads-admin-mongo"])
router.include_router(mobile_router, prefix="/ads-mobile", tags=["ads-mobile-mongo"])
