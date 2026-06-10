# CLAUDE.md — ARIA KPMG Capstone 2026

> This file is the operating manual for any AI agent working on this project.  
> Read it fully before doing anything. Follow every rule without exception.

---

## Project Overview

**ARIA** (Agentic Real-estate Intelligence Advisor) is a multi-agent AI system for short-term rental investment intelligence, built in partnership with **KPMG Spain** as an IE Business School Corporate Capstone 2026.

- **Cities:** Paris (120,809 listings: 63,520 Maven 2021 + 57,289 IAB 2025) · Athens (14,242 listings) · Total 135,051
- **Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns
- **Models:** XGBoost price prediction (Paris + Athens) · LightGBM risk classification (Athens)
- **Stack:** Python · Jupyter · XGBoost · LightGBM · Prophet · LangGraph · ChromaDB · Streamlit · SHAP · Optuna · Pandas · Seaborn · GPT-4o · ReportLab
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

### Rule 2 — Never Add Claude as a Git Contributor

**When committing or pushing to GitHub, never use Claude's identity as the author.**

This is a multi-contributor project. Always commit under the identity of the human team member who is driving the session. If the active contributor is not known, **ask before committing**.

```bash
git config user.name "<Human contributor's name>"
git config user.email "<Human contributor's email>"
```

Never set the author or committer to anything like "Claude", "claude-ai", "Anthropic", or any AI-related identity. The commit history must reflect only the human team.

When pushing:
```bash
git push https://ghp_<TOKEN>@github.com/lukatcheishvili/capstone_project_kpmg.git main
```

Do not add co-author trailers like `Co-authored-by: Claude <claude@anthropic.com>`.

### Rule 3 — Session Memory: Update CLAUDE.md Every 5 Prompts

**After every 5 user prompts in a session, do two things:**

1. Edit this `CLAUDE.md` — add or update the `## Session Log` section with a timestamped bullet summarizing what was done in this session.

2. Edit this `CLAUDE.md` — update the `## Progress Tracker` section below with what has been completed and what remains.

This creates persistent memory across sessions so that any future agent (or human) picking up this project understands the current state without reading the full conversation history.

Do not store running session history in `README.md`, deployment YAML, or Vercel config files. `CLAUDE.md` is the canonical agent memory file.

The format for session log entries:
```
- [YYYY-MM-DD] Session N: <what was done in 1–2 sentences>
```

### Rule 4 — Keep Phase Status Current in README

**Whenever any phase progresses, update the `## Project Phases & Team Assignments` table in `README.md` immediately.**

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
- [2026-06-10] Documentation memory routing: moved the running session log into `CLAUDE.md` and updated Rule 3 so future agent session notes stay out of README/YAML/deployment files.
- [2026-06-10] Stage 7 README link cleanup: made the Vercel deployment the only public website link in the Stage 7 README and removed the Streamlit launch badge/link.
- [2026-06-10] README Vercel link sync: updated every repo README to point at `https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/`.
- [2026-06-10] Main README link fix: corrected the root README Vercel line to clean Markdown link syntax after a nested link was introduced on `main`.
- [2026-06-10] Vercel sidebar control polish: added a fullscreen toggle directly beside the sidebar collapse button in the ARIA Vite UI.
- [2026-06-10] KPMG theme polish: made the KPMG theme use KPMG palette tokens across the Vite UI while preserving the Airbnb and Dark theme colors.
- [2026-06-10] Settings modal sizing fix: kept the Settings panel dimensions stable when switching from API & Models to About.

### In Progress

- Phase 4 — Prophet demand forecasting (Member 2) — notebook: ARIA_Prophet_v1.ipynb

### Backlog

- Phase 5 — RAG compliance agent (ChromaDB, AMA + Loi Le Meur, 137 unlicensed listings)
- Phase 6 — LangGraph orchestrator (5 agents, human-in-the-loop, dynamic pricing layer)
- Phase 7 — Streamlit MVP (3 tabs: investor, host, developer)
- KPMG final presentation and methodology document

