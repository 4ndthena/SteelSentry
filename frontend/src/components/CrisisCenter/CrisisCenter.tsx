import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { getRemediations, type Remediation } from '../../data/remediations'
import type { Node, Link } from '../../store'
import axios from 'axios'

interface Problem {
  id: string
  entityType: 'node' | 'link'
  type: string
  label: string
  severity: 'critical' | 'warning' | 'info'
  status: string
  detail: string
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 }
const EFFORT_COLORS: Record<string, string> = { quick: '#10b981', moderate: '#f59e0b', major: '#f97316' }

function EffortBadge({ effort }: { effort: string }) {
  const c = EFFORT_COLORS[effort] || '#666'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider"
      style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}
    >
      {effort}
    </span>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const c = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#00f0ff'
  return (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
  )
}

export default function CrisisCenter() {
  const { nodes, links, alerts, backendHost, backendPort } = useStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'nodes' | 'links'>('all')

  const problems = useMemo(() => {
    const result: Problem[] = []

    for (const n of nodes) {
      if (n.status === 'offline') {
        result.push({ id: n.id, entityType: 'node', type: n.type, label: `${n.name} (${n.id})`, severity: 'critical', status: 'offline', detail: n.type })
      } else if (n.status === 'degraded') {
        result.push({ id: n.id, entityType: 'node', type: n.type, label: `${n.name} (${n.id})`, severity: 'warning', status: 'degraded', detail: n.type })
      }
    }

    for (const l of links) {
      if (!l.active) {
        result.push({ id: l.id, entityType: 'link', type: l.type, label: `${l.id}  (${l.a} → ${l.b})`, severity: 'warning', status: 'severed', detail: l.type })
      }
    }

    result.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    return result
  }, [nodes, links])

  const filteredProblems = useMemo(() => {
    if (filter === 'nodes') return problems.filter(p => p.entityType === 'node')
    if (filter === 'links') return problems.filter(p => p.entityType === 'link')
    return problems
  }, [problems, filter])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyRemediation(problem: Problem, remediation: Remediation) {
    const key = `${problem.id}:${remediation.id}`
    setApplying(prev => ({ ...prev, [key]: true }))
    try {
      if (problem.entityType === 'node') {
        await axios.post(`http://${backendHost}:${backendPort}/api/admin/restore-node/${problem.id}`, {}, { timeout: 10000 })
      } else {
        await axios.post(`http://${backendHost}:${backendPort}/api/admin/restore-link/${problem.id}`, {}, { timeout: 10000 })
      }
    } catch (err: any) {
      console.error('Remediation failed:', err)
    } finally {
      setApplying(prev => ({ ...prev, [key]: false }))
    }
  }

  const stats = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 }
    for (const p of problems) c[p.severity]++
    return { critical: c.critical, warning: c.warning, info: c.info, total: problems.length }
  }, [problems])

  if (problems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
          <span className="text-2xl text-green-400">✓</span>
        </div>
        <h2 className="text-lg font-mono font-bold text-green-400 mb-1">ALL SYSTEMS NOMINAL</h2>
        <p className="text-xs font-mono text-cyber-muted">0 active incidents detected</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          {stats.critical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/20">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_#ef4444]" />
              <span className="text-[11px] font-mono font-bold text-red-400">{stats.critical} critical</span>
            </div>
          )}
          {stats.warning > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
              <span className="text-[11px] font-mono font-bold text-amber-400">{stats.warning} warning</span>
            </div>
          )}
          <div className="px-3 py-1.5 rounded bg-cyan-500/5 border border-cyan-500/10">
            <span className="text-[11px] font-mono text-cyber-muted">{stats.total} total</span>
          </div>
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${filter === 'all' ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'text-cyber-muted hover:text-cyan-400 border border-transparent'}`}>All</button>
          <button onClick={() => setFilter('nodes')}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${filter === 'nodes' ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'text-cyber-muted hover:text-cyan-400 border border-transparent'}`}>Nodes</button>
          <button onClick={() => setFilter('links')}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${filter === 'links' ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'text-cyber-muted hover:text-cyan-400 border border-transparent'}`}>Links</button>
        </div>
      </div>

      {/* Problem cards */}
      <div className="flex-1 overflow-auto space-y-2 scrollbar-thin pr-1">
        {filteredProblems.map((problem) => {
          const isExpanded = expanded.has(problem.id)
          const remediations = getRemediations(problem.entityType, problem.type, problem.status)

          return (
            <div key={problem.id}
              className="glass rounded-lg border transition-all"
              style={{
                borderColor: problem.severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                background: problem.severity === 'critical' ? 'rgba(239,68,68,0.03)' : undefined,
              }}
            >
              {/* Card header */}
              <button
                onClick={() => toggleExpand(problem.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <SeverityDot severity={problem.severity} />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-mono font-bold text-cyan-200 truncate">{problem.label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[8px] font-bold uppercase tracking-wider">{problem.type}</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider"
                    style={{
                      background: problem.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: problem.severity === 'critical' ? '#ef4444' : '#f59e0b',
                    }}
                  >{problem.status}</span>
                </div>
                <span className="text-[10px] font-mono text-cyber-muted">{problem.entityType === 'node' ? '📡' : '🔗'}</span>
                <span className="text-cyber-muted text-[10px] transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>

              {/* Expanded: remediations */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-cyan-500/5 space-y-2">
                  {remediations.length === 0 ? (
                    <p className="text-[10px] font-mono text-cyber-muted italic">No pre-written remediations for this problem type.</p>
                  ) : (
                    remediations.map((rem) => {
                      const key = `${problem.id}:${rem.id}`
                      const isApplying = applying[key]

                      return (
                        <div key={rem.id} className="bg-black/30 rounded-lg p-3 border border-cyan-500/5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono font-bold text-cyan-200">{rem.title}</span>
                                <EffortBadge effort={rem.effort} />
                              </div>
                              <p className="text-[10px] font-mono text-cyber-muted mb-1">{rem.effect}</p>
                              <details className="mt-1">
                                <summary className="text-[9px] font-mono text-cyan-600 cursor-pointer hover:text-cyan-400 transition-colors">Steps</summary>
                                <ol className="mt-1 space-y-0.5">
                                  {rem.steps.map((step, si) => (
                                    <li key={si} className="text-[9px] font-mono text-cyber-muted flex gap-2">
                                      <span className="text-cyan-600 shrink-0">{si + 1}.</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </details>
                            </div>
                            <button
                              onClick={() => applyRemediation(problem, rem)}
                              disabled={isApplying}
                              className="shrink-0 px-3 py-1.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase transition-all disabled:opacity-40"
                              style={{
                                background: 'rgba(0,240,255,0.12)',
                                color: '#00f0ff',
                                border: '1px solid rgba(0,240,255,0.25)',
                              }}
                            >
                              {isApplying ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                  Applying...
                                </span>
                              ) : 'Apply'}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}