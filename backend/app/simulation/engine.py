import networkx as nx
from app.db.sqlite_helper import get_all, insert_nodes, insert_links
from app.db.sqlite_helper import conn
from app.websocket.manager import manager
import time
import json
from typing import List, Dict, Any


class SimulationEngine:
    def __init__(self):
        self.nodes = {}
        self.links = {}
        self.dep_graph = nx.DiGraph()
        self.comm_graph = nx.Graph()
        try:
            self.reload()
        except Exception:
            # Database tables might not be initialized yet at import time
            pass

    def reload(self):
        data = get_all()
        self.nodes = {n["id"]: n for n in data["nodes"]}
        self.links = {l["id"]: l for l in data["links"]}
        # dependency graph
        self.dep_graph = nx.DiGraph()
        for n in data["nodes"]:
            self.dep_graph.add_node(n["id"], **n)
        for d in data["dependencies"]:
            self.dep_graph.add_edge(d["parent"], d["child"])
        # comm graph
        self.comm_graph = nx.Graph()
        for l in data["links"]:
            attr = dict(l)
            # remove nodes from attr to avoid duplicate kwargs
            attr.pop("a", None)
            attr.pop("b", None)
            # keep link_id instead of id to avoid conflicts
            link_id = attr.pop("id", None)
            if link_id:
                attr["link_id"] = link_id
            self.comm_graph.add_edge(l["a"], l["b"], **attr)

    def persist_node(self, node_id: str):
        n = self.nodes[node_id]
        c = conn()
        cur = c.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO nodes (id,name,type,lon,lat,status,metadata,last_update) VALUES (?,?,?,?,?,?,?,?);",
            (
                n["id"],
                n.get("name", ""),
                n.get("type", "unknown"),
                n["lon"],
                n["lat"],
                n.get("status", "online"),
                json.dumps(n.get("metadata", {})),
                n.get("last_update", int(time.time())),
            ),
        )
        c.commit()
        c.close()

    def persist_link(self, link_id: str):
        l = self.links[link_id]
        c = conn()
        cur = c.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO links (id,a,b,type,capacity,active,latency_ms,metadata) VALUES (?,?,?,?,?,?,?,?);",
            (
                l["id"],
                l["a"],
                l["b"],
                l.get("type", "fiber"),
                l.get("capacity", 1.0),
                1 if l.get("active", True) else 0,
                l.get("latency_ms", 10.0),
                json.dumps(l.get("metadata", {})),
            ),
        )
        c.commit()
        c.close()

    async def apply_drone_strike(self, target_node_id: str):
        # mark node offline, cascade
        if target_node_id not in self.nodes:
            return {"error": "unknown node"}
        self.nodes[target_node_id]["status"] = "offline"
        self.nodes[target_node_id]["last_update"] = int(time.time())
        self.persist_node(target_node_id)
        # broadcast node update
        await manager.send_json({"type": "node_update", "payload": self.nodes[target_node_id]})
        await manager.send_json({
            "type": "alert",
            "payload": {
                "id": f"alert_{int(time.time())}",
                "level": "CRITICAL",
                "title": "Drone Strike",
                "message": f"Drone strike on node {target_node_id}",
                "location": [self.nodes[target_node_id]["lon"], self.nodes[target_node_id]["lat"]],
                "ts": int(time.time()),
            },
        })
        # simple cascade: mark direct dependents degraded or offline
        for child in list(self.dep_graph.successors(target_node_id)):
            # if child was online, degrade it
            if self.nodes[child]["status"] == "online":
                self.nodes[child]["status"] = "degraded"
                self.nodes[child]["last_update"] = int(time.time())
                self.persist_node(child)
                await manager.send_json({"type": "node_update", "payload": self.nodes[child]})
                await manager.send_json({
                    "type": "alert",
                    "payload": {
                        "id": f"alert_{int(time.time())}",
                        "level": "WARNING",
                        "title": "Cascading Degradation",
                        "message": f"Node {child} degraded due to upstream failure",
                        "location": [self.nodes[child]["lon"], self.nodes[child]["lat"]],
                        "ts": int(time.time()),
                    },
                })

        return {"ok": True}

    async def apply_fiber_cut(self, link_id: str):
        if link_id not in self.links:
            return {"error": "unknown link"}
        self.links[link_id]["active"] = False
        self.persist_link(link_id)
        await manager.send_json({"type": "link_update", "payload": self.links[link_id]})
        await manager.send_json({
            "type": "alert",
            "payload": {
                "id": f"alert_{int(time.time())}",
                "level": "WARNING",
                "title": "Fiber Cut",
                "message": f"Fiber link {link_id} is down",
                "ts": int(time.time()),
            },
        })
        return {"ok": True}

    async def restore_node(self, node_id: str):
        if node_id not in self.nodes:
            return {"ok": False, "error": "unknown node"}
        node = self.nodes[node_id]
        prev_status = node.get("status", "unknown")
        node["status"] = "online"
        node["last_update"] = int(time.time())
        self.persist_node(node_id)
        await manager.send_json({"type": "node_update", "payload": node})
        await manager.send_json({
            "type": "alert",
            "payload": {
                "id": f"alert_{int(time.time())}",
                "level": "INFO",
                "title": "Node Restored",
                "message": f"Node {node_id} restored to online (was {prev_status})",
                "location": [node.get("lon", 0), node.get("lat", 0)],
                "ts": int(time.time()),
            },
        })
        return {"ok": True}

    async def restore_link(self, link_id: str):
        if link_id not in self.links:
            return {"ok": False, "error": "unknown link"}
        link = self.links[link_id]
        link["active"] = True
        self.persist_link(link_id)
        await manager.send_json({"type": "link_update", "payload": link})
        await manager.send_json({
            "type": "alert",
            "payload": {
                "id": f"alert_{int(time.time())}",
                "level": "INFO",
                "title": "Link Restored",
                "message": f"Link {link_id} restored to active",
                "ts": int(time.time()),
            },
        })
        return {"ok": True}


engine = SimulationEngine()
