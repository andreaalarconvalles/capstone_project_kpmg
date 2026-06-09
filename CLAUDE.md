# CLAUDE.md — ARIA KPMG Capstone 2026

> This file is the operating manual for any AI agent working on this project.  
> Read it fully before doing anything. Follow every rule without exception.

---

## Project Overview

**ARIA** (Agentic Real-estate Intelligence Advisor) is a machine learning pricing and risk intelligence platform for the short-term rental market, built in partnership with **KPMG Spain** as an IE Business School Corporate Capstone 2026.

- **Cities:** Paris (120,809 listings) · Athens (14,242 listings)
- **Master dataset:** `aria_mega_dataset_v4_1_final.csv` — 135,051 listings × 96 columns
- **Models:** XGBoost price prediction (Paris + Athens) · LightGBM risk classification (Athens)
- **Stack:** Python · Jupyter · XGBoost · LightGBM · SHAP · Optuna · Pandas · Seaborn
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

### Rule 3 — Session Memory: Update README Every 5 Prompts

**After every 5 user prompts in a session, do two things:**

1. Edit `README.md` — add a `## Session Log` section at the bottom (or update it if it exists) with a timestamped bullet summarizing what was done in this session.

2. Edit this `CLAUDE.md` — update the `## Progress Tracker` section below with what has been completed and what remains.

This creates persistent memory across sessions so that any future agent (or human) picking up this project understands the current state without reading the full conversation history.

The format for README session log entries:
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

> Updated by the agent after every 5 prompts. Reflects the current state of the project.

### Completed
- [2026-06-09] Initialized GitHub repo (`capstone_project_kpmg`) and pushed all project files to `main` branch
- [2026-06-09] Created `README.md` with full project documentation (structure, dataset table, model descriptions, run order, data access instructions)
- [2026-06-09] Created `.gitignore` excluding large raw/processed CSVs (>50MB) and macOS/Jupyter noise
- [2026-06-09] Created `CLAUDE.md` with operating rules, skills, and memory tracking

### In Progress
- Nothing currently in progress

### Backlog / To Do
- Run full EDA notebook and validate all 15+ figures regenerate cleanly
- Validate XGBoost models (Paris + Athens) produce consistent RMSE on holdout
- Validate LightGBM risk model ROC-AUC on Athens holdout
- Build ARIA dashboard / deliverable for KPMG presentation
- Cross-city SHAP comparison write-up
- Final KPMG report

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

**When to use:** You want to stress-test a plan specifically against the existing documented decisions (this `CLAUDE.md`, the EDA notebook decisions, the methodology docs in `00 extra document/`).

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

---

## File Map

```
Final Capstone/
├── CLAUDE.md                          ← You are here
├── README.md                          ← Project docs + session log
├── .gitignore
├── eda/
│   ├── ARIA_EDA_v4_FINAL.ipynb        ← Run first — establishes all feature decisions
│   ├── ARIA_XGBoost_v1.ipynb          ← Price prediction (Paris + Athens)
│   ├── ARIA_LightGBM_v1.ipynb         ← Risk classification (Athens)
│   └── eda