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

The system combines validated machine learning outputs (XGBoost, LightGBM, Prophet, RAG), a LangGraph orchestration layer, and a live Vercel React chat interface backed by Vertex AI Gemini 2.5 Pro. Auto Agent is the default interaction mode: ARIA reads the user's prompt, selects the right specialist, and runs either the scripted demo answer or the live grounded analysis. It covers 135,051 listings across Paris and Athens. In the deployed Vercel app, live grounded answers currently consume committed neighbourhood statistics, XGBoost pricing outputs, LightGBM risk scores, SHAP summaries, Prophet scenario forecast CSVs, and committed RAG compliance handoff outputs. LangGraph remains the validated orchestration research layer, with routing/session evidence committed for demo and documentation.

---

## Project Story and Demo Readiness

ARIA should be presented as a decision-support system with three layers:

1. Research and modelling layer: the notebooks prove the analytical methods across pricing, risk, demand forecasting, compliance retrieval, and orchestration.
2. Grounded model-output layer: committed CSV and model-output files are the trusted evidence base for generated answers.
3. Live agent layer: the Vercel app turns those outputs into plain-English recommendations, KPI cards, charts, maps, and PDF briefs for non-technical users.

For the demo, the strongest story is: ARIA does not simply chat about real estate; it routes the question to the right analytical agent, grounds the answer in the project outputs, visualizes the market signal, and explains the recommendation in business language.

Current live status:
- Live in Vercel: neighbourhood stats, XGBoost pricing, LightGBM risk, SHAP driver summaries, committed Prophet scenario forecasts, and committed RAG compliance handoff outputs.
- Conservative in Vercel: compliance prompts are analyst triage from committed RAG CSV/JSON outputs, not final legal advice and not live ChromaDB retrieval at request time.
- Notebook evidence: LangGraph demonstrates the multi-agent orchestration architecture; Vercel productionizes a compatible web demo flow.

Current answer-quality standard:
- Responses lead with a direct recommendation, then explain ARIA's reasoning, key evidence, visualizations, limitations, next actions, and sources.
- The live chat path sends recent conversation context to `/api/chat`, so follow-up prompts can resolve phrases such as "there", "those areas", and "same city" without repeating the previous answer.
- Single-city prompts stay inside the requested city. ARIA should not pivot from Paris to Athens, or Athens to Paris, unless the user explicitly asks for a cross-city comparison.
- Geographic prompts should return maps when usable coordinates or area-level data are available. Scatter and bubble charts are sanity-checked first; if points would overlap or collapse into one cluster, ARIA should use a clearer ranking, trend, map, or detail table.
- The UI includes `Chat Brief` export for a full conversation brief and `Project Brief` export for a reusable Markdown analyst instruction grounded in the current conversation.
- Response quality is regression-tested with `Stage 7 - UI Interface/vercel_vite_app/api/response-quality.eval.mjs`; representative answers are expected to score at least 97/100.

---

## System Architecture

