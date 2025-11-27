from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import JSONResponse
from typing import Literal
from pathlib import Path
import base64
import shutil

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# 4 fixed ad locations - HARDCODED
FIXED_AD_LOCATIONS = [
    "publi_screen_client",
    "publi_screen_professional",
    "banner_client_home",
    "banner_professional_home"
]

ADS_BASE_DIR = Path("./ads")


# Helper function to read ad files from disk
def get_ad_files(location: str) -> dict:
    """Read HTML, CSS, JS, and images from ad directory"""
    ad_dir = ADS_BASE_DIR / location

    if not ad_dir.exists():
        return None

    html_file = ad_dir / "index.html"
    if not html_file.exists():
        return None

    # Read HTML
    with open(html_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Read CSS (if exists)
    css_content = ""
    css_file = ad_dir / "style.css"
    if css_file.exists():
        with open(css_file, "r", encoding="utf-8") as f:
            css_content = f.read()

    # Read JS (if exists)
    js_content = ""
    js_file = ad_dir / "script.js"
    if js_file.exists():
        with open(js_file, "r", encoding="utf-8") as f:
            js_content = f.read()

    # Read all images and convert to base64
    images = {}
    for ext in ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.webp"]:
        for img_file in ad_dir.glob(ext):
            with open(img_file, "rb") as f:
                img_data = f.read()
                img_base64 = base64.b64encode(img_data).decode("utf-8")
                # Determine MIME type
                file_ext = img_file.suffix.lower()
                mime_map = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".svg": "image/svg+xml",
                    ".webp": "image/webp"
                }
                mime = mime_map.get(file_ext, "image/png")
                images[img_file.name] = f"data:{mime};base64,{img_base64}"

    return {
        "id": location,
        "alias": location,
        "type": "publi_screen" if "publi_screen" in location else "banner",
        "html": html_content,
        "css": css_content,
        "js": js_content,
        "images": images
    }


@router.get("/ad-locations")
async def list_ad_locations(
    current_user: User = Depends(get_current_user)
):
    """List all 4 fixed ad locations (admin only)"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list ad locations"
        )

    locations = []
    for location in FIXED_AD_LOCATIONS:
        ad_dir = ADS_BASE_DIR / location
        has_content = ad_dir.exists() and (ad_dir / "index.html").exists()
        locations.append({
            "location": location,
            "has_content": has_content,
            "type": "publi_screen" if "publi_screen" in location else "banner",
            "target": "client" if "client" in location else "professional"
        })

    return {"locations": locations}


@router.post("/upload-ad-file/{location}")
async def upload_ad_file(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    file: UploadFile = File(...),
    file_type: Literal["html", "css", "js", "image"] = Form(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file to ad location (admin only)
    Supports HTML, CSS, JS, and image files
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload ad files"
        )

    # Validate file type
    allowed_extensions = {
        "html": [".html", ".htm"],
        "css": [".css"],
        "js": [".js"],
        "image": [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]
    }

    file_ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""

    if file_ext not in allowed_extensions.get(file_type, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension for {file_type} file. Allowed: {allowed_extensions[file_type]}"
        )

    # Read file content
    content = await file.read()

    # Max file size: 5MB
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size must be less than 5MB"
        )

    # Create ad directory if it doesn't exist
    ad_dir = ADS_BASE_DIR / location
    ad_dir.mkdir(parents=True, exist_ok=True)

    # Determine filename
    if file_type == "html":
        filename = "index.html"
    elif file_type == "css":
        filename = "style.css"
    elif file_type == "js":
        filename = "script.js"
    else:  # image
        filename = file.filename

    # Save file
    file_path = ad_dir / filename
    with open(file_path, "wb") as f:
        f.write(content)

    return {"message": f"File uploaded successfully to {location}", "filename": filename}


@router.delete("/delete-ad-files/{location}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_ad_files(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    current_user: User = Depends(get_current_user)
):
    """
    Delete ALL files for an ad location (admin only)
    Removes the entire directory
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete ad files"
        )

    ad_dir = ADS_BASE_DIR / location

    if ad_dir.exists():
        shutil.rmtree(ad_dir)

    return None


# Public endpoints for mobile app
@router.get("/public/ads/{location}")
async def get_ad_for_location(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ]
):
    """
    Get ad content for a specific location (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Returns 204 if no ad is configured for this location

    This is now file-based, no database involved.
    """
    content = get_ad_files(location)

    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)

    return content


@router.post("/public/ads/{location}/click", status_code=status.HTTP_204_NO_CONTENT)
async def track_ad_click(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ]
):
    """
    Track ad click (public endpoint for mobile app)

    For now this is just a placeholder - analytics can be added later
    if needed (e.g., write to a log file)
    """
    # Could log to file here if analytics are needed
    return None
