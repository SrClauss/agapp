from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Any, Optional, Literal
from datetime import datetime, timezone
from app.core.database import get_database
from app.core.security import get_current_user, get_current_admin_user
from app.crud.document import get_documents_by_project
from app.crud.project import get_projects, create_project, update_project, delete_project, get_project
from app.schemas.project import Project, ProjectCreate, ProjectUpdate, ProjectFilter, ProjectClose, EvaluationCreate
from app.schemas.user import User
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

@router.post("/", response_model=Project, status_code=201)
async def create_new_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Geocode address if provided
    from app.services.geocoding import geocode_address
    if project.location.get("address"):
        geocoded = await geocode_address(project.location["address"])
        if geocoded:
            project.location.update(geocoded)
    
    db_project = await create_project(db, project, str(current_user.id))
    return db_project

@router.get("/", response_model=List[Project])
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    skills: List[str] = None,
    budget_min: float = None,
    budget_max: float = None,
    status: str = None,
    subcategories: List[str] = Query(None),
    latitude: float = None,
    longitude: float = None,
    radius_km: float = None,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    filters = ProjectFilter(
        category=category,
        skills=skills,
        subcategories=subcategories,
        budget_min=budget_min,
        budget_max=budget_max,
        status=status,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km
    )
    projects = await get_projects(db, skip=skip, limit=limit, filters=filters)
    # Populate liberado_por_profiles for projects
    prof_ids = list({pid for p in projects for pid in (p.liberado_por or [])})
    if prof_ids:
        prof_cursor = db.users.find({"_id": {"$in": prof_ids}}, {"full_name": 1, "avatar_url": 1})
        profs = {}
        async for prof in prof_cursor:
            profs[str(prof["_id"])] = {
                "id": str(prof["_id"]),
                "name": prof.get("full_name", ""),
                "avatar_url": prof.get("avatar_url")
            }
        for project in projects:
            project.liberado_por_profiles = [profs[pid] for pid in (project.liberado_por or []) if pid in profs]
    return projects

