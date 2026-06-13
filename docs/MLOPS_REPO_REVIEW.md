# ARIA Repository Organization and MLOps Review

Date: 2026-06-13

This review checks whether the ARIA repository is organized clearly and whether it follows practical MLOps practices for a capstone demo that includes notebooks, model artifacts, data outputs, a Vercel React application, and a server-side Vertex AI backend.

## Executive Summary

The repository is understandable and demo-ready, but it is not yet fully MLOps-clean.

The strongest parts are:
- Clear phase folders: `eda/`, `data/`, `models/`, `rag/`, `agents/`, `Stage 7 - UI Interface/`, and `docs/`.
- Live UI code is now grouped under `Stage 7 - UI Interface/vercel_vite_app/`.
- The Vercel backend is separated under `Stage 7 - UI Interface/vercel_vite_app/api/`.
- `.env` is ignored and `.env.example` now documents required secret names without exposing values.
- A basic GitHub Actions workflow now builds the Vite application and compiles the Streamlit host.

The main MLOps gaps are:
- Large generated CSV outputs are still tracked as normal Git blobs.
- Some generated model artifacts are tracked directly in `models/`.
- The remote repository contains non-source files such as `DS_Store`.
- There is no formal data versioning layer such as DVC (Data Version Control), lake storage, or model registry.
- Notebook outputs are large and should eventually be paired with reproducible scripts or pipelines.

## Current Folder Assessment

| Folder | Current Role | Assessment |
|---|---|---|
| `data/raw/` | Small raw source extracts and sample external data | Correct conceptually, but raw data should be immutable and large files should stay outside normal Git. |
| `data/processed/` | Prepared neighbourhood-level summary CSV files | Good for demo because files are small and used by the Vercel backend. Larger processed datasets should remain external. |
| `data/outputs/` | Model outputs used by UI and analysis | Useful for demo, but some files are large enough that they should be in DVC, Git LFS, or cloud storage rather than normal Git. |
| `eda/` | Jupyter notebooks and generated figures | Good exploratory home. Long term, convert critical notebook steps into `src/` or `pipelines/` scripts. |
| `models/` | Trained model artifacts | Correct location, but generated binary/model artifacts need versioning policy. Avoid duplicating notebooks here. |
| `agents/` | Planned LangGraph orchestration layer | Correct roadmap folder. Current deployed orchestration is still in Vercel API functions. |
| `rag/` | Planned Retrieval-Augmented Generation compliance layer | Correct roadmap folder. ChromaDB indexes must stay out of Git. |
| `Stage 7 - UI Interface/` | UI, prototype, Streamlit host, Vercel React app | Now well grouped. This is the right place for UI-specific code and deployment notes. |
| `docs/` | Mentor summaries, methodology, and planning documents | Good. Keep session logs in `agent.md`, not README files. |
| `.devcontainer/` | Cloud/dev setup | Updated to point at current Stage 7 paths. |
| `.github/workflows/` | Continuous integration | Added lightweight build/smoke checks. |

## Findings

### High Priority

1. Large CSV files are tracked as normal Git blobs.

Examples from the current remote tree:
- `data/outputs/paris_predictions_v1.csv` is about 54 MB.
- `data/outputs/athens_predictions_v1.csv` is about 19 MB.

Why this matters: large generated data files make cloning slow, increase repository size permanently, and make model/data versioning difficult. `.gitattributes` says CSV files should use Git LFS, but the remote tree shows these files as normal blobs, so LFS is not actually protecting the repository history for them.

Recommended fix:
- Keep small demo summary CSVs in Git, such as `neighbourhood_stats_combined_v4.csv`.
- Move larger prediction outputs to Git LFS, DVC, Google Cloud Storage, or another controlled artifact store.
- Keep a small sample file in Git for CI and demos.

2. Model artifacts are tracked directly without a registry policy.

Current model files include:
- `models/xgb_paris_v1.json`
- `models/xgb_athens_v1.json`
- `models/lgb_athens_risk_v1.txt`

The remote branch also includes Prophet pickle files, while `.gitignore` already excludes `*.pkl`. That means the repository policy and the current remote contents disagree.

Recommended fix:
- Decide which model artifacts are small/stable enough for Git.
- Keep binary or large model files in an external artifact store.
- Add a `models/MODEL_CARD.md` file documenting model version, training data, metrics, features, limitations, and owner.

3. Development environment config was stale.

The devcontainer previously opened and ran deleted root-level Streamlit paths. It has now been updated to the current Stage 7 paths.

Why this matters: broken dev onboarding is an MLOps risk because collaborators cannot reproduce the demo environment reliably.

