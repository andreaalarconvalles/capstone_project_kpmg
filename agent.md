# agent.md — ARIA KPMG Capstone 2026

> This file is the operating manual for any AI agent working on this project.  
> Read it fully before doing anything. Follow every rule without exception.

---

## Project Overview

**ARIA** (Agentic Real-estate Intelligence Advisor) is a multi-agent AI system for short-term rental investment intelligence, built in partnership with **KPMG Spain** as an IE Business School Corporate Capstone 2026.

- **Cities:** Paris (120,809 listings: 63,520 Maven 2021 + 57,289 IAB 2025) · Athens (14,242 listings) · Total 135,051
- **Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns
- **Models and evidence layers:** XGBoost price prediction (Paris + Athens), LightGBM risk classification (Athens), Prophet scenario demand forecasts, RAG compliance handoff outputs, and LangGraph orchestration evidence
- **Stack:** Python · Jupyter · XGBoost · LightGBM · Prophet · LangGraph · ChromaDB · Streamlit · Vite React · Vercel Functions · Vertex AI Gemini/Claude partner models · Leaflet/OpenStreetMap · SHAP · Optuna · Pandas · Seaborn · ReportLab
- **GitHub repo:** https://github.com/lukatcheishvili/capstone_project_kpmg

---

## Mandatory Operating Rules

These rules apply to every single interaction. No exceptions.

### Rule 0 — Sync Before Starting

**At the very start of every session, before doing anything else, ensure the local repo is up to date.**

Run:
```bash
git pull https://ghp_<TOKEN>@github.com/lukatcheishvili/capstone_project_kpmg.git main
```

If there are merge conflicts, stop and surface them to the user before proceeding. Do not overwrite or discard any changes. Only continue with the requested work once the local folder is confirmed to be on the latest `main`.

This keeps all collaborators in sync and prevents anyone from building on a stale state.

---

### Rule 1 — Always Ask Questions

**Ask questions before acting — even for minor things.**

If there is any ambiguity about what is being asked — scope, format, methodology, which city, which model version, which dataset — stop and ask. Do not assume. Do not guess and proceed.

This applies to:
- Which version of a model or dataset to use
- Whether to overwrite an existing file or create a new one
- Which city's data (Paris vs Athens vs both)
- Whether a change should be committed and pushed
- Any analytical decision that has multiple valid approaches

One clarifying question is better than one hour of wasted work.

### Rule 2 — Never Add an AI Agent as a Git Contributor

**When committing or pushing to GitHub, never use an AI agent identity as the author.**

This is a multi-contributor project. Always commit under the identity of the human team member who is driving the session. If the active contributor is not known, **ask before committing**.

```bash
git config user.name "<Human contributor's name>"
git config user.email "<Human contributor's email>"
```

Never set the author or committer to anything like "Claude", "Codex", "OpenAI", "Anthropic", or any AI-related identity. The commit history must reflect only the human team.

When pushing:
```bash
git push https://ghp_<TOKEN>@github.com/lukatcheishvili/capstone_project_kpmg.git main
```

Do not add co-author trailers for AI tools, such as `Co-authored-by: Claude <claude@anthropic.com>` or `Co-authored-by: Codex <codex@openai.com>`.

### Rule 3 — Session Memory: Update agent.md Every 5 Prompts

**After every 5 user prompts in a session, do two things:**

1. Edit this `agent.md` — add or update the `## Session Log` section at the very bottom of the file with a timestamped bullet summarizing what was done in this session.

2. Edit this `agent.md` — update the `## Progress Tracker` section below with what has been completed and what remains.

This creates persistent memory across sessions so that any future agent (or human) picking up this project understands the current state without reading the full conversation history.

Do not store running session history in `README.md`, deployment YAML, or Vercel config files. `agent.md` is the canonical agent memory file.

Keep the entire `## Session Log` section as the final section of this file, after all stable rules, references, vocabulary, and file maps. Future agents must append new entries there instead of inserting the log above reference material.

The format for session log entries:
```
- [YYYY-MM-DD] Session N: <what was done in 1–2 sentences>
```

### Rule 4 — Keep Phase Status Current in README

**Whenever any phase progresses, update the `## Project Phases & Status` table in `README.md` immediately.**

The status column uses four values only:
- `✅ Done` — output files committed and verified
- `🔄 In progress` — actively being worked on this session
- `🔲 Not started` — not yet begun
- `⏳ Blocked` — waiting on another phase to complete

When updating a phase:
1. Change the status emoji and label in the table row
2. Add a short note to the description if the scope changed (e.g., new output files, revised approach)
3. Commit the README change immediately — do not batch it with unrelated work

This table is the single source of truth for what the team has shipped and what remains. Keep it honest.

---

## Progress Tracker

> Updated after every 5 prompts. Reflects the current state of the project.

### Completed

