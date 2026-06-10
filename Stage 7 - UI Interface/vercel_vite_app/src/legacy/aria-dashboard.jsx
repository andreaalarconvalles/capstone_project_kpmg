/* ARIA — landing dashboard: portfolio snapshot + multi-agent signals (visual-first) */

const CD = ARIA.c;

/* ---------- tiny SVG visuals ---------- */
function Sparkline({ data, color, w = 96, h = 30 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const nx = (i) => (i / (data.length - 1)) * (w - 2) + 1;
  const ny = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const pts = data.map((v, i) => `${nx(i).toFixed(1)},${ny(v).toFixed(1)}`).join(" ");
  const area = `1,${h - 1} ${pts} ${w - 1},${h - 1}`;
  const id = "sp" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={nx(data.length - 1)} cy={ny(data[data.length - 1])} r="2.4" fill={color} />
    </svg>
  );
}

function StackBar({ segments, w = 132, h = 8 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let x = 0;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {segments.map((s, i) => {
        const sw = (s.value / total) * (w - (segments.length - 1) * 2);
        const rx = x; x += sw + 2;
        return <rect key={i} x={rx} y="0" width={Math.max(sw, 2)} height={h} rx="3" fill={s.color} />;
      })}
    </svg>
  );
}

function MiniBars({ data, color, w = 96, h = 30 }) {
  const max = Math.max(...data) || 1;
  const bw = (w - (data.length - 1) * 3) / data.length;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {data.map((v, i) => {
        const bh = Math.max((v / max) * (h - 2), 2);
        return <rect key={i} x={i * (bw + 3)} y={h - bh} width={bw} height={bh} rx="2"
          fill={color} opacity={i === data.length - 1 ? 1 : 0.45} />;
      })}
    </svg>
  );
}

function Delta({ value, positive = true }) {
  const col = positive ? CD.success : CD.coral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color: col }}>
      <Icon name={positive ? "TrendingUp" : "TrendingDown"} size={13} color={col} sw={2.2} />
      {value}
    </span>
  );
}

/* ---------- KPI card ---------- */
function KpiCard({ icon, accent, label, value, sub, viz, foot }) {
  return (
    <div className="aria-elev" style={{
      background: CD.s1, border: `1px solid ${CD.hair}`, borderRadius: 16, padding: "14px 15px",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: `${accent}1f` }}>
          <Icon name={icon} size={14} color={accent} sw={2.1} />
        </div>
        <span style={{ fontSize: 12, color: CD.muted, fontWeight: 500, letterSpacing: -0.1 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1, whiteSpace: "nowrap" }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: CD.muted, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
        {viz && <div style={{ flexShrink: 0 }}>{viz}</div>}
      </div>
      {foot}
    </div>
  );
}

/* ---------- agent signal row ---------- */
function SignalRow({ accent, icon, label, value, onClick }) {
  return (
    <button className="aria-focus" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "9px 11px", borderRadius: 11, background: "transparent", color: CD.ink,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = CD.s2}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: `${accent}1f` }}>
        <Icon name={icon} size={14} color={accent} sw={2} />
      </div>
      <span style={{ fontSize: 12.5, color: CD.muted, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: CD.ink, whiteSpace: "nowrap" }}>{value}</span>
      <Icon name="ChevronRight" size={14} color={CD.muted} style={{ flexShrink: 0, marginLeft: -2 }} />
    </button>
  );
}

/* ---------- the dashboard ---------- */
function LandingDashboard({ onSignal }) {
  const A = Object.fromEntries(AGENTS.map((a) => [a.id, a.accent]));
  return (
    <div className="aria-fadein" style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2 }}>Portfolio snapshot</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: CD.muted, border: `1px solid ${CD.hair}`, borderRadius: 100, padding: "2px 8px" }}>
            <span style={{ width: 5, height: 5, borderRadius: 4, background: CD.success }} /> Live
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: CD.muted }}>135,051 × 96 cols</span>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <KpiCard icon="Building" accent={A["market"]} label="Listings" value="135,051"
          sub="Paris 120.8k · Athens 14.2k"
          foot={<StackBar segments={[{ value: 120809, color: A["host-revenue"] }, { value: 14242, color: A["gentrification"] }]} />} />
        <KpiCard icon="Wallet" accent={CD.success} label="Anticipated revenue" value="€42.8M"
          viz={<Sparkline data={[22, 24, 23, 27, 30, 33, 37, 41, 40, 43]} color={CD.success} />}
          foot={<Delta value="+20.9% vs current" positive />} />
        <KpiCard icon="Tags" accent={A["host-revenue"]} label="Price change" value="+18.4%"
          sub="avg recommended uplift"
          viz={<MiniBars data={[8, 11, 9, 14, 17, 21]} color={A["host-revenue"]} />} />
        <KpiCard icon="ShieldAlert" accent={A["crime"]} label="Flagged listings" value="47"
          sub="AML score > 0.80"
          foot={<StackBar segments={[{ value: 12, color: CD.coral }, { value: 23, color: A["crime"] }, { value: 12, color: CD.muted }]} />} />
      </div>

      {/* agent signals */}
      <div className="aria-elev" style={{ background: CD.s1, border: `1px solid ${CD.hair}`, borderRadius: 16, padding: 6 }}>
        <div style={{ fontSize: 11.5, color: CD.muted, fontWeight: 500, letterSpacing: -0.1, padding: "8px 9px 4px" }}>AGENT SIGNALS</div>
        <SignalRow accent={A["gentrification"]} icon="Building2" label="Displacement risk · Koukaki 0.84" value="3 areas"
          onClick={() => onSignal("gentrification", "Which Athens neighbourhoods show displacement risk in the next 12 months?")} />
        <SignalRow accent={A["demand"]} icon="TrainFront" label="Infrastructure stress · August peak" value="4 districts"
          onClick={() => onSignal("demand", "Which districts hit infrastructure stress in August?")} />
        <SignalRow accent={A["market"]} icon="TrendingUp" label="Top STR yield · Pangrati" value="11.4%"
          onClick={() => onSignal("market", "Rank Athens neighbourhoods by projected STR yield")} />
        <SignalRow accent={A["host-revenue"]} icon="Coins" label="Median underpricing gap" value="€29"
          onClick={() => onSignal("host-revenue", "Why is my listing underpriced vs the neighbourhood?")} />
      </div>
    </div>
  );
}

Object.assign(window, { LandingDashboard });