### Medium Priority

4. Notebook-first workflow needs a reproducible pipeline layer.

The notebooks document the analysis well, but production MLOps expects repeatable scripts or pipeline tasks.

Recommended target:
- `src/data/` for data preparation scripts.
- `src/features/` for feature engineering.
- `src/models/` for training and evaluation.
- `pipelines/` for end-to-end commands.
- `notebooks/` or `eda/` for exploration only.

5. CI coverage is still light.

The new GitHub Actions workflow checks the UI build and Streamlit syntax, but it does not validate model metrics, data schemas, or API response shape yet.

Recommended next checks:
- Validate that required CSV columns exist.
- Validate that `/api/chat` returns `answer`, `kpis`, `visualizations`, and `details`.
- Add a small fixture dataset so tests do not need full production CSV files.
- Add notebook smoke tests only for converted scripts, not full heavyweight notebooks.

6. Data schema contracts are implicit.

The Vercel analytics pipeline assumes columns such as `neighbourhood`, `median_price_eur`, `opportunity_score`, `risk_probability`, and `underpricing_gap_eur`. These should be documented as contracts.

Recommended fix:
- Add `data/README.md` or `docs/DATA_CONTRACT.md`.
- Include required columns, source file purpose, row grain, join keys, and freshness rules.

### Low Priority

7. Generated OS files are still visible in the remote tree.

The remote branch includes `data/raw/DS_Store`, and local ignored files include `eda/.DS_Store`.

Recommended fix:
- Remove these from Git tracking.
- The `.gitignore` has been updated to block both `.DS_Store` and `DS_Store` variants going forward.

8. Some documents are duplicated across folders.

Example: `KPMG EDA document.docx` appears under both `docs/` and `eda/` locally.

Recommended fix:
- Keep final written deliverables in `docs/`.
- Keep notebooks and generated analysis figures in `eda/`.
- Avoid storing the same document in both places.

## Recommended Target Structure

```text
capstone_project_kpmg/
├── README.md
├── agent.md
├── .env.example
├── .github/workflows/ci.yml
├── data/
│   ├── README.md
│   ├── raw/                 # small raw samples only, large files external
│   ├── processed/           # small demo-ready summaries
│   └── outputs/             # small checked-in outputs; large outputs in artifact storage
├── docs/
│   ├── PROJECT_SUMMARY.md
│   ├── MENTOR_MEETING_SUMMARY.md
│   └── MLOPS_REPO_REVIEW.md
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb
│   ├── ARIA_XGBoost_v1.ipynb
│   ├── ARIA_LightGBM_v1.ipynb
│   ├── ARIA_Prophet_v1.ipynb
│   └── eda_figures/
├── models/
│   ├── MODEL_CARD.md
│   └── small checked-in model artifacts only
├── agents/
│   └── README.md
├── rag/
│   └── README.md
└── Stage 7 - UI Interface/
    ├── README.md
    ├── streamlit_app/
    └── vercel_vite_app/
        ├── api/
        ├── public/
        └── src/
```

## MLOps Compliance Checklist

| Area | Current Status | Recommendation |
|---|---|---|
| Secret management | Good | `.env` ignored; `.env.example` added. Keep service account JSON only in Vercel/local secrets. |
| Data versioning | Partial | Use Git only for small summaries; move large generated CSVs to LFS/DVC/cloud storage. |
| Model versioning | Partial | Add model cards and external artifact storage for large/binary models. |
| Reproducibility | Partial | Convert core notebook logic into scripts/pipelines over time. |
| CI/CD | Started | GitHub Actions workflow added for Vite build and Streamlit smoke check. Add schema/API tests next. |
| Folder organization | Mostly good | Stage 7 is now organized; remove OS files and avoid duplicate docs/notebooks. |
| Deployment | Good for demo | Root `vercel.json` points to the nested Vite app; Vercel env vars handle Vertex authentication. |
| Monitoring | Not started | Add API error logging and usage/cost monitoring for Vertex after demo stabilization. |

## Immediate Cleanup Plan

1. Remove tracked `DS_Store` files from Git.
2. Decide artifact policy for large CSV/model files.
3. Move large generated outputs to Git LFS, DVC, or Google Cloud Storage.
4. Add `data/README.md` or `docs/DATA_CONTRACT.md`.
5. Add `models/MODEL_CARD.md`.
6. Add API/schema tests using small fixture CSVs.
7. Keep the Vercel app under `Stage 7 - UI Interface/vercel_vite_app/` and avoid adding UI files back to the repository root.
