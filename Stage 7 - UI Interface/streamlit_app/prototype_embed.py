"""Embed the checked-in ARIA React prototype inside Streamlit.

The Claude Design handoff is a static HTML page plus local JSX modules. Streamlit
components run in an iframe, so the JSX modules are inlined before rendering to
avoid brittle relative asset loading on Streamlit Community Cloud.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


STREAMLIT_FRAME_CSS = """
<style>
  #MainMenu,
  footer,
  header,
  [data-testid="stToolbar"],
  [data-testid="stDecoration"],
  [data-testid="stStatusWidget"] {
    display: none !important;
  }

  html,
  body,
  .stApp,
  [data-testid="stAppViewContainer"],
  [data-testid="stMain"],
  [data-testid="stMainBlockContainer"] {
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw !important;
    max-width: none !important;
    height: 100vh !important;
    overflow: hidden !important;
    background: #ffffff !important;
  }

  [data-testid="stVerticalBlock"],
  [data-testid="stElementContainer"] {
    gap: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  iframe,
  iframe[title="streamlit.components.v1.html"] {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    min-height: 100vh !important;
    border: 0 !important;
    display: block !important;
    background: #ffffff !important;
  }
</style>
"""

PROTOTYPE_SCRIPT_ORDER = (
    "tweaks-panel.jsx",
    "aria-data.jsx",
    "aria-charts.jsx",
    "aria-ui.jsx",
    "aria-ui2.jsx",
    "aria-main.jsx",
)

IFRAME_RESIZE_SCRIPT = """
<script>
  (function () {
    function fitToViewport() {
      try {
        var frame = window.frameElement;
        if (!frame) return;
        frame.style.width = "100vw";
        frame.style.height = window.parent.innerHeight + "px";
        frame.style.minHeight = window.parent.innerHeight + "px";
      } catch (error) {}
    }
    fitToViewport();
    window.addEventListener("resize", fitToViewport);
  })();
</script>
"""


def _prototype_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "prototype"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def build_inlined_prototype_html() -> str:
    prototype_dir = _prototype_dir()
    index_path = prototype_dir / "index.html"
    if not index_path.exists():
        raise FileNotFoundError(f"Missing ARIA prototype entrypoint: {index_path}")

    html_doc = _read_text(index_path)
    for script_name in PROTOTYPE_SCRIPT_ORDER:
        script_path = prototype_dir / script_name
        if not script_path.exists():
            raise FileNotFoundError(f"Missing ARIA prototype script: {script_path}")

        source_tag = f'<script type="text/babel" src="{script_name}"></script>'
        if source_tag not in html_doc:
            raise RuntimeError(f"Prototype index no longer references {script_name}")

        script_body = _read_text(script_path).replace("</script", "<\\/script")
        inline_tag = (
            f'<script type="text/babel" data-source="{script_name}">\n'
            f"{script_body}\n"
            "</script>"
        )
        html_doc = html_doc.replace(source_tag, inline_tag)

    html_doc = html_doc.replace("</body>", f"{IFRAME_RESIZE_SCRIPT}\n</body>")
    return html_doc


def render_prototype_app() -> None:
    st.set_page_config(
        page_title="ARIA - Airbnb Revenue Intelligence & Analytics",
        page_icon=":house:",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(STREAMLIT_FRAME_CSS, unsafe_allow_html=True)

    try:
        prototype_html = build_inlined_prototype_html()
    except Exception as exc:  # pragma: no cover - visible deployment fallback
        st.error(f"Unable to load the ARIA prototype: {exc}")
        return

    components.html(prototype_html, height=1200, scrolling=False)
