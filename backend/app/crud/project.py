from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from ulid import new as new_ulid
from app.models.project import Project, Contact
from app.models.professional_liberation import ProfessionalLiberation
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectFilter


def build_project_query(filters: ProjectFilter = None, query_filter: Optional[dict] = None) -> Dict[str, Any]:
    """
    Helper to build a Mongo query dict from a ProjectFilter or explicit query_filter.
    Returns a dict that can be passed directly to db.projects.find().
    """
    if query_filter:
        return dict(query_filter)

    base_query: Dict[str, Any] = {}
    if not filters:
        return base_query

    # Category matching: support legacy string (category field as string) and dict field with `main`
    if filters.category:
        base_query["$or"] = [
            {"category": filters.category},
            {"category.main": filters.category}
        ]

    # Subcategories (match category.sub field, stored as dict)
    if getattr(filters, 'subcategories', None):
        base_query["category.sub"] = {"$in": filters.subcategories}

    if filters.skills:
        base_query["skills_required"] = {"$in": filters.skills}
    if filters.budget_min:
        base_query["budget_min"] = {"$gte": filters.budget_min}
    if filters.budget_max:
        base_query["budget_max"] = {"$lte": filters.budget_max}
    if filters.status:
        base_query["status"] = filters.status

    # If geolocation filters provided, combine with remote projects
    if filters.latitude and filters.longitude and filters.radius_km:
        geo_or = [
            {"remote_execution": True},  # Include remote projects regardless of location
            {
                "location.coordinates": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [filters.longitude, filters.latitude]
                        },
                        "$maxDistance": filters.radius_km * 1000
                    }
                }
            }
        ]
        if base_query:
            # Both base_query and geo_or must apply (i.e., filter category etc. AND (geo OR remote))
            return {"$and": [base_query, {"$or": geo_or}]}
        return {"$or": geo_or}

    return base_query


def _normalize_project_dict(project_dict: Dict[str, Any]) -> Dict[str, Any]:
    # Normalize legacy coordinate formats (list [lng, lat]) into GeoJSON Point dict
    loc = project_dict.get('location') if isinstance(project_dict, dict) else None
    if isinstance(loc, dict):
        coords = loc.get('coordinates')
        if isinstance(coords, list) and len(coords) == 2:
            # convert [lng, lat] -> {"type":"Point","coordinates":[lng,lat]}
            loc['coordinates'] = {"type": "Point", "coordinates": coords}
            project_dict['location'] = loc
    return project_dict


async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Project]:
    project = await db.projects.find_one({"_id": project_id})
    if project:
        project_dict = dict(project)
        project_dict['_id'] = str(project_dict['_id'])
        project_dict = _normalize_project_dict(project_dict)
        return Project(**project_dict)
    return None

async def get_projects(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, filters: ProjectFilter = None, query_filter: dict = None) -> List[Project]:
    # Build a query dict from filters/query_filter
    query = build_project_query(filters, query_filter)

    projects = []
    async for project in db.projects.find(query).skip(skip).limit(limit):
        project_dict = dict(project)
        project_dict['_id'] = str(project_dict['_id'])
        project_dict = _normalize_project_dict(project_dict)
        projects.append(Project(**project_dict))
    return projects

async def create_project(db: AsyncIOMotorDatabase, project: ProjectCreate, client_id: str) -> Project:
    project_dict = project.dict()
    project_dict["_id"] = str(new_ulid())
    project_dict["client_id"] = client_id
    
    # Fetch client name and add to document
    client = await db.users.find_one({"_id": client_id})
    project_dict["client_name"] = client.get("full_name") if client else None
    
    # Set default remote_execution based on category if not explicitly set
    if "remote_execution" not in project_dict or project_dict["remote_execution"] is None:
        category_name = None
        if isinstance(project_dict.get("category"), dict):
            category_name = project_dict["category"].get("main")
        elif isinstance(project_dict.get("category"), str):
            category_name = project_dict["category"]
        
        if category_name:
            category = await db.categories.find_one({"name": category_name, "is_active": True})
            if category and category.get("default_remote_execution", False):
                project_dict["remote_execution"] = True
            else:
                project_dict["remote_execution"] = False
        else:
            project_dict["remote_execution"] = False
    
    project_dict["status"] = "open"
    project_dict["created_at"] = datetime.now(timezone.utc)
    project_dict["updated_at"] = datetime.now(timezone.utc)
    project_dict["liberado_por"] = []
    project_dict["chat"] = []
    inserted = await db.projects.insert_one(project_dict)
    project_dict['_id'] = inserted.inserted_id
    project_dict['id'] = str(inserted.inserted_id)
    return Project(**project_dict)

