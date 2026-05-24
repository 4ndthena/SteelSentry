import random
import time
import math
import json
from typing import List

try:
    import requests as req_lib
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from app.db.sqlite_helper import insert_nodes, insert_links, insert_dependencies, conn

# Center of Stalowa Wola, Poland
CENTER_LAT = 50.5740
CENTER_LON = 22.0530

# High-fidelity real locations in Stalowa Wola (used as fallback)
LANDMARKS = [
    {"name": "Huta Stalowa Wola (Defense Complex)", "type": "industrial", "lat": 50.5561, "lon": 22.0620},
    {"name": "Elektrownia Stalowa Wola (Power Plant)", "type": "power", "lat": 50.5620, "lon": 22.0720},
    {"name": "Powiatowy Szpital Specjalistyczny", "type": "hospital", "lat": 50.5755, "lon": 22.0490},
    {"name": "Urząd Miasta (City Hall)", "type": "municipal", "lat": 50.5710, "lon": 22.0545},
    {"name": "Lubomirski Palace (Regional Museum)", "type": "municipal", "lat": 50.5960, "lon": 22.0460},
    {"name": "CID Industrial History Museum", "type": "municipal", "lat": 50.5658, "lon": 22.0578},
    {"name": "Rozwadów Train Station Command", "type": "telecom", "lat": 50.5950, "lon": 22.0515},
    {"name": "San River Tactical Bridge", "type": "bridge", "lat": 50.5925, "lon": 22.0790},
    {"name": "Komenda Policji (Police HQ)", "type": "emergency", "lat": 50.5690, "lon": 22.0560},
    {"name": "Straż Pożarna (Fire HQ)", "type": "emergency", "lat": 50.5695, "lon": 22.0445},
    {"name": "Pogotowie Ratunkowe (Ambulance Depot)", "type": "emergency", "lat": 50.5740, "lon": 22.0460},
    {"name": "Miejski Zakład Komunalny (Water Works)", "type": "water", "lat": 50.5780, "lon": 22.0320},
    {"name": "Capuchin Monastery Comms Mast", "type": "utility", "lat": 50.5975, "lon": 22.0490},
    {"name": "Charzewice Park Reservoirs", "type": "water", "lat": 50.5890, "lon": 22.0380},
    {"name": "Industrial Park South Substation", "type": "industrial", "lat": 50.5360, "lon": 22.0710},
    {"name": "Tactical Telecom Tower (Okulickiego)", "type": "telecom", "lat": 50.5715, "lon": 22.0510},
    {"name": "St. Florian Historic Wooden Sector", "type": "municipal", "lat": 50.5525, "lon": 22.0550},
    {"name": "Water Tower & Pump Substation", "type": "water", "lat": 50.5810, "lon": 22.0620},
    {"name": "Rozwadów Crossing (Northern Bridge)", "type": "bridge", "lat": 50.6035, "lon": 22.0690},
    {"name": "Solidarity Monument Comms Hub", "type": "telecom", "lat": 50.5670, "lon": 22.0520},
]


OVERPASS_QUERY = """
[out:json][timeout:30];
(
  nwr["power"~"substation|plant|generator"](around:4000,50.5740,22.0530);
  nwr["amenity"~"hospital|police|fire_station|townhall"](around:4000,50.5740,22.0530);
  nwr["tower:type"="communication"](around:4000,50.5740,22.0530);
  nwr["man_made"~"water_tower|water_works|mast|chimney"](around:4000,50.5740,22.0530);
  nwr["industrial"](around:4000,50.5740,22.0530);
  nwr["office"="government"](around:4000,50.5740,22.0530);
  nwr["water"~"plant|tower|reservoir"](around:4000,50.5740,22.0530);
  nwr["railway"="station"](around:4000,50.5740,22.0530);
  nwr["telecom"](around:4000,50.5740,22.0530);
  nwr["bridge"~"yes|movable|fixed"](around:4000,50.5740,22.0530);
);
out center;
"""


