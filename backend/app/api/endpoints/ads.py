from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from typing import Literal
from pathlib import Path
import base64
import json
import shutil
import os
import tempfile
import jinja2
from PIL import Image
import io

from app.core.security import get_current_user, get_current_user_from_request
from app.models.user import User

router = APIRouter()
admin_router = APIRouter()
mobile_router = APIRouter()

# 4 fixed ad locations - HARDCODED
FIXED_AD_LOCATIONS = [
    "publi_screen_client",
    "publi_screen_professional",
    "banner_client_home",
    "banner_professional_home"
]

ADS_BASE_DIR = Path(__file__).resolve().parents[3] / "ads"

# Tolerance for aspect ratio comparison (5%)
ASPECT_RATIO_TOLERANCE = 0.05
IDEAL_BANNER_RATIO = 3.0
MIN_BANNER_RATIO = 2.5


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


def validate_minimum_aspect_ratio(width: int, height: int, min_ratio: float = MIN_BANNER_RATIO, tolerance: float = ASPECT_RATIO_TOLERANCE, ideal_ratio: float = IDEAL_BANNER_RATIO) -> None:
    """
    Validate that image has minimum aspect ratio (width/height >= min_ratio).
    Raises HTTPException if validation fails.
    """
    aspect_ratio = width / height

    # Allow tolerance on minimum ratio (e.g., min_ratio * (1 - tolerance))
    min_allowed = min_ratio * (1 - tolerance)
    if aspect_ratio < min_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_aspect_ratio",
                "message": "Imagem rejeitada: proporção incorreta para banners",
                "details": {
                    "uploaded_dimensions": f"{width}x{height}",
                        "uploaded_ratio": f"{aspect_ratio:.2f}:1",
                        "minimum_required": f"{min_ratio}:1",
                        "minimum_allowed_with_tolerance": f"{min_allowed:.2f}:1",
                        "ideal_ratio": f"{ideal_ratio:.2f}:1",
                        "explanation": f"Para banners, a largura deve ser pelo menos {min_ratio}x maior que a altura",
                        "examples": [
                        "1200x480 (2.50:1)",
                        "1080x420 (2.57:1)",
                        "900x360 (2.50:1)",
                        "1500x600 (2.50:1)"
                    ],
                    "suggestion": f"Recomendado: 3:1 (ideal). Aceita-se a partir de {min_ratio}:1; valores próximos a {min_ratio}:1 (+- {tolerance*100:.0f}%) também serão aceitos"
                }
            }
        )


def validate_aspect_ratio_consistency(location: str, new_aspect_ratio: float, tolerance: float = ASPECT_RATIO_TOLERANCE) -> None:
    """
    Validate that new image has same aspect ratio as existing images in the location.
    Raises HTTPException if aspect ratios are inconsistent.
    """
    ad_dir = ADS_BASE_DIR / location

    if not ad_dir.exists():
        return  # No existing images, nothing to compare

    # Check all existing images
    existing_ratios = []
    for ext in ["png", "jpg", "jpeg", "gif", "webp"]:
        for img_file in ad_dir.glob(f"*.{ext}"):
            try:
                with open(img_file, "rb") as f:
                    img = Image.open(f)
                    w, h = img.size
                    existing_ratios.append((w / h, img_file.name, f"{w}x{h}"))
            except Exception:
                continue  # Skip invalid images

    if not existing_ratios:
        return  # No valid existing images

    # Compare new ratio with existing ones
    for existing_ratio, filename, dimensions in existing_ratios:
        # Compare using relative percentage tolerance so that larger ratios get an appropriate interval
        ratio_diff = abs(new_aspect_ratio - existing_ratio)
        ratio_relative = ratio_diff / existing_ratio if existing_ratio > 0 else ratio_diff

        if ratio_relative > tolerance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "inconsistent_aspect_ratio",
                    "message": "Imagem rejeitada: proporção inconsistente com o carrossel existente",
                    "details": {
                        "uploaded_ratio": f"{new_aspect_ratio:.2f}:1",
                        "existing_image": filename,
                        "existing_ratio": f"{existing_ratio:.2f}:1",
                        "existing_dimensions": dimensions,
                        "tolerance": f"{tolerance*100:.0f}% (relative)",
                        "difference": f"{ratio_relative*100:.2f}%",
                        "explanation": "Todas as imagens no carrossel devem ter a mesma proporção para evitar deslocamento visual",
                        "solutions": [
                            f"Opção 1: Redimensione sua imagem para ter proporção {existing_ratio:.2f}:1 (similar a '{filename}')",
                            "Opção 2: Delete todas as imagens existentes e faça upload de novas imagens com a mesma proporção"
                        ]
                    }
                }
            )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_ad_files(location: str) -> dict:
    """Read HTML, CSS, JS, and images from ad directory"""
    ad_dir = ADS_BASE_DIR / location
    # Read optional metadata for images (meta.json)
    images_meta = {}
    meta_file = ad_dir / 'meta.json'
    if meta_file.exists():
        try:
            images_meta = json.loads(meta_file.read_text(encoding='utf-8') or '{}').get('images', {})
        except Exception:
            images_meta = {}

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


