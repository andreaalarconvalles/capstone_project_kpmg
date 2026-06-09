# ARIA — Airbnb Revenue Intelligence & Analytics
### IE Business School × KPMG Spain · Corporate Capstone 2026

---

## Overview

**ARIA** (Airbnb Revenue Intelligence & Analytics) is a machine learning–driven pricing and risk intelligence platform for the short-term rental (STR) market. Built as a corporate capstone project in partnership with **KPMG Spain**, ARIA targets three primary personas: institutional investors, property managers/hosts, and real estate developers seeking to make data-driven decisions in the Paris and Athens STR markets.

The project combines exploratory data analysis, XGBoost price prediction models, a LightGBM risk classification model, and SHAP-based explainability to deliver actionable insights across **135,051 listings** spanning two European cities.

---

## Project Structure

```
Final Capstone/
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb        # Full exploratory data analysis
│   ├── ARIA_XGBoost_v1.ipynb          # XGBoost price prediction (Paris + Athens)
│   ├── ARIA_LightGBM_v1.ipynb         # LightGBM risk classification (Athens)
│   └── eda_figures/                   # All generated charts and visualizations
├── data/
│   ├── raw/
│   │   ├── gyodi_nawaro_2021/         # Demand signal data (weekday/weekend)
│   │   ├── iab_athens_sept2025_listings.csv.csv   # Inside Airbnb Athens (Sept 2025)
│   │   ├── iab_paris_2025_listings.csv.csv        # Inside Airbnb Paris (2025)
│   │   └── maven_airbnb_listings_reviews.csv.csv  # Maven Analytics Paris (2021)
│   ├── processed/
│   │   ├── aria_mega_dataset_v4_1_final.csv       # Master merged dataset (135K rows × 96 cols)
│   │   └── neighbourhood_stats_*.csv              # Neighbourhood-level aggregates
│   └── outputs/
│       ├── athens_predictions_v1.csv
│       ├── athens_risk_scores_v1.csv
│       ├── athens_underpricing_v1.csv
│       ├── paris_predictions_v1.csv
│       ├── shap_athens_v1.csv
│       └── shap_paris_v1.csv
├── models/
│   ├── xgb_paris_v1.json              # Trained XGBoost model — Paris
│   ├── xgb_athens_v1.json             # Trained XGBoost model — Athens
│   └── lgb_athens_risk_v1.txt         # Trained LightGBM risk model — Athens
├── 00 extra document/                 # Supporting methodology docs
├── ARIA_KPMG_Capstone_Master_Planner.html
├── Capstone_Ideas_Proposal - Luka.html
├── KPMG Capstone.pdf
└── KPMG Proposal - Regulators.pdf
```

---

## Dataset

| Source | City | Rows | Vintage |
|---|---|---|---|
| Maven Analytics | Paris | 63,520 | 2021 |
| Inside Airbnb | Paris | 57,289 | Sept 2025 |
| Inside Airbnb | Athens | 14,242 | Sept 2025 |
| **Total** | **Paris + Athens** | **135,051** | **2021–2025** |

**Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns

> ⚠️ Large raw and processed CSV files (>50MB) are excluded from version control via `.gitignore`. See the [Data](#data-access) section below.

---

## Models

### XGBoost Price Prediction
- **Scope:** Paris and Athens, separate models per city
- **Target:** `log_price = log1p(price_eur)` (back-transformed with `expm1()`)
- **Features:** 26 (location, host quality, demand signals, neighbourhood context, interaction terms)
- **Tuning:** Optuna Bayesian hyperparameter optimization
- **Explainability:** SHAP values for per-listing feature attribution

### LightGBM Risk Classification (Athens)
- **Scope:** Athens market
- **Target:** Binary underpricing/risk flag
- **Tuning:** Optuna with ROC-AUC objective
- **Outputs:** Risk scores, SHAP dependence plots, beeswarm summaries

---

## Project Phases & Team Assignments

> This section is the live status board for the project. The agent updates it whenever a phase is completed or progresses.

| Phase | Owner | Description | Status |
|---|---|---|---|
| **Phase 1 — EDA** | Member 1 | Full exploratory data analysis on the mega dataset (135K listings, Paris + Athens). All feature engineering decisions established here. | ✅ Done |
| **Phase 2 — XGBoost** | Member 1 | Price prediction models for Paris and Athens (26 features, Optuna tuning, SHAP). Output: `paris_predictions_v1.csv`, `athens_predictions_v1.csv`, `shap_*.csv`. | ✅ Done |
| **Phase 3 — LightGBM** | Member 1 | Athens underpricing risk classification (Optuna, ROC-AUC). Output: `athens_risk_scores_v1.csv`, `athens_underpricing_v1.csv`. | ✅ Done |
| **Phase 4 — Prophet** | Member 2 | Time-series demand forecasting notebook. Uses mega dataset + `prophet_training_eligible` filter. Does not touch XGBoost or LightGBM. Output: 2 `.pkl` model files + 2 forecast CSVs. | 🔲 Not started |
| **Phase 5 — RAG Compliance** | Member 3 | Compliance agent using AMA regulatory documents + 137 unlicensed listing IDs from mega dataset. Builds a ChromaDB index independently. Does not touch any model files. | 🔲 Not started |
| **Phase 6 — LangGraph Orchestrator** | Member 4 | Loads all saved model files and CSVs and orchestrates them into a single agent pipeline. Requires Phases 1–5 to be complete (or mocked). | 🔲 Not started |
| **Phase 7 — Streamlit MVP** | Member 5 | Full UI layer reading `athens_risk_scores_v1.csv`, `athens_underpricing_v1.csv`, and Prophet forecast CSV. Does not need model files. Can start now with placeholder data. | 🔲 Not started |
| **Documentation + Presentation** | Member 6 | Methodology document, KPMG presentation slides, and project summary. | 🔲 Not started |

### Status Key
- ✅ Done — complete and output files committed
- 🔄 In progress — actively being worked on
- 🔲 Not started — not yet begun
- ⏳ Blocked — waiting on another phase

---

## Key Outputs

- **Price predictions** with SHAP explanations for each listing (Paris + Athens)
- **Risk scores** flagging underpriced or high-opportunity Athens listings
- **Underpricing gap analysis** — estimated re