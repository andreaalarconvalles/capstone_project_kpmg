# ARIA — Agentic Real-estate Intelligence Advisor

**KPMG Capstone Project · Group 4**

**ARIA** — Agentic Real-estate Intelligence Advisor — is a two-model intelligence system for Airbnb hosts in Athens and Paris. It combines an XGBoost price-prediction engine that surfaces underpricing gaps with a LightGBM classifier that flags hosts at risk of churn — delivering actionable revenue and retention intelligence from four integrated data sources.

---

## Phase Status Board

| Phase | Title | Status | Owner | Output file(s) |
|-------|-------|--------|-------|----------------|
| 1 | Data Ingestion & Preprocessing | ✅ Done | Group 4 | `data/processed/aria_mega_dataset_v4_1_final.csv` |
| 2 | Exploratory Data Analysis | ✅ Done | Group 4 | `eda/ARIA_EDA_v4_FINAL.ipynb`, `KPMG EDA document.docx` |
| 3 | Modelling (XGBoost + LightGBM) | ✅ Done | Group 4 | `models/xgb_athens_v1.json`, `models/xgb_paris_v1.json`, `models/lgb_athens_risk_v1.txt` |
| 4 | Agentic RAG System | 🔄 In Progress | Group 4 | TBD |

---

## Dataset Table

| Source | File | Rows | Vintage | Contents |
|--------|------|------|---------|----------|
| Inside Airbnb — Athens | `iab_athens_sept2025_listings.csv.csv` | 15,584 | Sept 2025 | Listings, host attributes, pricing, availability |
| Inside Airbnb — Paris | `iab_paris_2025_listings.csv.csv` | 81,853 | 2025 | Listings, host attributes, pricing, availability |
| Maven Analytics Airbnb | `maven_airbnb_listings_reviews.csv.csv` | 279,712 | 2024 | Reviews and listing metadata (multi-city) |
| Gyodi & Nawaro (2021) | `gyodi_nawaro_2021/*.csv` | 11,968 | 2021 | Academic pricing study — Athens & Paris weekday/weekend splits |

**Merged processed dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 rows × 96 columns (Paris: 120,809 · Athens: 14,242)

> **Note:** Raw files carry a double `.csv.csv` extension — this is an artifact of how they were originally saved. Reference the filenames exactly as shown above.

---

## Project Structure

All notebooks resolve paths relative to:

```
Path.home() / "Desktop" / "KPMG Capstone"
```

Clone or place your working folder there exactly — any other name breaks every path from line 1.

```
Desktop/
└── KPMG Capstone/
    ├── data/
    │   ├── raw/
    │   │   ├── iab_athens_sept2025_listings.csv.csv
    │   │   ├── iab_paris_2025_listings.csv.csv
    │   │   ├── maven_airbnb_listings_reviews.csv.csv
    │   │   └── gyodi_nawaro_2021/
    │   │       ├── athens_weekdays.csv
    │   │       ├── athens_weekends.csv
    │   │       ├── paris_weekdays.csv
    │   │       └── paris_weekends.csv
    │   ├── processed/
    │   │   ├── aria_mega_dataset_v4_1_final.csv
    │   │   ├── neighbourhood_stats_athens_v4.csv
    │   │   ├── neighbourhood_stats_paris_v4.csv
    │   │   └── neighbourhood_stats_combined_v4.csv
    │   └── outputs/
    │       ├── athens_predictions_v1.csv
    │       ├── athens_risk_scores_v1.csv
    │       ├── athens_underpricing_v1.csv
    │       ├── paris_predictions_v1.csv
    │       ├── shap_athens_v1.csv
    │       └── shap_paris_v1.csv
    ├── eda/
    │   ├── ARIA_EDA_v4_FINAL.ipynb
    │   ├── ARIA_XGBoost_v1.ipynb
    │   ├── ARIA_LightGBM_v1.ipynb
    │   └── eda_figures/
    ├── models/
    │   ├── xgb_athens_v1.json
    │   ├── xgb_paris_v1.json
    │   └── lgb_athens_risk_v1.txt
    └── KPMG EDA document.docx
```

