"""
routes/core.py
--------------
Consolidated core routes: nutrition, habits, health endpoints.

POST   /api/v1/nutrition/add-meal
DELETE /api/v1/nutrition/remove-meal
GET    /api/v1/nutrition/daily

POST /api/v1/habits/update    - toggle a habit
GET  /api/v1/habits/          - full habit state (habits + water + sleep)
POST /api/v1/habits/log-water - log water intake
POST /api/v1/habits/log-sleep - log sleep hours

GET /api/v1/health/score
GET /api/v1/health/ping
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from schemas.models import (
    # Nutrition models
    MealInput, RemoveMealInput, NutritionResponse,
    # Habits models  
    HabitUpdateInput, WaterLogInput, SleepLogInput,
    HabitsResponse, WaterResponse, SleepResponse,
    # Health models
    HealthScoreResponse, PingResponse,
    # Common models
    ErrorResponse,
)
from services import core_services as nutrition
from services import core_services as habit_engine
from services.core_services import (
    compute_health_score, compute_score_breakdown,
    score_to_grade, score_to_status, generate_insights, DAILY_GOALS,
)
from logger import api_log

# Nutrition router
nutrition_router = APIRouter(prefix="/api/v1/nutrition", tags=["Nutrition"])
nutrition_log = logging.getLogger("h2os.nutrition")

# Habits router  
habits_router = APIRouter(prefix="/api/v1/habits", tags=["Habits"])
habits_log = logging.getLogger("h2os.habits")

# Health router
health_router = APIRouter(prefix="/api/v1/health", tags=["Health"])
health_log = logging.getLogger("h2os.health")

# ============================================================================
# ERROR HANDLING UTILITIES
# ============================================================================

def handle_api_error(func):
    """Decorator for consistent API error handling."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValidationError as e:
            nutrition_log.error(f"Validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid input data: {str(e)}"
            )
        except ValueError as e:
            nutrition_log.error(f"Value error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid data: {str(e)}"
            )
        except Exception as e:
            nutrition_log.error(f"Unexpected error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred. Please try again."
            )
    return wrapper

def create_success_response(data: dict, message: str = "Success") -> dict:
    """Create a standardized success response."""
    return {
        "success": True,
        "data": data,
        "message": message
    }

def create_error_response(message: str, status_code: int = 400) -> HTTPException:
    """Create a standardized error response."""
    raise HTTPException(
        status_code=status_code,
        detail={
            "success": False,
            "error": message,
            "timestamp": nutrition.get_timestamp()
        }
    )

# ============================================================================
# NUTRITION ENDPOINTS
# ============================================================================

@nutrition_router.post(
    "/add-meal",
    summary="Log a new meal",
    response_model=NutritionResponse,
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
@handle_api_error
def add_meal(payload: MealInput):
    """
    Add a meal to today's log.

    Response: success, meals[], totals{}, healthScore,
              recommendations[], suggestion{}, goals{}, meal{}
    """
    # Enhanced validation
    if not payload.name or payload.name.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="Meal name is required and cannot be empty"
        )
    
    if len(payload.name) > 100:
        raise HTTPException(
            status_code=400,
            detail="Meal name cannot exceed 100 characters"
        )
    
    if payload.calories < 0:
        raise HTTPException(
            status_code=400,
            detail="Calories cannot be negative"
        )
    
    if payload.calories > 10000:
        raise HTTPException(
            status_code=400,
            detail="Calories cannot exceed 10,000 for a single meal"
        )
    
    # Validate macro values
    for macro, value in [
        ("protein", payload.protein),
        ("carbs", payload.carbs), 
        ("fats", payload.fats),
        ("fiber", payload.fiber)
    ]:
        if value < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{macro.capitalize()} cannot be negative"
            )
        if value > 1000:
            raise HTTPException(
                status_code=400,
                detail=f"{macro.capitalize()} cannot exceed 1000g for a single meal"
            )
    
    try:
        req_data = payload.model_dump(by_alias=False)
        meal = nutrition.add_meal(payload.to_engine_dict())
        res = nutrition.build_nutrition_response()
        res["meal"] = meal

        api_log("POST", "/api/v1/nutrition/add-meal", req_data, res)
        return res
        
    except Exception as e:
        nutrition_log.error(f"Error adding meal: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to add meal. Please try again."
        )


@nutrition_router.delete(
    "/remove-meal",
    summary="Delete a logged meal",
    response_model=NutritionResponse,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse},
    },
)
def remove_meal(payload: RemoveMealInput):
    """Remove a meal by id. Returns the updated nutrition state."""
    req_data = payload.model_dump()
    found    = nutrition.remove_meal(payload.id)

    if not found:
        api_log("DELETE", "/api/v1/nutrition/remove-meal", req_data, {"error": "not found", "id": payload.id})
        raise HTTPException(
            status_code=404,
            detail=f"Meal '{payload.id}' not found.",
        )

    res = nutrition.build_nutrition_response()
    api_log("DELETE", "/api/v1/nutrition/remove-meal", req_data, res)
    return res


