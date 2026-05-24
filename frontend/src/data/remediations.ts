export interface Remediation {
  id: string
  title: string
  steps: string[]
  effort: 'quick' | 'moderate' | 'major'
  effect: string
}

type EntityType = 'node' | 'link'

interface RemediationKey {
  entityType: EntityType
  type: string
  status: string
}

const registry: Record<string, Remediation[]> = {}

function key(e: EntityType, type: string, status: string) {
  return `${e}:${type}:${status}`
}

function register(e: EntityType, type: string, status: string, items: Remediation[]) {
  registry[key(e, type, status)] = items
}

export function getRemediations(entityType: EntityType, type: string, status: string): Remediation[] {
  return registry[key(entityType, type, status)] || registry[key(entityType, 'generic', status)] || []
}

// ── Power ──────────────────────────────────────────────
register('node', 'power', 'offline', [
  { id: 'power_gen', title: 'Activate Backup Generator', steps: ['Power on standby generator at substation', 'Transfer load from main grid', 'Verify output voltage and frequency', 'Monitor fuel levels'], effort: 'quick', effect: 'Restores power node within 2 minutes using on-site diesel generator' },
  { id: 'power_reroute', title: 'Reroute from Grid Segment B', steps: ['Open tie switch to Segment B feeder', 'Isolate damaged Segment A', 'Balance load across remaining feeders', 'Confirm voltage stability'], effort: 'moderate', effect: 'Bypasses failed segment and restores supply from alternate grid path in ~8 minutes' },
  { id: 'power_ups', title: 'Deploy Mobile UPS Unit', steps: ['Position mobile UPS at substation', 'Connect to critical bus bars', 'Set output to 50Hz/230V', 'Verify battery charge level'], effort: 'quick', effect: 'Provides temporary backup power for 30–60 minutes while permanent fixes are applied' },
])
register('node', 'power', 'degraded', [
  { id: 'power_reduce', title: 'Reduce Non-Essential Load', steps: ['Identify non-critical power consumers', 'Open branch breakers for non-essential circuits', 'Monitor reduced load on main bus'], effort: 'quick', effect: 'Cuts load by ~30% to stabilize degraded supply' },
  { id: 'power_monitor', title: 'Increase Voltage Monitoring', steps: ['Enable high-frequency voltage logging', 'Set thresholds for under/over voltage alerts', 'Deploy line crew to inspect visible hardware'], effort: 'quick', effect: 'Prevents cascading failure by catching excursions early' },
])

// ── Telecom ────────────────────────────────────────────
register('node', 'telecom', 'offline', [
  { id: 'tel_radio', title: 'Switch to Backup Radio Link', steps: ['Enable backup microwave radio', 'Point antenna to nearest active tower', 'Verify signal strength > -70 dBm', 'Test throughput with ping'], effort: 'quick', effect: 'Restores connectivity via point-to-point microwave in under 3 minutes' },
  { id: 'tel_starlink', title: 'Activate Starlink Terminal', steps: ['Deploy Starlink dish in open area', 'Connect to network switch', 'Configure static IP route', 'Verify satellite acquisition'], effort: 'moderate', effect: 'Provides 150+ Mbps satellite backup within 10 minutes of deployment' },
  { id: 'tel_repeater', title: 'Deploy Field Repeater', steps: ['Transport repeater unit to high ground', 'Erect mast and secure guy lines', 'Power on and align with mesh network', 'Register at network gateway'], effort: 'major', effect: 'Extends coverage range by 3–5 km using a tactical repeater tower (~20 min setup)' },
])
register('node', 'telecom', 'degraded', [
  { id: 'tel_gain', title: 'Boost Antenna Gain', steps: ['Increase transmit power by 3 dB', 'Adjust antenna tilt for optimal coverage', 'Verify reduced packet loss'], effort: 'quick', effect: 'Improves signal-to-noise ratio and restores throughput' },
  { id: 'tel_freq', title: 'Switch to Secondary Frequency', steps: ['Change operating frequency band', 'Coordinate with adjacent nodes', 'Test link quality on new channel'], effort: 'moderate', effect: 'Bypasses interference on primary frequency' },
])

