import React, { useState } from 'react'
import { useStore } from '../../store'
import axios from 'axios'
import { backendHttpUrl } from '../../api'

export default function SimulationControls() {
  const { nodes, links, backendHost, backendPort } = useStore()
  const [selectedNode, setSelectedNode] = useState('')
  const [selectedLink, setSelectedLink] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | ''>('')

  // Filter online/degraded nodes for drone strike targets
  const targetNodes = nodes.filter((n) => n.status !== 'offline')
  
  // Filter active links for fiber cut targets
  const activeLinks = links.filter((l) => l.active)

  const showStatus = (msg: string, type: 'info' | 'success' | 'error') => {
    setStatus(msg)
    setStatusType(type)
    setTimeout(() => {
      setStatus('')
      setStatusType('')
    }, 4000)
  }

  const runDroneStrike = async () => {
    if (!selectedNode) {
      showStatus('Select a target node first', 'error')
      return
    }
    
    showStatus('Targeting node for strike...', 'info')
    try {
      const res = await axios.post(backendHttpUrl(backendHost, backendPort, '/api/simulate'), {
        scenario: 'drone_strike',
        params: { target_node: selectedNode },
      })
      if (res.data.ok) {
        showStatus(`Strike successful on ${selectedNode}!`, 'success')
        setSelectedNode('')
      } else {
        showStatus(`Failed: ${res.data.error || 'Server error'}`, 'error')
      }
    } catch (e) {
      showStatus('Failed to send drone strike command', 'error')
    }
  }

  const runFiberCut = async () => {
    if (!selectedLink) {
      showStatus('Select a link to sever first', 'error')
      return
    }
    
    showStatus('Severing communication line...', 'info')
    try {
      const res = await axios.post(backendHttpUrl(backendHost, backendPort, '/api/simulate'), {
        scenario: 'fiber_cut',
        params: { link_id: selectedLink },
      })
      if (res.data.ok) {
        showStatus(`Link ${selectedLink} severed successfully!`, 'success')
        setSelectedLink('')
      } else {
        showStatus(`Failed: ${res.data.error || 'Server error'}`, 'error')
      }
    } catch (e) {
      showStatus('Failed to sever communication link', 'error')
    }
  }

  return (
    <div className="glass p-4 rounded-xl border border-cyan-500/15 shadow-cyber flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-mono font-bold tracking-wider text-cyan-400 uppercase">
            War Game Simulator
          </span>
        </div>
      </div>

      {/* Drone Strike Control Group */}
      <div className="space-y-2 p-3 rounded-lg bg-black/40 border border-cyan-500/5">
        <div className="text-[10px] text-rose-400 font-mono uppercase tracking-wider font-bold flex items-center gap-1">
          💥 Drone Strike Scenario
        </div>
        <div className="flex gap-2">
          <select 
            className="flex-1 text-xs p-2 rounded bg-cyber-dark/80 border border-cyan-500/20 text-cyan-200 font-mono focus:outline-none focus:border-cyan-400 transition-colors max-w-[200px]"
            value={selectedNode}
            onChange={(e) => setSelectedNode(e.target.value)}
          >
            <option value="">-- SELECT TARGET NODE --</option>
            {targetNodes.map((n) => (
              <option key={n.id} value={n.id} className="bg-cyber-dark text-cyan-200">
                {n.id} ({n.name}) [{n.status}]
              </option>
            ))}
          </select>
          <button 
            className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 hover:border-rose-400 transition-all font-mono text-xs font-bold flex-1"
            onClick={runDroneStrike}
          >
            STRIKE
          </button>
        </div>
      </div>

      {/* Fiber Cut Control Group */}
      <div className="space-y-2 p-3 rounded-lg bg-black/40 border border-cyan-500/5">
        <div className="text-[10px] text-amber-400 font-mono uppercase tracking-wider font-bold flex items-center gap-1">
          ✂️ Fiber Cut Scenario
        </div>
        <div className="flex gap-2">
          <select 
            className="flex-1 text-xs p-2 rounded bg-cyber-dark/80 border border-cyan-500/20 text-cyan-200 font-mono focus:outline-none focus:border-cyan-400 transition-colors max-w-[200px]"
            value={selectedLink}
            onChange={(e) => setSelectedLink(e.target.value)}
          >
            <option value="">-- SELECT NET LINK --</option>
            {activeLinks.map((l) => {
              const nodeA = nodes.find((n) => n.id === l.a)
              const nodeB = nodes.find((n) => n.id === l.b)
              return (
                <option key={l.id} value={l.id} className="bg-cyber-dark text-cyan-200">
                  {l.id} ({nodeA?.name || l.a} ➔ {nodeB?.name || l.b})
                </option>
              )
            })}
          </select>
          <button 
            className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-400 transition-all font-mono text-xs font-bold flex-1"
            onClick={runFiberCut}
          >
            CUT LINK
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status && (
        <div className={`p-2 rounded font-mono text-[10px] uppercase text-center border transition-all ${
          statusType === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          statusType === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
        }`}>
          {status}
        </div>
      )}
    </div>
  )
}
