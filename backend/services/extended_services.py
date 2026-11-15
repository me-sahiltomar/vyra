"""
services/extended_services.py
---------------------------
Consolidated extended services: fitness, insights, environment functionality.
"""

from __future__ import annotations
import math
import time
import random
from datetime import datetime
from services.db import db_connection

# ============================================================================
# ENVIRONMENT ENGINE
# ============================================================================

# Seed a deterministic-ish "daily" value so it's stable across one session
_SESSION_SEED = int(time.time()) // 3600   # changes once per hour

random.seed(_SESSION_SEED)
_MOCK_AQI = random.randint(20, 220)        # realistic range: Good -> Unhealthy
_MOCK_UV  = random.randint(0, 11)          # 0 = night / cloudy, 11 = extreme

# Reset seed so other code isn't affected
random.seed()


def _aqi_level(aqi: int) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"


def _aqi_color(aqi: int) -> str:
    if aqi <= 50:   return "good"       # green
    if aqi <= 100:  return "moderate"   # yellow
    if aqi <= 150:  return "sensitive"  # orange
    if aqi <= 200:  return "danger"     # red
    return "hazardous"                  # purple


def _uv_level(uv: int) -> str:
    if uv <= 2:   return "Low"
    if uv <= 5:   return "Moderate"
    if uv <= 7:   return "High"
    if uv <= 10:  return "Very High"
    return "Extreme"


def _aqi_recommendations(aqi: int) -> list[str]:
    """Return health recommendations based on AQI level."""
    if aqi <= 50:
        return ["Air quality is good for outdoor activities"]
    elif aqi <= 100:
        return ["Moderate air quality - sensitive individuals should limit prolonged outdoor exertion"]
    elif aqi <= 150:
        return ["Unhealthy for sensitive groups - consider reducing prolonged outdoor activities"]
    elif aqi <= 200:
        return ["Unhealthy air quality - avoid prolonged outdoor exertion"]
    elif aqi <= 300:
        return ["Very unhealthy - avoid all outdoor activities"]
    else:
        return ["Hazardous - stay indoors and avoid all outdoor exposure"]


def _uv_recommendations(uv: int) -> list[str]:
    """Return UV protection recommendations."""
    if uv <= 2:
        return ["Low UV risk - no protection needed"]
    elif uv <= 5:
        return ["Moderate UV - wear sunscreen during midday hours"]
    elif uv <= 7:
        return ["High UV - wear sunscreen, hat, and sunglasses"]
    elif uv <= 10:
        return ["Very high UV - seek shade during midday hours, wear protective clothing"]
    else:
        return ["Extreme UV - avoid sun exposure between 10am-4pm, use maximum protection"]


def build_environment_response(aqi: int | None = None, uv: int | None = None) -> dict:
    """
    Build comprehensive environment intelligence response.
    
    Args:
        aqi: Override AQI value for testing
        uv: Override UV index for testing
    """
    # Use provided overrides or mock values
    current_aqi = aqi if aqi is not None else _MOCK_AQI
    current_uv = uv if uv is not None else _MOCK_UV
    
    # Build response
    response = {
        "timestamp": datetime.now().isoformat(),
        "aqi": {
            "value": current_aqi,
            "level": _aqi_level(current_aqi),
            "color": _aqi_color(current_aqi),
            "recommendations": _aqi_recommendations(current_aqi)
        },
        "uv": {
            "value": current_uv,
            "level": _uv_level(current_uv),
            "recommendations": _uv_recommendations(current_uv)
        },
        "overall": {
            "status": "good" if current_aqi <= 100 and current_uv <= 5 else "caution",
            "message": _build_overall_message(current_aqi, current_uv)
        }
    }
    
    return response


def _build_overall_message(aqi: int, uv: int) -> str:
    """Build overall environmental recommendation."""
    if aqi > 150:
        return "Poor air quality - avoid outdoor activities"
    elif uv > 8:
        return "High UV - use sun protection when outdoors"
    elif aqi > 100:
        return "Moderate air quality - sensitive groups should take precautions"
    elif uv > 6:
        return "Moderate UV - consider sun protection"
    else:
        return "Good conditions for outdoor activities"