---

## Session Log

- [2026-06-09] Session 1: Repository initialised. README, CLAUDE.md, .gitignore created and pushed.
- [2026-06-09] Session 2: Phase 1 EDA complete (A+/99). 135,051 rows x 96 cols. 41 pipeline steps. 10 figures. Business quantification complete.
- [2026-06-09] Session 3: Phase 2 XGBoost complete (A/96). Paris R2=0.588, Athens R2=0.676. 26-feature pipeline. 2,945 underpriced listings. EUR 4.8M foregone revenue. All 7 output files saved.
- [2026-06-09] Session 4: Phase 3 LightGBM complete (A/95). Leakage discovered and corrected. AUC=0.8288. 865 priority targets. EUR 1.43M opportunity.
- [2026-06-09] Session 5: README completely rewritten to reflect all 7 phases. CLAUDE.md updated. Placeholder folders created.
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
- [2026-06-10] Session 17: Moved the canonical session log from README into `CLAUDE.md` and updated agent instructions so future session history stays in this file.
- [2026-06-10] Session 18: Updated the Stage 7 README so the live website points to the current Vercel deployment and removed the Streamlit public launch link.
- [2026-06-10] Session 19: Updated every repo README with the current Vercel deployment URL: `https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/`.
- [2026-06-10] Session 20: Fixed the root README Vercel website line on `main` so the URL is a clean clickable Markdown link.
- [2026-06-10] Session 21: Added a fullscreen toggle beside the sidebar collapse button in the Vercel ARIA UI and wired it to the browser Fullscreen API.
- [2026-06-10] Session 22: Updated the KPMG theme so shell colors, CTA, logo treatment, agent accents, dashboard visuals, and charts use KPMG palette colors without changing Airbnb or Dark mode.
- [2026-06-10] Session 23: Fixed the Settings modal so the About tab keeps the same grey-panel dimensions as the API & Models tab.

---

## Skills Reference

Skills are invoked by name (e.g., `/diagnose`, `/grill-me`). The following skills from [mattpocock/skills](https://github.com/mattpocock/skills) are enabled for this project. Full skill definitions are embedded below.

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

**When to use:** You want to stress-test a plan specifically against the existing documented decisions (this `CLAUDE.md`, the EDA notebook decisions, the methodology docs in `docs/`).

**How it works:** Same as `/grill-me` but the agent actively cross-references with project documentation. If you use a term differently from how it's defined in the methodology docs, the agent calls it out immediately. Decisions that crystallize get written back into this `CLAUDE.md`.

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

**Output:** A handoff document saved to the OS temp directory. Includes: summary of what was done, what's in progress, what comes next, which skills the next session should invoke. Does not duplicate content already in commits or this `CLAUDE.md` — references them instead. Redacts any sensitive info (tokens, keys).

---

### `/review` — Review changes on two axes: Standards + Spec

**When to use:** You've made changes to notebooks, model code, or data transformations and want a structured review before committing.

**Two axes (run in parallel):**
- **Standards** — does the code conform to documented methodology and project conventions? (references this `CLAUDE.md` and the methodology docs)
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
├── CLAUDE.md
├── README.md
├── .gitignore
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb       ← Phase 1 — run FIRST
│   ├── ARIA_XGBoost_v1.ipynb         ← Phase 2
│   ├── ARIA_LightGBM_v1.ipynb        ← Phase 3
│   ├── ARIA_Prophet_v1.ipynb         ← Phase 4 (not started)
│   └── eda_figures/
├── data/
│   ├── raw/
│   ├── processed/                    ← gitignored
│   └── outputs/                      ← join key: listing_id
├── models/                           ← trained model files
├── rag/                              ← Phase 5
├── agents/                           ← Phase 6
├── app/                         ← Phase 7 — Streamlit app (3-tab persona MVP)
├── Stage 7 - UI Interface/      ← Phase 7 — agent-chat UI (React prototype + Streamlit host)
└── docs/                        ← methodology docs, proposals, planner
```