```
User query (natural language)
↓
LangGraph Orchestrator ←────────────────── Human-in-the-loop approval
↓
┌───────────────────────────────────────────────────────┐
│ Agent 1: XGBoost Pricing       (Phase 2 — COMPLETE)   │
│  → Predicts fair nightly price per listing            │
│  → Paris R²=0.588 · Athens R²=0.676                   │
├───────────────────────────────────────────────────────┤
│ Agent 2: Prophet Demand Forecast (Phase 4 — COMPLETE) │
│  → 12-month occupancy forecast per neighbourhood      │
├───────────────────────────────────────────────────────┤
│ Agent 3: LightGBM Host Risk    (Phase 3 — COMPLETE)   │
│  → 865 priority targets: underpriced AND high-risk    │
│  → €1.43M revenue opportunity identified              │
├───────────────────────────────────────────────────────┤
│ Agent 4: RAG Compliance        (Phase 5 — COMPLETE)   │
│  → Local ChromaDB utility for AMA + Loi Le Meur rules │
│  → 137 unlicensed Athens listings as primary targets  │
├───────────────────────────────────────────────────────┤
│ Agent 5: LLM Listing Coach     (Phase 6 — COMPLETE)   │
│  → Uses SHAP values as context                        │
│  → Output: "Raise price by €X, improve Y feature"     │
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
│   ├── ARIA_EDA_v4_FINAL.ipynb        # Phase 1 — EDA (COMPLETE, A+/99)
│   ├── ARIA_XGBoost_v1.ipynb          # Phase 2 — Pricing models (COMPLETE, A/96)
│   ├── ARIA_LightGBM_v1.ipynb         # Phase 3 — Risk classifier (COMPLETE, A/95)
│   ├── ARIA_Prophet_v2.ipynb          # Phase 4 — Demand forecasting (COMPLETE)
│   ├── ARIA_RAG_v1.ipynb              # Phase 5 — RAG compliance agent (COMPLETE)
│   ├── ARIA_LangGraph_v1.ipynb        # Phase 6 — LangGraph orchestrator (COMPLETE)
│   └── eda_figures/                   # 40 generated charts and figures
├── data/
│   ├── raw/                           # Original source files — never modify
│   │   ├── gyodi_nawaro_2021/
│   │   ├── iab_athens_sept2025_listings.csv   #gitignored
│   │   ├── iab_paris_2025_listings.csv        #gitignored
│   │   └── maven_airbnb_listings_reviews.csv  #gitignored
│   ├── processed/                     # Produced by EDA notebook — gitignored
│   │   └── aria_mega_dataset_v4_1_final.csv
│   └── outputs/                       # Model outputs — join key: listing_id
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
├── rag/                               # Phase 5 — local ChromaDB utility + RAG agent
├── Stage 7 - UI Interface/            # Phase 7 — Vercel React UI and API backend
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

> **Note on `agents/`:** This folder is retained as documentation for the Phase 6 orchestration handoff. The executed Phase 6 orchestration work lives in `eda/ARIA_LangGraph_v1.ipynb` — a fully executed notebook with a 9-node StateGraph, `ARIAState` TypedDict, and MemorySaver checkpointing. The `Stage 7 - UI Interface/vercel_vite_app/api/` backend is the **productionisation layer** (Phase 7), not Phase 6.

---

## Pipeline Execution Order

All analytical phases are self-contained Jupyter notebooks in `eda/`. Run them in order — each phase produces output files consumed by the next.

| Step | Notebook | Produces | Required by |
|------|----------|----------|-------------|
| 1 | `ARIA_EDA_v4_FINAL.ipynb` | `data/processed/aria_mega_dataset_v4_1_final.csv` | All subsequent phases |
| 2 | `ARIA_XGBoost_v1.ipynb` | `paris_predictions_v1.csv`, `athens_predictions_v1.csv`, `athens_underpricing_v1.csv`, `shap_*.csv` | Phase 3, Phase 6 |
| 3 | `ARIA_LightGBM_v1.ipynb` | `athens_risk_scores_v1.csv` | Phase 6 |
| 4 | `ARIA_Prophet_v2.ipynb` | `prophet_paris_forecast_v1.csv`, `prophet_athens_forecast_v1.csv`, `prophet_*_v1.pkl` | Phase 6, Phase 7 demand agent |
| 5 | `ARIA_RAG_v1.ipynb` | `rag_unlicensed_report_v1.csv`, `rag_compliance_index_v1.json`, `aria_rag_session_log.json`; ChromaDB vector index local only (`rag/chroma_db/` is gitignored) | Phase 6 notebook, Phase 7 compliance triage |
| 6 | `ARIA_LangGraph_v1.ipynb` | Notebook memo/routing evaluation evidence | Phase 7 demo story |
| 7 | `Stage 7 - UI Interface/` | Live Vercel React app | End users |

**Relationship between Phase 6 and Phase 7:**

Phase 6 (`ARIA_LangGraph_v1.ipynb`) is the **orchestration research layer** — a fully executed LangGraph StateGraph that wires all specialist agents together, runs human-in-the-loop approval, generates a structured investor memo, and evaluates 12-query persona routing with 100% accuracy. It is the academic and technical core of ARIA's multi-agent architecture.

Phase 7 (`Stage 7 - UI Interface/vercel_vite_app/`) is the **productionisation layer** — a live Vercel React interface backed by server-side Vertex AI. It exposes the same analytical outputs to end users through a chat UI, scripted demo prompts, KPI cards, Leaflet maps, and PDF brief export. The Vercel `api/` backend serves the committed CSV outputs and is Phase 7's implementation of the front-end demo; it is not a replacement for Phase 6.

---

## Reproducibility Checks

Install the analytical Python environment:

```powershell
python -m pip install -r requirements.txt
```

Or create the equivalent Conda environment:

```powershell
conda env create -f environment.yml
conda activate aria-capstone
```

Install the locked Vercel frontend dependencies:

```powershell
cd "Stage 7 - UI Interface/vercel_vite_app"
npm ci
```

Validate the committed data/model evidence base with one command from the repository root:

```powershell
python scripts/validate_outputs.py
```

This command checks the schema, row counts, key numeric ranges, routing evidence, RAG corpus contract, model artifact presence, `requirements.txt`, `environment.yml`, and the frontend `package-lock.json`. The same check runs in GitHub Actions as `Output contract validation`.

---

## Dataset

| Source | City | Rows | Vintage |
|--------|------|------|---------|
| Maven Analytics | Paris | 63,520 | 2021 |
| Inside Airbnb | Paris | 57,289 | Sept 2025 |
| Inside Airbnb | Athens | 14,242 | Sept 2025 |
| **Total** | **Paris + Athens** | **135,051** | **2021–2025** |

Master dataset: `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns.

