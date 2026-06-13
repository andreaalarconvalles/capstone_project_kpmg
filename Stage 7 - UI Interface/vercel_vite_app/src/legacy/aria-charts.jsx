/* ARIA — charts: recharts dark-themed visualizations + map visualizations */

import AriaGeoMap from "./AriaGeoMap.jsx";

const {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
  PieChart, Pie,
} = Recharts;

const CC = ARIA.c;

/* ---------- shared theme bits ---------- */
const axisTick = () => ({ fill: CC.muted, fontSize: 11, letterSpacing: 0 });

function compactAxisLabel(value, max = 16) {
  let label = String(value || "");
  label = label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  label = label.replace(/\s+Arrondissement$/i, "");
  if (label.length <= max) return label;
  if (label.includes("-")) label = label.split("-")[0].trim();
  if (label.length <= max) return label;
  const words = label.split(" ").filter(Boolean);
  if (words.length > 1) {
    const twoWords = words.slice(0, 2).join(" ");
    if (twoWords.length <= max) return twoWords;
    label = words[0];
  }
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function chartDataWithLabels(data, xKey, maxItems = 6, labelKey = xKey) {
  return data.slice(0, maxItems).map((d) => ({
    ...d,
    __axisLabel: compactAxisLabel(d[labelKey] ?? d[xKey]),
    __fullLabel: d[labelKey] ?? d[xKey],
  }));
}

function ChartTip({ active, payload, label, suffix = "", labelKey }) {
  if (!active || !payload || !payload.length) return null;
  const labelText = labelKey ? payload[0].payload[labelKey] : label;
  return (
    <div style={{
      background: CC.s2, border: `1px solid ${CC.hair}`, borderRadius: 10,
      padding: "8px 11px", fontSize: 12.5, color: CC.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      letterSpacing: -0.15,
    }}>
      {labelText != null && <div style={{ color: CC.muted, marginBottom: 4 }}>{labelText}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: i ? 3 : 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill || CC.ink }} />
          <span style={{ color: CC.muted }}>{p.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function ScatterTip({ active, payload, xKey, yKey, xLabel, yLabel }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload || {};
  return (
    <div style={{
      background: CC.s2, border: `1px solid ${CC.hair}`, borderRadius: 10,
      padding: "8px 11px", fontSize: 12.5, color: CC.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      letterSpacing: -0.15,
    }}>
      <div style={{ color: CC.muted, marginBottom: 5 }}>{row.__fullLabel}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <span style={{ color: CC.muted }}>{xLabel}</span>
        <span style={{ fontWeight: 600 }}>{Number(row[xKey]).toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
        <span style={{ color: CC.muted }}>{yLabel}</span>
        <span style={{ fontWeight: 600 }}>{Number(row[yKey]).toLocaleString()}</span>
      </div>
      {(row.listingsDisplay || row.listings) && <div style={{ color: CC.muted, marginTop: 4 }}>{row.listingsDisplay || row.listings} listings</div>}
    </div>
  );
}

function DonutTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload || {};
  return (
    <div style={{
      background: CC.s2, border: `1px solid ${CC.hair}`, borderRadius: 10,
      padding: "8px 11px", fontSize: 12.5, color: CC.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      letterSpacing: -0.15,
    }}>
      <div style={{ color: CC.muted, marginBottom: 4 }}>{row.label}</div>
      <strong>{row.display || row.value}</strong>
      {row.shareDisplay && <div style={{ color: CC.muted, marginTop: 3 }}>{row.shareDisplay}</div>}
    </div>
  );
}

function ChartCard({ title, note, height = 248, children }) {
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16,
      padding: "16px 16px 8px", margin: "4px 0 2px",
    }}>
      {title && <div style={{ fontSize: 12.5, color: CC.muted, fontWeight: 500, marginBottom: 12, letterSpacing: -0.13 }}>{title}</div>}
      {note && <div style={{ fontSize: 11.5, color: CC.muted, lineHeight: 1.35, margin: "-6px 0 10px" }}>{note}</div>}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- datasets ---------- */
const DATA = {
  shap: [
    { f: "dist_zone=centre", v: 21 },
    { f: "accommodates=4", v: 13 },
    { f: "neighbourhood_stats", v: 8 },
    { f: "host_tenure_days", v: -4 },
    { f: "review_scores_rating", v: -7 },
  ],
  revsim: [
    { m: "Jan", cur: 2100, rec: 2380 }, { m: "Feb", cur: 2050, rec: 2330 },
    { m: "Mar", cur: 2300, rec: 2680 }, { m: "Apr", cur: 2520, rec: 2990 },
    { m: "May", cur: 2700, rec: 3260 }, { m: "Jun", cur: 2950, rec: 3680 },
    { m: "Jul", cur: 3250, rec: 4120 }, { m: "Aug", cur: 3300, rec: 4180 },
    { m: "Sep", cur: 2880, rec: 3520 }, { m: "Oct", cur: 2550, rec: 3010 },
    { m: "Nov", cur: 2150, rec: 2450 }, { m: "Dec", cur: 2350, rec: 2700 },
  ],
  riskbar: [
    { n: "Koukaki", v: 0.84 }, { n: "Exarchia", v: 0.76 }, { n: "Plaka", v: 0.71 },
    { n: "Pangrati", v: 0.58 }, { n: "Mets", v: 0.49 }, { n: "Kypseli", v: 0.43 },
  ],
  trend: [
    { q: "Q1", centre: 100, mid: 100, outer: 100, far: 100 },
    { q: "Q2", centre: 107, mid: 104, outer: 102, far: 100 },
    { q: "Q3", centre: 114, mid: 108, outer: 104, far: 101 },
    { q: "Q4", centre: 119, mid: 112, outer: 105, far: 101 },
    { q: "Q5", centre: 124, mid: 115, outer: 107, far: 102 },
    { q: "Q6", centre: 128, mid: 116, outer: 108, far: 103 },
  ],
  anomaly: [
    { n: "#48213", v: 0.94 }, { n: "#71902", v: 0.89 }, { n: "#33518", v: 0.86 },
    { n: "#60274", v: 0.83 }, { n: "#19847", v: 0.81 },
  ],
  riskdist: [
    { b: "0.0", v: 41 }, { b: "0.2", v: 28 }, { b: "0.4", v: 16 },
    { b: "0.6", v: 8 }, { b: "0.8", v: 4 }, { b: "0.94", v: 1, flag: true },
  ],
  forecast: (() => {
    const base = [120, 138, 176, 214, 168, 132];
    const m = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return base.map((y, i) => ({
      m: m[i], y, band: [Math.round(y * 0.91), Math.round(y * 1.09)], lo: Math.round(y * 0.91), hi: Math.round(y * 1.09),
    }));
  })(),
  stress: [
    { n: "Koukaki", v: 1.28 }, { n: "Plaka", v: 1.21 }, { n: "Monastiraki", v: 1.14 },
    { n: "Syntagma", v: 1.06 }, { n: "Pangrati", v: 0.79 }, { n: "Kypseli", v: 0.62 },
  ],
  yield: [
    { n: "Pangrati", v: 11.4 }, { n: "Kypseli", v: 10.6 }, { n: "Mets", v: 9.8 },
    { n: "Exarchia", v: 8.9 }, { n: "Koukaki", v: 7.9 }, { n: "Plaka", v: 7.1 },
  ],
  supplygap: [
    { n: "19th", v: 0.41 }, { n: "20th", v: 0.37 }, { n: "11th", v: 0.22 },
    { n: "18th", v: 0.12 }, { n: "12th", v: 0.04 }, { n: "1st–4th", v: -0.28 },
  ],
};

/* Athens neighbourhood layout for the pseudo-choropleth (risk + stress metrics) */
const MAP_NODES = [
  { name: "Koukaki", risk: 0.84, stress: 1.28, x: 1, y: 2 },
  { name: "Plaka", risk: 0.71, stress: 1.21, x: 2, y: 2 },
  { name: "Monastiraki", risk: 0.66, stress: 1.14, x: 2, y: 1 },
  { name: "Syntagma", risk: 0.63, stress: 1.06, x: 3, y: 1 },
  { name: "Exarchia", risk: 0.76, stress: 0.88, x: 3, y: 0 },
  { name: "Mets", risk: 0.49, stress: 0.71, x: 3, y: 3 },
  { name: "Pangrati", risk: 0.58, stress: 0.79, x: 4, y: 2 },
  { name: "Kypseli", risk: 0.43, stress: 0.62, x: 1, y: 0 },
  { name: "Gazi", risk: 0.52, stress: 0.74, x: 0, y: 1 },
  { name: "Petralona", risk: 0.38, stress: 0.55, x: 0, y: 2 },
  { name: "Ampelokipoi", risk: 0.31, stress: 0.48, x: 4, y: 0 },
  { name: "Neos Kosmos", risk: 0.35, stress: 0.5, x: 2, y: 3 },
];

/* lerp current surface-2 -> coral by value 0..1 */
function hexToRgb(h) {
  const x = String(h).replace("#", "");
  const n = x.length === 3 ? x.replace(/./g, (c) => c + c) : x;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function riskColor(t) {
  t = Math.max(0, Math.min(1, t));
  const a = hexToRgb(ARIA.c.s2), b = hexToRgb(ARIA.c.coral || "#ff5577");
  const e = Math.pow(t, 0.85);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * e));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---------- map component ---------- */
function NeighbourhoodMap({ city = "Athens", title, metric = "risk" }) {
  const [hover, setHover] = React.useState(null);
  const cell = 84, gap = 10, cols = 5, rows = 4;
  const W = cols * cell + (cols - 1) * gap;
  const H = rows * cell + (rows - 1) * gap;
  const vals = MAP_NODES.map((n) => n[metric]);
  const max = Math.max(...vals);
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16, padding: 16, margin: "4px 0 2px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: CC.muted, fontWeight: 500, letterSpacing: -0.13 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: CC.muted, display: "flex", alignItems: "center", gap: 7 }}>
          low
          <span style={{ width: 64, height: 7, borderRadius: 4, background: `linear-gradient(90deg, ${riskColor(0.05)}, ${riskColor(0.55)}, ${riskColor(1)})` }} />
          high
        </div>
      </div>
      <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
        <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} width="100%" style={{ maxWidth: W + 12, overflow: "visible" }}>
          {MAP_NODES.map((n) => {
            const t = n[metric] / (metric === "stress" ? 1.3 : 1);
            const px = n.x * (cell + gap), py = n.y * (cell + gap);
            const active = hover && hover.name === n.name;
            const over = metric === "stress" && n.stress > 1;
            return (
              <g key={n.name}
                 onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
                 style={{ cursor: "default" }}>
                <rect x={px} y={py} width={cell} height={cell} rx={14}
                  fill={riskColor(t)}
                  stroke={active ? CC.ink : over ? `${CC.coral}b3` : CC.hair}
                  strokeWidth={active ? 1.5 : 1}
                  style={{ transition: "stroke 0.15s, transform 0.15s", transformOrigin: `${px + cell / 2}px ${py + cell / 2}px`, transform: active ? "scale(1.04)" : "none" }} />
                <text x={px + cell / 2} y={py + cell / 2 - 4} textAnchor="middle"
                  fontSize="10.5" fontWeight="500" fill={t > 0.5 ? "#fff" : CC.muted}
                  style={{ pointerEvents: "none", letterSpacing: -0.2 }}>{n.name}</text>
                <text x={px + cell / 2} y={py + cell / 2 + 12} textAnchor="middle"
                  fontSize="12" fontWeight="600" fill={t > 0.5 ? "#fff" : CC.ink}
                  style={{ pointerEvents: "none" }}>{metric === "stress" ? n.stress.toFixed(2) : n.risk.toFixed(2)}</text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div style={{
            position: "absolute", top: -2, right: -2, background: CC.s2, border: `1px solid ${CC.hair}`,
            borderRadius: 10, padding: "8px 11px", fontSize: 12.5, pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            <div style={{ color: CC.muted, marginTop: 2 }}>
              {metric === "stress" ? `stress ${hover.stress.toFixed(2)}× capacity` : `risk score ${hover.risk.toFixed(2)}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function regionColor(t, tone) {
  t = Math.max(0, Math.min(1, t));
  const toneColor = tone === "risk"
    ? (CC.coral || "#ff5577")
    : tone === "livability"
      ? (CC.success || CC.teal || "#16a34a")
    : tone === "price"
      ? (CC.teal || CC.success || "#22c55e")
      : (CC.violet || "#6a4cf5");
  const a = hexToRgb(CC.s2), b = hexToRgb(toneColor);
  const e = Math.pow(t, 0.82);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * e));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const MAP_W = 720;
const MAP_H = 382;
const TILE = 256;

const CITY_OUTLINES = {
  Paris: [
    [48.901, 2.292], [48.900, 2.410], [48.873, 2.421], [48.834, 2.417],
    [48.815, 2.365], [48.826, 2.272], [48.858, 2.250],
  ],
  Athens: [
    [38.034, 23.706], [38.025, 23.782], [37.984, 23.792], [37.949, 23.758],
    [37.948, 23.702], [37.982, 23.682],
  ],
};

const PARIS_SEINE = [
  [48.822, 2.252], [48.837, 2.285], [48.849, 2.314], [48.858, 2.346],
  [48.852, 2.371], [48.841, 2.393], [48.827, 2.414],
];

function projectLatLon(lat, lon, zoom) {
  const sin = Math.sin((Number(lat) * Math.PI) / 180);
  const n = TILE * Math.pow(2, zoom);
  return {
    x: ((Number(lon) + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n,
  };
}

function tileUrl(x, y, z) {
  const n = Math.pow(2, z);
  const wrappedX = ((x % n) + n) % n;
  return `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
}

function mapState(chart) {
  const fallback = chart.city === "Athens"
    ? { lat: 37.9838, lon: 23.7275 }
    : { lat: 48.8566, lon: 2.3522 };
  const center = chart.center || fallback;
  const zoom = Number(chart.zoom || 12);
  const centerPx = projectLatLon(center.lat, center.lon, zoom);
  const left = centerPx.x - MAP_W / 2;
  const top = centerPx.y - MAP_H / 2;
  return { center, zoom, left, top };
}

function pointOnMap(lat, lon, state) {
  const p = projectLatLon(lat, lon, state.zoom);
  return { x: p.x - state.left, y: p.y - state.top };
}

function visibleTiles(state) {
  const n = Math.pow(2, state.zoom);
  const startX = Math.floor(state.left / TILE);
  const endX = Math.floor((state.left + MAP_W) / TILE);
  const startY = Math.floor(state.top / TILE);
  const endY = Math.floor((state.top + MAP_H) / TILE);
  const tiles = [];
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      if (y < 0 || y >= n) continue;
      tiles.push({
        key: `${state.zoom}-${x}-${y}`,
        href: tileUrl(x, y, state.zoom),
        x: x * TILE - state.left,
        y: y * TILE - state.top,
      });
    }
  }
  return tiles;
}

function pathFromCoords(coords, state) {
  return coords.map(([lat, lon], i) => {
    const p = pointOnMap(lat, lon, state);
    return `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function lineFromCoords(coords, state) {
  return coords.map(([lat, lon], i) => {
    const p = pointOnMap(lat, lon, state);
    return `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ");
}

function RegionMapCard({ chart }) {
  const [hover, setHover] = React.useState(null);
  const state = mapState(chart);
  const data = (chart.data || [])
    .filter((d) => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lon)))
    .slice(0, chart.city === "Paris" ? 20 : 14);
  const values = data.map((d) => Number(d.value)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  const lowerIsBetter = Boolean(chart.lowerIsBetter);
  const tiles = visibleTiles(state);
  const outline = CITY_OUTLINES[chart.city] || CITY_OUTLINES.Paris;
  const topRegions = data.slice(0, 4);
  const tooltipRows = hover ? [
    [chart.metricLabel || "Metric", hover.display],
    ["Listings", hover.listingsDisplay],
    ["Median nightly price", hover.priceDisplay],
    ["Average revenue", hover.revenueDisplay],
    ["Opportunity", hover.opportunityDisplay],
    ["Saturation", hover.saturationDisplay],
    ["Occupancy", hover.occupancyDisplay],
  ].filter((row) => row[1]) : [];
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16,
      padding: "16px 16px 12px", margin: "4px 0 2px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, color: CC.ink, fontWeight: 650, letterSpacing: 0 }}>{chart.title || `${chart.city} regional map`}</div>
          <div style={{ color: CC.muted, fontSize: 11.5, marginTop: 2 }}>
            Detected city: {chart.mapLabel || chart.city} · zoomed to city view
          </div>
          {chart.metricNote && (
            <div style={{ color: CC.muted, fontSize: 11.5, lineHeight: 1.35, marginTop: 4, maxWidth: 540 }}>
              {chart.metricNote}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: CC.muted, fontSize: 11.5, whiteSpace: "nowrap" }}>
          {chart.legendLow || "lower"}
          <span style={{ width: 76, height: 7, borderRadius: 999, background: `linear-gradient(90deg, ${regionColor(lowerIsBetter ? 1 : 0.1, chart.tone)}, ${regionColor(lowerIsBetter ? 0.1 : 1, chart.tone)})` }} />
          {chart.legendHigh || "higher"}
        </div>
      </div>
      <div style={{
        position: "relative", width: "100%", borderRadius: 14, overflow: "hidden",
        border: `1px solid ${CC.hair}`, background: CC.s2,
      }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" height="382" preserveAspectRatio="xMidYMid meet" role="img"
          aria-label={`${chart.city} map visualization with region overlays`}>
          <rect x="0" y="0" width={MAP_W} height={MAP_H} fill={CC.s2} />
          {tiles.map((tile) => (
            <image key={tile.key} href={tile.href} x={tile.x} y={tile.y} width={TILE} height={TILE} opacity="0.74" />
          ))}
          <rect x="0" y="0" width={MAP_W} height={MAP_H} fill={CC.s1} opacity="0.17" />
          <path d={pathFromCoords(outline, state)} fill={`${CC.s1}44`} stroke={CC.ink} strokeOpacity="0.24"
            strokeWidth="2.2" strokeDasharray="7 5" />
          {chart.city === "Paris" && (
            <path d={lineFromCoords(PARIS_SEINE, state)} fill="none" stroke={CC.teal || "#15b8a6"} strokeOpacity="0.55"
              strokeWidth="5" strokeLinecap="round" />
          )}
          {data.map((region, i) => {
            const p = pointOnMap(region.lat, region.lon, state);
            const rawT = (Number(region.value) - min) / range;
            const t = lowerIsBetter ? 1 - rawT : rawT;
            const active = hover && hover.label === region.label;
            const fill = regionColor(0.18 + t * 0.82, chart.tone);
            const radius = Math.max(15, Math.min(31, 14 + Math.log((Number(region.listings) || 1) + 1) * 2.1));
            return (
              <g key={`${region.label}-${i}`} onMouseEnter={() => setHover(region)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                <circle cx={p.x} cy={p.y} r={radius + 6} fill={fill} opacity="0.20" />
                <circle cx={p.x} cy={p.y} r={radius}
                  fill={fill} fillOpacity="0.88"
                  stroke={active || i === 0 ? CC.ink : "#fff"}
                  strokeOpacity={active || i === 0 ? 0.82 : 0.74}
                  strokeWidth={active || i === 0 ? 2.5 : 1.4}
                  style={{
                    transition: "stroke 0.15s, filter 0.15s, transform 0.15s, opacity 0.15s",
                    filter: active ? "brightness(1.13)" : "none",
                    transformOrigin: `${p.x}px ${p.y}px`,
                    transform: active ? "scale(1.08)" : "none",
                  }} />
                <text x={p.x} y={p.y + 4} textAnchor="middle"
                  fontSize="11" fontWeight="750" fill={t > 0.42 ? "#fff" : CC.ink}
                  style={{ pointerEvents: "none", letterSpacing: 0 }}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div style={{
            position: "absolute", top: 12, right: 12, minWidth: 230,
            background: CC.s2, border: `1px solid ${CC.hair}`, borderRadius: 12,
            padding: "10px 12px", fontSize: 12.5, color: CC.ink,
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 6 }}>{hover.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px" }}>
              {tooltipRows.map(([label, value]) => (
                <React.Fragment key={label}>
                  <span style={{ color: CC.muted }}>{label}</span><strong>{value}</strong>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        <div style={{
          position: "absolute", left: 12, bottom: 12, background: CC.s2,
          border: `1px solid ${CC.hair}`, borderRadius: 999, padding: "6px 10px",
          color: CC.muted, fontSize: 11.5, boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
        }}>
          Map data © OpenStreetMap · ARIA overlays
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 8, marginTop: 10,
      }}>
        {topRegions.map((region, i) => (
          <div key={region.label} style={{
            border: `1px solid ${CC.hair}`, borderRadius: 10, padding: "8px 9px",
            background: CC.s2, minWidth: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 999, display: "inline-flex", alignItems: "center",
                justifyContent: "center", background: regionColor(0.86 - i * 0.12, chart.tone),
                color: "#fff", fontSize: 10.5, fontWeight: 750, flex: "0 0 auto",
              }}>{i + 1}</span>
              <strong style={{
                fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{region.label}</strong>
            </div>
            <div style={{ marginTop: 5, color: CC.muted, fontSize: 11.5 }}>
              {chart.metricLabel}: <span style={{ color: CC.ink, fontWeight: 650 }}>{region.display}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, color: CC.muted, fontSize: 11.5, lineHeight: 1.4 }}>
        Hover a numbered region to inspect the local market signals. Region bubbles are approximate neighbourhood centroids from ARIA project data, shown on a real city map.
      </div>
    </div>
  );
}

function RegionMapStateCard({ title, message }) {
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16,
      padding: "18px 16px", margin: "4px 0 2px", minHeight: 260,
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
    }}>
      <div style={{ maxWidth: 420 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 650, color: CC.ink, marginBottom: 6 }}>{title}</div>}
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: CC.muted }}>{message}</div>
      </div>
    </div>
  );
}

function GeoRegionMapCard({ chart }) {
  const hasPointCoordinates = React.useMemo(() => (
    (chart.data || []).some((row) => (
      Number.isFinite(Number(row.lat))
      && Number.isFinite(Number(row.lon))
      && row.coordinateSource !== "fallback"
    ))
  ), [chart.data]);
  const [geoJson, setGeoJson] = React.useState(chart.geoJson || null);
  const [status, setStatus] = React.useState(chart.geoJson ? "ready" : chart.geoJsonUrl ? "loading" : hasPointCoordinates ? "ready" : "missing");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (chart.geoJson) {
      setGeoJson(chart.geoJson);
      setStatus("ready");
      setError("");
      return undefined;
    }
    if (!chart.geoJsonUrl) {
      setGeoJson(null);
      setStatus(hasPointCoordinates ? "ready" : "missing");
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError("");
    fetch(chart.geoJsonUrl, { signal: controller.signal, headers: { Accept: "application/geo+json, application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error(`Boundary source returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGeoJson(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setGeoJson(null);
        setStatus("error");
        setError(err.message || "Could not load geographic boundaries.");
      });

    return () => controller.abort();
  }, [chart.geoJson, chart.geoJsonUrl, hasPointCoordinates]);

  if (status === "loading") {
    return <RegionMapStateCard title={chart.title || "Regional map"} message="Loading real geographic boundaries..." />;
  }

  if (status === "missing") {
    return (
      <RegionMapStateCard
        title={chart.title || "Regional map"}
        message="A real GeoJSON boundary source is required for this map. ARIA will not render fake region tiles for geographic questions."
      />
    );
  }

  if (status === "error") {
    return (
      <RegionMapStateCard
        title={chart.title || "Regional map"}
        message={`Could not load the real boundary file. ${error}`}
      />
    );
  }

  const metrics = (chart.data || []).map((row) => ({
    regionId: String(row.regionId || row.code || row.label || ""),
    regionName: row.regionName || row.label || "Region",
    value: Number(row.value),
    lat: Number(row.lat),
    lon: Number(row.lon),
    coordinateSource: row.coordinateSource,
    metadata: {
      display: row.display,
      explanation: row.explanation,
      lat: row.lat,
      lon: row.lon,
      coordinateSource: row.coordinateSource,
      listings: row.listingsDisplay,
      medianNightlyPrice: row.priceDisplay,
      averageRevenue: row.revenueDisplay,
      opportunity: row.opportunityDisplay,
      saturation: row.saturationDisplay,
      occupancy: row.occupancyDisplay,
    },
  })).filter((row) => row.regionId);

  const highlightedRegions = chart.highlightedRegions && chart.highlightedRegions.length
    ? chart.highlightedRegions
    : metrics.slice(0, 4).map((row) => row.regionId);

  return (
    <AriaGeoMap
      key={[
        chart.city,
        chart.title,
        chart.metricLabel || chart.yLabel,
        chart.geoJsonUrl || "point-map",
        highlightedRegions.join("|"),
      ].filter(Boolean).join("::")}
      title={chart.title || `${chart.city || "City"} regional map`}
      geoJson={geoJson}
      metrics={metrics}
      chatbotSelection={{
        location: chart.city,
        geographyLevel: chart.geographyLevel || "city_district",
        metric: chart.metricLabel || chart.yLabel || "Selected metric",
        highlightedRegions,
        aggregation: chart.aggregation || "area average",
      }}
      regionIdProperty={chart.regionIdProperty || "regionId"}
      regionNameProperty={chart.regionNameProperty || "regionName"}
      height={chart.height || 420}
      showLegend={chart.showLegend !== false}
      showControls={chart.showControls !== false}
    />
  );
}

function HeatmapCard({ chart }) {
  const rows = [...new Set((chart.data || []).map((d) => d.yLabel || d.y || "Row"))];
  const cols = [...new Set((chart.data || []).map((d) => d.xLabel || d.x || "Column"))];
  const values = (chart.data || []).map((d) => Number(d.value)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  const lookup = new Map((chart.data || []).map((d) => [`${d.yLabel || d.y}|${d.xLabel || d.x}`, d]));
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16,
      padding: "16px 16px 14px", margin: "4px 0 2px",
    }}>
      {chart.title && <div style={{ fontSize: 12.5, color: CC.ink, fontWeight: 650, marginBottom: 4 }}>{chart.title}</div>}
      {chart.metricNote && <div style={{ fontSize: 11.5, color: CC.muted, lineHeight: 1.35, marginBottom: 12 }}>{chart.metricNote}</div>}
      <div style={{
        display: "grid",
        gridTemplateColumns: `minmax(88px, 0.7fr) repeat(${cols.length}, minmax(88px, 1fr))`,
        gap: 8,
        alignItems: "stretch",
      }}>
        <div />
        {cols.map((col) => (
          <div key={col} style={{ color: CC.muted, fontSize: 11.5, textAlign: "center", minWidth: 0 }}>{compactAxisLabel(col, 18)}</div>
        ))}
        {rows.map((row) => (
          <React.Fragment key={row}>
            <div style={{ color: CC.muted, fontSize: 11.5, display: "flex", alignItems: "center", minWidth: 0 }}>
              {compactAxisLabel(row, 18)}
            </div>
            {cols.map((col) => {
              const item = lookup.get(`${row}|${col}`);
              const value = Number(item?.value);
              const t = Number.isFinite(value) ? (value - min) / range : 0;
              return (
                <div key={`${row}-${col}`} title={item?.display || ""} style={{
                  minHeight: 58, borderRadius: 12, border: `1px solid ${CC.hair}`,
                  background: item ? regionColor(0.18 + t * 0.82, chart.tone || "opportunity") : CC.s2,
                  color: t > 0.45 ? "#fff" : CC.ink,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 3, padding: 8, textAlign: "center",
                }}>
                  <strong style={{ fontSize: 13 }}>{item?.display || "n/a"}</strong>
                  {item?.label && <span style={{ fontSize: 10.5, opacity: 0.82 }}>{compactAxisLabel(item.label, 14)}</span>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---------- chart dispatcher ---------- */
function ChartBlock({ chart }) {
  const { kind, title } = chart;
  if (kind === "region-map" && Array.isArray(chart.data) && chart.data.length) {
    return <GeoRegionMapCard chart={chart} />;
  }

  if (Array.isArray(chart.data) && chart.data.length) {
    const xKey = chart.xKey || "label";
    const yKey = chart.yKey || "value";
    const yLabel = chart.yLabel || title || "Value";
    const xLabel = chart.xLabel || "Area";
    const data = chartDataWithLabels(chart.data, xKey, kind === "line" ? 8 : 6);
    if (kind === "heatmap") {
      return <HeatmapCard chart={chart} />;
    }
    if (kind === "donut") {
      const donutData = chartDataWithLabels(chart.data, "label", 8);
      const colors = [CC.violet, CC.teal || CC.success, CC.magenta || CC.coral, CC.orange, CC.muted, `${CC.violet}99`, `${CC.teal || CC.success}99`, `${CC.coral}99`];
      return (
        <ChartCard title={title || "Live breakdown"} note={chart.metricNote} height={250}>
          <PieChart margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
            <Tooltip content={<DonutTip />} />
            <Pie data={donutData} dataKey={yKey} nameKey="label" innerRadius="54%" outerRadius="78%" paddingAngle={2}>
              {donutData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
          </PieChart>
        </ChartCard>
      );
    }
    if (kind === "histogram") {
      const histogramData = chartDataWithLabels(chart.data, xKey, 8, "label");
      return (
        <ChartCard title={title || "Distribution"} note={chart.metricNote} height={240}>
          <BarChart data={histogramData} margin={{ left: 4, right: 16, top: 8, bottom: 14 }} barCategoryGap="12%">
            <CartesianGrid vertical={false} stroke={CC.s2} />
            <XAxis dataKey="__axisLabel" tick={axisTick()} axisLine={false} tickLine={false} interval={0} tickMargin={8} height={36} />
            <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip labelKey="__fullLabel" />} />
            <Bar dataKey={yKey} name={yLabel} radius={[5, 5, 0, 0]} isAnimationActive>
              {histogramData.map((_, i) => <Cell key={i} fill={i >= histogramData.length - 2 ? CC.violet : `${CC.violet}88`} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      );
    }
    if (kind === "bubble-scatter") {
      const scatterData = chartDataWithLabels(chart.data, xKey, 10, "label");
      const sizeKey = chart.sizeKey || "size";
      return (
        <ChartCard title={title || "Trade-off analysis"} note={chart.metricNote} height={272}>
          <ScatterChart data={scatterData} margin={{ left: 4, right: 18, top: 8, bottom: 10 }}>
            <CartesianGrid stroke={CC.s2} />
            <XAxis type="number" dataKey={xKey} name={xLabel} tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <YAxis type="number" dataKey={yKey} name={yLabel} tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <ZAxis type="number" dataKey={sizeKey} range={[70, 520]} />
            <Tooltip cursor={{ stroke: CC.hair }} content={<ScatterTip xKey={xKey} yKey={yKey} xLabel={xLabel} yLabel={yLabel} />} />
            <Scatter name={title || "Live analysis"} data={scatterData} fill={CC.violet} fillOpacity={0.78} />
          </ScatterChart>
        </ChartCard>
      );
    }
    if (kind === "scatter") {
      const scatterData = chartDataWithLabels(chart.data, xKey, 8, "label");
      return (
        <ChartCard title={title || "Live analysis"} note={chart.metricNote} height={252}>
          <ScatterChart data={scatterData} margin={{ left: 4, right: 18, top: 8, bottom: 10 }}>
            <CartesianGrid stroke={CC.s2} />
            <XAxis type="number" dataKey={xKey} name={xLabel} tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <YAxis type="number" dataKey={yKey} name={yLabel} tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <Tooltip cursor={{ stroke: CC.hair }} content={<ScatterTip xKey={xKey} yKey={yKey} xLabel={xLabel} yLabel={yLabel} />} />
            <Scatter name={title || "Live analysis"} data={scatterData} fill={CC.violet} />
          </ScatterChart>
        </ChartCard>
      );
    }
    if (kind === "horizontal-bar") {
      return (
        <ChartCard title={title || "Live analysis"} note={chart.metricNote} height={252}>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 22, top: 8, bottom: 8 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={CC.s2} />
            <XAxis type="number" tick={axisTick()} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="__axisLabel" tick={axisTick()} axisLine={false} tickLine={false} width={138} interval={0} />
            <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip labelKey="__fullLabel" />} />
            <Bar dataKey={yKey} name={yLabel} radius={[0, 5, 5, 0]} isAnimationActive>
              {data.map((_, i) => <Cell key={i} fill={i === 0 ? CC.violet : `${CC.violet}99`} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      );
    }
    if (kind === "grouped-bar") {
      const series = chart.series && chart.series.length ? chart.series : [{ key: yKey, name: yLabel }];
      const colors = [CC.violet, CC.teal || CC.success, CC.magenta || CC.coral, CC.muted];
      return (
        <ChartCard title={title || "Live analysis"} note={chart.metricNote} height={252}>
          <BarChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 14 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CC.s2} />
            <XAxis dataKey="__axisLabel" tick={axisTick()} axisLine={false} tickLine={false} interval={0} tickMargin={8} height={36} />
            <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip labelKey="__fullLabel" />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name || s.key} radius={[5, 5, 0, 0]} fill={colors[i % colors.length]} isAnimationActive />
            ))}
          </BarChart>
        </ChartCard>
      );
    }
    if (kind === "line") {
      return (
        <ChartCard title={title || "Live analysis"} note={chart.metricNote}>
          <LineChart data={data} margin={{ left: 4, right: 16, top: 6, bottom: 2 }}>
            <CartesianGrid vertical={false} stroke={CC.s2} />
            <XAxis dataKey="__axisLabel" tick={axisTick()} axisLine={false} tickLine={false} interval={0} tickMargin={8} height={34} />
            <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} />
            <Tooltip cursor={{ stroke: CC.hair }} content={<ChartTip labelKey="__fullLabel" />} />
            <Line type="monotone" dataKey={yKey} name={yLabel} stroke={CC.violet} strokeWidth={2.5} dot={{ r: 2.5, fill: CC.violet }} />
          </LineChart>
        </ChartCard>
      );
    }
    return (
      <ChartCard title={title || "Live analysis"} note={chart.metricNote} height={252}>
        <BarChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 14 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="__axisLabel" tick={axisTick()} axisLine={false} tickLine={false} interval={0} tickMargin={8} height={36} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} />
          <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip labelKey="__fullLabel" />} />
          <Bar dataKey={yKey} name={yLabel} radius={[5, 5, 0, 0]} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={i === 0 ? CC.violet : `${CC.violet}99`} />)}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }

  if (kind === "shap") {
    return (
      <ChartCard title={title} height={220}>
        <BarChart data={DATA.shap} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={CC.s2} />
          <XAxis type="number" tick={axisTick()} axisLine={false} tickLine={false} domain={[-10, 24]} />
          <YAxis type="category" dataKey="f" tick={axisTick()} axisLine={false} tickLine={false} width={132} />
          <ReferenceLine x={0} stroke={CC.hair} />
          <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip suffix=" €" />} />
          <Bar dataKey="v" name="SHAP value" radius={4} isAnimationActive>
            {DATA.shap.map((d, i) => <Cell key={i} fill={d.v >= 0 ? CC.violet : CC.muted} />)}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }

  if (kind === "revsim") {
    return (
      <ChartCard title={title}>
        <LineChart data={DATA.revsim} margin={{ left: 4, right: 16, top: 6, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="m" tick={axisTick()} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} />
          <Tooltip cursor={{ stroke: CC.hair }} content={<ChartTip suffix=" €" />} />
          <Line type="monotone" dataKey="cur" name="Current €118" stroke={CC.muted} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rec" name="Recommended €142" stroke={CC.violet} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ChartCard>
    );
  }

  if (kind === "riskbar" || kind === "stress" || kind === "yield" || kind === "supplygap" || kind === "anomaly") {
    const map = {
      riskbar: { data: DATA.riskbar, color: CC.magenta, suffix: "", dom: [0, 1], ref: 0.7, refLabel: "warn 0.70" },
      stress: { data: DATA.stress, color: CC.orange, suffix: "×", dom: [0, 1.4], ref: 1, refLabel: "capacity 1.0" },
      yield: { data: DATA.yield, color: CC.teal, suffix: "%", dom: [0, 13] },
      supplygap: { data: DATA.supplygap, color: CC.teal, suffix: "", dom: [-0.35, 0.5], ref: 0 },
      anomaly: { data: DATA.anomaly, color: CC.coral, suffix: "", dom: [0, 1], ref: 0.8, refLabel: "AML 0.80" },
    }[kind];
    return (
      <ChartCard title={title} height={232}>
        <BarChart data={map.data} margin={{ left: 4, right: 16, top: 8, bottom: 2 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="n" tick={axisTick()} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={40} domain={map.dom} />
          {map.ref != null && <ReferenceLine y={map.ref} stroke="rgba(128,128,128,0.34)" strokeDasharray="4 4"
            label={{ value: map.refLabel, fill: CC.muted, fontSize: 10.5, position: "right" }} />}
          <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip suffix={map.suffix} />} />
          <Bar dataKey="v" name={title} radius={[5, 5, 0, 0]} isAnimationActive>
            {map.data.map((d, i) => {
              let fill = map.color;
              if (kind === "supplygap") fill = d.v >= 0 ? CC.teal : CC.muted;
              if (kind === "anomaly" && d.n === "#48213") fill = CC.coral;
              else if (kind === "anomaly") fill = `${CC.coral}8c`;
              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }

  if (kind === "riskdist") {
    return (
      <ChartCard title={title} height={210}>
        <BarChart data={DATA.riskdist} margin={{ left: 4, right: 16, top: 8, bottom: 2 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="b" tick={axisTick()} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ fill: "rgba(128,128,128,0.09)" }} content={<ChartTip suffix="%" />} />
          <Bar dataKey="v" name="share of listings" radius={[5, 5, 0, 0]}>
            {DATA.riskdist.map((d, i) => <Cell key={i} fill={d.flag ? CC.coral : "rgba(153,153,153,0.45)"} />)}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }

  if (kind === "trend") {
    const lines = [
      { k: "centre", c: CC.magenta }, { k: "mid", c: CC.orange },
      { k: "outer", c: CC.muted }, { k: "far", c: CC.hair },
    ];
    return (
      <ChartCard title={title}>
        <LineChart data={DATA.trend} margin={{ left: 4, right: 16, top: 6, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="q" tick={axisTick()} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={40} domain={[95, 130]} />
          <Tooltip cursor={{ stroke: CC.hair }} content={<ChartTip />} />
          {lines.map((l) => (
            <Line key={l.k} type="monotone" dataKey={l.k} name={l.k} stroke={l.c}
              strokeWidth={l.k === "centre" ? 2.5 : 2} dot={false} />
          ))}
        </LineChart>
      </ChartCard>
    );
  }

  if (kind === "forecast") {
    return (
      <ChartCard title={title}>
        <ComposedChart data={DATA.forecast} margin={{ left: 4, right: 16, top: 6, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke={CC.s2} />
          <XAxis dataKey="m" tick={axisTick()} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick()} axisLine={false} tickLine={false} width={42} unit="k" />
          <Tooltip cursor={{ stroke: CC.hair }} content={<ChartTip suffix="k nights" />} />
          <Area type="monotone" dataKey="hi" name="upper 80%" stroke="none" fill={`${CC.orange}24`} isAnimationActive={false} />
          <Area type="monotone" dataKey="lo" name="lower 80%" stroke="none" fill={CC.canvas || "#090909"} isAnimationActive={false} />
          <Line type="monotone" dataKey="y" name="forecast" stroke={CC.orange} strokeWidth={2.5} dot={{ r: 2.5, fill: CC.orange }} />
        </ComposedChart>
      </ChartCard>
    );
  }

  return null;
}

Object.assign(window, { ChartBlock, NeighbourhoodMap, RegionMapCard: GeoRegionMapCard, GeoRegionMapCard });