- [2026-06-09] Initialised repo and pushed all project files to main
- [2026-06-09] Phase 1 EDA COMPLETE (A+/99): 135,051 rows, 41 pipeline steps, 10 figures, at_risk_host label engineered
- [2026-06-09] Phase 2 XGBoost COMPLETE (A/96): Paris R²=0.588, Athens R²=0.676, 26 features, 2,945 underpriced listings, €4.8M foregone revenue
- [2026-06-09] Phase 3 LightGBM COMPLETE (A/95): leakage corrected, AUC=0.8288, 865 priority targets, €1.43M opportunity
- [2026-06-10] Phase 7 agent-chat UI MVP built in `Stage 7 - UI Interface/`: React/HTML prototype + faithful Streamlit app (5 agents, scripted demos, LangGraph-style traces, Plotly dark charts, pseudo-choropleth map, model picker, hybrid live-Gemini mode). Verified via Streamlit AppTest.
- [2026-06-10] Streamlit Cloud deployment dependency fix: added root-level `requirements.txt` so the installer no longer parses the nested `Stage 7 - UI Interface/streamlit_app/requirements.txt` path as separate tokens.
- [2026-06-10] Streamlit Cloud deployment hardening: added no-spaces compatibility wrapper entrypoint `streamlit_app/app.py` and duplicated `streamlit_app/requirements.txt`.
- [2026-06-10] Stage 7 design fidelity update: synced the React prototype from the ZIP handoff and replaced the native Streamlit recreation with a Streamlit host that embeds the exact Claude Design prototype full-page.
- [2026-06-10] Stage 7 deployment hotfix: reverted the embedded prototype renderer from `st.iframe` to the classic Streamlit HTML component because the newer API showed a blank page on Streamlit Cloud.
- [2026-06-10] Stage 7 white-screen fix: enabled Streamlit static serving and iframed the static URL instead of sending the full app through an inline HTML payload.
- [2026-06-10] Stage 7 deployment target fix: Streamlit Cloud main module is `Stage 7 - UI Interface/streamlit_app/app.py`; generated static assets now live under that app folder.
- [2026-06-10] Stage 7 Vite deployment path: added a root Vite React app that bundles the Claude Design export and a `vercel.json` configuration for Vercel deployment.
- [2026-06-10] Stage 7 Vercel folder organization: moved the Vite React app into `Stage 7 - UI Interface/vercel_vite_app/`; root `vercel.json` routes deployments into that nested folder.
- [2026-06-10] Stage 7 Vercel UI refresh: updated `Stage 7 - UI Interface/vercel_vite_app/` from the latest Claude Design zip, adding the landing dashboard and Airbnb/KPMG theme system.
- [2026-06-10] Stage 7 Vercel UI polish: added the checked-in ARIA wordmark asset to the landing/sidebar, removed the landing agent subtitle, and balanced the wordmark letter spacing.
- [2026-06-10] Documentation memory routing: moved the running session log into `agent.md` and updated Rule 3 so future agent session notes stay out of README/YAML/deployment files.
- [2026-06-10] Stage 7 README link cleanup: made the Vercel deployment the only public website link in the Stage 7 README and removed the Streamlit launch badge/link.
- [2026-06-10] README Vercel link sync: updated every repo README to point at `https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/`.
- [2026-06-10] Main README link fix: corrected the root README Vercel line to clean Markdown link syntax after a nested link was introduced on `main`.
- [2026-06-10] Vercel sidebar control polish: added a fullscreen toggle directly beside the sidebar collapse button in the ARIA Vite UI.
- [2026-06-10] KPMG theme polish: made the KPMG theme use KPMG palette tokens across the Vite UI while preserving the Airbnb and Dark theme colors.
- [2026-06-10] Settings modal sizing fix: kept the Settings panel dimensions stable when switching from API & Models to About.
- [2026-06-10] Theme selector polish: replaced the top-bar segmented theme buttons with a dropdown selector in the Vercel ARIA UI.
- [2026-06-10] Landing data status polish: added a Live Data Status panel under the prompt cards to fill the lower-left landing space with dataset, model, and forecast readiness signals.
- [2026-06-10] Landing panel alignment: stretched the landing page columns so the Live Data Status box aligns with the bottom of the Agent Signals box.
- [2026-06-10] Stage 7 UI asset organization: moved tracked UI support files from the repo root into `Stage 7 - UI Interface/`.
- [2026-06-10] Composer layout polish: moved the prompt input into a full-width top row and placed the attach, agent, model, engine, and send controls below.
- [2026-06-10] Landing layout correction: moved the full-width prompt composer above the cover-page cards and aligned the prompt, status, KPI, and signal cards below it.
- [2026-06-10] Composer attachment polish: made the plus button open a desktop photo picker with image previews, and removed the landing-card header strip for cleaner box alignment.
- [2026-06-10] Live Data Status readability: stacked metric values and details so the Model stack text no longer truncates with ellipses.
- [2026-06-10] Stage 7 Vercel config move: moved `vercel.json` into `Stage 7 - UI Interface/` and made its commands relative to that folder.
- [2026-06-10] Vercel config restore: moved `vercel.json` back to the repository root with root-relative commands for the Stage 7 Vite app.
- [2026-06-13] Mentor-prep documentation expanded: created/updated mentor-facing summary material with detailed non-technical explanations, model rationale, feature-selection rationale, project value proposition, and likely mentor questions.
- [2026-06-13] Secret handling hardened: stored GitHub and Google/Vertex credentials only in local `.env`, verified `.env` patterns remain gitignored, and avoided exposing sensitive values in documentation.
- [2026-06-13] Grounded Vertex AI custom-prompt backend implemented in `Stage 7 - UI Interface/vercel_vite_app/api/`: `/api/chat` uses server-side Google service-account authentication, live GitHub CSV fetches, deterministic analytics, runtime caching, Vertex Gemini narrative generation, and structured KPI/chart/details responses.
- [2026-06-13] Stage 7 landing UI updated: the page now shows 4 scripted prompts by default with a show-more control for all 8, followed by aligned KPI cards based on recent dataset insights.
- [2026-06-13] Live answer quality improved: responses now provide more context, use readable section breaks, hide internal quality scores, keep agent workflows folded by default, center generated KPI cards, avoid raw snake_case labels, and transliterate Greek place names into English with the original in brackets.
- [2026-06-13] Dynamic visualization layer improved: custom prompts now choose chart type by intent, use readable axis labels, avoid overlapping labels, and render interactive region-map style visuals with hover insights for city/area comparison prompts.
- [2026-06-13] GitHub deployment cleanup: verified production Vercel is green on `main`, identified stale failed Preview deployments from older branch commits, and marked those Preview deployments inactive so the GitHub deployments widget no longer reflects an old failure as current state.
- [2026-06-13] Repository documentation refresh: updated `README.md`, `Stage 7 - UI Interface/README.md`, `Stage 7 - UI Interface/app/README.md`, `agents/README.md`, `rag/README.md`, and this `agent.md` to reflect the current Vercel/Vertex/GitHub-data architecture.
- [2026-06-13] MLOps repository review: audited local and remote repo structure, added `.env.example`, improved ignore rules, fixed devcontainer paths, added a lightweight GitHub Actions CI workflow, created `data/README.md`, `models/MODEL_CARD.md`, and `docs/MLOPS_REPO_REVIEW.md`.
- [2026-06-13] Persistent chat memory: Stage 7 browser conversations now persist with `localStorage`, survive refreshes, restore the active thread, and disappear only when explicitly deleted.
- [2026-06-13] Real map visualization path: replaced fake region-tile behavior for geographic prompts with real map rendering using Leaflet, OpenStreetMap-derived/CARTO light basemap tiles, city-aware overlays, hover insights, and map-safe fallbacks when no usable boundary data is available.
- [2026-06-13] Live prompt robustness: improved city typo handling, prevented stale Paris/Athens visualization reuse across follow-up prompts, removed duplicate KPI cards, and tightened answer formatting so generated responses finish sentences and separate main points into readable sections.
- [2026-06-13] Decision-ready exports: upgraded the PDF brief flow to capture generated charts/maps and include the answer, KPIs, methodology, sources, caveats, and visual context for decision making.
- [2026-06-13] Adaptive visualization selection: the live analytics path now chooses chart/map types by user intent, including ranking bars, grouped comparisons, histograms, donut charts, heatmaps, bubble/scatter views, and geographic map overlays.
- [2026-06-13] Canonical agent memory rename: renamed the operating manual from `CLAUDE.md` to `agent.md`, refreshed documentation references, and added this handoff context for future LLM/agent sessions.
- [2026-06-14] Stage 7 UX/accessibility polish: fixed the AI model picker clipping with viewport-aware portal positioning, constrained scrolling, and mobile sheet behavior; removed Microsoft Edge Visual Search from the ARIA logo by rendering the wordmark as a CSS mask instead of an image; added listbox/dialog/control accessibility improvements and pushed commit `388d77e` to `main`.
- [2026-06-14] Stage 7 conversational context fix: live `/api/chat` prompts now include recent browser conversation history, resolve follow-up wording such as "there" to the prior city, preserve the current question's requested metric, and explicitly handle premium/most-expensive area rankings.
- [2026-06-18] Response-quality hardening: wired committed Prophet forecast outputs and RAG compliance handoff files into the live backend, strengthened requested-geography discipline, added follow-up handling for Paris Prophet comparisons, prevented repeated visual packs in follow-ups, and expanded the response-quality evaluation harness.
- [2026-06-18] Visualization sanity rules: scatter and bubble charts are now rejected when x/y values are too clustered or overlapping; ARIA should switch to ranking bars, line charts, maps, KPI comparisons, or detail tables when those are clearer.
- [2026-06-19] Scripted demo upgrade: updated the scripted business-case responses to be more judge-ready, with recommendation-first answers, sources, maps/charts, limitations, and next actions; response-quality evaluation passed with gold answers at 100/100.
- [2026-06-19] Export naming polish: renamed the reusable Markdown prompt export to `Project Brief`, changed its file prefix to `aria-project-brief-...md`, and capitalized the toolbar labels `Chat Brief` and `Project Brief`.
- [2026-06-19] Documentation refresh: updated `README.md` and this `agent.md` to reflect the current Vercel/Vertex behavior, Project Brief export, response-quality guardrails, committed RAG/Prophet/LangGraph handoff artifacts, and remaining documentation handoff notes.