Large files (>50MB) are excluded from version control. See Data Access section below.

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
|------|----|-----|----------|------|
| Paris | 0.588 | €29.1 | +36% | Above published 0.52–0.58 range for 2021-vintage data |
| Athens | 0.676 | €29.1 | +44% | Target >0.65 PASSED |

Business output: 2,945 Athens listings underpriced >€15. Median gap €25. Total foregone revenue €4.8M/year.

**Output files:** `xgb_paris_v1.json` · `xgb_athens_v1.json` · `paris_predictions_v1.csv` · `athens_predictions_v1.csv` · `athens_underpricing_v1.csv` · `shap_paris_v1.csv` · `shap_athens_v1.csv`

---

### Phase 3 — LightGBM Host Risk Classifier (COMPLETE · Grade A/95)

**Notebook:** `ARIA_LightGBM_v1.ipynb`

Binary classifier predicting host churn risk for Athens listings. 11 features after leakage correction. 100-trial Optuna, 5-fold stratified CV.

**Note on leakage:** An earlier run produced AUC = 0.9995. Leakage was identified via SHAP, corrected, and documented. The honest AUC = 0.8288 reflects genuine discriminative power.

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| AUC-ROC | 0.8288 | >0.72 | PASSED |
| Avg Precision | 0.8864 | >0.65 | PASSED |
| Brier Score | 0.1656 | <0.25 | PASSED |
| CV stability | ±0.0088 | <0.02 | STABLE |

Business output: 865 listings flagged as both underpriced AND high-risk. Revenue opportunity: €1.43M potential (€0.71M realisable).

**Output files:** `lgb_athens_risk_v1.txt` · `athens_risk_scores_v1.csv`

---

### Phase 4 — Prophet Demand Forecasting (COMPLETE)

**Notebook:** `ARIA_Prophet_v2.ipynb`

Two Prophet scenario forecast outputs (Paris and Athens) estimate monthly occupied-night demand over a 12-month horizon by neighbourhood. The committed CSVs are now consumed by the live Vercel demand agent for forecast prompts. They should be presented as scenario-based demand forecasts, not guaranteed future booking calendars.

**Output files:** `prophet_paris_v1.pkl` · `prophet_athens_v1.pkl` · `prophet_paris_forecast_v1.csv` · `prophet_athens_forecast_v1.csv`

---

