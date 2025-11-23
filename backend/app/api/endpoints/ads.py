from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import JSONResponse
from typing import Optional, List, Literal
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.security import get_current_user
from app.crud.ad_content import get_ad_content_crud
from app.schemas.ad_content import (
    AdContentCreate,
    AdContentUpdate,
    AdContentResponse,
    AdAssignmentCreate,
    AdAssignmentResponse,
    AdContentWithFiles
)
from app.models.user import User

router = APIRouter()


@router.post("/ad-contents", response_model=AdContentResponse, status_code=status.HTTP_201_CREATED)
async def create_ad_content(
   
    ad_content: AdContentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create new ad content (admin only)
    Creates a new advertising content entry and its directory
    """
    # Check if user is admin (you'll need to add this role check)
    # For now, we'll use a simple check - adjust based on your auth system
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create ad content"
        )

    crud = get_ad_content_crud(db)

    try:
        ad = await crud.create(ad_content)
        return AdContentResponse(**ad.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/ad-contents", response_model=List[AdContentResponse])
async def list_ad_contents(
    type: Optional[Literal["publi_screen", "banner"]] = None,
    target: Optional[Literal["client", "professional", "both"]] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all ad contents with optional filters (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list ad contents"
        )

    crud = get_ad_content_crud(db)
    ads = await crud.get_all(type=type, target=target, is_active=is_active)
    return [AdContentResponse(**ad.model_dump()) for ad in ads]


@router.get("/ad-contents/{ad_id}", response_model=AdContentResponse)
async def get_ad_content(
    ad_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get ad content by ID (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view ad contents"
        )

    crud = get_ad_content_crud(db)
    ad = await crud.get_by_id(ad_id)

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )

    return AdContentResponse(**ad.model_dump())


@router.get("/ad-contents/alias/{alias}", response_model=AdContentResponse)
async def get_ad_content_by_alias(
    alias: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get ad content by alias (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view ad contents"
        )

    crud = get_ad_content_crud(db)
    ad = await crud.get_by_alias(alias)

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )

    return AdContentResponse(**ad.model_dump())


@router.put("/ad-contents/{ad_id}", response_model=AdContentResponse)
async def update_ad_content(
    ad_id: str,
    ad_update: AdContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update ad content (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update ad content"
        )

    crud = get_ad_content_crud(db)
    ad = await crud.update(ad_id, ad_update)

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )

    return AdContentResponse(**ad.model_dump())


@router.delete("/ad-contents/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ad_content(
    ad_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete ad content (admin only)
    Deletes the ad content, its files, and all assignments
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete ad content"
        )

    crud = get_ad_content_crud(db)
    deleted = await crud.delete(ad_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )


@router.post("/ad-contents/{ad_id}/files", response_model=AdContentResponse)
async def upload_ad_file(
    ad_id: str,
    file: UploadFile = File(...),
    file_type: Literal["html", "css", "js", "image"] = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Upload a file to ad content (admin only)
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

    crud = get_ad_content_crud(db)

    # Special handling for HTML (index.html)
    if file_type == "html":
        ad = await crud.get_by_id(ad_id)
        if not ad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ad content not found"
            )

        # Save as index.html
        from pathlib import Path
        html_path = Path("./ads") / ad.alias / "index.html"
        html_path.parent.mkdir(parents=True, exist_ok=True)
        with open(html_path, "wb") as f:
            f.write(content)

        return AdContentResponse(**ad.model_dump())
    else:
        # Add other file types
        ad = await crud.add_file(ad_id, file.filename, content, file_type)

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )

    return AdContentResponse(**ad.model_dump())


@router.delete("/ad-contents/{ad_id}/files/{filename}", response_model=AdContentResponse)
async def delete_ad_file(
    ad_id: str,
    filename: str,
    file_type: Literal["css", "js", "image"] = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete a file from ad content (admin only)
    Cannot delete index.html
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete ad files"
        )

    crud = get_ad_content_crud(db)
    ad = await crud.remove_file(ad_id, filename, file_type)

    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad content not found"
        )

    return AdContentResponse(**ad.model_dump())


# Assignment endpoints
@router.post("/ad-assignments", response_model=AdAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_ad_assignment(
    assignment: AdAssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Assign ad content to a location (admin only)
    Replaces any existing assignment for that location
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create ad assignments"
        )

    crud = get_ad_content_crud(db)

    try:
        assignment_obj = await crud.create_assignment(assignment)
        return AdAssignmentResponse(**assignment_obj.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/ad-assignments", response_model=List[AdAssignmentResponse])
async def list_ad_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List all ad assignments (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list ad assignments"
        )

    crud = get_ad_content_crud(db)
    assignments = await crud.get_all_assignments()
    return [AdAssignmentResponse(**a.model_dump()) for a in assignments]


@router.delete("/ad-assignments/{location}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ad_assignment(
    location: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete ad assignment for a location (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete ad assignments"
        )

    crud = get_ad_content_crud(db)
    deleted = await crud.delete_assignment(location)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ad assignment not found"
        )


# Public endpoints for mobile app
@router.get("/public/ads/{location}", response_model=Optional[AdContentWithFiles])
async def get_ad_for_location(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get active ad content for a specific location (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Automatically increments view count
    """
    crud = get_ad_content_crud(db)
    content = await crud.get_active_ad_for_location(location)

    if not content:
        return None

    return AdContentWithFiles(**content)


@router.post("/public/ads/{ad_id}/click", status_code=status.HTTP_204_NO_CONTENT)
async def track_ad_click(
    ad_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Track ad click (public endpoint for mobile app)
    Increments click count for analytics
    """
    crud = get_ad_content_crud(db)
    await crud.increment_clicks(ad_id)
