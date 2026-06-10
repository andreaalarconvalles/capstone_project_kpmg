# ARIA Platform UI — Claude Design Prompt

> Paste everything below this line into a new Claude session (claude.ai or Claude Code) to build the MVP UI.

---

## ROLE & GOAL

You are building **ARIA** (Airbnb Revenue Intelligence & Analytics) — a ChatGPT-style multi-agent AI platform MVP for an IE Business School × KPMG Spain capstone (2026). The audience is **capstone judges**: the UI must look production-grade and demonstrate that 5 proposed AI agent systems can be implemented on one platform. This is a frontend MVP — polish and storytelling over backend completeness.

Build it as a **single-file React app** (one .jsx file, default export, no required props). Use Tailwind core utility classes only, `lucide-react` for icons, `recharts` for charts. **Do NOT use localStorage/sessionStorage** — keep all state in React memory, pre-seeded with demo data.

---

## CORE CONCEPT

A ChatGPT-clone interface where each of our 5 proposed KPMG ideas is a selectable **Agent** (like ChatGPT's GPTs). Users chat with an agent, watch a multi-agent LangGraph-style reasoning trace, get answers with inline charts, and can export PDF briefs. Responses are **hybrid**: scripted demo conversations by default (fake streaming), with a real Gemini API call when a Google API key is entered in Settings.

---

## LAYOUT (ChatGPT-style, exact structure)

### 1. Left Sidebar (collapsible, ~260px)
Top to bottom:
- **ARIA wordmark** + collapse button
- **New chat** button (white pill — primary CTA)
- **Search chats** input
- **AGENTS section** — the 5 agents, each with icon + name; clicking selects the agent and opens its empty state:
  1. 💶 **Host Revenue Intelligence** — "Your personal revenue manager"
  2. 🏘️ **Gentrification Early Warning** — "Displacement risk 12–24 months ahead"
  3. 🕵️ **STR Financial Crime Detection** — "AML anomaly & SAR intelligence"
  4. 🚇 **Tourism Demand Forecast** — "Infrastructure load intelligence"
  5. 🏗️ **Market Entry Advisor** — "Site selection & ROI intelligence"
- **CONVERSATIONS section** — seeded chat history grouped by date ("Today", "Yesterday", "Previous 7 days"), each row shows agent icon + title; hover reveals rename/delete
- Bottom: **user card** (avatar "L", "Luka Cheishvili", "IE × KPMG Capstone") + **⚙ Settings** button

### 2. Main Area
**Empty state** (per agent): centered agent icon + name, one-line description, greeting headline ("What should we analyze today?" — display type, tight tracking), then **4 suggested prompt chips** (clickable, agent-specific — listed below), composer at center.

**Chat view**: message thread, user messages right-aligned in `surface-1` bubbles, assistant messages full-width plain text on canvas (ChatGPT style). Assistant responses include:
- **Agent reasoning trace** — collapsible panel ABOVE the answer, auto-expanded while "thinking": sequential LangGraph steps with status icons (spinner → ✓), e.g. `Pricing Agent → analyzing 23 comparables`, `Demand Agent → 90-day occupancy forecast`, `Orchestrator → composing brief`. Each step ~600ms apart. Collapses to "Ran 4 agents · 3.2s" when done.
- **Streaming text** — render the scripted answer word-by-word (~20ms/word)
- **Inline charts** (recharts, dark-themed, render where the script specifies): SHAP horizontal bar chart, forecast line chart with confidence band, neighbourhood risk bar chart
- **Inline "map" panel** (for Gentrification + Demand agents): a lightweight SVG pseudo-choropleth — 8–12 neighbourhood rectangles/hexes colored by risk score (gradient-coral high → surface-2 low) with hover tooltips. No real map library needed; it just has to read as geospatial intelligence
- **Action row** under each response: copy · regenerate · **⬇ Export PDF Brief** (triggers window.print() on a styled brief view, or generates a downloadable HTML brief — keep simple)

### 3. Composer (bottom-center, max-width ~768px)
- Rounded `xl` input on `surface-1`, placeholder "Ask {agent name}…"
- Left: ＋ attach button (non-functional, visual only)
- Right inside composer: **model picker dropdown** + mic icon + send button (white circle)
- **Model picker** (ChatGPT "Instant/Thinking" style dropdown) with two groups:
  - *Vertex AI Models*: `Gemini 2.5 Pro` (default · "Deep analysis"), `Gemini 2.5 Flash` ("Fast responses")
  - *ARIA Analysis Engines* (badge "ML"): `XGBoost Pricing v1` ("Price prediction · Paris + Athens"), `LightGBM Risk v1` ("Underpricing risk · Athens"), `Prophet Forecast` ("Occupancy 30/90d")
  - Selecting an ML engine shows a small chip in the composer ("Engine: XGBoost Pricing")

### 4. Settings Modal
Tabs: **API & Models** | **About**
- API & Models: password-type input for **Google API key (Vertex AI / Gemini)**, GCP project ID field, region dropdown (europe-west1 default), default model selector, **"Test connection"** button (shows ✓ Connected / ✗ Failed), toggle **"Demo mode"** (on = scripted responses; off = live API)
- About: one paragraph on ARIA + team + "IE Business School × KPMG Spain — Capstone 2026"

---

## HYBRID INTELLIGENCE LOGIC

```
if (demoMode || !apiKey) → play scripted conversation for the matched suggested prompt
                           (or a generic scripted fallback for free-form questions)
else → POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
       with a system prompt: "You are {agent name}, {agent description}. Project context:
       Airbnb data for Paris (120,809 listings) and Athens (14,242 listings),
       135,051-listing master dataset, XGBoost pricing, LightGBM risk, SHAP explainability."
```
Always show the reasoning trace animation in both modes (in live mode label the steps generically: "Routing to {agent} → Retrieving context → Generating with Gemini"). Map model picker names to API model IDs (`gemini-2.5-pro`, `gemini-2.5-flash`). Note: plain API keys work against the Generative Language endpoint from the browser; true Vertex AI OAuth is out of MVP scope — the Settings UI says "Vertex AI / Gemini API key" regardless.

---

## SCRIPTED DEMO CONTENT (write these in full)

Ground every number in the real project: **Paris 120,809 listings · Athens 14,242 · master dataset 135,051 × 96 columns · XGBoost price prediction (Paris + Athens) · LightGBM risk classification (Athens) · SHAP explainability · Optuna tuning**. Use project vocabulary exactly: *listing, price_eur, log_price, dist_zone (centre/mid/outer/far), risk score, underpricing gap, SHAP value, neighbourhood_stats, host_tenure_days*.

Per agent: 4 suggested prompt chips, and for at least 2 chips a full scripted exchange (reasoning trace steps + 150–250 word answer + one chart + PDF-brief offer). Suggested chips:

**Host Revenue Intelligence**: "Why is my listing underpriced vs the neighbourhood?" · "Forecast my occupancy for the next 90 days" · "Rewrite my listing description to convert better" · "Simulate revenue: current vs recommended pricing" → SHAP bar chart (top drivers: dist_zone, accommodates, review_scores_rating, host_tenure_days), revenue simulation line chart. Answer cites an *underpricing gap* in EUR and % uplift (e.g. +18–30%).

**Gentrification Early Warning**: "Which Athens neighbourhoods show displacement risk in the next 12 months?" · "Show STR density growth by dist_zone" · "Draft a policy brief for the city housing department" · "What intervention thresholds should Paris adopt?" → neighbourhood risk score bar chart (e.g. Koukaki, Exarchia, Plaka with risk scores), trend line.

**STR Financial Crime Detection**: "Flag listings with ghost-listing patterns in Paris" · "Show the top AML risk scores with SHAP explanations" · "Any circular booking network signals?" · "Draft a SAR for listing #48213" → anomaly scatter/bar chart, risk score distribution. Answer references Isolation Forest flags + a drafted SAR summary.

**Tourism Demand Forecast**: "Forecast tourist-nights in central Athens for peak season" · "Which districts hit infrastructure stress in August?" · "Translate occupancy into waste & transit load" · "Run high/base/low scenario for summer 2026" → forecast line chart with confidence band, district stress bar chart.

**Market Entry Advisor**: "Which Paris arrondissements are supply-constrained?" · "Rank Athens neighbourhoods by projected STR yield" · "Where is regulatory risk too high to build?" · "Compare Paris vs Athens for a 50-unit portfolio" → yield-by-neighbourhood bar chart, supply/demand gap chart.

---

## DESIGN SYSTEM — FRAMER (apply strictly)

Dark-only. The brand IS dark. Source: Framer DESIGN.md (VoltAgent/awesome-design-md).

### Colors
| Token | Hex | Use |
|---|---|---|
| canvas | `#090909` | Page + main chat background |
| surface-1 | `#141414` | Sidebar, cards, composer, user bubbles, secondary buttons |
| surface-2 | `#1c1c1c` | Hover/selected states, featured cards, modal |
| hairline | `#262626` | 1px borders, dividers |
| hairline-soft | `#1a1a1a` | Subtle dividers |
| ink | `#ffffff` | Primary text |
| ink-muted | `#999999` | Secondary text — ONLY this gray, hierarchy is binary |
| primary | `#ffffff` on `#000000` | Primary CTA pills (New chat, Send) |
| accent-blue | `#0099ff` | ONLY links, focus rings, selected indicators — never fills/backgrounds |
| gradient-violet | `#6a4cf5` | Agent spotlight accents (sparingly) |
| gradient-magenta | `#d44df0` | Agent spotlight accents |
| gradient-orange | `#ff7a3d` | Agent spotlight accents |
| gradient-coral | `#ff5577` | Agent spotlight accents |
| success | `#22c55e` | "Connected" state, checkmarks |

Give each of the 5 agents one gradient color as its identity accent (icon background as a subtle radial gradient tile, 30px radius). One or two gradient touches per viewport max — gradients are cards/accents, never section backgrounds.

### Typography
Inter (or Inter Variable) everywhere; display headlines at weight 500–600 with **aggressively negative tracking**:
- Greeting headline: ~32px, weight 500, letter-spacing -1px, line-height 1.13
- Section labels (AGENTS, CONVERSATIONS): 13px, weight 500, ink-muted, letter-spacing -0.13px
- Body/chat: 15px, weight 400, line-height 1.3, letter-spacing -0.15px
- Buttons/meta: 14px, weight 500, letter-spacing -0.14px
- Hierarchy via size + ink/ink-muted contrast, NOT bold ramps.

### Shape & spacing
- All CTAs are **pills** (border-radius 100px): New chat, Send, Test connection. Never square buttons, never bordered ghost buttons — secondary actions are `surface-1` charcoal pills.
- Inputs/list rows: 10px radius. Cards/composer: 15–20px. Agent gradient tiles: 30px.
- Spacing on a 5px base: 10/15/20/30/40.
- Elevation = surface lift (canvas → surface-1 → surface-2), not shadows. Focus ring: `0 0 0 1px rgba(0,153,255,0.15)`. Modal: light top edge `rgba(255,255,255,0.10)` + soft drop shadow.

### Don'ts
No light mode. No second gray besides #999999. No blue buttons/fills. No gradient section backgrounds. Max one chromatic accent (+ the gradient family as agent identities only).

---

## INTERACTION POLISH (judge-impressing details)

- Sidebar collapse animation; active conversation row gets `surface-2` lift
- Word-by-word streaming with blinking cursor; "Stop generating" pill while streaming
- Reasoning trace steps animate in sequentially with spinner→check transitions
- Model picker opens upward with smooth scale/fade; selected row shows ✓
- Suggested chips: `surface-1` pills that lift to `surface-2` on hover
- Keyboard: Enter sends, Shift+Enter newline, `/` focuses composer
- Charts fade in after their text paragraph finishes streaming
- Footer microcopy under composer: "ARIA can make mistakes. Verify critical pricing decisions. — IE × KPMG Capstone 2026"

---

## BUILD ORDER

1. Static layout: sidebar + empty state + composer (Framer tokens applied)
2. Agent switching + seeded conversations + chat thread rendering
3. Scripted engine: streaming, reasoning trace, charts
4. Model picker + Settings modal + hybrid Gemini call
5. PDF brief export + polish pass (animations, keyboard, edge cases)

Deliver one complete .jsx file. Prioritize visual fidelity to the Framer system — judges see design quality first.
