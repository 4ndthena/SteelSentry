import React, { useState } from 'react'
import { useStore } from '../../store'
import axios from 'axios'
import { backendHttpUrl } from '../../api'

export default function NodeInspector() {
  const { nodes, links, dependencies, selectedNodeId, selectNode, backendHost, backendPort } = useStore()
  const [actionStatus, setActionStatus] = useState<string>('')
  
  if (!selectedNodeId) {
    return (
      <div className="glass p-5 rounded-xl border border-cyan-500/10 shadow-cyber relative overflow-hidden flex flex-col items-center justify-center text-center h-48">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/10 to-transparent pointer-events-none" />
        <div className="text-cyan-500/30 text-4xl mb-2 font-mono">📡</div>
        <div className="text-sm font-semibold text-cyan-400/70 tracking-wider uppercase font-mono">Telemetry Inspector</div>
        <div className="text-xs text-cyber-muted max-w-[240px] mt-1 font-sans">
          Click on any infrastructure node on the map to query local telemetry and trigger scenario simulations.
        </div>
      </div>
    )
  }

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) {
    return null
  }

  // Get dependencies
  const parents = dependencies
    .filter((d) => d.child === node.id)
    .map((d) => nodes.find((n) => n.id === d.parent))
    .filter(Boolean)
  
  const children = dependencies
    .filter((d) => d.parent === node.id)
    .map((d) => nodes.find((n) => n.id === d.child))
    .filter(Boolean)

  // Get connected links
  const connectedLinks = links.filter((l) => l.a === node.id || l.b === node.id)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'power': return '⚡'
      case 'hospital': return '🏥'
      case 'telecom': return '📡'
      case 'water': return '💧'
      case 'bridge': return '🌉'
      case 'industrial': return '🏭'
      case 'municipal': return '🏛️'
      case 'emergency': return '🚨'
      default: return '⚙️'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'degraded': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'offline': return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  const triggerDroneStrike = async () => {
    setActionStatus('Targeting...')
    try {
      const res = await axios.post(backendHttpUrl(backendHost, backendPort, '/api/simulate'), {
        scenario: 'drone_strike',
        params: { target_node: node.id },
      })
      if (res.data.ok) {
        setActionStatus('Strike Confirmed')
      } else {
        setActionStatus(`Failed: ${res.data.error || 'Unknown error'}`)
      }
    } catch (e) {
      setActionStatus('Strike Error')
    }
    setTimeout(() => setActionStatus(''), 3000)
  }

  const triggerLinkCut = async (linkId: string) => {
    setActionStatus('Cutting connection...')
    try {
      const res = await axios.post(backendHttpUrl(backendHost, backendPort, '/api/simulate'), {
        scenario: 'fiber_cut',
        params: { link_id: linkId },
      })
      if (res.data.ok) {
        setActionStatus('Link Severed')
      } else {
        setActionStatus(`Failed: ${res.data.error || 'Unknown error'}`)
      }
    } catch (e) {
      setActionStatus('Sever Error')
    }
    setTimeout(() => setActionStatus(''), 3000)
  }

  return (
    <div className="glass p-5 rounded-xl border border-cyan-500/20 shadow-cyber relative overflow-hidden flex flex-col gap-4">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getTypeIcon(node.type)}</span>
          <div>
            <h3 className="font-mono font-bold text-cyan-200 tracking-wide text-sm">{node.name}</h3>
            <span className="text-[10px] text-cyber-muted font-mono uppercase">{node.id} • {node.type}</span>
          </div>
        </div>
        <button 
          onClick={() => selectNode(null)} 
          className="text-xs text-cyber-muted hover:text-cyan-400 transition-colors font-mono"
        >
          [CLOSE]
        </button>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-black/30 border border-cyan-500/5">
          <div className="text-[10px] text-cyber-muted font-mono uppercase mb-1">Node Status</div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold font-mono tracking-wider uppercase ${getStatusColor(node.status)}`}>
            {node.status}
          </span>
        </div>
        <div className="p-2 rounded bg-black/30 border border-cyan-500/5">
          <div className="text-[10px] text-cyber-muted font-mono uppercase mb-1">Load / Capacity</div>
          <span className="font-mono text-cyan-400 font-bold">{node.metadata?.capacity || '1.0'}x</span>
        </div>
      </div>

      {/* Dependencies */}
      <div className="space-y-2">
        <div className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest border-b border-cyan-500/5 pb-1">
          Dependency Tree Telemetry
        </div>
        
        {/* Upstream / Parents */}
        <div className="text-[11px]">
          <span className="text-cyber-muted font-mono mr-1">Depends on:</span>
          {parents.length === 0 ? (
            <span className="text-slate-500 font-mono">None (Independent)</span>
          ) : (
            <div className="flex flex-wrap gap-1 mt-1">
              {parents.map((p) => p && (
                <button 
                  key={p.id}
                  onClick={() => selectNode(p.id)}
                  className="px-1.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/10 text-cyan-300 font-mono hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all text-[10px]"
                >
                  {getTypeIcon(p.type)} {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Downstream / Children */}
        <div className="text-[11px]">
          <span className="text-cyber-muted font-mono mr-1">Supplies Power/Comm to:</span>
          {children.length === 0 ? (
            <span className="text-slate-500 font-mono">None (Terminal Node)</span>
          ) : (
            <div className="flex flex-wrap gap-1 mt-1">
              {children.map((c) => c && (
                <button 
                  key={c.id}
                  onClick={() => selectNode(c.id)}
                  className="px-1.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/10 text-cyan-300 font-mono hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all text-[10px]"
                >
                  {getTypeIcon(c.type)} {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network Connections */}
      <div className="space-y-2">
        <div className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest border-b border-cyan-500/5 pb-1">
          Active Network Connections
        </div>
        {connectedLinks.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono italic">No physical wire connections.</div>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {connectedLinks.map((l) => {
              const otherId = l.a === node.id ? l.b : l.a
              const otherNode = nodes.find((n) => n.id === otherId)
              const linkTypeColor = 
                l.type === 'fiber' ? 'text-cyan-400' :
                l.type === 'mpls' ? 'text-emerald-400' :
                l.type === 'lte' ? 'text-blue-400' :
                l.type === 'loramesh' ? 'text-purple-400' :
                'text-amber-400'

              return (
                <div key={l.id} className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-cyan-500/5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[9px] uppercase px-1 rounded bg-black/50 ${linkTypeColor}`}>
                      {l.type}
                    </span>
                    <span className="text-slate-300 font-mono truncate max-w-[120px]">
                      ➔ {otherNode?.name || otherId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] ${l.active ? 'text-emerald-400 font-bold' : 'text-rose-500 line-through'}`}>
                      {l.active ? 'ACTIVE' : 'SEVERED'}
                    </span>
                    {l.active && (
                      <button 
                        onClick={() => triggerLinkCut(l.id)}
                        className="text-[9px] px-1 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition-colors font-mono"
                        title="Cut this communication link"
                      >
                        CUT
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Context Actions */}
      <div className="border-t border-cyan-500/10 pt-3 mt-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-rose-500/80 font-mono uppercase tracking-widest font-bold">
            Scenario Sim Commands
          </span>
          {actionStatus && (
            <span className="text-[10px] font-mono text-cyan-400 animate-pulse">{actionStatus}</span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {node.status !== 'offline' ? (
            <button 
              onClick={triggerDroneStrike}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-rose-950/30 to-rose-900/20 border border-rose-500/30 text-rose-300 hover:from-rose-500/20 hover:to-rose-400/10 hover:border-rose-500/60 transition-all font-mono text-xs font-bold tracking-wider shadow-alert"
            >
              💥 EXECUTE DRONE STRIKE
            </button>
          ) : (
            <div className="w-full py-2 text-center rounded-lg bg-rose-950/20 border border-rose-500/10 text-rose-500/60 font-mono text-xs uppercase">
              🚫 Target offline / Destroyed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
