from fastapi import APIRouter
from app.db.sqlite_helper import get_all, init_db, db_path
from app.simulation.engine import engine
from app.websocket.manager import manager
from app.data import seed
import networkx as nx
import asyncio

router = APIRouter()


@router.get("/data")
def get_data():
    """Return nodes, links and dependencies"""
    return get_all()


@router.get("/scenarios")
def get_scenarios():
    # lightweight scenario list
    return {
        "scenarios": [
            {"id": "drone_strike", "name": "Coordinated Drone Strike", "description": "Simulate drones attacking critical nodes"},
            {"id": "fiber_cut", "name": "Fiber Cut", "description": "Disrupt a fiber link and observe reroutes"},
            {"id": "comm_blackout", "name": "Communication Blackout", "description": "Simulate jamming affecting multiple towers"},
            {"id": "industrial_disaster", "name": "Industrial Disaster", "description": "Industrial facility accident and cascading effects"},
        ]
    }


@router.get("/path")
def get_path(source: str, target: str):
    """
    Find the shortest active communication path between two nodes.
    Returns node IDs along the path, the link IDs that connect them,
    total hop count, and cumulative latency_ms.
    Only traverses active links (active=True) and online/degraded nodes.
    """
    if source not in engine.nodes:
        return {"ok": False, "error": f"Unknown source node: {source}"}
    if target not in engine.nodes:
        return {"ok": False, "error": f"Unknown target node: {target}"}

    # Build a subgraph with only active links between non-offline nodes
    active_graph = nx.Graph()
    for node_id, node in engine.nodes.items():
        if node.get("status") != "offline":
            active_graph.add_node(node_id)

    link_lookup: dict = {}  # (a, b) -> link_id for result annotation
    for link_id, link in engine.links.items():
        if link.get("active") and link["a"] in active_graph.nodes and link["b"] in active_graph.nodes:
            latency = link.get("latency_ms", 10.0)
            active_graph.add_edge(link["a"], link["b"], weight=latency, link_id=link_id)
            link_lookup[(link["a"], link["b"])] = link_id
            link_lookup[(link["b"], link["a"])] = link_id

    if source not in active_graph or target not in active_graph:
        return {"ok": False, "error": "One or both nodes are offline or unreachable"}

    try:
        node_path = nx.shortest_path(active_graph, source=source, target=target, weight="weight")
    except nx.NetworkXNoPath:
        return {"ok": False, "error": f"No active path found between {source} and {target}"}
    except nx.NodeNotFound as e:
        return {"ok": False, "error": str(e)}

    # Build link path
    link_path = []
    total_latency = 0.0
    for i in range(len(node_path) - 1):
        a, b = node_path[i], node_path[i + 1]
        lid = link_lookup.get((a, b))
        if lid:
            link_path.append(lid)
            total_latency += engine.links[lid].get("latency_ms", 0.0)

    return {
        "ok": True,
        "source": source,
        "target": target,
        "node_path": node_path,
        "link_path": link_path,
        "hops": len(node_path) - 1,
        "total_latency_ms": round(total_latency, 2),
    }


@router.post("/simulate")
async def post_simulate(payload: dict):
    scenario = payload.get("scenario")
    params = payload.get("params", {})
    if scenario == "drone_strike":
        target = params.get("target_node")
        if not target:
            return {"ok": False, "error": "missing target_node"}
        res = await engine.apply_drone_strike(target)
        return res
    if scenario == "fiber_cut":
        link_id = params.get("link_id")
        if not link_id:
            return {"ok": False, "error": "missing link_id"}
        res = await engine.apply_fiber_cut(link_id)
        return res

    return {"ok": False, "error": "unknown scenario"}


# Admin endpoints
@router.post("/admin/reset-db")
async def reset_database():
    """Reset the database by clearing all data and re-seeding."""
    try:
        init_db()
        seed.force_seed(db_path)
        # Reload engine to reflect fresh data
        engine.reload()
        return {"ok": True, "message": "Database reset and re-seeded successfully"}
    except Exception as e:
        return {"ok": False, "error": f"Failed to reset database: {str(e)}"}


@router.post("/admin/reset-connections")
async def reset_connections():
    """Close all active WebSocket connections."""
    try:
        # Make a copy of the list to avoid modification during iteration
        connections = list(manager.active_connections)
        for ws in connections:
            try:
                await ws.close()
            except Exception:
                pass
        manager.active_connections.clear()
        return {"ok": True, "message": f"Closed {len(connections)} WebSocket connections"}
    except Exception as e:
        return {"ok": False, "error": f"Failed to reset connections: {str(e)}"}


@router.post("/admin/restore-node/{node_id}")
async def restore_node(node_id: str):
    """Restore a node to online status."""
    res = await engine.restore_node(node_id)
    return res


@router.post("/admin/restore-link/{link_id}")
async def restore_link(link_id: str):
    """Restore a link to active."""
    res = await engine.restore_link(link_id)
    return res