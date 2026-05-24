from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.api import router as api_router
from app.routes.tak_ingest import router as tak_router
from app.data import seed
from app.db.sqlite_helper import init_db, db_path
from fastapi import WebSocket
from app.websocket.manager import manager
from app.db.sqlite_helper import get_all


app = FastAPI(title="Stalowy Strażnik - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    # initialize SQLite DB and seed if empty
    init_db()
    seed.seed_if_empty(db_path)
    from app.simulation.engine import engine
    engine.reload()


app.include_router(api_router, prefix="/api")
app.include_router(tak_router, prefix="/api/tak")


@app.websocket("/ws/updates")
async def websocket_updates(ws: WebSocket):
    await manager.connect(ws)
    try:
        # send initial state
        data = get_all()
        await ws.send_json({"type": "init", "payload": data})
        while True:
            msg = await ws.receive_text()
            # ignore client messages for now
            await ws.send_text(msg)
    except Exception:
        manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
