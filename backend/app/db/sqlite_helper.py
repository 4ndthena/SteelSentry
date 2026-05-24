import sqlite3
import json
import os
from typing import Dict, Any, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(ROOT, "db")
os.makedirs(DB_DIR, exist_ok=True)
db_path = os.path.join(DB_DIR, "stalowy_straznik.db")


def conn():
    return sqlite3.connect(db_path)


def init_db():
    c = conn()
    cur = c.cursor()
    # nodes
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS nodes(
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            lon REAL,
            lat REAL,
            status TEXT,
            metadata TEXT,
            last_update INTEGER
        );
        """
    )
    # links
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS links(
            id TEXT PRIMARY KEY,
            a TEXT,
            b TEXT,
            type TEXT,
            capacity REAL,
            active INTEGER,
            latency_ms REAL,
            metadata TEXT
        );
        """
    )
    # dependencies
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS dependencies(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent TEXT,
            child TEXT
        );
        """
    )
    # events
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS events(
            id TEXT PRIMARY KEY,
            type TEXT,
            payload TEXT,
            ts INTEGER
        );
        """
    )
    c.commit()
    c.close()


def clear_db():
    c = conn()
    cur = c.cursor()
    cur.execute("DELETE FROM nodes;")
    cur.execute("DELETE FROM links;")
    cur.execute("DELETE FROM dependencies;")
    cur.execute("DELETE FROM events;")
    c.commit()
    c.close()


def insert_nodes(nodes: List[Dict[str, Any]]):
    c = conn()
    cur = c.cursor()
    for n in nodes:
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
                n.get("last_update", 0),
            ),
        )
    c.commit()
    c.close()


def insert_links(links: List[Dict[str, Any]]):
    c = conn()
    cur = c.cursor()
    for l in links:
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


def insert_dependencies(deps: List[Dict[str, Any]]):
    c = conn()
    cur = c.cursor()
    for d in deps:
        cur.execute(
            "INSERT INTO dependencies (parent,child) VALUES (?,?);",
            (d["parent"], d["child"]),
        )
    c.commit()
    c.close()


def get_all():
    c = conn()
    cur = c.cursor()
    cur.execute("SELECT id,name,type,lon,lat,status,metadata,last_update FROM nodes;")
    nodes = []
    for row in cur.fetchall():
        nodes.append(
            {
                "id": row[0],
                "name": row[1],
                "type": row[2],
                "lon": row[3],
                "lat": row[4],
                "status": row[5],
                "metadata": json.loads(row[6]) if row[6] else {},
                "last_update": row[7],
            }
        )
    cur.execute("SELECT id,a,b,type,capacity,active,latency_ms,metadata FROM links;")
    links = []
    for row in cur.fetchall():
        links.append(
            {
                "id": row[0],
                "a": row[1],
                "b": row[2],
                "type": row[3],
                "capacity": row[4],
                "active": bool(row[5]),
                "latency_ms": row[6],
                "metadata": json.loads(row[7]) if row[7] else {},
            }
        )
    cur.execute("SELECT parent,child FROM dependencies;")
    deps = []
    for row in cur.fetchall():
        deps.append({"parent": row[0], "child": row[1]})
    c.close()
    return {"nodes": nodes, "links": links, "dependencies": deps}
