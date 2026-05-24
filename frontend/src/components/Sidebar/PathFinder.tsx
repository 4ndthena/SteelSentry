import React, { useEffect } from 'react'
import { useStore } from '../../store'

const NODE_TYPE_ICON: Record<string, string> = {
  power: '⚡', hospital: '🏥', telecom: '📡', water: '💧',
  bridge: '🌉', industrial: '🏭', municipal: '🏛️', emergency: '🚨', utility: '⚙️',
}

function typeIcon(type: string) {
  return NODE_TYPE_ICON[type] ?? '⚙️'
}

export default function PathFinder() {
  const {
    nodes, links,
    pathSource, pathTarget, activePath, pathLoading,
    setPathSource, setPathTarget, fetchPath, clearPath,
  } = useStore()

  // Auto-fetch whenever both endpoints are set
  useEffect(() => {
    if (pathSource && pathTarget && pathSource !== pathTarget) {
      fetchPath()
    }
  }, [pathSource, pathTarget])

  const onlineNodes = nodes.filter((n) => n.status !== 'offline')

  const pathHasError = activePath && !activePath.ok
  const pathOk = activePath && activePath.ok

  return (
    <div className="glass p-4 rounded-xl border border-cyan-500/20 shadow-cyber flex flex-col gap-3 relative overflow-hidden">
      {/* animated scan line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent animate-[scan_3s_linear_infinite] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 text-base">🛰️</span>
          <span className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
            Telemetry Path Router
          </span>
        </div>
        {(pathSource || pathTarget || activePath) && (
          <button
            onClick={clearPath}
            className="text-[10px] font-mono text-cyber-muted hover:text-rose-400 transition-colors uppercase tracking-wide"
          >
            [CLEAR]
          </button>
        )}
      </div>

      {/* Source / Target selectors */}
      <div className="grid grid-cols-2 gap-2">
        {/* Source */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
            ▶ Source Node
          </label>
          <select
            className="text-[11px] p-2 rounded bg-cyber-dark/80 border border-emerald-500/20 text-cyan-200 font-mono focus:outline-none focus:border-emerald-400 transition-colors"
            value={pathSource ?? ''}
            onChange={(e) => setPathSource(e.target.value || null)}
          >
            <option value="">-- SELECT --</option>
            {onlineNodes.map((n) => (
              <option key={n.id} value={n.id} className="bg-cyber-dark">
                {typeIcon(n.type)} {n.id}: {n.name.split('(')[0].trim().slice(0, 22)}
              </option>
            ))}
          </select>
        </div>

        {/* Target */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono text-rose-400 uppercase tracking-widest font-bold">
            ■ Target Node
          </label>
          <select
            className="text-[11px] p-2 rounded bg-cyber-dark/80 border border-rose-500/20 text-cyan-200 font-mono focus:outline-none focus:border-rose-400 transition-colors"
            value={pathTarget ?? ''}
            onChange={(e) => setPathTarget(e.target.value || null)}
          >
            <option value="">-- SELECT --</option>
            {onlineNodes
              .filter((n) => n.id !== pathSource)
              .map((n) => (
                <option key={n.id} value={n.id} className="bg-cyber-dark">
                  {typeIcon(n.type)} {n.id}: {n.name.split('(')[0].trim().slice(0, 22)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Recalculate button */}
      {pathSource && pathTarget && (
        <button
          onClick={fetchPath}
          disabled={pathLoading}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-950/40 to-cyan-900/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/20 hover:border-cyan-400/60 transition-all font-mono text-xs font-bold tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {pathLoading
            ? <><span className="w-3 h-3 border-t border-cyan-400 rounded-full animate-spin" /> COMPUTING ROUTE...</>
            : '⟳ RECALCULATE ROUTE'}
        </button>
      )}

      {/* No path yet */}
      {!pathSource && !pathTarget && (
        <div className="text-[10px] text-cyber-muted font-mono text-center py-2 uppercase tracking-wide">
          Select source & target to trace a live comms route
        </div>
      )}

      {/* Error state */}
      {pathHasError && (
        <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-start gap-2">
          <span className="text-rose-400 text-base flex-shrink-0">⚠️</span>
          <div>
            <div className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wide mb-0.5">
              No Route Available
            </div>
            <div className="text-[11px] text-rose-300/80">{activePath?.error}</div>
          </div>
        </div>
      )}

      {/* Success: path details */}
      {pathOk && activePath && (
        <div className="flex flex-col gap-2.5">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1.5 rounded bg-black/40 border border-cyan-500/10">
              <div className="text-[8px] text-cyber-muted font-mono uppercase">Hops</div>
              <div className="text-sm font-mono font-black text-cyan-400">{activePath.hops}</div>
            </div>
            <div className="p-1.5 rounded bg-black/40 border border-cyan-500/10">
              <div className="text-[8px] text-cyber-muted font-mono uppercase">Latency</div>
              <div className="text-sm font-mono font-black text-emerald-400">{activePath.total_latency_ms}ms</div>
            </div>
            <div className="p-1.5 rounded bg-black/40 border border-cyan-500/10">
              <div className="text-[8px] text-cyber-muted font-mono uppercase">Links</div>
              <div className="text-sm font-mono font-black text-violet-400">{activePath.link_path.length}</div>
            </div>
          </div>

          {/* Node path visual */}
          <div className="text-[9px] text-cyber-muted font-mono uppercase tracking-widest border-b border-cyan-500/10 pb-1">
            Active Route Trace
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
            {activePath.node_path.map((nodeId, i) => {
              const node = nodes.find((n) => n.id === nodeId)
              const linkId = activePath.link_path[i]
              const link = linkId ? links.find((l) => l.id === linkId) : null
              const isFirst = i === 0
              const isLast = i === activePath.node_path.length - 1

              const statusDot = node?.status === 'online'
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                : node?.status === 'degraded'
                ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                : 'bg-rose-400'

              const linkTypeColor: Record<string, string> = {
                fiber: 'text-cyan-400', mpls: 'text-emerald-400',
                lte: 'text-blue-400', loramesh: 'text-violet-400', starlink: 'text-amber-400',
              }

              return (
                <div key={nodeId}>
                  {/* Node row */}
                  <div className={`flex items-center gap-2 p-1.5 rounded text-[11px] ${isFirst ? 'bg-emerald-950/20 border border-emerald-500/15' : isLast ? 'bg-rose-950/20 border border-rose-500/15' : 'bg-black/30 border border-cyan-500/5'}`}>
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot}`} />
                    <span className="font-mono text-cyan-200 flex-1 truncate">
                      {isFirst ? '▶ ' : isLast ? '■ ' : `${i}. `}
                      {node?.name.split('(')[0].trim() ?? nodeId}
                    </span>
                    <span className="font-mono text-[9px] text-cyber-muted">{nodeId}</span>
                  </div>
                  {/* Link connector (between nodes) */}
                  {link && !isLast && (
                    <div className="flex items-center gap-1.5 pl-3 py-0.5">
                      <div className="w-px h-4 bg-cyan-500/20" />
                      <span className={`text-[9px] font-mono uppercase ${linkTypeColor[link.type] ?? 'text-cyan-400'}`}>
                        ─ {link.type} · {link.latency_ms}ms
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
