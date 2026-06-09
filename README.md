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

## Key Outputs

- **Price predictions** with SHAP explanations for each listing (Paris + Athens)
- **Risk scores** flagging underpriced or high-opportunity Athens listings
- **Underpricing gap analysis** — estimated revenue left on the table per listing
- **Neighbourhood-level benchmarks** for competitive positioning
- **Cross-city SHAP comparison** — which features drive price differently between Paris and Athens

---

## Getting Started

### Prerequisites

```bash
pip install pandas numpy scikit-learn xgboost lightgbm shap optuna matplotlib seaborn jupyter
```

### Run Order

1. **EDA:** `eda/ARIA_EDA_v4_FINAL.ipynb`
   - Must be run first; establishes feature engineering decisions used downstream.

2. **XGBoost Models:** `eda/ARIA_XGBoost_v1.ipynb`
   - Requires the EDA notebook to have been run; reads `aria_mega_dataset_v4_1_final.csv`.

3. **LightGBM Risk Model:** `eda/ARIA_LightGBM_v1.ipynb`
   - Athens risk classification; reads processed dataset and XGBoost outputs.

---

## Data Access

Raw and processed data files exceed GitHub's 100MB file limit and are excluded from this repo. To reproduce the full pipeline:

1. Download **Maven Analytics Paris Airbnb dataset** from [Maven Analytics Data Playground](https://www.mavenanalytics.io/data-playground)
2. Download **Inside Airbnb listings** for Paris and Athens from [insideairbnb.com/get-the-data](http://insideairbnb.com/get-the-data/)
3. Download **Gyodi & Nawaro (2021)** demand signal data
4. Place files in `data/raw/` following the structure above
5. Run the EDA notebook to regenerate `aria_mega_dataset_v4_1_final.csv`

---

## Project Context

This capstone was developed as part of the **IE Business School Master's program** in partnership with **KPMG Spain**. The project addresses real-world STR market intelligence needs faced by institutional clients, combining rigorous data engineering with interpretable machine learning to support pricing, investment, and regulatory decisions.

**Team:** Luka Cheishvili et al.  
**Academic Year:** 2025–2026  
**Partner:** KPMG Spain

---

## License

This project is for academic and research purposes. All data sources are publicly available under their respective licenses. Model outputs and methodology are proprietary to the project team.
