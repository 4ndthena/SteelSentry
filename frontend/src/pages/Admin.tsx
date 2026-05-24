import { useState } from 'react'
import axios from 'axios'
import { useStore } from '../store'

export default function Admin() {
  const { backendHost, backendPort, setBackendUrl } = useStore()
  const [host, setHost] = useState(backendHost)
  const [port, setPort] = useState(backendPort)
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('')
  const [dbStatus, setDbStatus] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function apiUrl(path: string) {
    return `http://${host}:${port}${path}`
  }

  function testClick() {
    setCount(count + 1)
  }

  function connectToBackend() {
    setStatus(`Connecting to ${host}:${port}...`)
    setErrorMessage('')
    setBackendUrl(host, port)
    axios.get(apiUrl('/api/data'), { timeout: 5000 }).then(function (res) {
      const nodeCount = res.data.nodes?.length || 0
      const linkCount = res.data.links?.length || 0
      setStatus(`Connected — ${nodeCount} nodes, ${linkCount} links`)
    }).catch(function (err) {
      const msg = err.message || String(err)
      setErrorMessage(msg)
      setStatus('Connection failed')
    })
  }

  function resetDatabase() {
    setStatus('resetting...')
    setErrorMessage('')
    setBackendUrl(host, port)
    axios.post(apiUrl('/api/admin/reset-db'), {}, { timeout: 10000 }).then(function (response) {
      setStatus('Database reset successful')
      setDbStatus(response.data.message || 'Database reset')
    }).catch(function (err) {
      var msg = (err.response && err.response.data && err.response.data.error) || err.message || String(err)
      setErrorMessage(msg)
      setStatus('Error resetting database')
    })
  }

  function resetConnections() {
    setStatus('resetting connections...')
    setErrorMessage('')
    setBackendUrl(host, port)
    axios.post(apiUrl('/api/admin/reset-connections'), {}, { timeout: 10000 }).then(function (response) {
      setStatus('Connections reset: ' + (response.data.message || ''))
    }).catch(function (err) {
      var msg = (err.response && err.response.data && err.response.data.error) || err.message || String(err)
      setErrorMessage(msg)
      setStatus('Error resetting connections')
    })
  }

  function downloadSnapshot() {
    setStatus('Generating snapshot...')
    setErrorMessage('')
    try {
      const state = useStore.getState()
      const now = new Date()
      const ts = now.toISOString().replace(/[:.]/g, '-')
      const stats = {
        total_nodes: state.nodes.length,
        online_nodes: state.nodes.filter(n => n.status === 'online').length,
        degraded_nodes: state.nodes.filter(n => n.status === 'degraded').length,
        offline_nodes: state.nodes.filter(n => n.status === 'offline').length,
        total_links: state.links.length,
        active_links: state.links.filter(l => l.active).length,
        severed_links: state.links.filter(l => !l.active).length,
        total_alerts: state.alerts.length,
        critical_alerts: state.alerts.filter(a => a.level === 'critical').length,
        warning_alerts: state.alerts.filter(a => a.level === 'warning').length,
      }

      const snapshot = {
        snapshot_name: `incident_snapshot_${ts}`,
        generated_at: now.toISOString(),
        backend: 'http://localhost:8000',
        stats,
        nodes: state.nodes,
        links: state.links,
        alerts: state.alerts,
      }

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incident_snapshot_${ts}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus(`Snapshot downloaded (${(blob.size / 1024).toFixed(1)} KB)`)
    } catch (err: any) {
      setErrorMessage(err.message || String(err))
      setStatus('Error generating snapshot')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      {/* Backend Connection Selector */}
      <div className="glass p-4 rounded-lg mb-4">
        <h2 className="font-semibold mb-2 text-xs text-cyber-muted uppercase tracking-wider">Backend Connection</h2>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs font-mono text-cyber-muted">Host:</label>
          <input
            type="text"
            value={host}
            onChange={e => setHost(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded bg-black/40 border border-cyan-500/15 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-500/40"
            placeholder="localhost"
          />
          <label className="text-xs font-mono text-cyber-muted">Port:</label>
          <input
            type="text"
            value={port}
            onChange={e => setPort(e.target.value)}
            className="w-20 px-3 py-1.5 rounded bg-black/40 border border-cyan-500/15 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-500/40"
            placeholder="8000"
          />
          <button
            onClick={connectToBackend}
            className="px-4 py-1.5 rounded text-xs font-bold font-mono tracking-wider uppercase bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all whitespace-nowrap"
          >
            Connect
          </button>
        </div>
        <div className="text-[10px] font-mono text-cyber-muted">
          Current: <span className="text-cyan-400">{backendHost}:{backendPort}</span>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="glass p-4 rounded-lg mb-4">
        <div className="mb-4 space-y-2">
          <div>
            <button onClick={testClick} className="btn mr-2">
              Test Click ({count})
            </button>
          </div>
          <div>
            <button onClick={resetDatabase} className="btn mr-2">
              Reset Database
            </button>
            <button onClick={resetConnections} className="btn mr-2">
              Reset WebSocket Connections
            </button>
            <button onClick={downloadSnapshot} className="btn">
              📥 Download Snapshot
            </button>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="glass p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Status</h2>
        <p className="mb-2"><strong>Database:</strong> {dbStatus || 'Not checked'}</p>
        <p className="mb-2"><strong>Last Action:</strong> {status || 'None'}</p>
        {errorMessage ? (
          <div className="mt-2 p-2 rounded" style={{ background: 'rgba(255,77,79,0.1)', color: '#ff4d4f' }}>
            <strong>Error:</strong> {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}