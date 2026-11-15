"""
routes/extended.py
------------------
Consolidated extended routes: fitness, insights, demo, environment endpoints.

GET /api/v1/fitness/today
GET /api/v1/insights/
POST /api/v1/demo/reset
GET /api/v1/environment/
GET /api/v1/environment/ping
"""

import time
import logging
from typing import Optional
from fastapi import APIRouter, Header, Query
from schemas.models import (
    FitnessResponse, InsightsResponse, DemoResetResponse,
    EnvironmentResponse, PingResponse
)
from services.extended_services import get_daily_plan, generate_insights, build_environment_response
from services import core_services as nutrition
from services.db import db_connection
from logger import api_log

# Fitness router
fitness_router = APIRouter(prefix="/api/v1/fitness", tags=["Fitness"])
fitness_log = logging.getLogger("h2os.fitness")

# Insights router
insights_router = APIRouter(prefix="/api/v1/insights", tags=["Insights"])
insights_log = logging.getLogger("h2os.insights")

# Demo router
demo_router = APIRouter(prefix="/api/v1/demo", tags=["Demo"])
demo_log = logging.getLogger("h2os.demo")

# Environment router
environment_router = APIRouter(prefix="/api/v1/environment", tags=["Environment"])
environment_log = logging.getLogger("h2os.environment")

# ============================================================================
# FITNESS ENDPOINTS
# ============================================================================

@fitness_router.get(
    "/today",
    summary="Get today's dynamic fitness plan",
    response_model=FitnessResponse,
)
def fetch_today_fitness(
    user_id: Optional[str] = Header("default", alias="X-User-ID"),
):
    """
    Returns today's fitness plan.
    Dynamic logic incorporates AQI from the environment service to
    enforce 'Indoor' mode if air quality is hazardous (AQI > 150).
    """
    res = get_daily_plan(user_id=user_id)
    api_log("GET", "/api/v1/fitness/today", None, res)
    return res

# ============================================================================
# INSIGHTS ENDPOINTS
# ============================================================================

@insights_router.get(
    "/",
    summary="Get real-data health insights and trend analysis",
    response_model=InsightsResponse,
)
def fetch_insights(
    user_id: Optional[str] = Header("default", alias="X-User-ID"),
):
    """
    Returns aggregate insights computed from actual stored meals, habits,
    water, and sleep data. Also returns historical chart progressions
    and deterministic trend comparisons against daily goals.
    """
    res = generate_insights(user_id=user_id)
    api_log("GET", "/api/v1/insights/", None, res)
    return res

# ============================================================================
# DEMO ENDPOINTS
# ============================================================================

# Sample demo data
_DEMO_MEALS = [
    {"name": "Oatmeal + Banana",       "meal_type": "Breakfast", "calories": 425, "protein": 9,  "carbs": 85, "fats": 6, "fiber": 9},
    {"name": "Grilled Chicken + Rice", "meal_type": "Lunch",     "calories": 620, "protein": 52, "carbs": 60, "fats": 8, "fiber": 3},
    {"name": "Whey Protein Shake",     "meal_type": "Snack",     "calories": 150, "protein": 30, "carbs": 2,  "fats": 2, "fiber": 0},
]

_DEMO_HABITS = [
    (0, "Morning Meditation",  "mindfulness", 1, 8),
    (1, "Drink 2.5L Water",    "hydration",   1, 14),
    (2, "No Sugar After 6pm",  "nutrition",   1, 5),
    (3, "10,000 Steps",        "fitness",     1, 3),
    (4, "No Phone Before Bed", "sleep",       0, 2),
    (5, "Morning Run",         "fitness",     0, 1),
]

_DEMO_WATER_L = 1.8
_DEMO_SLEEP_H = 7.5
_DEMO_SLEEP_Q = 75


@demo_router.post(
    "/reset",
    summary="Reset to demo state with sample data",
    response_model=DemoResetResponse,
)
def demo_reset():
    """
    Wipe all data and seed sample meals, habits, water, and sleep
    so the demo always starts from a meaningful, impressive state.

    Returns the full nutrition response so the frontend can refresh immediately.
    """
    t = int(time.time() * 1000) - 7_200_000  # spread meals ~2 hours back

    with db_connection() as conn:
        # 1. Clear all existing state atomically
        conn.execute("DELETE FROM meals")
        conn.execute("DELETE FROM habits")
        conn.execute("DELETE FROM water_log")
        conn.execute("DELETE FROM sleep_state")

        # 2. Seed meals (spread timestamps so they appear in correct order)
        for i, m in enumerate(_DEMO_MEALS):
            meal_id = f"demo_{t + i * 1000}"
            ts      = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime((t + i * 1000) / 1000))
            conn.execute(
                "INSERT INTO meals (id, name, meal_type, calories, protein, carbs, fats, fiber, timestamp) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (meal_id, m["name"], m["meal_type"], m["calories"],
                 m["protein"], m["carbs"], m["fats"], m["fiber"], ts),
            )

        # 3. Seed habits
        conn.executemany(
            "INSERT INTO habits (id, name, category, done, streak) VALUES (?, ?, ?, ?, ?)",
            _DEMO_HABITS,
        )

        # 4. Seed water
        conn.execute(
            "INSERT INTO water_log (amount, timestamp, note) VALUES (?, ?, ?)",
            (_DEMO_WATER_L, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "Demo seed"),
        )

        # 5. Seed sleep
        conn.execute(
            "INSERT INTO sleep_state (id, hours, quality) VALUES (1, ?, ?)",
            (_DEMO_SLEEP_H, _DEMO_SLEEP_Q),
        )

        conn.commit()

    demo_log.info("[POST /api/v1/demo/reset] Demo state restored")

    res = nutrition.build_nutrition_response()
    res["message"] = "Demo state restored with sample data"
    return res

# ============================================================================
# ENVIRONMENT ENDPOINTS
# ============================================================================

@environment_router.get(
    "/",
    summary="Get current AQI, UV, and health recommendations",
    response_model=EnvironmentResponse,
)
def get_environment(
    aqi: int | None = Query(default=None, ge=0, le=500, description="Override AQI for testing"),
    uv:  int | None = Query(default=None, ge=0, le=11,  description="Override UV index for testing"),
):
    """
    Returns current environment intelligence.

    Optional query params ?aqi=180&uv=9 let you override mock values for testing.

    Rules applied:
      * AQI > 150 -> "Avoid outdoor activity"
      * AQI > 200 -> "Stay indoors"
      * UV  > 7   -> "Use sunscreen"
      * UV  > 10  -> "Extreme UV - stay indoors"
    """
    environment_log.debug(f"[GET /v1/environment/] aqi_override={aqi} uv_override={uv}")
    res = build_environment_response(aqi=aqi, uv=uv)
    api_log("GET", "/api/v1/environment/", None, res)
    return res


@environment_router.get(
    "/ping",
    summary="Environment service liveness check",
    response_model=PingResponse,
)
def env_ping():
    res = {"status": "ok", "service": "environment", "version": "1.0.0"}
    api_log("GET", "/api/v1/environment/ping", None, res)
    return res
