# Stage 7 — ARIA Platform UI

[![Launch ARIA Platform UI](https://img.shields.io/badge/Launch%20ARIA%20Platform%20UI-Streamlit-ff4b4b?style=for-the-badge&logo=streamlit&logoColor=white)](https://capstoneprojectkpmg.streamlit.app/)

> **Live demo:** click the badge above to open the deployed ARIA Platform UI directly:
> [capstoneprojectkpmg.streamlit.app](https://capstoneprojectkpmg.streamlit.app/).
> No redeploy step is required. To run it on your own machine instead, see
> [Run the Streamlit app](#run-the-streamlit-app-recommended) below — it opens at
> **http://localhost:8501**.

The front-end MVP for **ARIA** (Airbnb Revenue Intelligence & Analytics) — a ChatGPT-style,
multi-agent AI platform built for the IE Business School × KPMG Spain Capstone 2026.
The Streamlit deployment now embeds the exact Claude Design React prototype so the deployed
demo keeps the same layout, styling, animations, sidebar, composer, model picker, and agent
experience as the original design handoff.

Five KPMG-proposed agents on one interface, each selectable like a custom GPT:

| Agent | Focus |
|---|---|
| 💶 Host Revenue Intelligence | Personal revenue manager — pricing, occupancy, underpricing gap |
| 🏘️ Gentrification Early Warning | Displacement risk 12–24 months ahead |
| 🕵️ STR Financial Crime Detection | AML anomaly detection & SAR drafting |
| 🚇 Tourism Demand Forecast | Infrastructure load intelligence |
| 🏗️ Market Entry Advisor | Site selection & ROI intelligence |

Every agent chat shows a LangGraph-style multi-agent reasoning trace, streams its answer,
and renders inline Recharts/SVG visuals (SHAP drivers, revenue simulation, risk bars, demand
forecast with confidence band, a pseudo-choropleth Athens map) plus a one-click brief export.

## Folder layout

```
Stage 7 - UI Interface/
├── ARIA_UI_Claude_Design_Prompt.md   # The original design brief
├── prototype/                        # React/HTML design handoff (claude.ai/design)
│   ├── index.html                    # Entry point — loads the .jsx via Babel + React (CDN)
│   ├── aria-data.jsx                 # Agents, models, scripted demo content
│   ├── aria-charts.jsx               # Recharts visuals + SVG pseudo-choropleth
│   ├── aria-ui.jsx / aria-ui2.jsx    # Sidebar, composer, model picker, settings, empty state
│   ├── aria-main.jsx                 # App root, streaming engine, hybrid Gemini call
│   └── tweaks-panel.jsx              # Live design-tweak panel
└── streamlit_app/                    # Streamlit host for the exact React prototype
    ├── app.py                        # Thin Streamlit entrypoint
    ├── prototype_embed.py            # Inlines prototype JSX and renders it full-page
    ├── aria_content.py               # Legacy native Streamlit content module
    ├── aria_charts.py                # Legacy native Streamlit chart module
    └── requirements.txt
```

## Run the Streamlit app (recommended)

```bash
cd "Stage 7 - UI Interface/streamlit_app"
pip install -r requirements.txt
streamlit run app.py
```

Opens at `http://localhost:8501`.

For Streamlit Community Cloud, set the main module to:

```text
Stage 7 - UI Interface/streamlit_app/app.py
```

This points Streamlit directly at the real Stage 7 app. The app renders the React prototype inside a full-page Streamlit component and writes its generated static HTML under `Stage 7 - UI Interface/streamlit_app/static/aria/`.

## Run the Vite React app

The repository root now also contains a Vite React build of the Claude Design handoff. It reuses the checked-in prototype modules from `src/legacy/` and bundles React, Recharts, and Lucide instead of loading them through CDN scripts.

```bash
npm install
npm run dev
```

For Vercel, use the repository root. `vercel.json` builds the Vite app with:

```bash
npm run build
```

and serves the generated `dist/` directory.

## Run the React prototype

The `.jsx` files are fetched over HTTP by in-browser Babel, so serve the folder rather than
opening `index.html` from disk:

```bash
cd prototype
python -m http.server 8000
# then open http://localhost:8000
```

## Hybrid intelligence (Demo ↔ Live)

- **Demo mode (default):** scripted, project-grounded answers. Every number ties to the real
  project — Paris 120,809 listings · Athens 14,242 · master dataset 135,051 × 96 columns ·
  XGBoost pricing · LightGBM risk · SHAP explainability.
- **Live mode:** paste a Google / Vertex AI **Gemini API key** into the sidebar **Access Key**
  field. The app auto-switches and routes free-form questions to the Generative Language API
  (`gemini-2.5-pro` / `gemini-2.5-flash`). Clear the key to return to demo.

The model picker also exposes the project's own ML engines: **XGBoost Pricing v1**,
**LightGBM Risk v1**, and **Prophet Forecast**.

> Note: live calls hit the Generative Language endpoint directly with the pasted key (works for
> Gemini API keys). True Vertex AI OAuth is out of MVP scope, matching the original design spec.

## Design system

Framer-style system from the Claude Design handoff. The prototype defaults to light mode
with Inter, neutral surfaces, hairline borders, pill-shaped CTAs, compact rounded controls,
agent accent gradients, and the built-in theme toggle for dark mode.
