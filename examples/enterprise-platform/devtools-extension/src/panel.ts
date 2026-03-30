/**
 * esmap DevTools Panel — Chrome DevTools custom panel.
 *
 * Receives data forwarded from the page's postMessage via the background service worker
 * and visualizes it in 4 tabs: Topology, Flow, Events, and State.
 */

// ─── Types ───

interface AppInfo {
  readonly name: string;
  readonly status: string;
  readonly container: string;
}

type EventCategory = 'lifecycle' | 'auth' | 'route' | 'state' | 'error' | 'all';

interface EventEntry {
  readonly timestamp: number;
  readonly category: EventCategory;
  readonly name: string;
  readonly detail: string;
  readonly appName?: string;
}

interface StateChange {
  readonly timestamp: number;
  readonly diff: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
}

interface FlowEntry {
  readonly timestamp: number;
  readonly from: string;
  readonly to: string;
  readonly event: string;
  readonly category: EventCategory;
}

interface TransitionStats {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly ratio: number;
}

// ─── Constants ───

const STATUS_COLORS: Record<string, string> = {
  MOUNTED: '#3fb950', FROZEN: '#d29922', NOT_LOADED: '#484f58',
  LOADING: '#58a6ff', BOOTSTRAPPING: '#58a6ff', NOT_MOUNTED: '#da8b45',
  LOAD_ERROR: '#f85149', UNMOUNTING: '#da8b45',
};

const CAT_COLORS: Record<EventCategory, string> = {
  lifecycle: '#3fb950', auth: '#bc8cff', route: '#58a6ff',
  state: '#d29922', error: '#f85149', all: '#7d8590',
};

const CAT_LABELS: Record<EventCategory, string> = {
  lifecycle: 'Lifecycle', auth: 'Auth', route: 'Route',
  state: 'State', error: 'Error', all: 'All',
};

const APP_TOPOLOGY = [
  { name: '@enterprise/auth', short: 'Auth', angle: -120 },
  { name: '@enterprise/dashboard', short: 'Dashboard', angle: -60 },
  { name: '@enterprise/task-board', short: 'Tasks', angle: 0 },
  { name: '@enterprise/team-directory', short: 'Team', angle: 60 },
  { name: '@enterprise/activity-feed', short: 'Activity', angle: 120 },
  { name: '@enterprise/notifications', short: 'Notif', angle: 170 },
  { name: '@enterprise/legacy-settings', short: 'Settings', angle: -170 },
];

const PARCEL_EDGES = [
  { from: '@enterprise/dashboard', to: '@enterprise/activity-feed' },
  { from: '@enterprise/task-board', to: '@enterprise/activity-feed' },
];

// ─── State ───

const state = {
  connected: false,
  apps: new Map<string, AppInfo>(),
  events: [] as EventEntry[],
  stateHistory: [] as StateChange[],
  flows: [] as FlowEntry[],
  currentState: {} as Record<string, unknown>,
  prefetchStats: [] as TransitionStats[],
  perfData: new Map<string, { total: number; phases: Record<string, number> }>(),
  sharedModules: { registered: {} as Record<string, Array<Record<string, unknown>>>, loaded: {} as Record<string, Record<string, unknown>> },
  importMap: null as { imports: Record<string, string>; scopes?: Record<string, Record<string, string>> } | null,
  activeFilter: 'all' as EventCategory,
  eventCount: 0,
};

const MAX_EVENTS = 500;
const MAX_STATES = 40;
const MAX_FLOWS = 150;

// ─── Helpers ───

/** Converts a timestamp to HH:MM:SS.mmm format */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** Strips the @enterprise/ prefix from an app name */
function short(name: string): string { return name.replace('@enterprise/', ''); }

/** HTML escape */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** SVG namespace element creation */
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** JSON tree rendering */
function jsonTree(value: unknown, indent = 0, isLast = true): string {
  const pad = '  '.repeat(indent);
  if (value === null || value === undefined) return `<span class="snull">null</span>${isLast ? '' : ','}`;
  if (typeof value === 'string') return `<span class="ss">"${esc(value)}"</span>${isLast ? '' : ','}`;
  if (typeof value === 'number') return `<span class="sn">${value}</span>${isLast ? '' : ','}`;
  if (typeof value === 'boolean') return `<span class="sb">${value}</span>${isLast ? '' : ','}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="sbrace">[]</span>${isLast ? '' : ','}`;
    const items = value.map((v, i) => `${pad}  ${jsonTree(v, indent + 1, i === value.length - 1)}`).join('\n');
    return `<span class="sbrace">[</span>\n${items}\n${pad}<span class="sbrace">]</span>${isLast ? '' : ','}`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return `<span class="sbrace">{}</span>${isLast ? '' : ','}`;
    const items = entries.map(([k, v], i) =>
      `${pad}  <span class="sk">"${esc(k)}"</span>: ${jsonTree(v, indent + 1, i === entries.length - 1)}`
    ).join('\n');
    return `<span class="sbrace">{</span>\n${items}\n${pad}<span class="sbrace">}</span>${isLast ? '' : ','}`;
  }
  return String(value);
}

/** Angle between two points */
function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// ─── DOM References ───

const root = document.getElementById('root')!;

