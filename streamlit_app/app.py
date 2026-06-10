"""No-spaces Streamlit Cloud entrypoint for the Stage 7 ARIA prototype app.

Streamlit Cloud can misparse dependency paths when the configured main module
lives under a directory containing spaces and a standalone hyphen. Keep the
actual Stage 7 source in place, but deploy this wrapper as:

    streamlit_app/app.py
"""

from pathlib import Path
import os
import runpy
import sys


ROOT = Path(__file__).resolve().parents[1]
STAGE_APP_DIR = ROOT / "Stage 7 - UI Interface" / "streamlit_app"
STAGE_APP = STAGE_APP_DIR / "app.py"

os.chdir(STAGE_APP_DIR)
sys.path.insert(0, str(STAGE_APP_DIR))
runpy.run_path(str(STAGE_APP), run_name="__main__")