// ── Hospital ───────────────────────────────────────────
register('node', 'hospital', 'offline', [
  { id: 'hosp_power', title: 'Activate Backup Power', steps: ['Start hospital backup generator', 'Switch life-support circuits to emergency bus', 'Verify HVAC and ventilation systems', 'Confirm generator fuel supply'], effort: 'quick', effect: 'Restores full power to critical medical systems within 90 seconds' },
  { id: 'hosp_comms', title: 'Enable Emergency Comms Protocol', steps: ['Activate emergency radio room', 'Switch phone systems to backup exchange', 'Enable hospital-wide intercom', 'Notify regional health authority'], effort: 'moderate', effect: 'Establishes redundant communication channels in case of network failure' },
  { id: 'hosp_circuit', title: 'Switch to Backup Generator Circuit', steps: ['Open main breaker to failed circuit', 'Close backup generator breaker', 'Verify load distribution', 'Tag out damaged circuit'], effort: 'quick', effect: 'Isolates electrical fault and restores power in under 5 minutes' },
])
register('node', 'hospital', 'degraded', [
  { id: 'hosp_throttle', title: 'Reduce Non-Critical Traffic', steps: ['Prioritize emergency department bandwidth', 'Throttle administrative network traffic', 'Enable QoS for medical devices'], effort: 'quick', effect: 'Preserves network capacity for life-critical systems' },
])

// ── Emergency ──────────────────────────────────────────
register('node', 'emergency', 'offline', [
  { id: 'emer_tower', title: 'Activate Backup Comms Tower', steps: ['Power on backup radio tower', 'Connect to regional dispatch network', 'Test all emergency channels', 'Verify GPS time sync'], effort: 'quick', effect: 'Restores emergency communications within 3 minutes via backup tower' },
  { id: 'emer_mcu', title: 'Deploy Mobile Command Unit', steps: ['Drive MCU to operational area', 'Extend mast and stabilize vehicle', 'Connect to satellite uplink', 'Establish incident command net'], effort: 'moderate', effect: 'Deploys fully-equipped mobile command post with independent comms in ~15 minutes' },
  { id: 'emer_sat', title: 'Switch to Satellite Backup Link', steps: ['Orient satellite terminal', 'Establish link with geostationary satellite', 'Configure data and voice channels', 'Test emergency call routing'], effort: 'quick', effect: 'Provides immediate satellite backhaul independent of ground infrastructure' },
])
register('node', 'emergency', 'degraded', [
  { id: 'emer_prio', title: 'Prioritize Dispatch Bandwidth', steps: ['Enable emergency priority queue', 'Reduce non-emergency data allocation', 'Test 911 call routing'], effort: 'quick', effect: 'Ensures emergency calls get through even on degraded links' },
])

// ── Bridge ─────────────────────────────────────────────
register('node', 'bridge', 'offline', [
  { id: 'brdg_pontoon', title: 'Deploy Tactical Pontoon', steps: ['Transport pontoon sections to riverbank', 'Assemble floating bridge segments', 'Anchor upstream and downstream', 'Test load capacity with light vehicle'], effort: 'moderate', effect: 'Establishes temporary crossing capable of supporting military logistics within 25 minutes' },
  { id: 'brdg_reroute', title: 'Reroute through Alternate Crossing', steps: ['Identify nearest operational crossing', 'Update navigation waypoints', 'Dispatch traffic control teams', 'Clear alternate route path'], effort: 'quick', effect: 'Redirects traffic to nearest functional crossing in under 5 minutes' },
  { id: 'brdg_reinforce', title: 'Activate Emergency Bridge Reinforcement', steps: ['Deploy structural supports at weak points', 'Install tension cables', 'Reduce maximum load rating', 'Monitor stress sensors'], effort: 'major', effect: 'Reinforces damaged bridge structure to handle reduced-load traffic (~30 min work)' },
])
register('node', 'bridge', 'degraded', [
  { id: 'brdg_limit', title: 'Reduce Max Load Capacity', steps: ['Post reduced weight limit signage', 'Notify logistics command of restriction', 'Deploy load inspection team'], effort: 'quick', effect: 'Prevents structural collapse by limiting vehicle weight crossing' },
])