// Build UI
root.innerHTML = `
  <div class="header">
    <span class="header-indicator" id="indicator"></span>
    <span class="header-title">esmap DevTools</span>
    <span class="header-status" id="status-text">Waiting for esmap…</span>
    <div class="tabs">
      <button class="tab active" data-tab="topology">Topology</button>
      <button class="tab" data-tab="flow">Flow</button>
      <button class="tab" data-tab="events">Events</button>
      <button class="tab" data-tab="state">State</button>
      <button class="tab" data-tab="perf">Perf</button>
      <button class="tab" data-tab="deps">Deps</button>
    </div>
    <span class="spacer"></span>
    <span class="event-count" id="event-count">0 events</span>
  </div>
  <div class="body" id="body">
    <div class="panel active" data-panel="topology" id="topo-panel">
      <div class="waiting" id="waiting">
        <div class="waiting-icon">📡</div>
        <div class="waiting-text">Waiting for esmap connection…</div>
        <div class="waiting-hint">Navigate to a page running esmap and reload</div>
      </div>
    </div>
    <div class="panel" data-panel="flow" id="flow-panel" style="display:none"></div>
    <div class="panel" data-panel="events" id="events-panel" style="display:none"></div>
    <div class="panel" data-panel="state" id="state-panel" style="display:none"></div>
    <div class="panel" data-panel="perf" id="perf-panel" style="display:none"></div>
    <div class="panel" data-panel="deps" id="deps-panel" style="display:none"></div>
  </div>
`;

const indicator = document.getElementById('indicator')!;
const statusText = document.getElementById('status-text')!;
const eventCountEl = document.getElementById('event-count')!;
const topoPanel = document.getElementById('topo-panel')!;
const flowPanel = document.getElementById('flow-panel')!;
const eventsPanel = document.getElementById('events-panel')!;
const statePanel = document.getElementById('state-panel')!;
const perfPanel = document.getElementById('perf-panel')!;
const depsPanel = document.getElementById('deps-panel')!;
const waitingEl = document.getElementById('waiting')!;

/** Per-app lifecycle phase start times (for deriving performance data) */
const phaseStartTimes: Record<string, Record<string, number>> = {};
/** Performance data derived from lifecycle events */
const derivedPerfData: Record<string, { total: number; phases: Record<string, number> }> = {};

// Tab switching
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const panels = document.querySelectorAll<HTMLElement>('.panel');

/** Currently active tab */
const activeTab = { value: 'topology' };

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab.value = tab.dataset.tab ?? 'topology';
    panels.forEach((p) => {
      const isTarget = p.dataset.panel === activeTab.value;
      p.classList.toggle('active', isTarget);
      p.style.display = isTarget ? (['events', 'flow'].includes(activeTab.value) ? 'flex' : 'block') : 'none';
    });
    if (activeTab.value === 'topology') renderTopology();
    if (activeTab.value === 'state') renderState();
    if (activeTab.value === 'flow') renderFlow();
    if (activeTab.value === 'perf') renderPerf();
    if (activeTab.value === 'deps') renderDeps();
  });
});

// ─── Build Events Panel ───

eventsPanel.innerHTML = `
  <div class="events-container">
    <div class="events-toolbar" id="events-toolbar"></div>
    <div class="events-list" id="events-list"></div>
  </div>
`;
eventsPanel.style.flexDirection = 'column';

const eventsToolbar = document.getElementById('events-toolbar')!;
const eventsList = document.getElementById('events-list')!;

const categories: EventCategory[] = ['all', 'lifecycle', 'auth', 'route', 'state', 'error'];
for (const cat of categories) {
  const btn = document.createElement('button');
  btn.className = `filter-btn${cat === 'all' ? ' active' : ''}`;
  btn.textContent = CAT_LABELS[cat];
  btn.style.color = CAT_COLORS[cat];
  btn.addEventListener('click', () => {
    eventsToolbar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = cat;
    renderFilteredEvents();
  });
  eventsToolbar.appendChild(btn);
}

const clearBtn = document.createElement('button');
clearBtn.className = 'clear-btn';
clearBtn.textContent = 'Clear';
clearBtn.addEventListener('click', () => {
  state.events.length = 0;
  state.eventCount = 0;
  eventCountEl.textContent = '0 events';
  eventsList.innerHTML = '';
});
eventsToolbar.appendChild(clearBtn);

// ─── Build State Panel ───

statePanel.innerHTML = `
  <div class="state-container">
    <div class="state-current" id="state-current"></div>
    <div class="state-history" id="state-history-div"></div>
  </div>
`;

const stateCurrent = document.getElementById('state-current')!;
const stateHistoryDiv = document.getElementById('state-history-div')!;

// ─── Build Flow Panel ───

flowPanel.innerHTML = `
  <div class="flow-container">
    <div class="flow-header">
      <span class="flow-label">Inter-App Communication Flow</span>
      <span class="flow-stats" id="flow-stats">0 flows</span>
    </div>
    <div class="flow-canvas" id="flow-canvas">
      <div class="flow-lanes" id="flow-lanes"></div>
    </div>
  </div>
`;
flowPanel.style.flexDirection = 'column';

const flowStatsEl = document.getElementById('flow-stats')!;
const flowCanvas = document.getElementById('flow-canvas')!;
const flowLanes = document.getElementById('flow-lanes')!;

const allLaneNames = ['Host', ...APP_TOPOLOGY.map((a) => a.short)];
const laneContentEls: Record<string, HTMLElement> = {};

for (const name of allLaneNames) {
  const lane = document.createElement('div');
  lane.className = 'flow-lane';
  const label = document.createElement('div');
  label.className = 'flow-lane-label';
  label.textContent = name;
  lane.appendChild(label);
  const content = document.createElement('div');
  content.className = 'flow-lane-content';
  lane.appendChild(content);
  flowLanes.appendChild(lane);
  laneContentEls[name] = content;
}

// ─── Build Topology Panel ───

const topoContainer = document.createElement('div');
topoContainer.className = 'topo-container';

const topoTooltip = document.createElement('div');
topoTooltip.className = 'topo-tooltip';
topoContainer.appendChild(topoTooltip);

