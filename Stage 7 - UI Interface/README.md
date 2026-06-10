# Stage 7 — ARIA Platform UI

The front-end MVP for **ARIA** (Airbnb Revenue Intelligence & Analytics) — a ChatGPT-style,
multi-agent AI platform built for the IE Business School × KPMG Spain Capstone 2026.

Five KPMG-proposed agents on one interface, each selectable like a custom GPT:

| Agent | Focus |
|---|---|
| 💶 Host Revenue Intelligence | Personal revenue manager — pricing, occupancy, underpricing gap |
| 🏘️ Gentrification Early Warning | Displacement risk 12–24 months ahead |
| 🕵️ STR Financial Crime Detection | AML anomaly detection & SAR drafting |
| 🚇 Tourism Demand Forecast | Infrastructure load intelligence |
| 🏗️ Market Entry Advisor | Site selection & ROI intelligence |

Every agent chat shows a LangGraph-style multi-agent reasoning trace, streams its answer,
and renders inline dark-themed charts (SHAP drivers, revenue simulation, risk bars, demand
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
└── streamlit_app/                    # Production-grade Streamlit recreation
    ├── app.py                        # UI orchestration
    ├── aria_content.py               # Agents, models, scripts, datasets, seeds
    ├── aria_charts.py                # Plotly dark charts + pseudo-choropleth map
    └── requirements.txt
```

## Run the Streamlit app (recommended)

```bash
cd streamlit_app
pip install -r requirements.txt
streamlit run app.py
```

Opens at `http://localhost:8501`.

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

Dark-only "Framer" system — canvas `#090909`, surface lifts (`#141414` → `#1c1c1c`),
hairline borders `#262626`, single muted gray `#999999`, Inter with aggressively negative
tracking, pill-shaped CTAs, and one gradient accent per agent. Elevation is surface lift,
not shadow.