// ── Water ──────────────────────────────────────────────
register('node', 'water', 'offline', [
  { id: 'water_pump', title: 'Activate Backup Pump', steps: ['Start standby pump motor', 'Open discharge valve', 'Prime pump if needed', 'Verify pressure at distribution header'], effort: 'quick', effect: 'Restores water pressure within 3 minutes using on-site backup pump' },
  { id: 'water_bypass', title: 'Switch to Reservoir Bypass', steps: ['Isolate main treatment line', 'Open bypass valve to reservoir', 'Adjust chlorination feed rate', 'Verify water quality samples'], effort: 'moderate', effect: 'Bypasses damaged treatment section, supplies untreated but safe reservoir water' },
  { id: 'water_mobile', title: 'Deploy Mobile Pump Unit', steps: ['Position mobile pump at water source', 'Connect suction and discharge hoses', 'Start pump and adjust flow', 'Test output pressure'], effort: 'major', effect: 'Provides emergency pumping capacity from alternate water source (~20 min setup)' },
])
register('node', 'water', 'degraded', [
  { id: 'water_pressure', title: 'Reduce Distribution Pressure', steps: ['Throttle main distribution valve', 'Monitor pressure at endpoints', 'Notify consumers of reduced service'], effort: 'quick', effect: 'Reduces system strain and prevents pipe bursts during degraded operation' },
])

// ── Industrial ─────────────────────────────────────────
register('node', 'industrial', 'offline', [
  { id: 'ind_hardened', title: 'Enable Hardened Network Path', steps: ['Activate armored fiber conduit path', 'Bypass exposed copper links', 'Verify encryption on all segments', 'Test SCADA connectivity'], effort: 'quick', effect: 'Switches industrial control network to hardened path resistant to physical attack' },
  { id: 'ind_defense', title: 'Activate Defense Grid Mode', steps: ['Enable facility-wide defense protocol', 'Lock down external network access', 'Activate perimeter monitoring', 'Alert security command'], effort: 'moderate', effect: 'Puts facility in defensive posture with restricted access and enhanced monitoring' },
  { id: 'ind_backup', title: 'Switch to Industrial Backup Ring', steps: ['Open tie to backup network ring', 'Isolate compromised segment', 'Re-route SCADA traffic', 'Verify process control systems'], effort: 'moderate', effect: 'Restores industrial control connectivity via redundant ring topology' },
])
register('node', 'industrial', 'degraded', [
  { id: 'ind_isolate', title: 'Isolate Affected Segment', steps: ['Identify degraded production zone', 'Isolate zone from main network', 'Route traffic around affected area'], effort: 'quick', effect: 'Prevents degradation from spreading to adjacent production lines' },
])

// ── Municipal ──────────────────────────────────────────
register('node', 'municipal', 'offline', [
  { id: 'muni_ring', title: 'Switch to Alternate City Ring', steps: ['Activate redundant city network ring', 'Migrate essential municipal services', 'Verify civic database access', 'Test public service portals'], effort: 'quick', effect: 'Restores city services by failing over to secondary network ring in ~4 minutes' },
  { id: 'muni_server', title: 'Activate Municipal Backup Server', steps: ['Power on backup server rack', 'Restore latest database snapshot', 'Redirect DNS to backup IP', 'Verify data integrity'], effort: 'moderate', effect: 'Brings hot standby server online with near-current data within 10 minutes' },
  { id: 'muni_link', title: 'Deploy Emergency City Hall Link', steps: ['Establish temporary point-to-point link', 'Configure routing to city services', 'Test remote access for officials'], effort: 'moderate', effect: 'Creates emergency network link for city administration to continue operations' },
])
register('node', 'municipal', 'degraded', [
  { id: 'muni_throttle', title: 'Throttle Non-Essential Services', steps: ['Identify non-critical city services', 'Reduce bandwidth allocation', 'Reserve capacity for emergency services'], effort: 'quick', effect: 'Frees network capacity for essential municipal functions during degraded mode' },
])

