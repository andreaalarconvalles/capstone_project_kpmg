# Phase 5 — RAG Compliance Agent

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and current operating rules:** [`../agent.md`](../agent.md)

ChromaDB vector index and RAG retrieval code. Indexes AMA regulations (Athens) and Loi Le Meur (Paris). Given a listing, returns the specific regulation article that applies and whether the listing is compliant.

Primary targets: 137 unlicensed Athens listings (has_license == False, city == athens).
Do not commit the ChromaDB index — add rag/chroma_db/ to .gitignore before committing.
Does not touch any model files from Phases 2–4.

Current deployed status:
- The Vercel demo can answer compliance-style prompts using committed RAG handoff files: `data/outputs/rag_unlicensed_report_v1.csv`, `data/outputs/rag_compliance_index_v1.json`, and `data/outputs/aria_rag_session_log.json`.
- `/api/chat` clearly labels compliance output as analyst triage and avoids final legal advice. It does not perform live ChromaDB retrieval at request time.
- The future RAG implementation should store only source/legal text and code in git; generated ChromaDB index files must remain local or in managed storage.
- Compliance answers should keep the same consumer-friendly response shape: direct answer, up to 4 non-duplicated KPI cards, one relevant visualization if useful, and expandable methodology/sources/caveats.