### Phase 5 — RAG Compliance Agent (COMPLETE)

**Notebook:** `ARIA_RAG_v1.ipynb` · **Location:** `rag/`

ChromaDB-ready corpus and local retrieval utility for AMA regulations (Athens) and Loi Le Meur (Paris). Given a listing or compliance query, the Phase 5 assets return the applicable regulation passage and compliance status. Primary targets: 137 unlicensed Athens listings (~EUR 1.03M annual revenue).

Production handoff note: the Vercel app now consumes committed JS-readable RAG handoff files for compliance triage: `rag_unlicensed_report_v1.csv`, `rag_compliance_index_v1.json`, and `aria_rag_session_log.json`. It does not run live ChromaDB retrieval at request time, and compliance output remains analyst triage rather than final legal advice. The reproducible local ChromaDB utility is `rag/chromadb_retriever.py`; generated index files are local only - `rag/chroma_db/` is gitignored.

RAG deployment status:

| Layer | Status | Evidence |
| --- | --- | --- |
| RAG corpus files | Committed | `data/outputs/rag_compliance_index_v1.json`, `data/outputs/rag_unlicensed_report_v1.csv`, `data/outputs/aria_rag_session_log.json`, `models/rag_corpus_v1.pkl` |
| Vercel compliance answers | Wired to RAG handoff outputs | `/api/chat` routes compliance prompts through `analytics-pipeline.js` and `complianceAnalysis()` |
| ChromaDB retrieval | Local reproducibility utility | `rag/chromadb_retriever.py`; generated `rag/chroma_db/` is gitignored |
| Live legal/vector retrieval | Not deployed intentionally | Compliance output is analyst triage, not final legal advice |

---

### Phase 6 — LangGraph Orchestrator (COMPLETE)

**Notebook:** `eda/ARIA_LangGraph_v1.ipynb`

A fully executed 9-node LangGraph `StateGraph` wiring all five specialist agents into a single directed graph with checkpointed state and human-in-the-loop approval. The notebook is the Phase 6 orchestration proof. The live Vercel app mirrors the orchestration concept in JavaScript and grounded API responses; it does not currently execute the Python LangGraph runtime.

**Architecture:**
- `ARIAState` TypedDict with 17 fields carrying persona, query, agent outputs, narrative, and approval state across nodes
- `MemorySaver` checkpointing with `interrupt_before=['hitl']` — satisfies KPMG Trusted AI human-in-the-loop requirement
- All 5 specialist tools implemented as pure functions loading real Phase 2–5 output files via `listing_id` join key
- 9 explicit nodes: `classify_persona` → `run_pricing` → `run_forecast` → `run_risk` → `run_rag` → `run_coach` → `hitl` → `synthesise` → `export_pdf`

**Validated outputs (present as notebook evidence unless separately committed):**
- 5-section persona-aware investor memo generated in cell output
- `aria_investor_brief.pdf` confirmed generated
- 12-query routing evaluation: 100% persona classification accuracy, 100% specialist recall
- 2 embedded figures (255 KB + 205 KB)
- 96/96 rubric score

> The `agents/` folder is retained as documentation for the orchestration handoff. The Phase 6 deliverable is the executed notebook, not a separate production LangGraph service.

---

### Phase 7 — Vercel React UI (COMPLETE)

**Location:** `Stage 7 - UI Interface/vercel_vite_app/`

ChatGPT-style multi-agent interface deployed live on Vercel. Auto Agent routing across 5 KPMG agents. Features: 8 scripted demo prompts, KPI cards, Recharts visuals, Leaflet maps, LangGraph-style reasoning traces, persistent localStorage conversations, `Chat Brief` PDF-style export, `Project Brief` Markdown export, and a default Gemini 2.5 Pro model path with Gemini and Claude Vertex options.

The live backend (`api/chat.js` + `api/analytics-pipeline.js`) builds a verified analytics pack before calling Vertex AI. It resolves follow-up context, respects requested geography, selects visuals by intent, adds KPI explanations, attaches source files, and falls back to deterministic answer templates when the model output is incomplete or not structured enough for a business user.

