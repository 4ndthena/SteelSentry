import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { useStore } from '../../store'
import {
  bindTrackpadWheelPan,
  cytoscapeWheelZoom,
  MAP_NAVIGATION_HINT,
} from '../../utils/trackpadWheelPan'

export default function DependencyFlowView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const { nodes, dependencies, selectedNodeId, selectNode } = useStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'offline':  return '#ef4444'
      case 'degraded': return '#f59e0b'
      default:         return '#00f0ff'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'power':       return '#ef4444'
      case 'telecom':     return '#06b6d4'
      case 'hospital':    return '#10b981'
      case 'emergency':   return '#f59e0b'
      case 'bridge':      return '#8b5cf6'
      case 'water':       return '#3b82f6'
      case 'industrial':  return '#f97316'
      case 'municipal':   return '#ec4899'
      default:            return '#5b8296'
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

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
            'width': '30px',
            'height': '30px',
            'label': 'data(label)',
            'font-family': 'Orbitron, sans-serif',
            'font-size': '7px',
            'color': '#cdefff',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'background-color': 'data(color)',
            'border-width': 'data(borderWidth)',
            'border-color': 'data(borderColor)',
            'transition-property': 'background-color, border-color, border-width',
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
            'width': '36px',
            'height': '36px',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#5b8296',
            'target-arrow-color': '#5b8296',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
            'arrow-scale': 0.8,
            'transition-property': 'line-color, opacity',
            'transition-duration': 300,
          }
        },
        {
          selector: 'edge[?isCascaded]',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'opacity': 1,
            'width': 3,
          }
        },
      ],
      layout: { name: 'grid' } as any,
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

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const offlineSet = new Set(nodes.filter(n => n.status === 'offline').map(n => n.id))
    const degradedSet = new Set(nodes.filter(n => n.status === 'degraded').map(n => n.id))

    const cyNodes = nodes.map(n => ({
      data: {
        id: n.id,
        label: `${n.id}: ${n.name.split('(')[0].trim()}`,
        color: getStatusColor(n.status),
        borderWidth: 2,
        borderColor: getTypeColor(n.type),
      }
    }))

    const cyEdges = dependencies.map((d, i) => ({
      data: {
        id: `dep_${d.parent}_${d.child}`,
        source: d.parent,
        target: d.child,
        isCascaded: (offlineSet.has(d.parent) && degradedSet.has(d.child)) || undefined,
      }
    }))

    const isFirstLoad = cy.nodes().length === 0

    cy.batch(() => {
      const currentIds = new Set([...cyNodes.map(n => n.data.id), ...cyEdges.map(e => e.data.id)])
      cy.elements().forEach(ele => { if (!currentIds.has(ele.id())) cy.remove(ele) })

      cyNodes.forEach(nd => {
        const ex = cy.getElementById(nd.data.id)
        if (ex.length > 0) ex.data(nd.data)
        else cy.add({ group: 'nodes', data: nd.data })
      })

      cyEdges.forEach(ed => {
        const ex = cy.getElementById(ed.data.id)
        if (ex.length > 0) ex.data(ed.data)
        else cy.add({ group: 'edges', data: ed.data })
      })

      cy.nodes().unselect()
      if (selectedNodeId) {
        const sel = cy.getElementById(selectedNodeId)
        if (sel.length > 0) sel.select()
      }
    })

    if (isFirstLoad && cy.nodes().length > 0) {
      cy.layout({
        name: 'breadthfirst',
        directed: true,
        animate: true,
        animationDuration: 600,
        fit: true,
        padding: 50,
        spacingFactor: 1.2,
      } as any).run()
    }
  }, [nodes, dependencies, selectedNodeId])

  const handleResetView = () => {
    if (cyRef.current) {
      cyRef.current.animate({ fit: { eles: cyRef.current.elements(), padding: 50 }, duration: 500 } as any)
    }
  }

  return (
    <div className="w-full h-full relative bg-cyber-dark/40 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 glass px-3 py-1.5 rounded-lg text-[10px] font-mono border border-cyan-500/10">
        <div className="font-bold text-cyan-400 border-b border-cyan-500/15 pb-1 mb-1 uppercase tracking-wider">Dependency Legend</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-cyber-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#ef4444' }} /> Power</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#06b6d4' }} /> Telecom</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#10b981' }} /> Hospital</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#f59e0b' }} /> Emergency</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#8b5cf6' }} /> Bridge</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#3b82f6' }} /> Water</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#f97316' }} /> Industrial</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: '#ec4899' }} /> Municipal</span>
        </div>
        <div className="border-t border-cyan-500/15 pt-1 mt-1 space-y-0.5 text-[9px]">
          <div className="flex items-center gap-1 text-amber-400"><span className="w-2 h-0.5 bg-amber-400" /> Cascaded Degradation</div>
          <div className="flex items-center gap-1 text-cyber-muted"><span className="w-2 h-0.5 bg-cyan-500/40" /> Normal Flow</div>
        </div>
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
    </div>
  )
}