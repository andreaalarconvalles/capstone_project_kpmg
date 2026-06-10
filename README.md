# ARIA — Agentic Real-estate Intelligence Advisor
### IE Business School × KPMG Spain · Corporate Capstone 2026

---

## What is ARIA

**ARIA** (Agentic Real-estate Intelligence Advisor) is a multi-agent AI system for short-term rental investment intelligence, built in partnership with **KPMG Spain** as an IE Business School Corporate Capstone 2026.

ARIA targets three primary personas:
- **Institutional investor** — which neighbourhood should I enter, what is the yield, what is the risk
- **Host / property manager** — am I priced correctly, is my listing declining, what should I improve
- **Real estate developer / PE fund** — where is the supply shock opportunity, what is the entry price

The system combines five specialist ML agents orchestrated via LangGraph, with a Streamlit demo interface and ReportLab PDF output. It covers **135,051 listings** across Paris and Athens.

---

## System Architecture
```
User query (natural language)
↓
LangGraph Orchestrator  ←────────────────── Human-in-the-loop approval
↓
┌───────────────────────────────────────────────────────┐
│  Agent 1: XGBoost Pricing          (Phase 2 — Done)   │
│  → Predicts fair nightly price per listing            │
│  → Identifies underpriced listings (gap > €15)        │
│  → Paris R²=0.588 · Athens R²=0.676                  │
├───────────────────────────────────────────────────────┤
│  Agent 2: Prophet Demand Forecast  (Phase 4)          │
│  → 12-month occupancy forecast per neighbourhood      │
│  → Buy/hold signal for investor persona               │
│  → Feeds dynamic pricing layer in Phase 6             │
├───────────────────────────────────────────────────────┤
│  Agent 3: LightGBM Host Risk       (Phase 3 — Done)   │
│  → Risk probability per host (0–1)                    │
│  → 865 priority targets: underpriced AND high-risk    │
│  → €1.43M revenue opportunity identified              │
├───────────────────────────────────────────────────────┤
│  Agent 4: RAG Compliance           (Phase 5)          │
│  → ChromaDB index of AMA + Loi Le Meur regulations   │
│  → Cites specific article per listing                 │
│  → 137 unlicensed Athens listings as primary targets  │
├───────────────────────────────────────────────────────┤
│  Agent 5: GPT-4o Listing Coach     (Phase 6)          │
│  → Uses SHAP values as context                        │
│  → Writes personalised improvement recommendation     │
│  → Output: "Raise price by €X, improve Y feature"    │
└───────────────────────────────────────────────────────┘
↓
Streamlit app (Phase 7) — 3 tabs: Investor · Host · Developer
↓
ReportLab PDF brief — KPMG-formatted output
```

---

## Project Structure
```
KPMG Capstone/
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb              # Phase 1 — EDA (COMPLETE, A+/99)
│   ├── ARIA_XGBoost_v1.ipynb                # Phase 2 — Pricing models (COMPLETE, A/96)
│   ├── ARIA_LightGBM_v1.ipynb               # Phase 3 — Risk classifier (COMPLETE, A/95)
│   ├── ARIA_Prophet_v1.ipynb                # Phase 4 — Demand forecasting (not started)
│   └── eda_figures/                         # All generated charts and figures
├── data/
│   ├── raw/                                 # Original source files — never modify
│   │   ├── gyodi_nawaro_2021/               # 4 CSVs: athens/paris weekdays+weekends
│   │   ├── iab_athens_sept2025_listings.csv
│   │   ├── iab_paris_2025_listings.csv
│   │   └── maven_airbnb_listings_reviews.csv
│   ├── processed/                           # Produced by EDA notebook — gitignored
│   │   ├── aria_mega_dataset_v4_1_final.csv # 135,051 rows × 96 cols
│   │   └── neighbourhood_stats_*.csv
│   └── outputs/                             # Model outputs — join key: listing_id
│       ├── paris_predictions_v1.csv         # Phase 2
│       ├── athens_predictions_v1.csv        # Phase 2
│       ├── athens_underpricing_v1.csv       # Phase 2 — 2,945 underpriced listings
│       ├── shap_paris_v1.csv                # Phase 2
│       ├── shap_athens_v1.csv               # Phase 2
│       ├── athens_risk_scores_v1.csv        # Phase 3 — risk_probability, risk_band
│       ├── prophet_paris_forecast_v1.csv    # Phase 4 — not yet
│       └── prophet_athens_forecast_v1.csv   # Phase 4 — not yet
├── models/
│   ├── xgb_paris_v1.json                    # Phase 2 — load with XGBRegressor
│   ├── xgb_athens_v1.json                   # Phase 2
│   ├── lgb_athens_risk_v1.txt               # Phase 3 — load with lgb.Booster
│   ├── prophet_paris_v1.pkl                 # Phase 4 — not yet (gitignored)
│   └── prophet_athens_v1.pkl                # Phase 4 — not yet (gitignored)
├── rag/                                     # Phase 5 — ChromaDB index + RAG agent
├── agents/                                  # Phase 6 — LangGraph orchestration code
├── app/                                     # Phase 7 — Streamlit app (3-tab persona MVP)
├── Stage 7 - UI Interface/                  # Phase 7 — agent-chat UI (React prototype + Streamlit)
├── docs/                                    # Methodology docs, proposals, planner
├── KPMG Capstone.pdf
├── KPMG Proposal - Regulators.pdf
├── CLAUDE.md
├── README.md
└── .gitignore
```

