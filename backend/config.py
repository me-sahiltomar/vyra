"""
config.py
----------
Centralised application configuration loaded from .env.

All services import settings from here — no os.getenv() scattered
across the codebase.
"""

import os
from pathlib import Path

# Load .env if python-dotenv is available (graceful fallback otherwise)
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv not installed → rely on real environment variables

# ── Database ──────────────────────────────────────────────────────────────────
# DB_PATH can be absolute or relative to this file's directory.
_raw_db_path = os.getenv("DB_PATH", "vyra.db")
DB_PATH: str = (
    _raw_db_path
    if os.path.isabs(_raw_db_path)
    else str(Path(__file__).parent / _raw_db_path)
)

# ── Server ────────────────────────────────────────────────────────────────────
HOST:   str = os.getenv("HOST",   "0.0.0.0")
PORT:   int = int(os.getenv("PORT",   "8000"))
RELOAD: bool = os.getenv("RELOAD", "true").lower() == "true"

# ── Application ───────────────────────────────────────────────────────────────
APP_ENV:   str = os.getenv("APP_ENV",   "development")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG").upper()

# ── Security ───────────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