### In Progress

- Phase 7 — Live agent strengthening — Vercel backend grounds prompts in committed neighbourhood stats, XGBoost pricing, SHAP, LightGBM risk, Prophet forecast, RAG compliance handoff outputs, and LangGraph evidence; continue polishing response quality, map clarity, and demo-specific scripted prompts.
- Phase 5 — RAG production handoff — JS-readable CSV/JSON artifacts are committed and wired for analyst triage; Vercel must still avoid claiming final legal advice or live ChromaDB retrieval.
- Phase 6 — Orchestration story — LangGraph notebook plus committed routing/session artifacts document the research orchestration layer; Vercel remains the production demo implementation.
- Phase 7 — UI demo (Member 5) — Vercel React app is live, with `Chat Brief` and `Project Brief` exports; legacy Streamlit dashboard remains optional/future.
- Documentation + Presentation (Member 6) — final KPMG presentation and methodology storytelling remain in progress.

### Backlog

- Add exact Athens neighbourhood boundary GeoJSON if the map should highlight true polygons instead of centroid buffers.
- Keep scripted prompt copy synchronized across `src/legacy/aria-data.jsx` and the hardcoded `scriptedPrompts` list in `src/legacy/aria-ui2.jsx` whenever demo prompt wording changes.
- Phase 7 — Optional Streamlit 3-tab analyst dashboard (investor, host, developer)
- KPMG final presentation and methodology document

