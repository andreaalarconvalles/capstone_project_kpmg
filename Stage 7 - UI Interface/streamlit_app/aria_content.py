"""
ARIA — content layer (agents, models, scripted demo conversations, chart datasets,
seeded conversation history).  Ported 1:1 from the React design prototype
(aria-data.jsx + aria-charts.jsx) so the Streamlit build stays faithful to the mockup.

ARIA = Airbnb Revenue Intelligence & Analytics  ·  IE Business School × KPMG Spain — Capstone 2026
"""

# ---------------------------------------------------------------------------
# Framer dark design-system tokens (binding visual reference)
# ---------------------------------------------------------------------------
C = {
    "canvas": "#090909", "s1": "#141414", "s2": "#1c1c1c",
    "hair": "#262626", "hair_soft": "#1a1a1a",
    "ink": "#ffffff", "muted": "#999999", "blue": "#0099ff",
    "violet": "#6a4cf5", "magenta": "#d44df0", "orange": "#ff7a3d",
    "coral": "#ff5577", "teal": "#1fd1c7", "success": "#22c55e",
}

# ---------------------------------------------------------------------------
# The 5 KPMG agents (each carries one gradient accent as its identity)
# ---------------------------------------------------------------------------
AGENTS = [
    {
        "id": "host-revenue", "name": "Host Revenue Intelligence",
        "tagline": "Your personal revenue manager", "emoji": "💶", "accent": C["violet"],
        "chips": [
            "Why is my listing underpriced vs the neighbourhood?",
            "Forecast my occupancy for the next 90 days",
            "Rewrite my listing description to convert better",
            "Simulate revenue: current vs recommended pricing",
        ],
    },
    {
        "id": "gentrification", "name": "Gentrification Early Warning",
        "tagline": "Displacement risk 12–24 months ahead", "emoji": "🏘️", "accent": C["magenta"],
        "chips": [
            "Which Athens neighbourhoods show displacement risk in the next 12 months?",
            "Show STR density growth by dist_zone",
            "Draft a policy brief for the city housing department",
            "What intervention thresholds should Paris adopt?",
        ],
    },
    {
        "id": "crime", "name": "STR Financial Crime Detection",
        "tagline": "AML anomaly & SAR intelligence", "emoji": "🕵️", "accent": C["coral"],
        "chips": [
            "Flag listings with ghost-listing patterns in Paris",
            "Show the top AML risk scores with SHAP explanations",
            "Any circular booking network signals?",
            "Draft a SAR for listing #48213",
        ],
    },
    {
        "id": "demand", "name": "Tourism Demand Forecast",
        "tagline": "Infrastructure load intelligence", "emoji": "🚇", "accent": C["orange"],
        "chips": [
            "Forecast tourist-nights in central Athens for peak season",
            "Which districts hit infrastructure stress in August?",
            "Translate occupancy into waste & transit load",
            "Run high/base/low scenario for summer 2026",
        ],
    },
    {
        "id": "market", "name": "Market Entry Advisor",
        "tagline": "Site selection & ROI intelligence", "emoji": "🏗️", "accent": C["teal"],
        "chips": [
            "Which Paris arrondissements are supply-constrained?",
            "Rank Athens neighbourhoods by projected STR yield",
            "Where is regulatory risk too high to build?",
            "Compare Paris vs Athens for a 50-unit portfolio",
        ],
    },
]
AGENT_BY_ID = {a["id"]: a for a in AGENTS}

# ---------------------------------------------------------------------------
# Model picker — Vertex/Gemini models + ARIA ML analysis engines
# ---------------------------------------------------------------------------
MODELS = [
    {"group": "AI Models", "items": [
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "desc": "Deep analysis", "default": True, "ml": False},
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "desc": "Fast responses", "ml": False},
    ]},
    {"group": "ARIA Analysis Engines", "badge": "ML", "items": [
        {"id": "xgboost-pricing-v1", "name": "XGBoost Pricing v1", "desc": "Price prediction · Paris + Athens", "ml": True, "chip": "XGBoost Pricing"},
        {"id": "lightgbm-risk-v1", "name": "LightGBM Risk v1", "desc": "Underpricing risk · Athens", "ml": True, "chip": "LightGBM Risk"},
        {"id": "prophet-forecast", "name": "Prophet Forecast", "desc": "Occupancy 30/90d", "ml": True, "chip": "Prophet Forecast"},
    ]},
]
MODEL_BY_ID = {m["id"]: m for g in MODELS for m in g["items"]}


