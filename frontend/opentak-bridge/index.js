#!/usr/bin/env node
import express from 'express'
import WebSocket from 'ws'
import fetch from 'node-fetch'

const TAK_WS_URL = process.env.TAK_WS_URL || 'ws://localhost:8080/ws'
const TAK_AUTH_TOKEN = process.env.TAK_AUTH_TOKEN || null
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000'
const PORT = parseInt(process.env.PORT || '3003', 10)

let ws = null
let connected = false

function log(...args) {
  console.log('[opentak-bridge]', ...args)
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function translateTakToInternal(msg) {
  if (!msg) return { type: 'unknown', payload: msg }

  if (msg.type === 'Feature' && msg.geometry) {
    const geom = msg.geometry
    const props = msg.properties || {}
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lon, lat] = geom.coordinates
      const id =
        props.guid ||
        props.uid ||
        props.id ||
        props.callsign ||
        props.name ||
        `${lon}_${lat}`
      const node = {
        id: String(id),
        name: props.callsign || props.name || 'tak_unit',
        lon,
        lat,
        status: 'online',
        metadata: { tak: props },
        last_update: Math.floor(Date.now() / 1000),
      }
      return { type: 'position', payload: node }
    }
  }

  if (msg.map?.type === 'Feature') return translateTakToInternal(msg.map)
  if (msg.message && typeof msg.message === 'object') return translateTakToInternal(msg.message)

  if (msg.text || msg.message_text || msg.summary) {
    return {
      type: 'alert',
      payload: {
        id: msg.id || msg.guid || `alert_${Date.now()}`,
        type: msg.type || 'tak_alert',
        payload: msg,
        ts: Math.floor(Date.now() / 1000),
      },
    }
  }

  return { type: 'unknown', payload: msg }
}

async function forwardToBackend(kind, payload) {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/api/tak/ingest`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: kind, data: payload }),
    })
    if (!res.ok) {
      log(`backend responded ${res.status}:`, await res.text())
    }
  } catch (e) {
    log('failed to forward to backend:', e.message)
  }
}

function startTakConnection() {
  if (ws) return
  log('connecting to TAK ws', TAK_WS_URL)
  const options = {}
  if (TAK_AUTH_TOKEN) options.headers = { Authorization: `Bearer ${TAK_AUTH_TOKEN}` }
  ws = new WebSocket(TAK_WS_URL, options)

  ws.on('open', () => {
    connected = true
    log('connected to TAK')
  })

  ws.on('message', async (data) => {
    let parsed = null
    if (typeof data === 'string') parsed = safeJsonParse(data) || data
    else {
      try {
        parsed = JSON.parse(data.toString())
      } catch {
        parsed = data.toString()
      }
    }
    const t = translateTakToInternal(parsed)
    if (t.type === 'unknown') return
    await forwardToBackend(t.type, t.payload)
  })

  ws.on('close', (code, reason) => {
    connected = false
    log('tak ws closed', code, reason?.toString?.() || reason)
    ws = null
    setTimeout(startTakConnection, 3000)
  })

  ws.on('error', (err) => {
    log('tak ws error', err.message)
  })
}

function stopTakConnection() {
  if (!ws) return
  try {
    ws.close()
  } catch {
    // ignore
  }
  ws = null
  connected = false
}

const app = express()
app.use(express.json())

app.get('/status', (_req, res) => {
  res.json({ connected, takUrl: TAK_WS_URL, backend: BACKEND_URL })
})

app.post('/start', (_req, res) => {
  startTakConnection()
  res.json({ ok: true })
})

app.post('/stop', (_req, res) => {
  stopTakConnection()
  res.json({ ok: true })
})

app.listen(PORT, () => {
  log(`admin HTTP listening on port ${PORT}`)
  startTakConnection()
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
