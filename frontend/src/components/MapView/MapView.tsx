import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../../store'
import { getHeatmapFeatures, getDefenseZoneFeatures } from '../../data/mapOverlays'
import MapOverlayLegend from './MapOverlayLegend'
import {
  applyMapLibreWheelZoom,
  bindTrackpadWheelPan,
  MAP_NAVIGATION_HINT,
} from '../../utils/trackpadWheelPan'

const DEFAULT_CENTER: [number, number] = [22.0530, 50.5740]
const DEFAULT_ZOOM = 13

const OVERLAY_LAYERS: Record<string, string[]> = {
  heatmap: ['vulnerability-heatmap'],
  defenseZones: ['defense-zones-fill', 'defense-zones-border'],
}

function setLayerVisibility(map: maplibregl.Map, layerIds: string[], visible: boolean) {
  const v = visible ? 'visible' : 'none'
  for (const id of layerIds) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

const HEATMAP_LAYER: maplibregl.LayerSpecification = {
  id: 'vulnerability-heatmap',
  type: 'heatmap',
  source: 'vulnerability',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 11, 1.2, 13, 2, 16, 2.8],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 11, 22, 13, 38, 16, 55],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(6,182,212,0)',
      0.08, 'rgba(6,182,212,0.2)',
      0.25, 'rgba(245,158,11,0.45)',
      0.45, 'rgba(249,115,22,0.62)',
      0.65, 'rgba(239,68,68,0.78)',
      1, 'rgba(220,38,38,0.92)',
    ],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 14, 0.82],
  },
}

function upsertHeatmapLayer(map: maplibregl.Map, data: GeoJSON.FeatureCollection, visible: boolean) {
  if (!map.getLayer('nodes-circle')) return

  if (map.getSource('vulnerability')) {
    ;(map.getSource('vulnerability') as maplibregl.GeoJSONSource).setData(data)
  } else {
    map.addSource('vulnerability', { type: 'geojson', data })
    map.addLayer(HEATMAP_LAYER, 'nodes-circle')
  }

  if (map.getLayer('vulnerability-heatmap') && map.getLayer('nodes-circle')) {
    try {
      map.moveLayer('vulnerability-heatmap', 'nodes-circle')
    } catch {
      // layer already in place
    }
  }

  setLayerVisibility(map, OVERLAY_LAYERS.heatmap, visible)
}

function defenseLayerAnchor(map: maplibregl.Map): string {
  // Keep shells under the heatmap when both are enabled
  if (map.getLayer('vulnerability-heatmap')) return 'vulnerability-heatmap'
  return 'nodes-circle'
}