OSM_TYPE_MAP = {
    "power=plant": "power",
    "power=substation": "power",
    "power=generator": "power",
    "amenity=hospital": "hospital",
    "amenity=police": "emergency",
    "amenity=fire_station": "emergency",
    "amenity=townhall": "municipal",
    "tower:type=communication": "telecom",
    "telecom=": "telecom",
    "man_made=water_tower": "water",
    "man_made=water_works": "water",
    "man_made=mast": "telecom",
    "man_made=chimney": "industrial",
    "industrial=": "industrial",
    "office=government": "municipal",
    "water=reservoir": "water",
    "water=tower": "water",
    "water=plant": "water",
    "railway=station": "telecom",
    "bridge=yes": "bridge",
    "bridge=movable": "bridge",
    "bridge=fixed": "bridge",
}


def _classify_osm(tags: dict) -> str:
    for key, value in tags.items():
        tag_str = f"{key}={value}"
        if tag_str in OSM_TYPE_MAP:
            return OSM_TYPE_MAP[tag_str]
        if key in ("power", "telecom", "industrial"):
            return key
        if key == "amenity" and value in ("hospital", "police", "fire_station", "townhall"):
            return {"hospital": "hospital", "police": "emergency", "fire_station": "emergency", "townhall": "municipal"}[value]
        if key == "man_made" and value in ("water_tower", "water_works", "mast", "chimney"):
            return {"water_tower": "water", "water_works": "water", "mast": "telecom", "chimney": "industrial"}[value]
        if key == "water" and value in ("reservoir", "tower", "plant"):
            return "water"
        if key == "bridge" and value in ("yes", "movable", "fixed"):
            return "bridge"
        if key == "railway" and value == "station":
            return "telecom"
    return "utility"


def _get_coords(el: dict) -> tuple:
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    return lat, lon


def _deduplicate(nodes: list) -> list:
    seen = set()
    result = []
    for n in nodes:
        key = (round(n["lat"], 5), round(n["lon"], 5), n["type"])
        if key not in seen:
            seen.add(key)
            result.append(n)
    return result


def fetch_real_nodes() -> list:
    """Fetch real infrastructure nodes from OpenStreetMap via Overpass API."""
    if not HAS_REQUESTS:
        print("WARN: requests library not available, falling back to generated nodes")
        return []
    try:
        resp = req_lib.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": OVERPASS_QUERY},
            headers={"User-Agent": "StalowyStraznik/1.0", "Accept": "application/json"},
            timeout=30
        )
        if resp.status_code != 200:
            print(f"WARN: Overpass API returned {resp.status_code}, falling back")
            return []
        data = resp.json()
        elements = data.get("elements", [])
        print(f"Overpass API returned {len(elements)} raw elements")
        nodes = []
        idx = 1
        seen_names = set()
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "").strip()
            lat, lon = _get_coords(el)
            if not lat or not lon:
                continue
            node_type = _classify_osm(tags)
            # Skip fire hydrants (too many, not relevant)
            if tags.get("emergency") == "fire_hydrant":
                continue
            # Skip unnamed defibrillators
            if tags.get("emergency") == "defibrillator" and not name:
                continue
            # Skip unnamed elements unless they're important infrastructure types
            if not name:
                # Allow unnamed power substations/plants and hospitals
                if tags.get("power") in ("substation", "plant", "generator"):
                    display_name = f"{tags.get('power', 'Power').capitalize()} Station {idx}"
                else:
                    continue
            else:
                display_name = name
            # Deduplicate by name
            if name and name in seen_names:
                continue
            if name:
                seen_names.add(name)
            nodes.append({
                "id": f"n{idx}",
                "name": display_name,
                "type": node_type,
                "lon": lon,
                "lat": lat,
                "status": "online",
                "metadata": {"capacity": round(random.uniform(1.0, 2.0), 2)},
                "last_update": int(time.time()),
            })
            idx += 1
        print(f"Processed {len(nodes)} real infrastructure nodes")
        return nodes
    except Exception as e:
        print(f"WARN: Overpass API error: {e}, falling back to generated nodes")
        return []


