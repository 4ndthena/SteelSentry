from typing import List, Dict, Any
from fastapi import WebSocket
from collections import defaultdict
import asyncio


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def send_json(self, message: Dict[str, Any]):
        to_remove = []
        for ws in list(self.active_connections):
            try:
                await ws.send_json(message)
            except Exception:
                to_remove.append(ws)
        for ws in to_remove:
            self.disconnect(ws)


manager = ConnectionManager()