async def update_project(db: AsyncIOMotorDatabase, project_id: str, project_update: ProjectUpdate) -> Optional[Project]:
    update_data = {k: v for k, v in project_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.projects.update_one({"_id": project_id}, {"$set": update_data})
    project = await get_project(db, project_id)
    return project

async def refund_credits_for_project(db: AsyncIOMotorDatabase, project_id: str) -> int:
    """
    Refund credits to all professionals who contacted a project before deletion.
    
    Args:
        db: Database connection
        project_id: ID of the project being deleted
    
    Returns:
        Number of professionals refunded
    """
    # Get the project with all contacts
    project = await db.projects.find_one({"_id": project_id})
    if not project:
        return 0
    
    contacts = project.get("contacts", [])
    if not contacts:
        return 0
    
    refund_count = 0
    
    # Refund credits to each professional who contacted the project
    for contact in contacts:
        professional_id = contact.get("professional_id")
        credits_used = contact.get("credits_used", 0)
        
        if not professional_id or credits_used <= 0:
            continue
        
        # Check if user exists before refunding
        user = await db.users.find_one({"_id": professional_id})
        if not user:
            continue
        
        # Record refund transaction (this will also increment the user's credits)
        from app.utils.credit_pricing import record_credit_transaction
        await record_credit_transaction(
            db,
            user_id=professional_id,
            credits=credits_used,  # Positive for refund
            transaction_type="refund",
            metadata={
                "project_id": project_id,
                "reason": "project_deleted",
                "original_credits_used": credits_used
            }
        )
        refund_count += 1
    
    return refund_count


async def delete_project(db: AsyncIOMotorDatabase, project_id: str, refund_credits: bool = True) -> bool:
    """
    Delete a project and optionally refund credits to professionals who contacted it.
    
    Args:
        db: Database connection
        project_id: ID of the project to delete
        refund_credits: Whether to refund credits to professionals (default: True)
    
    Returns:
        True if project was deleted, False otherwise
    """
    # Refund credits before deletion if requested
    if refund_credits:
        await refund_credits_for_project(db, project_id)
    
    result = await db.projects.delete_one({"_id": project_id})
    return result.deleted_count > 0

async def get_more_frequent_categories(db: AsyncIOMotorDatabase) -> List[str]:
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    categories = []
    async for doc in db.projects.aggregate(pipeline):
        categories.append(doc["_id"])
    return categories


async def get_last_projects_category_by_client(db: AsyncIOMotorDatabase, client_id: str, limit: int = 5) -> List[str]:
    pipeline = [
        {"$match": {"client_id": client_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$category"}},
        {"$limit": 5}
    ]
    categories = []
    async for doc in db.projects.aggregate(pipeline):
        categories.append(doc["_id"])
    return categories

#uma função que combine as mais frequentes caterorias de projetos de
#um cliente com as categorias mais frequentes em geral ordenando as 
#categorias do cliente primeiro e se for menor que 5 categorias
#completando com as categorias mais frequentes em geral
async def get_recommended_categories_for_client(db: AsyncIOMotorDatabase, client_id: str) -> List[str]:
    client_categories = await get_last_projects_category_by_client(db, client_id)
    general_categories = await get_more_frequent_categories(db)
    
    recommended = client_categories.copy()
    for category in general_categories:
        if category not in recommended:
            recommended.append(category)
        if len(recommended) >= 5:
            break
    return recommended

# Funções para gerenciar contacts dentro de projects

async def create_contact_in_project(db: AsyncIOMotorDatabase, project_id: str, contact_data: Dict[str, Any], professional_id: str, client_id: str, credits_used: int) -> Optional[Project]:
    # Buscar projeto
    project = await get_project(db, project_id)
    if not project:
        return None
    
    # Buscar users
    professional = await db.users.find_one({"_id": professional_id})
    client = await db.users.find_one({"_id": client_id})
    
    # Criar novo contact
    contact_dict = {
        "professional_id": professional_id,
        "client_id": client_id,
        "contact_type": contact_data.get("contact_type", "proposal"),
        "credits_used": credits_used,
        "status": "pending",
        "contact_details": contact_data.get("contact_details", {}),
        "chats": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Adicionar nomes e user completo
    contact_dict["professional_name"] = professional.get("full_name") if professional else None
    contact_dict["client_name"] = client.get("full_name") if client else None
    contact_dict["professional_user"] = professional
    
    # Adicionar ao array contacts do projeto e ao liberado_por
    await db.projects.update_one(
        {"_id": project_id},
        {
            "$push": {"contacts": contact_dict},
            "$addToSet": {"liberado_por": professional_id}
        }
    )
    
    # Criar registro de liberação para busca rápida
    liberation_dict = {
        "_id": str(new_ulid()),
        "professional_id": professional_id,
        "project_id": project_id,
        "created_at": datetime.utcnow()
    }
    await db.professional_liberations.insert_one(liberation_dict)
    
    # Retornar projeto atualizado
    return await get_project(db, project_id)

async def get_contacts_by_user(db: AsyncIOMotorDatabase, user_id: str, user_type: str = "professional") -> List[Dict[str, Any]]:
    query = {}
    if user_type == "professional":
        query["contacts.professional_id"] = user_id
    else:
        query["contacts.client_id"] = user_id
    
    contacts = []
    async for project in db.projects.find(query, {"contacts": 1, "title": 1, "_id": 1}):
        for contact in project.get("contacts", []):
            if (user_type == "professional" and contact["professional_id"] == user_id) or \
               (user_type == "client" and contact["client_id"] == user_id):
                contact["project_id"] = project["_id"]
                contact["project_title"] = project["title"]
                contacts.append(contact)
    return contacts

async def update_contact_in_project(db: AsyncIOMotorDatabase, project_id: str, contact_index: int, update_data: Dict[str, Any]) -> Optional[Project]:
    update_data["updated_at"] = datetime.utcnow()
    await db.projects.update_one(
        {"_id": project_id},
        {"$set": {f"contacts.{contact_index}": update_data}}
    )
    return await get_project(db, project_id)

async def add_message_to_contact_chat(db: AsyncIOMotorDatabase, project_id: str, contact_index: int, message: Dict[str, Any]) -> Optional[Project]:
    message["timestamp"] = datetime.utcnow()
    await db.projects.update_one(
        {"_id": project_id},
        {"$push": {f"contacts.{contact_index}.chats": message}}
    )
    return await get_project(db, project_id)