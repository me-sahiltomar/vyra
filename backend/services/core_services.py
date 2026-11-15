"""
services/core_services.py
------------------------
Consolidated core services: nutrition, habits, health score functionality.

Response field names are camelCase to match frontend expectations:
  healthScore, totals, recommendations, suggestion, meals, goals
"""

from __future__ import annotations
import time
from services.db import db_connection

# ============================================================================
# NUTRITION ENGINE
# ============================================================================

# Daily goals (same as frontend DAILY_GOALS_API)
DAILY_GOALS = {
    "calories": 2500,
    "protein":  150,
    "carbs":    280,
    "fats":     78,
    "fiber":    30,
}

# Scoring weights per macro
_WEIGHTS = {
    "protein":  30,
    "calories": 25,
    "carbs":    20,
    "fats":     15,
    "fiber":    10,
}

# Daily targets for habits
WATER_GOAL_L = 2.5   # litres
SLEEP_GOAL_H = 8.0   # hours

# ============================================================================
# HEALTH SCORE FUNCTIONS
# ============================================================================

def _score_macro(value: float, goal: float, max_pts: int, penalize_over: bool = True) -> int:
    """
    Score a single macro against its goal.
    - Below goal  -> linear scale 0 -> max_pts
    - At goal     -> max_pts
    - Over goal   -> penalised (if penalize_over=True)
    """
    # Safe computation with guards against NaN and undefined
    if not isinstance(value, (int, float)) or value < 0:
        value = 0
    if not isinstance(goal, (int, float)) or goal <= 0:
        return 0
    
    ratio = value / goal
    if ratio <= 0:
        return 0
    if ratio <= 1.0:
        return round(ratio * max_pts)
    if penalize_over:
        return max(0, round(max_pts - (ratio - 1) * max_pts * 0.6))
    return max_pts


def compute_health_score(metrics: dict[str, float]) -> int:
    """Return a 0-100 health score from the current day's macro totals."""
    score = 0
    
    # Ensure metrics is a valid dictionary
    if not isinstance(metrics, dict):
        metrics = {}
    
    for macro, weight in _WEIGHTS.items():
        value = metrics.get(macro, 0)
        goal = DAILY_GOALS.get(macro, 1)
        score += _score_macro(value, goal, weight)
    
    # Ensure score is valid integer
    final_score = int(score)
    if not isinstance(final_score, int) or final_score < 0:
        final_score = 0
    elif final_score > 100:
        final_score = 100
    
    return final_score


def compute_score_breakdown(totals: dict[str, float]) -> dict[str, int]:
    """Return per-macro score breakdown for frontend display."""
    return {
        macro: _score_macro(totals.get(macro, 0), DAILY_GOALS[macro], weight)
        for macro, weight in _WEIGHTS.items()
    }


def score_to_grade(score: int) -> str:
    """Convert numeric score to letter grade."""
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"


def score_to_status(score: int) -> str:
    """Convert numeric score to status text."""
    if score >= 80: return "Excellent"
    if score >= 60: return "Good"
    if score >= 40: return "Fair"
    return "Needs Improvement"


def generate_insights(totals: dict[str, float], score: int) -> list[str]:
    """Generate actionable insights based on current totals and score."""
    insights = []
    
    # Protein insights
    protein_ratio = totals.get("protein", 0) / DAILY_GOALS["protein"]
    if protein_ratio < 0.5:
        insights.append("Consider adding more protein-rich foods to meet your daily goal")
    elif protein_ratio > 1.2:
        insights.append("Excellent protein intake! You're exceeding your goal")
    
    # Calorie insights
    calorie_ratio = totals.get("calories", 0) / DAILY_GOALS["calories"]
    if calorie_ratio < 0.7:
        insights.append("You're below your calorie target - consider balanced meals")
    elif calorie_ratio > 1.3:
        insights.append("Watch your calorie intake - you're above the recommended range")
    
    # Fiber insights
    fiber_ratio = totals.get("fiber", 0) / DAILY_GOALS["fiber"]
    if fiber_ratio < 0.5:
        insights.append("Add more vegetables and whole grains for better fiber intake")
    
    # Overall score insights
    if score >= 80:
        insights.append("Great job! Your nutrition is on track")
    elif score < 60:
        insights.append("Focus on balanced meals to improve your health score")
    
    return insights


# ============================================================================
# NUTRITION FUNCTIONS
# ============================================================================

