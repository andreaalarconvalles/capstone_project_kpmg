# ARIA Data Folder

This folder contains the data files used by the ARIA capstone analysis and the Vercel demo.

Agent handoff and current operating rules live in [`../agent.md`](../agent.md). Read that file before changing data contracts used by the Vercel backend.

## Folder Rules

| Folder | Purpose | Git Policy |
|---|---|---|
| `raw/` | Immutable source extracts from Maven Analytics, Inside Airbnb, and Gyodi & Nawaro. | Keep only small source files or samples in Git. Large raw files stay external. |
| `processed/` | Cleaned or aggregated data created by the notebooks. | Small summary files can be committed if they are needed by the demo. Large processed datasets stay external. |
| `outputs/` | Model outputs such as predictions, SHAP values, risk scores, and forecasts. | Keep only demo-critical or small outputs in Git. Large outputs should move to Git LFS, DVC, or cloud storage. |

## Current Demo Data Contracts

The Vercel backend in `Stage 7 - UI Interface/vercel_vite_app/api/analytics-pipeline.js` reads these files from raw GitHub URLs:

| File | Grain | Required Columns | Used For |
|---|---|---|---|
| `data/processed/neighbourhood_stats_combined_v4.csv` | One row per city-neighbourhood summary | `city`, `neighbourhood`, `n_listings`, `median_price_eur`, `mean_price_eur`, `mean_occupancy`, `mean_revenue_eur`, `mean_dist_km`, `supply_demand_imbalance`, `competitive_saturation_score`, `opportunity_score`, `price_confidence`, `dist_zone` | Market-entry, family/safety proxy, affordability, demand proxy, portfolio comparison, region-map visuals |
| `data/outputs/athens_underpricing_v1.csv` | One row per underpriced Athens listing | `listing_id`, `neighbourhood`, `underpricing_gap_eur`, `actual_price_eur`, `predicted_price_eur` | Athens pricing opportunity and priority overlap |
| `data/outputs/athens_risk_scores_v1.csv` | One row per Athens listing risk score | `listing_id`, `neighbourhood`, `risk_probability`, `high_risk_flag` | Host/listing risk analysis and priority review queue |
| `data/outputs/paris_predictions_v1.csv` | One row per Paris listing prediction | `neighbourhood` or `district`, `actual_price_eur`, `predicted_price_eur`, `prediction_gap_eur` | Paris pricing opportunity |
| `data/outputs/shap_athens_v1.csv` | One row per Athens holdout listing | SHAP feature columns plus optional listing identifier | Athens pricing driver summaries |
| `data/outputs/shap_paris_v1.csv` | One row per Paris holdout listing | SHAP feature columns plus optional listing identifier | Paris pricing driver summaries |

## Join Key

`listing_id` is the universal join key across listing-level outputs when available.

## Data Hygiene Notes

- Do not edit raw source files manually.
- Do not commit local secrets, service account JSON, or API keys.
- Do not commit ChromaDB indexes or other generated vector stores.
- Avoid committing large generated CSVs directly to Git. Use a controlled artifact store for large files.
- If a data file is used by the live Vercel demo, keep its schema stable or update the backend contract at the same time.
- Geographic prompts should use real boundary/coordinate data where available. If a real boundary source is missing, the UI should say so clearly instead of rendering fake region tiles.
