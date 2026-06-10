# Phase 5 — RAG Compliance Agent

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

ChromaDB vector index and RAG retrieval code. Indexes AMA regulations (Athens) and Loi Le Meur (Paris). Given a listing, returns the specific regulation article that applies and whether the listing is compliant.

Primary targets: 137 unlicensed Athens listings (has_license == False, city == athens).
Do not commit the ChromaDB index — add rag/chroma_db/ to .gitignore before committing.
Does not touch any model files from Phases 2–4.
