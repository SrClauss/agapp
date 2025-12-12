from fastapi import APIRouter, Depends, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from typing import List
from app.core.database import get_database
from app.core.security import get_current_user_from_request
from app.core.config import settings
from app.crud.project import get_projects
from app.crud.category import get_categories
from app.schemas.user import User
from app.schemas.project import ProjectFilter
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/dashboard", response_class=HTMLResponse)
async def professional_dashboard(
    request: Request,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Dashboard principal para profissionais"""
    # Verificar se o usuário é profissional
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas profissionais podem acessar esta página.")

    # Buscar projetos abertos
    open_projects = await get_projects(
        db,
        limit=20,
        filters=ProjectFilter(status="open")
    )

    # Se o usuário tem coordenadas, buscar projetos próximos
    nearby_projects = []
    if current_user.coordinates and len(current_user.coordinates) == 2:
        nearby_projects = await get_projects(
            db,
            limit=10,
            filters=ProjectFilter(
                latitude=current_user.coordinates[1],
                longitude=current_user.coordinates[0],
                radius_km=50,
                status="open"
            )
        )

    # Buscar projetos em destaque
    featured_projects = await db.projects.find({
        "is_featured": True,
        "status": "open"
    }).sort("featured_purchased_at", -1).limit(5).to_list(length=5)

    # Converter ObjectId para string se necessário
    from bson import ObjectId
    for project in featured_projects:
        if isinstance(project.get("_id"), ObjectId):
            project["_id"] = str(project["_id"])

    # Estatísticas do profissional
    my_contacts_count = await db.contacts.count_documents({"professional_id": str(current_user.id)})
    completed_projects_count = await db.projects.count_documents({
        "professional_id": str(current_user.id),
        "status": "closed"
    })

    # Buscar categorias para filtros
    categories = await get_categories(db, limit=100, active_only=True)

    return templates.TemplateResponse("professional/dashboard.html", {
        "request": request,
        "current_user": current_user,
        "open_projects": open_projects,
        "nearby_projects": nearby_projects,
        "featured_projects": featured_projects,
        "categories": categories,
        "stats": {
            "contacts": my_contacts_count,
            "completed_projects": completed_projects_count,
            "available_projects": len(open_projects)
        }
    })

@router.get("/projects/map", response_class=HTMLResponse)
async def projects_map_view(
    request: Request,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Visualização de projetos em mapa com geolocalização"""
    # Verificar se o usuário é profissional
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas profissionais podem acessar esta página.")

    # Buscar todos os projetos abertos com localização
    projects_cursor = db.projects.find({
        "status": "open",
        "location.coordinates": {"$exists": True, "$ne": None}
    }).sort("created_at", -1).limit(100)

    projects = await projects_cursor.to_list(length=100)

    # Converter ObjectId para string
    from bson import ObjectId
    for project in projects:
        if isinstance(project.get("_id"), ObjectId):
            project["_id"] = str(project["_id"])

    # Buscar categorias para filtros
    categories = await get_categories(db, limit=100, active_only=True)

    # Coordenadas do profissional (para centralizar o mapa)
    user_location = None
    if current_user.coordinates and len(current_user.coordinates) == 2:
        user_location = {
            "lat": current_user.coordinates[1],
            "lng": current_user.coordinates[0]
        }

    return templates.TemplateResponse("professional/projects_map.html", {
        "request": request,
        "current_user": current_user,
        "projects": projects,
        "categories": categories,
        "user_location": user_location,
        "google_maps_api_key": settings.google_maps_api_key
    })

@router.get("/projects/nearby-json")
async def get_nearby_projects_json(
    latitude: float,
    longitude: float,
    radius_km: float = 50,
    category: str = None,
    subcategories: List[str] = Query(None),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """API JSON para buscar projetos próximos (usado pelo mapa)"""
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    # Construir filtros
    filters = ProjectFilter(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        status="open"
    )

    if category:
        filters.category = category
    if subcategories:
        filters.subcategories = subcategories

    # Buscar projetos
    projects = await get_projects(db, limit=100, filters=filters)

    # Formatar para o mapa
    projects_data = []
    for project in projects:
        if project.location and project.location.get("coordinates"):
            coords = project.location["coordinates"]
            projects_data.append({
                "id": project.id,
                "title": project.title,
                "description": project.description[:200] + "..." if len(project.description) > 200 else project.description,
                "category": project.category,
                "budget_min": project.budget_min,
                "budget_max": project.budget_max,
                "location": {
                    "lat": coords[1],
                    "lng": coords[0],
                    "address": project.location.get("address", "")
                },
                "is_featured": project.is_featured,
                "created_at": project.created_at.isoformat()
            })

    return JSONResponse(content={"projects": projects_data})

@router.get("/profile", response_class=HTMLResponse)
async def professional_profile(
    request: Request,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Perfil do profissional com configurações"""
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    # Buscar projetos do profissional
    my_projects = await db.projects.find({
        "professional_id": str(current_user.id)
    }).sort("created_at", -1).limit(10).to_list(length=10)

    # Converter ObjectId
    from bson import ObjectId
    for project in my_projects:
        if isinstance(project.get("_id"), ObjectId):
            project["_id"] = str(project["_id"])

    return templates.TemplateResponse("professional/profile.html", {
        "request": request,
        "current_user": current_user,
        "my_projects": my_projects
    })
