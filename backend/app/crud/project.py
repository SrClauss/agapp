from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from ulid import new as new_ulid
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectFilter

async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Project]:
    project = await db.projects.find_one({"_id": project_id})
    return Project(**project) if project else None

async def get_projects(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, filters: ProjectFilter = None, query_filter: dict = None) -> List[Project]:
    query = {}
    if query_filter:
        query.update(query_filter)
    elif filters:
        if filters.category:
            query["category"] = filters.category
        if filters.skills:
            query["skills_required"] = {"$in": filters.skills}
        if filters.budget_min:
            query["budget_min"] = {"$gte": filters.budget_min}
        if filters.budget_max:
            query["budget_max"] = {"$lte": filters.budget_max}
        if filters.status:
            query["status"] = filters.status
        if filters.latitude and filters.longitude and filters.radius_km:
            query["location.coordinates"] = {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [filters.longitude, filters.latitude]
                    },
                    "$maxDistance": filters.radius_km * 1000
                }
            }

    projects = []
    async for project in db.projects.find(query).skip(skip).limit(limit):
        projects.append(Project(**project))
    return projects

async def create_project(db: AsyncIOMotorDatabase, project: ProjectCreate, client_id: str) -> Project:
    project_dict = project.dict()
    project_dict["_id"] = str(new_ulid())
    project_dict["client_id"] = client_id
    
    # Fetch client name and add to document
    client = await db.users.find_one({"_id": client_id})
    project_dict["client_name"] = client.get("name") if client else None
    
    project_dict["status"] = "open"
    project_dict["created_at"] = datetime.now(timezone.utc)
    project_dict["updated_at"] = datetime.now(timezone.utc)
    project_dict["liberado_por"] = []
    project_dict["chat"] = []
    await db.projects.insert_one(project_dict)
    return Project(**project_dict)

async def update_project(db: AsyncIOMotorDatabase, project_id: str, project_update: ProjectUpdate) -> Optional[Project]:
    update_data = {k: v for k, v in project_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.projects.update_one({"_id": project_id}, {"$set": update_data})
    project = await get_project(db, project_id)
    return project

async def delete_project(db: AsyncIOMotorDatabase, project_id: str) -> bool:
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