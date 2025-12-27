from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List
from datetime import datetime
import uuid
import bcrypt
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserInDB

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def get_user(db: AsyncIOMotorDatabase, user_id: str) -> Optional[User]:
    """Busca usuário por ID aceitando tanto string quanto ObjectId."""
    user = None
    # 1) Tenta com string (caso _id tenha sido salvo como string/uuid)
    user = await db.users.find_one({"_id": user_id})
    if not user and ObjectId.is_valid(user_id):
        # 2) Se não encontrou e parecer um ObjectId válido, tenta como ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        # Normalizar _id para string (pydantic espera string via alias)
        if isinstance(user.get("_id"), ObjectId):
            user["_id"] = str(user["_id"]) 
        return User(**user)
    return None


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[User]:
    """Compatibilidade: alias para `get_user` usado por alguns módulos.

    Mantém assinatura antiga `get_user_by_id(db, id)` para evitar ImportError
    quando outros endpoints esperam essa função.
    """
    return await get_user(db, user_id)

async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[User]:
    user = await db.users.find_one({"email": email})
    if user:
        if isinstance(user.get("_id"), ObjectId):
            user["_id"] = str(user["_id"]) 
        return User(**user)
    return None

async def get_user_in_db_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user = await db.users.find_one({"email": email})
    if user:
        if isinstance(user.get("_id"), ObjectId):
            user["_id"] = str(user["_id"])
        # Garantir campos padrão se ausentes
        if "is_active" not in user:
            user["is_active"] = True
        if "created_at" not in user:
            user["created_at"] = datetime.utcnow()
        if "updated_at" not in user:
            user["updated_at"] = datetime.utcnow()
        return UserInDB(**user)
    return None

async def create_user(db: AsyncIOMotorDatabase, user: UserCreate) -> User:
    user_dict = user.dict()
    user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
    user_dict["_id"] = str(uuid.uuid4())
    # Definir campos padrão
    user_dict["is_active"] = True
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    # Model User usa alias _id <- id, então manter _id como string é suficiente
    await db.users.insert_one(user_dict)
    return User(**user_dict)

async def update_user(db: AsyncIOMotorDatabase, user_id: str, user_update: UserUpdate | dict) -> Optional[User]:
    import logging
    logger = logging.getLogger(__name__)
    
    if isinstance(user_update, dict):
        update_data = {k: v for k, v in user_update.items() if v is not None}
    else:
        update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    logger.info("CRUD update_user called for user_id=%s with update_data=%s", user_id, update_data)
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        result = await db.users.update_one({"_id": user_id}, {"$set": update_data})
        logger.info("MongoDB update_one result: matched=%s, modified=%s", result.matched_count, result.modified_count)
    else:
        logger.warning("No update_data provided for user_id=%s", user_id)
    
    user = await get_user(db, user_id)
    logger.info("User after update: cpf=%s", getattr(user, 'cpf', 'NOT_FOUND'))
    return user

async def get_professionals_nearby(db: AsyncIOMotorDatabase, longitude: float, latitude: float, radius_km: float = 10) -> List[User]:
    # Query geoespacial
    query = {
        "coordinates": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [longitude, latitude]
                },
                "$maxDistance": radius_km * 1000  # metros
            }
        },
        "roles": "professional",
        "is_active": True
    }
    professionals = []
    async for user in db.users.find(query):
        if isinstance(user.get("_id"), ObjectId):
            user["_id"] = str(user["_id"]) 
        professionals.append(User(**user))
    return professionals

async def get_users(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100, query_filter: dict = None) -> List[User]:
    if query_filter is None:
        query_filter = {}
    users = []
    async for user in db.users.find(query_filter).skip(skip).limit(limit):
        if isinstance(user.get("_id"), ObjectId):
            user["_id"] = str(user["_id"]) 
        users.append(User(**user))
    return users

async def toggle_user_status(db: AsyncIOMotorDatabase, user_id: str) -> Optional[User]:
    """Alterna o status ativo/inativo do usuário"""
    user = await get_user(db, user_id)
    if not user:
        return None
    
    new_status = not user.is_active
    
    # Usar _id correto para atualização
    query = {"_id": user_id}
    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one({"_id": user_id})
        if not user_doc:
            query = {"_id": ObjectId(user_id)}
    
    await db.users.update_one(query, {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}})
    return await get_user(db, user_id)

async def update_user_profile(db: AsyncIOMotorDatabase, user_id: str, update_data: dict) -> Optional[User]:
    """Atualiza dados do perfil do usuário"""
    if not update_data:
        return await get_user(db, user_id)
    
    update_data["updated_at"] = datetime.utcnow()
    
    # Usar _id correto para atualização
    query = {"_id": user_id}
    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one({"_id": user_id})
        if not user_doc:
            query = {"_id": ObjectId(user_id)}
    
    await db.users.update_one(query, {"$set": update_data})
    return await get_user(db, user_id)

