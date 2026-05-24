import { DEFENSE_ZONE_LEGEND } from '../../data/mapOverlays'
import type { DefenseZoneType } from '../../data/mapOverlays'

interface Props {
  defenseZonesVisible: boolean
  heatmapVisible: boolean
  filters: Record<DefenseZoneType, boolean>
  onToggleDefenseZones: () => void
  onToggleHeatmap: () => void
  onToggleFilter: (type: DefenseZoneType) => void
  onToggleAllFilters: (enabled: boolean) => void
}

export default function MapOverlayLegend({
  defenseZonesVisible,
  heatmapVisible,
  filters,
  onToggleDefenseZones,
  onToggleHeatmap,
  onToggleFilter,
  onToggleAllFilters,
}: Props) {
  const enabledCount = DEFENSE_ZONE_LEGEND.filter(({ type }) => filters[type]).length
  const allFiltersOn = enabledCount === DEFENSE_ZONE_LEGEND.length

  return (
    <div className="glass px-3 py-2.5 rounded-xl border border-cyan-500/20 shadow-cyber w-[220px] max-h-[min(70vh,480px)] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/10">
      {/* ── Defense zones ── */}
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-cyan-500/10 pb-1.5">
        <label className="flex items-center gap-2 cursor-pointer group flex-1 min-w-0">
          <input
            type="checkbox"
            checked={defenseZonesVisible}
            onChange={onToggleDefenseZones}
            className="w-3.5 h-3.5 rounded border-cyan-500/40 bg-black/60 accent-cyan-500 cursor-pointer shrink-0"
          />
          <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-400 uppercase group-hover:text-cyan-300">
            Defense zones
          </span>
        </label>
        {defenseZonesVisible && (
          <button
            type="button"
            onClick={() => onToggleAllFilters(!allFiltersOn)}
            className="text-[8px] font-mono text-cyber-muted hover:text-cyan-300 uppercase tracking-wide shrink-0"
          >
            {allFiltersOn ? 'Clear' : 'All'}
          </button>
        )}
      </div>

      {defenseZonesVisible && (
        <>
          <ul className="space-y-0.5">
            {DEFENSE_ZONE_LEGEND.map(({ type, label, color }) => {
              const checked = filters[type]
              return (
                <li key={type}>
                  <label className="flex items-center gap-2 py-1 cursor-pointer group pl-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleFilter(type)}
                      className="w-3.5 h-3.5 rounded border-cyan-500/40 bg-black/60 accent-cyan-500 cursor-pointer"
                    />
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                      style={{ background: color, boxShadow: checked ? `0 0 8px ${color}55` : undefined }}
                    />
                    <span
                      className={`text-[10px] font-mono leading-tight transition-colors ${
                        checked ? 'text-cyan-200/90 group-hover:text-cyan-100' : 'text-cyber-muted group-hover:text-cyan-300/80'
                      }`}
                    >
                      {label}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {enabledCount === 0 && (
            <p className="text-[9px] font-mono text-rose-400/90 mt-1.5">
              Select at least one zone type to display shells.
            </p>
          )}
        </>
      )}

      {/* ── Heat map ── */}
      <div className="mt-3 pt-2 border-t border-cyan-500/10">
        <label className="flex items-center gap-2 py-1 cursor-pointer group">
          <input
            type="checkbox"
            checked={heatmapVisible}
            onChange={onToggleHeatmap}
            className="w-3.5 h-3.5 rounded border-cyan-500/40 bg-black/60 accent-cyan-500 cursor-pointer"
          />
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-white/10"
            style={{
              background: 'linear-gradient(90deg, #06b6d4 0%, #f59e0b 50%, #ef4444 100%)',
              boxShadow: heatmapVisible ? '0 0 8px rgba(245,158,11,0.4)' : undefined,
            }}
          />
          <span className="text-[10px] font-mono text-cyber-muted group-hover:text-cyan-300 transition-colors">
            Vulnerability heat map
          </span>
        </label>
        <p className="text-[8px] font-mono text-cyber-muted/80 mt-1 pl-6 leading-snug">
          Cyan → amber → red by infrastructure risk
        </p>
      </div>
    </div>
  )
}