# ============================================================================
# FITNESS ENGINE
# ============================================================================

# User profiles
_USER_PROFILES = {
    "default": {
        "goal": "General Fitness",
        "activity_level": "Intermediate",
    }
}

# Activity-level multipliers (scale sets/reps)
_LEVEL_SCALE = {
    "Beginner":     {"sets_mult": 0.66, "duration_mult": 0.75, "cal_mult": 0.70},
    "Intermediate": {"sets_mult": 1.0,  "duration_mult": 1.0,  "cal_mult": 1.0},
    "Advanced":     {"sets_mult": 1.33, "duration_mult": 1.2,  "cal_mult": 1.25},
}

# Exercise database for rule-based generation
_EXERCISE_DB = {
    "strength": {
        "chest": ["Push-ups", "Bench Press", "Dumbbell Flyes", "Incline Press"],
        "back": ["Pull-ups", "Rows", "Lat Pulldowns", "Deadlifts"],
        "shoulders": ["Shoulder Press", "Lateral Raises", "Front Raises", "Shrugs"],
        "arms": ["Bicep Curls", "Tricep Dips", "Hammer Curls", "Skull Crushers"],
        "legs": ["Squats", "Lunges", "Leg Press", "Calf Raises"],
        "core": ["Plank", "Crunches", "Leg Raises", "Russian Twists"]
    },
    "cardio": {
        "full_body": ["Burpees", "Jumping Jacks", "Mountain Climbers", "High Knees"],
        "cardio": ["Running", "Cycling", "Rowing", "Jump Rope"]
    },
    "flexibility": {
        "stretching": ["Yoga Flow", "Dynamic Stretching", "Foam Rolling", "Static Stretches"]
    }
}

# Workout templates by goal
_WORKOUT_TEMPLATES = {
    "Build Muscle": {
        "focus": "strength",
        "duration": 45,
        "base_calories": 320,
        "exercise_count": 6,
        "sets_range": (3, 4),
        "reps_patterns": {
            "strength": ["8-10", "10-12", "12-15"],
            "cardio": ["30 sec", "45 sec", "60 sec"]
        }
    },
    "Lose Weight": {
        "focus": "cardio",
        "duration": 30,
        "base_calories": 280,
        "exercise_count": 5,
        "sets_range": (3, 4),
        "reps_patterns": {
            "strength": ["12-15", "15-20"],
            "cardio": ["30 sec", "45 sec", "60 sec"]
        }
    },
    "General Fitness": {
        "focus": "mixed",
        "duration": 35,
        "base_calories": 250,
        "exercise_count": 5,
        "sets_range": (2, 3),
        "reps_patterns": {
            "strength": ["10-12", "12-15"],
            "cardio": ["30 sec", "45 sec"]
        }
    }
}


