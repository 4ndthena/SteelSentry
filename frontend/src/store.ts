import { create } from 'zustand'
import axios from 'axios'
import { defaultDefenseZoneFilters, type DefenseZoneType } from './data/mapOverlays'

export interface Node {
  id: string
  name: string
  type: string
  lon: number
  lat: number
  status: 'online' | 'degraded' | 'offline'
  metadata: Record<string, any>
  last_update: number
}

export interface Link {
  id: string
  a: string
  b: string
  type: 'fiber' | 'mpls' | 'lte' | 'loramesh' | 'starlink'
  capacity: number
  active: boolean
  latency_ms: number
  metadata: Record<string, any>
}

export interface Dependency {
  parent: string
  child: string
}

export interface Alert {
  id: string
  level: 'info' | 'warning' | 'critical'
  title?: string
  message: string
  nodeId?: string
  timestamp?: string
  ts?: number
}

export interface PathResult {
  ok: boolean
  source?: string
  target?: string
  node_path: string[]
  link_path: string[]
  hops?: number
  total_latency_ms?: number
  error?: string
}

interface DashboardState {
  nodes: Node[]
  links: Link[]
  dependencies: Dependency[]
  alerts: Alert[]
  selectedNodeId: string | null
  loading: boolean
  error: string | null

  // Backend connection config
  backendHost: string
  backendPort: string

  // Map overlay toggles
  overlays: {
    heatmap: boolean
    defenseZones: boolean
  }
  defenseZoneFilters: Record<DefenseZoneType, boolean>

  // Path routing state
  pathSource: string | null
  pathTarget: string | null
  activePath: PathResult | null
  pathLoading: boolean

  fetchData: () => Promise<void>
  selectNode: (nodeId: string | null) => void
  updateNode: (node: Partial<Node> & { id: string }) => void
  updateLink: (link: Partial<Link> & { id: string }) => void
  addAlert: (alert: Alert) => void
  clearAlert: (alertId: string) => void
  initData: (data: { nodes: Node[]; links: Link[]; dependencies: Dependency[] }) => void
  setBackendUrl: (host: string, port: string) => void
  toggleOverlay: (key: 'heatmap' | 'defenseZones') => void
  toggleDefenseZoneFilter: (type: DefenseZoneType) => void
  setAllDefenseZoneFilters: (enabled: boolean) => void

  // Path routing actions
  setPathSource: (nodeId: string | null) => void
  setPathTarget: (nodeId: string | null) => void
  fetchPath: () => Promise<void>
  clearPath: () => void
}

export const useStore = create<DashboardState>((set, get) => ({
  nodes: [],
  links: [],
  dependencies: [],
  alerts: [],
  selectedNodeId: null,
  loading: false,
  error: null,

  backendHost: 'localhost',
  backendPort: '8000',

  overlays: {
    heatmap: true,
    defenseZones: true,
  },
  defenseZoneFilters: defaultDefenseZoneFilters(),

  pathSource: null,
  pathTarget: null,
  activePath: null,
  pathLoading: false,

  setBackendUrl: (host: string, port: string) => {
    set({ backendHost: host, backendPort: port })
  },

  toggleOverlay: (key) => {
    set((state) => ({
      overlays: { ...state.overlays, [key]: !state.overlays[key] }
    }))
  },

  toggleDefenseZoneFilter: (type) => {
    set((state) => ({
      defenseZoneFilters: {
        ...state.defenseZoneFilters,
        [type]: !state.defenseZoneFilters[type],
      },
    }))
  },

  setAllDefenseZoneFilters: (enabled) => {
    set((state) => ({
      defenseZoneFilters: Object.fromEntries(
        Object.keys(state.defenseZoneFilters).map((t) => [t, enabled]),
      ) as Record<DefenseZoneType, boolean>,
    }))
  },

  fetchData: async () => {
    set({ loading: true, error: null })
    try {
      const { backendHost, backendPort } = get()
      const res = await axios.get(`http://${backendHost}:${backendPort}/api/data`)
      set({
        nodes: res.data.nodes,
        links: res.data.links,
        dependencies: res.data.dependencies,
        loading: false
      })
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      set({ error: 'Failed to fetch network topology', loading: false })
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNode: (updatedNode) => {
    set((state) => {
      const idx = state.nodes.findIndex((n) => n.id === updatedNode.id)
      if (idx === -1) return {}
      const newNodes = [...state.nodes]
      newNodes[idx] = { ...newNodes[idx], ...updatedNode }
      return { nodes: newNodes }
    })
    // If a node on the active path changed status, auto-refresh path
    const { activePath, pathSource, pathTarget } = get()
    if (activePath && activePath.node_path.includes(updatedNode.id!)) {
      get().fetchPath()
    }
  },

  updateLink: (updatedLink) => {
    set((state) => {
      const idx = state.links.findIndex((l) => l.id === updatedLink.id)
      if (idx === -1) return {}
      const newLinks = [...state.links]
      newLinks[idx] = { ...newLinks[idx], ...updatedLink }
      return { links: newLinks }
    })
    // If a link on the active path was severed, auto-refresh path
    const { activePath } = get()
    if (activePath && activePath.link_path.includes(updatedLink.id!)) {
      get().fetchPath()
    }
  },

  addAlert: (alert) => {
    set((state) => {
      if (state.alerts.some((a) => a.id === alert.id)) return {}
      return { alerts: [alert, ...state.alerts].slice(0, 50) }
    })
  },

  clearAlert: (alertId) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== alertId)
    }))
  },

  initData: (data) => {
    set({
      nodes: data.nodes,
      links: data.links,
      dependencies: data.dependencies
    })
  },

  setPathSource: (nodeId) => set({ pathSource: nodeId, activePath: null }),
  setPathTarget: (nodeId) => set({ pathTarget: nodeId, activePath: null }),

  fetchPath: async () => {
    const { pathSource, pathTarget, backendHost, backendPort } = get()
    if (!pathSource || !pathTarget || pathSource === pathTarget) return
    set({ pathLoading: true })
    try {
      const res = await axios.get(
        `http://${backendHost}:${backendPort}/api/path?source=${pathSource}&target=${pathTarget}`
      )
      set({ activePath: res.data, pathLoading: false })
    } catch (err) {
      console.error('Path fetch error', err)
      set({ pathLoading: false, activePath: { ok: false, node_path: [], link_path: [], error: 'Request failed' } })
    }
  },

  clearPath: () => set({ pathSource: null, pathTarget: null, activePath: null }),
}))