// ── Utility (generic fallback) ─────────────────────────
register('node', 'utility', 'offline', [
  { id: 'util_reboot', title: 'Apply Standard Recovery Protocol', steps: ['Execute remote power cycle', 'Wait for system POST', 'Verify network registration', 'Run connectivity tests'], effort: 'quick', effect: 'Standard node reboot and recovery procedure (~3 minutes)' },
  { id: 'util_backup', title: 'Activate Generic Backup Module', steps: ['Power on standby module', 'Load latest configuration', 'Redirect traffic to backup unit', 'Verify operational status'], effort: 'moderate', effect: 'Fails over to backup hardware module for continuous operation' },
])
register('node', 'utility', 'degraded', [
  { id: 'util_diag', title: 'Run Diagnostics', steps: ['Execute full diagnostic suite', 'Analyze error logs', 'Identify root cause', 'Apply recommended fix'], effort: 'quick', effect: 'Identifies and resolves common degradation causes automatically' },
])

// ── Generic node fallback ──────────────────────────────
register('node', 'generic', 'offline', [
  { id: 'gen_reboot', title: 'Reboot Node', steps: ['Execute remote power cycle', 'Wait for system to restart', 'Verify connectivity', 'Run health check'], effort: 'quick', effect: 'Standard reboot procedure' },
  { id: 'gen_failover', title: 'Activate Failover Node', steps: ['Identify standby node', 'Promote standby to active', 'Redirect traffic', 'Verify service levels'], effort: 'moderate', effect: 'Fails over to standby unit for continuous operation' },
])
register('node', 'generic', 'degraded', [
  { id: 'gen_restart_service', title: 'Restart Affected Services', steps: ['Identify failing service', 'Restart service daemon', 'Verify service health', 'Check logs for recurrence'], effort: 'quick', effect: 'Restarts critical services to clear transient faults' },
])

// ── Fiber links ────────────────────────────────────────
register('link', 'fiber', 'severed', [
  { id: 'fiber_splice', title: 'Splice Fiber Cable', steps: ['Locate break point with OTDR', 'Strip and clean fiber ends', 'Fusion-splice new segment', 'Test with optical power meter'], effort: 'moderate', effect: 'Physically repairs broken fiber with fusion splice (~20 min per splice)' },
  { id: 'fiber_redundant', title: 'Activate Redundant Fiber Path', steps: ['Identify alternate fiber route', 'Update optical switch configuration', 'Verify light levels on backup path', 'Monitor for errors'], effort: 'quick', effect: 'Instantly fails over to pre-provisioned redundant fiber path' },
  { id: 'fiber_microwave', title: 'Deploy Temporary Microwave Link', steps: ['Set up microwave dishes at both ends', 'Align antennas for line-of-sight', 'Configure Ethernet bridging', 'Test throughput and latency'], effort: 'major', effect: 'Provides temporary wireless backhaul while fiber is repaired (~25 min setup)' },
])

// ── MPLS links ─────────────────────────────────────────
register('link', 'mpls', 'severed', [
  { id: 'mpls_tunnel', title: 'Reroute through Backup MPLS Tunnel', steps: ['Activate pre-configured backup LSP', 'Redirect traffic to backup tunnel', 'Verify MPLS label switching', 'Monitor for packet loss'], effort: 'quick', effect: 'Switches traffic to backup MPLS tunnel in under 30 seconds' },
  { id: 'mpls_lte', title: 'Activate LTE Failover', steps: ['Enable LTE modem on router', 'Configure IPsec tunnel over LTE', 'Update routing table metrics', 'Test end-to-end connectivity'], effort: 'quick', effect: 'Provides 4G LTE backup link as temporary MPLS replacement (~2 min failover)' },
  { id: 'mpls_reconfig', title: 'Reconfigure MPLS Label Switch', steps: ['Access LSR configuration', 'Rebuild label forwarding table', 'Update traffic engineering parameters', 'Verify LSP connectivity'], effort: 'moderate', effect: 'Re-routes MPLS traffic through alternate label-switched paths' },
])

