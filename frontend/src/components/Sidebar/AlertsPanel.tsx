import React from 'react'
import { useStore } from '../../store'

export default function AlertsPanel() {
  const { alerts } = useStore()

  const getAlertStyle = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          border: 'border-l-4 border-l-rose-500 border-rose-500/10',
          bg: 'bg-rose-950/10',
          dot: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
          text: 'text-rose-200',
        }
      case 'warning':
        return {
          border: 'border-l-4 border-l-amber-500 border-amber-500/10',
          bg: 'bg-amber-950/10',
          dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
          text: 'text-amber-200',
        }
      default:
        return {
          border: 'border-l-4 border-l-cyan-500 border-cyan-500/10',
          bg: 'bg-cyan-950/10',
          dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
          text: 'text-cyan-200',
        }
    }
  }

  return (
    <div className="glass p-4 rounded-xl border border-cyan-500/15 shadow-cyber flex flex-col gap-3 min-h-[220px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="animate-pulse flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
            Crisis Alert Feeds
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyber-muted uppercase">
          {alerts.length} Active Events
        </span>
      </div>

      {/* Alerts Feed */}
      {alerts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-8">
          <span className="text-xs text-cyber-muted font-mono uppercase tracking-wide">
            [ ALL SYSTEMS OPERATIONAL ]
          </span>
        </div>
      ) : (
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {alerts.map((a) => {
            const style = getAlertStyle(a.level)
            return (
              <div 
                key={a.id} 
                className={`p-2.5 rounded border text-xs transition-all duration-300 hover:brightness-110 flex items-start gap-2.5 ${style.border} ${style.bg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`font-mono font-bold tracking-wide uppercase text-[10px] ${style.text}`}>
                      {a.title || (a.level === 'critical' ? 'Critical Alert' : a.level === 'warning' ? 'Warning Alert' : 'System Event')}
                    </span>
                    <span className="text-[9px] text-cyber-muted font-mono flex-shrink-0">
                      {a.timestamp || 'Live'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{a.message}</p>
                  {a.nodeId && (
                    <div className="text-[9px] text-cyber-muted font-mono mt-1 uppercase">
                      Target: <span className="text-cyan-400 font-bold">{a.nodeId}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
