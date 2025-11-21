"""
Endpoints de Suporte (SAC)
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.security import get_current_user
from app.crud import support_ticket as ticket_crud
from app.crud import attendant as attendant_crud
from app.crud.user import get_user_by_id
from app.schemas.support_ticket import (
    TicketCreate,
    TicketResponse,
    TicketListResponse,
    MessageCreate,
    MessageResponse,
    TicketUpdate,
    TicketAssign,
    TicketRating
)
from app.api.endpoints.attendant_auth import get_current_attendant

router = APIRouter()


@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Cria novo ticket de suporte"""
    # Busca informações do usuário
    user = await get_user_by_id(db, current_user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Determina tipo de usuário
    user_type = "professional" if "professional" in user.roles else "client"

    # Cria ticket
    ticket = await ticket_crud.create_ticket(
        db,
        ticket_data,
        user_id=current_user_id,
        user_name=user.name,
        user_email=user.email,
        user_type=user_type
    )

    return ticket


@router.get("/tickets/my", response_model=list[TicketResponse])
async def get_my_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista tickets do usuário atual"""
    tickets = await ticket_crud.get_user_tickets(db, current_user_id, skip, limit)
    return tickets


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtém detalhes de um ticket"""
    ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Verifica se usuário tem acesso ao ticket
    if ticket.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this ticket"
        )

    return ticket


@router.post("/tickets/{ticket_id}/messages", response_model=MessageResponse)
async def add_message(
    ticket_id: str,
    message_data: MessageCreate,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Adiciona mensagem a um ticket (usuário)"""
    # Verifica se ticket existe e usuário tem acesso
    ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    if ticket.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this ticket"
        )

    # Busca nome do usuário
    user = await get_user_by_id(db, current_user_id)
    sender_name = user.name if user else "User"

    # Adiciona mensagem
    message = await ticket_crud.add_message_to_ticket(
        db,
        ticket_id,
        message_data,
        sender_id=current_user_id,
        sender_type="user",
        sender_name=sender_name
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add message"
        )

    # Notificar atendente via WebSocket/Push
    if ticket.attendant_id:
        from app.api.websockets.manager import manager
        import json

        payload = json.dumps({
            "type": "new_ticket_message",
            "ticket_id": ticket_id,
            "message": {
                "id": message.id,
                "sender_id": message.sender_id,
                "sender_type": message.sender_type,
                "sender_name": message.sender_name,
                "message": message.message,
                "created_at": message.created_at.isoformat(),
            }
        })
        await manager.send_personal_message(payload, ticket.attendant_id)

    return message


@router.post("/tickets/{ticket_id}/rate", response_model=dict)
async def rate_ticket(
    ticket_id: str,
    rating_data: TicketRating,
    current_user_id: str = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Avalia atendimento de um ticket"""
    # Verifica se ticket existe e usuário tem acesso
    ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    if ticket.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this ticket"
        )

    # Ticket deve estar resolvido ou fechado
    if ticket.status not in ["resolved", "closed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate resolved or closed tickets"
        )

    # Avalia ticket
    success = await ticket_crud.rate_ticket(db, ticket_id, rating_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not rate ticket"
        )

    # Atualiza estatísticas do atendente
    if ticket.attendant_id:
        await attendant_crud.update_attendant_stats(
            db,
            ticket.attendant_id,
            new_rating=rating_data.rating
        )

    return {"message": "Rating submitted successfully"}


# Endpoints para atendentes
@router.get("/attendant/tickets", response_model=list[TicketResponse])
async def get_attendant_tickets(
    status_filter: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista tickets do atendente"""
    tickets = await ticket_crud.get_attendant_tickets(
        db,
        attendant.id,
        status_filter,
        skip,
        limit
    )
    return tickets


@router.get("/attendant/tickets/unassigned", response_model=list[TicketResponse])
async def get_unassigned_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Lista tickets não atribuídos"""
    tickets = await ticket_crud.get_unassigned_tickets(db, skip, limit)
    return tickets


@router.get("/attendant/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket_as_attendant(
    ticket_id: str,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Obtém detalhes de um ticket (atendente)"""
    ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    return ticket


@router.post("/attendant/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str,
    assign_data: TicketAssign,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atribui ticket a um atendente"""
    # Apenas admin/supervisor pode atribuir para outros
    if assign_data.attendant_id != attendant.id:
        if attendant.role not in ["admin", "supervisor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can assign tickets to others"
            )

    # Busca atendente
    target_attendant = await attendant_crud.get_attendant_by_id(
        db,
        assign_data.attendant_id
    )
    if not target_attendant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendant not found"
        )

    # Atribui ticket
    success = await ticket_crud.assign_ticket_to_attendant(
        db,
        ticket_id,
        target_attendant.id,
        target_attendant.name
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not assign ticket"
        )

    return {"message": "Ticket assigned successfully"}


@router.post("/attendant/tickets/{ticket_id}/messages", response_model=MessageResponse)
async def add_attendant_message(
    ticket_id: str,
    message_data: MessageCreate,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Adiciona mensagem a um ticket (atendente)"""
    # Verifica se ticket existe
    ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Adiciona mensagem
    message = await ticket_crud.add_message_to_ticket(
        db,
        ticket_id,
        message_data,
        sender_id=attendant.id,
        sender_type="attendant",
        sender_name=attendant.name
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add message"
        )

    # Notificar usuário via WebSocket/Push
    from app.api.websockets.manager import manager
    import json

    payload = json.dumps({
        "type": "support_reply",
        "ticket_id": ticket_id,
        "message": {
            "id": message.id,
            "sender_id": message.sender_id,
            "sender_type": message.sender_type,
            "sender_name": message.sender_name,
            "message": message.message,
            "created_at": message.created_at.isoformat(),
        }
    })
    await manager.send_personal_message(payload, ticket.user_id)

    return message


@router.put("/attendant/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    ticket_update: TicketUpdate,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Atualiza status/prioridade/categoria de um ticket"""
    ticket = await ticket_crud.update_ticket(db, ticket_id, ticket_update)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Se ticket foi resolvido, atualiza estatísticas
    if ticket_update.status in ["resolved", "closed"] and ticket.attendant_id:
        await attendant_crud.update_attendant_stats(db, ticket.attendant_id)

    return ticket


@router.post("/attendant/tickets/{ticket_id}/messages/{message_id}/read")
async def mark_message_read(
    ticket_id: str,
    message_id: str,
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Marca mensagem como lida"""
    success = await ticket_crud.mark_message_as_read(db, ticket_id, message_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    return {"message": "Message marked as read"}


@router.get("/attendant/stats")
async def get_ticket_stats(
    attendant=Depends(get_current_attendant),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retorna estatísticas gerais dos tickets (apenas admin)"""
    if attendant.role not in ["admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view stats"
        )

    stats = await ticket_crud.get_ticket_stats(db)
    return stats
