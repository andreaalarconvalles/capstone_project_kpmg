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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, fontWeight: 600, color: col }}>
      <Icon name={positive ? "TrendingUp" : "TrendingDown"} size={13} color={col} sw={2.2} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </span>
  );
}

/* ---------- KPI card ---------- */
function KpiCard({ icon, accent, label, value, sub, viz, foot }) {
  return (
    <div className="aria-elev" style={{
      background: CD.s1, border: `1px solid ${CD.hair}`, borderRadius: 16, padding: "14px 15px",
      height: "100%", minHeight: 128, boxSizing: "border-box", overflow: "hidden",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: `${accent}1f`, flexShrink: 0 }}>
          <Icon name={icon} size={14} color={accent} sw={2.1} />
        </div>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: CD.muted, fontWeight: 500, letterSpacing: -0.1 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, minWidth: 0, minHeight: 48 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: CD.muted, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
        {viz && <div style={{ width: 96, maxWidth: "42%", flexShrink: 0, overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>{viz}</div>}
      </div>
      {foot && <div style={{ marginTop: "auto", minHeight: 18, maxHeight: 18, overflow: "hidden", display: "flex", alignItems: "center" }}>{foot}</div>}
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
  const cardButton = { width: "100%", height: "100%", display: "block", padding: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left" };
  return (
    <div className="aria-fadein" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: CD.ink }}>Dataset insight cards</div>
        <div style={{ fontSize: 12, color: CD.muted }}>Paris + Athens · 135,051 listings</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gridAutoRows: 128, alignItems: "stretch", gap: 10 }}>
        <button className="aria-focus" onClick={() => onSignal("market", "Which Athens neighbourhoods offer the strongest short-term rental yield?")}
          style={cardButton}>
          <KpiCard icon="UsersRound" accent={A["market"]} label="Family-friendly stay base" value="Koukaki"
            sub="central Athens · 1,333 listings"
            foot={<Delta value="98.8 occupancy index" positive />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("gentrification", "Where is host risk highest in Athens?")}
          style={cardButton}>
          <KpiCard icon="ShieldCheck" accent={CD.success} label="Lowest risk proxy" value="Akropoli"
            sub="25.8% high-risk share"
            foot={<StackBar segments={[{ value: 116, color: A["gentrification"] }, { value: 333, color: CD.success }]} />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("market", "Which Athens neighbourhoods offer the strongest short-term rental yield?")}
          style={cardButton}>
          <KpiCard icon="BadgeEuro" accent={A["host-revenue"]} label="Cheapest median nightly" value="€44"
            sub="Agios Eleftherios · Athens"
            viz={<MiniBars data={[82, 81, 66, 55, 44]} color={A["host-revenue"]} />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("market", "Which Athens neighbourhoods offer the strongest short-term rental yield?")}
          style={cardButton}>
          <KpiCard icon="Trophy" accent={A["demand"]} label="Best opportunity score" value="Zappeio"
            sub="0.96 score · €15.4k avg revenue"
            viz={<Sparkline data={[35, 54, 68, 74, 96]} color={A["demand"]} />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("market", "Which Paris arrondissement is best for a new short-term rental investment?")}
          style={cardButton}>
          <KpiCard icon="MapPinned" accent={A["market"]} label="Paris entry signal" value="Hôtel-de-Ville"
            sub="0.86 opportunity score"
            foot={<Delta value="top Paris area" positive />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("host-revenue", "What price change could improve my Athens listing revenue?")}
          style={cardButton}>
          <KpiCard icon="TrendingUp" accent={A["host-revenue"]} label="Underpricing upside" value="Zappeio"
            sub="€41 avg nightly gap"
            viz={<MiniBars data={[29, 33, 34, 36, 41]} color={A["host-revenue"]} />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("market", "Compare Paris vs Athens for a small short-term rental portfolio.")}
          style={cardButton}>
          <KpiCard icon="ReceiptText" accent={A["crime"]} label="Median nightly baseline" value="€81-€82"
            sub="Paris €81 · Athens €82"
            foot={<StackBar segments={[{ value: 81, color: A["market"] }, { value: 82, color: A["gentrification"] }]} />} />
        </button>
        <button className="aria-focus" onClick={() => onSignal("gentrification", "Which Athens listings need attention first because they are high-risk and underpriced?")}
          style={cardButton}>
          <KpiCard icon="ListChecks" accent={A["gentrification"]} label="Priority review queue" value="865"
            sub="high-risk + underpriced listings"
            foot={<Delta value="best first action list" positive />} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { LandingDashboard });
