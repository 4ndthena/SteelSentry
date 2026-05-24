import type { Node, Link } from '../store'

const DEFENSE_CONFIG: Record<string, { radius: number; color: string; label: string }> = {
  power:     { radius: 0.01, color: '#00f0ff', label: 'Anti-Drone Jammer' },
  telecom:   { radius: 0.016, color: '#10b981', label: 'Detection Radar' },
  emergency: { radius: 0.012, color: '#f59e0b', label: 'Monitoring Coverage' },
  hospital:  { radius: 0.014, color: '#ec4899', label: 'Medical Shield' },
  bridge:    { radius: 0.004, color: '#8b5cf6', label: 'Physical Barrier' },
  industrial:{ radius: 0.012, color: '#f97316', label: 'Industrial Defense' },
  municipal: { radius: 0.008, color: '#06b6d4', label: 'Civic Protection' },
  water:     { radius: 0.008, color: '#3b82f6', label: 'Water Security' },
}

function circlePoints(lon: number, lat: number, radiusDeg: number, segments = 36): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push([lon + radiusDeg * Math.cos(a), lat + radiusDeg * Math.sin(a)])
  }
  return pts
}

export function getHeatmapFeatures(nodes: Node[], links: Link[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const criticalityBase: Record<string, number> = {
    power: 1.0, industrial: 0.9, hospital: 0.9, telecom: 0.8,
    emergency: 0.7, bridge: 0.6, water: 0.5, municipal: 0.4, utility: 0.3,
  }

  for (const node of nodes) {
    const linkCount = links.filter(l => l.a === node.id || l.b === node.id).length
    const baseW = criticalityBase[node.type] || 0.3
    const redundancyPenalty = Math.max(0, 1 - linkCount / 6) * 0.55
    const statusMultiplier = node.status === 'offline' ? 1.35 : node.status === 'degraded' ? 1.2 : 1.0
    // Keep weights in a visible band for MapLibre heatmap-density at city zoom
    const weight = Math.min(1, Math.max(0.35, (baseW + redundancyPenalty) * statusMultiplier))

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
      properties: { weight: Number(weight), nodeId: node.id, status: node.status },
    })
  }

  return { type: 'FeatureCollection', features }
}

export type DefenseZoneType = keyof typeof DEFENSE_CONFIG

export const DEFENSE_ZONE_LEGEND = (
  Object.entries(DEFENSE_CONFIG) as [DefenseZoneType, (typeof DEFENSE_CONFIG)[DefenseZoneType]][]
).map(([type, cfg]) => ({ type, ...cfg }))

export function defaultDefenseZoneFilters(): Record<DefenseZoneType, boolean> {
  return Object.fromEntries(DEFENSE_ZONE_LEGEND.map(({ type }) => [type, true])) as Record<DefenseZoneType, boolean>
}

export function getDefenseZoneFeatures(
  nodes: Node[],
  enabledTypes?: Set<string>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const node of nodes) {
    const config = DEFENSE_CONFIG[node.type]
    if (!config || node.status === 'offline') continue
    if (enabledTypes && !enabledTypes.has(node.type)) continue
    const pts = circlePoints(node.lon, node.lat, config.radius)

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [pts] },
      properties: {
        defense: config.label,
        color: config.color,
        type: node.type,
        nodeId: node.id,
        radius: config.radius,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export { DEFENSE_CONFIG }