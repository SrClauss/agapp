from typing import Dict, List, Set
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.online_users: Set[str] = set()  # Track online users

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        # Mark user as online
        self.online_users.add(user_id)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Mark user as offline
                self.online_users.discard(user_id)

    async def send_personal_message(self, message: str, user_id: str):
        """Send message via WebSocket OR push notification if offline"""
        # Try WebSocket first
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)
        else:
            # User is offline → send push notification
            await self._send_push_fallback(user_id, message)

    async def _send_push_fallback(self, user_id: str, message: str):
        """Send push notification when user is offline"""
        try:
            from app.core.database import get_database
            from app.core.firebase import send_multicast_notification

            db = await get_database()
            user = await db.users.find_one({"_id": user_id})

            if not user or not user.get("fcm_tokens"):
                return

            # Extract FCM tokens from user's devices
            fcm_tokens = [token_obj["token"] for token_obj in user["fcm_tokens"] if "token" in token_obj]
            if not fcm_tokens:
                return

            # Parse message to create notification
            try:
                msg_data = json.loads(message)
                msg_type = msg_data.get("type")

                # Define title/body based on message type
                if msg_type == "new_message":
                    title = "Nova mensagem"
                    body = "Você recebeu uma nova mensagem"
                    data_payload = {
                        "type": "new_message",
                        "contact_id": str(msg_data.get("contact_id", ""))
                    }
                elif msg_type == "support_message" or msg_type == "support_reply":
                    title = "Resposta do suporte"
                    msg_content = msg_data.get("message", {})
                    body = msg_content.get("message", "Nova mensagem no ticket")[:100]
                    data_payload = {
                        "type": "support_message",
                        "ticket_id": str(msg_data.get("ticket_id", ""))
                    }
                elif msg_type == "new_ticket_message":
                    title = "Nova mensagem no ticket"
                    msg_content = msg_data.get("message", {})
                    body = msg_content.get("message", "Cliente enviou uma mensagem")[:100]
                    data_payload = {
                        "type": "ticket_message",
                        "ticket_id": str(msg_data.get("ticket_id", ""))
                    }
                elif msg_type == "contact_update":
                    title = "Atualização de contato"
                    body = "Status do contato foi atualizado"
                    data_payload = {
                        "type": "contact_update",
                        "contact_id": str(msg_data.get("contact", {}).get("contact_id", ""))
                    }
                elif msg_type == "new_project":
                    title = "Novo projeto próximo"
                    project = msg_data.get("project", {})
                    body = f"{project.get('title', 'Novo projeto')} na sua área"
                    data_payload = {
                        "type": "new_project",
                        "project_id": str(project.get("_id", ""))
                    }
                else:
                    title = "Notificação"
                    body = "Você tem uma nova atualização"
                    data_payload = {"type": msg_type or "notification"}

                # Send push notification
                result = await send_multicast_notification(
                    fcm_tokens=fcm_tokens,
                    title=title,
                    body=body,
                    data=data_payload
                )

                # Remove invalid tokens
                if result.get("invalid_tokens"):
                    await db.users.update_one(
                        {"_id": user_id},
                        {"$pull": {"fcm_tokens": {"token": {"$in": result["invalid_tokens"]}}}}
                    )
                    print(f"Removed {len(result['invalid_tokens'])} invalid FCM tokens")

            except json.JSONDecodeError:
                print(f"Could not parse message as JSON: {message[:100]}")
        except Exception as e:
            print(f"Error in push fallback: {e}")

    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently online"""
        return user_id in self.online_users

    async def broadcast(self, message: str, user_ids: List[str] = None):
        if user_ids:
            for user_id in user_ids:
                await self.send_personal_message(message, user_id)
        else:
            for connections in self.active_connections.values():
                for connection in connections:
                    await connection.send_text(message)

    async def send_notification(self, user_id: str, notification: Dict):
        message = json.dumps({"type": "notification", **notification})
        await self.send_personal_message(message, user_id)

    async def send_new_project_notification(self, project_data: Dict, nearby_user_ids: List[str]):
        message = json.dumps({"type": "new_project", "project": project_data})
        await self.broadcast(message, nearby_user_ids)

    async def send_contact_update(self, contact_data: Dict, user_ids: List[str]):
        message = json.dumps({"type": "contact_update", "contact": contact_data})
        await self.broadcast(message, user_ids)

manager = ConnectionManager()