def _generate_workout(goal: str, mode: str, level: str) -> dict:
    """Generate a workout based on goal, mode, and activity level using rules."""
    import random
    
    template = _WORKOUT_TEMPLATES.get(goal, _WORKOUT_TEMPLATES["General Fitness"])
    scale = _LEVEL_SCALE.get(level, _LEVEL_SCALE["Intermediate"])
    
    # Determine workout type based on goal and mode
    if goal == "Build Muscle":
        workout_type = "Strength Training" if mode == "Indoor" else "Calisthenics"
    elif goal == "Lose Weight":
        workout_type = "HIIT Cardio" if mode == "Indoor" else "Running Intervals"
    else:
        workout_type = "Full Body Circuit" if mode == "Indoor" else "Mixed Training"
    
    # Generate exercises
    exercises = []
    focus = template["focus"]
    
    if focus == "strength":
        # Select muscle groups for balanced workout
        muscle_groups = ["chest", "back", "shoulders", "arms", "legs", "core"]
        selected_muscles = random.sample(muscle_groups, min(template["exercise_count"], len(muscle_groups)))
        
        for muscle in selected_muscles:
            exercise_list = _EXERCISE_DB["strength"][muscle]
            exercise = random.choice(exercise_list)
            sets = random.randint(*template["sets_range"])
            reps = random.choice(template["reps_patterns"]["strength"])
            
            exercises.append({
                "name": exercise,
                "sets": int(sets * scale["sets_mult"]),
                "reps": reps,
                "muscle": muscle.title()
            })
    
    elif focus == "cardio":
        exercise_list = _EXERCISE_DB["cardio"]["full_body"]
        for i in range(template["exercise_count"]):
            exercise = random.choice(exercise_list)
            sets = random.randint(*template["sets_range"])
            reps = random.choice(template["reps_patterns"]["cardio"])
            
            exercises.append({
                "name": exercise,
                "sets": int(sets * scale["sets_mult"]),
                "reps": reps,
                "muscle": "Full Body"
            })
    
    else:  # mixed
        # Mix of strength and cardio
        strength_count = template["exercise_count"] // 2
        cardio_count = template["exercise_count"] - strength_count
        
        # Add strength exercises
        muscle_groups = ["chest", "back", "legs", "core"]
        selected_muscles = random.sample(muscle_groups, min(strength_count, len(muscle_groups)))
        
        for muscle in selected_muscles:
            exercise_list = _EXERCISE_DB["strength"][muscle]
            exercise = random.choice(exercise_list)
            sets = random.randint(*template["sets_range"])
            reps = random.choice(template["reps_patterns"]["strength"])
            
            exercises.append({
                "name": exercise,
                "sets": int(sets * scale["sets_mult"]),
                "reps": reps,
                "muscle": muscle.title()
            })
        
        # Add cardio exercises
        cardio_list = _EXERCISE_DB["cardio"]["full_body"]
        for i in range(cardio_count):
            exercise = random.choice(cardio_list)
            sets = random.randint(*template["sets_range"])
            reps = random.choice(template["reps_patterns"]["cardio"])
            
            exercises.append({
                "name": exercise,
                "sets": int(sets * scale["sets_mult"]),
                "reps": reps,
                "muscle": "Cardio"
            })
    
    # Calculate duration and calories
    duration = int(template["duration"] * scale["duration_mult"])
    calories = int(template["base_calories"] * scale["cal_mult"])
    
    return {
        "workoutType": workout_type,
        "duration": duration,
        "calories": calories,
        "exercises": exercises,
        "mode": mode
    }


def get_daily_plan(user_id: str = "default") -> dict:
    """
    Generate today's fitness plan based on user profile and environmental conditions.
    """
    # Get user profile
    profile = _USER_PROFILES.get(user_id, _USER_PROFILES["default"])
    goal = profile["goal"]
    activity_level = profile["activity_level"]
    
    # Get environmental conditions
    env = build_environment_response()
    aqi = env["aqi"]["value"]
    
    # Determine indoor/outdoor based on AQI
    location = "Indoor" if aqi > 150 else "Outdoor"
    
    # Generate workout using rule-based system
    workout = _generate_workout(goal, location, activity_level)
    
    # Build response
    response = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "user": {
            "id": user_id,
            "goal": goal,
            "activity_level": activity_level
        },
        "workout": {
            "type": workout["workoutType"],
            "location": location,
            "duration": workout["duration"],
            "estimated_calories": workout["calories"],
            "exercises": workout["exercises"]
        },
        "environment": {
            "aqi": aqi,
            "location_reason": "Indoor (Poor air quality)" if location == "Indoor" else "Outdoor (Good air quality)"
        },
        "recommendations": _generate_fitness_recommendations(goal, activity_level, aqi)
    }
    
    return response


