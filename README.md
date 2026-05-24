# Steel Sentry

Tactical crisis communication and infrastructure defense dashboard for Stalowa Wola, Poland.


## Stack

**Backend:** FastAPI, WebSockets, NetworkX, SQLite  
**Frontend:** React 18, TypeScript, Vite, TailwindCSS, MapLibre GL JS

## Quick Start

Requires [Docker](https://docs.docker.com/get-docker/) (Docker Desktop or Docker Engine + Compose).

```bash
npm start
# or: docker compose up --build
```

Stop:

```bash
npm stop
# or: docker compose down
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Admin: http://localhost:5173/admin

The browser talks to the API on `localhost:8000` (published from the backend container). Code changes under `backend/app` and `frontend/` reload automatically in the containers.

### TAK integration (optional)

Open **Settings** in the dashboard header to choose a backend mode and start the OpenTAK bridge (supervisor on port **3001**). The bridge connects to an **OpenTAK Server** (an open‑source TAK server released under the GNU General Public License v3.0 (GPL‑3.0)). TAK positions are ingested at `POST /api/tak/ingest` and broadcast over the normal WebSocket feed.

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry, WS endpoint
│   │   ├── routes/api.py         # REST endpoints + admin
│   │   ├── db/sqlite_helper.py   # SQLite schema & helpers
│   │   ├── data/seed.py          # Seed DB: real nodes from OSM Overpass API, fallback to generated landmarks
│   │   ├── models/schema.py      # Pydantic models
│   │   ├── simulation/engine.py  # Simulation engine (NetworkX)
│   │   └── websocket/manager.py  # WebSocket connection manager
│   ├── requirements.txt
│   └── Dockerfile.backend
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # Root with / and /admin routing
│   │   ├── index.css             # Tailwind + glass/btn styles
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # Main dashboard (map + sidebar)
│   │   │   └── Admin.tsx         # Admin panel (reset DB/WS)
│   │   └── components/
│   │       ├── MapView/
│   │       │   ├── MapView.tsx   # MapLibre map with OSM tiles
│   │       │   └── LogicalView.tsx
│   │       └── Sidebar/
│   │           ├── AlertsPanel.tsx
│   │           ├── SimulationControls.tsx
│   │           ├── PathFinder.tsx
│   │           └── NodeInspector.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile.frontend
├── docker-compose.yml
└── README.md
```

## Pages

### Dashboard
- **Map:** MapLibre GL with OSM raster tiles. Infrastructure nodes (count varies depending on OSM data returned by Overpass API) displayed as GeoJSON circles or DOM markers. Real-time updates via WebSocket.
- **Alerts:** Live alert feed from simulation events (drone strike, fiber cut).
- **Simulation Controls:** Trigger drone strike or fiber cut on a target node.
- **Path Finder:** Find shortest active communication path between two nodes.

### Admin (/admin)
- **Reset Database:** Clears all data and re-seeds from OSM (variable node count) or falls back to generated nodes.
- **Reset WebSocket Connections:** Closes all active WebSocket connections.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data` | Return all nodes, links, dependencies |
| GET | `/api/scenarios` | List available simulation scenarios |
| GET | `/api/path?source=n1&target=n2` | Find shortest active path |
| POST | `/api/simulate` | Run a simulation scenario |
| POST | `/api/admin/reset-db` | Re-seed database from scratch |
| POST | `/api/admin/reset-connections` | Close all WebSocket connections |

### POST /api/simulate

```json
// Drone strike
{"scenario": "drone_strike", "params": {"target_node": "n1"}}

// Fiber cut
{"scenario": "fiber_cut", "params": {"link_id": "l_fiber_n1_n2"}}
```

## WebSocket (ws://localhost:8000/ws/updates)

| Message Type | Description |
|-------------|-------------|
| `init` | Initial state on connect (all nodes, links, dependencies) |
| `node_update` | Node status changed (online → offline, etc.) |
| `alert` | Critical/warning alert from simulation |
| `link_update` | Link status changed |

## Simulation Engine

Built on NetworkX with two directed graphs:

- **Dependency graph (DiGraph):** `parent → child` (e.g., power plant → telecom tower)
- **Communication graph (Graph):** bidirectional fiber/LTE/LoRa/Starlink links with latency weights

### Scenarios
- **Drone Strike:** Marks target node offline, cascades degradation to dependents.
- **Fiber Cut:** Disables a fiber link, triggers rerouting.
- **Comm Blackout:** Jamming affecting multiple towers.
- **Industrial Disaster:** Industrial facility accident with cascading effects.

## Styling

- Dark theme (`#020207` background)
- Glassmorphism panels (backdrop-filter blur)
- Cyan glow accents (`#00f0ff`)
- Critical alerts: red (`#ff4d4f`), warnings: orange (`#ffa940`)
- Custom `.btn` and `.glass` utility classes in `index.css`

## Sources

### Map & Geographic Data
- **[OpenStreetMap (OSM)](https://www.openstreetmap.org/)** — Raster base map tiles served via MapLibre GL JS. Map data © OpenStreetMap contributors, licensed under [ODbL](https://www.openstreetmap.org/copyright).

- **[Overpass API](https://overpass-api.de/)** — Used at startup to query real critical infrastructure around Stalowa Wola (power plants, hospitals, telecom masts, bridges, water works, etc.). Results are deduped and merged with curated landmark data.

### Core Libraries & Frameworks
- **[FastAPI](https://fastapi.tiangolo.com/)** — Backend REST API and WebSocket server (Python, MIT License).
- **[NetworkX](https://networkx.org/)** — Graph algorithms for dependency cascade simulation and shortest-path routing (BSD License).
- **[MapLibre GL JS](https://maplibre.org/)** — Open-source WebGL map rendering (BSD License).
- **[OpenTAK Server](https://opentakserver.io/)** — Open-source TAK server (GPL‑3.0).
- **[React 18](https://react.dev/)** — Frontend UI framework (MIT License).
- **[Vite](https://vite.dev/)** — Frontend build tool and dev server (MIT License).
- **[TailwindCSS](https://tailwindcss.com/)** — Utility-first CSS framework (MIT License).
- **[SQLite](https://www.sqlite.org/)** — Embedded database (Public Domain).
- **[Docker](https://www.docker.com/)** — Containerisation for reproducible local deployment.

## License

This project is open-source and licensed under the [MIT License](LICENSE). All dependencies and libraries used are open-source.
