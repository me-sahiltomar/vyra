"""
main.py — H²OS FastAPI Application Entry Point
"""

import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import HOST, PORT, RELOAD, LOG_LEVEL
from routes import core, extended, auth, export
from middleware.csrf import CSRFProtection

# ── Logging setup ─────────────────────────────────────────────────────────────
import sys
import io

# Force UTF-8 for standard output if possible
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.DEBUG),
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("h2os")

# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="H²OS — Human Health Operating System API",
    description=(
        "Rule-based health tracking backend for H²OS.\n\n"
        "Provides nutrition logging, habit management, environmental intelligence, "
        "fitness planning, and health scoring.\n\n"
        "**API Version:** v1  |  All routes are prefixed `/api/v1/`"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Rate Limit Exception Handler ─────────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Please try again later."},
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
# NOTE: allow_credentials=True cannot be combined with allow_origins=["*"].
# We list every localhost origin that frontend might use instead.
ALLOWED_ORIGINS = [
    "http://localhost:3456",
    "http://127.0.0.1:3456",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate Limiting Middleware ─────────────────────────────────────────────────
from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    log.debug(f"→ {request.method} {request.url.path}  origin={request.headers.get('origin', '-')}")
    response = await call_next(request)
    log.debug(f"← {response.status_code} {request.url.path}")
    return response


# ── Structured exception handlers ─────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return a clean 400 with structured error body instead of Pydantic's raw 422."""
    errors = exc.errors()
    first  = errors[0] if errors else {}
    loc    = ".".join(str(x) for x in first.get("loc", []))
    msg    = first.get("msg", "Invalid input")
    detail = f"{loc}: {msg}" if loc else msg

    log.warning(f"400 Validation Error: {detail}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error":       "Validation failed",
            "detail":      detail,
            "status_code": 400,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all — returns structured 500 with error message."""
    log.error(f"500 Internal Server Error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error":       "Internal server error",
            "detail":      str(exc),
            "status_code": 500,
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(core.nutrition_router)
app.include_router(core.habits_router)
app.include_router(core.health_router)
app.include_router(extended.fitness_router)
app.include_router(extended.insights_router)
app.include_router(extended.demo_router)
app.include_router(extended.environment_router)
app.include_router(export.router)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {
        "service": "H²OS API",
        "version": "1.0.0",
        "status":  "running",
        "docs":    f"http://localhost:{PORT}/docs",
        "api_version": "v1",
        "endpoints": {
            "add_meal":        "POST   /api/v1/nutrition/add-meal",
            "remove_meal":     "DELETE /api/v1/nutrition/remove-meal",
            "daily_nutrition": "GET    /api/v1/nutrition/daily",
            "update_habit":    "POST   /api/v1/habits/update",
            "list_habits":     "GET    /api/v1/habits/",
            "log_water":       "POST   /api/v1/habits/log-water",
            "log_sleep":       "POST   /api/v1/habits/log-sleep",
            "health_score":    "GET    /api/v1/health/score",
            "ping":            "GET    /api/v1/health/ping",
            "environment":     "GET    /api/v1/environment/",
            "fitness":         "GET    /api/v1/fitness/today",
            "insights":        "GET    /api/v1/insights/",
            "demo_reset":      "POST   /api/v1/demo/reset",
        },
    }


# ── Test utility ──────────────────────────────────────────────────────────────
# Used by test_integration.py to guarantee a clean slate on every run.
# Guard with APP_ENV check to prevent accidental use in production.
from config import APP_ENV
from services import core_services as _ne
from services import core_services as _he

@app.post("/test/reset", tags=["Test"], include_in_schema=APP_ENV == "development")
def test_reset():
    """Wipe all in-memory/DB state — meals, habits, water, sleep."""
    if APP_ENV != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Not available in production", "status_code": 403},
        )
    _ne.reset_meals()
    _he.reset_state()
    log.debug("[POST /test/reset] State cleared")
    return {"reset": True, "meals": 0, "habits": len(_he.get_all_habits())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=RELOAD)
