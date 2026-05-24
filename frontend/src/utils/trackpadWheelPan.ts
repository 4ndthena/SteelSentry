export type TrackpadWheelPanOptions = {
  /** Handle zoom here (required on MapLibre — blocks native scrollZoom to avoid double-handling). */
  onWheelZoom?: (e: WheelEvent) => void
}

/** Shown on map views — explains scroll vs zoom gestures. */
export const MAP_NAVIGATION_HINT =
  'Two-finger scroll moves the map · Mouse wheel or ⌘/Ctrl + scroll to zoom'

/** MapLibre scroll_zoom constants (maplibre-gl/src/ui/handler/scroll_zoom.ts) */
const WHEEL_ZOOM_DELTA = 4.000244140625
const MAPLIBRE_DEFAULT_ZOOM_RATE = 1 / 100
const MAPLIBRE_WHEEL_ZOOM_RATE = 1 / 450
const MAPLIBRE_MAX_SCALE_PER_FRAME = 2

/** MapLibre treats |deltaY| < 4 (px) as trackpad; line/page mode is mouse wheel. */
const TRACKPAD_PAN_MAX_DELTA_PX = 4

export function wheelEventDeltaY(e: WheelEvent): number {
  return e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY
}

/** True when the event should zoom (mouse wheel, ⌘/Ctrl+scroll), not pan. */
export function isMouseWheelZoomEvent(e: WheelEvent): boolean {
  if (e.ctrlKey || e.metaKey) return true

  const value = wheelEventDeltaY(e)
  if (value === 0) return false

  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE || e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return true
  }

  if (Math.abs(value % WHEEL_ZOOM_DELTA) < 1e-6) return true

  // Match MapLibre: fine pixel deltas are trackpad; coarser steps are mouse wheel.
  if (Math.abs(value) >= TRACKPAD_PAN_MAX_DELTA_PX) return true

  return false
}

/**
 * Per-event zoom scale matching MapLibre scrollZoom (wheel + Ctrl/⌘ trackpad zoom).
 */
export function mapLibreWheelZoomScale(e: WheelEvent): number {
  let value = wheelEventDeltaY(e)
  if (e.shiftKey && value) value /= 4

  if (value === 0) return 1

  const zoomRate = isMouseWheelZoomEvent(e)
    ? MAPLIBRE_WHEEL_ZOOM_RATE
    : MAPLIBRE_DEFAULT_ZOOM_RATE

  let scale =
    MAPLIBRE_MAX_SCALE_PER_FRAME / (1 + Math.exp(-Math.abs(value) * zoomRate))

  if (value > 0) scale = 1 / scale

  return scale
}

type MapWheelZoomTarget = {
  getZoom(): number
  getMinZoom(): number
  getMaxZoom(): number
  zoomTo(zoom: number, options?: { around?: [number, number]; duration?: number }): void
  unproject(point: [number, number]): { lng: number; lat: number }
}

/** Zoom MapLibre at cursor — used instead of native scrollZoom when pan/zoom is unified. */
export function applyMapLibreWheelZoom(
  map: MapWheelZoomTarget,
  container: HTMLElement,
  e: WheelEvent,
) {
  const scale = mapLibreWheelZoomScale(e)
  const deltaZoom = Math.log2(scale)
  if (!Number.isFinite(deltaZoom) || deltaZoom === 0) return

  const rect = container.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const around = map.unproject([x, y])
  const next = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), map.getZoom() + deltaZoom))
  map.zoomTo(next, { around: [around.lng, around.lat], duration: 0 })
}

/**
 * Trackpad two-finger scroll pans; mouse wheel and ⌘/Ctrl+scroll zoom.
 * Always stops propagation so the map library does not also handle the same event.
 */
export function bindTrackpadWheelPan(
  container: HTMLElement,
  panBy: (dx: number, dy: number) => void,
  options?: TrackpadWheelPanOptions,
): () => void {
  const handleWheel = (e: WheelEvent) => {
    const wantsZoom = isMouseWheelZoomEvent(e)

    e.preventDefault()
    e.stopPropagation()

    if (wantsZoom) {
      options?.onWheelZoom?.(e)
      return
    }

    const dx = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaX * 40 : e.deltaX
    const dy = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY
    panBy(-dx, -dy)
  }

  container.addEventListener('wheel', handleWheel, { passive: false, capture: true })
  return () => container.removeEventListener('wheel', handleWheel, { capture: true })
}

type CytoscapeZoomApi = {
  zoom(): number
  zoom(opts: { level: number; renderedPosition: { x: number; y: number } }): unknown
  minZoom(): number
  maxZoom(): number
}

export function cytoscapeWheelZoom(cy: CytoscapeZoomApi, container: HTMLElement, e: WheelEvent) {
  const rect = container.getBoundingClientRect()
  const scale = mapLibreWheelZoomScale(e)
  const level = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * scale))
  cy.zoom({
    level,
    renderedPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top },
  })
}
