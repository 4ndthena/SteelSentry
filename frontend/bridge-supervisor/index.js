#!/usr/bin/env node
import express from 'express'
import { spawn } from 'child_process'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())

let child = null
let childInfo = null

function startBridge(env = {}) {
  if (child) return { ok: false, error: 'already running' }
  const proc = spawn('node', ['./opentak-bridge/index.js'], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  child = proc
  childInfo = { pid: proc.pid, env }
  proc.on('exit', (code) => {
    child = null
    childInfo = null
    console.log('[supervisor] bridge exited', code)
  })
  return { ok: true }
}

function stopBridge() {
  if (!child) return { ok: false, error: 'not running' }
  try {
    child.kill()
  } catch {
    // ignore
  }
  child = null
  childInfo = null
  return { ok: true }
}

app.get('/status', (_req, res) => {
  res.json({ running: !!child, info: childInfo })
})

app.post('/start', async (req, res) => {
  const { takWsUrl, takAuthToken, backendUrl, mode } = req.body || {}
  const env = {}
  if (takWsUrl) env.TAK_WS_URL = takWsUrl
  if (takAuthToken) env.TAK_AUTH_TOKEN = takAuthToken
  const effectiveBackendUrl = process.env.INTERNAL_BACKEND_URL || backendUrl
  if (effectiveBackendUrl) env.BACKEND_URL = effectiveBackendUrl

  const result = startBridge(env)
  if (effectiveBackendUrl) {
    try {
      await fetch(`${effectiveBackendUrl.replace(/\/$/, '')}/api/tak/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode || 'both' }),
      })
    } catch (e) {
      console.warn('[supervisor] failed to set backend mode:', e.message)
    }
  }
  res.json(result)
})

app.post('/stop', (_req, res) => {
  res.json(stopBridge())
})

const PORT = parseInt(process.env.SUPERVISOR_PORT || '3001', 10)
app.listen(PORT, () => console.log(`[supervisor] listening on ${PORT}`))
