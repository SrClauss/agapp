from fastapi import APIRouter, WebSocket, Depends, HTTPException
from app.api.websockets.manager import manager
from app.core.security import get_current_user_from_token
from app.core.database import get_database
import json
from datetime import datetime, timezone
from ulid import new as new_ulid

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

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, user_id)