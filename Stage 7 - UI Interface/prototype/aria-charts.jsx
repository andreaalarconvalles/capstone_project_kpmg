/* ARIA — charts: recharts dark-themed visualizations + SVG pseudo-choropleth map */

const {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} = Recharts;

const CC = ARIA.c;

/* ---------- shared theme bits ---------- */
const axisTick = { fill: CC.muted, fontSize: 11, letterSpacing: -0.2 };
const gridStroke = CC.s2;

function ChartTip({ active, payload, label, suffix = "", labelKey }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: CC.s2, border: `1px solid ${CC.hair}`, borderRadius: 10,
      padding: "8px 11px", fontSize: 12.5, color: CC.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      letterSpacing: -0.15,
    }}>
      {label != null && <div style={{ color: CC.muted, marginBottom: 4 }}>{labelKey ? payload[0].payload[labelKey] : label}</div>}
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

function ChartCard({ title, height = 248, children }) {
  return (
    <div className="aria-fadein" style={{
      background: CC.s1, border: `1px solid ${CC.hair}`, borderRadius: 16,
      padding: "16px 16px 8px", margin: "4px 0 2px",
    }}>
      {title && <div style={{ fontSize: 12.5, color: CC.muted, fontWeight: 500, marginBottom: 12, letterSpacing: -0.13 }}>{title}</div>}
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

/* lerp surface-2 -> coral by value 0..1 */
function riskColor(t) {
  t = Math.max(0, Math.min(1, t));
  const a = [28, 28, 28], b = [255, 85, 119];
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
                  stroke={active ? CC.ink : over ? "rgba(255,85,119,0.7)" : CC.hair}
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

/* ---------- chart dispatcher ---------- */
function ChartBlock({ chart }) {
  const { kind, title } = chart;

  if (kind === "shap") {
    return (
      <ChartCard title={title} height={220}>
        <BarChart data={DATA.shap} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={gridStroke} />
          <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} domain={[-10, 24]} />
          <YAxis type="category" dataKey="f" tick={axisTick} axisLine={false} tickLine={false} width={132} />
          <ReferenceLine x={0} stroke={CC.hair} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<ChartTip suffix=" €" />} />
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
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="m" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={42} />
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
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="n" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} domain={map.dom} />
          {map.ref != null && <ReferenceLine y={map.ref} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4"
            label={{ value: map.refLabel, fill: CC.muted, fontSize: 10.5, position: "right" }} />}
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<ChartTip suffix={map.suffix} />} />
          <Bar dataKey="v" name={title} radius={[5, 5, 0, 0]} isAnimationActive>
            {map.data.map((d, i) => {
              let fill = map.color;
              if (kind === "supplygap") fill = d.v >= 0 ? CC.teal : CC.muted;
              if (kind === "anomaly" && d.n === "#48213") fill = CC.coral;
              else if (kind === "anomaly") fill = "rgba(255,85,119,0.55)";
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
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="b" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<ChartTip suffix="%" />} />
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
      { k: "outer", c: CC.muted }, { k: "far", c: "#555" },
    ];
    return (
      <ChartCard title={title}>
        <LineChart data={DATA.trend} margin={{ left: 4, right: 16, top: 6, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="q" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} domain={[95, 130]} />
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
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis dataKey="m" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={42} unit="k" />
          <Tooltip cursor={{ stroke: CC.hair }} content={<ChartTip suffix="k nights" />} />
          <Area type="monotone" dataKey="hi" name="upper 80%" stroke="none" fill="rgba(255,122,61,0.14)" isAnimationActive={false} />
          <Area type="monotone" dataKey="lo" name="lower 80%" stroke="none" fill={CC.canvas || "#090909"} isAnimationActive={false} />
          <Line type="monotone" dataKey="y" name="forecast" stroke={CC.orange} strokeWidth={2.5} dot={{ r: 2.5, fill: CC.orange }} />
        </ComposedChart>
      </ChartCard>
    );
  }

  return null;
}

Object.assign(window, { ChartBlock, NeighbourhoodMap });
