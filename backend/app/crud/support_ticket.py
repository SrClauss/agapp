"""
CRUD operations para Tickets de Suporte
"""
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from ulid import ULID

from app.models.support_ticket import SupportTicket, SupportMessage
from app.schemas.support_ticket import TicketCreate, MessageCreate, TicketUpdate, TicketRating


async def create_ticket(
    db: AsyncIOMotorDatabase,
    ticket_data: TicketCreate,
    user_id: str,
    user_name: str,
    user_email: str,
    user_type: str
) -> SupportTicket:
    """Cria novo ticket de suporte"""
    now = datetime.utcnow()

    # Cria primeira mensagem
    first_message = SupportMessage(
        id=str(ULID()),
        sender_id=user_id,
        sender_type="user",
        sender_name=user_name,
        message=ticket_data.message,
        attachments=[],
        created_at=now,
        read_at=None
    )

    ticket_dict = {
        "_id": str(ULID()),
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "user_type": user_type,
        "subject": ticket_data.subject,
        "category": ticket_data.category,
        "priority": ticket_data.priority,
        "status": "open",
        "attendant_id": None,
        "attendant_name": None,
        "assigned_at": None,
        "messages": [first_message.model_dump()],
        "rating": None,
        "rating_comment": None,
        "rated_at": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "closed_at": None,
        "tags": [],
        "related_project_id": ticket_data.related_project_id,
        "related_payment_id": ticket_data.related_payment_id
    }

    await db.support_tickets.insert_one(ticket_dict)
    return SupportTicket(**ticket_dict)


async def get_ticket_by_id(
    db: AsyncIOMotorDatabase,
    ticket_id: str
) -> Optional[SupportTicket]:
    """Busca ticket por ID"""
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if ticket:
        return SupportTicket(**ticket)
    return None


async def get_user_tickets(
    db: AsyncIOMotorDatabase,
    user_id: str,
    skip: int = 0,
    limit: int = 20
) -> List[SupportTicket]:
    """Lista tickets de um usuário"""
    cursor = db.support_tickets.find(
        {"user_id": user_id}
    ).skip(skip).limit(limit).sort("updated_at", -1)

    tickets = []
    async for doc in cursor:
        tickets.append(SupportTicket(**doc))

    return tickets


async def get_attendant_tickets(
    db: AsyncIOMotorDatabase,
    attendant_id: str,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> List[SupportTicket]:
    """Lista tickets de um atendente"""
    query = {"attendant_id": attendant_id}
    if status_filter:
        query["status"] = status_filter

    cursor = db.support_tickets.find(query).skip(skip).limit(limit).sort("updated_at", -1)

    tickets = []
    async for doc in cursor:
        tickets.append(SupportTicket(**doc))

    return tickets


async def get_unassigned_tickets(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 50
) -> List[SupportTicket]:
    """Lista tickets não atribuídos"""
    cursor = db.support_tickets.find({
        "attendant_id": None,
        "status": {"$in": ["open", "in_progress"]}
    }).skip(skip).limit(limit).sort([("priority", -1), ("created_at", 1)])

    tickets = []
    async for doc in cursor:
        tickets.append(SupportTicket(**doc))

    return tickets


async def add_message_to_ticket(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    message_data: MessageCreate,
    sender_id: str,
    sender_type: str,
    sender_name: str
) -> Optional[SupportMessage]:
    """Adiciona mensagem a um ticket"""
    message = SupportMessage(
        id=str(ULID()),
        sender_id=sender_id,
        sender_type=sender_type,
        sender_name=sender_name,
        message=message_data.message,
        attachments=message_data.attachments,
        created_at=datetime.utcnow(),
        read_at=None
    )

    result = await db.support_tickets.update_one(
        {"_id": ticket_id},
        {
            "$push": {"messages": message.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    if result.modified_count > 0:
        return message
    return None


async def assign_ticket_to_attendant(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    attendant_id: str,
    attendant_name: str
) -> bool:
    """Atribui ticket a um atendente"""
    result = await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": {
            "attendant_id": attendant_id,
            "attendant_name": attendant_name,
            "assigned_at": datetime.utcnow(),
            "status": "in_progress",
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def update_ticket(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    ticket_update: TicketUpdate
) -> Optional[SupportTicket]:
    """Atualiza ticket (status, prioridade, categoria, tags)"""
    update_data = ticket_update.model_dump(exclude_unset=True)
    if not update_data:
        return await get_ticket_by_id(db, ticket_id)

    update_data["updated_at"] = datetime.utcnow()

    # Se status mudou para resolved ou closed, registra timestamp
    if "status" in update_data:
        if update_data["status"] == "resolved":
            update_data["resolved_at"] = datetime.utcnow()
        elif update_data["status"] == "closed":
            update_data["closed_at"] = datetime.utcnow()

    result = await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    return await get_ticket_by_id(db, ticket_id)


async def rate_ticket(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    rating_data: TicketRating
) -> bool:
    """Avalia atendimento de um ticket"""
    result = await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": {
            "rating": rating_data.rating,
            "rating_comment": rating_data.comment,
            "rated_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def mark_message_as_read(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    message_id: str
) -> bool:
    """Marca mensagem como lida"""
    result = await db.support_tickets.update_one(
        {
            "_id": ticket_id,
            "messages.id": message_id
        },
        {"$set": {
            "messages.$.read_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def get_tickets_by_status(
    db: AsyncIOMotorDatabase,
    status: str,
    skip: int = 0,
    limit: int = 50
) -> List[SupportTicket]:
    """Lista tickets por status"""
    cursor = db.support_tickets.find(
        {"status": status}
    ).skip(skip).limit(limit).sort("updated_at", -1)

    tickets = []
    async for doc in cursor:
        tickets.append(SupportTicket(**doc))

    return tickets


async def get_tickets_by_category(
    db: AsyncIOMotorDatabase,
    category: str,
    skip: int = 0,
    limit: int = 50
) -> List[SupportTicket]:
    """Lista tickets por categoria"""
    cursor = db.support_tickets.find(
        {"category": category}
    ).skip(skip).limit(limit).sort("updated_at", -1)

    tickets = []
    async for doc in cursor:
        tickets.append(SupportTicket(**doc))

    return tickets


async def count_unread_messages(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    reader_id: str
) -> int:
    """Conta mensagens não lidas em um ticket (para um leitor específico)"""
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        return 0

    unread_count = 0
    for message in ticket.get("messages", []):
        # Mensagem não lida e não enviada pelo próprio leitor
        if message.get("read_at") is None and message.get("sender_id") != reader_id:
            unread_count += 1

    return unread_count


async def get_ticket_stats(db: AsyncIOMotorDatabase) -> dict:
    """Retorna estatísticas gerais dos tickets"""
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]

    status_counts = {}
    async for doc in db.support_tickets.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    # Conta tickets não atribuídos
    unassigned_count = await db.support_tickets.count_documents({"attendant_id": None})

    # Média de avaliações
    rated_tickets = await db.support_tickets.find({"rating": {"$ne": None}}).to_list(None)
    avg_rating = 0.0
    if rated_tickets:
        avg_rating = sum(t.get("rating", 0) for t in rated_tickets) / len(rated_tickets)

    return {
        "by_status": status_counts,
        "unassigned": unassigned_count,
        "average_rating": round(avg_rating, 2),
        "total": await db.support_tickets.count_documents({})
    }