---

## Dataset

| Source | City | Rows | Vintage |
|---|---|---|---|
| Maven Analytics | Paris | 63,520 | 2021 |
| Inside Airbnb | Paris | 57,289 | Sept 2025 |
| Inside Airbnb | Athens | 14,242 | Sept 2025 |
| **Total** | **Paris + Athens** | **135,051** | **2021–2025** |

**Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns, built from the 4 raw sources above.

> ⚠️ Large files (>50MB) are excluded from version control. See Data Access section below.

---

## Completed Phases

### Phase 1 — EDA (COMPLETE · Grade A+/99)
**Notebook:** `ARIA_EDA_v4_FINAL.ipynb`

What was done: Full exploratory data analysis across 135,051 listings. 41 documented pipeline steps including encoding resolution, price normalisation, Haversine distance computation, VADER sentiment scoring across 594,000+ reviews, and at_risk_host label engineering across 6 validated dimensions. 10 embedded figures across 8 analytical sections.

Key findings that shaped all downstream models:
- Athens distance effect is 2.8× stronger than Paris — primary justification for separate city models
- Paris XGBoost ceiling is the Maven 2021 vintage — 4-year-old prices introduce structural noise
- VADER French-language bias inflates Paris scores by +0.178 — cross-city sentiment comparison invalid
- 137 Athens listings unlicensed — pricing at market rate — reframed as supply shock opportunity
- Gross yield: Centre 2.3%, Near 2.4% (best entry), Mid 1.8%, Far 2.1%

Business output: Athens centre vs far revenue €7,236 vs €1,848/yr (3.9× premium). ZAPPION neighbourhood opportunity score = 0.955, estimated revenue €15,416/yr.

---

### Phase 2 — XGBoost Price Prediction (COMPLETE · Grade A/96)
**Notebook:** `ARIA_XGBoost_v1.ipynb`

What was done: Two separate XGBoost models (Paris and Athens) predicting fair nightly price. 26-feature pipeline including 3 non-linear distance transforms, neighbourhood context, booking momentum signals, and 6 interaction terms. 100-trial Optuna hyperparameter optimisation. Full SHAP analysis with dependence plots and single-listing waterfall.

Performance:
| City | R² | MAE | vs Naive | Note |
|---|---|---|---|---|
| Paris | 0.588 | €29.1 | +36% | Above published 0.52–0.58 range for 2021-vintage data |
| Athens | 0.676 | €29.1 | +44% | Target >0.65 PASSED |

Key findings:
- `neighbourhood_median_price` SHAP rank 1 both cities — local market context dominates
- Paris ranks 2–4: person_capacity, bedrooms, room×capacity — size-driven market
- Athens ranks 2–4: review_score_composite, dist_km, bedrooms — quality+location-driven market
- Separate city models confirmed correct by SHAP structural divergence

Business output: 2,945 Athens listings underpriced >€15. Median gap €25. Total foregone revenue €4.8M/year.

Output files: `xgb_paris_v1.json` · `xgb_athens_v1.json` · `paris_predictions_v1.csv` · `athens_predictions_v1.csv` · `athens_underpricing_v1.csv` · `shap_paris_v1.csv` · `shap_athens_v1.csv`

---

