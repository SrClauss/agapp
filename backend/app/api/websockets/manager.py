from typing import Dict, List
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)

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