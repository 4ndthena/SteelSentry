import React, { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { useStore } from '../../store'

import {
  bindTrackpadWheelPan,
  cytoscapeWheelZoom,
  MAP_NAVIGATION_HINT,
} from '../../utils/trackpadWheelPan'

export default function LogicalView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const { nodes, links, selectedNodeId, selectNode, activePath } = useStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'offline':  return '#ef4444'
      case 'degraded': return '#f59e0b'
      default:         return '#00f0ff'
    }
  }

  const getLinkColor = (type: string, active: boolean, onPath: boolean) => {
    if (onPath)   return '#00f0ff'
    if (!active)  return '#ef4444'
    switch (type) {
      case 'fiber':    return '#06b6d4'
      case 'mpls':     return '#10b981'
      case 'lte':      return '#3b82f6'
      case 'loramesh': return '#8b5cf6'
      case 'starlink': return '#f59e0b'
      default:         return '#06b6d4'
    }
  }

  // ── Effect 1: create Cytoscape instance once ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Register before Cytoscape so our capture handler runs first and blocks its wheel zoom.
    const unbindWheel = bindTrackpadWheelPan(
      container,
      (dx, dy) => cyRef.current?.panBy({ x: dx, y: dy }),
      {
        onWheelZoom: (e) => {
          const cy = cyRef.current
          if (cy) cytoscapeWheelZoom(cy, container, e)
        },
      },
    )

    const cy = cytoscape({
      container,
      style: [
        {
          selector: 'node',
          style: {
            'width': '28px',
            'height': '28px',
            'label': 'data(label)',
            'font-family': 'Orbitron, sans-serif',
            'font-size': '7px',
            'color': '#cdefff',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'background-color': 'data(color)',
            'border-width': 'data(borderWidth)',
            'border-color': 'data(borderColor)',
            'transition-property': 'background-color, border-color, border-width, width, height',
            'transition-duration': 300,
            'text-background-opacity': 0.6,
            'text-background-color': '#020207',
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': '3px',
            'border-color': '#ffffff',
            'width': '34px',
            'height': '34px',
          }
        },
        {
          selector: 'node[?isEndpoint]',
          style: {
            'width': '34px',
            'height': '34px',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(width)',
            'line-color': 'data(color)',
            'curve-style': 'bezier',
            'opacity': 'data(opacity)',
            'line-style': 'data(lineStyle)',
            'transition-property': 'line-color, opacity, width',
            'transition-duration': 300,
          }
        }
      ],
      layout: { name: 'grid' } as any,  // placeholder; real layout runs in effect 2
      wheelSensitivity: 0.2,
      userZoomingEnabled: false,
    })

    cyRef.current = cy

    cy.on('tap', 'node', (evt) => selectNode(evt.target.id()))
    cy.on('tap', (evt) => { if (evt.target === cy) selectNode(null) })

    return () => {
      unbindWheel()
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    }
  }, [])

  // ── Effect 2: sync data whenever store changes ────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const pathNodeSet = new Set<string>(activePath?.ok ? activePath.node_path : [])
    const pathLinkSet = new Set<string>(activePath?.ok ? activePath.link_path : [])
    const existingNodeIds = new Set(nodes.map((n) => n.id))

    const cyNodes = nodes.map((n) => {
      const onPath    = pathNodeSet.has(n.id)
      const isEndpoint = n.id === activePath?.source || n.id === activePath?.target
      return {
        data: {
          id: n.id,
          label: `${n.id}: ${n.name.split('(')[0].trim()}`,
          color: getStatusColor(n.status),
          borderWidth: isEndpoint ? 3 : onPath ? 2.5 : 1.5,
          borderColor: isEndpoint ? '#00f0ff' : onPath ? '#00f0ff' : '#020207',
          isEndpoint: isEndpoint || undefined,
        }
      }
    })

    const cyEdges = links
      .filter((l) => existingNodeIds.has(l.a) && existingNodeIds.has(l.b))
      .map((l) => {
        const onPath = pathLinkSet.has(l.id)
        return {
          data: {
            id: l.id,
            source: l.a,
            target: l.b,
            color: getLinkColor(l.type, l.active, onPath),
            width: onPath ? 4 : !l.active ? 1.5 : l.type === 'fiber' ? 3.5 : l.type === 'mpls' ? 2.5 : 1.5,
            opacity: onPath ? 1 : l.active ? 0.7 : 0.25,
            lineStyle: l.active ? 'solid' : 'dashed',
          }
        }
      })

    const isFirstLoad = cy.nodes().length === 0

    cy.batch(() => {
      // remove stale elements
      const currentIds = new Set([...cyNodes.map((n) => n.data.id), ...cyEdges.map((e) => e.data.id)])
      cy.elements().forEach((ele) => { if (!currentIds.has(ele.id())) cy.remove(ele) })

      // upsert nodes
      cyNodes.forEach((nd) => {
        const ex = cy.getElementById(nd.data.id)
        if (ex.length > 0) ex.data(nd.data)
        else cy.add({ group: 'nodes', data: nd.data })
      })

      // upsert edges
      cyEdges.forEach((ed) => {
        const ex = cy.getElementById(ed.data.id)
        if (ex.length > 0) ex.data(ed.data)
        else cy.add({ group: 'edges', data: ed.data })
      })

      // sync selection
      cy.nodes().unselect()
      if (selectedNodeId) {
        const sel = cy.getElementById(selectedNodeId)
        if (sel.length > 0) sel.select()
      }
    })

    // Run layout only on first load
    if (isFirstLoad && cy.nodes().length > 0) {
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 600,
        randomize: true,
        fit: true,
        padding: 50,
        nodeRepulsion: () => 800000,
        idealEdgeLength: () => 80,
      } as any).run()
    }
  }, [nodes, links, selectedNodeId, activePath])

  const handleResetView = () => {
    if (cyRef.current) {
      cyRef.current.animate({ fit: { eles: cyRef.current.elements(), padding: 50 }, duration: 500, easing: 'ease-in-out-cubic' } as any)
    }
  }

  return (
    <div className="w-full h-full relative bg-cyber-dark/40 overflow-hidden">
      {/* Cytoscape canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 glass px-3 py-1.5 rounded-lg text-[10px] font-mono border border-cyan-500/10 pointer-events-none uppercase tracking-wider flex flex-col gap-1 text-cyan-400">
        <div className="font-bold border-b border-cyan-500/15 pb-1">Network Legend</div>
        <div className="flex items-center gap-1.5 mt-0.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Fiber Ring</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> MPLS</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> LTE Backup</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> LoRa Mesh</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Starlink</div>
        <div className="flex items-center gap-1.5 border-t border-cyan-500/15 pt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> Severed
        </div>
        {activePath?.ok && (
          <div className="flex items-center gap-1.5 border-t border-cyan-500/15 pt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" /> Active Route
          </div>
        )}
      </div>

      {/* Bottom-right controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <p
          className="glass max-w-[220px] px-3 py-2 rounded-lg border border-cyan-500/20 text-cyan-300/90 text-[10px] font-mono leading-snug shadow-cyber bg-gray-900/80"
          title={MAP_NAVIGATION_HINT}
        >
          {MAP_NAVIGATION_HINT}
        </p>

        <button
          onClick={handleResetView}
          title="Fit graph to screen"
          className="glass flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/20 text-cyan-300 hover:border-cyan-400/50 hover:text-cyan-200 transition-all text-[11px] font-mono font-bold tracking-wide shadow-cyber"
        >
          <span className="text-base">⊕</span>
          <span className="uppercase">Reset View</span>
        </button>
      </div>

      {/* Active path badge */}
      {activePath?.ok && (
        <div className="absolute bottom-4 left-4 z-10 glass px-3 py-2 rounded-lg border border-cyan-500/30 shadow-cyber pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" />
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
              Active Route · {activePath.hops} hops · {activePath.total_latency_ms}ms
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
