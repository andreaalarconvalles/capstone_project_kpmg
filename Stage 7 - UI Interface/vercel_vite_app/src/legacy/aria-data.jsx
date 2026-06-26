/* ARIA — data layer: theme, agents, seeded conversations, scripted demo scripts */

const ARIA = {
  c: {
    /* defaults to Airbnb light (the default theme); applyTheme() swaps these live */
    canvas: "#ffffff", s1: "#f7f7f7", s2: "#f2f2f2",
    hair: "#dddddd", hairSoft: "#ebebeb",
    ink: "#222222", inkSoft: "#3f3f3f", muted: "#6a6a6a", blue: "#ff385c",
    accent: "#ff385c", accentActive: "#e00b41", cta: "#ff385c", ctaText: "#ffffff",
    violet: "#6a4cf5", magenta: "#d44df0", orange: "#ff7a3d",
    coral: "#ff5577", teal: "#1fd1c7", success: "#16a34a", scrollThumb: "#cfcfcf",
  },
  /* live UI tweak state (mutated by the Tweaks panel, read at render/stream time) */
  ui: { fontSize: 15, density: "regular", streamSpeed: "normal", traceCollapse: true },
};

const AGENTS = [
  {
    id: "auto", name: "Auto Agent",
    tagline: "ARIA chooses the specialist", icon: "Sparkles",
    accent: "#ff385c", emoji: "✨",
    auto: true,
    chips: [
      "For a KPMG client entering Paris, which arrondissement should be the first acquisition cluster and why?",
      "For an Athens property manager, which repricing actions unlock revenue while controlling listing risk?",
      "Where should an Athens operations team deploy host-support resources first?",
      "Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?",
    ],
  },
  {
    id: "host-revenue", name: "Host Revenue Intelligence",
    tagline: "Your personal revenue manager", icon: "Coins",
    accent: "#ff385c", emoji: "💶",
    chips: [
      "For a Paris host, what pricing move would recover revenue without damaging bookings?",
      "For an Athens property manager, which repricing actions unlock revenue while controlling listing risk?",
    ],
  },
  {
    id: "gentrification", name: "Gentrification Early Warning",
    tagline: "Displacement risk 12–24 months ahead", icon: "Building2",
    accent: "#00a699", emoji: "🏘️",
    chips: [
      "Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?",
      "Where should an Athens operations team deploy host-support resources first?",
    ],
  },
  {
    id: "crime", name: "STR Financial Crime Detection",
    tagline: "AML anomaly & SAR intelligence", icon: "Fingerprint",
    accent: "#8a2d62", emoji: "🕵️",
    chips: [
      "Where should an Athens operations team deploy host-support resources first?",
      "Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?",
    ],
  },
  {
    id: "demand", name: "Tourism Demand Forecast",
    tagline: "Infrastructure load intelligence", icon: "TrainFront",
    accent: "#fc642d", emoji: "🚇",
    chips: [
      "Which Athens neighbourhoods should an investor underwrite first for yield and why?",
      "Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?",
    ],
  },
  {
    id: "market", name: "Market Entry Advisor",
    tagline: "Site selection & ROI intelligence", icon: "Hammer",
    accent: "#e0116f", emoji: "🏗️",
    chips: [
      "For a KPMG client entering Paris, which arrondissement should be the first acquisition cluster and why?",
      "Where should a Paris short-term-rental investor avoid first because saturation or regulation could compress returns?",
      "Which Athens neighbourhoods should an investor underwrite first for yield and why?",
      "Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?",
    ],
  },
];

const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
const DEFAULT_AGENT_ACCENTS = Object.fromEntries(AGENTS.map((a) => [a.id, a.accent]));

const AGENT_ROUTER_RULES = [
  {
    id: "host-revenue",
    supporting: ["demand", "market"],
    patterns: [
      "price", "pricing", "priced", "underpriced", "overpriced", "revenue", "nightly", "rate",
      "rent out", "host", "listing", "occupancy", "income", "profit", "yield", "description",
    ],
  },
  {
    id: "gentrification",
    supporting: ["market", "crime"],
    patterns: [
      "gentrification", "displacement", "family", "live", "safe", "safest", "neighbourhood pressure",
      "neighborhood pressure", "resident", "community", "risk highest", "host risk", "attention first",
    ],
  },
  {
    id: "crime",
    supporting: ["gentrification", "host-revenue"],
    patterns: [
      "aml", "money laundering", "financial crime", "sar", "suspicious", "anomaly", "compliance",
      "flagged", "fraud", "regulator", "risk score", "high-risk",
    ],
  },
  {
    id: "demand",
    supporting: ["host-revenue", "market"],
    patterns: [
      "forecast", "tourism", "demand", "season", "seasonality", "infrastructure", "metro", "airport",
      "event", "peak", "30 days", "90 days", "occupancy forecast",
    ],
  },
  {
    id: "market",
    supporting: ["host-revenue", "demand", "gentrification"],
    patterns: [
      "invest", "investment", "buy", "purchase", "best area", "best place", "where should",
      "compare", "portfolio", "paris vs athens", "athens vs paris", "market entry", "opportunity",
      "region", "map", "short-term rental", "airbnb", "arrondissement", "neighbourhood", "neighborhood",
    ],
  },
];

function resolveAgentRoute(selectedAgentId, prompt) {
  if (selectedAgentId && selectedAgentId !== "auto") {
    return { agentId: selectedAgentId, requestedAgentId: selectedAgentId, supportingAgentIds: [], auto: false };
  }

  const p = String(prompt || "").toLowerCase();
  const scored = AGENT_ROUTER_RULES.map((rule, index) => {
    const score = rule.patterns.reduce((sum, pattern) => (
      p.includes(pattern) ? sum + (pattern.length > 8 ? 2 : 1) : sum
    ), 0);
    return { ...rule, score, index };
  }).sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const selected = scored[0]?.score > 0 ? scored[0] : AGENT_ROUTER_RULES.find((rule) => rule.id === "market");
  const support = [
    ...(selected.supporting || []),
    ...scored.filter((rule) => rule.id !== selected.id && rule.score > 0).map((rule) => rule.id),
  ].filter((id, index, arr) => id !== selected.id && arr.indexOf(id) === index).slice(0, 3);

  return {
    agentId: selected.id,
    requestedAgentId: "auto",
    supportingAgentIds: support,
    auto: true,
  };
}

const MODELS = [
  { group: "AI Models", items: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", desc: "Default deep analysis", default: true, ml: false, provider: "google" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast responses", ml: false, provider: "google" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", desc: "Newest fast Gemini option", ml: false, provider: "google" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", desc: "Preview reasoning model", ml: false, provider: "google" },
  ]},
  { group: "Claude Models", badge: "Vertex", items: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "Anthropic partner model", ml: false, provider: "anthropic" },
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", desc: "Anthropic partner model", ml: false, provider: "anthropic" },
  ]},
  { group: "ARIA Analysis Engines", badge: "ML", items: [
    { id: "xgboost-pricing-v1", name: "XGBoost Pricing v1", desc: "Price prediction · Paris + Athens", ml: true, chip: "XGBoost Pricing" },
    { id: "lightgbm-risk-v1", name: "LightGBM Risk v1", desc: "Underpricing risk · Athens", ml: true, chip: "LightGBM Risk" },
    { id: "prophet-forecast", name: "Prophet Forecast", desc: "Occupancy 30/90d", ml: true, chip: "Prophet Forecast" },
  ]},
];
const MODEL_BY_ID = Object.fromEntries(MODELS.flatMap((g) => g.items).map((m) => [m.id, m]));

/* ---------- Scripted demo scripts ----------
   key: `${agentId}::${prompt}`  →  { trace:[{node,detail}], blocks:[...], brief:{title,kpis} } */

const T = (node, detail) => ({ node, detail });