### Phase 3 — LightGBM Host Risk Classifier (COMPLETE · Grade A/95)
**Notebook:** `ARIA_LightGBM_v1.ipynb`

What was done: Binary classifier predicting host churn risk for Athens listings. Target: `at_risk_host` (1 = host showing 3+ of 6 booking decline dimensions). 11 features after leakage correction — 3 label dimensions excluded (`availability_365`, `review_scores_rating_norm`, `availability_pressure`). 100-trial Optuna, 5-fold stratified CV.

Important: An earlier run with leaking features produced AUC = 0.9995. Leakage was identified via SHAP (availability_365 at rank 1 with value 6.95), corrected, and documented. The honest AUC = 0.8288 reflects genuine discriminative power.

Performance:
| Metric | Value | Target | Status |
|---|---|---|---|
| AUC-ROC | 0.8288 | >0.72 | PASSED |
| Avg Precision | 0.8864 | >0.65 | PASSED |
| Brier Score | 0.1656 | <0.25 | PASSED |
| CV stability | ±0.0088 | <0.02 | STABLE |

Key findings:
- `review_velocity_l30d` SHAP rank 1 (value=0.936) — zero recent bookings is the strongest at-risk signal. EDA prediction confirmed.
- `review_score_composite` SHAP rank 2 — quality erosion is the churn mechanism, not just momentum decline
- PATISIA neighbourhood: 65 at-risk hosts → €365k revenue redistribution if exited

Business output: 865 listings flagged as both underpriced (Phase 2) AND high-risk (Phase 3). Revenue opportunity: €1.43M potential (€0.71M realisable at 50% gap closure).

Output files: `lgb_athens_risk_v1.txt` · `athens_risk_scores_v1.csv`

---

## Upcoming Phases

### Phase 4 — Prophet Demand Forecasting (Member 2)
**Notebook to create:** `eda/ARIA_Prophet_v1.ipynb`

**What to build:** Two Prophet time-series models — Paris and Athens — predicting monthly occupancy over a 12-month horizon.

**Training data:**
- Filter `prophet_training_eligible = 1` in the mega dataset
- Paris: ~42,978 rows · Athens: ~10,661 rows
- Target column: `estimated_occupancy_l365d`
- External regressor: `review_growth_24_25` (booking momentum)

**Key technical note:** Prophet requires data in `ds` (date) and `y` (value) format. You must reshape listing-level data into monthly time-series aggregated by neighbourhood before fitting. This reshaping is the main engineering challenge of this phase.

**Expected outputs:**
- `models/prophet_paris_v1.pkl` — serialised Paris model
- `models/prophet_athens_v1.pkl` — serialised Athens model
- `data/outputs/prophet_paris_forecast_v1.csv` — 12-month forecast with confidence intervals
- `data/outputs/prophet_athens_forecast_v1.csv` — same for Athens

**Install first:** `pip install prophet`

**Wide confidence intervals are expected for Paris** (2021 vintage). Athens is the primary actionable forecast.

---

### Phase 5 — RAG Compliance Agent (Member 3)
**Location:** `rag/`

**What to build:** A ChromaDB vector index of AMA regulations (Athens) and Loi Le Meur (Paris short-term rental law). An RAG retrieval agent that, given a listing, returns the specific regulation article that applies and whether the listing is compliant.

**Primary targets:** 137 unlicensed Athens listings identified in the EDA (has_license == False, city == athens). These represent ~€1.03M annual revenue that would redistribute to compliant operators if they exit.

**How it connects:** The RAG agent is one of the 5 LangGraph nodes in Phase 6. It does not need any model files from Phases 2–4. It reads from the mega dataset and its own ChromaDB index only.

**Key technical note:** Do not commit the ChromaDB index to git — it will be large binary files. Add `rag/chroma_db/` to .gitignore before committing.

---

### Phase 6 — LangGraph Orchestrator (Member 4)
**Location:** `agents/`

**What to build:** A LangGraph directed graph with 5 specialist agent nodes. The orchestrator receives a natural language query, identifies the persona (investor/host/developer), routes to the appropriate agents, collects their outputs, and passes everything to GPT-4o for natural language synthesis.

**The 5 nodes:**
1. XGBoost pricing node — loads `xgb_athens_v1.json`, returns predicted fair price and underpricing gap
2. Prophet forecast node — loads `prophet_athens_v1.pkl`, returns occupancy trend and buy/hold signal
3. LightGBM risk node — loads `lgb_athens_risk_v1.txt`, returns risk probability and band
4. RAG compliance node — queries ChromaDB index, returns regulation citation and compliance status
5. GPT-4o coach node — takes SHAP values from `shap_athens_v1.csv` as context, returns personalised listing improvement recommendation

