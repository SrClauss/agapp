from fastapi import APIRouter, WebSocket, Depends, HTTPException
from app.api.websockets.manager import manager
from app.core.security import get_current_user_from_token
from app.core.database import get_database
from app.crud import support_ticket as ticket_crud
from app.crud import attendant as attendant_crud
from app.crud.user import get_user_by_id
from app.schemas.support_ticket import MessageCreate
import json
from datetime import datetime, timezone
from ulid import new as new_ulid, ULID

router = APIRouter()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # Authenticate via token query param: ?token=JWT
    token = websocket.query_params.get("token")
    db = await get_database()
    if not token:
        await websocket.close(code=1008)
        return

    try:
        current_user = await get_current_user_from_token(token, db)
    except Exception:
        await websocket.close(code=1008)
        return

    # Ensure the token owner matches the requested user_id
    if str(current_user.id) != str(user_id):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # subscribe confirmation
            if message.get("type") == "subscribe_projects":
                await websocket.send_text(json.dumps({"type": "subscribed", "message": "Subscribed to project notifications"}))

            elif message.get("type") == "new_message":
                # Expecting: { type: 'new_message', contact_id: '<id>', content: '...' }
                contact_id = message.get("contact_id")
                content = message.get("content")
                if not contact_id or not content:
                    await websocket.send_text(json.dumps({"type": "error", "message": "contact_id and content required"}))
                    continue

                # Verificar se contato existe
                contact = await db.contacts.find_one({"_id": contact_id})
                if not contact:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Contact not found"}))
                    continue

                # Verificar autorização (só cliente ou profissional do contato)
                is_participant = str(current_user.id) in [
                    str(contact.get("client_id")),
                    str(contact.get("professional_id"))
                ]
                if not is_participant:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Not authorized to chat in this contact"}))
                    continue

                # Criar mensagem com ULID
                msg = {
                    "id": str(new_ulid()),
                    "sender_id": str(current_user.id),
                    "content": content,
                    "created_at": datetime.now(timezone.utc),
                }

                # Adicionar mensagem ao chat do contato
                await db.contacts.update_one(
                    {"_id": contact_id},
                    {"$push": {"chat": msg}, "$set": {"updated_at": datetime.now(timezone.utc)}}
                )
                
                # Mark contact as "in_conversation" if it's the first user message
                from app.utils.contact_helpers import is_first_user_message
                # Re-fetch contact to get updated messages including the one we just added
                updated_contact = await db.contacts.find_one({"_id": contact_id})
                if updated_contact:
                    contact_messages = updated_contact.get("chat", [])
                    if is_first_user_message(contact_messages):
                        await db.contacts.update_one(
                            {"_id": contact_id},
                            {"$set": {"status": "in_conversation"}}
                        )
                
                # Enviar para os 2 participantes (cliente e profissional)
                recipients = [
                    str(contact.get("client_id")),
                    str(contact.get("professional_id"))
                ]

                payload = json.dumps({
                    "type": "new_message",
                    "contact_id": contact_id,
                    "message": msg
                })
                for rid in recipients:
                    await manager.send_personal_message(payload, rid)

            elif message.get("type") == "contact_update":
                contact_id = message.get("contact_id")
                status = message.get("status")
                await manager.send_contact_update({"contact_id": contact_id, "status": status}, [user_id])

            elif message.get("type") == "support_message":
                # Expecting: { type: 'support_message', ticket_id: '<id>', content: '...' }
                ticket_id = message.get("ticket_id")
                content = message.get("content")
                if not ticket_id or not content:
                    await websocket.send_text(json.dumps({"type": "error", "message": "ticket_id and content required"}))
                    continue

                # Verificar se ticket existe
                ticket = await ticket_crud.get_ticket_by_id(db, ticket_id)
                if not ticket:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Ticket not found"}))
                    continue

                # Determinar se é usuário ou atendente
                is_user = str(current_user.id) == str(ticket.user_id)
                is_attendant = False
                sender_type = "user"
                sender_name = current_user.name

                # Verificar se é atendente
                if not is_user:
                    attendant = await attendant_crud.get_attendant_by_id(db, str(current_user.id))
                    if attendant and attendant.is_active:
                        is_attendant = True
                        sender_type = "attendant"
                        sender_name = attendant.name

                # Verificar autorização
                if not (is_user or is_attendant):
                    await websocket.send_text(json.dumps({"type": "error", "message": "Not authorized for this ticket"}))
                    continue

                # Adicionar mensagem ao ticket
                message_create = MessageCreate(message=content, attachments=[])
                new_message = await ticket_crud.add_message_to_ticket(
                    db,
                    ticket_id,
                    message_create,
                    sender_id=str(current_user.id),
                    sender_type=sender_type,
                    sender_name=sender_name
                )

                if not new_message:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Failed to add message"}))
                    continue

                # Enviar para usuário e atendente
                recipients = [ticket.user_id]
                if ticket.attendant_id:
                    recipients.append(ticket.attendant_id)

                payload = json.dumps({
                    "type": "support_message",
                    "ticket_id": ticket_id,
                    "message": {
                        "id": new_message.id,
                        "sender_id": new_message.sender_id,
                        "sender_type": new_message.sender_type,
                        "sender_name": new_message.sender_name,
                        "message": new_message.message,
                        "created_at": new_message.created_at.isoformat(),
                    }
                })

                for rid in recipients:
                    await manager.send_personal_message(payload, rid)

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, user_id)