def render_ad_template(location: str, context: dict | None = None) -> str:
    """Read the index.html for `location`, inject a public base href, render with Jinja2 and return HTML string.

    This reads the file from disk each time (no template cache) so uploads are visible immediately.
    Render is done with an empty or explicit context only (do not pass untrusted request data).
    """
    ad_dir = ADS_BASE_DIR / location
    html_path = ad_dir / "index.html"
    if not html_path.exists() or not html_path.is_file():
        raise FileNotFoundError("Index HTML not found")

    content = html_path.read_text(encoding='utf-8')

    # Inject public base tag so relative assets resolve to /ads/<location>/...
    if '<head' in content.lower():
        import re
        def replace_head(match):
            tag = match.group(0)
            return tag + f"\n<base href='/ads/{location}/' />\n"
        content = re.sub(r"<head[^>]*>", replace_head, content, flags=re.IGNORECASE)
    else:
        content = f"<base href='/ads/{location}/' />\n" + content

    tmpl = jinja2.Template(content)
    return tmpl.render(context or {})


def ad_type_to_location(ad_type: str) -> str | None:
        """Map mobile adType to internal folder name.
        Mobile ad types:
            - publi_client -> publi_screen_client
            - publi_professional -> publi_screen_professional
            - banner_client -> banner_client_home
            - banner_professional -> banner_professional_home
        """
        mapping = {
                "publi_client": "publi_screen_client",
                "publi_professional": "publi_screen_professional",
                "banner_client": "banner_client_home",
                "banner_professional": "banner_professional_home",
        }
        return mapping.get(ad_type)


# ============================================================================
# 1. ADMIN - List all ad locations
# ============================================================================

@admin_router.get("/locations")
async def admin_list_ad_locations(
    current_user: User = Depends(get_current_user_from_request)
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

        # List all files in the directory
        files = []
        # Load metadata if present
        meta_file = ad_dir / 'meta.json'
        images_meta = {}
        if meta_file.exists():
            try:
                images_meta = json.loads(meta_file.read_text(encoding='utf-8') or '{}').get('images', {})
            except Exception:
                images_meta = {}
        if ad_dir.exists():
            for file in ad_dir.iterdir():
                if file.is_file():
                    files.append({
                        "name": file.name,
                        "size": file.stat().st_size,
                        "link": images_meta.get(file.name, {}).get('link') if isinstance(images_meta, dict) else None
                    })

        locations.append({
            "location": location,
            "has_content": has_content,
            "type": "publi_screen" if "publi_screen" in location else "banner",
            "target": "client" if "client" in location else "professional",
            "files": files
        })

    return {"locations": locations}


# ============================================================================
# 2. ADMIN - Upload file to ad location (generic upload)
# ============================================================================

@admin_router.post("/upload/{location}")
async def admin_upload_ad_file(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    file: UploadFile = File(...),
    file_type: Literal["html", "css", "js", "image"] = Form(...),
    current_user: User = Depends(get_current_user_from_request)
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
            detail={
                "error": "invalid_file_type",
                "message": f"Extensão de arquivo inválida para tipo '{file_type}'",
                "details": {
                    "uploaded_file": file.filename,
                    "uploaded_extension": file_ext,
                    "allowed_extensions": allowed_extensions[file_type],
                    "suggestion": f"Por favor, faça upload de um arquivo com uma das extensões permitidas: {', '.join(allowed_extensions[file_type])}"
                }
            }
        )

    # Read file content
    content = await file.read()

    # Max file size: 5MB
    max_size_mb = 5
    max_size_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_size_bytes:
        actual_size_mb = len(content) / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "file_too_large",
                "message": "Arquivo muito grande",
                "details": {
                    "uploaded_file": file.filename,
                    "file_size": f"{actual_size_mb:.2f} MB",
                    "max_allowed": f"{max_size_mb} MB",
                    "suggestion": f"Reduza o tamanho do arquivo para no máximo {max_size_mb}MB antes de fazer upload"
                }
            }
        )

    # Validate image dimensions and aspect ratio (only for images)
    if file_type == "image":
        width, height, aspect_ratio = validate_image_dimensions(content)

        # Only apply the banner proportion restriction and consistency checks for BANNER locations
        if "banner" in location:
            # Validate minimum aspect ratio (2.5:1) with tolerance
            validate_minimum_aspect_ratio(width, height, min_ratio=MIN_BANNER_RATIO)

            # Validate consistency with existing images in the same location (for banners only)
            validate_aspect_ratio_consistency(location, aspect_ratio)

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
    # Write atomically: write to a temp file then replace
    tmp_fd, tmp_path = tempfile.mkstemp(dir=str(ad_dir))
    try:
        with os.fdopen(tmp_fd, "wb") as tmpf:
            tmpf.write(content)
        os.replace(tmp_path, str(file_path))
    finally:
        # Ensure tmp file removed if something went wrong
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    return {"message": f"File uploaded successfully to {location}", "filename": filename}