The GitHub repo mirrors this under `eda/` and `models/` — raw data is excluded via `.gitignore`.

---

## Data Access

Raw data is not committed to the repository. Download each source and place it at the exact path shown in the Project Structure above.

| Source | Where to get it |
|--------|----------------|
| **Inside Airbnb — Athens (Sept 2025)** | [insideairbnb.com/get-the-data](http://insideairbnb.com/get-the-data/) → Athens → September 2025 snapshot → `listings.csv` |
| **Inside Airbnb — Paris (2025)** | [insideairbnb.com/get-the-data](http://insideairbnb.com/get-the-data/) → Paris → 2025 snapshot → `listings.csv` |
| **Maven Analytics Airbnb dataset** | [mavenanalytics.io/data-playground](https://www.mavenanalytics.io/data-playground) → search "Airbnb" → download listings + reviews CSV |
| **Gyodi & Nawaro (2021)** | Harvard Dataverse — search "Gyodi Nawaro Airbnb 2021" for the Athens/Paris weekday/weekend pricing study |

---

## Models

### Model 1 — XGBoost Price Predictor

| Attribute | Detail |
|-----------|--------|
| Target | `log_price` (log1p of `price_eur`) |
| Task | Regression — price prediction |
| Cities | Paris + Athens |
| Features | 26 (capacity, bedrooms, amenities, distance, host quality, review signals, interaction and distance-decay engineered features) |
| Output | Predicted fair-market price → underpricing gap per listing |
| Saved models | `models/xgb_paris_v1.json`, `models/xgb_athens_v1.json` |

The underpricing gap is computed as `exp(predicted_log_price) - actual_price_eur`. Negative gaps identify listings priced below their predicted fair value.

### Model 2 — LightGBM Host Risk Classifier

| Attribute | Detail |
|-----------|--------|
| Target | `at_risk_host` (binary — host churn risk) |
| Task | Binary classification |
| City | Athens only |
| Features | 11 (after Phase 3 leakage discovery; see note below) |
| AUC-ROC | **0.8288** (holdout) |
| Risk threshold | 0.70 — listings above this probability are flagged high-risk |
| Saved model | `models/lgb_athens_risk_v1.txt` |

**Phase 3 leakage discovery:** An initial candidate set of features included `availability_365` and `review_scores_rating_norm`. Both directly encode the label conditions used to construct `at_risk_host` (availability > 200 days and rating < 8.0). These were removed before training. The final 11-feature set is leakage-free; the AUC of 0.8288 is an honest holdout estimate.

The 11 retained features are: `review_velocity_l30d`, `review_score_composite`, `review_growth_24_25`, `host_multi_listing`, `amenity_count`, `host_tenure_days`, `is_superhost_int`, `dist_km`, `person_capacity`, `reviews_per_month`, `room_type_encoded`.

---

## Key Outputs

| File | Contents |
|------|----------|
| `data/outputs/athens_predictions_v1.csv` | XGBoost fair-market price predictions for Athens listings |
| `data/outputs/paris_predictions_v1.csv` | XGBoost fair-market price predictions for Paris listings |
| `data/outputs/athens_underpricing_v1.csv` | Athens listings with computed underpricing gap (predicted − actual price in EUR) |
| `data/outputs/athens_risk_scores_v1.csv` | LightGBM `at_risk_host` probability scores for all Athens listings |
| `data/outputs/shap_athens_v1.csv` | SHAP feature attributions per listing — Athens (both models) |
| `data/outputs/shap_paris_v1.csv` | SHAP feature attributions per listing — Paris (XGBoost) |

These outputs feed Phase 4's agentic RAG layer, which translates model scores into natural-language host recommendations.

---

## Session Log

> Rule: update every 5 prompts. Format — date · session summary · key decisions.

| Date | Session | Key decisions |
|------|---------|---------------|
| 2026-06-09 | README v1 authored from scratch | Canonical project name set to "Agentic Real-estate Intelligence Advisor" (ARIA); LightGBM target corrected to `at_risk_host`; path corrected to `Desktop/KPMG Capstone`; leakage discovery and honest AUC documented; Data Access section added; Key Outputs completed |
