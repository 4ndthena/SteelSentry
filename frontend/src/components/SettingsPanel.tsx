import { useEffect, useState } from 'react'
import axios from 'axios'
import { backendHttpUrl } from '../api'
import { useStore } from '../store'

export type BackendMode = 'ours' | 'tak' | 'ours_synced_with_tak' | 'both'

export const BACKEND_MODE_LABELS: Record<BackendMode, string> = {
  ours: 'Our backend only',
  tak: 'TAK only',
  ours_synced_with_tak: 'Ours + TAK',
  both: 'Ours & TAK (merge)',
}

export function formatBackendMode(mode: BackendMode): string {
  return BACKEND_MODE_LABELS[mode] ?? mode
}

const SUPERVISOR_URL =
  import.meta.env.VITE_SUPERVISOR_URL?.replace(/\/$/, '') || 'http://localhost:3001'

function isValidTakWsUrl(url: string): boolean {
  const trimmed = url.trim()
  return trimmed.startsWith('ws://') || trimmed.startsWith('wss://')
}

interface Props {
  open: boolean
  onClose: () => void
  onModeChange: (mode: BackendMode) => void
}

export default function SettingsPanel({ open, onClose, onModeChange }: Props) {
  const { backendHost, backendPort } = useStore()
  const [mode, setMode] = useState<BackendMode>('ours')
  const [takWsUrl, setTakWsUrl] = useState('ws://localhost:8080/ws')
  const [bridgeStatus, setBridgeStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown')
  const [bridgeLoading, setBridgeLoading] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)

  const showTakBridge = mode !== 'ours'
  const takUrlReady = isValidTakWsUrl(takWsUrl)

  async function checkBridge() {
    try {
      const res = await axios.get(`${SUPERVISOR_URL}/status`, { timeout: 2000 })
      setBridgeStatus(res.data?.running ? 'running' : 'stopped')
    } catch {
      setBridgeStatus('stopped')
    }
  }

  useEffect(() => {
    if (!open) return
    checkBridge()
    try {
      const savedMode = localStorage.getItem('backend_mode')
      if (savedMode) setMode(savedMode as BackendMode)
      const savedUrl = localStorage.getItem('tak_ws_url')
      if (savedUrl) setTakWsUrl(savedUrl)
    } catch {
      // ignore
    }
  }, [open])

  useEffect(() => {
    try {
      localStorage.setItem('backend_mode', mode)
      localStorage.setItem('tak_ws_url', takWsUrl)
    } catch {
      // ignore
    }
    onModeChange(mode)
    axios
      .post(backendHttpUrl(backendHost, backendPort, '/api/tak/mode'), { mode })
      .catch(() => {})
  }, [mode, backendHost, backendPort, onModeChange])

  useEffect(() => {
    try {
      localStorage.setItem('tak_ws_url', takWsUrl)
    } catch {
      // ignore
    }
  }, [takWsUrl])

  useEffect(() => {
    if (mode !== 'ours') return
    if (bridgeStatus !== 'running') return
    axios
      .post(`${SUPERVISOR_URL}/stop`)
      .then(() => checkBridge())
      .catch(() => {})
  }, [mode, bridgeStatus])

  async function toggleBridge() {
    setBridgeError(null)
    setBridgeLoading(true)
    try {
      if (bridgeStatus === 'running') {
        const res = await axios.post(`${SUPERVISOR_URL}/stop`)
        if (res.data?.ok === false) {
          setBridgeError(res.data.error || 'Failed to stop bridge')
        } else {
          setBridgeStatus('stopped')
        }
      } else {
        const url = takWsUrl.trim()
        if (!isValidTakWsUrl(url)) {
          setBridgeError('Enter a TAK WebSocket URL (ws:// or wss://) before starting.')
          setBridgeLoading(false)
          return
        }

        const res = await axios.post(`${SUPERVISOR_URL}/start`, {
          takWsUrl: url,
          mode,
          backendUrl: `http://${backendHost}:${backendPort}`,
        })
        if (res.data?.ok === false) {
          setBridgeError(res.data.error || 'Failed to start bridge')
          await checkBridge()
        } else {
          setBridgeStatus('running')
        }
      }
    } catch {
      setBridgeError('Could not reach the bridge supervisor on port 3001. Is Docker running?')
      await checkBridge()
    }
    setBridgeLoading(false)
  }

  if (!open) return null

  return (
    <div
      className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-cyber-dark/95 border border-cyan-500/20 rounded-lg shadow-cyber-lg p-4 z-50 text-xs font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-cyan-400 font-bold tracking-wider text-sm">SYSTEM CONFIG</span>
        <button type="button" onClick={onClose} className="text-cyber-muted hover:text-cyan-300 p-1">
          ✕
        </button>
      </div>

      <label className="block text-cyber-muted mb-1">Backend mode</label>
      <select
        className="w-full bg-black/40 border border-cyan-500/15 rounded p-1.5 mb-3 text-cyan-100"
        value={mode}
        onChange={(e) => {
          setBridgeError(null)
          setMode(e.target.value as BackendMode)
        }}
      >
        <option value="ours">{BACKEND_MODE_LABELS.ours}</option>
        <option value="tak">{BACKEND_MODE_LABELS.tak}</option>
        <option value="ours_synced_with_tak">{BACKEND_MODE_LABELS.ours_synced_with_tak}</option>
        <option value="both">{BACKEND_MODE_LABELS.both}</option>
      </select>

      {showTakBridge && (
        <>
          <label className="block text-cyber-muted mb-1">TAK WebSocket URL</label>
          <input
            className="w-full bg-black/40 border border-cyan-500/15 rounded p-1.5 mb-1 text-cyan-100 placeholder:text-cyber-muted/60"
            value={takWsUrl}
            onChange={(e) => {
              setBridgeError(null)
              setTakWsUrl(e.target.value)
            }}
            placeholder="ws://your-tak-server:8080/ws"
            spellCheck={false}
          />
          {!takUrlReady && (
            <p className="text-[10px] text-cyber-muted mb-3">
              URL must start with <span className="text-cyan-400">ws://</span> or{' '}
              <span className="text-cyan-400">wss://</span>
            </p>
          )}
          {takUrlReady && <div className="mb-3" />}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-cyber-muted">Bridge:</span>
            <span className={bridgeStatus === 'running' ? 'text-emerald-400' : 'text-rose-400'}>
              {bridgeStatus}
            </span>
            <button
              type="button"
              className="ml-auto px-2 py-1 rounded border border-cyan-500/20 hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={bridgeLoading || (bridgeStatus !== 'running' && !takUrlReady)}
              onClick={toggleBridge}
            >
              {bridgeStatus === 'running' ? 'Stop' : 'Start'}
            </button>
          </div>

          {bridgeError && (
            <p className="mb-2 text-[10px] text-rose-400 leading-snug">{bridgeError}</p>
          )}

          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
            Enter your OpenTAK WebSocket URL, then press Start to connect the bridge.
          </div>
        </>
      )}
    </div>
  )
}
