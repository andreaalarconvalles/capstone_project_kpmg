# Phase 5 — RAG Compliance Agent

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and current operating rules:** [`../agent.md`](../agent.md)

Local ChromaDB retrieval utility for the Phase 5 compliance corpus. It indexes AMA regulations (Athens) and Loi Le Meur (Paris) from `data/outputs/rag_compliance_index_v1.json`, then returns the closest regulation passages for a compliance query.

Primary targets: 137 unlicensed Athens listings (has_license == False, city == athens).
Do not commit the ChromaDB index — add rag/chroma_db/ to .gitignore before committing.
Does not touch any model files from Phases 2–4.

## Local ChromaDB workflow

Install ChromaDB in your Python environment:

```powershell
python -m pip install chromadb
```

Build or refresh the persistent local collection:

```powershell
python rag/chromadb_retriever.py build
```

Run the retrieval smoke tests:

```powershell
python rag/chromadb_retriever.py validate
```

Query the collection directly:

```powershell
python rag/chromadb_retriever.py query "Can an unlicensed central Athens listing regularize after the Dec 2024 freeze?"
```

The generated collection lives in `rag/chroma_db/`, which is intentionally gitignored. The utility uses deterministic local hash embeddings so the demo can build offline once ChromaDB is installed; a production version can swap this for MiniLM, OpenAI, or Vertex embeddings without changing the corpus contract.

Current deployed status:
- The Vercel demo can answer compliance-style prompts using committed RAG handoff files: `data/outputs/rag_unlicensed_report_v1.csv`, `data/outputs/rag_compliance_index_v1.json`, and `data/outputs/aria_rag_session_log.json`.
- `/api/chat` clearly labels compliance output as analyst triage and avoids final legal advice. It does not perform live ChromaDB retrieval at request time.
- The local RAG implementation stores only source/legal text and code in git; generated ChromaDB index files remain local or in managed storage.
- Compliance answers should keep the same consumer-friendly response shape: direct answer, up to 4 non-duplicated KPI cards, one relevant visualization if useful, and expandable methodology/sources/caveats.

## Deployment status

| Layer | Status | Evidence |
| --- | --- | --- |
| RAG corpus files | Committed | `data/outputs/rag_compliance_index_v1.json`, `data/outputs/rag_unlicensed_report_v1.csv`, `data/outputs/aria_rag_session_log.json`, `models/rag_corpus_v1.pkl` |
| Vercel compliance answers | Wired to RAG handoff outputs | `/api/chat` routes compliance prompts through `analytics-pipeline.js` and `complianceAnalysis()` |
| ChromaDB retrieval | Local reproducibility utility | `rag/chromadb_retriever.py`; generated `rag/chroma_db/` is gitignored |
| Live legal/vector retrieval | Not deployed intentionally | Compliance output is analyst triage, not final legal advice |