@admin_router.post("/image/meta/{location}/{filename}")
async def admin_set_image_meta(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    filename: str,
    link: str = Form(None),
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Set metadata for an image (e.g., link) in the ad location. Stores metadata in meta.json under the ad folder.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can set image metadata")

    ad_dir = ADS_BASE_DIR / location
    if not ad_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad location not found")

    file_path = ad_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found")

    # Load existing meta.json if present
    meta_file = ad_dir / 'meta.json'
    meta = {}
    if meta_file.exists():
        try:
            import json
            meta = json.loads(meta_file.read_text(encoding='utf-8') or '{}')
        except Exception:
            meta = {}

    images_meta = meta.get('images', {})
    images_meta[filename] = { 'link': link }
    meta['images'] = images_meta

    # Write back
    try:
        meta_file.write_text(json.dumps(meta), encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to write meta.json: {e}")

    return { 'message': 'Image meta updated', 'filename': filename, 'link': link }


# ============================================================================
# 3. ADMIN - Delete all files in a location folder
# ============================================================================

@admin_router.delete("/delete-all/{location}", status_code=status.HTTP_200_OK)
async def admin_delete_all_files(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    current_user: User = Depends(get_current_user_from_request)
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
        return {"message": f"All files deleted from {location}"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location {location} not found"
        )


@admin_router.post("/delete-all/{location}", status_code=status.HTTP_200_OK)
async def admin_delete_all_files_post(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    current_user: User = Depends(get_current_user_from_request)
):
    """POST fallback for delete-all to support forms without JS"""
    return await admin_delete_all_files(location, current_user)


# ============================================================================
# 4. ADMIN - Delete a specific file in a location
# ============================================================================

@admin_router.delete("/delete-file/{location}/{filename}", status_code=status.HTTP_200_OK)
async def admin_delete_specific_file(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    filename: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Delete a specific file from an ad location (admin only)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete ad files"
        )

    ad_dir = ADS_BASE_DIR / location
    file_path = ad_dir / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {filename} not found in {location}"
        )

    # Security check: ensure file is within the ad directory
    if not str(file_path.resolve()).startswith(str(ad_dir.resolve())):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid file path"
        )

    os.remove(file_path)
    return {"message": f"File {filename} deleted from {location}"}


# ============================================================================
# 5-8. ADMIN - Preview ad content for each location (4 hardcoded functions)
# ============================================================================

@admin_router.get("/preview/publi-screen-client")
async def admin_preview_publi_screen_client(
    current_user: User = Depends(get_current_user_from_request)
):
    """Preview publi_screen_client ad content (admin only)"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview ads"
        )

    content = get_ad_files("publi_screen_client")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@admin_router.get("/preview/publi-screen-professional")
async def admin_preview_publi_screen_professional(
    current_user: User = Depends(get_current_user_from_request)
):
    """Preview publi_screen_professional ad content (admin only)"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview ads"
        )

    content = get_ad_files("publi_screen_professional")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@admin_router.get("/preview/banner-client-home")