**Dynamic pricing layer:** Add a rule-based pricing agent that combines XGBoost fair price with Prophet occupancy forecast. When forecast occupancy for next 30 days is above neighbourhood median → recommend raising price by 10–15%. When below → lower by 5–10%. When review_velocity_l30d = 0 → lower by 10% to restart booking momentum.

**Human-in-the-loop:** Before the investor brief PDF is generated, route through a human approval step. This is the Trusted AI / Governance component required by the KPMG brief.

**Universal join key:** `listing_id` is the join key across all output CSVs. Use it to merge Phase 2 and 3 outputs when assembling context for a query.

**Critical:** This phase depends on all other phases being complete (or mocked). Start with mock outputs and swap in real files when ready.

---

### Phase 7 — Streamlit MVP (Member 5)
**Location:** `app/` (3-tab persona MVP) · `Stage 7 - UI Interface/` (agent-chat UI)

> **Built — agent-chat UI (`Stage 7 - UI Interface/`):** a ChatGPT-style multi-agent interface implemented from the claude.ai/design handoff. Surfaces all 5 KPMG agents (Host Revenue, Gentrification Early Warning, STR Financial Crime, Tourism Demand, Market Entry) with LangGraph-style reasoning traces, inline dark Plotly charts, a pseudo-choropleth Athens map, a model picker, and a hybrid Demo / live-Gemini mode. Ships as both a React/HTML prototype (`prototype/`) and a faithful Streamlit app (`streamlit_app/`). Run: `cd "Stage 7 - UI Interface/streamlit_app" && pip install -r requirements.txt && streamlit run app.py`.

**What to build:** A 3-tab Streamlit application that serves the three personas. This tab **can be started now** using the existing CSV outputs from Phases 2 and 3 — it does not require Phase 4, 5, or 6 to be complete.

**Tab 1 — Investor:**
- Neighbourhood opportunity map (choropleth using opportunity scores from EDA)
- Gross yield calculator per neighbourhood
- Risk heatmap from `athens_risk_scores_v1.csv`
- Prophet occupancy forecast chart (Phase 4, placeholder until ready)
- AMA compliance status (Phase 5, placeholder until ready)

**Tab 2 — Host:**
- Underpricing gap per listing from `athens_underpricing_v1.csv`
- SHAP feature breakdown from `shap_athens_v1.csv` — which features are suppressing price
- Risk probability from `athens_risk_scores_v1.csv`
- 3-action coaching plan (pricing, quality, velocity)
- GPT-4o personalised recommendation (Phase 6, placeholder until ready)

**Tab 3 — Developer:**
- Sweet-spot neighbourhood map (high opportunity + low risk + compliant)
- Entry price range per neighbourhood
- 12 highest-conviction entry-point neighbourhoods from EDA

**Starting point:** Use `athens_risk_scores_v1.csv` and `athens_underpricing_v1.csv` as the primary data sources. The 865 priority listings (underpriced AND high-risk) are the centrepiece of the host tab.

---

### Documentation + Presentation (Member 6)

**What to produce:**
- Methodology document — 96 columns, 41 pipeline steps, 8 challenges with resolutions, 5 limitations, 6 ML usage mappings
- KPMG presentation slides — follows KPMG Lighthouse AI Factory framing (GenAI + Agents + Trusted AI + Data Platforms)
- Project summary document — one-pager per phase with key metrics and business outputs

**Existing assets:**
- `KPMG Capstone.pdf` — original brief with use case definition
- `KPMG Proposal - Regulators.pdf` — regulatory framing for the compliance agent
- The ARIA Project Summary document produced in the main session covers Phases 1–3

---

## Data Access

Large files are excluded from version control. Download from the sources below.