def _generate_fitness_recommendations(goal: str, activity_level: str, aqi: int) -> list[str]:
    """Generate personalized fitness recommendations."""
    recommendations = []
    
    # Goal-based recommendations
    if goal == "Build Muscle":
        recommendations.append("Focus on progressive overload - increase weight/reps weekly")
        recommendations.append("Ensure adequate protein intake (1.6-2.2g per kg bodyweight)")
    elif goal == "Lose Weight":
        recommendations.append("Combine regular exercise with a moderate calorie deficit")
        recommendations.append("Include both cardio and strength training for optimal results")
    else:  # General Fitness
        recommendations.append("Maintain consistency with 3-4 workouts per week")
        recommendations.append("Include a mix of cardio, strength, and flexibility exercises")
    
    # Activity level recommendations
    if activity_level == "Beginner":
        recommendations.append("Start with lighter weights and focus on proper form")
        recommendations.append("Consider working with a trainer for technique guidance")
    elif activity_level == "Advanced":
        recommendations.append("Consider periodization to avoid plateaus")
        recommendations.append("Include recovery strategies like foam rolling and stretching")
    
    # Environmental recommendations
    if aqi > 150:
        recommendations.append("Air quality is poor - indoor workouts recommended today")
    elif aqi > 100:
        recommendations.append("Moderate air quality - consider indoor alternatives if sensitive")
    
    return recommendations


# ============================================================================
# INSIGHTS ENGINE
# ============================================================================

def generate_insights(user_id: str = "default") -> dict:
    """
    Compute aggregates from stored data and generate insights.
    Uses core_services for data access.
    """
    # Import here to avoid circular imports
    from services.core_services import (
        compute_totals, get_all_meals, get_all_habits, 
        get_water_state, get_sleep_state, DAILY_GOALS
    )
    
    # 1. Fetch real data
    totals = compute_totals()
    habits = get_all_habits()
    water_state = get_water_state()
    sleep_state = get_sleep_state()
    
    curr_calories = totals["calories"]
    curr_sleep = sleep_state["hours"]
    habit_rate = (sum(1 for h in habits if h["done"]) / len(habits) * 100) if habits else 0
    
    # Use the '10,000 Steps' habit to infer step count if present, otherwise show not tracked
    steps_habit = next((h for h in habits if "Steps" in h["name"]), None)
    if steps_habit and steps_habit["done"]:
        curr_steps = 10000
    else:
        # Show not tracked when steps habit is not completed
        curr_steps = None

    # 2. Delta calculations
    cal_goal = DAILY_GOALS["calories"]
    sleep_goal = sleep_state["goal"]
    
    cal_diff = curr_calories - cal_goal
    cal_pct = int((cal_diff / cal_goal) * 100) if cal_goal else 0
    
    # Handle steps calculation safely
    if curr_steps is not None:
        steps_diff = curr_steps - 10000
        steps_pct = int((steps_diff / 10000) * 100)
        steps_trend = "above" if steps_diff > 0 else "below"
    else:
        steps_diff = None
        steps_pct = None
        steps_trend = "not_tracked"
    
    sleep_diff = curr_sleep - sleep_goal
    sleep_pct = int((sleep_diff / sleep_goal) * 100) if sleep_goal else 0
    
    habit_diff = habit_rate - 75  # Compare against a 75% baseline
    
    trends = {
        "calories": {
            "current": curr_calories,
            "goal": cal_goal,
            "difference": cal_diff,
            "percent_change": cal_pct,
            "trend": "above" if cal_diff > 0 else "below"
        },
        "steps": {
            "current": curr_steps,
            "goal": 10000,
            "difference": steps_diff,
            "percent_change": steps_pct,
            "trend": steps_trend
        },
        "sleep": {
            "current": curr_sleep,
            "goal": sleep_goal,
            "difference": sleep_diff,
            "percent_change": sleep_pct,
            "trend": "above" if sleep_diff > 0 else "below"
        },
        "habits": {
            "current": habit_rate,
            "goal": 75,
            "difference": habit_diff,
            "percent_change": int((habit_diff / 75) * 100) if 75 > 0 else 0,
            "trend": "above" if habit_diff > 0 else "below"
        },
        "water": {
            "current": water_state["logged"],
            "goal": water_state["goal"],
            "difference": water_state["logged"] - water_state["goal"],
            "percent_change": int(((water_state["logged"] - water_state["goal"]) / water_state["goal"]) * 100) if water_state["goal"] > 0 else 0,
            "trend": "above" if water_state["logged"] > water_state["goal"] else "below"
        }
    }

    # 3. Generate insights
    insights = []
    
    # Nutrition insights
    if abs(cal_pct) > 20:
        if cal_pct > 0:
            insights.append(f"You're {cal_pct}% over your calorie goal - consider lighter meals")
        else:
            insights.append(f"You're {abs(cal_pct)} under your calorie goal - ensure adequate nutrition")
    
    # Sleep insights
    if sleep_diff < -1:
        insights.append(f"You're getting {abs(sleep_diff):.1f} hours less sleep than recommended")
    elif sleep_diff > 1:
        insights.append(f"Great job! You're getting {sleep_diff:.1f} hours more sleep than recommended")
    
    # Habits insights
    if habit_rate >= 80:
        insights.append("Excellent habit completion! Keep up the consistency")
    elif habit_rate < 50:
        insights.append("Focus on building consistency with your daily habits")
    
    # Water insights
    water_pct = (water_state["logged"] / water_state["goal"] * 100) if water_state["goal"] > 0 else 0
    if water_pct < 60:
        insights.append(f"Increase water intake - you're at {water_pct:.0f}% of your goal")
    
    # Steps insights
    if steps_diff < -2000:
        insights.append(f"You're {abs(steps_diff)} steps short of the 10,000 step goal")
    elif steps_diff >= 0:
        insights.append("Great job meeting your step goal!")

    # 4. Historical data (mock for now - in production would query historical data)
    historical = _generate_mock_historical_data()

    # 5. Recommendations
    recommendations = _generate_recommendations(trends)

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "current_metrics": {
            "calories": curr_calories,
            "steps": curr_steps,
            "sleep": curr_sleep,
            "habit_completion": habit_rate,
            "water_intake": water_state["logged"]
        },
        "trends": trends,
        "insights": insights,
        "historical_data": historical,
        "recommendations": recommendations
    }


