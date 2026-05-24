import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import type { Node, Link } from '../../store'

type Tab = 'nodes' | 'links'

type SortDir = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  online: '#00f0ff',
  degraded: '#f59e0b',
  offline: '#ef4444',
  critical: '#ef4444',
}

const LINK_TYPE_LABELS: Record<string, string> = {
  fiber: 'Fiber',
  mpls: 'MPLS',
  lte: 'LTE',
  loramesh: 'LoRa',
  starlink: 'Starlink',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#666'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider"
      style={{
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {status}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  const color = active ? '#10b981' : '#ef4444'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {active ? 'active' : 'severed'}
    </span>
  )
}

function getLinkCountColor(count: number): string {
  if (count === 0) return '#5b8296'
  if (count <= 2)  return '#0ea5e9'
  if (count <= 5)  return '#00f0ff'
  return '#f97316'
}

function getLatencyColor(ms: number): string {
  if (ms < 5)   return '#0ea5e9'
  if (ms < 15)  return '#00f0ff'
  if (ms < 40)  return '#f59e0b'
  return '#f97316'
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (!dir) return <span className="ml-1 text-cyan-500/30">↕</span>
  return <span className="ml-1 text-cyan-400">{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function TableView() {
  const { nodes, links } = useStore()
  const [tab, setTab] = useState<Tab>('nodes')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const nodeTypes = useMemo(() => {
    const types = new Set(nodes.map(n => n.type))
    return Array.from(types).sort()
  }, [nodes])

  const nodeStatuses = useMemo(() => {
    const statuses = new Set(nodes.map(n => n.status))
    return Array.from(statuses).sort()
  }, [nodes])

  const linkTypes = useMemo(() => {
    const types = new Set(links.map(l => l.type))
    return Array.from(types).sort()
  }, [links])

  const linkCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of links) {
      counts[l.a] = (counts[l.a] || 0) + 1
      counts[l.b] = (counts[l.b] || 0) + 1
    }
    return counts
  }, [links])

  const filteredNodes = useMemo(() => {
    let result = [...nodes]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(n => n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
    }
    if (filterType !== 'all') result = result.filter(n => n.type === filterType)
    if (filterStatus !== 'all') result = result.filter(n => n.status === filterStatus)
    if (sortKey) {
      result.sort((a, b) => {
        let va: any, vb: any
        switch (sortKey) {
          case 'id': va = a.id; vb = b.id; break
          case 'name': va = a.name; vb = b.name; break
          case 'type': va = a.type; vb = b.type; break
          case 'status': va = a.status; vb = b.status; break
          case 'lat': va = a.lat; vb = b.lat; break
          case 'lon': va = a.lon; vb = b.lon; break
          case 'links': va = linkCounts[a.id] || 0; vb = linkCounts[b.id] || 0; break
          default: va = a.id; vb = b.id
        }
        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
        }
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }
    return result
  }, [nodes, search, filterType, filterStatus, sortKey, sortDir, linkCounts])

  const filteredLinks = useMemo(() => {
    let result = [...links]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l => l.id.toLowerCase().includes(q) || l.a.toLowerCase().includes(q) || l.b.toLowerCase().includes(q))
    }
    if (filterType !== 'all') result = result.filter(l => l.type === filterType)
    if (filterStatus === 'active') result = result.filter(l => l.active)
    else if (filterStatus === 'severed') result = result.filter(l => !l.active)
    if (sortKey) {
      result.sort((a, b) => {
        let va: any, vb: any
        switch (sortKey) {
          case 'id': va = a.id; vb = b.id; break
          case 'source': va = a.a; vb = b.a; break
          case 'target': va = a.b; vb = b.b; break
          case 'type': va = a.type; vb = b.type; break
          case 'active': va = a.active ? 1 : 0; vb = b.active ? 1 : 0; break
          case 'latency': va = a.latency_ms; vb = b.latency_ms; break
          default: va = a.id; vb = b.id
        }
        if (typeof va === 'string') {
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
        }
        return sortDir === 'asc' ? va - vb : vb - va
      })
    }
    return result
  }, [links, search, filterType, filterStatus, sortKey, sortDir])

  const nodeColumns = [
    { key: 'id', label: 'ID', width: 'w-16' },
    { key: 'name', label: 'Name', width: 'flex-1' },
    { key: 'type', label: 'Type', width: 'w-24' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'lat', label: 'Latitude', width: 'w-28' },
    { key: 'lon', label: 'Longitude', width: 'w-28' },
    { key: 'links', label: 'Links', width: 'w-16' },
  ]

  const linkColumns = [
    { key: 'id', label: 'ID', width: 'w-28' },
    { key: 'source', label: 'Source', width: 'w-16' },
    { key: 'target', label: 'Target', width: 'w-16' },
    { key: 'type', label: 'Type', width: 'w-20' },
    { key: 'active', label: 'Status', width: 'w-20' },
    { key: 'latency', label: 'Latency', width: 'w-24' },
  ]

  return (
    <div className="h-full flex flex-col p-4">
      {/* Tab bar */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => { setTab('nodes'); setSearch(''); setFilterType('all'); setFilterStatus('all'); setSortKey(null) }}
          className={`px-4 py-1.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
            tab === 'nodes'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
              : 'text-cyber-muted hover:text-cyan-400 border border-transparent'
          }`}
        >
          📡 Nodes ({nodes.length})
        </button>
        <button onClick={() => { setTab('links'); setSearch(''); setFilterType('all'); setFilterStatus('all'); setSortKey(null) }}
          className={`px-4 py-1.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
            tab === 'links'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
              : 'text-cyber-muted hover:text-cyan-400 border border-transparent'
          }`}
        >
          🔗 Links ({links.length})
        </button>
      </div>

      {/* Filter bar */}
      <div className="glass p-3 rounded-lg mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded bg-black/40 border border-cyan-500/15 text-xs font-mono text-cyan-200 placeholder-cyan-700 outline-none focus:border-cyan-500/40 transition-colors"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded bg-black/40 border border-cyan-500/15 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-500/40"
          >
            <option value="all">All Types</option>
            {(tab === 'nodes' ? nodeTypes : linkTypes).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded bg-black/40 border border-cyan-500/15 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-500/40"
          >
            <option value="all">{tab === 'nodes' ? 'All Status' : 'All Links'}</option>
            {(tab === 'nodes' ? nodeStatuses : ['active', 'severed']).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-[10px] font-mono text-cyber-muted ml-auto">
            {tab === 'nodes' ? filteredNodes.length : filteredLinks.length} results
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-cyan-500/10">
                {(tab === 'nodes' ? nodeColumns : linkColumns).map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`${col.width} px-3 py-2.5 text-left text-[10px] font-bold tracking-wider uppercase text-cyber-muted cursor-pointer select-none hover:text-cyan-400 transition-colors whitespace-nowrap`}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      <SortIcon dir={sortDir} />
                    ) : (
                      <span className="ml-1 text-cyan-500/20">↕</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tab === 'nodes' ? filteredNodes : filteredLinks).length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-cyber-muted text-[11px]">
                    No {tab} found matching filters.
                  </td>
                </tr>
              ) : (
                (tab === 'nodes' ? filteredNodes : filteredLinks).map((item, i) => {
                  if (tab === 'nodes') {
                    const n = item as Node
                    return (
                      <tr key={n.id} className={`border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors ${i % 2 === 1 ? 'bg-black/15' : ''}`}>
                        <td className="px-3 py-2 text-cyan-400 font-bold">{n.id}</td>
                        <td className="px-3 py-2 text-cyan-200">{n.name}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9px] font-bold uppercase tracking-wider">{n.type}</span>
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={n.status} /></td>
                        <td className="px-3 py-2 text-cyber-muted">{n.lat.toFixed(4)}</td>
                        <td className="px-3 py-2 text-cyber-muted">{n.lon.toFixed(4)}</td>
                        <td className="px-3 py-2 font-bold text-center"
                          style={{ color: getLinkCountColor(linkCounts[n.id] || 0) }}
                        >{linkCounts[n.id] || 0}</td>
                      </tr>
                    )
                  } else {
                    const l = item as Link
                    return (
                      <tr key={l.id} className={`border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors ${i % 2 === 1 ? 'bg-black/15' : ''}`}>
                        <td className="px-3 py-2 text-cyan-400 font-bold">{l.id}</td>
                        <td className="px-3 py-2 text-cyan-200">{l.a}</td>
                        <td className="px-3 py-2 text-cyan-200">{l.b}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9px] font-bold uppercase tracking-wider">{LINK_TYPE_LABELS[l.type] || l.type}</span>
                        </td>
                        <td className="px-3 py-2"><ActiveBadge active={l.active} /></td>
                        <td className="px-3 py-2 font-mono"
                          style={{ color: getLatencyColor(l.latency_ms) }}
                        >{l.latency_ms} ms</td>
                      </tr>
                    )
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}