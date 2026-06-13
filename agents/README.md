# Phase 6 — LangGraph Orchestrator

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and current operating rules:** [`../agent.md`](../agent.md)

Target architecture: a LangGraph directed graph with 5 specialist agent nodes. It receives a natural language query, identifies the persona (investor/host/developer), routes to the appropriate agents, and passes outputs to a narrative model for synthesis.

Nodes: XGBoost pricing · Prophet forecast · LightGBM risk · RAG compliance · LLM coach
Join key across all CSV inputs: listing_id
Requires Phases 1–5 complete (or mocked). Start with mock outputs and swap in real files when ready.

Current deployed implementation:
- The live Vercel demo uses an orchestrator-style backend in `Stage 7 - UI Interface/vercel_vite_app/api/`.
- `api/chat.js` handles server-side Vertex AI authentication and calls Gemini.
- `api/analytics-pipeline.js` classifies prompts, fetches raw GitHub CSV outputs, caches data in memory, computes grounded statistics, selects chart/map payloads, and returns KPIs plus methodology/source details.
- This is a production-demo bridge, not the final LangGraph package. The final Phase 6 work should move the same responsibilities into explicit LangGraph nodes with human-in-the-loop approval, persistent state tests, map/chart response tests, and a cleaner test harness.