async def admin_preview_banner_client_home(
    current_user: User = Depends(get_current_user_from_request)
):
    """Preview banner_client_home ad content (admin only)"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview ads"
        )

    content = get_ad_files("banner_client_home")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@admin_router.get("/preview/banner-professional-home")
async def admin_preview_banner_professional_home(
    current_user: User = Depends(get_current_user_from_request)
):
    """Preview banner_professional_home ad content (admin only)"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview ads"
        )

    content = get_ad_files("banner_professional_home")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


# Admin raw HTML preview - returns the HTML file to be embedded in an iframe
@admin_router.get("/preview-html/{location}")
async def admin_preview_html(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    current_user: User = Depends(get_current_user_from_request)
):
    """Return the raw HTML of an ad's index.html for use in an iframe preview."""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview ads"
        )

    ad_dir = ADS_BASE_DIR / location
    html_path = ad_dir / "index.html"
    if not html_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Index HTML not found")

    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Inject <base> tag into head to allow relative assets to be served from admin assets endpoint
    if '<head' in content.lower():
        # Find the <head> tag and inject base immediately after it
        import re
        def replace_head(match):
            tag = match.group(0)
            return tag + f"\n<base href='/ads-admin/assets/{location}/' />\n"
        content = re.sub(r"<head[^>]*>", replace_head, content, flags=re.IGNORECASE)
    else:
        # fallback: prepend base tag
        content = f"<base href='/ads-admin/assets/{location}/' />\n" + content

    return HTMLResponse(content=content)


@admin_router.get("/preview-images/{location}")
async def admin_preview_images(
        location: Literal[
                "publi_screen_client",
                "publi_screen_professional",
                "banner_client_home",
                "banner_professional_home",
        ],
        current_user: User = Depends(get_current_user_from_request)
):
        """Return a small HTML page that displays images in a carousel for preview."""
        if "admin" not in current_user.roles:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can preview ads")

        ad_dir = ADS_BASE_DIR / location
        if not ad_dir.exists():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ad location not found")

        images = []
        for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
                for img_file in ad_dir.glob(f"*.{ext}"):
                        images.append(img_file.name)

        if len(images) == 0:
                return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)

        # Build a basic HTML with a Bootstrap carousel (linked from CDN)
        slides = []
        for i, name in enumerate(images):
                active = ' active' if i == 0 else ''
                slides.append(f"<div class='carousel-item{active}'><img src='/ads-admin/assets/{location}/{name}' class='d-block w-100' alt='{name}'></div>")

        html = f"""
        <!DOCTYPE html>
        <html lang='pt-br'>
        <head>
            <meta charset='utf-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1'>
            <link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' rel='stylesheet'>
            <style>body {{ padding:10px; background: #f8f9fa; }}</style>
        </head>
        <body>
            <div id='carouselPreview' class='carousel slide' data-bs-ride='carousel'>
                <div class='carousel-inner'>
                    {''.join(slides)}
                </div>
                <!-- Controls removed for simplified autoplay-only preview -->
            </div>
            <script src='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'></script>
        </body>
        </html>
        """
        return HTMLResponse(content=html)