---

## Skills Reference

Skills are invoked by name (e.g., `/diagnose`, `/grill-me`). The following skills from [mattpocock/skills](https://github.com/mattpocock/skills) are enabled for this project. Full skill definitions are embedded below.

---

### `/aria-response-quality` — Produce KPMG-ready ARIA answers

**When to use:** The live Vercel agent, scripted prompts, demo outputs, or response policy need to produce investor/manager-friendly ARIA recommendations using Paris and Athens analytics.

**Core discipline:** Answer the user's actual business question first, stay inside the requested geography, and make every recommendation traceable to the project outputs.

**Hard rules:**
1. If the user names exactly one city, arrondissement, neighbourhood, or district, keep the recommendation, KPIs, charts, maps, risks, next actions, and `Sources` line inside that geography.
2. Do not pivot from Paris to Athens, or Athens to Paris, just because another market has a stronger score. Only compare or recommend another city when the user explicitly asks for a cross-city comparison or alternative market.
3. Do not treat a negative instruction such as "do not compare Paris with Athens" as a request to compare both cities. It reinforces the Paris-only boundary.
4. Treat "portfolio", "KPMG client", "small investor", and "next 12 months" as decision-support wording within the requested city unless the prompt clearly asks which city to choose.
5. If the prompt asks for Prophet, forecast, demand, seasonality, occupancy, or a time window such as "next 12 months", route to the demand/forecast analysis before general risk or market-entry logic.
6. Open analytical answers with a direct recommendation, then explain ARIA's reasoning, key evidence, visualizations, limitations, next actions, and sources.
7. Use plain language for non-technical readers. Briefly explain technical terms in brackets the first time they matter, but avoid repeating definitions already explained in the conversation.
8. End with the backend-supplied `Sources` line. Do not invent sources, row counts, scores, model capabilities, or live legal retrieval.
9. Run a chart sanity check before returning scatter or bubble visuals. If the x/y variables are too clustered, not distinct enough, or visually overlapping, drop that chart and prefer a map, ranking bar, line chart, or detail table that is easier to read.

**Paris forecast demo standard:** For a Paris-only Prophet prompt, the answer should recommend the best Paris arrondissement/neighbourhood from the forecast output, show a Paris map, compare Paris areas with charts, cite Prophet forecast outputs plus neighbourhood stats, and avoid Athens unless the user explicitly requests a cross-city benchmark.

---

### `/diagnose` — Debug data pipeline and model bugs

**When to use:** A notebook is throwing, a model is producing unexpected outputs, a data merge is silently wrong, performance has regressed between runs.

**Core discipline:** Build a feedback loop first. A fast, deterministic pass/fail signal is the skill. Everything else is mechanical.

**Phases:**
1. **Build a feedback loop** — failing test, CLI invocation with fixture, or minimal repro harness. Do not proceed without one.
2. **Reproduce** — confirm the loop produces the exact failure the user described.
3. **Hypothesise** — generate 3–5 ranked falsifiable hypotheses. Show them to the user before testing.
4. **Instrument** — one variable at a time. Tag every debug log `[DEBUG-xxxx]` for easy cleanup. For performance regressions: measure first, bisect, then fix.
5. **Fix + regression test** — write the failing test before the fix (only if a correct seam exists).
6. **Cleanup** — remove all `[DEBUG-...]` logs. Confirm original repro no longer reproduces.

For data science specifically: a "feedback loop" might be a minimal notebook cell that reproduces the wrong output, a `assert df.shape == (expected_rows, expected_cols)` guard, or a diff between two CSV outputs.

---

### `/grill-me` — Stress-test an analytical plan

**When to use:** You have a plan for a new analysis, a feature engineering decision, a model architecture choice, or a methodology change and want it challenged before committing.

**How it works:** The agent interviews you relentlessly about every aspect of the plan, walking down each branch of the decision tree, resolving dependencies one-by-one. For each question, the agent provides its recommended answer. Questions come one at a time.

If a question can be answered by reading the codebase or data, the agent explores instead of asking.

---

### `/grill-with-docs` — Challenge a plan against documented methodology

**When to use:** You want to stress-test a plan specifically against the existing documented decisions (this `agent.md`, the EDA notebook decisions, the methodology docs in `docs/`).

**How it works:** Same as `/grill-me` but the agent actively cross-references with project documentation. If you use a term differently from how it's defined in the methodology docs, the agent calls it out immediately. Decisions that crystallize get written back into this `agent.md`.

---

### `/prototype` — Build a throwaway test

**When to use:** You want to sanity-check a data model, state machine, or feature engineering decision before committing to it. Or you want to mock up a quick visualization or dashboard layout.

**Two branches:**
- **Logic** — build a minimal Python script that pushes the data model / transformation through edge cases that are hard to reason about on paper. One command to run. No persistence. Print full state after every action.
- **UI** — generate several radically different visualization/dashboard variants, switchable via a parameter.

**Rules:** Throwaway from day one. Clearly named as prototype. Delete or absorb when done. Capture the decision it answered in a comment or commit message before deleting.

---

### `/zoom-out` — Get a map of how modules relate

**When to use:** You're unfamiliar with a section of the codebase — a notebook you haven't touched, a data transformation chain, a set of SHAP outputs — and need to understand how it fits into the bigger picture before diving in.

**Output:** A map of all relevant modules and callers, using the project's domain vocabulary (listings, features, SHAP values, risk scores, underpricing gap, neighbourhood stats, dist_zone, etc.).

---

### `/to-prd` — Convert an analysis idea into a structured spec

**When to use:** You want to formalize an analysis plan, a new model variant, or a new ARIA module into a structured PRD before implementation.

**Process:** The agent synthesizes what it already knows — no interview. Produces a PRD with: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes.

For data science: "testing decisions" means validation strategy (holdout split, cross-val, SHAP sanity checks), not unit tests.

---

### `/to-issues` — Break a plan into GitHub issues

**When to use:** You have a plan or PRD and want to break it into independently-grabbable GitHub issues, ordered by dependency.

**Process:** Draft vertical slices (thin cuts through all layers, each independently demoable). Present breakdown for approval. Publish to GitHub in dependency order. Each issue gets: What to build, Acceptance criteria, Blocked by.

GitHub repo: https://github.com/lukatcheishvili/capstone_project_kpmg  
Token: use the token already configured in this session.

---

### `/handoff` — Write a session handoff document

**When to use:** Ending a session and want the next agent (or yourself in a future session) to pick up seamlessly.

**Output:** A handoff document saved to the OS temp directory. Includes: summary of what was done, what's in progress, what comes next, which skills the next session should invoke. Does not duplicate content already in commits or this `agent.md` — references them instead. Redacts any sensitive info (tokens, keys).

---

### `/review` — Review changes on two axes: Standards + Spec

**When to use:** You've made changes to notebooks, model code, or data transformations and want a structured review before committing.

**Two axes (run in parallel):**
- **Standards** — does the code conform to documented methodology and project conventions? (references this `agent.md` and the methodology docs)
- **Spec** — does the code match what was originally planned? (references the relevant PRD or issue)

Results reported separately under `## Standards` and `## Spec` so neither axis masks the other.

---

### `/triage` — Manage GitHub issues

**When to use:** Reviewing incoming issues, moving issues through the workflow, preparing issues for implementation.

**State machine:** `needs-triage` → `needs-info` | `ready-for-agent` | `ready-for-human` | `wontfix`

Every AI-generated comment on the issue tracker must start with: `> *This was generated by AI during triage.*`

GitHub repo: https://github.com/lukatcheishvili/capstone_project_kpmg

---

## Domain Vocabulary

Use these terms consistently. Do not substitute synonyms.

| Term | Definition |
|---|---|
| `listing` | A single Airbnb property row in the dataset |
| `price_eur` | Raw price in euros (pre-log transform) |
| `log_price` | `log1p(price_eur)` — the XGBoost training target |
| `dist_zone` | Distance zone from city center (centre/mid/outer/far) |
| `host_tenure_days` | Days since host joined Airbnb |
| `risk score` | LightGBM probability output for Athens underpricing risk |
| `underpricing gap` | Estimated difference between predicted fair price and listed price |
| `SHAP value` | Per-feature attribution from SHAP for a given listing |
| `xgb_price_training_eligible` | Flag = 1 for rows used in XGBoost training |
| `aria_mega_dataset` | The master merged dataset (`aria_mega_dataset_v4_1_final.csv`) |
| `neighbourhood_stats` | Neighbourhood-level aggregate benchmark files |
| `at_risk_host` | Binary label — host showing 3+ of 6 booking decline dimensions |
| `risk_probability` | LightGBM probability output (0–1) per listing |
| `high_risk_flag` | Binary — 1 if risk_probability >= 0.70 |
| `prophet_training_eligible` | Flag = 1 for rows used in Prophet demand forecasting |
| `neighbourhood_median_price` | Median price per neighbourhood — SHAP rank 1 both city models |
| `leakage` | Feature used to construct the target label — must never be in FEATURES |
| `listing_id` | Universal join key across all output CSVs |

---

## File Map

```
KPMG Capstone/
├── agent.md
├── README.md
├── .gitignore
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb       ← Phase 1 — run FIRST
│   ├── ARIA_XGBoost_v1.ipynb         ← Phase 2
│   ├── ARIA_LightGBM_v1.ipynb        ← Phase 3
│   ├── ARIA_Prophet_v2.ipynb         ← Phase 4
│   ├── ARIA_RAG_v1.ipynb             ← Phase 5
│   ├── ARIA_LangGraph_v1.ipynb       ← Phase 6
│   └── eda_figures/
├── data/
│   ├── raw/
│   ├── processed/                    ← gitignored
│   └── outputs/                      ← join key: listing_id
├── models/                           ← trained model files
├── rag/                              ← Phase 5 documentation / local ChromaDB notes
├── agents/                           ← Phase 6 documentation / orchestration notes
├── Stage 7 - UI Interface/      ← Phase 7 — all UI assets, prototypes, and Vercel app
└── docs/                        ← methodology docs, proposals, planner
```

---

## Current Handoff For New Agents

Start every new conversation by reading this file, then inspect `README.md` and `Stage 7 - UI Interface/README.md` for the current public demo shape.

The live demo is the Vercel React app at: https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/

The active UI/backend code lives in `Stage 7 - UI Interface/vercel_vite_app/`. The custom-prompt path is `api/chat.js` plus `api/analytics-pipeline.js`: it fetches committed GitHub CSV outputs, computes deterministic analytics, calls Vertex AI server-side, and returns structured `answer`, `kpis`, `visualizations`, `details`, and `sources`. Gemini 2.5 Pro is the default model for every fresh session; the picker also exposes Gemini 2.5 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, and Claude Opus 4.7. Gemini models use the Google `generateContent` route; Claude models use the Vertex AI Anthropic partner `rawPredict` route.

Keep the scripted prompt experience polished as the demo fallback. Typed custom prompts should use grounded live data when Vertex authentication is configured, with the workflow folded by default, no internal quality score displayed, no raw snake_case labels, no repeated KPI cards, and readable sectioned answers.

When changing scripted prompt wording, update both `src/legacy/aria-data.jsx` and the hardcoded `scriptedPrompts` list in `src/legacy/aria-ui2.jsx`. Otherwise the landing cards, seeded chats, and scripted response registry can drift apart.

The response-quality harness is `Stage 7 - UI Interface/vercel_vite_app/api/response-quality.eval.mjs`. Run it before shipping answer-policy, analytics, scripted-response, or visualization changes. Gold answers should pass at 97/100 or above, and bad-answer fixtures should remain below the pass bar.

The active Vercel UI now uses a viewport-aware AI model picker. It should remain visible inside the browser viewport, scroll when the model list is taller than available space, and behave like a bottom sheet on narrow mobile widths. The ARIA wordmark is intentionally rendered as a masked span rather than an image so Microsoft Edge does not show the Visual Search overlay on hover.

The live chat path should preserve conversation context. The frontend sends recent thread messages to `/api/chat`; the backend resolves follow-up prompts before analytics routing. Example: after a Paris saturation/map question, "which are the most expensive areas to live there?" should stay in Paris and switch to the current premium-price metric rather than returning a fresh generic/livability answer.

The live chat path must also respect requested geography. If a user asks a Paris-only question, ARIA should not recommend Athens or display Athens KPI cards, maps, or source framing unless the prompt explicitly asks for a Paris-vs-Athens comparison.

Map and region-comparison prompts must use real map behavior or a clearly labeled no-boundary fallback. Do not return fake region grids for geographic requests. The current map approach uses Leaflet with OpenStreetMap-derived/CARTO light tiles for more English-friendly labels; some local map labels can still appear in the source map language.

Charts must be readable before they are useful. Scatter and bubble visuals should only appear when both axes have enough spread and distinct values to separate the areas; otherwise the agent should return a clearer ranking, trend, map, or detail table.

Conversation history is expected to persist in the browser and survive refreshes. Do not remove this behavior unless the user explicitly asks for a stateless demo.

The composer has two export paths: `Chat Brief` for a full conversation PDF-style brief, and `Project Brief` for a reusable Markdown analyst instruction that captures the latest conversation context and ARIA response rules. Project Brief downloads should keep the `aria-project-brief-...md` filename prefix.

Secrets stay out of Git. `.env` is local and ignored. Vercel production secrets belong in Vercel Environment Variables, especially the server-side Google service-account credential.

Remaining roadmap: keep the live Vercel agent grounded in committed model outputs, keep compliance framed as RAG handoff triage rather than live legal retrieval, add exact Athens boundary polygons if required, and prepare the final KPMG/mentor presentation materials.

---

## Session Log

- [2026-06-09] Session 1: Repository initialised. README, agent.md, .gitignore created and pushed.
- [2026-06-09] Session 2: Phase 1 EDA complete (A+/99). 135,051 rows x 96 cols. 41 pipeline steps. 10 figures. Business quantification complete.
- [2026-06-09] Session 3: Phase 2 XGBoost complete (A/96). Paris R2=0.588, Athens R2=0.676. 26-feature pipeline. 2,945 underpriced listings. EUR 4.8M foregone revenue. All 7 output files saved.
- [2026-06-09] Session 4: Phase 3 LightGBM complete (A/95). Leakage discovered and corrected. AUC=0.8288. 865 priority targets. EUR 1.43M opportunity.
- [2026-06-09] Session 5: README completely rewritten to reflect all 7 phases. agent.md updated. Placeholder folders created.
- [2026-06-10] Session 6: Built the ARIA agent-chat UI in `Stage 7 - UI Interface/` from the claude.ai/design handoff: React/HTML prototype plus a faithful Streamlit app with 5 agents, scripted demos, reasoning traces, Plotly dark charts, pseudo-choropleth map, model picker, and hybrid live-Gemini mode. Verified via Streamlit AppTest.
- [2026-06-10] Session 7: Fixed Streamlit Cloud dependency installation by adding a root-level `requirements.txt`, avoiding installer parsing issues caused by the nested app folder path with spaces and a hyphen.
- [2026-06-10] Session 8: Added a no-spaces Streamlit Cloud wrapper at `streamlit_app/app.py` and duplicated deployment requirements there as a compatibility fallback.
- [2026-06-10] Session 9: Replaced the native Stage 7 Streamlit recreation with a Streamlit host that embeds the exact Claude Design React prototype, synced the prototype files from the ZIP handoff, and updated deployment documentation.
- [2026-06-10] Session 10: Hotfixed the Streamlit Cloud embed path by switching the React prototype host back to the classic Streamlit HTML component after the newer `st.iframe` path rendered as a blank page on deployment.
- [2026-06-10] Session 11: Moved the embedded ARIA prototype to Streamlit static serving and iframed that URL to avoid Cloud white screens from large inline HTML payloads.
- [2026-06-10] Session 12: Set the Streamlit deployment target to `Stage 7 - UI Interface/streamlit_app/app.py` and made generated static assets live under that app folder.
- [2026-06-10] Session 13: Added a Vite React build path for the Claude Design export, with Vercel config serving the generated `dist/` directory.
- [2026-06-10] Session 14: Moved the Vercel Vite app into `Stage 7 - UI Interface/vercel_vite_app/` and kept the root Vercel config as a deployment pointer.
- [2026-06-10] Session 15: Updated the Vercel Vite UI from the latest Claude Design zip, including the new landing dashboard module and Airbnb/KPMG theme system.
- [2026-06-10] Session 16: Polished the Vercel landing page with the ARIA wordmark asset, removed the landing agent subtitle, and balanced the wordmark letter spacing.
- [2026-06-10] Session 17: Moved the canonical session log from README into `agent.md` and updated agent instructions so future session history stays in this file.
- [2026-06-10] Session 18: Updated the Stage 7 README so the live website points to the current Vercel deployment and removed the Streamlit public launch link.
- [2026-06-10] Session 19: Updated every repo README with the current Vercel deployment URL: `https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/`.
- [2026-06-10] Session 20: Fixed the root README Vercel website line on `main` so the URL is a clean clickable Markdown link.
- [2026-06-10] Session 21: Added a fullscreen toggle beside the sidebar collapse button in the Vercel ARIA UI and wired it to the browser Fullscreen API.
- [2026-06-10] Session 22: Updated the KPMG theme so shell colors, CTA, logo treatment, agent accents, dashboard visuals, and charts use KPMG palette colors without changing Airbnb or Dark mode.
- [2026-06-10] Session 23: Fixed the Settings modal so the About tab keeps the same grey-panel dimensions as the API & Models tab.
- [2026-06-10] Session 24: Replaced the Airbnb/KPMG/Dark segmented theme switcher with a dropdown menu that preserves the same theme options and behavior.
- [2026-06-10] Session 25: Added a Live Data Status panel to the Vercel landing page so the lower-left area shows dataset freshness, portfolio load, model readiness, and forecast coverage.
- [2026-06-10] Session 26: Aligned the landing page panel bottoms by stretching the two-column row and allowing the Live Data Status panel to fill the remaining lower-left height.
- [2026-06-10] Session 27: Consolidated tracked UI support assets under `Stage 7 - UI Interface/`: moved the Phase 7 `app/` notes folder, Streamlit `.streamlit` config, and root Streamlit requirements into Stage 7.
- [2026-06-10] Session 28: Reworked the Vercel composer so the prompt input spans the full top row, with the attach, agent picker, model picker, engine chip, and send button arranged on the row below.
- [2026-06-10] Session 29: Corrected the Vercel landing layout so the prompt composer spans the top of the cover page, while suggested prompts, Live Data Status, portfolio KPIs, and Agent Signals align in the card grid underneath.
- [2026-06-10] Session 30: Connected the composer plus button to a multi-image desktop upload picker with preview chips/removal controls, and removed the Suggested analyses / Portfolio snapshot header strip above the landing cards.
- [2026-06-10] Session 31: Updated the Live Data Status metric layout so value/detail text wraps on stacked lines, making `3 engines ready` and `XGB · LGBM · Prophet` fully visible.
- [2026-06-10] Session 32: Moved `vercel.json` from the repository root into `Stage 7 - UI Interface/`, updated the Vercel commands to run from that folder, and documented that Vercel should use `Stage 7 - UI Interface` as the Root Directory.
- [2026-06-10] Session 33: Moved `vercel.json` back to the repository root and restored the root-relative Vercel install/build/output paths for `Stage 7 - UI Interface/vercel_vite_app`.
- [2026-06-13] Session 34: Read the repository to produce mentor-prep documentation, then expanded the summary with non-technical explanations, model-choice rationale, feature-choice rationale, and the business value of ARIA.
- [2026-06-13] Session 35: Moved sensitive GitHub and Google/Vertex values into local `.env`, confirmed `.env` remains gitignored, and documented where secrets live without writing secret values into tracked files.
- [2026-06-13] Session 36: Planned and implemented the grounded Vertex AI chat path: custom prompts now go through `/api/chat`, fetch live GitHub CSV outputs, compute deterministic analytics, call Vertex Gemini server-side, and return answer/KPI/visualization/details payloads.
- [2026-06-13] Session 37: Reworked the Stage 7 landing page around 8 scripted consumer prompts, a 4-prompt default view with show-more control, and aligned KPI cards showing dataset insights.
- [2026-06-13] Session 38: Polished live generated responses for demo readiness: more explanatory context, readable section breaks, folded agent workflow, no internal quality score display, no Markdown star labels, centered KPI cards, and English transliterations for Greek place names.
- [2026-06-13] Session 39: Updated generated chart behavior so chart type follows prompt intent, labels stay readable, raw snake_case feature names are humanized, and city/region comparison prompts produce interactive region-map style visuals with hover details.
- [2026-06-13] Session 40: Investigated the GitHub Deployments Preview error, confirmed Production was green, identified the red Preview as a stale old Vercel deployment, pushed preview refresh branches, and marked the stale Preview deployments inactive.
- [2026-06-13] Session 41: Refreshed all README files and `agent.md` so the repo documentation matches the current live Vercel React UI, server-side Vertex backend, GitHub data analytics pipeline, and remaining roadmap.
- [2026-06-13] Session 42: Reviewed repo organization against MLOps best practices, documented high-priority artifact/data governance gaps, added data/model governance docs, added `.env.example`, improved `.gitignore`, fixed stale devcontainer paths, and added basic GitHub Actions CI.
- [2026-06-13] Session 43: Updated the session-memory rule so the session log must stay at the end of `agent.md`, then moved the existing log beneath all stable reference sections.
- [2026-06-13] Session 44: Added persistent browser chat memory so ARIA conversations survive refreshes, restore the active thread, and are removed only when the user deletes them.
- [2026-06-13] Session 45: Replaced the fake geographic-region grid path with real Leaflet map rendering for supported city prompts, including city-aware overlays, hover insights, and a clear fallback when real boundary data is unavailable.
- [2026-06-13] Session 46: Improved live response quality by making recommendations more explanatory, sectioning long answer text, removing internal quality labels, deduplicating KPI cards, and ensuring generated sentences end cleanly.
- [2026-06-13] Session 47: Made prompt handling more robust by correcting common city typos such as `Athen` to Athens and preventing stale Paris/Athens chart state from carrying into follow-up prompts.
- [2026-06-13] Session 48: Expanded the visualization layer so the analytics path can choose the best chart type for the user's question, including real map overlays, comparison charts, distributions, heatmaps, donut views, and bubble/scatter views.
- [2026-06-13] Session 49: Upgraded PDF brief export to capture generated visual context, then switched the map basemap to a CARTO light OpenStreetMap-derived layer for a cleaner, more English-friendly demo view.
- [2026-06-13] Session 50: Renamed the canonical project operating manual from `CLAUDE.md` to `agent.md`, updated documentation references, and added a current handoff section for future LLM/agent sessions.
- [2026-06-13] Session 51: Added a composer-level `Chat brief` export beside the model picker so users can generate a PDF-ready brief for the full active conversation while keeping the existing per-answer export buttons.
- [2026-06-13] Session 52: Expanded the UI model picker and Settings default model list with Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, and Claude Opus 4.7, while making Gemini 2.5 Pro the default every fresh session. Updated `/api/chat` so Gemini models use the Google Vertex `generateContent` route and Claude models use the Anthropic partner `rawPredict` route.
- [2026-06-14] Session 53: Fixed the Stage 7 AI model picker overflow using viewport-aware portal positioning, constrained scrolling, and mobile sheet behavior; removed the Edge Visual Search hover target from the ARIA logo; applied Web Design Guidelines accessibility fixes; and pushed the clean UI commit `388d77e` to `main`.
- [2026-06-14] Session 54: Added conversation-context support to the Stage 7 live chat path: frontend prompts now include recent thread history, `/api/chat` passes context to analytics and Vertex, follow-up prompts resolve prior city references such as "there", and premium-price questions rank the most expensive areas instead of falling back to generic livability/saturation logic.
- [2026-06-18] Session 55: Wired committed Prophet scenario forecast CSVs into the live Vercel demand agent, fixed forecast/map intent routing, tightened Athens point-map buffers while noting that exact polygons need boundary GeoJSON, added the project story/readiness section, fixed the response-quality evaluation harness, and prepared the two Prophet forecast CSVs to be stored as normal Git files instead of LFS pointers for raw-GitHub fetching.
- [2026-06-18] Session 56: Tightened ARIA response discipline after a Paris demo prompt incorrectly pivoted to Athens: added requested-geography rules to the project skill/manual and live response policy, fixed single-city portfolio and Prophet forecast routing, and added an evaluation case that catches Paris-to-Athens recommendation drift.
- [2026-06-18] Session 57: Fixed the Paris-only demo prompt edge case where "do not compare Paris with Athens" was still counted as a cross-city request; added negative-comparison scope parsing, preserved Prophet demand focus across follow-ups, strengthened structured-answer fallback, and added routing checks to the response-quality harness.
- [2026-06-18] Session 58: Fixed the live Paris Prophet follow-up loop so ARIA uses prior chat context instead of repeating the first answer; enriched UI-to-backend context with KPI, visual, and detail rows; added a demand-specific follow-up fallback comparing Bourse with Hotel-de-Ville and Temple; and added response-quality regression coverage for repeated follow-up answers.
- [2026-06-18] Session 59: Fixed duplicated visuals in Paris Prophet follow-ups: the first answer keeps the full map/chart pack, while follow-up comparison prompts now return one focused top-three chart, refresh KPI cards for the follow-up, and tell the user to refer back to the earlier map/trend instead of rendering them again.
- [2026-06-18] Session 60: Added chart sanity rules for ARIA visuals so scatter and bubble charts are dropped when x/y values are too clustered or overlapping; documented the rule in the live response policy and project agent skill guidance.
- [2026-06-18] Session 61: Reviewed GitHub stage artifacts and strengthened ARIA model grounding: wired committed RAG compliance handoff outputs into the live backend, added methodology/stage response routing, converted small raw-GitHub source CSVs out of LFS, and expanded the response-quality harness with model-grounding checks that pass at the 97/100 bar.
- [2026-06-19] Session 62: Upgraded scripted demo responses into stronger business-case outputs for judges, with direct recommendations, maps/charts, evidence, limitations, next actions, and response-quality evaluation passing at 100/100 on gold cases.
- [2026-06-19] Session 63: Renamed the reusable Markdown prompt export to `Project Brief`, changed its download prefix to `aria-project-brief-...md`, and polished the toolbar labels to `Chat Brief` and `Project Brief`.
- [2026-06-19] Session 64: Reviewed the repo and refreshed `README.md` plus `agent.md` so documentation reflects the current Vercel/Vertex architecture, Project Brief export, conversation context, visualization sanity rules, committed RAG/Prophet/LangGraph artifacts, and remaining handoff notes.