const topoSvg = svg('svg', { width: '100%', height: '100%' });
topoContainer.appendChild(topoSvg);

const topoLegend = document.createElement('div');
topoLegend.className = 'topo-legend';
const legendItems = [
  { label: 'Mounted', color: '#3fb950' }, { label: 'Frozen', color: '#d29922' },
  { label: 'Not Loaded', color: '#484f58' }, { label: 'Loading', color: '#58a6ff' },
  { label: 'Error', color: '#f85149' },
];
for (const item of legendItems) {
  const el = document.createElement('span');
  el.className = 'topo-legend-item';
  el.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${item.color}"></span>${item.label}`;
  topoLegend.appendChild(el);
}
const parcelLegendItem = document.createElement('span');
parcelLegendItem.className = 'topo-legend-item';
parcelLegendItem.innerHTML = `<span style="width:16px;height:2px;background:#8b5cf6;border-radius:1px;display:inline-block"></span>Parcel`;
topoLegend.appendChild(parcelLegendItem);
topoContainer.appendChild(topoLegend);

// ─── Render Functions ───

/** Topology SVG rendering */
function renderTopology(): void {
  if (!state.connected) return;
  waitingEl.style.display = 'none';
  if (!topoContainer.parentElement) {
    topoPanel.appendChild(topoContainer);
  }

  topoSvg.innerHTML = '';
  const rect = topoContainer.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 400;
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.min(w * 0.34, 320);
  const ry = Math.min(h * 0.34, 140);
  topoSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Defs
  const defs = svg('defs');
  for (const [id, fill] of [['arrow', '#30363d'], ['parcel-arrow', '#8b5cf6']] as const) {
    const marker = svg('marker', { id: `${id}-marker`, markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: 'auto' });
    const path = svg('path'); path.setAttribute('d', 'M0,0 L8,3 L0,6 Z'); path.setAttribute('fill', fill);
    marker.appendChild(path); defs.appendChild(marker);
  }
  // Glow filter
  const glow = svg('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  glow.appendChild(svg('feGaussianBlur', { stdDeviation: '4', result: 'blur' }));
  const merge = svg('feMerge');
  merge.appendChild(svg('feMergeNode', { in: 'blur' }));
  merge.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge);
  defs.appendChild(glow);
  topoSvg.appendChild(defs);

  // Plugin pills
  const plugins = ['guard', 'sandbox', 'keepAlive', 'domIsolation', 'prefetch', 'communication', 'audit'];
  const pluginSpacing = Math.min(90, (w - 40) / plugins.length);
  const pluginStart = cx - ((plugins.length - 1) * pluginSpacing) / 2;
  for (const [i, name] of plugins.entries()) {
    const px = pluginStart + i * pluginSpacing;
    topoSvg.appendChild(svg('rect', { x: px - 34, y: 8, width: 68, height: 16, rx: 8, ry: 8, fill: '#161b22', stroke: '#21262d', 'stroke-width': 1 }));
    const t = svg('text', { x: px, y: 16, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#7d8590', 'font-size': '9', 'font-family': "'SF Mono', monospace" });
    t.textContent = name; topoSvg.appendChild(t);
  }

  // Shared deps
  const deps = ['react ^19', 'react-dom ^19', '@enterprise/design-system ^1'];
  const depSpacing = Math.min(130, (w - 40) / deps.length);
  const depStart = cx - ((deps.length - 1) * depSpacing) / 2;
  for (const [i, dep] of deps.entries()) {
    const dx = depStart + i * depSpacing;
    topoSvg.appendChild(svg('rect', { x: dx - 55, y: h - 22, width: 110, height: 16, rx: 8, ry: 8, fill: '#161b22', stroke: '#21262d', 'stroke-width': 1 }));
    const t = svg('text', { x: dx, y: h - 14, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#484f58', 'font-size': '9', 'font-family': "'SF Mono', monospace" });
    t.textContent = dep; topoSvg.appendChild(t);
  }

  // Node positions
  const nodeW = 120;
  const nodeH = 48;
  const positions: Record<string, { x: number; y: number }> = {};
  for (const app of APP_TOPOLOGY) {
    const rad = (app.angle * Math.PI) / 180;
    positions[app.name] = { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
  }

  // Host→App edges
  for (const app of APP_TOPOLOGY) {
    const pos = positions[app.name]; if (!pos) continue;
    const a = angleBetween(cx, cy, pos.x, pos.y);
    const sx = cx + Math.cos(a) * 30;
    const sy = cy + Math.sin(a) * 30;
    const ex = pos.x - Math.cos(a) * (nodeW / 2 + 4);
    const ey = pos.y - Math.sin(a) * (nodeH / 2 + 4);
    const line = svg('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: '#21262d', 'stroke-width': 1.5, 'marker-end': 'url(#arrow-marker)' });
    line.setAttribute('data-to', app.name);
    line.classList.add('topo-edge');
    topoSvg.appendChild(line);
  }

  // Parcel edges
  for (const edge of PARCEL_EDGES) {
    const fp = positions[edge.from]; const tp = positions[edge.to]; if (!fp || !tp) continue;
    const a = angleBetween(fp.x, fp.y, tp.x, tp.y);
    const sx = fp.x + Math.cos(a) * (nodeW / 2 + 2);
    const sy = fp.y + Math.sin(a) * (nodeH / 2 + 2);
    const ex = tp.x - Math.cos(a) * (nodeW / 2 + 4);
    const ey = tp.y - Math.sin(a) * (nodeH / 2 + 4);
    topoSvg.appendChild(svg('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: '#8b5cf6', 'stroke-width': 1.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#parcel-arrow-marker)' }));
    const mx = (sx + ex) / 2; const my = (sy + ey) / 2 - 10;
    topoSvg.appendChild(svg('rect', { x: mx - 22, y: my - 8, width: 44, height: 16, rx: 8, ry: 8, fill: '#161b22', stroke: '#8b5cf6', 'stroke-width': 0.5 }));
    const pt = svg('text', { x: mx, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#8b5cf6', 'font-size': '9', 'font-family': "'SF Mono', monospace", 'font-weight': '600' });
    pt.textContent = 'Parcel'; topoSvg.appendChild(pt);
  }

  // Prefetch probability edges
  for (const s of state.prefetchStats) {
    const fp = positions[s.from]; const tp = positions[s.to]; if (!fp || !tp || s.ratio < 0.1) continue;
    const a = angleBetween(fp.x, fp.y, tp.x, tp.y);
    const oa = a + Math.PI / 2;
    const off = 8;
    const sx = fp.x + Math.cos(a) * (nodeW / 2 + 2) + Math.cos(oa) * off;
    const sy = fp.y + Math.sin(a) * (nodeH / 2 + 2) + Math.sin(oa) * off;
    const ex = tp.x - Math.cos(a) * (nodeW / 2 + 4) + Math.cos(oa) * off;
    const ey = tp.y - Math.sin(a) * (nodeH / 2 + 4) + Math.sin(oa) * off;
    const opacity = 0.3 + s.ratio * 0.7;
    const line = svg('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: '#1f6feb', 'stroke-width': String(1 + s.ratio * 2), 'stroke-dasharray': '3 3', opacity: String(opacity) });
    topoSvg.appendChild(line);
    const mx = (sx + ex) / 2 + Math.cos(oa) * 12;
    const my = (sy + ey) / 2 + Math.sin(oa) * 12;
    const prob = svg('text', { x: mx, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#1f6feb', 'font-size': '8', opacity: String(opacity) });
    prob.textContent = `${Math.round(s.ratio * 100)}%`; topoSvg.appendChild(prob);
  }

  // Host node
  const hg = svg('g');
  hg.appendChild(svg('circle', { cx, cy, r: 28, fill: '#161b22', stroke: '#58a6ff', 'stroke-width': 2 }));
  const hl = svg('text', { x: cx, y: cy - 3, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#58a6ff', 'font-size': '13', 'font-weight': '700' });
  hl.textContent = 'Host'; hg.appendChild(hl);
  const hs = svg('text', { x: cx, y: cy + 11, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#484f58', 'font-size': '8' });
  hs.textContent = 'esmap'; hg.appendChild(hs);
  topoSvg.appendChild(hg);

  // App nodes
  for (const appDef of APP_TOPOLOGY) {
    const pos = positions[appDef.name]; if (!pos) continue;
    const info = state.apps.get(appDef.name);
    const status = info?.status ?? 'NOT_LOADED';
    const color = STATUS_COLORS[status] ?? '#484f58';

    const g = svg('g');
    g.style.cursor = 'pointer';

    // Background
    g.appendChild(svg('rect', {
      x: pos.x - nodeW / 2, y: pos.y - nodeH / 2, width: nodeW, height: nodeH,
      rx: 10, ry: 10, fill: '#0d1117', stroke: color, 'stroke-width': 1.5,
    }));

    // Status dot
    g.appendChild(svg('circle', { cx: pos.x - nodeW / 2 + 16, cy: pos.y - 3, r: 4, fill: color }));

    // Name
    const nl = svg('text', { x: pos.x + 4, y: pos.y - 5, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#e6edf3', 'font-size': '11', 'font-weight': '600' });
    nl.textContent = appDef.short; nl.style.pointerEvents = 'none'; g.appendChild(nl);

    // Status text
    const sl = svg('text', { x: pos.x + 4, y: pos.y + 10, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#7d8590', 'font-size': '9' });
    sl.textContent = status.toLowerCase(); sl.style.pointerEvents = 'none'; g.appendChild(sl);

    // Frozen icon
    if (status === 'FROZEN') {
      const fi = svg('text', { x: pos.x + nodeW / 2 - 12, y: pos.y - nodeH / 2 + 12, 'font-size': '11', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      fi.textContent = '❄'; g.appendChild(fi);
    }

    // Perf bar
    const pd = state.perfData.get(appDef.name);
    if (pd && pd.total > 0) {
      const barW = Math.min((pd.total / 500) * (nodeW - 4), nodeW - 4);
      const barC = pd.total < 100 ? '#3fb950' : pd.total < 300 ? '#d29922' : '#f85149';
      g.appendChild(svg('rect', { x: pos.x - nodeW / 2 + 2, y: pos.y + nodeH / 2 - 4, width: barW, height: 2, rx: 1, fill: barC, opacity: 0.8 }));
    }

    // Hover tooltip
    g.addEventListener('mouseenter', (e) => {
      const perfInfo = state.perfData.get(appDef.name);
      const perfHtml = perfInfo
        ? Object.entries(perfInfo.phases).map(([p, d]) => `<div>${p}: ${d.toFixed(0)}ms</div>`).join('') + `<div style="font-weight:600">Total: ${perfInfo.total.toFixed(0)}ms</div>`
        : '<div style="color:#484f58">No perf data</div>';
      topoTooltip.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;font-size:12px">${appDef.name}</div>
        <div>Status: <span style="color:${color}">${status}</span></div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #21262d">${perfHtml}</div>
      `;
      topoTooltip.style.display = 'block';
      const pr = topoContainer.getBoundingClientRect();
      topoTooltip.style.left = `${e.clientX - pr.left + 14}px`;
      topoTooltip.style.top = `${e.clientY - pr.top - 20}px`;

      topoSvg.querySelectorAll<SVGLineElement>('.topo-edge').forEach((edge) => {
        const connected = edge.getAttribute('data-to') === appDef.name;
        edge.style.stroke = connected ? color : '#21262d';
        edge.style.strokeWidth = connected ? '2.5' : '1.5';
      });
    });
    g.addEventListener('mouseleave', () => {
      topoTooltip.style.display = 'none';
      topoSvg.querySelectorAll<SVGLineElement>('.topo-edge').forEach((edge) => { edge.style.stroke = ''; edge.style.strokeWidth = ''; });
    });
    g.addEventListener('mousemove', (e) => {
      const pr = topoContainer.getBoundingClientRect();
      topoTooltip.style.left = `${e.clientX - pr.left + 14}px`;
      topoTooltip.style.top = `${e.clientY - pr.top - 20}px`;
    });

    topoSvg.appendChild(g);
  }
}

/** Event list rendering */
function renderFilteredEvents(): void {
  eventsList.innerHTML = '';
  const filtered = state.activeFilter === 'all' ? state.events : state.events.filter((e) => e.category === state.activeFilter);
  for (const entry of filtered) eventsList.appendChild(makeEventRow(entry));
  eventsList.scrollTop = eventsList.scrollHeight;
}

/** Event row DOM creation */
function makeEventRow(entry: EventEntry): HTMLElement {
  const row = document.createElement('div');
  row.className = 'event-row';
  row.innerHTML = `
    <span class="event-time">${fmtTime(entry.timestamp)}</span>
    <span class="event-badge" style="background:${CAT_COLORS[entry.category]}15;color:${CAT_COLORS[entry.category]}">${CAT_LABELS[entry.category]}</span>
    <span class="event-name">${esc(entry.name)}</span>
    <span class="event-detail">${esc(entry.detail)}</span>
  `;
  return row;
}

/** Add event */
function addEvent(entry: EventEntry): void {
  state.events.push(entry);
  if (state.events.length > MAX_EVENTS) state.events.shift();
  state.eventCount += 1;
  eventCountEl.textContent = `${state.eventCount} events`;

  if (activeTab.value === 'events' && (state.activeFilter === 'all' || state.activeFilter === entry.category)) {
    const shouldScroll = eventsList.scrollHeight - eventsList.scrollTop - eventsList.clientHeight < 40;
    eventsList.appendChild(makeEventRow(entry));
    while (eventsList.children.length > MAX_EVENTS) eventsList.removeChild(eventsList.firstChild!);
    if (shouldScroll) eventsList.scrollTop = eventsList.scrollHeight;
  }
}

/** State view rendering */
function renderState(): void {
  stateCurrent.innerHTML = `
    <div class="section-title">Current State</div>
    <pre class="state-tree">${jsonTree(state.currentState, 0)}</pre>
  `;
  stateHistoryDiv.innerHTML = `<div class="section-title">Change History (${state.stateHistory.length})</div>`;
  for (const entry of [...state.stateHistory].reverse()) {
    const div = document.createElement('div');
    div.className = 'diff-entry';
    div.innerHTML = `<div class="diff-time">${fmtTime(entry.timestamp)}</div>` +
      entry.diff.map((d) =>
        `<div class="diff-item"><span class="diff-key">${esc(d.key)}</span>: <span class="diff-old">${esc(JSON.stringify(d.oldValue))}</span><span class="diff-arrow">&rarr;</span><span class="diff-new">${esc(JSON.stringify(d.newValue))}</span></div>`
      ).join('');
    stateHistoryDiv.appendChild(div);
  }
}

/** Flow view rendering */
function renderFlow(): void {
  for (const content of Object.values(laneContentEls)) content.innerHTML = '';
  flowStatsEl.textContent = `${state.flows.length} flows`;
  if (state.flows.length === 0) return;

  const startTime = state.flows[0].timestamp;
  const timeRange = Math.max(state.flows[state.flows.length - 1].timestamp - startTime, 3000);
  const pixelsPerMs = Math.max(0.08, Math.min(0.3, (flowCanvas.clientWidth - 200) / timeRange));
  const totalWidth = Math.max(timeRange * pixelsPerMs + 200, flowCanvas.clientWidth);
  flowLanes.style.width = `${totalWidth}px`;

  for (const flow of state.flows) {
    const x = (flow.timestamp - startTime) * pixelsPerMs + 20;
    const fromLane = flow.from === 'host' ? 'Host' : (APP_TOPOLOGY.find((a) => a.name === flow.from)?.short ?? short(flow.from));
    const toLane = flow.to === 'host' ? 'Host' : (APP_TOPOLOGY.find((a) => a.name === flow.to)?.short ?? short(flow.to));

    const fromEl = laneContentEls[fromLane];
    if (fromEl) {
      const dot = document.createElement('div');
      dot.className = 'flow-dot';
      dot.style.left = `${x}px`;
      dot.style.background = CAT_COLORS[flow.category];
      dot.title = `${fmtTime(flow.timestamp)} ${flow.event}\n${flow.from} → ${flow.to}`;
      fromEl.appendChild(dot);
    }

    const toEl = laneContentEls[toLane];
    if (toEl && fromLane !== toLane) {
      const dot = document.createElement('div');
      dot.className = 'flow-dot';
      dot.style.left = `${x + 2}px`;
      dot.style.background = CAT_COLORS[flow.category];
      dot.style.opacity = '0.5';
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.title = `${fmtTime(flow.timestamp)} ← ${flow.event}`;
      toEl.appendChild(dot);
    }
  }

  flowCanvas.scrollLeft = flowCanvas.scrollWidth;
}

// ─── Perf Phase Resolution ───

/** Maps state transitions to lifecycle phase names */
function resolvePhaseFromTransition(from: string, to: string): { endPhase: string; startPhase: string } | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();

  if (f === 'NOT_LOADED' && t === 'LOADING') return { endPhase: '', startPhase: 'load' };
  if (f === 'LOADING' && t === 'BOOTSTRAPPING') return { endPhase: 'load', startPhase: 'bootstrap' };
  if (f === 'BOOTSTRAPPING' && t === 'NOT_MOUNTED') return { endPhase: 'bootstrap', startPhase: 'mount' };
  if (f === 'NOT_MOUNTED' && t === 'MOUNTED') return { endPhase: 'mount', startPhase: '' };
  if ((f === 'MOUNTED' || f === 'NOT_MOUNTED') && t === 'UNMOUNTING') return { endPhase: '', startPhase: 'unmount' };
  if (f === 'UNMOUNTING' && t === 'NOT_MOUNTED') return { endPhase: 'unmount', startPhase: '' };
  return null;
}

/** Composes data equivalent to perf.summarize() (merging perfData + derivedPerfData) */
function collectPerfSummary(): Map<string, { total: number; phases: Record<string, number> }> {
  const merged = new Map<string, { total: number; phases: Record<string, number> }>(state.perfData);
  for (const [appName, data] of Object.entries(derivedPerfData)) {
    if (!merged.has(appName) && data.total > 0) {
      merged.set(appName, { total: data.total, phases: { ...data.phases } });
    }
  }
  return merged;
}

/** Colors per performance phase */
const PHASE_COLORS: Record<string, string> = {
  load: '#58a6ff', bootstrap: '#bc8cff', mount: '#3fb950', unmount: '#da8b45', update: '#d29922',
};

/** Renders the performance waterfall view */
function renderPerf(): void {
  const summary = collectPerfSummary();
  perfPanel.innerHTML = '';

  const container = document.createElement('div');
  container.style.cssText = 'padding:16px;font-family:"SF Mono",monospace;font-size:12px';
  perfPanel.appendChild(container);

  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700;color:#e6edf3;margin-bottom:12px';
  title.textContent = 'App Load Performance Waterfall';
  container.appendChild(title);

  if (summary.size === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#484f58;padding:24px 0;text-align:center';
    empty.textContent = 'No performance data yet. Navigate between pages to collect measurements.';
    container.appendChild(empty);
    return;
  }

  const maxTotal = Math.max(...Array.from(summary.values()).map((d) => d.total), 1);

  // Scale ticks
  const scale = document.createElement('div');
  scale.style.cssText = 'display:flex;justify-content:space-between;color:#484f58;font-size:10px;margin-bottom:8px;padding-left:80px';
  const ticks = [0, Math.round(maxTotal * 0.25), Math.round(maxTotal * 0.5), Math.round(maxTotal * 0.75), Math.round(maxTotal)];
  for (const tick of ticks) {
    const marker = document.createElement('span');
    marker.textContent = `${tick}ms`;
    scale.appendChild(marker);
  }
  container.appendChild(scale);

  // Per-app waterfall rows
  for (const appDef of APP_TOPOLOGY) {
    const data = summary.get(appDef.name);
    if (!data || data.total === 0) continue;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;gap:8px';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'width:72px;text-align:right;color:#7d8590;font-size:11px;flex-shrink:0';
    nameEl.textContent = appDef.short;
    row.appendChild(nameEl);

    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'flex:1;display:flex;height:20px;background:#161b22;border-radius:4px;overflow:hidden';

    for (const [phase, duration] of Object.entries(data.phases)) {
      const widthPct = (duration / maxTotal) * 100;
      if (widthPct < 0.5) continue;
      const segment = document.createElement('div');
      segment.style.cssText = `width:${widthPct}%;background:${PHASE_COLORS[phase] ?? '#6b7280'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#0d1117;font-weight:600;overflow:hidden;white-space:nowrap`;
      segment.title = `${phase}: ${duration.toFixed(1)}ms`;
      if (widthPct > 10) segment.textContent = `${phase} ${Math.round(duration)}ms`;
      barContainer.appendChild(segment);
    }
    row.appendChild(barContainer);

    const totalEl = document.createElement('div');
    totalEl.style.cssText = `width:50px;text-align:right;font-weight:600;font-size:11px;color:${data.total < 100 ? '#3fb950' : data.total < 300 ? '#d29922' : '#f85149'}`;
    totalEl.textContent = `${Math.round(data.total)}ms`;
    row.appendChild(totalEl);

    container.appendChild(row);
  }

  // Legend
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:12px;margin-top:12px;padding-top:8px;border-top:1px solid #21262d';
  for (const [phase, color] of Object.entries(PHASE_COLORS)) {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;color:#7d8590';
    item.innerHTML = `<div style="width:8px;height:8px;border-radius:2px;background:${color}"></div>${phase}`;
    legend.appendChild(item);
  }
  container.appendChild(legend);
}

// ─── Deps Panel ───

/** Renders the shared module dependencies view */
function renderDeps(): void {
  depsPanel.innerHTML = '';

  const { registered, loaded } = state.sharedModules;
  const moduleNames = Object.keys(registered);

  const container = document.createElement('div');
  container.style.cssText = 'padding:16px;font-family:"SF Mono",monospace;font-size:12px;overflow-y:auto;height:100%';
  depsPanel.appendChild(container);

  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:700;color:#e6edf3;margin-bottom:16px';
  title.textContent = 'Shared Module Dependencies';
  container.appendChild(title);

  if (moduleNames.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#484f58;padding:24px 0;text-align:center';
    empty.textContent = 'No shared modules data received yet.';
    container.appendChild(empty);
    return;
  }

  for (const moduleName of moduleNames) {
    const candidates = registered[moduleName] ?? [];
    const loadedInfo = loaded[moduleName];

    const card = document.createElement('div');
    card.style.cssText = 'background:#161b22;border:1px solid #21262d;border-radius:8px;padding:12px 16px;margin-bottom:10px';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight:600;color:#e6edf3;font-size:13px';
    nameEl.textContent = moduleName;
    header.appendChild(nameEl);

    const badge = document.createElement('span');
    badge.style.cssText = `font-size:10px;padding:1px 8px;border-radius:10px;font-weight:500;${
      loadedInfo
        ? 'background:#3fb95020;color:#3fb950;border:1px solid #3fb95040'
        : 'background:#48505820;color:#484f58;border:1px solid #48505840'
    }`;
    badge.textContent = loadedInfo ? `v${loadedInfo['version']} loaded` : 'not loaded';
    header.appendChild(badge);

    const isSingleton = candidates.some((c) => c['singleton']);
    if (isSingleton) {
      const sb = document.createElement('span');
      sb.style.cssText = 'font-size:10px;padding:1px 8px;border-radius:10px;background:#bc8cff20;color:#bc8cff;border:1px solid #bc8cff40;font-weight:500';
      sb.textContent = 'singleton';
      header.appendChild(sb);
    }

    const isEager = candidates.some((c) => c['eager']);
    if (isEager) {
      const eb = document.createElement('span');
      eb.style.cssText = 'font-size:10px;padding:1px 8px;border-radius:10px;background:#58a6ff20;color:#58a6ff;border:1px solid #58a6ff40;font-weight:500';
      eb.textContent = 'eager';
      header.appendChild(eb);
    }

    card.appendChild(header);

    for (const candidate of candidates) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;margin-top:4px';

      const isActive = loadedInfo && loadedInfo['version'] === candidate['version'] && loadedInfo['from'] === candidate['from'];
      const dot = document.createElement('span');
      dot.style.cssText = `width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${isActive ? '#3fb950' : '#30363d'}`;
      row.appendChild(dot);

      const fromEl = document.createElement('span');
      fromEl.style.cssText = 'color:#7d8590;min-width:80px';
      fromEl.textContent = candidate['from'] ? short(String(candidate['from'])) : 'host';
      row.appendChild(fromEl);

      const verEl = document.createElement('span');
      verEl.style.cssText = `color:${isActive ? '#e6edf3' : '#484f58'}`;
      verEl.textContent = `v${candidate['version']}`;
      row.appendChild(verEl);

      if (candidate['requiredVersion']) {
        const reqEl = document.createElement('span');
        reqEl.style.cssText = 'color:#484f58;font-size:10px';
        reqEl.textContent = `(requires ${candidate['requiredVersion']})`;
        row.appendChild(reqEl);
      }

      row.appendChild(document.createElement('span'));
      card.appendChild(row);
    }

    container.appendChild(card);
  }

  // Import Map entries
  if (state.importMap) {
    const imTitle = document.createElement('div');
    imTitle.style.cssText = 'font-size:13px;font-weight:600;color:#e6edf3;margin:20px 0 10px';
    imTitle.textContent = `Import Map (${Object.keys(state.importMap.imports).length} entries)`;
    container.appendChild(imTitle);

    const table = document.createElement('div');
    table.style.cssText = 'background:#161b22;border:1px solid #21262d;border-radius:8px;overflow:hidden';

    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;padding:8px 12px;border-bottom:1px solid #21262d;font-size:10px;font-weight:600;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px';
    headerRow.innerHTML = '<span style="width:200px;flex-shrink:0">Specifier</span><span style="flex:1">URL</span>';
    table.appendChild(headerRow);

    const sorted = Object.entries(state.importMap.imports).sort(([a], [b]) => a.localeCompare(b));
    for (const [specifier, url] of sorted) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;padding:6px 12px;border-bottom:1px solid #161b22;font-size:11px;align-items:center';
      row.addEventListener('mouseenter', () => { row.style.background = '#1c2128'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.innerHTML = `<span style="width:200px;flex-shrink:0;color:#e6edf3;font-weight:500">${esc(specifier)}</span><span style="flex:1;color:#484f58;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(url)}">${esc(url)}</span>`;
      table.appendChild(row);
    }
    container.appendChild(table);
  }
}

// ─── Message Handling ───

/** Processes a message and updates internal state */
function handleMessage(msg: Record<string, unknown>): void {
  const type = msg['type'] as string;

  switch (type) {
    case 'ESMAP_INIT': {
      state.connected = true;
      indicator.classList.add('connected');
      statusText.textContent = 'Connected';
      waitingEl.style.display = 'none';

      const apps = msg['apps'] as AppInfo[];
      for (const app of apps) state.apps.set(app.name, app);
      state.currentState = (msg['currentState'] as Record<string, unknown>) ?? {};
      state.prefetchStats = (msg['prefetchStats'] as TransitionStats[]) ?? [];

      const sm = msg['sharedModules'] as typeof state.sharedModules | undefined;
      if (sm) state.sharedModules = sm;
      const im = msg['importMap'] as typeof state.importMap;
      if (im) state.importMap = im;

      if (activeTab.value === 'topology') renderTopology();
      if (activeTab.value === 'state') renderState();
      if (activeTab.value === 'deps') renderDeps();
      break;
    }

    case 'ESMAP_STATUS_CHANGE': {
      const appName = msg['appName'] as string;
      const from = msg['from'] as string;
      const to = msg['to'] as string;
      const ts = msg['timestamp'] as number;

      state.apps.set(appName, { name: appName, status: to, container: state.apps.get(appName)?.container ?? '' });
      addEvent({ timestamp: ts, category: 'lifecycle', name: short(appName), detail: `${from} → ${to}`, appName });
      state.flows.push({ timestamp: ts, from: 'host', to: appName, event: `${from} → ${to}`, category: 'lifecycle' });
      if (state.flows.length > MAX_FLOWS) state.flows.shift();

      // Derive performance data from lifecycle transitions
      const phaseInfo = resolvePhaseFromTransition(from, to);
      if (phaseInfo) {
        if (!phaseStartTimes[appName]) phaseStartTimes[appName] = {};
        if (!derivedPerfData[appName]) derivedPerfData[appName] = { total: 0, phases: {} };

        if (phaseInfo.endPhase && phaseStartTimes[appName][phaseInfo.endPhase]) {
          const duration = ts - phaseStartTimes[appName][phaseInfo.endPhase];
          derivedPerfData[appName].phases[phaseInfo.endPhase] = duration;
          derivedPerfData[appName].total = Object.values(derivedPerfData[appName].phases).reduce((sum, d) => sum + d, 0);
          delete phaseStartTimes[appName][phaseInfo.endPhase];
        }

        if (phaseInfo.startPhase) {
          phaseStartTimes[appName][phaseInfo.startPhase] = ts;
        }

        if (activeTab.value === 'perf') renderPerf();
      }

      if (activeTab.value === 'topology') renderTopology();
      if (activeTab.value === 'flow') renderFlow();
      break;
    }

    case 'ESMAP_EVENT': {
      const ts = msg['timestamp'] as number;
      const event = msg['event'] as string;
      const payload = msg['payload'] as string;
      const category = msg['category'] as EventCategory;
      const appName = msg['appName'] as string | undefined;

      addEvent({ timestamp: ts, category, name: event, detail: payload, appName });

      if (appName) {
        state.flows.push({ timestamp: ts, from: appName, to: 'host', event, category });
        if (state.flows.length > MAX_FLOWS) state.flows.shift();
        if (activeTab.value === 'flow') renderFlow();
      }
      break;
    }

    case 'ESMAP_STATE_CHANGE': {
      const ts = msg['timestamp'] as number;
      const newState = msg['newState'] as Record<string, unknown>;
      const prevState = msg['prevState'] as Record<string, unknown>;

      state.currentState = newState;
      const diffs: Array<{ key: string; oldValue: unknown; newValue: unknown }> = [];
      const allKeys = new Set([...Object.keys(newState), ...Object.keys(prevState)]);
      for (const key of allKeys) {
        if (JSON.stringify(newState[key]) !== JSON.stringify(prevState[key])) {
          diffs.push({ key, oldValue: prevState[key], newValue: newState[key] });
        }
      }
      if (diffs.length > 0) {
        state.stateHistory.push({ timestamp: ts, diff: diffs });
        if (state.stateHistory.length > MAX_STATES) state.stateHistory.shift();
        addEvent({ timestamp: ts, category: 'state', name: 'state:change', detail: diffs.map((d) => `${d.key}: ${JSON.stringify(d.newValue)}`).join(', ') });
        if (activeTab.value === 'state') renderState();
      }
      break;
    }

    case 'ESMAP_ROUTE_CHANGE': {
      const ts = msg['timestamp'] as number;
      const from = msg['from'] as string;
      const to = msg['to'] as string;
      addEvent({ timestamp: ts, category: 'route', name: 'route:change', detail: `${from} → ${to}` });

      const targetApp = APP_TOPOLOGY.find((a) => {
        const path = a.name === '@enterprise/dashboard' ? '/dashboard' : `/${a.short.toLowerCase()}`;
        return to === path || (to === '/' && a.name === '@enterprise/dashboard');
      });
      if (targetApp) {
        state.flows.push({ timestamp: ts, from: 'host', to: targetApp.name, event: `route → ${to}`, category: 'route' });
        if (state.flows.length > MAX_FLOWS) state.flows.shift();
        if (activeTab.value === 'flow') renderFlow();
      }
      break;
    }

    case 'ESMAP_PERF': {
      const appName = msg['appName'] as string;
      const phase = msg['phase'] as string;
      const duration = msg['duration'] as number;
      const ts = msg['timestamp'] as number;

      const existing = state.perfData.get(appName) ?? { total: 0, phases: {} };
      existing.phases[phase] = duration;
      existing.total = Object.values(existing.phases).reduce((sum, d) => sum + d, 0);
      state.perfData.set(appName, existing);

      addEvent({ timestamp: ts, category: 'lifecycle', name: `perf:${phase}`, detail: `${short(appName)} ${duration.toFixed(0)}ms`, appName });
      if (activeTab.value === 'topology') renderTopology();
      if (activeTab.value === 'perf') renderPerf();
      break;
    }

    case 'ESMAP_PREFETCH_STATS': {
      state.prefetchStats = (msg['stats'] as TransitionStats[]) ?? [];
      if (activeTab.value === 'topology') renderTopology();
      break;
    }

    case 'ESMAP_LOG': {
      const ts = msg['timestamp'] as number;
      const message = msg['message'] as string;
      addEvent({ timestamp: ts, category: 'lifecycle', name: 'log', detail: message });
      break;
    }
  }
}

// ─── Connect to background ───

const port = chrome.runtime.connect({ name: 'devtools-panel' });

// Send the tab ID this panel monitors
port.postMessage({ type: 'PANEL_INIT', tabId: chrome.devtools.inspectedWindow.tabId });

// Receive messages
port.onMessage.addListener((msg: { payload: Record<string, unknown> }) => {
  if (msg.payload) {
    handleMessage(msg.payload);
  }
});

port.onDisconnect.addListener(() => {
  state.connected = false;
  indicator.classList.remove('connected');
  statusText.textContent = 'Disconnected';
});