def _t(node, detail):
    return {"node": node, "detail": detail}


# ---------------------------------------------------------------------------
# Scripted demo conversations.  key = f"{agent_id}::{prompt}"
#   trace  : LangGraph-style reasoning steps
#   blocks : ordered list of {"type": "text"|"chart"|"map", ...}
#   brief  : one-page PDF brief (title + KPIs)
# ---------------------------------------------------------------------------
SCRIPTS = {
    # ===================== HOST REVENUE =====================
    "host-revenue::Why is my listing underpriced vs the neighbourhood?": {
        "trace": [
            _t("Orchestrator", "routing to Host Revenue Intelligence"),
            _t("Pricing Agent", "loading XGBoost Pricing v1 · 23 comparables in dist_zone=centre"),
            _t("SHAP Explainer", "attributing top price drivers"),
            _t("Demand Agent", "cross-checking 90-day occupancy"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Your listing is priced at **€118/night**, but XGBoost Pricing v1 predicts a fair market value of **€147/night** for a comparable unit in `dist_zone=centre`. That's an **underpricing gap of €29 (+24.6%)** versus 23 nearby comparables with similar `accommodates` and `review_scores_rating`."},
            {"type": "chart", "chart": {"kind": "shap", "title": "Top SHAP drivers of predicted price_eur"}},
            {"type": "text", "text": "The model attributes most of the gap to three features: your central `dist_zone` (+€21 SHAP value) and `accommodates=4` (+€13) push fair value **up**, while a below-median `review_scores_rating` of 4.62 and short `host_tenure_days` pull it slightly **down**. None of these justify the current discount — you're leaving margin on the table, not pricing for risk."},
            {"type": "text", "text": "**Recommendation:** lift base price to **€142** (a conservative 96% of predicted) and enable a weekend uplift. Estimated annual impact at your current 71% occupancy: **+€6,400/yr**. Want me to export a one-page pricing brief?"},
        ],
        "brief": {"title": "Pricing Brief — Listing underpricing analysis", "kpis": [
            {"label": "Current price", "value": "€118"}, {"label": "Fair value (XGBoost)", "value": "€147"},
            {"label": "Underpricing gap", "value": "+€29 · 24.6%"}, {"label": "Est. annual uplift", "value": "+€6,400"},
        ]},
    },
    "host-revenue::Simulate revenue: current vs recommended pricing": {
        "trace": [
            _t("Orchestrator", "routing to Host Revenue Intelligence"),
            _t("Pricing Agent", "XGBoost Pricing v1 · scenario grid"),
            _t("Demand Agent", "Prophet occupancy elasticity 30/90d"),
            _t("Orchestrator", "running revenue simulation"),
        ],
        "blocks": [
            {"type": "text", "text": "I simulated 12 months of revenue under your **current €118** flat rate versus the **recommended €142 base** with dynamic weekend pricing, holding the Prophet-forecast occupancy curve constant and applying a modest demand elasticity."},
            {"type": "chart", "chart": {"kind": "revsim", "title": "Monthly revenue — current vs recommended (€)"}},
            {"type": "text", "text": "Recommended pricing wins in every month, with the spread widening across the **Jun–Sep** peak where central-Paris demand is least price-sensitive. Cumulative gross revenue rises from **€30,600** to **€37,000** — a **+€6,400 (+20.9%)** uplift — while occupancy dips only 2.3pts, well inside the elasticity band. The trade is clearly favourable. I can export this as a PDF brief for your records."},
        ],
        "brief": {"title": "Revenue Simulation Brief", "kpis": [
            {"label": "Current (12mo)", "value": "€30,600"}, {"label": "Recommended (12mo)", "value": "€37,000"},
            {"label": "Net uplift", "value": "+€6,400 · 20.9%"}, {"label": "Occupancy delta", "value": "−2.3 pts"},
        ]},
    },

    # ===================== GENTRIFICATION =====================
    "gentrification::Which Athens neighbourhoods show displacement risk in the next 12 months?": {
        "trace": [
            _t("Orchestrator", "routing to Gentrification Early Warning"),
            _t("Density Agent", "STR density Δ across neighbourhood_stats"),
            _t("Risk Model", "LightGBM Risk v1 · 12-month displacement score"),
            _t("Geo Agent", "rendering choropleth"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Across the **14,242 Athens listings**, three central neighbourhoods cross the early-warning threshold (displacement risk score **> 0.70**) on a 12-month horizon. The signal is driven by accelerating STR density in `dist_zone=centre` combined with rising median `price_eur` and falling long-let supply."},
            {"type": "map", "map": {"city": "Athens", "title": "Displacement risk by neighbourhood", "metric": "risk"}},
            {"type": "chart", "chart": {"kind": "riskbar", "title": "12-month displacement risk score"}},
            {"type": "text", "text": "**Koukaki (0.84)** is the sharpest mover — STR density up 31% year-on-year with a 19% `price_eur` increase. **Exarchia (0.76)** and **Plaka (0.71)** follow. By contrast, outer zones like Kypseli stay below 0.45. These three account for **62% of net new entire-home listings** in the period — the classic precursor to resident displacement. I'd recommend monitoring at monthly cadence and can draft a policy brief for the housing department."},
        ],
        "brief": {"title": "Displacement Early-Warning Brief — Athens", "kpis": [
            {"label": "Neighbourhoods > 0.70", "value": "3"}, {"label": "Top risk: Koukaki", "value": "0.84"},
            {"label": "STR density Δ (Koukaki)", "value": "+31% YoY"}, {"label": "Net new entire-homes", "value": "62% in 3 areas"},
        ]},
    },
    "gentrification::Show STR density growth by dist_zone": {
        "trace": [
            _t("Orchestrator", "routing to Gentrification Early Warning"),
            _t("Density Agent", "aggregating listings by dist_zone"),
            _t("Trend Agent", "fitting 24-month density trend"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Here's STR density growth indexed across the four `dist_zone` bands (centre / mid / outer / far) over the trailing 24 months, normalised to listings per 1,000 dwellings."},
            {"type": "chart", "chart": {"kind": "trend", "title": "STR density index by dist_zone (24mo)"}},
            {"type": "text", "text": "Growth is heavily concentrated: **`centre` density rose 28%** while **`far` was essentially flat (+3%)**. The `mid` zone (+16%) is the one to watch — it shows the steepest *second-derivative*, meaning displacement pressure is now migrating outward from the saturated core. This spatial diffusion pattern is the same one that preceded displacement in Plaka two years ago. Intervention thresholds should therefore be zone-specific rather than city-wide."},
        ],
        "brief": {"title": "STR Density Trend Brief — Athens by dist_zone", "kpis": [
            {"label": "Centre growth (24mo)", "value": "+28%"}, {"label": "Mid growth", "value": "+16%"},
            {"label": "Far growth", "value": "+3%"}, {"label": "Diffusion signal", "value": "Centre → Mid"},
        ]},
    },

    # ===================== CRIME =====================
    "crime::Show the top AML risk scores with SHAP explanations": {
        "trace": [
            _t("Orchestrator", "routing to STR Financial Crime Detection"),
            _t("Anomaly Agent", "Isolation Forest scoring 120,809 Paris listings"),
            _t("SHAP Explainer", "explaining top anomalies"),
            _t("AML Agent", "mapping to typologies"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Isolation Forest flagged **47 Paris listings** above the AML risk threshold (anomaly score **> 0.80**). Here are the five highest, with SHAP attributions tying each score to concrete features rather than a black-box flag."},
            {"type": "chart", "chart": {"kind": "anomaly", "title": "Top AML anomaly scores · Paris"}},
            {"type": "text", "text": "Listing **#48213 (0.94)** dominates: SHAP attributes the score to an implausible `host_tenure_days=11` paired with 9 active listings, near-zero `review_scores_rating` despite 140 bookings, and `price_eur` 3.2× the `dist_zone` median — a textbook **ghost-listing / layering** signature. Three of the five share a payment-cluster fingerprint suggesting a common controller. These warrant a Suspicious Activity Report. I can draft a SAR for #48213 on request."},
        ],
        "brief": {"title": "AML Anomaly Brief — Paris", "kpis": [
            {"label": "Listings > 0.80", "value": "47"}, {"label": "Top score: #48213", "value": "0.94"},
            {"label": "Shared payment cluster", "value": "3 of 5"}, {"label": "Typology", "value": "Ghost-listing / layering"},
        ]},
    },
    "crime::Draft a SAR for listing #48213": {
        "trace": [
            _t("Orchestrator", "routing to STR Financial Crime Detection"),
            _t("Anomaly Agent", "retrieving #48213 feature vector"),
            _t("AML Agent", "matching FATF typologies"),
            _t("Drafting Agent", "composing SAR narrative"),
        ],
        "blocks": [
            {"type": "text", "text": "**DRAFT — Suspicious Activity Report**\n\n**Subject:** Listing #48213 (entire home, `dist_zone=centre`, Paris). **Filing basis:** automated AML anomaly score **0.94** (Isolation Forest), SHAP-explained."},
            {"type": "chart", "chart": {"kind": "riskdist", "title": "#48213 vs population risk distribution"}},
            {"type": "text", "text": "**Narrative:** The account exhibits behaviour inconsistent with legitimate short-term letting. Within 11 days of registration (`host_tenure_days=11`) the host operated 9 simultaneous listings priced at 3.2× the neighbourhood median, recording 140 bookings yet near-zero `review_scores_rating` — a pattern consistent with **placement and layering of illicit funds** through fictitious occupancy. Payment metadata links the account to two further flagged listings under distinct identities. **Recommended action:** freeze payouts pending review and escalate to the FIU. *This is an AI-generated draft for analyst review and must be validated before filing.*"},
        ],
        "brief": {"title": "Suspicious Activity Report (DRAFT) — #48213", "kpis": [
            {"label": "Anomaly score", "value": "0.94"}, {"label": "host_tenure_days", "value": "11"},
            {"label": "Linked listings", "value": "2"}, {"label": "Status", "value": "Analyst review"},
        ]},
    },

    # ===================== DEMAND =====================
    "demand::Forecast tourist-nights in central Athens for peak season": {
        "trace": [
            _t("Orchestrator", "routing to Tourism Demand Forecast"),
            _t("Forecast Agent", "Prophet · tourist-nights, 90-day horizon"),
            _t("Confidence Agent", "80% prediction interval"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Prophet forecasts tourist-nights for `dist_zone=centre` Athens across the **Jun–Sep** peak, derived from occupancy × capacity across the 14,242-listing base with an 80% confidence band."},
            {"type": "chart", "chart": {"kind": "forecast", "title": "Forecast tourist-nights · central Athens (80% CI)"}},
            {"type": "text", "text": "The central forecast peaks at **~214,000 tourist-nights in August**, up **18% year-on-year**, with the confidence band widening to ±9% as the horizon extends. July and August together represent **47% of full-year demand** concentrated in the core. This level approaches the historical infrastructure-stress line for water and waste services. I can translate these nights into transit and waste load, or run high/base/low scenarios for summer 2026."},
        ],
        "brief": {"title": "Tourist-Nights Forecast Brief — Central Athens", "kpis": [
            {"label": "August peak", "value": "~214k nights"}, {"label": "YoY growth", "value": "+18%"},
            {"label": "Jul+Aug share", "value": "47% of year"}, {"label": "Confidence", "value": "80% CI · ±9%"},
        ]},
    },
    "demand::Which districts hit infrastructure stress in August?": {
        "trace": [
            _t("Orchestrator", "routing to Tourism Demand Forecast"),
            _t("Forecast Agent", "district-level August load"),
            _t("Load Agent", "mapping nights → water/waste/transit index"),
            _t("Geo Agent", "rendering stress map"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "I converted the August tourist-night forecast into a composite **infrastructure stress index** (water, waste, transit) per district, where **1.0 = design capacity**. Four central districts are projected to exceed it."},
            {"type": "map", "map": {"city": "Athens", "title": "August infrastructure stress index", "metric": "stress"}},
            {"type": "chart", "chart": {"kind": "stress", "title": "August infrastructure stress index by district"}},
            {"type": "text", "text": "**Koukaki (1.28)** and **Plaka (1.21)** breach capacity most severely, driven by transit load at metro Akropoli and waste collection frequency. **Monastiraki (1.14)** and **Syntagma (1.06)** follow. Outer districts stay comfortably under 0.8. The actionable lever is staggered waste pickup and temporary transit frequency boosts in those four zones for the 6-week peak — far cheaper than capital works. Want the scenario run for summer 2026?"},
        ],
        "brief": {"title": "Infrastructure Stress Brief — Athens, August", "kpis": [
            {"label": "Districts > 1.0", "value": "4"}, {"label": "Peak: Koukaki", "value": "1.28"},
            {"label": "Primary driver", "value": "Transit + waste"}, {"label": "Recommended", "value": "Staggered services"},
        ]},
    },

    # ===================== MARKET =====================
    "market::Rank Athens neighbourhoods by projected STR yield": {
        "trace": [
            _t("Orchestrator", "routing to Market Entry Advisor"),
            _t("Yield Agent", "ADR × occupancy − cost across neighbourhood_stats"),
            _t("Risk Agent", "regulatory + saturation discount"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "I ranked Athens neighbourhoods by **projected net STR yield** — XGBoost-predicted ADR × Prophet occupancy, less operating cost, then discounted for regulatory and saturation risk."},
            {"type": "chart", "chart": {"kind": "yield", "title": "Projected net STR yield by neighbourhood (%)"}},
            {"type": "text", "text": "**Pangrati (11.4%)** tops the ranking: strong ADR, below-core saturation, and no current licence moratorium. **Kypseli (10.6%)** and **Mets (9.8%)** follow as gentrifying-but-not-saturated plays. Core tourist zones like Plaka post lower *net* yield (7.1%) — high ADR is offset by saturation and regulatory risk. For a value-add thesis, Pangrati and Kypseli offer the best risk-adjusted entry. I can compare a 50-unit portfolio here against Paris."},
        ],
        "brief": {"title": "STR Yield Ranking Brief — Athens", "kpis": [
            {"label": "Top: Pangrati", "value": "11.4% net"}, {"label": "Runner-up: Kypseli", "value": "10.6%"},
            {"label": "Core (Plaka)", "value": "7.1% net"}, {"label": "Thesis", "value": "Gentrifying, unsaturated"},
        ]},
    },
    "market::Which Paris arrondissements are supply-constrained?": {
        "trace": [
            _t("Orchestrator", "routing to Market Entry Advisor"),
            _t("Supply Agent", "supply vs predicted demand · 120,809 listings"),
            _t("Gap Agent", "computing constraint index by arrondissement"),
            _t("Orchestrator", "composing brief"),
        ],
        "blocks": [
            {"type": "text", "text": "Across the **120,809 Paris listings** I computed a supply–demand gap per arrondissement: predicted demand (search + occupancy pressure) minus active entire-home supply. Positive = under-supplied."},
            {"type": "chart", "chart": {"kind": "supplygap", "title": "Supply–demand gap by arrondissement (index)"}},
            {"type": "text", "text": "The **19th (+0.41)** and **20th (+0.37)** are the most supply-constrained — robust demand growth with comparatively thin entire-home supply and lighter regulatory friction than the centre. The **11th (+0.22)** is a secondary opportunity. By contrast the **1st–4th** run deeply negative: saturated and regulation-capped. For new entry, the eastern arrondissements offer the cleanest constraint-driven upside. I can rank these by projected yield or compare against Athens next."},
        ],
        "brief": {"title": "Supply Constraint Brief — Paris", "kpis": [
            {"label": "Most constrained: 19th", "value": "+0.41"}, {"label": "Runner-up: 20th", "value": "+0.37"},
            {"label": "Avoid", "value": "1st–4th (saturated)"}, {"label": "Secondary", "value": "11th · +0.22"},
        ]},
    },
}


def generic_script(agent, prompt):
    """Fallback for free-form / unscripted prompts in demo mode."""
    return {
        "trace": [
            _t("Orchestrator", f"routing to {agent['name']}"),
            _t("Retrieval Agent", "querying 135,051-listing master dataset"),
            _t("Analysis Agent", "applying XGBoost / LightGBM / SHAP"),
            _t("Orchestrator", "composing answer"),
        ],
        "blocks": [
            {"type": "text", "text": (
                f"Working from the ARIA master dataset (**135,051 listings × 96 columns** — "
                f"Paris 120,809, Athens 14,242), here's how **{agent['name']}** reads your question.\n\n"
                "I don't have a pre-scored brief for this exact query in demo mode, but the relevant "
                "signals — `price_eur`, `dist_zone`, `risk score`, and SHAP attributions — all point in a "
                "consistent direction. For a fully grounded, numbers-cited answer, paste a Gemini API key "
                "in the sidebar (switches to Live mode), or pick one of the suggested prompts to see a "
                "complete scripted analysis with charts."
            )},
        ],
        "brief": {"title": f"{agent['name']} — Analysis", "kpis": [
            {"label": "Master dataset", "value": "135,051"}, {"label": "Paris", "value": "120,809"},
            {"label": "Athens", "value": "14,242"}, {"label": "Columns", "value": "96"},
        ]},
    }


def get_script(agent_id, prompt):
    return SCRIPTS.get(f"{agent_id}::{prompt}")


# ---------------------------------------------------------------------------
# Seeded conversation history (sidebar)
# ---------------------------------------------------------------------------
SEED_CONVERSATIONS = [
    {"id": "c1", "agentId": "host-revenue", "title": "Underpricing vs neighbourhood", "group": "Today",
     "prompt": "Why is my listing underpriced vs the neighbourhood?"},
    {"id": "c2", "agentId": "demand", "title": "Central Athens peak forecast", "group": "Today",
     "prompt": "Forecast tourist-nights in central Athens for peak season"},
    {"id": "c3", "agentId": "crime", "title": "Top AML risk scores", "group": "Today",
     "prompt": "Show the top AML risk scores with SHAP explanations"},
    {"id": "c4", "agentId": "gentrification", "title": "Athens displacement risk", "group": "Yesterday",
     "prompt": "Which Athens neighbourhoods show displacement risk in the next 12 months?"},
    {"id": "c5", "agentId": "market", "title": "Paris supply-constrained zones", "group": "Yesterday",
     "prompt": "Which Paris arrondissements are supply-constrained?"},
    {"id": "c6", "agentId": "host-revenue", "title": "Revenue simulation", "group": "Previous 7 days",
     "prompt": "Simulate revenue: current vs recommended pricing"},
    {"id": "c7", "agentId": "demand", "title": "August infrastructure stress", "group": "Previous 7 days",
     "prompt": "Which districts hit infrastructure stress in August?"},
    {"id": "c8", "agentId": "market", "title": "Athens yield ranking", "group": "Previous 7 days",
     "prompt": "Rank Athens neighbourhoods by projected STR yield"},
]

# ---------------------------------------------------------------------------
# Chart datasets (ported from aria-charts.jsx)
# ---------------------------------------------------------------------------
DATA = {
    "shap": [
        {"f": "dist_zone=centre", "v": 21}, {"f": "accommodates=4", "v": 13},
        {"f": "neighbourhood_stats", "v": 8}, {"f": "host_tenure_days", "v": -4},
        {"f": "review_scores_rating", "v": -7},
    ],
    "revsim": [
        {"m": "Jan", "cur": 2100, "rec": 2380}, {"m": "Feb", "cur": 2050, "rec": 2330},
        {"m": "Mar", "cur": 2300, "rec": 2680}, {"m": "Apr", "cur": 2520, "rec": 2990},
        {"m": "May", "cur": 2700, "rec": 3260}, {"m": "Jun", "cur": 2950, "rec": 3680},
        {"m": "Jul", "cur": 3250, "rec": 4120}, {"m": "Aug", "cur": 3300, "rec": 4180},
        {"m": "Sep", "cur": 2880, "rec": 3520}, {"m": "Oct", "cur": 2550, "rec": 3010},
        {"m": "Nov", "cur": 2150, "rec": 2450}, {"m": "Dec", "cur": 2350, "rec": 2700},
    ],
    "riskbar": [
        {"n": "Koukaki", "v": 0.84}, {"n": "Exarchia", "v": 0.76}, {"n": "Plaka", "v": 0.71},
        {"n": "Pangrati", "v": 0.58}, {"n": "Mets", "v": 0.49}, {"n": "Kypseli", "v": 0.43},
    ],
    "trend": [
        {"q": "Q1", "centre": 100, "mid": 100, "outer": 100, "far": 100},
        {"q": "Q2", "centre": 107, "mid": 104, "outer": 102, "far": 100},
        {"q": "Q3", "centre": 114, "mid": 108, "outer": 104, "far": 101},
        {"q": "Q4", "centre": 119, "mid": 112, "outer": 105, "far": 101},
        {"q": "Q5", "centre": 124, "mid": 115, "outer": 107, "far": 102},
        {"q": "Q6", "centre": 128, "mid": 116, "outer": 108, "far": 103},
    ],
    "anomaly": [
        {"n": "#48213", "v": 0.94}, {"n": "#71902", "v": 0.89}, {"n": "#33518", "v": 0.86},
        {"n": "#60274", "v": 0.83}, {"n": "#19847", "v": 0.81},
    ],
    "riskdist": [
        {"b": "0.0", "v": 41}, {"b": "0.2", "v": 28}, {"b": "0.4", "v": 16},
        {"b": "0.6", "v": 8}, {"b": "0.8", "v": 4}, {"b": "0.94", "v": 1, "flag": True},
    ],
    "stress": [
        {"n": "Koukaki", "v": 1.28}, {"n": "Plaka", "v": 1.21}, {"n": "Monastiraki", "v": 1.14},
        {"n": "Syntagma", "v": 1.06}, {"n": "Pangrati", "v": 0.79}, {"n": "Kypseli", "v": 0.62},
    ],
    "yield": [
        {"n": "Pangrati", "v": 11.4}, {"n": "Kypseli", "v": 10.6}, {"n": "Mets", "v": 9.8},
        {"n": "Exarchia", "v": 8.9}, {"n": "Koukaki", "v": 7.9}, {"n": "Plaka", "v": 7.1},
    ],
    "supplygap": [
        {"n": "19th", "v": 0.41}, {"n": "20th", "v": 0.37}, {"n": "11th", "v": 0.22},
        {"n": "18th", "v": 0.12}, {"n": "12th", "v": 0.04}, {"n": "1st–4th", "v": -0.28},
    ],
}


def forecast_data():
    base = [120, 138, 176, 214, 168, 132]
    months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
    return [
        {"m": months[i], "y": y, "lo": round(y * 0.91), "hi": round(y * 1.09)}
        for i, y in enumerate(base)
    ]


# Athens neighbourhood layout for the pseudo-choropleth (grid coords + risk/stress)
MAP_NODES = [
    {"name": "Koukaki", "risk": 0.84, "stress": 1.28, "x": 1, "y": 2},
    {"name": "Plaka", "risk": 0.71, "stress": 1.21, "x": 2, "y": 2},
    {"name": "Monastiraki", "risk": 0.66, "stress": 1.14, "x": 2, "y": 1},
    {"name": "Syntagma", "risk": 0.63, "stress": 1.06, "x": 3, "y": 1},
    {"name": "Exarchia", "risk": 0.76, "stress": 0.88, "x": 3, "y": 0},
    {"name": "Mets", "risk": 0.49, "stress": 0.71, "x": 3, "y": 3},
    {"name": "Pangrati", "risk": 0.58, "stress": 0.79, "x": 4, "y": 2},
    {"name": "Kypseli", "risk": 0.43, "stress": 0.62, "x": 1, "y": 0},
    {"name": "Gazi", "risk": 0.52, "stress": 0.74, "x": 0, "y": 1},
    {"name": "Petralona", "risk": 0.38, "stress": 0.55, "x": 0, "y": 2},
    {"name": "Ampelokipoi", "risk": 0.31, "stress": 0.48, "x": 4, "y": 0},
    {"name": "Neos Kosmos", "risk": 0.35, "stress": 0.50, "x": 2, "y": 3},
]