const SCRIPTS = {
  /* ============ HOST REVENUE ============ */
  "host-revenue::Why is my listing underpriced vs the neighbourhood?": {
    trace: [
      T("Orchestrator", "routing to Host Revenue Intelligence"),
      T("Pricing Agent", "loading XGBoost Pricing v1 · 23 comparables in dist_zone=centre"),
      T("SHAP Explainer", "attributing top price drivers"),
      T("Demand Agent", "cross-checking 90-day occupancy"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Your listing is priced at **€118/night**, but XGBoost Pricing v1 predicts a fair market value of **€147/night** for a comparable unit in `dist_zone=centre`. That's an **underpricing gap of €29 (+24.6%)** versus 23 nearby comparables with similar `accommodates` and `review_scores_rating`." },
      { type: "chart", chart: { kind: "shap", title: "Top SHAP drivers of predicted price_eur" } },
      { type: "text", text: "The model attributes most of the gap to three features: your central `dist_zone` (+€21 SHAP value) and `accommodates=4` (+€13) push fair value **up**, while a below-median `review_scores_rating` of 4.62 and short `host_tenure_days` pull it slightly **down**. None of these justify the current discount — you're leaving margin on the table, not pricing for risk." },
      { type: "text", text: "**Recommendation:** lift base price to **€142** (a conservative 96% of predicted) and enable a weekend uplift. Estimated annual impact at your current 71% occupancy: **+€6,400/yr**. Want me to export a one-page pricing brief?" },
    ],
    brief: { title: "Pricing Brief — Listing underpricing analysis", kpis: [
      { label: "Current price", value: "€118" }, { label: "Fair value (XGBoost)", value: "€147" },
      { label: "Underpricing gap", value: "+€29 · 24.6%" }, { label: "Est. annual uplift", value: "+€6,400" },
    ]},
  },
  "host-revenue::Simulate revenue: current vs recommended pricing": {
    trace: [
      T("Orchestrator", "routing to Host Revenue Intelligence"),
      T("Pricing Agent", "XGBoost Pricing v1 · scenario grid"),
      T("Demand Agent", "Prophet occupancy elasticity 30/90d"),
      T("Orchestrator", "running revenue simulation"),
    ],
    blocks: [
      { type: "text", text: "I simulated 12 months of revenue under your **current €118** flat rate versus the **recommended €142 base** with dynamic weekend pricing, holding the Prophet-forecast occupancy curve constant and applying a modest demand elasticity." },
      { type: "chart", chart: { kind: "revsim", title: "Monthly revenue — current vs recommended (€)" } },
      { type: "text", text: "Recommended pricing wins in every month, with the spread widening across the **Jun–Sep** peak where central-Paris demand is least price-sensitive. Cumulative gross revenue rises from **€30,600** to **€37,000** — a **+€6,400 (+20.9%)** uplift — while occupancy dips only 2.3pts, well inside the elasticity band. The trade is clearly favourable. I can export this as a PDF brief for your records." },
    ],
    brief: { title: "Revenue Simulation Brief", kpis: [
      { label: "Current (12mo)", value: "€30,600" }, { label: "Recommended (12mo)", value: "€37,000" },
      { label: "Net uplift", value: "+€6,400 · 20.9%" }, { label: "Occupancy delta", value: "−2.3 pts" },
    ]},
  },

  /* ============ GENTRIFICATION ============ */
  "gentrification::Which Athens neighbourhoods show displacement risk in the next 12 months?": {
    trace: [
      T("Orchestrator", "routing to Gentrification Early Warning"),
      T("Density Agent", "STR density Δ across neighbourhood_stats"),
      T("Risk Model", "LightGBM Risk v1 · 12-month displacement score"),
      T("Geo Agent", "rendering choropleth"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Across the **14,242 Athens listings**, three central neighbourhoods cross the early-warning threshold (displacement risk score **> 70%**) on a 12-month horizon. The signal is driven by accelerating STR density in `dist_zone=centre` combined with rising median `price_eur` and falling long-let supply." },
      { type: "map", map: { city: "Athens", title: "Displacement risk by neighbourhood" } },
      { type: "chart", chart: { kind: "riskbar", title: "12-month displacement risk score" } },
      { type: "text", text: "**Koukaki (84.0%)** is the sharpest mover — STR density up 31% year-on-year with a 19% `price_eur` increase. **Exarchia (76.0%)** and **Plaka (71.0%)** follow. By contrast, outer zones like Kypseli stay below 45.0%. These three account for **62% of net new entire-home listings** in the period — the classic precursor to resident displacement. I'd recommend monitoring at monthly cadence and can draft a policy brief for the housing department." },
    ],
    brief: { title: "Displacement Early-Warning Brief — Athens", kpis: [
      { label: "Neighbourhoods > 70%", value: "3" }, { label: "Top risk: Koukaki", value: "84.0%" },
      { label: "STR density Δ (Koukaki)", value: "+31% YoY" }, { label: "Net new entire-homes", value: "62% in 3 areas" },
    ]},
  },
  "gentrification::Show STR density growth by dist_zone": {
    trace: [
      T("Orchestrator", "routing to Gentrification Early Warning"),
      T("Density Agent", "aggregating listings by dist_zone"),
      T("Trend Agent", "fitting 24-month density trend"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Here's STR density growth indexed across the four `dist_zone` bands (centre / mid / outer / far) over the trailing 24 months, normalised to listings per 1,000 dwellings." },
      { type: "chart", chart: { kind: "trend", title: "STR density index by dist_zone (24mo)" } },
      { type: "text", text: "Growth is heavily concentrated: **`centre` density rose 28%** while **`far` was essentially flat (+3%)**. The `mid` zone (+16%) is the one to watch — it shows the steepest *second-derivative*, meaning displacement pressure is now migrating outward from the saturated core. This spatial diffusion pattern is the same one that preceded displacement in Plaka two years ago. Intervention thresholds should therefore be zone-specific rather than city-wide." },
    ],
    brief: { title: "STR Density Trend Brief — Athens by dist_zone", kpis: [
      { label: "Centre growth (24mo)", value: "+28%" }, { label: "Mid growth", value: "+16%" },
      { label: "Far growth", value: "+3%" }, { label: "Diffusion signal", value: "Centre → Mid" },
    ]},
  },

  /* ============ CRIME ============ */
  "crime::Show the top AML risk scores with SHAP explanations": {
    trace: [
      T("Orchestrator", "routing to STR Financial Crime Detection"),
      T("Anomaly Agent", "Isolation Forest scoring 120,809 Paris listings"),
      T("SHAP Explainer", "explaining top anomalies"),
      T("AML Agent", "mapping to typologies"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Isolation Forest flagged **47 Paris listings** above the AML risk threshold (anomaly score **> 0.80**). Here are the five highest, with SHAP attributions tying each score to concrete features rather than a black-box flag." },
      { type: "chart", chart: { kind: "anomaly", title: "Top AML anomaly scores · Paris" } },
      { type: "text", text: "Listing **#48213 (0.94)** dominates: SHAP attributes the score to an implausible `host_tenure_days=11` paired with 9 active listings, near-zero `review_scores_rating` despite 140 bookings, and `price_eur` 3.2× the `dist_zone` median — a textbook **ghost-listing / layering** signature. Three of the five share a payment-cluster fingerprint suggesting a common controller. These warrant a Suspicious Activity Report. I can draft a SAR for #48213 on request." },
    ],
    brief: { title: "AML Anomaly Brief — Paris", kpis: [
      { label: "Listings > 0.80", value: "47" }, { label: "Top score: #48213", value: "0.94" },
      { label: "Shared payment cluster", value: "3 of 5" }, { label: "Typology", value: "Ghost-listing / layering" },
    ]},
  },
  "crime::Draft a SAR for listing #48213": {
    trace: [
      T("Orchestrator", "routing to STR Financial Crime Detection"),
      T("Anomaly Agent", "retrieving #48213 feature vector"),
      T("AML Agent", "matching FATF typologies"),
      T("Drafting Agent", "composing SAR narrative"),
    ],
    blocks: [
      { type: "text", text: "**DRAFT — Suspicious Activity Report**\n\n**Subject:** Listing #48213 (entire home, `dist_zone=centre`, Paris). **Filing basis:** automated AML anomaly score **0.94** (Isolation Forest), SHAP-explained." },
      { type: "chart", chart: { kind: "riskdist", title: "#48213 vs population risk distribution" } },
      { type: "text", text: "**Narrative:** The account exhibits behaviour inconsistent with legitimate short-term letting. Within 11 days of registration (`host_tenure_days=11`) the host operated 9 simultaneous listings priced at 3.2× the neighbourhood median, recording 140 bookings yet near-zero `review_scores_rating` — a pattern consistent with **placement and layering of illicit funds** through fictitious occupancy. Payment metadata links the account to two further flagged listings under distinct identities. **Recommended action:** freeze payouts pending review and escalate to the FIU. *This is an AI-generated draft for analyst review and must be validated before filing.*" },
    ],
    brief: { title: "Suspicious Activity Report (DRAFT) — #48213", kpis: [
      { label: "Anomaly score", value: "0.94" }, { label: "host_tenure_days", value: "11" },
      { label: "Linked listings", value: "2" }, { label: "Status", value: "Analyst review" },
    ]},
  },

  /* ============ DEMAND ============ */
  "demand::Forecast tourist-nights in central Athens for peak season": {
    trace: [
      T("Orchestrator", "routing to Tourism Demand Forecast"),
      T("Forecast Agent", "Prophet · tourist-nights, 90-day horizon"),
      T("Confidence Agent", "80% prediction interval"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Prophet forecasts tourist-nights for `dist_zone=centre` Athens across the **Jun–Sep** peak, derived from occupancy × capacity across the 14,242-listing base with an 80% confidence band." },
      { type: "chart", chart: { kind: "forecast", title: "Forecast tourist-nights · central Athens (80% CI)" } },
      { type: "text", text: "The central forecast peaks at **~214,000 tourist-nights in August**, up **18% year-on-year**, with the confidence band widening to ±9% as the horizon extends. July and August together represent **47% of full-year demand** concentrated in the core. This level approaches the historical infrastructure-stress line for water and waste services. I can translate these nights into transit and waste load, or run high/base/low scenarios for summer 2026." },
    ],
    brief: { title: "Tourist-Nights Forecast Brief — Central Athens", kpis: [
      { label: "August peak", value: "~214k nights" }, { label: "YoY growth", value: "+18%" },
      { label: "Jul+Aug share", value: "47% of year" }, { label: "Confidence", value: "80% CI · ±9%" },
    ]},
  },
  "demand::Which districts hit infrastructure stress in August?": {
    trace: [
      T("Orchestrator", "routing to Tourism Demand Forecast"),
      T("Forecast Agent", "district-level August load"),
      T("Load Agent", "mapping nights → water/waste/transit index"),
      T("Geo Agent", "rendering stress map"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "I converted the August tourist-night forecast into a composite **infrastructure stress index** (water, waste, transit) per district, where **1.0 = design capacity**. Four central districts are projected to exceed it." },
      { type: "map", map: { city: "Athens", title: "August infrastructure stress index", metric: "stress" } },
      { type: "chart", chart: { kind: "stress", title: "August infrastructure stress index by district" } },
      { type: "text", text: "**Koukaki (1.28)** and **Plaka (1.21)** breach capacity most severely, driven by transit load at metro Akropoli and waste collection frequency. **Monastiraki (1.14)** and **Syntagma (1.06)** follow. Outer districts stay comfortably under 0.8. The actionable lever is staggered waste pickup and temporary transit frequency boosts in those four zones for the 6-week peak — far cheaper than capital works. Want the scenario run for summer 2026?" },
    ],
    brief: { title: "Infrastructure Stress Brief — Athens, August", kpis: [
      { label: "Districts > 1.0", value: "4" }, { label: "Peak: Koukaki", value: "1.28" },
      { label: "Primary driver", value: "Transit + waste" }, { label: "Recommended", value: "Staggered services" },
    ]},
  },

  /* ============ MARKET ============ */
  "market::Rank Athens neighbourhoods by projected STR yield": {
    trace: [
      T("Orchestrator", "routing to Market Entry Advisor"),
      T("Yield Agent", "ADR × occupancy − cost across neighbourhood_stats"),
      T("Risk Agent", "regulatory + saturation discount"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "I ranked Athens neighbourhoods by **projected net STR yield** — XGBoost-predicted ADR × Prophet occupancy, less operating cost, then discounted for regulatory and saturation risk." },
      { type: "chart", chart: { kind: "yield", title: "Projected net STR yield by neighbourhood (%)" } },
      { type: "text", text: "**Pangrati (11.4%)** tops the ranking: strong ADR, below-core saturation, and no current licence moratorium. **Kypseli (10.6%)** and **Mets (9.8%)** follow as gentrifying-but-not-saturated plays. Core tourist zones like Plaka post lower *net* yield (7.1%) — high ADR is offset by saturation and regulatory risk. For a value-add thesis, Pangrati and Kypseli offer the best risk-adjusted entry. I can compare a 50-unit portfolio here against Paris." },
    ],
    brief: { title: "STR Yield Ranking Brief — Athens", kpis: [
      { label: "Top: Pangrati", value: "11.4% net" }, { label: "Runner-up: Kypseli", value: "10.6%" },
      { label: "Core (Plaka)", value: "7.1% net" }, { label: "Thesis", value: "Gentrifying, unsaturated" },
    ]},
  },
  "market::Which Paris arrondissements are supply-constrained?": {
    trace: [
      T("Orchestrator", "routing to Market Entry Advisor"),
      T("Supply Agent", "supply vs predicted demand · 120,809 listings"),
      T("Gap Agent", "computing constraint index by arrondissement"),
      T("Orchestrator", "composing brief"),
    ],
    blocks: [
      { type: "text", text: "Across the **120,809 Paris listings** I computed a supply–demand gap per arrondissement: predicted demand (search + occupancy pressure) minus active entire-home supply. Positive = under-supplied." },
      { type: "chart", chart: { kind: "supplygap", title: "Supply–demand gap by arrondissement (index)" } },
      { type: "text", text: "The **19th (+0.41)** and **20th (+0.37)** are the most supply-constrained — robust demand growth with comparatively thin entire-home supply and lighter regulatory friction than the centre. The **11th (+0.22)** is a secondary opportunity. By contrast the **1st–4th** run deeply negative: saturated and regulation-capped. For new entry, the eastern arrondissements offer the cleanest constraint-driven upside. I can rank these by projected yield or compare against Athens next." },
    ],
    brief: { title: "Supply Constraint Brief — Paris", kpis: [
      { label: "Most constrained: 19th", value: "+0.41" }, { label: "Runner-up: 20th", value: "+0.37" },
      { label: "Avoid", value: "1st–4th (saturated)" }, { label: "Secondary", value: "11th · +0.22" },
    ]},
  },
};

SCRIPTS["market::Which Paris arrondissement is best for a new short-term rental investment?"] = {
  trace: [
    T("Orchestrator", "routing to Market Entry Advisor"),
    T("GitHub Data Agent", "loading Paris neighbourhood summary"),
    T("Analytics Agent", "ranking opportunity vs saturation"),
    T("Visualization Agent", "preparing area comparison"),
    T("Orchestrator", "composing consumer brief"),
  ],
  blocks: [
    { type: "text", text: "**Start with the 19th arrondissement.** In the ARIA market-entry analysis, the 19th has the strongest supply-constrained signal, followed by the 20th and then the 11th. That means demand is present, but the competitive pressure is cleaner than in the central tourist core." },
    { type: "chart", chart: { kind: "supplygap", title: "Paris supply-demand opportunity signal" } },
    { type: "text", text: "For a consumer or small operator, the key benefit is that the eastern arrondissements offer room to enter without competing directly against the most saturated central districts. The recommendation is not a home-buying verdict; it is a short-term-rental market-entry signal." },
  ],
  brief: { title: "Paris Investment Entry Brief", kpis: [
    { label: "Best first area", value: "19th" }, { label: "Runner-up", value: "20th" },
    { label: "Secondary option", value: "11th" }, { label: "Avoid first", value: "1st-4th" },
  ]},
};

SCRIPTS["market::Which Paris areas look saturated and should I avoid?"] = {
  trace: [
    T("Orchestrator", "routing to Market Entry Advisor"),
    T("Supply Agent", "checking Paris saturation signals"),
    T("Risk Agent", "flagging high-friction entry zones"),
    T("Orchestrator", "composing avoid-first brief"),
  ],
  blocks: [
    { type: "text", text: "**Avoid the 1st-4th arrondissements as a first move.** They are the most saturated and regulation-constrained zones in the current ARIA Paris view. They may still work for premium operators, but they are not the cleanest entry point for a small portfolio." },
    { type: "chart", chart: { kind: "supplygap", title: "Paris supply-demand gap: positive is cleaner entry" } },
    { type: "text", text: "The more attractive consumer-friendly answer is to look east: the 19th, 20th, and 11th show stronger supply-demand imbalance with less direct competition than the central core." },
  ],
  brief: { title: "Paris Saturation Brief", kpis: [
    { label: "Avoid first", value: "1st-4th" }, { label: "Reason", value: "Saturated" },
    { label: "Cleaner entry", value: "19th" }, { label: "Backup", value: "20th" },
  ]},
};

SCRIPTS["host-revenue::Is my Paris listing underpriced compared with similar listings?"] = {
  trace: [
    T("Orchestrator", "routing to Host Revenue Intelligence"),
    T("Pricing Agent", "checking XGBoost fair-price signal"),
    T("SHAP Explainer", "identifying pricing drivers"),
    T("Orchestrator", "composing pricing brief"),
  ],
  blocks: [
    { type: "text", text: "**Yes, the demo listing appears underpriced.** The current nightly price is **€118**, while the XGBoost pricing signal points to a fair value near **€147** for comparable Paris listings. That is a meaningful pricing gap, not a tiny model-noise difference." },
    { type: "chart", chart: { kind: "shap", title: "Main drivers behind the fair-price estimate" } },
    { type: "text", text: "A practical move would be to test a conservative lift toward **€142** rather than jumping straight to the full model estimate. That keeps the listing competitive while reducing revenue left on the table." },
  ],
  brief: { title: "Paris Listing Pricing Brief", kpis: [
    { label: "Current price", value: "€118" }, { label: "Fair value", value: "€147" },
    { label: "Gap", value: "+€29" }, { label: "Suggested test", value: "€142" },
  ]},
};

SCRIPTS["host-revenue::What price change could improve my Athens listing revenue?"] = {
  trace: [
    T("Orchestrator", "routing to Host Revenue Intelligence"),
    T("Pricing Agent", "loading Athens underpricing output"),
    T("Risk Agent", "checking high-risk overlap"),
    T("Orchestrator", "composing revenue action"),
  ],
  blocks: [
    { type: "text", text: "**Use a measured price increase, not a blind jump.** ARIA flags **2,945 Athens listings** as underpriced, and the strongest opportunities are the listings where the fair-price gap is large enough to matter after model error." },
    { type: "chart", chart: { kind: "shap", title: "Athens price drivers to check before repricing" } },
    { type: "text", text: "For a host, the practical rule is to move in steps: raise listings with a gap above roughly **€25-€40**, monitor conversion, and prioritise the **865** listings that are both underpriced and high-risk for coaching or review." },
  ],
  brief: { title: "Athens Revenue Action Brief", kpis: [
    { label: "Underpriced listings", value: "2,945" }, { label: "Priority overlap", value: "865" },
    { label: "Action", value: "Stepwise lift" }, { label: "Watch band", value: "€25-€40" },
  ]},
};

SCRIPTS["market::Which Athens neighbourhoods offer the strongest short-term rental yield?"] = {
  trace: [
    T("Orchestrator", "routing to Market Entry Advisor"),
    T("Yield Agent", "ranking Athens neighbourhoods"),
    T("Risk Agent", "checking saturation discount"),
    T("Orchestrator", "composing yield brief"),
  ],
  blocks: [
    { type: "text", text: "**Pangrati is the strongest first look.** In the current ARIA yield view, Pangrati leads with **11.4% projected net short-term-rental yield**, followed by Kypseli and Mets." },
    { type: "chart", chart: { kind: "yield", title: "Projected Athens short-term-rental yield" } },
    { type: "text", text: "The consumer-friendly takeaway is simple: avoid choosing only by tourist fame. Core tourist zones can have high nightly prices but weaker net yield after saturation and regulatory pressure." },
  ],
  brief: { title: "Athens Yield Brief", kpis: [
    { label: "Top area", value: "Pangrati" }, { label: "Yield", value: "11.4%" },
    { label: "Runner-up", value: "Kypseli" }, { label: "Core caution", value: "Plaka" },
  ]},
};
SCRIPTS["demand::Which Athens neighbourhoods offer the strongest short-term rental yield?"] = SCRIPTS["market::Which Athens neighbourhoods offer the strongest short-term rental yield?"];

SCRIPTS["gentrification::Which Athens listings need attention first because they are high-risk and underpriced?"] = {
  trace: [
    T("Orchestrator", "routing to Gentrification Early Warning"),
    T("Risk Agent", "loading LightGBM risk output"),
    T("Pricing Agent", "intersecting with underpricing output"),
    T("Orchestrator", "composing priority list"),
  ],
  blocks: [
    { type: "text", text: "**Prioritise the overlap group first.** ARIA identifies **865 Athens listings** that are both underpriced and high-risk. These listings matter because they combine revenue upside with signs that the host or listing may need intervention." },
    { type: "chart", chart: { kind: "riskbar", title: "Athens risk concentration by neighbourhood" } },
    { type: "text", text: "This is the best first action queue for a service team: coach pricing where there is upside, but focus human attention where risk is also elevated." },
  ],
  brief: { title: "Athens Priority Intervention Brief", kpis: [
    { label: "Priority listings", value: "865" }, { label: "High-risk threshold", value: "70%" },
    { label: "Use case", value: "Host coaching" }, { label: "City", value: "Athens" },
  ]},
};
SCRIPTS["crime::Which Athens listings need attention first because they are high-risk and underpriced?"] = SCRIPTS["gentrification::Which Athens listings need attention first because they are high-risk and underpriced?"];

SCRIPTS["gentrification::Where is host risk highest in Athens?"] = {
  trace: [
    T("Orchestrator", "routing to Gentrification Early Warning"),
    T("Risk Model", "grouping Athens risk scores"),
    T("Visualization Agent", "mapping highest-risk neighbourhoods"),
    T("Orchestrator", "composing host-risk brief"),
  ],
  blocks: [
    { type: "text", text: "**Central Athens needs the closest monitoring.** The risk model flags **4,695 high-risk listings** overall, with central neighbourhoods carrying the strongest concentration of warning signals." },
    { type: "chart", chart: { kind: "riskbar", title: "Athens high-risk signal by neighbourhood" } },
    { type: "text", text: "Risk here means prioritisation for review: weak recent review velocity, high availability, host profile weakness, or related observable signs. It should guide analyst attention, not replace human judgement." },
  ],
  brief: { title: "Athens Host-Risk Brief", kpis: [
    { label: "High-risk listings", value: "4,695" }, { label: "Threshold", value: "70%" },
    { label: "Top signal", value: "Central areas" }, { label: "Use", value: "Review queue" },
  ]},
};
SCRIPTS["crime::Where is host risk highest in Athens?"] = SCRIPTS["gentrification::Where is host risk highest in Athens?"];

SCRIPTS["market::Compare Paris vs Athens for a small short-term rental portfolio."] = {
  trace: [
    T("Orchestrator", "routing to Market Entry Advisor"),
    T("Portfolio Agent", "comparing Paris and Athens summaries"),
    T("Risk Agent", "checking saturation and regulation signals"),
    T("Orchestrator", "composing portfolio brief"),
  ],
  blocks: [
    { type: "text", text: "**Use Paris for scale and Athens for targeted upside.** Paris offers the larger market with **120,809 listings**, while Athens is smaller at **14,242 listings** but easier to explain through neighbourhood-level pricing and risk opportunities." },
    { type: "chart", chart: { kind: "yield", title: "Athens yield benchmark for targeted upside" } },
    { type: "text", text: "For a small portfolio, the practical answer is not either/or: start with a focused Athens value-add thesis, then use Paris eastern arrondissements as the scale pathway once the operating model is proven." },
  ],
  brief: { title: "Paris vs Athens Portfolio Brief", kpis: [
    { label: "Paris scale", value: "120,809" }, { label: "Athens depth", value: "14,242" },
    { label: "Athens play", value: "Yield" }, { label: "Paris play", value: "Scale" },
  ]},
};
SCRIPTS["demand::Compare Paris vs Athens for a small short-term rental portfolio."] = SCRIPTS["market::Compare Paris vs Athens for a small short-term rental portfolio."];

/* Response-quality overrides for the visible scripted analyses. Keep these aligned with api/aria-response-policy.js. */
function setScriptBlocks(key, blocks) {
  if (SCRIPTS[key]) SCRIPTS[key].blocks = blocks;
}

function scriptRegionMap({ city, title, metricLabel, tone = "opportunity", lowerIsBetter = false, rows }) {
  const cityMeta = city === "Athens"
    ? { center: { lat: 37.9838, lon: 23.7275 }, zoom: 12, mapLabel: "Athens" }
    : { center: { lat: 48.8566, lon: 2.3522 }, zoom: 12, mapLabel: "Paris" };
  return {
    kind: "region-map",
    city,
    title,
    mapLabel: cityMeta.mapLabel,
    center: cityMeta.center,
    zoom: cityMeta.zoom,
    metricKey: "value",
    metricLabel,
    tone,
    lowerIsBetter,
    legendLow: lowerIsBetter ? "better" : "lower",
    legendHigh: lowerIsBetter ? "worse" : "higher",
    highlightedRegions: rows.slice(0, 4).map((row) => row.regionId),
    data: rows.map((row) => ({
      label: row.label,
      regionId: row.regionId,
      regionName: row.label,
      value: row.value,
      display: row.display,
      explanation: row.explanation,
      lat: row.lat,
      lon: row.lon,
      coordinateSource: "scripted",
      listingsDisplay: row.listingsDisplay || null,
      priceDisplay: row.priceDisplay || null,
      revenueDisplay: row.revenueDisplay || null,
      opportunityDisplay: row.opportunityDisplay || null,
      saturationDisplay: row.saturationDisplay || null,
      occupancyDisplay: row.occupancyDisplay || null,
    })),
  };
}

const SCRIPT_MAPS = {
  parisOpportunity: scriptRegionMap({
    city: "Paris",
    title: "Paris opportunity map: eastern entry corridor",
    metricLabel: "Opportunity signal",
    tone: "opportunity",
    rows: [
      { regionId: "paris-19", label: "19th arrondissement", value: 0.41, display: "+0.41", lat: 48.8838, lon: 2.3822, explanation: "Best first shortlist in the scripted supply-demand view." },
      { regionId: "paris-20", label: "20th arrondissement", value: 0.37, display: "+0.37", lat: 48.8646, lon: 2.3984, explanation: "Runner-up eastern entry option." },
      { regionId: "paris-11", label: "11th arrondissement", value: 0.22, display: "+0.22", lat: 48.8574, lon: 2.3795, explanation: "Secondary option with established demand." },
      { regionId: "paris-1-4", label: "1st-4th arrondissements", value: -0.28, display: "-0.28", lat: 48.8566, lon: 2.3444, explanation: "Avoid-first central core in the scripted view." },
    ],
  }),
  parisSaturation: scriptRegionMap({
    city: "Paris",
    title: "Paris saturation map: avoid-first central core",
    metricLabel: "Saturation pressure",
    tone: "risk",
    rows: [
      { regionId: "paris-1-4", label: "1st-4th arrondissements", value: 0.92, display: "High", lat: 48.8566, lon: 2.3444, explanation: "Most saturated and regulation-sensitive scripted cluster." },
      { regionId: "paris-11", label: "11th arrondissement", value: 0.48, display: "Moderate", lat: 48.8574, lon: 2.3795, explanation: "Secondary option with more balanced entry pressure." },
      { regionId: "paris-20", label: "20th arrondissement", value: 0.39, display: "Lower", lat: 48.8646, lon: 2.3984, explanation: "Cleaner eastern entry option." },
      { regionId: "paris-19", label: "19th arrondissement", value: 0.36, display: "Lower", lat: 48.8838, lon: 2.3822, explanation: "Best avoid-central-core alternative." },
    ],
  }),
  athensYield: scriptRegionMap({
    city: "Athens",
    title: "Athens yield map: value-add neighbourhoods",
    metricLabel: "Projected net yield",
    tone: "price",
    rows: [
      { regionId: "athens-pangrati", label: "Pangrati", value: 11.4, display: "11.4%", lat: 37.9715, lon: 23.7433, explanation: "Top scripted yield shortlist." },
      { regionId: "athens-kypseli", label: "Kypseli", value: 10.6, display: "10.6%", lat: 38.0024, lon: 23.7355, explanation: "Runner-up yield area." },
      { regionId: "athens-mets", label: "Mets", value: 9.8, display: "9.8%", lat: 37.9683, lon: 23.7358, explanation: "Third scripted yield area." },
      { regionId: "athens-plaka", label: "Plaka", value: 7.1, display: "7.1%", lat: 37.9725, lon: 23.7309, explanation: "Core tourist zone with weaker risk-adjusted yield." },
    ],
  }),
  athensRisk: scriptRegionMap({
    city: "Athens",
    title: "Athens host-risk map: central concentration",
    metricLabel: "Host-risk signal",
    tone: "risk",
    rows: [
      { regionId: "athens-koukaki", label: "Koukaki", value: 0.84, display: "84.0%", lat: 37.9636, lon: 23.7219, explanation: "Highest scripted host-risk concentration." },
      { regionId: "athens-exarchia", label: "Exarchia", value: 0.76, display: "76.0%", lat: 37.9861, lon: 23.7354, explanation: "Second-highest scripted host-risk signal." },
      { regionId: "athens-plaka", label: "Plaka", value: 0.71, display: "71.0%", lat: 37.9725, lon: 23.7309, explanation: "Central tourist area above warning threshold." },
      { regionId: "athens-pangrati", label: "Pangrati", value: 0.58, display: "58.0%", lat: 37.9715, lon: 23.7433, explanation: "Moderate scripted risk signal." },
    ],
  }),
};

setScriptBlocks("market::Which Paris arrondissement is best for a new short-term rental investment?", [
  { type: "text", text: "Direct recommendation:\nStart with the 19th arrondissement as the first Paris market-entry shortlist. ARIA reads it as the cleanest balance between demand and entry pressure for a small short-term-rental investor. The 20th is the runner-up, and the 11th is a secondary option if you want a slightly more established demand base.\n\nReasoning done by ARIA:\nThe 19th is attractive because it shows a stronger supply-demand opportunity signal (demand appears stronger than available comparable supply) than the central tourist core. For a non-technical user, the practical meaning is simple: you are not only chasing famous areas; you are looking for a district where competition is less crowded and upside is easier to justify." },
  { type: "chart", chart: SCRIPT_MAPS.parisOpportunity },
  { type: "chart", chart: { kind: "supplygap", title: "Paris supply-demand opportunity signal" } },
  { type: "text", text: "Key evidence:\n- The strongest scripted opportunity ranking is 19th first, then 20th, then 11th.\n- The 1st-4th arrondissements are treated as avoid-first areas because they are more saturated (more crowded with short-term-rental competition) and more regulation-sensitive.\n- This is a short-term-rental investment signal, not a full residential purchase recommendation.\n\nVisualizations to review:\nUse the Paris map to understand the eastern corridor spatially, then use the supply-demand chart to compare the 19th, 20th, and central arrondissements. The map gives location context; the chart explains the ranking.\n\nPossible limitations:\nARIA does not replace property-level due diligence. Before buying, check building rules, licensing constraints, financing cost, renovation needs, and local operating restrictions.\n\nSources: neighbourhood stats, ARIA supply-demand opportunity signal" },
]);

setScriptBlocks("market::Which Paris areas look saturated and should I avoid?", [
  { type: "text", text: "Direct recommendation:\nAvoid the 1st-4th arrondissements as the first move for a small short-term-rental portfolio. They may still work for a premium operator with strong capital and compliance capacity, but ARIA does not treat them as the cleanest entry point.\n\nReasoning done by ARIA:\nThe central arrondissements are already heavily competed and more exposed to regulatory friction. Saturation (how crowded an area is with short-term-rental supply) matters because even beautiful locations can become weak investments if too many similar listings are fighting for the same demand." },
  { type: "chart", chart: SCRIPT_MAPS.parisSaturation },
  { type: "chart", chart: { kind: "supplygap", title: "Paris supply-demand gap: positive is cleaner entry" } },
  { type: "text", text: "Key evidence:\n- The scripted avoid-first group is the 1st-4th arrondissements.\n- Cleaner entry options are the 19th and 20th, with the 11th as a secondary option.\n- The decision is based on relative market-entry pressure, not on whether the central districts are desirable places to visit.\n\nVisualizations to review:\nUse the map to separate the central avoid-first cluster from the eastern opportunity corridor. Then use the supply-demand chart to see why positive gap areas are easier to justify than saturated central areas.\n\nPossible limitations:\nA high-end operator can still succeed in central Paris, but the required execution standard is higher. ARIA's advice is designed for a small portfolio seeking a cleaner first entry.\n\nSources: neighbourhood stats, ARIA supply-demand opportunity signal" },
]);

setScriptBlocks("host-revenue::Is my Paris listing underpriced compared with similar listings?", [
  { type: "text", text: "Direct recommendation:\nYes, the demo Paris listing appears underpriced. Its current nightly price is EUR 118, while the XGBoost pricing signal (ARIA's fair-price model) points to roughly EUR 147 for comparable listings. That creates an underpricing gap (the difference between ARIA's fair-price estimate and the current listed price) of about EUR 29 per night.\n\nReasoning done by ARIA:\nARIA is not saying to jump blindly to the maximum model estimate. It is saying the listing is probably leaving revenue on the table because the current price is meaningfully below the model's comparable-market estimate." },
  { type: "chart", chart: { kind: "shap", title: "Main drivers behind the fair-price estimate" } },
  { type: "text", text: "Key evidence:\n- Current price: EUR 118.\n- XGBoost fair-value estimate: about EUR 147.\n- Suggested test price: about EUR 142, which is conservative because it stays below the full model estimate.\n\nVisualizations to review:\nThe SHAP chart (a model explanation showing which feature pushed the price estimate up or down) shows why the model believes the listing can support a higher price. Positive drivers usually include location, capacity, and comparable neighbourhood pricing; negative drivers can include weaker review quality or host/listing signals.\n\nPossible limitations:\nThis is a pricing recommendation, not a guarantee of occupancy. A manager should raise price gradually, monitor conversion, and reverse course if bookings slow sharply.\n\nSources: XGBoost predictions, SHAP model explanations" },
]);

setScriptBlocks("host-revenue::What price change could improve my Athens listing revenue?", [
  { type: "text", text: "Direct recommendation:\nUse a measured price increase, not a blind jump. ARIA flags 2,945 Athens listings as underpriced, but the best action is to focus on listings where the gap is large enough to matter after model error and where the host can absorb a careful test.\n\nReasoning done by ARIA:\nFor a property manager, the goal is not simply to maximize nightly price. The goal is to improve revenue while protecting booking momentum. That is why ARIA recommends stepwise repricing rather than one sudden increase." },
  { type: "chart", chart: { kind: "shap", title: "Athens price drivers to check before repricing" } },
  { type: "text", text: "Key evidence:\n- Athens underpriced listings: 2,945.\n- Priority overlap: 865 listings are both underpriced and high-risk.\n- Practical repricing band: focus first on gaps around EUR 25-EUR 40, where the upside is easier to justify.\n\nVisualizations to review:\nUse the SHAP chart to understand which listing features are supporting or suppressing price. If quality, reviews, or booking momentum are weak, pricing should be paired with listing improvement rather than treated as a pure rate change.\n\nPossible limitations:\nARIA's current deployed path supports pricing and risk triage. It does not yet replace a full revenue-management experiment with live conversion and calendar data.\n\nSources: Athens underpricing outputs, ARIA risk scores, SHAP model explanations" },
]);

setScriptBlocks("market::Which Athens neighbourhoods offer the strongest short-term rental yield?", [
  { type: "text", text: "Direct recommendation:\nPangrati is the strongest first look for Athens short-term-rental yield. In the current scripted ARIA view, Pangrati leads with an 11.4% projected net yield (the expected return after basic short-term-rental operating assumptions), followed by Kypseli and Mets.\n\nReasoning done by ARIA:\nThe recommendation is not based only on tourist fame. ARIA is prioritizing areas where yield, saturation, and entry logic work together. A famous central tourist area can have high nightly prices but still produce weaker net yield if competition and regulatory pressure are too high." },
  { type: "chart", chart: SCRIPT_MAPS.athensYield },
  { type: "chart", chart: { kind: "yield", title: "Projected Athens short-term-rental yield" } },
  { type: "text", text: "Key evidence:\n- Pangrati: 11.4% projected net yield.\n- Kypseli: second-ranked yield signal.\n- Plaka/core tourist zones: attractive demand, but lower risk-adjusted yield in this scripted view.\n\nVisualizations to review:\nUse the map to place Pangrati, Kypseli, and Mets in the city context. Then use the yield chart to compare the numeric ranking. The map helps with location intuition; the chart explains why the recommendation is not simply the most famous tourist district.\n\nPossible limitations:\nYield depends on purchase price, renovation cost, licensing, financing, and actual booking execution. ARIA provides a shortlist, not a final acquisition decision.\n\nSources: neighbourhood stats, ARIA yield ranking" },
]);

setScriptBlocks("gentrification::Which Athens listings need attention first because they are high-risk and underpriced?", [
  { type: "text", text: "Direct recommendation:\nPrioritize the overlap group first: the 865 Athens listings that are both underpriced and high-risk. This is the strongest action queue because it combines revenue upside with operational warning signs.\n\nReasoning done by ARIA:\nAn underpriced listing may deserve a pricing test, but a high-risk listing may need coaching, quality review, or operational support first. Risk probability (the model's estimated chance that a listing belongs to a decline-risk group) helps decide where a human manager should look before simply raising price." },
  { type: "chart", chart: { ...SCRIPT_MAPS.athensRisk, title: "Athens priority map: high-risk and underpriced areas" } },
  { type: "chart", chart: { kind: "riskbar", title: "Athens risk concentration by neighbourhood" } },
  { type: "text", text: "Key evidence:\n- Priority overlap: 865 listings.\n- High-risk threshold: 70%.\n- The use case is host coaching and review, not automated enforcement.\n\nVisualizations to review:\nUse the map to see where intervention pressure is geographically concentrated. Then use the risk chart to compare which neighbourhoods should be reviewed first. Together, the visuals make the queue easier to explain to a non-technical service team.\n\nPossible limitations:\nRisk is a prioritization signal, not a final judgment about a host. ARIA should trigger review and coaching, not replace human assessment.\n\nSources: ARIA risk scores, Athens underpricing outputs" },
]);

setScriptBlocks("gentrification::Where is host risk highest in Athens?", [
  { type: "text", text: "Direct recommendation:\nCentral Athens needs the closest monitoring. The current scripted ARIA risk view flags 4,695 high-risk listings overall, with central neighbourhoods carrying the strongest concentration of warning signals.\n\nReasoning done by ARIA:\nHost risk is not a moral judgment. It is a triage signal that highlights listings where recent activity, quality, availability, or host profile patterns suggest a higher chance of decline or intervention need." },
  { type: "chart", chart: SCRIPT_MAPS.athensRisk },
  { type: "chart", chart: { kind: "riskbar", title: "Athens high-risk signal by neighbourhood" } },
  { type: "text", text: "Key evidence:\n- High-risk listings: 4,695.\n- Threshold: 70%.\n- Main interpretation: central areas need earlier review because risk signals are more concentrated there.\n\nVisualizations to review:\nUse the map to understand the spatial concentration of risk, then use the risk chart to compare neighbourhood priority. This is useful for managers because it turns model output into an operational review route.\n\nPossible limitations:\nThe risk score should guide analyst attention, not replace human judgment. It does not prove misconduct, churn, or regulatory breach by itself.\n\nSources: ARIA risk scores, neighbourhood stats" },
]);

setScriptBlocks("market::Compare Paris vs Athens for a small short-term rental portfolio.", [
  { type: "text", text: "Direct recommendation:\nUse Athens for targeted upside and Paris for scale. For a small portfolio, the best answer is not either/or: start with a focused Athens value-add thesis, then use selected Paris eastern arrondissements as the scale pathway once the operating model is proven.\n\nReasoning done by ARIA:\nParis is the larger and more liquid market, with 120,809 listings in the ARIA project view. Athens is smaller, with 14,242 listings, but it is easier to explain through specific pricing, yield, and host-risk opportunities. That makes Athens more practical for a first concentrated thesis, while Paris offers a larger expansion path." },
  { type: "chart", chart: { ...SCRIPT_MAPS.athensYield, title: "Athens map: targeted value-add thesis" } },
  { type: "chart", chart: { ...SCRIPT_MAPS.parisOpportunity, title: "Paris map: scale pathway" } },
  { type: "chart", chart: { kind: "yield", title: "Athens yield benchmark for targeted upside" } },
  { type: "text", text: "Key evidence:\n- Paris scale: 120,809 listings.\n- Athens depth: 14,242 listings with clearer value-add and risk-prioritization use cases.\n- Recommended portfolio logic: Athens first for focused yield; Paris next for selective scale.\n\nVisualizations to review:\nUse the two maps to compare the geographic logic: Athens supports concentrated neighbourhood selection, while Paris supports a corridor-style expansion view. Use the yield chart to understand why Athens is the first value-add test market.\n\nPossible limitations:\nThis is a short-term-rental portfolio framing, not a complete residential investment model. Final decisions still need purchase prices, licensing, financing, tax, and building-level checks.\n\nSources: neighbourhood stats, ARIA yield ranking, Paris supply-demand opportunity signal" },
]);

function registerAdvancedScript(oldAgentId, oldPrompt, newAgentId, newPrompt, brief, blocks) {
  const oldKey = `${oldAgentId}::${oldPrompt}`;
  const newKey = `${newAgentId}::${newPrompt}`;
  const base = SCRIPTS[oldKey];
  if (!base) return;
  SCRIPTS[newKey] = {
    ...base,
    trace: (base.trace || []).map((step) => ({ ...step })),
    blocks: [...(base.blocks || [])],
    brief: {
      ...(base.brief || {}),
      ...(brief || {}),
    },
  };
  setScriptBlocks(newKey, blocks);
}

registerAdvancedScript(
  "market",
  "Which Paris arrondissement is best for a new short-term rental investment?",
  "market",
  "For a KPMG client entering Paris, which arrondissement should be the first acquisition cluster and why?",
  {
    title: "Paris Acquisition Cluster Brief",
    kpis: [
      { label: "First cluster", value: "19th", note: "Strongest positive supply-demand gap in the Paris screen." },
      { label: "Runner-up", value: "20th", note: "Useful expansion area after validating the first cluster." },
      { label: "Scale path", value: "11th", note: "Secondary area with investable signal and operational adjacency." },
      { label: "Avoid first", value: "1st-4th", note: "Central districts look more saturated for new entry." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For a judge-facing KPMG client case, ARIA should recommend the 19th arrondissement as the first Paris acquisition cluster, then use the 20th and 11th as the next comparison set. The business use case is a disciplined market-entry screen: find areas with enough guest demand to support revenue, but not so much saturation that a new short-term-rental portfolio is forced into aggressive pricing from day one.\n\n" +
        "Reasoning done by ARIA:\n" +
        "The 19th has the strongest positive supply-demand gap in the Paris neighbourhood screen. A positive gap means demand-side signals are stronger than local supply pressure, so the area deserves earlier underwriting. The 20th is close behind and can be treated as a practical expansion corridor, while the 11th gives the client a more established inner-city comparison point. This framing lets the investor discuss both upside and execution risk instead of simply choosing the most famous arrondissement.\n\n" +
        "Key evidence:\n" +
        "- 19th arrondissement: strongest gap signal at +0.41, indicating the best relative entry balance.\n" +
        "- 20th arrondissement: second strongest gap at +0.37, useful for pipeline diversification.\n" +
        "- 11th arrondissement: positive gap at +0.22, but likely more competitive than the outer eastern clusters.\n" +
        "- 1st-4th arrondissements: negative gap around -0.28, suggesting central demand does not automatically translate into attractive new-entry economics.\n\n" +
        "Possible limitations:\n" +
        "This is a neighbourhood-level recommendation, not a purchase decision. The client still needs property-level revenue modelling, acquisition price checks, building restrictions, and Paris short-term-rental compliance review before committing capital.\n\n" +
        "Next actions:\n" +
        "Shortlist 5-10 properties in the 19th, compare them against nearby 20th arrondissement assets, and reject any target where licensing, building rules, renovation cost, or guest access weakens the expected return.\n\n" +
        "Sources: neighbourhood stats, ARIA supply-demand gap screen.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.parisOpportunity, title: "Paris map: first acquisition cluster and expansion corridor" } },
    { type: "chart", chart: { kind: "supplygap", title: "Paris acquisition screen: supply-demand gap by arrondissement" } },
  ]
);

registerAdvancedScript(
  "market",
  "Which Paris areas look saturated and should I avoid?",
  "market",
  "Where should a Paris short-term-rental investor avoid first because saturation or regulation could compress returns?",
  {
    title: "Paris Avoid-First Brief",
    kpis: [
      { label: "Avoid first", value: "1st-4th", note: "Negative supply-demand gap in the Paris screen." },
      { label: "Main pressure", value: "Saturation", note: "Demand exists, but competition can compress returns." },
      { label: "Better entry", value: "19th/20th", note: "Outer eastern clusters show stronger relative balance." },
      { label: "Use case", value: "Capital filter", note: "Use this view to reject crowded acquisition targets early." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For a new Paris short-term-rental portfolio, ARIA would avoid leading with the 1st-4th arrondissements unless the client has a specific premium asset, regulatory clarity, and a strong pricing advantage. The business use case is risk control: do not let prestige locations absorb capital before proving that the unit economics can survive saturation and compliance pressure.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Central Paris can look attractive because brand recognition and tourist demand are high. However, ARIA's neighbourhood screen flags these areas as more crowded relative to their incremental opportunity. A negative supply-demand gap means the client may face stronger competition, lower differentiation, and more demanding due diligence before a property can outperform.\n\n" +
        "Key evidence:\n" +
        "- 1st-4th arrondissements show a negative gap around -0.28, making them less attractive as a first acquisition cluster.\n" +
        "- The 19th and 20th show stronger positive signals, so they are better first-pass underwriting areas.\n" +
        "- Saturation risk matters because a high-demand location can still underperform if many similar listings compete for the same guest segment.\n\n" +
        "Possible limitations:\n" +
        "This does not mean central Paris is uninvestable. It means central assets need a stronger justification: unique location, premium design, legal eligibility, superior reviews, or a price that compensates for the competitive pressure.\n\n" +
        "Next actions:\n" +
        "Use the map as an exclusion layer. Flag central Paris targets for enhanced legal and financial review, and only advance them if the asset-level model beats the eastern Paris benchmark.\n\n" +
        "Sources: neighbourhood stats, ARIA supply-demand gap screen.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.parisSaturation, title: "Paris map: saturation pressure and avoid-first zones" } },
    { type: "chart", chart: { kind: "supplygap", title: "Paris supply-demand gap: attractive versus compressed areas" } },
  ]
);

registerAdvancedScript(
  "host-revenue",
  "Is my Paris listing underpriced compared with similar listings?",
  "host-revenue",
  "For a Paris host, what pricing move would recover revenue without damaging bookings?",
  {
    title: "Paris Host Pricing Action Brief",
    kpis: [
      { label: "Current price", value: "EUR 118", note: "Observed nightly price for the listing in the script." },
      { label: "Fair value", value: "EUR 147", note: "XGBoost comparable-listing price estimate." },
      { label: "Test price", value: "EUR 142", note: "Conservative first move rather than jumping to full fair value." },
      { label: "Revenue upside", value: "+EUR 6.4k", note: "Estimated annual improvement if demand holds." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For a Paris host, ARIA recommends moving from EUR 118 to a controlled test price around EUR 142 per night, rather than immediately jumping to the full model estimate of EUR 147. The business use case is revenue recovery with booking-risk discipline: capture underpricing upside while watching conversion, occupancy, and reviews.\n\n" +
        "Reasoning done by ARIA:\n" +
        "The XGBoost pricing model compares the listing with similar properties and estimates that the current price is materially below market. A direct increase to EUR 147 may be justified statistically, but a phased move is easier for a non-technical host to manage because it creates a clean test-and-learn window. If bookings remain stable, the host can continue toward the fair-value estimate.\n\n" +
        "Key evidence:\n" +
        "- Current nightly price: EUR 118.\n" +
        "- Model fair-value estimate: EUR 147.\n" +
        "- Recommended first test: EUR 142.\n" +
        "- Estimated annual upside: about EUR 6,400 if demand remains resilient.\n\n" +
        "Possible limitations:\n" +
        "The model does not replace calendar management. The host should check seasonality, event dates, cancellation patterns, minimum-stay settings, and competitor prices before making the change permanent.\n\n" +
        "Next actions:\n" +
        "Run the EUR 142 price for two weeks, compare booking pace against the previous period, and use the SHAP explanation to confirm which listing features justify the premium.\n\n" +
        "Sources: XGBoost predictions, SHAP explanations, neighbourhood stats.",
    },
    { type: "chart", chart: { kind: "pricing", title: "Paris pricing decision: current, test price, and model fair value" } },
    { type: "chart", chart: { kind: "shap", title: "Why the model supports a price increase" } },
  ]
);

registerAdvancedScript(
  "host-revenue",
  "What price change could improve my Athens listing revenue?",
  "host-revenue",
  "For an Athens property manager, which repricing actions unlock revenue while controlling listing risk?",
  {
    title: "Athens Manager Repricing Brief",
    kpis: [
      { label: "Underpriced", value: "2,945", note: "Listings flagged as priced below model-supported value." },
      { label: "Priority overlap", value: "865", note: "Listings that are both underpriced and high-risk." },
      { label: "Test band", value: "EUR 25-40", note: "Practical first increase range for selected listings." },
      { label: "Guardrail", value: "Risk review", note: "Do not raise prices before fixing quality or trust issues." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For an Athens property manager, ARIA recommends prioritising repricing on the 865 listings that are both underpriced and high-risk, but only after checking whether the risk signal is fixable. The business use case is operational triage: recover revenue where the price gap is real, while avoiding a price increase on listings that first need quality, host, or trust improvements.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Athens has 2,945 listings flagged as underpriced, which is too broad for a manager to action manually. The overlap with high-risk listings creates a sharper work queue. Some listings may be cheap because they have poor guest signals; others may be genuinely under-monetised. ARIA separates those cases so managers can decide whether to reprice, repair, or pause acquisition interest.\n\n" +
        "Key evidence:\n" +
        "- Underpriced listings: 2,945.\n" +
        "- High-risk and underpriced overlap: 865.\n" +
        "- Recommended first action: test EUR 25-40 increases only on listings with fixable risk drivers.\n" +
        "- Risk guardrail: review ratings, cancellations, amenities, and host responsiveness before changing price.\n\n" +
        "Possible limitations:\n" +
        "A listing can be underpriced for a valid reason. If the risk model is driven by poor reviews, weak amenities, or operational issues, price should not be the first lever.\n\n" +
        "Next actions:\n" +
        "Segment the 865-listing queue into reprice-now, fix-first, and exclude groups. Then monitor conversion after each pricing change.\n\n" +
        "Sources: XGBoost predictions, LightGBM risk scores, neighbourhood stats.",
    },
    { type: "chart", chart: { kind: "pricing", title: "Athens repricing decision: model-supported price gap" } },
    { type: "chart", chart: { ...SCRIPT_MAPS.athensRisk, title: "Athens map: high-risk underpriced intervention areas" } },
    { type: "chart", chart: { kind: "riskbar", title: "Athens risk concentration by neighbourhood" } },
  ]
);

registerAdvancedScript(
  "market",
  "Which Athens neighbourhoods offer the strongest short-term rental yield?",
  "market",
  "Which Athens neighbourhoods should an investor underwrite first for yield and why?",
  {
    title: "Athens Yield Underwriting Brief",
    kpis: [
      { label: "Lead area", value: "Pangrati", note: "Highest yield in the scripted Athens screen." },
      { label: "Yield", value: "11.4%", note: "Modelled short-term-rental yield signal." },
      { label: "Runner-up", value: "Kypseli", note: "Second strongest yield signal at 10.6%." },
      { label: "Third option", value: "Mets", note: "Useful comparison area at 9.8%." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For an Athens investor, ARIA recommends underwriting Pangrati first, with Kypseli and Mets as the next two comparison areas. The business use case is a yield-led acquisition funnel: identify neighbourhoods where expected rental performance is strong enough to justify deeper property-level due diligence.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Pangrati ranks highest in the scripted yield screen at 11.4%, suggesting the most attractive balance between rental revenue and local investment cost. Kypseli follows at 10.6%, while Mets sits at 9.8%. A professional investor should not treat this as a final buy list; it is a prioritised underwriting sequence that helps focus analyst time on the strongest areas first.\n\n" +
        "Key evidence:\n" +
        "- Pangrati yield: 11.4%.\n" +
        "- Kypseli yield: 10.6%.\n" +
        "- Mets yield: 9.8%.\n" +
        "- Plaka yield: 7.1%, which may reflect stronger acquisition pressure in a famous central area.\n\n" +
        "Possible limitations:\n" +
        "Yield screens depend on acquisition price assumptions and average rental performance. The client still needs building-level checks, renovation estimates, seasonality review, and legal feasibility checks.\n\n" +
        "Next actions:\n" +
        "Use the map to form a Pangrati-first search area, then compare candidate apartments against Kypseli and Mets to avoid overpaying for a single neighbourhood story.\n\n" +
        "Sources: neighbourhood stats, ARIA yield screen.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.athensYield, title: "Athens map: yield-led underwriting clusters" } },
    { type: "chart", chart: { kind: "yield", title: "Athens yield ranking: first-pass acquisition areas" } },
  ]
);

SCRIPTS["demand::Which Athens neighbourhoods should an investor underwrite first for yield and why?"] =
  SCRIPTS["market::Which Athens neighbourhoods should an investor underwrite first for yield and why?"];

registerAdvancedScript(
  "gentrification",
  "Which Athens listings need attention first because they are high-risk and underpriced?",
  "gentrification",
  "Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?",
  {
    title: "Athens Intervention Queue Brief",
    kpis: [
      { label: "Priority overlap", value: "865", note: "Listings that are both high-risk and underpriced." },
      { label: "High-risk base", value: "4,695", note: "Listings above the risk threshold." },
      { label: "Risk cutoff", value: "70%", note: "Operational threshold used for this triage." },
      { label: "Use case", value: "Coach first", note: "Find listings that need intervention before pricing action." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "The highest-priority Athens intervention queue is the 865 listings that are both high-risk and underpriced. The business use case is manager triage: these listings may look like revenue opportunities, but they also carry execution risk, so ARIA should route them to review before recommending a price increase or acquisition decision.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Underpricing alone can signal upside. High risk alone can signal an operational problem. The overlap is where management attention matters most because the listing may either be a turnaround opportunity or a value trap. ARIA uses the combined view to help a non-technical manager decide which assets deserve immediate human review.\n\n" +
        "Key evidence:\n" +
        "- High-risk listings in Athens: 4,695.\n" +
        "- High-risk threshold: 70%.\n" +
        "- High-risk and underpriced overlap: 865 listings.\n" +
        "- Highest neighbourhood risk concentrations include Koukaki, Exarchia, and Plaka.\n\n" +
        "Possible limitations:\n" +
        "The risk score is a prioritisation tool, not a legal or operational diagnosis. The team still needs listing-level review to understand whether risk is caused by quality, location, host behaviour, guest mix, or data sparsity.\n\n" +
        "Next actions:\n" +
        "Create a three-bucket action list: reprice-now if risk is low or fixable, fix-first if quality issues are visible, and exclude if the risk signal cannot be mitigated.\n\n" +
        "Sources: LightGBM risk scores, XGBoost predictions, neighbourhood stats.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.athensRisk, title: "Athens map: high-risk and underpriced priority queue" } },
    { type: "chart", chart: { kind: "riskbar", title: "Athens priority queue: risk concentration by neighbourhood" } },
  ]
);

SCRIPTS["crime::Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?"] =
  SCRIPTS["gentrification::Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?"];

registerAdvancedScript(
  "gentrification",
  "Where is host risk highest in Athens?",
  "gentrification",
  "Where should an Athens operations team deploy host-support resources first?",
  {
    title: "Athens Host-Support Deployment Brief",
    kpis: [
      { label: "Lead risk area", value: "Koukaki", note: "Highest risk concentration in the scripted view." },
      { label: "Risk signal", value: "84%", note: "Neighbourhood-level concentration score." },
      { label: "Second area", value: "Exarchia", note: "Second-highest signal at 76%." },
      { label: "Use case", value: "Field ops", note: "Prioritise coaching, quality checks, and listing audits." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "An Athens operations team should deploy host-support resources first in Koukaki, then Exarchia and Plaka. The business use case is operational risk reduction: focus coaching, listing audits, and quality checks where the risk concentration is highest before those issues become revenue or reputation problems.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Koukaki shows the highest risk concentration at 84%, followed by Exarchia at 76% and Plaka at 71%. These scores point to neighbourhoods where listings may need closer review of guest experience, pricing discipline, host responsiveness, or operational consistency. For a non-technical manager, the map turns model output into a field-service plan.\n\n" +
        "Key evidence:\n" +
        "- Koukaki risk concentration: 84%.\n" +
        "- Exarchia risk concentration: 76%.\n" +
        "- Plaka risk concentration: 71%.\n" +
        "- Pangrati is lower at 58%, making it less urgent for the first support wave.\n\n" +
        "Possible limitations:\n" +
        "Risk concentration does not identify the root cause by itself. The team should inspect listing pages, review text, cancellations, amenities, and response behaviour before assigning a final action.\n\n" +
        "Next actions:\n" +
        "Build a weekly field-ops queue by neighbourhood, audit the top listings in Koukaki first, and track whether interventions reduce future risk scores.\n\n" +
        "Sources: LightGBM risk scores, neighbourhood stats.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.athensRisk, title: "Athens map: host-support deployment priorities" } },
    { type: "chart", chart: { kind: "riskbar", title: "Athens host risk concentration by neighbourhood" } },
  ]
);

SCRIPTS["crime::Where should an Athens operations team deploy host-support resources first?"] =
  SCRIPTS["gentrification::Where should an Athens operations team deploy host-support resources first?"];

registerAdvancedScript(
  "market",
  "Compare Paris vs Athens for a small short-term rental portfolio.",
  "market",
  "Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?",
  {
    title: "Paris-Athens Portfolio Sequencing Brief",
    kpis: [
      { label: "Recommended path", value: "Athens first", note: "Use Athens for yield-led proof of concept." },
      { label: "Scale option", value: "Paris second", note: "Use Paris after validating acquisition and compliance playbook." },
      { label: "Paris listings", value: "120,809", note: "Large market, but more competitive." },
      { label: "Athens listings", value: "14,242", note: "Smaller market with clearer entry focus." },
    ],
  },
  [
    {
      type: "text",
      text:
        "Direct recommendation:\n" +
        "For a small KPMG short-term-rental portfolio, ARIA recommends a phased strategy: launch the proof of concept in Athens, then use Paris as the scale market once the acquisition, compliance, pricing, and operations playbook is proven. The business use case is capital sequencing: start where the team can learn faster, then expand into the larger but more complex market.\n\n" +
        "Reasoning done by ARIA:\n" +
        "Athens offers a smaller and more focused operating environment, with 14,242 listings in the project data compared with 120,809 in Paris. Paris is strategically important because of its market depth, but that scale also means stronger competition and more demanding compliance review. A phased plan lets the client demonstrate returns, refine operating controls, and then approach Paris with a more credible execution model.\n\n" +
        "Key evidence:\n" +
        "- Paris listings reviewed: 120,809, indicating depth and liquidity but also intense competition.\n" +
        "- Athens listings reviewed: 14,242, making it more manageable for a first operating test.\n" +
        "- Athens yield and risk maps provide clearer first-wave neighbourhood actions.\n" +
        "- Paris remains valuable as a second-stage market for scale and institutional relevance.\n\n" +
        "Possible limitations:\n" +
        "This recommendation is for a small portfolio. A large investor with significant capital, local Paris expertise, and a compliance-ready acquisition pipeline may rationally prioritise Paris first.\n\n" +
        "Next actions:\n" +
        "Define a 90-day Athens pilot, set acquisition and pricing guardrails, then prepare a Paris market-entry checklist focused on the 19th, 20th, and 11th arrondissements.\n\n" +
        "Sources: neighbourhood stats, ARIA yield screen, ARIA supply-demand gap screen.",
    },
    { type: "chart", chart: { ...SCRIPT_MAPS.athensYield, title: "Athens map: proof-of-concept yield clusters" } },
    { type: "chart", chart: { ...SCRIPT_MAPS.parisOpportunity, title: "Paris map: second-stage scale clusters" } },
    { type: "chart", chart: { kind: "marketCompare", title: "Portfolio sequencing: Athens proof of concept versus Paris scale" } },
  ]
);

SCRIPTS["demand::Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?"] =
  SCRIPTS["market::Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?"];

/* Generic fallback for free-form / unscripted prompts */
function genericScript(agent, prompt) {
  return {
    trace: [
      T("Orchestrator", `routing to ${agent.name}`),
      T("Retrieval Agent", "querying 135,051-listing master dataset"),
      T("Analysis Agent", "applying XGBoost / LightGBM / SHAP"),
      T("Orchestrator", "composing answer"),
    ],
    blocks: [
      { type: "text", text: `Working from the ARIA master dataset (**135,051 listings × 96 columns** — Paris 120,809, Athens 14,242), here's how **${agent.name}** reads your question.\n\nFor custom prompts, ARIA routes through the server-side Vertex AI backend and live GitHub project data when Vercel authentication is configured. Pick one of the suggested prompts for a polished scripted analysis, or type your own question for a grounded live response with KPIs, a chart, and expandable sources.` },
    ],
    brief: { title: `${agent.name} — Analysis`, kpis: [
      { label: "Master dataset", value: "135,051" }, { label: "Paris", value: "120,809" },
      { label: "Athens", value: "14,242" }, { label: "Columns", value: "96" },
    ]},
  };
}

function getScript(agentId, prompt) {
  return SCRIPTS[`${agentId}::${prompt}`] || null;
}

/* ---------- Seeded conversation history ---------- */
const SEED_CONVERSATIONS = [
  { id: "c1", agentId: "host-revenue", title: "Paris pricing recovery", group: "Today",
    prompt: "For a Paris host, what pricing move would recover revenue without damaging bookings?" },
  { id: "c2", agentId: "host-revenue", title: "Athens repricing triage", group: "Today",
    prompt: "For an Athens property manager, which repricing actions unlock revenue while controlling listing risk?" },
  { id: "c3", agentId: "market", title: "Paris acquisition cluster", group: "Today",
    prompt: "For a KPMG client entering Paris, which arrondissement should be the first acquisition cluster and why?" },
  { id: "c4", agentId: "market", title: "Paris avoid-first zones", group: "Yesterday",
    prompt: "Where should a Paris short-term-rental investor avoid first because saturation or regulation could compress returns?" },
  { id: "c5", agentId: "market", title: "Athens yield underwriting", group: "Yesterday",
    prompt: "Which Athens neighbourhoods should an investor underwrite first for yield and why?" },
  { id: "c6", agentId: "gentrification", title: "Athens intervention queue", group: "Previous 7 days",
    prompt: "Which Athens listings form the highest-priority intervention queue: high-risk, underpriced, or both?" },
  { id: "c7", agentId: "gentrification", title: "Athens field-ops deployment", group: "Previous 7 days",
    prompt: "Where should an Athens operations team deploy host-support resources first?" },
  { id: "c8", agentId: "market", title: "Paris-Athens sequencing", group: "Previous 7 days",
    prompt: "Should a small KPMG short-term-rental portfolio launch in Athens, Paris, or a phased strategy across both?" },
];

/* ---------- Theme palettes ----------
   airbnb = Light (default) · kpmgLight = Ocean (KPMG navy blue) · dark = Dark (near-black)
   Each palette is self-contained incl. brand accent + primary-CTA tokens. */
const PALETTES = {
  airbnb: {
    label: "Light", icon: "Sun",
    canvas: "#ffffff", s1: "#f7f7f7", s2: "#f2f2f2", hair: "#dddddd", hairSoft: "#ebebeb",
    ink: "#222222", inkSoft: "#3f3f3f", muted: "#6a6a6a", success: "#16a34a", scrollThumb: "#cfcfcf",
    accent: "#ff385c", accentActive: "#e00b41",        // Rausch
    cta: "#ff385c", ctaText: "#ffffff",                // primary buttons = Rausch fill
    violet: "#6a4cf5", magenta: "#d44df0", orange: "#ff7a3d", coral: "#ff5577", teal: "#1fd1c7",
    font: "'Inter','Airbnb Cereal VF',Circular,system-ui,sans-serif",
  },
  dark: {
    label: "Dark", icon: "Moon",
    canvas: "#090909", s1: "#141414", s2: "#1c1c1c", hair: "#262626", hairSoft: "#1a1a1a",
    ink: "#ffffff", inkSoft: "#ededed", muted: "#999999", success: "#22c55e", scrollThumb: "#2a2a2a",
    accent: "#0099ff", accentActive: "#33adff",
    cta: "#ffffff", ctaText: "#000000",                // neutral white pill
    violet: "#6a4cf5", magenta: "#d44df0", orange: "#ff7a3d", coral: "#ff5577", teal: "#1fd1c7",
    font: "'Inter',system-ui,sans-serif",
  },
  kpmg: {
    label: "KPMG Dark", icon: "MoonStar",
    canvas: "#0a0e1a", s1: "#111726", s2: "#1a2236", hair: "#283250", hairSoft: "#161d2e",
    ink: "#ffffff", inkSoft: "#e8ecf6", muted: "#97a3c0", success: "#00a3a1", scrollThumb: "#283250",
    accent: "#0091da", accentActive: "#33adff",        // KPMG light blue (pops on navy)
    cta: "#005eb8", ctaText: "#ffffff",                // KPMG medium blue fill
    violet: "#00338d", magenta: "#005eb8", orange: "#0091da", coral: "#6d2077", teal: "#00a3a1",
    font: "'Inter',system-ui,sans-serif",
  },
  kpmgLight: {
    label: "Ocean", icon: "Waves",
    canvas: "#ffffff", s1: "#f4f7fc", s2: "#e9f0f9", hair: "#d3deee", hairSoft: "#e8eef7",
    ink: "#0a1f44", inkSoft: "#2b3a57", muted: "#5d6b86", success: "#00a3a1", scrollThumb: "#cdd9ea",
    accent: "#00338d", accentActive: "#005eb8",        // KPMG Blue / Medium Blue
    cta: "#00338d", ctaText: "#ffffff",                // KPMG Blue fill
    violet: "#00338d", magenta: "#005eb8", orange: "#0091da", coral: "#6d2077", teal: "#00a3a1",
    agentAccents: {
      "host-revenue": "#00338d",
      gentrification: "#005eb8",
      crime: "#470a68",
      demand: "#0091da",
      market: "#00a3a1",
    },
    font: "'Inter',system-ui,sans-serif",
  },
};

function applyTheme(mode) {
  const p = PALETTES[mode] || PALETTES.airbnb;
  Object.assign(ARIA.c, p);
  ARIA.c.blue = p.accent; // default accent (Tweak "brand" follows this; explicit hex overrides)
  AGENTS.forEach((agent) => {
    agent.accent = (p.agentAccents && p.agentAccents[agent.id]) || DEFAULT_AGENT_ACCENTS[agent.id];
  });
  const r = document.documentElement.style;
  r.setProperty("--canvas", p.canvas);
  r.setProperty("--surface-1", p.s1);
  r.setProperty("--surface-2", p.s2);
  r.setProperty("--hairline", p.hair);
  r.setProperty("--hairline-soft", p.hairSoft);
  r.setProperty("--ink", p.ink);
  r.setProperty("--ink-muted", p.muted);
  r.setProperty("--accent-blue", p.accent);
  r.setProperty("--cta", p.cta);
  r.setProperty("--cta-text", p.ctaText);
  r.setProperty("--grad-violet", p.violet);
  r.setProperty("--grad-magenta", p.magenta);
  r.setProperty("--grad-orange", p.orange);
  r.setProperty("--grad-coral", p.coral);
  r.setProperty("--grad-teal", p.teal);
  r.setProperty("--scroll-thumb", p.scrollThumb);
  document.documentElement.dataset.theme = mode;
  document.body && (document.body.style.fontFamily = p.font);
}

Object.assign(window, {
  ARIA, AGENTS, AGENT_BY_ID, MODELS, MODEL_BY_ID,
  SCRIPTS, getScript, genericScript, resolveAgentRoute, SEED_CONVERSATIONS, PALETTES, applyTheme,
});
