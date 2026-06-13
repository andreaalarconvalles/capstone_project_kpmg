# Phase 7 — UI Notes and Legacy Streamlit Plan

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and current operating rules:** [`../../agent.md`](../../agent.md)

This folder keeps the original Phase 7 three-tab Streamlit MVP notes. The current public demo now lives in `Stage 7 - UI Interface/vercel_vite_app/` and is deployed on Vercel as a React chat interface with scripted prompts, KPI cards, adaptive charts, real map overlays where geography is available, persistent conversations, PDF brief export, and a server-side Vertex AI `/api/chat` backend.

The three-tab Streamlit version remains useful as a future analyst dashboard concept:

Tab 1 — Investor: neighbourhood opportunity map, yield calculator, risk heatmap, Prophet forecast (Phase 4 placeholder)
Tab 2 — Host: underpricing gap, SHAP breakdown, risk score, 3-action coaching plan, LLM recommendation (Phase 6 placeholder)
Tab 3 — Developer: sweet-spot map, 12 entry-point neighbourhoods, gross yield by zone

Primary data sources: athens_risk_scores_v1.csv · athens_underpricing_v1.csv
The 865 priority listings (underpriced AND high-risk) are the centrepiece of the host tab.

Current implementation status:
- Vercel React chat UI is the demo path for mentor/KPMG conversations.
- Streamlit host remains optional under `Stage 7 - UI Interface/streamlit_app/`.
- Custom typed prompts call live GitHub CSV outputs through the Vercel backend when Vertex authentication is configured.