@admin_router.get("/assets/{location}/{filename}")
async def admin_serve_asset(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home"
    ],
    filename: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """Serve image/css/js assets for admin preview or download"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access ad assets"
        )

    asset_path = ADS_BASE_DIR / location / filename
    if not asset_path.exists() or not asset_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    return FileResponse(asset_path)


# ============================================================================
# 9-12. PUBLIC - Get ad content for mobile (4 hardcoded functions)
# ============================================================================

@router.get("/public/publi-screen-client")
async def get_publi_screen_client():
    """
    Get publi_screen_client ad content (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Returns 204 if no ad is configured
    """
    content = get_ad_files("publi_screen_client")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@router.get("/public/publi-screen-professional")
async def get_publi_screen_professional():
    """
    Get publi_screen_professional ad content (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Returns 204 if no ad is configured
    """
    content = get_ad_files("publi_screen_professional")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@router.get("/public/banner-client-home")
async def get_banner_client_home():
    """
    Get banner_client_home ad content (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Returns 204 if no ad is configured
    """
    content = get_ad_files("banner_client_home")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@router.get("/public/banner-professional-home")
async def get_banner_professional_home():
    """
    Get banner_professional_home ad content (public endpoint for mobile app)
    Returns the full HTML/CSS/JS/images ready to be rendered
    Returns 204 if no ad is configured
    """
    content = get_ad_files("banner_professional_home")
    if not content:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
    return content


@router.get("/public/render/{location}")
async def get_rendered_ad_for_mobile(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home",
    ]
):
    """Return rendered HTML (via Jinja2) and assets as JSON for mobile clients.

    Response example:
    {
      "id": "publi_screen_client",
      "html": "<html>...</html>",
      "css": "...",
      "js": "...",
      "images": {"foo.png": "data:image/png;base64,..."}
    }
    """
    try:
        rendered = render_ad_template(location)
    except FileNotFoundError:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)

    # Read CSS and JS if they exist
    css_path = ADS_BASE_DIR / location / "style.css"
    js_path = ADS_BASE_DIR / location / "script.js"

    css_content = css_path.read_text() if css_path.exists() else ""
    js_content = js_path.read_text() if js_path.exists() else ""

    # Find all image files and base64 encode
    images = {}
    ad_dir = ADS_BASE_DIR / location
    if ad_dir.exists():
        for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
            for img_file in ad_dir.glob(f"*.{ext}"):
                with open(img_file, "rb") as f:
                    img_base64 = base64.b64encode(f.read()).decode()
                    images[img_file.name] = f"data:image/{ext};base64,{img_base64}"

    return JSONResponse({
        "id": location,
        "alias": location,
        "type": "html",
        "html": rendered,
        "css": css_content,
        "js": js_content,
        "images": images,
    })


@mobile_router.get("/{ad_type}/check")
async def mobile_check_ad_exists(ad_type: str):
    """Compatibility: mobile check endpoint. Returns whether ad is configured."""
    location = ad_type_to_location(ad_type)
    if not location:
        return JSONResponse(status_code=404, content={"ad_type": ad_type, "exists": False, "configured": False})

    ad_dir = ADS_BASE_DIR / location
    has_content = False
    if ad_dir.exists():
        if (ad_dir / "index.html").exists():
            has_content = True
        else:
            # if no html, check if image files exist in folder
            for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
                if any(ad_dir.glob(f"*.{ext}")):
                    has_content = True
                    break
    return JSONResponse({"ad_type": ad_type, "exists": has_content, "configured": has_content})


@mobile_router.get("/{ad_type}")
async def mobile_get_ad(ad_type: str):
    """Compatibility: mobile ad endpoint. Returns HTML and assets in the mobile JSON format."""
    location = ad_type_to_location(ad_type)
    if not location:
        return JSONResponse(status_code=404, content={"ad_type": ad_type, "html": "", "assets": {}})

    ad_dir = ADS_BASE_DIR / location

    # Load metadata for images (meta.json)
    meta_file = ad_dir / 'meta.json'
    images_meta = {}
    if meta_file.exists():
        try:
            images_meta = json.loads(meta_file.read_text(encoding='utf-8') or '{}').get('images', {})
        except Exception:
            images_meta = {}

    # If no HTML file, but images exist, still return image-only response
    if not ad_dir.exists():
        return JSONResponse(status_code=204, content=None)
    if not (ad_dir / "index.html").exists():
        # if no index.html, but images exist, build image-only response
        images_only = {}
        for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
            for img_file in ad_dir.glob(f"*.{ext}"):
                with open(img_file, "rb") as f:
                    img_base64 = base64.b64encode(f.read()).decode()
                    images_only[img_file.name] = f"data:image/{ext};base64,{img_base64}"

        # Build images list
        images_list = []
        for name, content in images_only.items():
            link = images_meta.get(name, {}).get('link') if isinstance(images_meta, dict) else None
            images_list.append({"filename": name, "content": content, "link": link})

        return JSONResponse({
            "ad_type": ad_type,
            "type": "image",
            "images": images_list,
        })

    # Rendered HTML to be embedded
    rendered = render_ad_template(location)

    # Build assets: style.css, script.js, and images as {type: 'text'|'image', content: '...'}
    assets = {}
    css_path = ad_dir / "style.css"
    js_path = ad_dir / "script.js"
    if css_path.exists():
        assets["style.css"] = {"type": "text", "content": css_path.read_text(encoding='utf-8')}
    if js_path.exists():
        assets["script.js"] = {"type": "text", "content": js_path.read_text(encoding='utf-8')}

    for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
        for img_file in ad_dir.glob(f"*.{ext}"):
            with open(img_file, "rb") as f:
                img_base64 = base64.b64encode(f.read()).decode()
                assets[img_file.name] = {"type": "image", "content": f"data:image/{ext};base64,{img_base64}"}
    # Build images array for clients that prefer a list
    images_list = []
    for key, asset in assets.items():
        if asset.get("type") == "image":
            images_list.append({
                "filename": key,
                "content": asset.get("content"),
                "link": images_meta.get(key, {}).get('link') if isinstance(images_meta, dict) else None,
            })

    return JSONResponse({
        "ad_type": ad_type,
        "type": "html",
        "html": rendered,
        "assets": assets,
        "images": images_list,
    })


# ============================================================================
# Get ad metadata as JSON (for mobile app)
# ============================================================================
@router.get("/{location}/index.html", response_class=JSONResponse)
async def get_ad_json(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home",
    ],
    request: Request,
):
    """Get ad content as JSON for mobile app"""
    file_path = ADS_BASE_DIR / location / "index.html"

    # Check Accept header to determine response type
    accept = request.headers.get("accept", "")

    # If client wants JSON, return JSON with all files
    if "application/json" in accept:
        # If index.html is missing but images exist, return an image-only JSON
        if not file_path.exists() or not file_path.is_file():
            # check for images in dir
            ad_dir = ADS_BASE_DIR / location
            if ad_dir.exists():
                images_only = {}
                for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
                    for img_file in ad_dir.glob(f"*.{ext}"):
                        with open(img_file, "rb") as f:
                            img_base64 = base64.b64encode(f.read()).decode()
                            images_only[img_file.name] = f"data:image/{ext};base64,{img_base64}"
                if images_only:
                    images_list = []
                    for name, content in images_only.items():
                        images_list.append({"filename": name, "content": content, "link": None})
                    return JSONResponse({
                        "id": location,
                        "alias": location,
                        "type": "image",
                        "images": images_only,
                        "images_list": images_list,
                    })
            return JSONResponse(status_code=204)  # No content

        html_content = file_path.read_text()

        # Read CSS and JS if they exist
        css_path = ADS_BASE_DIR / location / "style.css"
        js_path = ADS_BASE_DIR / location / "script.js"

        css_content = css_path.read_text() if css_path.exists() else ""
        js_content = js_path.read_text() if js_path.exists() else ""

        # Find all image files
        images = {}
        ad_dir = ADS_BASE_DIR / location
        if ad_dir.exists():
            for ext in ["png", "jpg", "jpeg", "gif", "webp", "svg"]:
                for img_file in ad_dir.glob(f"*.{ext}"):
                    with open(img_file, "rb") as f:
                        img_base64 = base64.b64encode(f.read()).decode()
                        images[img_file.name] = f"data:image/{ext};base64,{img_base64}"
        # Build images array for clients that prefer a list
        images_list = []
        for name, content in images.items():
            images_list.append({"filename": name, "content": content, "link": None})

        return JSONResponse({
            "id": location,
            "alias": location,
            "type": "html",
            "html": html_content,
            "css": css_content,
            "js": js_content,
            "images": images,
            "images_list": images_list,
            "images_meta": images_meta,
        })

    # Otherwise return the HTML file directly
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Index HTML not found")
    return FileResponse(file_path)


# ============================================================================
# Serve raw ad files publicly (e.g. /ads/publi_screen_client/index.html)
# ============================================================================
@router.get("/{location}/{filename:path}")
async def serve_ad_file(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home",
    ],
    filename: str,
):
    """Serve raw files (index.html, style.css, script.js, images) for a given ad location"""
    ad_dir = ADS_BASE_DIR / location
    file_path = ad_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(file_path)


@router.get("/raw/{location}/{path:path}")
async def serve_ad_file_raw(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home",
    ],
    path: str,
):
    """Serve raw files under /ads/raw/<location>/<path>"""
    file_path = ADS_BASE_DIR / location / path
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(file_path)


@router.get("/{location}/index.html")
async def serve_ad_index_html(
    location: Literal[
        "publi_screen_client",
        "publi_screen_professional",
        "banner_client_home",
        "banner_professional_home",
    ]
):
    """Serve index.html for a location to support legacy /ads/<location>/index.html URLs"""
    # Return rendered page (Jinja2) so uploads are exposed as rendered templates
    try:
        rendered = render_ad_template(location)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Index HTML not found")
    return HTMLResponse(content=rendered, media_type="text/html")


# ============================================================================
# 13. PUBLIC - Track ad clicks (placeholder for analytics)
# ============================================================================

@router.post("/public/click/{location}", status_code=status.HTTP_204_NO_CONTENT)
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
    # Example: append to ads_clicks.log with timestamp and location
    return None
