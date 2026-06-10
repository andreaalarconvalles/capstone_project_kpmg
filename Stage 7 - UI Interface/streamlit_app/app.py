"""
ARIA — Airbnb Revenue Intelligence & Analytics
Streamlit recreation of the React design prototype (claude.ai/design handoff).

A ChatGPT-style, multi-agent AI platform MVP for the IE Business School × KPMG Spain
Capstone 2026. Five selectable agents, scripted demo conversations with LangGraph-style
reasoning traces, inline dark-themed charts + a pseudo-choropleth map, a model picker,
and a hybrid live mode that calls Gemini when an API key is supplied.

Run:  streamlit run app.py
"""
import time

import streamlit as st

from aria_content import (
    AGENTS, AGENT_BY_ID, MODELS, MODEL_BY_ID, C,
    SEED_CONVERSATIONS, get_script, generic_script,
)
from aria_charts import build_chart, build_map

# ---------------------------------------------------------------------------
# Page config + Framer dark theme
# ---------------------------------------------------------------------------
st.set_page_config(page_title="ARIA — Airbnb Revenue Intelligence & Analytics",
                   page_icon="💶", layout="wide", initial_sidebar_state="expanded")

st.markdown(f"""
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..700&display=swap');

  :root {{ --canvas:{C['canvas']}; --s1:{C['s1']}; --s2:{C['s2']}; --hair:{C['hair']};
           --ink:{C['ink']}; --muted:{C['muted']}; --blue:{C['blue']}; }}

  .stApp {{ background: var(--canvas); color: var(--ink);
            font-family: "Inter", system-ui, -apple-system, sans-serif;
            letter-spacing: -0.15px; }}
  section[data-testid="stSidebar"] {{ background: var(--s1); border-right: 1px solid var(--hair); }}
  section[data-testid="stSidebar"] * {{ letter-spacing: -0.14px; }}

  #MainMenu, footer, header {{ visibility: hidden; }}
  .block-container {{ padding-top: 2.2rem; max-width: 880px; }}

  h1,h2,h3,h4 {{ letter-spacing: -1px; font-weight: 600; color: var(--ink); }}

  /* Pills — all buttons are rounded pills on charcoal */
  .stButton > button {{
      border-radius: 100px; border: 1px solid var(--hair); background: var(--s1);
      color: var(--ink); font-weight: 500; font-size: 14px; letter-spacing: -0.14px;
      transition: background .15s, border-color .15s; padding: .4rem 1rem;
  }}
  .stButton > button:hover {{ background: var(--s2); border-color: #333; color: var(--ink); }}
  .stButton > button:focus {{ box-shadow: 0 0 0 1px rgba(0,153,255,.45); }}

  /* Primary CTA (New chat / Send) → white pill */
  .aria-primary .stButton > button {{ background:#fff; color:#000; border:none; font-weight:600; }}
  .aria-primary .stButton > button:hover {{ background:#eaeaea; color:#000; }}

  /* Inputs */
  .stTextInput input, .stChatInput textarea, [data-baseweb="select"] > div {{
      background: var(--s1) !important; border:1px solid var(--hair) !important;
      border-radius: 10px !important; color: var(--ink) !important; }}
  .stChatInput textarea {{ border-radius: 16px !important; }}
  ::placeholder {{ color: var(--muted) !important; }}

  /* Agent gradient identity tile */
  .aria-tile {{ width:64px; height:64px; border-radius:30px; display:flex; align-items:center;
                justify-content:center; font-size:30px; margin:0 auto 14px; }}

  .aria-muted {{ color: var(--muted); }}
  .aria-section {{ font-size:13px; font-weight:500; color:var(--muted); letter-spacing:-0.13px;
                   margin:14px 0 6px; text-transform:none; }}
  .aria-card {{ background:var(--s1); border:1px solid var(--hair); border-radius:12px; padding:10px 12px; }}
  .aria-chip {{ display:inline-block; }}
  .aria-greeting {{ font-size:32px; font-weight:500; letter-spacing:-1px; line-height:1.13;
                    text-align:center; margin:6px 0 22px; }}
  .stExpander {{ border:1px solid var(--hair) !important; border-radius:12px !important;
                 background: var(--s1) !important; }}
  div[data-testid="stChatMessage"] {{ background: transparent; }}
  .aria-badge {{ background:var(--s2); border:1px solid var(--hair); border-radius:100px;
                 padding:2px 9px; font-size:12px; color:var(--muted); }}
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
def init_state():
    ss = st.session_state
    ss.setdefault("agent_id", AGENTS[0]["id"])
    ss.setdefault("model_id", "gemini-2.5-pro")
    ss.setdefault("access_key", "")
    ss.setdefault("demo_mode", True)
    ss.setdefault("messages", [])        # list of user/assistant dicts
    ss.setdefault("pending", None)       # prompt queued for submission


init_state()


def cur_agent():
    return AGENT_BY_ID[st.session_state.agent_id]


def is_live():
    """Live mode = key present, demo off, and a Gemini model selected."""
    m = MODEL_BY_ID[st.session_state.model_id]
    return bool(st.session_state.access_key) and not st.session_state.demo_mode and not m["ml"]


# ---------------------------------------------------------------------------
# Script resolution (demo scripted  OR  live Gemini)
# ---------------------------------------------------------------------------
def gemini_call(api_key, model_id, agent, prompt):
    import requests
    system = (
        f"You are {agent['name']}, {agent['tagline']}. Project context: Airbnb data for "
        f"Paris (120,809 listings) and Athens (14,242 listings), a 135,051-listing master "
        f"dataset (96 columns), XGBoost pricing, LightGBM risk, SHAP explainability. "
        f"Use project vocabulary (listing, price_eur, log_price, dist_zone, risk score, "
        f"underpricing gap, SHAP value). Answer in ~180 words, concise and analytical."
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": prompt}]}],
    }
    r = requests.post(url, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def resolve_script(agent, prompt):
    """Return a script dict {trace, blocks, brief} for demo or live mode."""
    if is_live():
        model_id = st.session_state.model_id
        try:
            text = gemini_call(st.session_state.access_key, model_id, agent, prompt)
        except Exception as e:  # graceful fallback
            text = (f"⚠️ Live call failed ({type(e).__name__}). Check the API key in the sidebar "
                    f"or switch on Demo mode in Settings.\n\n_{str(e)[:160]}_")
        return {
            "trace": [
                {"node": "Router", "detail": f"routing to {agent['name']}"},
                {"node": "Retrieval", "detail": "retrieving project context"},
                {"node": "Gemini", "detail": f"generating with {MODEL_BY_ID[model_id]['name']}"},
            ],
            "blocks": [{"type": "text", "text": text}],
            "brief": {"title": f"{agent['name']} — Live answer", "kpis": [
                {"label": "Mode", "value": "Live · Gemini"}, {"label": "Model", "value": MODEL_BY_ID[model_id]["name"]},
                {"label": "Paris", "value": "120,809"}, {"label": "Athens", "value": "14,242"}]},
        }
    return get_script(agent["id"], prompt) or generic_script(agent, prompt)


def submit(prompt):
    agent = cur_agent()
    script = resolve_script(agent, prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.session_state.messages.append({
        "role": "assistant", "agent_id": agent["id"], "prompt": prompt,
        "script": script, "played": False, "live": is_live(),
    })


def load_conversation(conv):
    """Load a seeded conversation as a completed (static) thread."""
    st.session_state.agent_id = conv["agentId"]
    agent = AGENT_BY_ID[conv["agentId"]]
    script = get_script(conv["agentId"], conv["prompt"]) or generic_script(agent, conv["prompt"])
    st.session_state.messages = [
        {"role": "user", "content": conv["prompt"]},
        {"role": "assistant", "agent_id": conv["agentId"], "prompt": conv["prompt"],
         "script": script, "played": True, "live": False},
    ]


def new_chat():
    st.session_state.messages = []


# ---------------------------------------------------------------------------
# PDF / HTML brief export
# ---------------------------------------------------------------------------
def brief_html(agent, brief):
    kpis = "".join(
        f'<div style="border:1px solid #262626;border-radius:14px;padding:14px 16px;background:#141414">'
        f'<div style="color:#999;font-size:12px;margin-bottom:6px">{k["label"]}</div>'
        f'<div style="font-size:22px;font-weight:600;letter-spacing:-0.5px">{k["value"]}</div></div>'
        for k in brief["kpis"]
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>{brief['title']}</title>
<style>body{{font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;
max-width:720px;margin:40px auto;padding:0 24px;letter-spacing:-0.3px}}
.tag{{color:#999;font-size:13px}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}}
.foot{{color:#999;font-size:12px;border-top:1px solid #262626;padding-top:14px;margin-top:24px}}
h1{{font-size:26px;font-weight:600;letter-spacing:-1px;margin:6px 0 4px}}</style></head>
<body>
<div class="tag">{agent['emoji']} {agent['name']} · ARIA Brief</div>
<h1>{brief['title']}</h1>
<div class="grid">{kpis}</div>
<div class="foot">Generated by ARIA — Airbnb Revenue Intelligence &amp; Analytics ·
IE Business School × KPMG Spain — Capstone 2026. AI-generated; verify critical decisions.</div>
</body></html>"""


# ---------------------------------------------------------------------------
# Streaming generator
# ---------------------------------------------------------------------------
def stream_words(text, delay=0.012):
    buf = ""
    for word in text.split(" "):
        buf += word + " "
        yield buf
        time.sleep(delay)


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
def render_sidebar():
    with st.sidebar:
        st.markdown(
            "<div style='display:flex;align-items:center;gap:9px;font-size:19px;font-weight:600;"
            "letter-spacing:-0.6px;margin:2px 0 14px'>"
            "<span style='width:24px;height:24px;border-radius:7px;background:"
            "radial-gradient(circle at 30% 30%, #6a4cf5, #d44df0);display:inline-block'></span>"
            "ARIA</div>", unsafe_allow_html=True)

        st.markdown("<div class='aria-primary'>", unsafe_allow_html=True)
        if st.button("＋  New chat", use_container_width=True, key="newchat"):
            new_chat(); st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

        # Access Key (replaces the old AGENTS list — masked input)
        st.markdown("<div class='aria-section'>Access Key</div>", unsafe_allow_html=True)
        key = st.text_input("Access Key", value=st.session_state.access_key, type="password",
                            placeholder="Paste Vertex AI / Gemini API key",
                            label_visibility="collapsed", key="access_key_input")
        if key != st.session_state.access_key:
            st.session_state.access_key = key
            if key:
                st.session_state.demo_mode = False  # auto-switch to live
        if st.session_state.access_key and not st.session_state.demo_mode:
            st.markdown("<span class='aria-badge' style='color:#22c55e;border-color:#22c55e'>"
                        "● Live · Vertex AI / Gemini</span>", unsafe_allow_html=True)
        else:
            st.markdown("<span class='aria-badge'>● Demo mode · scripted responses</span>",
                        unsafe_allow_html=True)

        # Conversations
        st.markdown("<div class='aria-section'>Conversations</div>", unsafe_allow_html=True)
        groups = ["Today", "Yesterday", "Previous 7 days"]
        for g in groups:
            convs = [c for c in SEED_CONVERSATIONS if c["group"] == g]
            if not convs:
                continue
            st.markdown(f"<div class='aria-muted' style='font-size:11.5px;margin:8px 0 2px'>{g}</div>",
                        unsafe_allow_html=True)
            for c in convs:
                emoji = AGENT_BY_ID[c["agentId"]]["emoji"]
                if st.button(f"{emoji}  {c['title']}", key=f"conv_{c['id']}", use_container_width=True):
                    load_conversation(c); st.rerun()

        # Settings
        st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
        with st.expander("⚙  Settings"):
            tab1, tab2 = st.tabs(["API & Models", "About"])
            with tab1:
                st.text_input("Google API key (Vertex AI / Gemini)", type="password",
                              value=st.session_state.access_key, key="settings_key",
                              on_change=lambda: st.session_state.update(
                                  access_key=st.session_state.settings_key))
                st.text_input("GCP project ID", placeholder="aria-capstone-2026")
                st.selectbox("Region", ["europe-west1", "europe-west4", "us-central1"], index=0)
                default_model = st.selectbox("Default model", ["Gemini 2.5 Pro", "Gemini 2.5 Flash"], index=0)
                st.session_state.demo_mode = st.toggle("Demo mode (scripted responses)",
                                                       value=st.session_state.demo_mode)
                if st.button("Test connection"):
                    if st.session_state.access_key:
                        st.success("✓ Connected")
                    else:
                        st.error("✗ Failed — no key provided")
            with tab2:
                st.markdown(
                    "**ARIA** (Airbnb Revenue Intelligence & Analytics) is a multi-agent AI platform "
                    "demonstrating five KPMG-proposed intelligence systems on one interface — pricing, "
                    "displacement risk, financial-crime detection, demand forecasting, and market entry. "
                    "Built for **IE Business School × KPMG Spain — Capstone 2026**.")

        # User card
        st.markdown(
            "<div class='aria-card' style='margin-top:10px;display:flex;align-items:center;gap:10px'>"
            "<span style='width:30px;height:30px;border-radius:50%;background:#1c1c1c;"
            "display:flex;align-items:center;justify-content:center;font-weight:600'>L</span>"
            "<div><div style='font-weight:500;font-size:13.5px'>Luka Cheishvili</div>"
            "<div class='aria-muted' style='font-size:11.5px'>IE × KPMG Capstone</div></div></div>",
            unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Top selector row (agent picker + model picker)
# ---------------------------------------------------------------------------
def render_top_controls():
    col1, col2 = st.columns([1, 1])
    with col1:
        names = [a["name"] for a in AGENTS]
        idx = [a["id"] for a in AGENTS].index(st.session_state.agent_id)
        chosen = st.selectbox("Agent", names, index=idx, label_visibility="collapsed")
        new_id = AGENTS[names.index(chosen)]["id"]
        if new_id != st.session_state.agent_id:
            st.session_state.agent_id = new_id
            new_chat(); st.rerun()
    with col2:
        flat = [(m["id"], f"{m['name']} — {m['desc']}" + ("  ·  ML" if m["ml"] else ""))
                for g in MODELS for m in g["items"]]
        labels = [f[1] for f in flat]
        mid = [f[0] for f in flat].index(st.session_state.model_id)
        chosen_m = st.selectbox("Model", labels, index=mid, label_visibility="collapsed")
        st.session_state.model_id = flat[labels.index(chosen_m)][0]
    m = MODEL_BY_ID[st.session_state.model_id]
    if m["ml"]:
        st.markdown(f"<span class='aria-badge'>Engine: {m['chip']}</span>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Empty state
# ---------------------------------------------------------------------------
def render_empty_state():
    agent = cur_agent()
    st.markdown(
        f"<div class='aria-tile' style='background:radial-gradient(circle at 30% 30%, "
        f"{agent['accent']}, {C['s2']})'>{agent['emoji']}</div>"
        f"<div style='text-align:center;font-size:18px;font-weight:600'>{agent['name']}</div>"
        f"<div class='aria-muted' style='text-align:center;font-size:13.5px;margin-bottom:14px'>"
        f"{agent['tagline']}</div>"
        f"<div class='aria-greeting'>What should we analyze today?</div>",
        unsafe_allow_html=True)

    chips = agent["chips"]
    rows = [chips[:2], chips[2:]]
    for r in rows:
        cols = st.columns(2)
        for i, chip in enumerate(r):
            with cols[i]:
                if st.button(chip, key=f"chip_{chip}", use_container_width=True):
                    st.session_state.pending = chip
                    st.rerun()


# ---------------------------------------------------------------------------
# Render one assistant message (with optional play-through animation)
# ---------------------------------------------------------------------------
def render_assistant(msg, idx):
    agent = AGENT_BY_ID[msg["agent_id"]]
    script = msg["script"]
    animate = not msg["played"]
    n = len(script["trace"])
    dur = f"{n * 0.6 + 0.4:.1f}s"

    with st.chat_message("assistant", avatar=agent["emoji"]):
        # Reasoning trace
        if animate:
            with st.status(f"Running {n} agents…", expanded=True) as status:
                for step in script["trace"]:
                    st.markdown(f"**{step['node']}** &nbsp;·&nbsp; {step['detail']}",
                                unsafe_allow_html=True)
                    time.sleep(0.6)
                status.update(label=f"Ran {n} agents · {dur}", state="complete", expanded=False)
        else:
            with st.expander(f"✓ Ran {n} agents · {dur}"):
                for step in script["trace"]:
                    st.markdown(f"**{step['node']}** &nbsp;·&nbsp; {step['detail']}",
                                unsafe_allow_html=True)

        # Blocks
        for j, b in enumerate(script["blocks"]):
            if b["type"] == "text":
                if animate:
                    st.write_stream(stream_words(b["text"]))
                else:
                    st.markdown(b["text"])
            elif b["type"] == "chart":
                st.plotly_chart(build_chart(b["chart"]["kind"], b["chart"].get("title")),
                                use_container_width=True, key=f"ch_{idx}_{j}")
            elif b["type"] == "map":
                st.plotly_chart(build_map(b["map"].get("metric", "risk"), b["map"].get("title")),
                                use_container_width=True, key=f"mp_{idx}_{j}")

        # Action row
        a, bcol, ccol, _ = st.columns([1, 1.2, 1.6, 4])
        with a:
            st.button("⧉ Copy", key=f"copy_{idx}", use_container_width=True)
        with bcol:
            if st.button("↻ Regenerate", key=f"regen_{idx}", use_container_width=True):
                st.session_state.pending = msg["prompt"]
                st.rerun()
        with ccol:
            st.download_button("⬇ Export PDF Brief", data=brief_html(agent, script["brief"]),
                               file_name=f"ARIA_brief_{msg['agent_id']}.html", mime="text/html",
                               key=f"brief_{idx}", use_container_width=True)

    if animate:
        msg["played"] = True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
render_sidebar()
render_top_controls()

if not st.session_state.messages:
    render_empty_state()
else:
    for idx, msg in enumerate(st.session_state.messages):
        if msg["role"] == "user":
            with st.chat_message("user", avatar="🧑"):
                st.markdown(msg["content"])
        else:
            render_assistant(msg, idx)

# Composer
placeholder = f"Ask {cur_agent()['name']}…"
typed = st.chat_input(placeholder)
if typed:
    st.session_state.pending = typed
    st.rerun()

# Process any queued prompt (from chips / chat input / regenerate)
if st.session_state.pending:
    p = st.session_state.pending
    st.session_state.pending = None
    submit(p)
    st.rerun()

st.markdown(
    "<div class='aria-muted' style='text-align:center;font-size:12px;margin-top:14px'>"
    "ARIA can make mistakes. Verify critical pricing decisions. — IE × KPMG Capstone 2026</div>",
    unsafe_allow_html=True)