**Live:** [capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

---

## Data Access

| File | Source | Local path |
|------|--------|-----------|
| Maven Analytics Paris 2021 | [mavenanalytics.io/data-playground](https://mavenanalytics.io/data-playground) | `data/raw/maven_airbnb_listings_reviews.csv` |
| Inside Airbnb Paris 2025 | [insideairbnb.com/get-the-data](https://insideairbnb.com/get-the-data) → Paris | `data/raw/iab_paris_2025_listings.csv` |
| Inside Airbnb Athens Sept 2025 | Same page → Athens → September 2025 | `data/raw/iab_athens_sept2025_listings.csv` |
| Gyodi & Nawaro 2021 | [zenodo.org/record/4446043](https://zenodo.org/record/4446043) | `data/raw/gyodi_nawaro_2021/` |

Gyodi & Nawaro — download 4 files: `athens_weekdays.csv`, `athens_weekends.csv`, `paris_weekdays.csv`, `paris_weekends.csv`

**Master dataset:** Run `ARIA_EDA_v4_FINAL.ipynb` end-to-end once. It saves `aria_mega_dataset_v4_1_final.csv` to `data/processed/` automatically.

---

## Key Output Files

| File | Phase | Contents |
|------|-------|----------|
| `paris_predictions_v1.csv` | 2 | Predicted fair price, actual price, gap — all Paris listings |
| `athens_predictions_v1.csv` | 2 | Same for Athens |
| `athens_underpricing_v1.csv` | 2 | 2,945 listings where predicted price exceeds actual by >€15 |
| `shap_paris_v1.csv` | 2 | Per-feature SHAP values for Paris holdout |
| `shap_athens_v1.csv` | 2 | Per-feature SHAP values for Athens holdout |
| `athens_risk_scores_v1.csv` | 3 | `risk_probability` (0–1), `risk_band`, `high_risk_flag` |
| `prophet_paris_forecast_v1.csv` | 4 | 12-month occupancy forecast — Paris |
| `prophet_athens_forecast_v1.csv` | 4 | 12-month occupancy forecast — Athens |
| `rag_unlicensed_report_v1.csv` | 5 | JS-readable RAG compliance handoff for unlicensed-listing triage |
| `rag_compliance_index_v1.json` | 5 | Compliance source index consumed by the Vercel analyst-triage path |
| `aria_rag_session_log.json` | 5 | RAG notebook session evidence for compliance prompts |
| `aria_session_log.json` | 6 | LangGraph orchestration session evidence |
| `aria_routing_eval.csv` | 6 | Persona-routing evaluation evidence |
| `aria_investor_brief.pdf` | 6 | Generated investor-brief artifact from the orchestration notebook |

**Priority target list (865 listings):** Cross-reference of `athens_underpricing_v1.csv` and `athens_risk_scores_v1.csv` on `listing_id`. Underpriced AND declining — €1.43M revenue opportunity.

For model artifact governance and metrics, see [`models/MODEL_CARD.md`](models/MODEL_CARD.md).

For MLOps hygiene review, see [`docs/MLOPS_REPO_REVIEW.md`](docs/MLOPS_REPO_REVIEW.md).

---

## Project Phases & Status

| Phase | Notebook | Status |
|-------|----------|--------|
| Phase 1 — EDA | `ARIA_EDA_v4_FINAL.ipynb` | Done |
| Phase 2 — XGBoost Pricing | `ARIA_XGBoost_v1.ipynb` | Done |
| Phase 3 — LightGBM Risk | `ARIA_LightGBM_v1.ipynb` | Done |
| Phase 4 — Prophet Forecasting | `ARIA_Prophet_v2.ipynb` | Done |
| Phase 5 — RAG Compliance | `ARIA_RAG_v1.ipynb` | Done |
| Phase 6 — LangGraph Orchestrator | `ARIA_LangGraph_v1.ipynb` | Done |
| Phase 7 — Vercel React UI | `Stage 7 - UI Interface/vercel_vite_app/` | Done · Live |