def add_meal(meal_data: dict) -> dict:
    """Persist a new meal and return it with an assigned id."""
    meal_id = f"meal_{int(time.time() * 1000)}"
    entry = {
        "id":        meal_id,
        "name":      meal_data.get("name",      "Custom Meal"),
        "meal_type": meal_data.get("meal_type", "Snack"),
        "calories":  float(meal_data.get("calories", 0)),
        "protein":   float(meal_data.get("protein",  0)),
        "carbs":     float(meal_data.get("carbs",    0)),
        "fats":      float(meal_data.get("fats",     0)),
        "fiber":     float(meal_data.get("fiber",    0)),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with db_connection() as conn:
        conn.execute(
            "INSERT INTO meals (id, name, meal_type, calories, protein, carbs, fats, fiber, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (entry["id"], entry["name"], entry["meal_type"], entry["calories"],
             entry["protein"], entry["carbs"], entry["fats"], entry["fiber"], entry["timestamp"])
        )
        conn.commit()
    return entry


def remove_meal(meal_id: str) -> bool:
    """Remove meal by id. Returns True if found and deleted."""
    with db_connection() as conn:
        cursor = conn.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_all_meals() -> list[dict]:
    """Return all meals for today, sorted by timestamp."""
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM meals ORDER BY timestamp DESC"
        ).fetchall()
        return [
            {
                "id":        r["id"],
                "name":      r["name"],
                "meal_type": r["meal_type"],
                "calories":  r["calories"],
                "protein":   r["protein"],
                "carbs":     r["carbs"],
                "fats":      r["fats"],
                "fiber":     r["fiber"],
                "timestamp": r["timestamp"],
            }
            for r in rows
        ]


def compute_totals() -> dict[str, float]:
    """Aggregate today's nutrition totals."""
    meals = get_all_meals()
    totals = {
        "calories": 0,
        "protein":  0,
        "carbs":    0,
        "fats":     0,
        "fiber":    0,
    }
    for meal in meals:
        for key in totals:
            totals[key] += meal.get(key, 0)
    return totals


def build_nutrition_response() -> dict:
    """Build complete nutrition response for frontend."""
    meals = get_all_meals()
    totals = compute_totals()
    score = compute_health_score(totals)
    
    # Generate recommendations
    recommendations = []
    for macro, goal in DAILY_GOALS.items():
        current = totals.get(macro, 0)
        ratio = current / goal if goal > 0 else 0
        if ratio < 0.5:
            recommendations.append({
                "id": f"rec_{macro}_low",
                "severity": "warn",
                "icon": "warning",
                "title": f"Low {macro.title()}",
                "message": f"Increase {macro} intake (currently {current:.1f}, goal {goal})",
                "action": f"Add {macro}-rich foods"
            })
        elif ratio > 1.5 and macro != "fiber":
            recommendations.append({
                "id": f"rec_{macro}_high",
                "severity": "red",
                "icon": "alert",
                "title": f"High {macro.title()}",
                "message": f"Reduce {macro} intake (currently {current:.1f}, goal {goal})",
                "action": f"Reduce {macro} intake"
            })
    
    # Generate meal suggestion
    suggestion = {}
    if score < 60:
        suggestion = {
            "name": "Balanced Nutrition Meal",
            "desc": "Your health score needs improvement - focus on balanced macros",
            "emoji": "balanced",
            "cal": 500,
            "protein": 30,
            "carbs": 60,
            "fats": 15
        }
    elif score > 85:
        suggestion = {
            "name": "Maintain Current Pattern",
            "desc": "Great nutrition! Keep up the good work",
            "emoji": "success",
            "cal": 0,
            "protein": 0,
            "carbs": 0,
            "fats": 0
        }
    
    return {
        "success": True,
        "meals": meals,
        "totals": totals,
        "healthScore": score,
        "recommendations": recommendations,
        "suggestion": suggestion,
        "goals": DAILY_GOALS
    }


# ============================================================================
# HABITS FUNCTIONS
# ============================================================================

def get_all_habits() -> list[dict]:
    with db_connection() as conn:
        rows = conn.execute("SELECT * FROM habits ORDER BY id ASC").fetchall()
        return [
            {
                "id":       r["id"],
                "name":     r["name"],
                "category": r["category"],
                "done":     bool(r["done"]),
                "streak":   r["streak"],
            }
            for r in rows
        ]


def toggle_habit(habit_id: int, done: bool) -> dict | None:
    with db_connection() as conn:
        row = conn.execute("SELECT * FROM habits WHERE id = ?", (habit_id,)).fetchone()
        if not row:
            return None
        new_streak = (row["streak"] + 1) if done else max(0, row["streak"] - 1)
        conn.execute(
            "UPDATE habits SET done = ?, streak = ? WHERE id = ?",
            (int(done), new_streak, habit_id),
        )
        conn.commit()
        return {
            "id":       row["id"],
            "name":     row["name"],
            "category": row["category"],
            "done":     done,
            "streak":   new_streak,
        }


