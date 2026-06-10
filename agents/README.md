# Phase 6 — LangGraph Orchestrator

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

LangGraph directed graph with 5 specialist agent nodes. Receives a natural language query, identifies the persona (investor/host/developer), routes to the appropriate agents, and passes outputs to GPT-4o for synthesis.

Nodes: XGBoost pricing · Prophet forecast · LightGBM risk · RAG compliance · GPT-4o coach
Join key across all CSV inputs: listing_id
Requires Phases 1–5 complete (or mocked). Start with mock outputs and swap in real files when ready.