| File | Source | Local path |
|---|---|---|
| Maven Analytics Paris 2021 | [mavenanalytics.io/data-playground](https://mavenanalytics.io/data-playground) — search Airbnb | `data/raw/maven_airbnb_listings_reviews.csv` |
| Inside Airbnb Paris 2025 | [insideairbnb.com/get-the-data](https://insideairbnb.com/get-the-data/) → Paris → listings.csv.gz | `data/raw/iab_paris_2025_listings.csv` |
| Inside Airbnb Athens Sept 2025 | Same page → Athens → September 2025 → listings.csv.gz | `data/raw/iab_athens_sept2025_listings.csv` |
| Gyodi & Nawaro 2021 | [zenodo.org/record/4446043](https://zenodo.org/record/4446043) | `data/raw/gyodi_nawaro_2021/` |

> **Gyodi & Nawaro — download 4 files only:** `athens_weekdays.csv`, `athens_weekends.csv`, `paris_weekdays.csv`, `paris_weekends.csv`

> **Master dataset:** Run `ARIA_EDA_v4_FINAL.ipynb` end-to-end once on your machine. It saves `aria_mega_dataset_v4_1_final.csv` to `data/processed/` automatically. Every other notebook loads from there.

---

## Key Output Files

| File | Phase | Contents |
|---|---|---|
| `paris_predictions_v1.csv` | 2 | Predicted fair price, actual price, gap — all Paris listings |
| `athens_predictions_v1.csv` | 2 | Same for Athens |
| `athens_underpricing_v1.csv` | 2 | 2,945 listings where predicted price exceeds actual by >€15 |
| `shap_paris_v1.csv` | 2 | Per-feature SHAP values for Paris holdout |
| `shap_athens_v1.csv` | 2 | Per-feature SHAP values for Athens holdout |
| `athens_risk_scores_v1.csv` | 3 | risk_probability (0–1), risk_band (Low/Moderate/High), high_risk_flag per listing |
| `prophet_paris_forecast_v1.csv` | 4 | 12-month occupancy forecast — Paris (not yet) |
| `prophet_athens_forecast_v1.csv` | 4 | 12-month occupancy forecast — Athens (not yet) |

**Priority target list (865 listings):** Cross-reference of `athens_underpricing_v1.csv` and `athens_risk_scores_v1.csv` on `listing_id`. These listings are underpriced AND declining. Revenue opportunity: €1.43M potential (€0.71M realisable). This is the ARIA host agent's primary output.

---

## Project Phases & Team Assignments

> Live status board — update immediately when any phase progresses.

| Phase | Owner | Status |
|---|---|---|
| Phase 1 — EDA | Member 1 | ✅ Done |
| Phase 2 — XGBoost Pricing | Member 1 | ✅ Done |
| Phase 3 — LightGBM Risk | Member 1 | ✅ Done |
| Phase 4 — Prophet Forecasting | Member 2 | 🔲 Not started |
| Phase 5 — RAG Compliance | Member 3 | 🔲 Not started |
| Phase 6 — LangGraph Orchestrator | Member 4 | 🔲 Not started |
| Phase 7 — Streamlit MVP | Member 5 | 🔄 In progress |
| Documentation + Presentation | Member 6 | 🔲 Not started |

Status key: ✅ Done · 🔄 In progress · 🔲 Not started · ⏳ Blocked

---

## Session Log

- [2026-06-09] Session 1: Repository initialised. README, CLAUDE.md, .gitignore created and pushed.
- [2026-06-09] Session 2: Phase 1 EDA complete (A+/99). 135,051 rows × 96 cols. 41 pipeline steps. 10 figures. Business quantification complete.
- [2026-06-09] Session 3: Phase 2 XGBoost complete (A/96). Paris R²=0.588, Athens R²=0.676. 26-feature pipeline. 2,945 underpriced listings. €4.8M foregone revenue. All 7 output files saved.
- [2026-06-09] Session 4: Phase 3 LightGBM complete (A/95). Leakage discovered and corrected. AUC=0.8288. 865 priority targets. €1.43M opportunity.
- [2026-06-09] Session 5: README completely rewritten to reflect all 7 phases. CLAUDE.md updated. Placeholder folders created.
- [2026-06-10] Session 6: Built the ARIA agent-chat UI in `Stage 7 - UI Interface/` from the claude.ai/design handoff — React/HTML prototype + a faithful Streamlit app (5 agents, scripted demos, reasoning traces, Plotly dark charts, pseudo-choropleth map, model picker, hybrid live-Gemini mode). Verified via Streamlit AppTest (no exceptions).
- [2026-06-10] Session 7: Fixed Streamlit Cloud dependency installation by adding a root-level `requirements.txt`, avoiding installer parsing issues caused by the nested app folder path with spaces and a hyphen.