async def get_user_stats(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    """Retorna estatísticas agregadas de um usuário"""
    stats = {
        "total_projects": 0,
        "projects_by_status": {},
        "total_contacts_sent": 0,
        "total_contacts_received": 0,
        "contacts_by_status": {},
        "active_subscription": None,
        "total_credits": 0,
        "total_spent": 0
    }
    
    # Projetos como cliente
    projects_as_client = await db.projects.count_documents({"client_id": user_id})
    stats["total_projects"] = projects_as_client
    
    # Projetos por status
    pipeline = [
        {"$match": {"client_id": user_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    async for doc in db.projects.aggregate(pipeline):
        stats["projects_by_status"][doc["_id"]] = doc["count"]
    
    # Contatos enviados (como cliente)
    stats["total_contacts_sent"] = await db.contacts.count_documents({"client_id": user_id})
    
    # Contatos recebidos (como profissional)
    stats["total_contacts_received"] = await db.contacts.count_documents({"professional_id": user_id})
    
    # Contatos por status
    pipeline = [
        {"$match": {"$or": [{"client_id": user_id}, {"professional_id": user_id}]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    async for doc in db.contacts.aggregate(pipeline):
        stats["contacts_by_status"][doc["_id"]] = doc["count"]
    
    # Assinatura ativa
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    if subscription:
        stats["active_subscription"] = subscription
        # Ensure total_credits set for display
        try:
            stats["total_credits"] = int(subscription.get('credits', 0))
        except Exception:
            stats["total_credits"] = 0
async def delete_user(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    # Antes de deletar, garantir que não vamos apagar o último admin
    # Suportar _id como string e ObjectId
    user = await db.users.find_one({"_id": user_id})
    if not user and ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return False

    is_admin = 'admin' in user.get('roles', [])
    if is_admin:
        # contar quantos admins existem
        admin_count = await db.users.count_documents({"roles": {"$in": ["admin"]}})
        if admin_count <= 1:
            # proibir apagar o último admin
            raise Exception("Cannot delete the last admin user")

    # CASCADE DELETE: Primeiro buscar projetos do usuário para deletar entidades relacionadas
    user_projects = await db.projects.find({"$or": [{"client_id": user_id}, {"professional_id": user_id}]}).to_list(None)
    if ObjectId.is_valid(user_id):
        user_projects_obj = await db.projects.find({"$or": [{"client_id": ObjectId(user_id)}, {"professional_id": ObjectId(user_id)}]}).to_list(None)
        user_projects.extend(user_projects_obj)

    project_ids = [str(p["_id"]) for p in user_projects]

    # CASCADE DELETE: Deletar avaliações relacionadas aos projetos do usuário
    if project_ids:
        await db.evaluations.delete_many({"project_id": {"$in": project_ids}})

    # CASCADE DELETE: Deletar mensagens de chat relacionadas aos projetos
    if project_ids:
        await db.messages.delete_many({"project_id": {"$in": project_ids}})

    # CASCADE DELETE: Deletar documentos relacionados aos projetos
    if project_ids:
        await db.documents.delete_many({"project_id": {"$in": project_ids}})

    # CASCADE DELETE: Deletar projetos relacionados ao usuário
    # Projetos onde o usuário é cliente ou profissional
    await db.projects.delete_many({"$or": [{"client_id": user_id}, {"professional_id": user_id}]})
    if ObjectId.is_valid(user_id):
        await db.projects.delete_many({"$or": [{"client_id": ObjectId(user_id)}, {"professional_id": ObjectId(user_id)}]})

    # CASCADE DELETE: Deletar contatos relacionados ao usuário
    # Contatos criados pelo usuário, relacionados como cliente, ou relacionados a projetos do usuário
    await db.contacts.delete_many({"$or": [{"user_id": user_id}, {"client_id": user_id}]})
    if ObjectId.is_valid(user_id):
        await db.contacts.delete_many({"$or": [{"user_id": ObjectId(user_id)}, {"client_id": ObjectId(user_id)}]})

    # Também deletar contatos relacionados aos projetos do usuário
    if project_ids:
        await db.contacts.delete_many({"project_id": {"$in": project_ids}})

    # CASCADE DELETE: Deletar inscrições relacionadas ao usuário
    await db.subscriptions.delete_many({"user_id": user_id})
    if ObjectId.is_valid(user_id):
        await db.subscriptions.delete_many({"user_id": ObjectId(user_id)})

    # Usar _id correto para deleção do usuário
    query = {"_id": user_id}
    if ObjectId.is_valid(user_id):
        if not await db.users.find_one({"_id": user_id}):
            query = {"_id": ObjectId(user_id)}

    result = await db.users.delete_one(query)
    return result.deleted_count > 0