@nutrition_router.get(
    "/daily",
    summary="Get today's nutrition summary",
    response_model=NutritionResponse,
)
def get_daily():
    """Return all meals + totals + score + breakdown + recommendations."""
    res              = nutrition.build_nutrition_response()
    res["breakdown"] = compute_score_breakdown(res["totals"])

    api_log("GET", "/api/v1/nutrition/daily", None, res)
    return res

# ============================================================================
# HABITS ENDPOINTS
# ============================================================================

@habits_router.post(
    "/update",
    summary="Toggle a habit's done state",
    response_model=HabitsResponse,
    responses={404: {"model": ErrorResponse}},
)
def update_habit(payload: HabitUpdateInput):
    """
    Mark a habit done/undone.

    Response: success, habit{}, habits[], completedCount, total,
              completionRate, streakLeader{}, water{}, sleep{}
    """
    # Enhanced validation
    if payload.habit_id < 0:
        raise HTTPException(
            status_code=400,
            detail="Habit ID cannot be negative"
        )
    
    if payload.habit_id > 1000:
        raise HTTPException(
            status_code=400,
            detail="Invalid habit ID"
        )
    
    try:
        req_data = {"habitId": payload.habit_id, "done": payload.done}
        res = habits.build_habit_response(payload.habit_id, payload.done)

        if res["habit"] is None:
            api_log("POST", "/api/v1/habits/update", req_data, {"error": "not found"})
            raise HTTPException(
                status_code=404,
                detail=f"Habit id={payload.habit_id} not found.",
            )

        api_log("POST", "/api/v1/habits/update", req_data, res)
        return res
        
    except Exception as e:
        habits_log.error(f"Error updating habit: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update habit. Please try again."
        )


@habits_router.get(
    "/",
    summary="Full habits state - habits, water, sleep",
    response_model=HabitsResponse,
)
def list_habits():
    """
    Return complete habits state including water and sleep tracking.

    Response: success, habits[], completedCount, total, completionRate,
              streakLeader{}, water{ logged, goal, percent, remaining, log[] },
              sleep{ hours, goal, percent, quality, label }
    """
    res = habits.build_full_habits_response()
    api_log("GET", "/api/v1/habits/", None, res)
    return res


@habits_router.post(
    "/log-water",
    summary="Log water intake",
    response_model=WaterResponse,
    responses={422: {"model": ErrorResponse}},
)
def log_water(payload: WaterLogInput):
    """
    Add or set water intake for the day.

    - Send { amount: 0.25 }  -> adds 250ml to today's total
    - Send { set: 1.8 }      -> sets today's total to exactly 1.8L

    Response: { water: { logged, goal, unit, percent, remaining, log[] } }
    """
    req_data = payload.model_dump()

    if payload.set is not None:
        res = habits.set_water(payload.set)
    elif payload.amount is not None:
        res = habits.log_water(payload.amount, payload.note)
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either 'amount' (to add) or 'set' (to override total).",
        )

    res["success"] = True
    api_log("POST", "/api/v1/habits/log-water", req_data, res)
    return res


@habits_router.post(
    "/log-sleep",
    summary="Log sleep hours and quality",
    response_model=SleepResponse,
)
def log_sleep(payload: SleepLogInput):
    """
    Set last night's sleep.

    Response: { sleep: { hours, goal, percent, quality, label } }
    """
    req_data = payload.model_dump()
    res      = habits.log_sleep(payload.hours, payload.quality)
    res["success"] = True

    api_log("POST", "/api/v1/habits/log-sleep", req_data, res)
    return res

# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@health_router.get(
    "/score",
    summary="Get overall health score with grade and insights",
    response_model=HealthScoreResponse,
)
def get_health_score():
    """
    Compute health score from today's nutrition totals.

    Response: success, score, grade, status, breakdown{},
              insights[], goals{}, daily_metrics{}
    """
    totals    = nutrition.compute_totals()
    score     = compute_health_score(totals)
    breakdown = compute_score_breakdown(totals)
    hab_stats = habits.completion_stats()

    res = {
        "success":   True,
        "score":     score,
        "grade":     score_to_grade(score),
        "status":    score_to_status(score),
        "breakdown": breakdown,
        "insights":  generate_insights(totals, score),
        "goals":     DAILY_GOALS,
        "daily_metrics": {
            "calories":        totals["calories"],
            "protein":         totals["protein"],
            "carbs":           totals["carbs"],
            "fats":            totals["fats"],
            "fiber":           totals["fiber"],
            "habitsCompleted": hab_stats["completedCount"],
            "habitsTotal":     hab_stats["total"],
            "completionRate":  hab_stats["completionRate"],
        },
    }

    api_log("GET", "/api/v1/health/score", None, res)
    return res


@health_router.get(
    "/ping",
    summary="Health-check endpoint",
    response_model=PingResponse,
)
def ping():
    """Simple liveness check - returns 200 OK."""
    res = {"status": "ok", "service": "H2OS API", "version": "1.0.0"}
    api_log("GET", "/api/v1/health/ping", None, res)
    return res