def _generate_mock_historical_data() -> dict:
    """Generate mock historical data for chart visualization."""
    import random
    random.seed(42)  # Deterministic for consistency
    
    # Generate 7 days of data
    days = []
    for i in range(7):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({
            "date": date,
            "calories": random.randint(1800, 2800),
            "steps": random.randint(6000, 12000),
            "sleep": round(random.uniform(6.0, 9.0), 1),
            "habit_completion": random.randint(40, 100),
            "water_intake": round(random.uniform(1.5, 3.0), 1)
        })
    
    return {
        "period": "7 days",
        "data": list(reversed(days))  # Most recent last
    }


def _generate_recommendations(trends: dict) -> list[str]:
    """Generate actionable recommendations based on trends."""
    recommendations = []
    
    # Calorie recommendations
    cal_trend = trends["calories"]
    if cal_trend["trend"] == "above" and abs(cal_trend["percent_change"]) > 15:
        recommendations.append("Consider portion control and focus on nutrient-dense foods")
    elif cal_trend["trend"] == "below" and abs(cal_trend["percent_change"]) > 15:
        recommendations.append("Increase meal frequency and include healthy snacks")
    
    # Sleep recommendations
    sleep_trend = trends["sleep"]
    if sleep_trend["trend"] == "below":
        recommendations.append("Establish a consistent bedtime routine and aim for 7-9 hours")
    
    # Habit recommendations
    habit_trend = trends["habits"]
    if habit_trend["trend"] == "below":
        recommendations.append("Start with 2-3 key habits and build consistency before adding more")
    
    # Water recommendations
    water_trend = trends["water"]
    if water_trend["trend"] == "below":
        recommendations.append("Set reminders to drink water throughout the day")
    
    # Steps recommendations
    steps_trend = trends["steps"]
    if steps_trend["trend"] == "below":
        recommendations.append("Take short walking breaks throughout the day")
    
    return recommendations if recommendations else ["Continue maintaining your current healthy habits!"]
