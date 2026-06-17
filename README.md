# ARIA — Agentic Real-estate Intelligence Advisor
### IE Sci-Tech School × KPMG Spain · Corporate Capstone 2026

**Live demo:** [capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and project memory:** [`agent.md`](agent.md)

---

## What is ARIA

**ARIA** (Agentic Real-estate Intelligence Advisor) is a fully-built multi-agent AI system for short-term rental investment intelligence, developed in partnership with **KPMG Spain** as an IE Sci-Tech School Corporate Capstone 2026.

ARIA targets three primary personas:
- **Institutional investor** — which neighbourhood should I enter, what is the yield, what is the risk
- **Host / property manager** — am I priced correctly, is my listing declining, what should I improve
- **Real estate developer / PE fund** — where is the supply shock opportunity, what is the entry price

The system combines validated machine learning outputs (XGBoost, LightGBM, Prophet, RAG), a LangGraph orchestration layer, and a live Vercel React chat interface backed by Vertex AI Gemini 2.5 Pro. Auto Agent is the default interaction mode: ARIA reads the user's prompt, selects the right specialist, and runs either the scripted demo answer or the live grounded analysis. It covers **135,051 listings** across Paris and Athens.

---

## System Architecture
```
User query (natural language)
↓
LangGraph Orchestrator ←────────────────── Human-in-the-loop approval
↓
┌───────────────────────────────────────────────────────┐
│ Agent 1: XGBoost Pricing (Phase 2 — COMPLETE)        │
│ → Predicts fair nightly price per listing             │
│ → Paris R²=0.588 · Athens R²=0.676                   │
├───────────────────────────────────────────────────────┤
│ Agent 2: Prophet Demand Forecast (Phase 4 — COMPLETE) │
│ → 12-month occupancy forecast per neighbourhood       │
├───────────────────────────────────────────────────────┤
│ Agent 3: LightGBM Host Risk (Phase 3 — COMPLETE)     │
│ → 865 priority targets: underpriced AND high-risk     │
│ → €1.43M revenue opportunity identified               │
├───────────────────────────────────────────────────────┤
│ Agent 4: RAG Compliance (Phase 5 — COMPLETE)         │
│ → ChromaDB index of AMA + Loi Le Meur regulations    │
│ → 137 unlicensed Athens listings as primary targets   │
├───────────────────────────────────────────────────────┤
│ Agent 5: LLM Listing Coach (Phase 6 — COMPLETE)      │
│ → Uses SHAP values as context                         │
│ → Output: "Raise price by €X, improve Y feature"     │
└───────────────────────────────────────────────────────┘
↓
Vercel React UI (Phase 7 — COMPLETE) — scripted prompts + custom prompt composer
↓
Vercel `/api/chat` backend — service-account-authenticated Vertex AI call
↓
GitHub Data Agent → Analytics Agent → Visualization Agent → Narrative Agent
↓
KPIs + dynamic chart/map + expandable details + PDF brief export
```

---

## Project Structure
```
capstone_project_kpmg/
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb      # Phase 1 — EDA (COMPLETE, A+/99)
│   ├── ARIA_XGBoost_v1.ipynb        # Phase 2 — Pricing models (COMPLETE, A/96)
│   ├── ARIA_LightGBM_v1.ipynb       # Phase 3 — Risk classifier (COMPLETE, A/95)
│   ├── ARIA_Prophet_v2.ipynb        # Phase 4 — Demand forecasting (COMPLETE)
│   ├── ARIA_RAG_v1.ipynb            # Phase 5 — RAG compliance agent (COMPLETE)
│   ├── ARIA_LangGraph_v1.ipynb      # Phase 6 — LangGraph orchestrator (COMPLETE)
│   └── eda_figures/                 # 40 generated charts and figures
├── data/
│   ├── raw/                         # Original source files — never modify
│   │   ├── gyodi_nawaro_2021/
│   │   ├── iab_athens_sept2025_listings.csv
│   │   ├── iab_paris_2025_listings.csv
│   │   └── maven_airbnb_listings_reviews.csv
│   ├── processed/                   # Produced by EDA notebook — gitignored
│   │   └── aria_mega_dataset_v4_1_final.csv
│   └── outputs/                     # Model outputs — join key: listing_id
│       ├── paris_predictions_v1.csv
│       ├── athens_predictions_v1.csv
│       ├── athens_underpricing_v1.csv
│       ├── shap_paris_v1.csv
│       ├── shap_athens_v1.csv
│       ├── athens_risk_scores_v1.csv
│       ├── prophet_paris_forecast_v1.csv
│       └── prophet_athens_forecast_v1.csv
├── models/
│   ├── xgb_paris_v1.json
│   ├── xgb_athens_v1.json
│   ├── lgb_athens_risk_v1.txt
│   ├── prophet_paris_v1.pkl
│   └── prophet_athens_v1.pkl
├── rag/                             # Phase 5 — ChromaDB index + RAG agent
├── agents/                          # Phase 6 — LangGraph orchestration code
├── UI Interface/                    # Phase 7 — Vercel React UI and API backend
│   └── vercel_vite_app/
│       ├── api/
│       ├── public/
│       └── src/legacy/
├── docs/
│   ├── ARIA_Master_Planner_V2.html
│   ├── ARIA_Data_Methodology_FINAL.docx
│   ├── PROJECT_SUMMARY.md
│   ├── MLOPS_REPO_REVIEW.md
│   ├── MENTOR_MEETING_SUMMARY.md
│   ├── MENTOR_DEFENSE_QA.md
│   └── KPMG EDA document.docx
├── KPMG Capstone.pdf
├── KPMG Proposal - Regulators.pdf
├── agent.md
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

**Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns.

> ⚠️ Large files (>50MB) are excluded from version control. See Data Access section below.

---

## Completed Phases

### Phase 1 — EDA (COMPLETE · Grade A+/99)
**Notebook:** `ARIA_EDA_v4_FINAL.ipynb`

Full exploratory data analysis across 135,051 listings. 41 documented pipeline steps including encoding resolution, price normalisation, Haversine distance computation, VADER sentiment scoring across 594,000+ reviews, and `at_risk_host` label engineering across 6 validated dimensions.

Key findings:
- Athens distance effect is 2.8× stronger than Paris — justification for separate city models
- VADER French-language bias inflates Paris scores by +0.178 — cross-city sentiment comparison invalid
- 137 Athens listings unlicensed — reframed as supply shock opportunity
- Gross yield: Centre 2.3%, Near 2.4% (best entry), Mid 1.8%, Far 2.1%

Business output: Athens centre vs far revenue €7,236 vs €1,848/yr (3.9× premium). ZAPPION opportunity score = 0.955, estimated revenue €15,416/yr.

---

### Phase 2 — XGBoost Price Prediction (COMPLETE · Grade A/96)
**Notebook:** `ARIA_XGBoost_v1.ipynb`

Two separate XGBoost models (Paris and Athens) predicting fair nightly price. 26-feature pipeline, 100-trial Optuna optimisation, full SHAP analysis.

| City | R² | MAE | vs Naive | Note |
|---|---|---|---|---|
| Paris | 0.588 | €29.1 | +36% | Above published 0.52–0.58 range for 2021-vintage data |
| Athens | 0.676 | €29.1 | +44% | Target >0.65 ✅ PASSED |

Business output: 2,945 Athens listings underpriced >€15. Median gap €25. Total foregone revenue €4.8M/year.

Output files: `xgb_paris_v1.json` · `xgb_athens_v1.json` · `paris_predictions_v1.csv` · `athens_predictions_v1.csv` · `athens_underpricing_v1.csv` · `shap_paris_v1.csv` · `shap_athens_v1.csv`

---

### Phase 3 — LightGBM Host Risk Classifier (COMPLETE · Grade A/95)
**Notebook:** `ARIA_LightGBM_v1.ipynb`

Binary classifier predicting host churn risk for Athens listings. 11 features after leakage correction. 100-trial Optuna, 5-fold stratified CV.

> **Note on leakage:** An earlier run produced AUC = 0.9995. Leakage was identified via SHAP, corrected, and documented. The honest AUC = 0.8288 reflects genuine discriminative power.

| Metric | Value | Target | Status |
|---|---|---|---|
| AUC-ROC | 0.8288 | >0.72 | ✅ PASSED |
| Avg Precision | 0.8864 | >0.65 | ✅ PASSED |
| Brier Score | 0.1656 | <0.25 | ✅ PASSED |
| CV stability | ±0.0088 | <0.02 | ✅ STABLE |

Business output: 865 listings flagged as both underpriced AND high-risk. Revenue opportunity: €1.43M potential (€0.71M realisable).

Output files: `lgb_athens_risk_v1.txt` · `athens_risk_scores_v1.csv`

---

### Phase 4 — Prophet Demand Forecasting (COMPLETE)
**Notebook:** `ARIA_Prophet_v2.ipynb`

Two Prophet time-series models (Paris and Athens) predicting monthly occupancy over a 12-month horizon. Paris: ~42,978 rows · Athens: ~10,661 rows. External regressor: `review_growth_24_25`.

Output files: `prophet_paris_v1.pkl` · `prophet_athens_v1.pkl` · `prophet_paris_forecast_v1.csv` · `prophet_athens_forecast_v1.csv`

---

### Phase 5 — RAG Compliance Agent (COMPLETE)
**Notebook:** `ARIA_RAG_v1.ipynb` · **Location:** `rag/`

ChromaDB vector index of AMA regulations (Athens) and Loi Le Meur (Paris). Given a listing, returns the applicable regulation article and compliance status. Primary targets: 137 unlicensed Athens listings (~€1.03M annual revenue).

> ChromaDB index files are local only — `rag/chroma_db/` is gitignored.

---

### Phase 6 — LangGraph Orchestrator (COMPLETE)
**Notebook:** `ARIA_LangGraph_v1.ipynb` · **Location:** `agents/`

LangGraph directed graph with 5 specialist agent nodes. Identifies persona (investor/host/developer), routes to agents, passes outputs to Vertex AI Gemini for narrative synthesis. Includes dynamic pricing layer and human-in-the-loop approval gate (KPMG Trusted AI requirement).

The 5 nodes: XGBoost pricing · Prophet forecast · LightGBM risk · RAG compliance · LLM coach

---

### Phase 7 — Vercel React UI (COMPLETE)
**Location:** `UI Interface/vercel_vite_app/`

ChatGPT-style multi-agent interface deployed live on Vercel. Auto Agent routing across 5 KPMG agents. Features: 8 scripted demo prompts, KPI cards, Recharts visuals, Leaflet maps, LangGraph-style reasoning traces, PDF brief export, persistent localStorage conversations, Gemini 2.5 Pro default with Claude Sonnet/Opus options.

**Live:** [capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

---

## Data Access

| File | Source | Local path |
|---|---|---|
| Maven Analytics Paris 2021 | [mavenanalytics.io/data-playground](https://mavenanalytics.io/data-playground) | `data/raw/maven_airbnb_listings_reviews.csv` |
| Inside Airbnb Paris 2025 | [insideairbnb.com/get-the-data](https://insideairbnb.com/get-the-data/) → Paris | `data/raw/iab_paris_2025_listings.csv` |
| Inside Airbnb Athens Sept 2025 | Same page → Athens → September 2025 | `data/raw/iab_athens_sept2025_listings.csv` |
| Gyodi & Nawaro 2021 | [zenodo.org/record/4446043](https://zenodo.org/record/4446043) | `data/raw/gyodi_nawaro_2021/` |

> **Gyodi & Nawaro — download 4 files:** `athens_weekdays.csv`, `athens_weekends.csv`, `paris_weekdays.csv`, `paris_weekends.csv`

> **Master dataset:** Run `ARIA_EDA_v4_FINAL.ipynb` end-to-end once. It saves `aria_mega_dataset_v4_1_final.csv` to `data/processed/` automatically.

---

## Key Output Files

| File | Phase | Contents |
|---|---|---|
| `paris_predictions_v1.csv` | 2 | Predicted fair price, actual price, gap — all Paris listings |
| `athens_predictions_v1.csv` | 2 | Same for Athens |
| `athens_underpricing_v1.csv` | 2 | 2,945 listings where predicted price exceeds actual by >€15 |
| `shap_paris_v1.csv` | 2 | Per-feature SHAP values for Paris holdout |
| `shap_athens_v1.csv` | 2 | Per-feature SHAP values for Athens holdout |
| `athens_risk_scores_v1.csv` | 3 | risk_probability (0–1), risk_band, high_risk_flag |
| `prophet_paris_forecast_v1.csv` | 4 | 12-month occupancy forecast — Paris |
| `prophet_athens_forecast_v1.csv` | 4 | 12-month occupancy forecast — Athens |

**Priority target list (865 listings):** Cross-reference of `athens_underpricing_v1.csv` and `athens_risk_scores_v1.csv` on `listing_id`. Underpriced AND declining — €1.43M revenue opportunity.

For model artifact governance and metrics, see [`models/MODEL_CARD.md`](models/MODEL_CARD.md).

For MLOps hygiene review, see [`docs/MLOPS_REPO_REVIEW.md`](docs/MLOPS_REPO_REVIEW.md).

---

## Project Phases & Status

| Phase | Notebook | Status |
|---|---|---|
| Phase 1 — EDA | `ARIA_EDA_v4_FINAL.ipynb` | ✅ Done · A+/99 |
| Phase 2 — XGBoost Pricing | `ARIA_XGBoost_v1.ipynb` | ✅ Done · A/96 |
| Phase 3 — LightGBM Risk | `ARIA_LightGBM_v1.ipynb` | ✅ Done · A/95 |
| Phase 4 — Prophet Forecasting | `ARIA_Prophet_v2.ipynb` | ✅ Done |
| Phase 5 — RAG Compliance | `ARIA_RAG_v1.ipynb` | ✅ Done |
| Phase 6 — LangGraph Orchestrator | `ARIA_LangGraph_v1.ipynb` | ✅ Done |
| Phase 7 — Vercel React UI | `UI Interface/vercel_vite_app/` | ✅ Done · Live |
