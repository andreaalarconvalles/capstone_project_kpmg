# Stage 7 — ARIA Platform UI

**Live Vercel website:** [https://capstone-project-kpmg-iarimooha-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-iarimooha-lukatcheishvilis-projects.vercel.app/)

The front-end MVP for **ARIA** (Airbnb Revenue Intelligence & Analytics) — a ChatGPT-style,
multi-agent AI platform built for the IE Business School × KPMG Spain Capstone 2026.
The current public demo is deployed through Vercel from `vercel_vite_app/`, preserving the
Claude Design layout, styling, animations, sidebar, composer, model picker, and agent
experience in a Vite React build.

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
├── streamlit_app/                    # Streamlit host for the exact React prototype
│   ├── app.py                        # Thin Streamlit entrypoint
│   ├── prototype_embed.py            # Inlines prototype JSX and renders it full-page
│   ├── aria_content.py               # Legacy native Streamlit content module
│   ├── aria_charts.py                # Legacy native Streamlit chart module
│   └── requirements.txt
└── vercel_vite_app/                  # Vercel-ready Vite React deployment
    ├── index.html
    ├── package.json
    ├── public/
    │   └── aria-wordmark.svg          # ARIA wordmark used on landing/sidebar
    ├── vercel.json
    ├── vite.config.js
    └── src/
```

## Run the legacy Streamlit host (optional)

```bash
cd "Stage 7 - UI Interface/streamlit_app"
pip install -r requirements.txt
streamlit run app.py
```

Opens at `http://localhost:8501`.

For a Streamlit Community Cloud compatibility deployment, set the main module to:

```text
Stage 7 - UI Interface/streamlit_app/app.py
```

This points Streamlit directly at the real Stage 7 app. The app renders the React prototype inside a full-page Streamlit component and writes its generated static HTML under `Stage 7 - UI Interface/streamlit_app/static/aria/`.

## Run the Vite React app

The `vercel_vite_app/` folder contains the Vite React build of the Claude Design handoff. It reuses the checked-in prototype modules from `src/legacy/` and bundles React, Recharts, and Lucide instead of loading them through CDN scripts.
The live Vercel landing page uses `public/aria-wordmark.svg` above the main prompt and in the sidebar, with the agent subtitle removed for a cleaner first view.

```bash
cd "Stage 7 - UI Interface/vercel_vite_app"
npm install
npm run dev
```

Live Vercel deployment:

```text
https://capstone-project-kpmg-iarimooha-lukatcheishvilis-projects.vercel.app/
```

For the existing Vercel project, keep using the repository root. The root `vercel.json` routes Vercel into this nested app folder with:

```bash
cd "Stage 7 - UI Interface/vercel_vite_app" && npm install
cd "Stage 7 - UI Interface/vercel_vite_app" && npm run build
```

and serves `Stage 7 - UI Interface/vercel_vite_app/dist`.

If you create a new Vercel project later, you can also set the Vercel root directory to `Stage 7 - UI Interface/vercel_vite_app`; the nested `vercel.json` then uses `npm run build` and serves `dist`.

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
agent accent gradients, the checked-in ARIA wordmark, and the built-in theme toggle for dark mode.
