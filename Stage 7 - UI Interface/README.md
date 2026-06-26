# Stage 7 — ARIA Platform UI

**Live Vercel website:** [https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/](https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/)

**Agent handoff and current operating rules:** [`../agent.md`](../agent.md)

The front-end MVP for **ARIA** (Airbnb Revenue Intelligence & Analytics) — a ChatGPT-style,
multi-agent AI platform built for the IE Business School × KPMG Spain Capstone 2026.
The current public demo is deployed through Vercel from `vercel_vite_app/`, preserving the
Claude Design layout, styling, animations, sidebar, composer, model picker, and agent
experience in a Vite React build. Custom typed prompts route through the Vercel
`/api/chat` function, which loads live GitHub project data, computes deterministic analytics,
and uses Vertex AI models for the final consumer-friendly explanation.

ARIA defaults to **Auto Agent**, which reads the user's prompt and selects the best specialist
before running the scripted or live analysis. The five KPMG-proposed agents remain available
as manual overrides:

| Agent | Focus |
|---|---|
| Host Revenue Intelligence | Personal revenue manager — pricing, occupancy, underpricing gap |
| Gentrification Early Warning | Displacement risk 12–24 months ahead |
| STR Financial Crime Detection | AML anomaly detection & SAR drafting |
| Tourism Demand Forecast | Infrastructure load intelligence |
| Market Entry Advisor | Site selection & ROI intelligence |

Every agent chat shows a folded LangGraph-style multi-agent reasoning trace, streams its answer,
and renders inline Recharts/SVG visuals. Scripted prompts keep polished demo answers, while
custom prompts return up to 4 KPI cards, one chart or real map overlay when geography is
available, and an expandable details panel with methodology, source files, caveats, and
extra numbers. Conversations persist in the browser with `localStorage`, so refreshing the
site keeps the chat history and active thread. A conversation disappears only when the user
deletes it from the sidebar. Users can export either a single answer brief from each response
or a full conversation brief from the composer control next to the model picker.

## Folder layout

```
Stage 7 - UI Interface/
├── ARIA_UI_Claude_Design_Prompt.md   # The original design brief
├── app/                              # Original Phase 7 three-tab Streamlit MVP notes
├── deployment_support/               # Archived root-level UI deployment compatibility files
│   └── root_streamlit_requirements.txt
├── prototype/                        # React/HTML design handoff (claude.ai/design)
│   ├── index.html                    # Entry point — loads the .jsx via Babel + React (CDN)
│   ├── aria-data.jsx                 # Agents, models, scripted demo content
│   ├── aria-charts.jsx               # Recharts visuals + SVG pseudo-choropleth
│   ├── aria-ui.jsx / aria-ui2.jsx    # Sidebar, composer, model picker, settings, empty state
│   ├── aria-main.jsx                 # App root, streaming engine, hybrid Gemini call
│   └── tweaks-panel.jsx              # Live design-tweak panel
├── streamlit_app/                    # Streamlit host for the exact React prototype
│   ├── .streamlit/
│   │   └── config.toml                # Streamlit static-serving config
│   ├── app.py                        # Thin Streamlit entrypoint
│   ├── prototype_embed.py            # Inlines prototype JSX and renders it full-page
│   ├── aria_content.py               # Legacy native Streamlit content module
│   ├── aria_charts.py                # Legacy native Streamlit chart module
│   └── requirements.txt
└── vercel_vite_app/                  # Vercel-ready Vite React deployment
    ├── api/
    │   ├── chat.js                    # Server-side Vertex AI endpoint
    │   ├── analytics-pipeline.js      # GitHub CSV fetch, caching, analytics, chart payloads
    │   └── project-context.js         # Shared project facts and fallback context
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

`npm run dev` starts the front-end locally. The deployed custom-prompt flow depends on Vercel
Functions and the production environment variables, especially `GOOGLE_APPLICATION_CREDENTIALS_JSON`
for server-side Vertex authentication.

Live Vercel deployment:

```text
https://capstone-project-kpmg-git-main-lukatcheishvilis-projects.vercel.app/
```

For the existing Vercel project, keep using the repository root. The root `vercel.json` routes Vercel into this nested app folder with:

```bash
cd "Stage 7 - UI Interface/vercel_vite_app" && npm install
cd "Stage 7 - UI Interface/vercel_vite_app" && npm run build
```

and serves `Stage 7 - UI Interface/vercel_vite_app/dist`.

If you create a new Vercel project later, you can also set the Vercel root directory directly to `Stage 7 - UI Interface/vercel_vite_app`; the nested `vercel.json` then uses `npm run build` and serves `dist`.

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
- **Live custom prompts:** suggested prompts keep the scripted demo answers. Any other typed
  prompt calls `/api/chat`, which uses public raw GitHub CSV files by default, optional
  `GITHUB_TOKEN` for rate limits, runtime caching, deterministic analytics, and Vertex AI
  model routing. Gemini 2.5 Pro is the default in every fresh session; Gemini 2.5 Flash,
  Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, and Claude Opus 4.7 are also exposed
  in the model picker.
- **Authentication:** the user can enter the Vertex project ID and project number in Settings,
  but the actual Google Cloud service-account credential must stay server-side in Vercel as
  `GOOGLE_APPLICATION_CREDENTIALS_JSON`. The sidebar masks the project details with asterisks.

The Claude options use the Vertex AI Anthropic partner-model route in `/api/chat`, while the
Gemini options use the Google `generateContent` route. The model picker also exposes the
project's own analytical engines: **XGBoost Pricing v1**, **LightGBM Risk v1**, **Prophet Forecast**,
and committed **RAG Compliance** handoff outputs for analyst triage.

The backend response contract is structured: `answer`, `intent`, `kpis`, `visualizations`,
`details`, and `sources`. The UI renders the answer first, centers the KPI cards, selects the
chart type based on the prompt, hides internal quality scores, avoids raw snake_case labels,
transliterates Greek place names into English with the original in brackets, keeps the agent
workflow folded unless the user opens it, and uses Leaflet/OpenStreetMap-derived maps for
supported geographic prompts instead of fake region grids.

The Auto Agent router uses the prompt to choose a primary specialist: pricing/revenue prompts
route to Host Revenue Intelligence, displacement and living-risk prompts route to Gentrification
Early Warning, compliance/anomaly prompts route to STR Financial Crime Detection, demand and
seasonality prompts route to Tourism Demand Forecast, and investment/city-comparison/map prompts
route to Market Entry Advisor. Supporting agents are recorded for the folded workflow context.

## Scripted prompts

The landing page shows 4 scripted prompts by default, with a show-more control for all 8:

1. Which Paris arrondissement is best for a new short-term rental investment?
2. Which Paris areas look saturated and should I avoid?
3. Is my Paris listing underpriced compared with similar listings?
4. What price change could improve my Athens listing revenue?
5. Which Athens neighbourhoods offer the strongest short-term rental yield?
6. Which Athens listings need attention first because they are high-risk and underpriced?
7. Where is host risk highest in Athens?
8. Compare Paris vs Athens for a small short-term rental portfolio.

## Design system

Framer-style system from the Claude Design handoff. The prototype defaults to light mode
with Inter, neutral surfaces, hairline borders, pill-shaped CTAs, compact rounded controls,
agent accent gradients, the checked-in ARIA wordmark, and a theme dropdown for Airbnb, KPMG,
and Dark modes. The About tab credits the group members' guidance plus Codex and Claude Code
assistance in the UI build process.
