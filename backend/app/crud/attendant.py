"""
CRUD operations para Atendentes do SAC
"""
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
from ulid import ULID

from app.models.attendant import Attendant
from app.schemas.attendant import AttendantCreate, AttendantUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Gera hash de senha"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica senha"""
    return pwd_context.verify(plain_password, hashed_password)


async def create_attendant(
    db: AsyncIOMotorDatabase,
    attendant: AttendantCreate,
    created_by: Optional[str] = None
) -> Attendant:
    """Cria novo atendente"""
    attendant_dict = {
        "_id": str(ULID()),
        "name": attendant.name,
        "email": attendant.email,
        "password_hash": get_password_hash(attendant.password),
        "phone": attendant.phone,
        "role": attendant.role,
        "is_active": True,
        "photo_url": None,
        "tickets_attended": 0,
        "average_rating": 0.0,
        "is_online": False,
        "last_seen": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": created_by
    }

    await db.attendants.insert_one(attendant_dict)
    return Attendant(**attendant_dict)


async def get_attendant_by_id(
    db: AsyncIOMotorDatabase,
    attendant_id: str
) -> Optional[Attendant]:
    """Busca atendente por ID"""
    attendant = await db.attendants.find_one({"_id": attendant_id})
    if attendant:
        return Attendant(**attendant)
    return None


async def get_attendant_by_email(
    db: AsyncIOMotorDatabase,
    email: str
) -> Optional[Attendant]:
    """Busca atendente por email"""
    attendant = await db.attendants.find_one({"email": email})
    if attendant:
        return Attendant(**attendant)
    return None


async def authenticate_attendant(
    db: AsyncIOMotorDatabase,
    email: str,
    password: str
) -> Optional[Attendant]:
    """Autentica atendente"""
    attendant = await get_attendant_by_email(db, email)
    if not attendant:
        return None
    if not verify_password(password, attendant.password_hash):
        return None
    if not attendant.is_active:
        return None
    return attendant


async def update_attendant(
    db: AsyncIOMotorDatabase,
    attendant_id: str,
    attendant_update: AttendantUpdate
) -> Optional[Attendant]:
    """Atualiza dados do atendente"""
    update_data = attendant_update.model_dump(exclude_unset=True)
    if not update_data:
        return await get_attendant_by_id(db, attendant_id)

    update_data["updated_at"] = datetime.utcnow()

    result = await db.attendants.update_one(
        {"_id": attendant_id},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    return await get_attendant_by_id(db, attendant_id)


async def update_password(
    db: AsyncIOMotorDatabase,
    attendant_id: str,
    new_password: str
) -> bool:
    """Atualiza senha do atendente"""
    password_hash = get_password_hash(new_password)
    result = await db.attendants.update_one(
        {"_id": attendant_id},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def update_online_status(
    db: AsyncIOMotorDatabase,
    attendant_id: str,
    is_online: bool
) -> bool:
    """Atualiza status online do atendente"""
    update_data = {
        "is_online": is_online,
        "updated_at": datetime.utcnow()
    }

    if not is_online:
        update_data["last_seen"] = datetime.utcnow()

    result = await db.attendants.update_one(
        {"_id": attendant_id},
        {"$set": update_data}
    )
    return result.modified_count > 0


async def get_available_attendants(
    db: AsyncIOMotorDatabase,
    limit: int = 10
) -> List[Attendant]:
    """Retorna atendentes disponíveis (online e com menos tickets ativos)"""
    cursor = db.attendants.find({
        "is_active": True,
        "is_online": True
    }).sort("tickets_attended", 1).limit(limit)

    attendants = []
    async for doc in cursor:
        attendants.append(Attendant(**doc))

    return attendants


async def get_all_attendants(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 50
) -> List[Attendant]:
    """Lista todos os atendentes"""
    cursor = db.attendants.find().skip(skip).limit(limit).sort("created_at", -1)

    attendants = []
    async for doc in cursor:
        attendants.append(Attendant(**doc))

    return attendants


async def update_attendant_stats(
    db: AsyncIOMotorDatabase,
    attendant_id: str,
    new_rating: Optional[int] = None
) -> bool:
    """Atualiza estatísticas do atendente após conclusão de ticket"""
    # Incrementa contador de tickets atendidos
    update_data = {
        "$inc": {"tickets_attended": 1},
        "$set": {"updated_at": datetime.utcnow()}
    }

    # Se houver avaliação, recalcula média
    if new_rating is not None:
        attendant = await get_attendant_by_id(db, attendant_id)
        if attendant:
            total_ratings = attendant.tickets_attended
            current_avg = attendant.average_rating
            new_avg = ((current_avg * total_ratings) + new_rating) / (total_ratings + 1)
            update_data["$set"]["average_rating"] = round(new_avg, 2)

    result = await db.attendants.update_one(
        {"_id": attendant_id},
        update_data
    )
    return result.modified_count > 0


async def delete_attendant(
    db: AsyncIOMotorDatabase,
    attendant_id: str
) -> bool:
    """Desativa atendente (soft delete)"""
    result = await db.attendants.update_one(
        {"_id": attendant_id},
        {"$set": {
            "is_active": False,
            "is_online": False,
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0