function upsertDefenseZonesLayer(map: maplibregl.Map, data: GeoJSON.FeatureCollection, visible: boolean) {
  if (!map.getLayer('nodes-circle')) return

  const beforeId = defenseLayerAnchor(map)

  if (map.getSource('defense-zones')) {
    ;(map.getSource('defense-zones') as maplibregl.GeoJSONSource).setData(data)
  } else {
    map.addSource('defense-zones', { type: 'geojson', data })
    map.addLayer({
      id: 'defense-zones-fill',
      type: 'fill',
      source: 'defense-zones',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.16, 14, 0.24],
      },
    }, beforeId)
    map.addLayer({
      id: 'defense-zones-border',
      type: 'line',
      source: 'defense-zones',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.75, 14, 2.75],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.6],
        'line-dasharray': [2, 3],
      },
    }, beforeId)
  }

  const anchor = defenseLayerAnchor(map)
  for (const id of OVERLAY_LAYERS.defenseZones) {
    if (map.getLayer(id) && map.getLayer(anchor)) {
      try {
        map.moveLayer(id, anchor)
      } catch {
        // layer already in place
      }
    }
  }

  setLayerVisibility(map, OVERLAY_LAYERS.defenseZones, visible)
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tryAddSourceRef = useRef<() => boolean>(() => false)
  const {
    nodes,
    links,
    selectedNodeId,
    selectNode,
    activePath,
    overlays,
    toggleOverlay,
    defenseZoneFilters,
    toggleDefenseZoneFilter,
    setAllDefenseZoneFilters,
  } = useStore()
  const [mapLoaded, setMapLoaded] = useState(false)

  const OSM_RASTER_STYLE: any = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        paint: {
          'raster-brightness-max': 0.6,
          'raster-contrast': 0.2,
          'raster-saturation': -0.8,
        }
      },
    ],
  }

  const tryAddSource = () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return false

    try {
      // ── Path node/link sets for highlighting ──────────────────────────
      const pathNodeSet = new Set<string>(activePath?.ok ? activePath.node_path : [])
      const pathLinkSet = new Set<string>(activePath?.ok ? activePath.link_path : [])

      // 1. Node features
      const nodeFeatures = nodes.map((n) => ({
        type: 'Feature',
        properties: {
          id: n.id,
          type: n.type,
          status: n.status,
          name: n.name,
          selected: n.id === selectedNodeId ? 'true' : 'false',
          onPath: pathNodeSet.has(n.id) ? 'true' : 'false',
          isEndpoint: (n.id === activePath?.source || n.id === activePath?.target) ? 'true' : 'false',
        },
        geometry: { type: 'Point', coordinates: [n.lon, n.lat] }
      }))

      // 2. Link features — split into path and non-path
      const linkFeatures = links.map((l) => {
        const nodeA = nodes.find((n) => n.id === l.a)
        const nodeB = nodes.find((n) => n.id === l.b)
        if (!nodeA || !nodeB) return null
        return {
          type: 'Feature',
          properties: {
            id: l.id,
            type: l.type,
            active: l.active ? 'true' : 'false',
            onPath: pathLinkSet.has(l.id) ? 'true' : 'false',
          },
          geometry: {
            type: 'LineString',
            coordinates: [[nodeA.lon, nodeA.lat], [nodeB.lon, nodeB.lat]]
          }
        }
      }).filter(Boolean)

      // 3. Glow path features (only the active path links)
      const pathFeatures = linkFeatures.filter((f: any) => f?.properties.onPath === 'true')

      // ── Overlay data ────────────────────────────────────────────────────
      const heatmapFeatures = getHeatmapFeatures(nodes, links)
      const enabledDefenseTypes = new Set(
        Object.entries(defenseZoneFilters).filter(([, on]) => on).map(([t]) => t),
      )
      const defenseFeatures = getDefenseZoneFeatures(nodes, enabledDefenseTypes)
      const showDefenseShells = overlays.defenseZones && enabledDefenseTypes.size > 0

      // ── Update/create: base links layer ──────────────────────────────
      if (map.getSource('links')) {
        ;(map.getSource('links') as any).setData({ type: 'FeatureCollection', features: linkFeatures })
      } else {
        map.addSource('links', { type: 'geojson', data: { type: 'FeatureCollection', features: linkFeatures } })
        map.addLayer({
          id: 'links-line',
          type: 'line',
          source: 'links',
          filter: ['==', ['get', 'onPath'], 'false'],
          paint: {
            'line-color': [
              'case', ['==', ['get', 'active'], 'false'], '#ef4444',
              ['match', ['get', 'type'],
                'fiber', '#06b6d4', 'mpls', '#10b981',
                'lte', '#3b82f6', 'loramesh', '#8b5cf6', 'starlink', '#f59e0b',
                '#06b6d4']
            ],
            'line-width': [
              'case', ['==', ['get', 'active'], 'false'], 1.5,
              ['match', ['get', 'type'],
                'fiber', 3.5, 'mpls', 2.5, 'lte', 2.0, 'loramesh', 1.5, 'starlink', 2.0, 2.0]
            ],
            'line-opacity': ['case', ['==', ['get', 'active'], 'false'], 0.3, 0.6],
          },
        })
      }

      // ── Update/create: path glow (outer halo) ────────────────────────
      if (map.getSource('path-glow')) {
        ;(map.getSource('path-glow') as any).setData({ type: 'FeatureCollection', features: pathFeatures })
      } else {
        map.addSource('path-glow', { type: 'geojson', data: { type: 'FeatureCollection', features: pathFeatures } })
        map.addLayer({
          id: 'path-glow-outer', type: 'line', source: 'path-glow',
          paint: { 'line-color': '#ffffff', 'line-width': 16, 'line-opacity': 0.06, 'line-blur': 8 },
        }, 'links-line')
        map.addLayer({
          id: 'path-glow-mid', type: 'line', source: 'path-glow',
          paint: { 'line-color': '#00f0ff', 'line-width': 7, 'line-opacity': 0.25, 'line-blur': 3 },
        }, 'links-line')
        map.addLayer({
          id: 'path-glow-core', type: 'line', source: 'path-glow',
          paint: { 'line-color': '#00f0ff', 'line-width': 2.5, 'line-opacity': 1.0 },
        })
      }

      // ── Update/create: nodes layer ────────────────────────────────────
      if (map.getSource('nodes')) {
        ;(map.getSource('nodes') as any).setData({ type: 'FeatureCollection', features: nodeFeatures })
      } else {
        map.addSource('nodes', { type: 'geojson', data: { type: 'FeatureCollection', features: nodeFeatures } })
        map.addLayer({
          id: 'nodes-circle',
          type: 'circle',
          source: 'nodes',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'isEndpoint'], 'true'], 13,
              ['case', ['==', ['get', 'selected'], 'true'], 11,
              ['case', ['==', ['get', 'onPath'], 'true'], 9, 7]]
            ],
            'circle-color': [
              'match', ['get', 'status'],
              'offline', '#f43f5e',
              'degraded', '#f59e0b',
              'online', '#06b6d4',
              '#06b6d4'
            ],
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'isEndpoint'], 'true'], '#00f0ff',
              ['case', ['==', ['get', 'selected'], 'true'], '#ffffff',
              ['case', ['==', ['get', 'onPath'], 'true'], '#00f0ff', '#020207']]
            ],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'isEndpoint'], 'true'], 3,
              ['case', ['==', ['get', 'selected'], 'true'], 2.5,
              ['case', ['==', ['get', 'onPath'], 'true'], 2, 1.5]]
            ],
          },
        })
      }

      // ── Halo for path nodes ───────────────────────────────────────────
      if (map.getSource('path-nodes')) {
        const pathNodeFeatures = nodeFeatures.filter((f: any) => f.properties.onPath === 'true')
        ;(map.getSource('path-nodes') as any).setData({ type: 'FeatureCollection', features: pathNodeFeatures })
      } else {
        const pathNodeFeatures = nodeFeatures.filter((f: any) => f.properties.onPath === 'true')
        map.addSource('path-nodes', { type: 'geojson', data: { type: 'FeatureCollection', features: pathNodeFeatures } })
        map.addLayer({
          id: 'path-nodes-halo',
          type: 'circle',
          source: 'path-nodes',
          paint: {
            'circle-radius': 18,
            'circle-color': '#00f0ff',
            'circle-opacity': 0,
            'circle-stroke-color': '#00f0ff',
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.35,
          },
        }, 'nodes-circle')
      }

      // ── Overlays below node markers (defense shells, then heatmap on top) ─
      if (nodes.length > 0) {
        upsertDefenseZonesLayer(map, defenseFeatures, showDefenseShells)
        upsertHeatmapLayer(map, heatmapFeatures, overlays.heatmap)
      }

      return true
    } catch (err) {
      console.error('MapView tryAddSource error:', err)
      return false
    }
  }

  tryAddSourceRef.current = tryAddSource

  // Sync overlay visibility when toggles change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    for (const [key, layerIds] of Object.entries(OVERLAY_LAYERS)) {
      setLayerVisibility(map, layerIds, overlays[key as keyof typeof overlays])
    }
  }, [overlays, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const container = map.getCanvasContainer()
    map.scrollZoom.disable()
    const unbindWheel = bindTrackpadWheelPan(
      container,
      (dx, dy) => map.panBy([dx, dy], { animate: false }),
      { onWheelZoom: (e) => applyMapLibreWheelZoom(map, container, e) },
    )
    return () => {
      unbindWheel()
      map.scrollZoom.enable()
    }
  }, [mapLoaded])

  // Initialize MapLibre
  useEffect(() => {
    if (mapRef.current) return
    const container = mapContainer.current as HTMLElement
    if (!container) return

    const map = new maplibregl.Map({
      container,
      style: OSM_RASTER_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })
    mapRef.current = map


    map.on('load', () => {
      setMapLoaded(true)
      tryAddSourceRef.current()
      map.on('click', 'nodes-circle', (e: any) => {
        if (e.features?.[0]) selectNode(e.features[0].properties.id)
      })
      map.on('mouseenter', 'nodes-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'nodes-circle', () => { map.getCanvas().style.cursor = '' })
    })

    map.on('styledata', () => tryAddSourceRef.current())
    setTimeout(() => { try { map.resize() } catch (e) {} }, 300)

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  useEffect(() => {
    if (mapRef.current && mapLoaded) tryAddSource()
  }, [nodes, links, selectedNodeId, activePath, mapLoaded, overlays, defenseZoneFilters])

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 800, essential: true })
    }
  }

  return (
    <div className="w-full h-full relative">
      {!mapLoaded && (
        <div className="absolute inset-0 bg-cyber-bg flex items-center justify-center z-50">
          <div className="glass p-5 rounded-xl border border-cyan-500/20 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin" />
            <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
              Initializing Satellite Comms Map...
            </span>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" style={{ touchAction: 'none' }} />

      {/* ── Defense zone legend (top-left) ───────────────────── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 items-start pointer-events-auto">
        <MapOverlayLegend
          defenseZonesVisible={overlays.defenseZones}
          heatmapVisible={overlays.heatmap}
          filters={defenseZoneFilters}
          onToggleDefenseZones={() => toggleOverlay('defenseZones')}
          onToggleHeatmap={() => toggleOverlay('heatmap')}
          onToggleFilter={toggleDefenseZoneFilter}
          onToggleAllFilters={setAllDefenseZoneFilters}
        />
        {activePath?.ok && (
          <div className="glass px-3 py-2 rounded-lg border border-cyan-500/30 shadow-cyber">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" />
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                Active Route · {activePath.hops} hops · {activePath.total_latency_ms}ms
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Map controls overlay ────────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <p
          className="glass max-w-[220px] px-3 py-2 rounded-lg border border-cyan-500/20 text-cyan-300/90 text-[10px] font-mono leading-snug shadow-cyber bg-gray-900/80"
          title={MAP_NAVIGATION_HINT}
        >
          {MAP_NAVIGATION_HINT}
        </p>

        <button
          onClick={handleResetView}
          title="Reset map view to Stalowa Wola"
          className="glass flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/20 text-cyan-300 hover:border-cyan-400/50 hover:text-cyan-200 transition-all text-[11px] font-mono font-bold tracking-wide shadow-cyber"
        >
          <span className="text-base">⊕</span>
          <span className="uppercase">Reset View</span>
        </button>
      </div>

    </div>
  )
}