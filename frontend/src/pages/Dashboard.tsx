import React, { useEffect, useRef, useState } from 'react'
import MapView from '../components/MapView/MapView'
import LogicalView from '../components/MapView/LogicalView'
import TableView from '../components/TableView/TableView'
import CrisisCenter from '../components/CrisisCenter/CrisisCenter'
import DependencyFlowView from '../components/MapView/DependencyFlowView'
import AlertsPanel from '../components/Sidebar/AlertsPanel'
import SimulationControls from '../components/Sidebar/SimulationControls'
import NodeInspector from '../components/Sidebar/NodeInspector'
import PathFinder from '../components/Sidebar/PathFinder'
import { useStore } from '../store'
import SettingsPanel, { formatBackendMode, type BackendMode } from '../components/SettingsPanel'

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<'map' | 'logical' | 'table' | 'crisis' | 'dependency'>('map')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backendMode, setBackendMode] = useState<BackendMode>('ours')
  const wsRef = useRef<WebSocket | null>(null)
  const { 
    nodes, 
    links, 
    fetchData, 
    updateNode, 
    updateLink, 
    addAlert, 
    initData,
    backendHost,
    backendPort
  } = useStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.shiftKey && e.key.toLowerCase() === 'r') { setViewMode('map'); return }
      switch (e.key.toLowerCase()) {
        case 'm': setViewMode('map'); break
        case 'l': setViewMode('logical'); break
        case 't': setViewMode('table'); break
        case 'c': setViewMode('crisis'); break
        case 'd': setViewMode('dependency'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 1. Fetch initial data on mount
  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchData()
  }, [backendMode])

  // WebSocket: always backend (TAK data is ingested server-side)
  useEffect(() => {
    const wsUrl = `ws://${backendHost}:${backendPort}/ws/updates`
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {
        // ignore
      }
    }
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.addEventListener('open', () => {
      console.log('WS Connection established')
    })

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data)
        console.debug('WS Message Received:', msg.type, msg)

        if (msg.type === 'init' && msg.payload) {
          initData({
            nodes: msg.payload.nodes || [],
            links: msg.payload.links || [],
            dependencies: msg.payload.dependencies || []
          })
        } else if (msg.type === 'node_update' && msg.payload) {
          updateNode(msg.payload)
        } else if (msg.type === 'link_update' && msg.payload) {
          updateLink(msg.payload)
        } else if (msg.type === 'alert') {
          const payload = msg.payload || msg.alert
          if (payload) {
            const rawLevel = (payload.level || 'info').toLowerCase()
            const parsedLevel = 
              rawLevel === 'critical' || rawLevel === 'error' ? 'critical' :
              rawLevel === 'warning' ? 'warning' : 'info'

            const alertObj = {
              id: payload.id || `alert_${Date.now()}`,
              level: parsedLevel,
              title: payload.title || (parsedLevel === 'critical' ? 'Critical Defense Alert' : 'System Notice'),
              message: payload.message || '',
              nodeId: payload.nodeId || payload.node_id || '',
              timestamp: payload.timestamp || (payload.ts ? new Date(payload.ts * 1000).toLocaleTimeString() : new Date().toLocaleTimeString())
            }
            addAlert(alertObj)
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    })

    ws.addEventListener('close', () => {
      console.log('WS Connection closed, retrying in 3 seconds...')
    })

    return () => {
      try {
        ws.close()
      } catch (e) {}
    }
  }, [backendHost, backendPort])

  // Calculate live infrastructure stats
  const totalNodes = nodes.length
  const onlineNodes = nodes.filter((n) => n.status === 'online').length
  const degradedNodes = nodes.filter((n) => n.status === 'degraded').length
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length

  const totalLinks = links.length
  const activeLinks = links.filter((l) => l.active).length
  const severedLinks = links.filter((l) => !l.active).length

  return (
    <div className="w-full h-screen flex flex-col bg-cyber-bg font-sans select-none text-cyber-text">
      {/* Tactical Header */}
      <header className="h-16 px-6 bg-cyber-dark/95 border-b border-cyan-500/15 flex items-center justify-between z-10 shadow-cyber">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <div>
            <h1 className="font-mono text-base font-black tracking-widest text-cyan-400">
              STALOWY STRAŻNIK
            </h1>
            <span className="text-[9px] text-cyber-muted font-mono tracking-wider uppercase">
              Tactical Crisis Communication Dashboard
            </span>
          </div>
        </div>

        {/* View Mode Toggle Switch */}
        <div className="flex bg-black/45 border border-cyan-500/15 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('map')} 
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              viewMode === 'map' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'text-cyber-muted hover:text-cyan-400'
            }`}
          >
            🗺️ Map
          </button>
          <button 
            onClick={() => setViewMode('logical')} 
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              viewMode === 'logical' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'text-cyber-muted hover:text-cyan-400'
            }`}
          >
            📊 Logical
          </button>
          <button 
            onClick={() => setViewMode('table')} 
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              viewMode === 'table' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'text-cyber-muted hover:text-cyan-400'
            }`}
          >
            📋 Table
          </button>
          <button 
            onClick={() => setViewMode('crisis')} 
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              viewMode === 'crisis' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'text-cyber-muted hover:text-cyan-400'
            }`}
          >
            🚨 Crisis
          </button>
          <button 
            onClick={() => setViewMode('dependency')} 
            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              viewMode === 'dependency' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'text-cyber-muted hover:text-cyan-400'
            }`}
          >
            🔗 Deps
          </button>
        </div>

        {/* Global Infrastructure Telemetry Status Cards */}
        <div className="hidden lg:flex items-center gap-6">
          {/* Nodes Telemetry */}
          <div className="flex items-center gap-4 bg-black/40 border border-cyan-500/5 px-4 py-1.5 rounded-lg text-xs">
            <div className="font-mono text-[9px] text-cyber-muted uppercase font-bold border-r border-cyan-500/10 pr-3">
              Node Health
            </div>
            <div className="flex items-center gap-3 font-mono">
              <div className="flex flex-col">
                <span className="text-[8px] text-cyber-muted">TOTAL</span>
                <span className="font-bold text-cyan-200">{totalNodes}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-emerald-500">ONLINE</span>
                <span className="font-bold text-emerald-400">{onlineNodes}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-amber-500">DEGRADED</span>
                <span className="font-bold text-amber-400">{degradedNodes}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-rose-500">OFFLINE</span>
                <span className="font-bold text-rose-400">{offlineNodes}</span>
              </div>
            </div>
          </div>

          {/* Links Telemetry */}
          <div className="flex items-center gap-4 bg-black/40 border border-cyan-500/5 px-4 py-1.5 rounded-lg text-xs">
            <div className="font-mono text-[9px] text-cyber-muted uppercase font-bold border-r border-cyan-500/10 pr-3">
              Link Status
            </div>
            <div className="flex items-center gap-3 font-mono">
              <div className="flex flex-col">
                <span className="text-[8px] text-cyber-muted">TOTAL</span>
                <span className="font-bold text-cyan-200">{totalLinks}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-emerald-500">ACTIVE</span>
                <span className="font-bold text-emerald-400">{activeLinks}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-rose-500">SEVERED</span>
                <span className="font-bold text-rose-400">{severedLinks}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono text-[10px] text-cyber-muted hidden sm:block">
            <div>
              COMMAND NET: <span className="text-emerald-400 font-bold">ESTABLISHED</span>
            </div>
            <div>
              MODE: <span className="text-cyan-400">{formatBackendMode(backendMode)}</span>
            </div>
            <div>
              ADDR: {backendHost}:{backendPort}
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="glass px-3 py-2 rounded-lg border border-cyan-500/20 text-cyan-300 hover:border-cyan-400/50 text-[10px] font-mono font-bold tracking-wide"
            >
              ⚙ Settings
            </button>
            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              onModeChange={setBackendMode}
            />
          </div>
        </div>
      </header>

      {/* Main Board Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Active View */}
        <main className="flex-1 h-full relative overflow-hidden">
          {viewMode === 'map' ? <MapView /> : viewMode === 'logical' ? <LogicalView /> : viewMode === 'table' ? <TableView /> : viewMode === 'crisis' ? <CrisisCenter /> : <DependencyFlowView />}
        </main>

        {/* Right Side: Command Controls & Event log Sidebar */}
        <aside className="w-[400px] bg-cyber-dark/70 border-l border-cyan-500/15 p-4 flex flex-col gap-4 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-cyan-500/10">
          {/* Segment 1: Path routing */}
          <PathFinder />

          {/* Segment 2: Selected Node inspector */}
          <NodeInspector />

          {/* Segment 3: Scenario Simulations */}
          <SimulationControls />

          {/* Segment 4: Events Feeds log */}
          <AlertsPanel />
        </aside>
      </div>
    </div>
  )
}