@router.get("/nearby", response_model=List[Project])
async def read_nearby_projects(
    latitude: float,
    longitude: float,
    radius_km: float = 10,
    subcategories: List[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    filters = ProjectFilter(latitude=latitude, longitude=longitude, radius_km=radius_km)
    if subcategories:
        filters.subcategories = subcategories
    projects = await get_projects(db, filters=filters)
    return projects

@router.get("/nearby/non-remote", response_model=List[Project])
async def read_nearby_non_remote_projects(
    latitude: float = None,
    longitude: float = None,
    radius_km: float = None,
    subcategories: List[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Busca projetos NÃO-REMOTOS dentro de um raio específico.

    Se latitude/longitude/radius_km não forem fornecidos, usa as configurações
    salvas do prestador (establishment_coordinates e service_radius_km).

    Retorna apenas projetos com remote_execution=false.
    """
    # Verificar se é prestador
    if "professional" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Only professionals can access this endpoint")

    # Se coordenadas não fornecidas, buscar das configurações do prestador
    if latitude is None or longitude is None or radius_km is None:
        user = await db.users.find_one({"_id": str(current_user.id)})
        professional_info = user.get("professional_info", {})
        settings = professional_info.get("settings", {})

        if not settings:
            raise HTTPException(
                status_code=400,
                detail="No location parameters provided and no professional settings configured"
            )

        coords = settings.get("establishment_coordinates")
        if not coords or len(coords) != 2:
            raise HTTPException(
                status_code=400,
                detail="No valid establishment coordinates configured. Please update your professional settings."
            )

        longitude = coords[0]
        latitude = coords[1]
        radius_km = settings.get("service_radius_km", 10)

    # Buscar projetos não-remotos dentro do raio
    query = {
        "remote_execution": False,  # Apenas projetos NÃO-remotos
        "status": "open",  # Apenas projetos abertos
        "location.coordinates": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [longitude, latitude]
                },
                "$maxDistance": radius_km * 1000  # Converter km para metros
            }
        }
    }
    # If subcategories filter is provided, only include those subcategories
    if subcategories:
        query["category.sub"] = {"$in": subcategories}

    projects = []
    async for project in db.projects.find(query).limit(100):
        project_dict = dict(project)
        project_dict['id'] = str(project_dict.pop('_id'))
        projects.append(Project(**project_dict))

    return projects

@router.get("/my/projects", response_model=List[Project])
async def read_my_projects(
    status: Optional[Literal["open", "closed", "in_progress"]] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all projects for the current user (as client).
    Optionally filter by status (open, closed, in_progress)
    """
    query = {"client_id": str(current_user.id)}
    if status:
        query["status"] = status
    
    projects = []
    async for project in db.projects.find(query).sort("created_at", -1).skip(skip).limit(limit):
        project_dict = dict(project)
        project_dict['id'] = str(project_dict.pop('_id'))
        projects.append(Project(**project_dict))
    
    # Populate client_name for each project
    client_ids = list(set(p.client_id for p in projects if p.client_id))
    if client_ids:
        users_cursor = db.users.find({"_id": {"$in": client_ids}})
        users = {}
        async for user in users_cursor:
            users[str(user["_id"])] = user.get("full_name", "")
        
        for project in projects:
            if project.client_id in users:
                project.client_name = users[project.client_id]
    
    # Populate liberado_por_profiles (profiles of professionals who liberated the project)
    prof_ids = list({pid for p in projects for pid in (p.liberado_por or [])})
    if prof_ids:
        prof_cursor = db.users.find({"_id": {"$in": prof_ids}}, {"full_name": 1, "avatar_url": 1})
        profs = {}
        async for prof in prof_cursor:
            profs[str(prof["_id"])] = {
                "id": str(prof["_id"]),
                "name": prof.get("full_name", ""),
                "avatar_url": prof.get("avatar_url")
            }
        for project in projects:
            project.liberado_por_profiles = [profs[pid] for pid in (project.liberado_por or []) if pid in profs]
    
    return projects

@router.get("/{project_id}", response_model=Project)
async def read_project(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=Project)
async def update_existing_project(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    project = await get_project(db, project_id)
    if not project or str(project.client_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updated_project = await update_project(db, project_id, project_update)
    if not updated_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated_project

# Admin endpoints
@router.get("/admin/", response_model=List[Project])
async def read_projects_admin(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    projects = await get_projects(db, skip=skip, limit=limit)
    return projects

@router.get("/admin/{project_id}", response_model=Project)
async def read_project_admin(
    project_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/admin/{project_id}", response_model=Project)
async def update_project_admin(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    project = await update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/admin/{project_id}")
async def delete_project_admin(
    project_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    success = await delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}

@router.post("/{project_id}/close")
async def close_project(
    project_id: str,
    close_data: ProjectClose,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Close project with final budget. Only the specified professional can close.
    """
    # Get project
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Fetch professional name
    professional = await db.users.find_one({"_id": close_data.professional_id})
    professional_name = professional.get("name") if professional else None
    
    # Update project directly in DB
    from datetime import datetime, timezone
    result = await db.projects.update_one(
        {"_id": project_id}, 
        {"$set": {
            "status": "closed",
            "final_budget": close_data.final_budget,
            "closed_by": close_data.professional_id,
            "closed_by_name": professional_name,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project closed successfully", "project_id": project_id}

@router.post("/{project_id}/evaluate")
async def evaluate_professional(
    project_id: str,
    evaluation: EvaluationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Client evaluates professional after project closure.
    """
    # Get project
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if current user is the client
    if str(current_user.id) != project.client_id:
        raise HTTPException(status_code=403, detail="Only project client can evaluate")
    
    # Check if project is closed
    if project.status != "closed":
        raise HTTPException(status_code=400, detail="Can only evaluate closed projects")
    
    # Check if professional was involved
    if evaluation.professional_id not in project.liberado_por:
        raise HTTPException(status_code=400, detail="Professional was not involved in this project")
    
    # Check if evaluation already exists
    existing_eval = await db.evaluations.find_one({
        "project_id": project_id,
        "client_id": str(current_user.id),
        "professional_id": evaluation.professional_id
    })
    if existing_eval:
        raise HTTPException(status_code=400, detail="Evaluation already exists")
    
    # Create evaluation
    from ulid import new as new_ulid
    from datetime import datetime
    eval_doc = {
        "_id": str(new_ulid()),
        "client_id": str(current_user.id),
        "professional_id": evaluation.professional_id,
        "project_id": project_id,
        "rating": evaluation.rating,
        "comment": evaluation.comment,
        "created_at": datetime.utcnow()
    }
    
    await db.evaluations.insert_one(eval_doc)
    
    # Add to professional's evaluations and recalculate average
    professional = await db.users.find_one({"_id": evaluation.professional_id})
    if professional:
        evaluations = professional.get("evaluations", [])
        evaluations.append({
            "project_id": project_id,
            "rating": evaluation.rating,
            "comment": evaluation.comment,
            "created_at": datetime.utcnow()
        })
        
        # Calculate truncated mean (exclude 10% outliers if >= 20 evaluations)
        ratings = [e["rating"] for e in evaluations]
        if len(ratings) >= 20:
            # Sort and remove 10% from each end
            ratings.sort()
            trim_count = int(len(ratings) * 0.1)
            trimmed_ratings = ratings[trim_count:-trim_count] if trim_count > 0 else ratings
            average = sum(trimmed_ratings) / len(trimmed_ratings) if trimmed_ratings else 0
        else:
            average = sum(ratings) / len(ratings) if ratings else 0
        
        await db.users.update_one(
            {"_id": evaluation.professional_id},
            {
                "$set": {
                    "evaluations": evaluations,
                    "average_rating": round(average, 2)
                }
            }
        )
    
    return {"message": "Evaluation submitted successfully"}

@router.get("/{project_id}/messages/download")
async def download_project_messages(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Download all messages and documents for a project. Only participants can download.
    """
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is participant
    if str(current_user.id) != project.client_id and str(current_user.id) not in project.liberado_por:
        raise HTTPException(status_code=403, detail="Only project participants can download messages")
    
    # Get messages from project.chat
    messages = project.chat or []
    
    # Flatten messages from all chats
    all_messages = []
    for chat in messages:
        all_messages.extend(chat.get("messages", []))
    
    # Get documents for the project
    documents = await get_documents_by_project(db, project_id)
    
    return {
        "messages": all_messages,
        "documents": documents
    }

@router.get("/projects/recomended-categories", response_model=List[str])
async def get_recomended_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get recommended project categories based on user's last projects.
    """
    from app.crud.project import get_last_projects_category_by_client
    categories = await get_last_projects_category_by_client(db, str(current_user.id))
    return categories