def completion_stats() -> dict:
    """Return habit completion statistics."""
    habits = get_all_habits()
    completed = sum(1 for h in habits if h["done"])
    total = len(habits)
    completion_rate = (completed / total * 100) if total > 0 else 0
    
    # Find streak leader
    streak_leader = max(habits, key=lambda h: h["streak"]) if habits else None
    
    return {
        "completedCount": completed,
        "total": total,
        "completionRate": completion_rate,
        "streakLeader": {
            "name": streak_leader["name"],
            "streak": streak_leader["streak"]
        } if streak_leader else None
    }


def build_habit_response(habit_id: int, done: bool) -> dict:
    """Build response for habit update."""
    habit = toggle_habit(habit_id, done)
    if habit is None:
        return {"habit": None}
    
    stats = completion_stats()
    water_state = get_water_state()
    sleep_state = get_sleep_state()
    
    return {
        "success": True,
        "habit": habit,
        "habits": get_all_habits(),
        **stats,
        "water": water_state,
        "sleep": sleep_state
    }


def build_full_habits_response() -> dict:
    """Build complete habits response including water and sleep."""
    return {
        "success": True,
        "habits": get_all_habits(),
        **completion_stats(),
        "water": get_water_state(),
        "sleep": get_sleep_state()
    }


# ============================================================================
# WATER TRACKING FUNCTIONS
# ============================================================================

def get_water_state() -> dict:
    """Get current water tracking state."""
    with db_connection() as conn:
        # Get today's water total
        today = time.strftime("%Y-%m-%d", time.gmtime())
        rows = conn.execute(
            "SELECT amount, timestamp, note FROM water_log WHERE DATE(timestamp) = ? ORDER BY timestamp DESC",
            (today,)
        ).fetchall()
        
        logged = sum(r["amount"] for r in rows)
        goal = WATER_GOAL_L
        percent = (logged / goal * 100) if goal > 0 else 0
        remaining = max(0, goal - logged)
        
        return {
            "logged": logged,
            "goal": goal,
            "unit": "L",
            "percent": round(percent, 1),
            "remaining": round(remaining, 1),
            "log": [
                {
                    "amount": r["amount"],
                    "timestamp": r["timestamp"],
                    "note": r["note"]
                }
                for r in rows
            ]
        }


def log_water(amount: float, note: str = "") -> dict:
    """Add water intake entry."""
    with db_connection() as conn:
        conn.execute(
            "INSERT INTO water_log (amount, timestamp, note) VALUES (?, ?, ?)",
            (amount, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), note)
        )
        conn.commit()
    return get_water_state()


def set_water(total: float) -> dict:
    """Set today's water total (replace existing)."""
    with db_connection() as conn:
        # Delete today's entries
        today = time.strftime("%Y-%m-%d", time.gmtime())
        conn.execute("DELETE FROM water_log WHERE DATE(timestamp) = ?", (today,))
        
        # Add new total entry
        conn.execute(
            "INSERT INTO water_log (amount, timestamp, note) VALUES (?, ?, ?)",
            (total, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "Set total")
        )
        conn.commit()
    return get_water_state()


# ============================================================================
# SLEEP TRACKING FUNCTIONS
# ============================================================================

def get_sleep_state() -> dict:
    """Get current sleep tracking state."""
    with db_connection() as conn:
        row = conn.execute("SELECT * FROM sleep_state LIMIT 1").fetchone()
        if not row:
            # Create default sleep state
            conn.execute(
                "INSERT INTO sleep_state (id, hours, quality) VALUES (1, 0.0, NULL)"
            )
            conn.commit()
            row = conn.execute("SELECT * FROM sleep_state LIMIT 1").fetchone()
        
        hours = row["hours"] or 0.0
        goal = SLEEP_GOAL_H
        percent = (hours / goal * 100) if goal > 0 else 0
        quality = row["quality"]
        
        # Quality label
        quality_label = "Not recorded"
        if quality is not None:
            if quality >= 80:
                quality_label = "Excellent"
            elif quality >= 60:
                quality_label = "Good"
            elif quality >= 40:
                quality_label = "Fair"
            else:
                quality_label = "Poor"
        
        return {
            "hours": hours,
            "goal": goal,
            "percent": round(percent, 1),
            "quality": quality,
            "label": quality_label
        }


def log_sleep(hours: float, quality: int | None = None) -> dict:
    """Log sleep hours and quality."""
    with db_connection() as conn:
        conn.execute(
            "UPDATE sleep_state SET hours = ?, quality = ? WHERE id = 1",
            (hours, quality)
        )
        conn.commit()
    return get_sleep_state()


# ============================================================================
# LEGACY COMPATIBILITY FUNCTIONS
# ============================================================================

# For backward compatibility with existing imports
reset_meals = lambda: None  # SQLite handles persistence
reset_state = lambda: None  # SQLite handles persistence
