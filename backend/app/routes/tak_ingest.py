from fastapi import APIRouter
from app.db.sqlite_helper import conn
from app.simulation.engine import engine
from app.websocket.manager import manager
import json
import time

router = APIRouter()

# global mode: 'ours' | 'tak' | 'ours_synced_with_tak' | 'both'
MODE = {"value": "ours"}


@router.get("/mode")
async def get_mode():
    return {"ok": True, "mode": MODE["value"]}


@router.post("/mode")
async def set_mode(payload: dict):
    m = payload.get("mode")
    if m not in ("ours", "tak", "ours_synced_with_tak", "both"):
        return {"ok": False, "error": "invalid mode"}
    MODE["value"] = m
    return {"ok": True, "mode": m}


def persist_event(ev: dict):
    c = conn()
    cur = c.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO events (id,type,payload,ts) VALUES (?,?,?,?);",
        (
            ev.get("id", f"tak_{int(time.time())}"),
            ev.get("type", "tak_event"),
            json.dumps(ev),
            int(time.time()),
        ),
    )
    c.commit()
    c.close()


@router.post("/ingest")
async def tak_ingest(payload: dict):
    """Accept translated TAK messages from the frontend bridge."""
    t = payload.get("type")
    data = payload.get("data")
    if t == "position":
        node = data
        nid = str(node.get("id") or "")
        if nid and nid in engine.nodes:
            existing = engine.nodes[nid]
            merged = dict(existing)
            merged["lon"] = node.get("lon", merged.get("lon"))
            merged["lat"] = node.get("lat", merged.get("lat"))
            merged["last_update"] = node.get("last_update", int(time.time()))
            merged["status"] = node.get("status", merged.get("status", "online"))
            meta = dict(existing.get("metadata", {}))
            meta["tak"] = node.get("metadata", {})
            merged["metadata"] = meta
            if MODE["value"] == "tak":
                merged["name"] = node.get("name", merged.get("name"))
                merged["type"] = node.get("type", merged.get("type"))
            else:
                merged["name"] = merged.get("name") or node.get("name")
                merged["type"] = merged.get("type") or node.get("type")

            engine.nodes[nid] = merged
            engine.persist_node(nid)
            await manager.send_json({"type": "node_update", "payload": merged})
            return {"ok": True, "merged": True, "id": nid}

        found_id = None
        try:
            lon = float(node.get("lon"))
            lat = float(node.get("lat"))
            threshold = 0.01
            for ex_id, ex in engine.nodes.items():
                if abs(ex.get("lon", 0) - lon) <= threshold and abs(ex.get("lat", 0) - lat) <= threshold:
                    found_id = ex_id
                    break
        except Exception:
            found_id = None

        if found_id:
            existing = engine.nodes[found_id]
            merged = dict(existing)
            merged["lon"] = node.get("lon", merged.get("lon"))
            merged["lat"] = node.get("lat", merged.get("lat"))
            merged["last_update"] = node.get("last_update", int(time.time()))
            merged["status"] = node.get("status", merged.get("status", "online"))
            meta = dict(existing.get("metadata", {}))
            meta["tak"] = node.get("metadata", {})
            merged["metadata"] = meta
            merged["name"] = merged.get("name") or node.get("name")
            merged["type"] = merged.get("type") or node.get("type")
            engine.nodes[found_id] = merged
            engine.persist_node(found_id)
            await manager.send_json({"type": "node_update", "payload": merged})
            return {"ok": True, "merged": True, "id": found_id}

        if not nid:
            nid = f"tak_{int(time.time() * 1000)}"
            node["id"] = nid
        engine.nodes[nid] = node
        engine.persist_node(nid)
        await manager.send_json({"type": "node_update", "payload": node})
        return {"ok": True, "created": True, "id": nid}

    if t == "alert":
        persist_event(data)
        await manager.send_json({"type": "alert", "payload": data})
        return {"ok": True}

    return {"ok": False, "error": "unknown type"}