def jitter(lat, lon, meters=300):
    dlat = (random.uniform(-1, 1) * meters) / 111000.0
    dlon = (random.uniform(-1, 1) * meters) / (111000.0 * math.cos(math.radians(lat)))
    return lat + dlat, lon + dlon


def generate_nodes(count=50):
    nodes = []
    idx = 1
    for lm in LANDMARKS:
        node = {
            "id": f"n{idx}",
            "name": lm["name"],
            "type": lm["type"],
            "lon": lm["lon"],
            "lat": lm["lat"],
            "status": "online",
            "metadata": {"capacity": round(random.uniform(1.0, 2.0), 2)},
            "last_update": int(time.time()),
        }
        nodes.append(node)
        idx += 1
    types = ["telecom", "utility", "emergency", "water", "power"]
    while len(nodes) < count:
        parent = random.choice(LANDMARKS)
        lat, lon = jitter(parent["lat"], parent["lon"], meters=random.randint(400, 1500))
        t = random.choice(types)
        node = {
            "id": f"n{idx}",
            "name": f"{t.capitalize()} Node {idx} ({parent['name'].split('(')[0].strip()})",
            "type": t,
            "lon": lon,
            "lat": lat,
            "status": "online",
            "metadata": {"capacity": round(random.uniform(0.5, 1.2), 2)},
            "last_update": int(time.time()),
        }
        nodes.append(node)
        idx += 1
    return nodes


def generate_links(nodes):
    links = []
    telecoms = [n for n in nodes if n["type"] == "telecom"]
    power = [n for n in nodes if n["type"] == "power"]
    others = [n for n in nodes if n["type"] not in ("telecom", "power")]

    # 1. Fiber ring between telecoms
    for i in range(len(telecoms)):
        a = telecoms[i]
        b = telecoms[(i + 1) % len(telecoms)]
        links.append({
            "id": f"l_fiber_{a['id']}_{b['id']}",
            "a": a["id"],
            "b": b["id"],
            "type": "fiber",
            "capacity": 10.0,
            "active": True,
            "latency_ms": round(random.uniform(1, 8), 2),
            "metadata": {}
        })

    # 2. Power lines
    for p in power:
        targets = [n for n in nodes if n["id"] != p["id"]]
        targets.sort(key=lambda n: math.hypot(n["lat"] - p["lat"], n["lon"] - p["lon"]))
        for t in targets[:3]:
            links.append({
                "id": f"l_mpls_{p['id']}_{t['id']}",
                "a": p["id"],
                "b": t["id"],
                "type": "mpls",
                "capacity": 5.0,
                "active": True,
                "latency_ms": round(random.uniform(3, 12), 2),
                "metadata": {}
            })

    # 3. LTE backup links
    for n in others:
        if telecoms:
            peer = random.choice(telecoms)
            links.append({
                "id": f"l_lte_{n['id']}_{peer['id']}",
                "a": n["id"],
                "b": peer["id"],
                "type": "lte",
                "capacity": 2.5,
                "active": True,
                "latency_ms": round(random.uniform(15, 45), 2),
                "metadata": {}
            })

    # 4. LoRa mesh
    for i in range(len(nodes)):
        a = nodes[i]
        neighbors = [n for n in nodes if n["id"] != a["id"]]
        neighbors.sort(key=lambda n: math.hypot(n["lat"] - a["lat"], n["lon"] - a["lon"]))
        for n in neighbors[:2]:
            dist = math.hypot(n["lat"] - a["lat"], n["lon"] - a["lon"])
            if dist < 0.015:
                exists = any(
                    (l["a"] == a["id"] and l["b"] == n["id"]) or (l["a"] == n["id"] and l["b"] == a["id"])
                    for l in links
                )
                if not exists:
                    links.append({
                        "id": f"l_lora_{a['id']}_{n['id']}",
                        "a": a["id"],
                        "b": n["id"],
                        "type": "loramesh",
                        "capacity": 0.5,
                        "active": True,
                        "latency_ms": round(random.uniform(40, 150), 2),
                        "metadata": {}
                    })

    # 5. Starlink backup
    hospitals = [n for n in nodes if n["type"] == "hospital"]
    emergencies = [n for n in nodes if n["type"] == "emergency"][:3]
    for k in hospitals + emergencies:
        main_telecom = next((t for t in telecoms if t["id"] != k["id"]), telecoms[0] if telecoms else None)
        if main_telecom:
            links.append({
                "id": f"l_star_{k['id']}",
                "a": k["id"],
                "b": main_telecom["id"],
                "type": "starlink",
                "capacity": 3.0,
                "active": True,
                "latency_ms": round(random.uniform(25, 60), 2),
                "metadata": {}
            })

    return links