// ── LTE links ──────────────────────────────────────────
register('link', 'lte', 'severed', [
  { id: 'lte_boost', title: 'Boost Cell Tower Signal', steps: ['Increase base station transmit power', 'Adjust antenna downtilt', 'Verify UE reference signal power', 'Monitor connected users'], effort: 'quick', effect: 'Extends cell coverage and improves signal by up to 6 dB' },
  { id: 'lte_antenna', title: 'Deploy Directional Antenna', steps: ['Mount directional yagi antenna', 'Point toward nearest active tower', 'Connect to LTE modem', 'Verify signal improvement'], effort: 'moderate', effect: 'Focused directional antenna improves weak signal by 10–15 dB' },
  { id: 'lte_power', title: 'Increase Power on Backup Sector', steps: ['Increase backup sector transmit power', 'Hand over users from failed sector', 'Balance load across remaining sectors'], effort: 'quick', effect: 'Compensates for failed LTE sector by boosting adjacent sectors' },
])

// ── LoRa Mesh links ────────────────────────────────────
register('link', 'loramesh', 'severed', [
  { id: 'lora_extender', title: 'Deploy Mesh Extender Node', steps: ['Place LoRa mesh extender at midpoint', 'Power on and register to network', 'Verify mesh routing table update', 'Test end-to-end packet delivery'], effort: 'moderate', effect: 'Extends mesh network range by adding a relay node at optimal midpoint' },
  { id: 'lora_power', title: 'Increase Transmission Power', steps: ['Raise LoRa radio TX power setting', 'Verify link budget improvement', 'Monitor for packet collisions', 'Check regulatory limits'], effort: 'quick', effect: 'Increases link range by raising TX power from 14 dBm to 20 dBm' },
  { id: 'lora_gateway', title: 'Repair LoRa Gateway', steps: ['Diagnose gateway failure cause', 'Replace faulty LoRa concentrator', 'Restart gateway service', 'Verify packet forwarder operation'], effort: 'major', effect: 'Replaces failed LoRa gateway hardware and restores mesh connectivity' },
])

// ── Starlink links ─────────────────────────────────────
register('link', 'starlink', 'severed', [
  { id: 'star_align', title: 'Realign Satellite Dish', steps: ['Check dish obstruction and clear debris', 'Power cycle dish and router', 'Run Starlink alignment tool', 'Verify satellite acquisition'], effort: 'quick', effect: 'Re-establishes satellite link by clearing obstructions and re-aligning dish' },
  { id: 'star_ground', title: 'Switch to Ground-Based Backup', steps: ['Activate terrestrial backup connection', 'Update default route metric', 'Verify connectivity to upstream', 'Monitor link stability'], effort: 'quick', effect: 'Fails over to wired/fiber backup connection for continuous service' },
  { id: 'star_terminal', title: 'Activate Secondary Terminal', steps: ['Power on secondary Starlink dish', 'Connect to management console', 'Configure as active gateway', 'Retire primary terminal for service'], effort: 'moderate', effect: 'Brings backup Starlink terminal online while primary is serviced' },
])

// ── Generic link fallback ──────────────────────────────
register('link', 'generic', 'severed', [
  { id: 'link_restore', title: 'Restore Link Configuration', steps: ['Backup current config', 'Reset interface configuration', 'Apply known-good config backup', 'Verify link state and metrics'], effort: 'quick', effect: 'Restores link by reloading a known-good configuration' },
  { id: 'link_reroute', title: 'Manual Traffic Reroute', steps: ['Identify alternate path', 'Update static routes', 'Verify traffic flow on new path'], effort: 'moderate', effect: 'Manually reroutes traffic through an alternate network path' },
])