def generate_dependencies(nodes):
    deps = []
    power = [n for n in nodes if n["type"] == "power"]
    telecoms = [n for n in nodes if n["type"] == "telecom"]
    hospitals = [n for n in nodes if n["type"] == "hospital"]
    water = [n for n in nodes if n["type"] == "water"]
    industrials = [n for n in nodes if n["type"] == "industrial"]
    emergencies = [n for n in nodes if n["type"] == "emergency"]

    for t in telecoms:
        if power:
            p = random.choice(power)
            deps.append({"parent": p["id"], "child": t["id"]})
    for h in hospitals:
        if power:
            p = random.choice(power)
            deps.append({"parent": p["id"], "child": h["id"]})
        if telecoms:
            t = random.choice(telecoms)
            deps.append({"parent": t["id"], "child": h["id"]})
    for w in water:
        if power:
            p = random.choice(power)
            deps.append({"parent": p["id"], "child": w["id"]})
    for ind in industrials:
        if power:
            p = random.choice(power)
            deps.append({"parent": p["id"], "child": ind["id"]})
        if telecoms:
            t = random.choice(telecoms)
            deps.append({"parent": t["id"], "child": ind["id"]})
    for e in emergencies:
        if telecoms:
            t = random.choice(telecoms)
            deps.append({"parent": t["id"], "child": e["id"]})
    return deps


def seed_if_empty(db_path):
    c = conn()
    cur = c.cursor()
    cur.execute("SELECT COUNT(1) FROM nodes;")
    try:
        cnt = cur.fetchone()[0]
    except Exception:
        cnt = 0
    c.close()
    if cnt > 0:
        print("DB already seeded with", cnt, "nodes")
        return
    _do_seed()


def force_seed(db_path):
    """Drop all data and re-seed from scratch, preferring real OSM data."""
    c = conn()
    cur = c.cursor()
    cur.execute("DELETE FROM nodes;")
    cur.execute("DELETE FROM links;")
    cur.execute("DELETE FROM dependencies;")
    c.commit()
    c.close()
    _do_seed()


def _do_seed():
    print("Seeding DB with infrastructure nodes around Stalowa Wola")
    # Try to fetch real nodes first, fall back to generated
    real_nodes = fetch_real_nodes()
    if real_nodes:
        nodes = _deduplicate(real_nodes)
        print(f"Using {len(nodes)} real OSM nodes")
        # If less than 50, supplement with generated
        if len(nodes) < 50:
            extra = generate_nodes(50 - len(nodes))
            for n in extra:
                n["id"] = f"n{len(nodes) + 1}"
                nodes.append(n)
            print(f"Supplemented to {len(nodes)} nodes with generated data")
    else:
        nodes = generate_nodes(50)
        print("Using 50 generated nodes")
    links = generate_links(nodes)
    deps = generate_dependencies(nodes)
    insert_nodes(nodes)
    insert_links(links)
    insert_dependencies(deps)
    print(f"Seeded: {len(nodes)} nodes, {len(links)} links, {len(deps)} dependencies")


if __name__ == "__main__":
    seed_if_empty(None)