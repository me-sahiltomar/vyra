"""
schemas/models.py
------------------
All Pydantic request and response models for the H²OS API v1.

Convention:
  - Request models: *Input  (e.g. MealInput, HabitUpdateInput)
  - Response models: *Response (e.g. NutritionResponse, HealthScoreResponse)
  - Shared sub-models carry no suffix (e.g. Meal, WaterState, SleepState)
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field, EmailStr, field_validator
import re


# ══════════════════════════════════════════════════════════════════════════════
# SHARED SUB-MODELS
# ══════════════════════════════════════════════════════════════════════════════

class ErrorResponse(BaseModel):
    """Standard error envelope returned on 4xx / 5xx responses."""
    error: str
    detail: str | None = None
    status_code: int


class MacroTotals(BaseModel):
    calories: float = 0.0
    protein:  float = 0.0
    carbs:    float = 0.0
    fats:     float = 0.0
    fiber:    float = 0.0


class MacroGoals(BaseModel):
    calories: int
    protein:  int
    carbs:    int
    fats:     int
    fiber:    int


class Meal(BaseModel):
    id:        str
    name:      str
    meal_type: str
    calories:  float
    protein:   float
    carbs:     float
    fats:      float
    fiber:     float
    timestamp: str


class Recommendation(BaseModel):
    id:       str
    severity: str          # "red" | "warn" | "blue" | "green"
    icon:     str
    title:    str
    message:  str
    action:   str | None = None


class MealSuggestion(BaseModel):
    name:    str
    desc:    str
    emoji:   str
    cal:     float
    protein: float
    carbs:   float
    fats:    float


class Habit(BaseModel):
    id:       int
    name:     str
    category: str
    done:     bool
    streak:   int


class WaterEntry(BaseModel):
    amount:    float
    timestamp: str
    note:      str = ""


class WaterState(BaseModel):
    logged:    float
    goal:      float
    unit:      str
    percent:   int
    remaining: float
    log:       list[WaterEntry] = []


class SleepState(BaseModel):
    hours:   float
    goal:    float
    percent: int
    quality: int | None = None
    label:   str


class MacroBreakdown(BaseModel):
    protein:  int
    calories: int
    carbs:    int
    fats:     int
    fiber:    int


class Exercise(BaseModel):
    name:   str
    sets:   int
    reps:   str
    muscle: str = ""


class TrendItem(BaseModel):
    val: str   # e.g. "+5%", "-3%"
    dir: str   # "up" | "down"


class InsightCard(BaseModel):
    style: str   # "good" | "warn" | "info"
    tag:   str
    time:  str
    text:  str


# ============================================================================
# AUTHENTICATION MODELS
# ============================================================================

class UserRegister(BaseModel):
    """User registration request model."""
    email: EmailStr
    password: str
    confirm_password: str
    
    @field_validator('email')
    @classmethod
    def sanitize_email(cls, v):
        """Sanitize email input to prevent XSS."""
        if not v:
            raise ValueError('Email is required')
        # Remove any HTML tags and special characters
        v = re.sub(r'[<>"\']', '', str(v))
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Enhanced password validation."""
        if not v:
            raise ValueError('Password is required')
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if len(v) > 128:
            raise ValueError('Password cannot exceed 128 characters')
        
        # Check for password complexity
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        
        # Sanitize password
        v = re.sub(r'[<>"\']', '', str(v))
        return v
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        """Ensure passwords match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class UserLogin(BaseModel):
    """User login request model."""
    email: EmailStr
    password: str
    
    @field_validator('email')
    @classmethod
    def sanitize_email(cls, v):
        """Sanitize email input to prevent XSS."""
        if not v:
            raise ValueError('Email is required')
        v = re.sub(r'[<>"\']', '', str(v))
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def sanitize_password(cls, v):
        """Sanitize password input."""
        if not v:
            raise ValueError('Password is required')
        v = re.sub(r'[<>"\']', '', str(v))
        return v


class UserResponse(BaseModel):
    """User response model (without sensitive data)."""
    id: int
    email: str
    created_at: str
    last_login: Optional[str] = None


class Token(BaseModel):
    """JWT token response model."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Token data model for JWT payload."""
    user_id: Optional[int] = None
    email: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# NUTRITION — REQUEST MODELS
# ══════════════════════════════════════════════════════════════════════════════

class MealInput(BaseModel):
    """
    Accept both camelCase (frontend) and snake_case field names.
    Frontend sends: { name, mealType, cal, protein, carbs, fats, fiber }
    """
    name:      str   = Field(default="Custom Meal", max_length=200)
    meal_type: str   = Field(default="Snack", alias="mealType")
    cal:       float = Field(default=0, ge=0, le=25000)
    calories:  float = Field(default=0, ge=0, le=25000)
    protein:   float = Field(default=0, ge=0, le=2000)
    carbs:     float = Field(default=0, ge=0, le=5000)
    fats:      float = Field(default=0, ge=0, le=2000)
    fiber:     float = Field(default=0, ge=0, le=500)

    model_config = {"populate_by_name": True}

    def model_post_init(self, __context: Any) -> None:
        if self.cal > 0 and self.calories == 0:
            self.calories = self.cal
        elif self.calories > 0 and self.cal == 0:
            self.cal = self.calories

    def to_engine_dict(self) -> dict:
        return {
            "name":      self.name,
            "meal_type": self.meal_type,
            "calories":  self.calories or self.cal,
            "protein":   self.protein,
            "carbs":     self.carbs,
            "fats":      self.fats,
            "fiber":     self.fiber,
        }


class RemoveMealInput(BaseModel):
    id: str = Field(description="meal_<timestamp> id returned by add-meal")


# ══════════════════════════════════════════════════════════════════════════════
# NUTRITION — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class NutritionResponse(BaseModel):
    success:         bool
    meals:           list[Meal]
    totals:          MacroTotals
    healthScore:     int
    recommendations: list[Recommendation]
    suggestion:      MealSuggestion
    goals:           MacroGoals
    breakdown:       MacroBreakdown | None = None
    meal:            Meal | None = None           # present only on add-meal
    message:         str | None = None            # present only on demo reset


# ══════════════════════════════════════════════════════════════════════════════
# HABITS — REQUEST MODELS
# ══════════════════════════════════════════════════════════════════════════════

class HabitUpdateInput(BaseModel):
    """Frontend sends: { habitId, done, date }"""
    habit_id: int  = Field(alias="habitId", ge=0, le=100, description="0-based habit index")
    done:     bool = Field(description="New completion state")
    date:     str  = Field(default="")

    model_config = {"populate_by_name": True}


class WaterLogInput(BaseModel):
    """
    Frontend sends one of:
      { amount } — add N litres (e.g. 0.25 for a glass)
      { set }    — override total to exactly N litres
    """
    amount: float | None = Field(default=None, ge=0, description="Litres to add")
    set:    float | None = Field(default=None, ge=0, description="Override total litres")
    note:   str          = Field(default="")


class SleepLogInput(BaseModel):
    """Frontend sends: { hours, quality? }"""
    hours:   float      = Field(ge=0, le=24, description="Hours slept")
    quality: int | None = Field(default=None, ge=0, le=100, description="Sleep quality 0-100")


# ══════════════════════════════════════════════════════════════════════════════
# HABITS — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class HabitsResponse(BaseModel):
    success:        bool
    habits:         list[Habit]
    completedCount: int
    total:          int
    completionRate: int
    streakLeader:   Habit | None = None
    water:          WaterState
    sleep:          SleepState
    # Present only on toggle response:
    habit:          Habit | None = None


class WaterResponse(BaseModel):
    success: bool
    water:   WaterState


class SleepResponse(BaseModel):
    success: bool
    sleep:   SleepState


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class DailyMetrics(BaseModel):
    calories:        float
    protein:         float
    carbs:           float
    fats:            float
    fiber:           float
    habitsCompleted: int
    habitsTotal:     int
    completionRate:  int


class HealthScoreResponse(BaseModel):
    success:        bool
    score:          int
    grade:          str
    status:         str
    breakdown:      MacroBreakdown
    insights:       list[str]
    goals:          MacroGoals
    daily_metrics:  DailyMetrics


class PingResponse(BaseModel):
    status:  str
    service: str
    version: str


# ══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class EnvironmentRecommendation(BaseModel):
    id:      str
    icon:    str
    title:   str
    message: str
    action:  str | None = None


class EnvironmentResponse(BaseModel):
    success:         bool
    aqi:             int
    level:           str
    color:           str
    uvIndex:         int
    uvLevel:         str
    recommendation:  str
    recommendations: list[EnvironmentRecommendation]
    timestamp:       str


# ══════════════════════════════════════════════════════════════════════════════
# FITNESS — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class FitnessResponse(BaseModel):
    success:           bool
    workoutType:       str
    duration:          int
    calories:          int
    mode:              str
    goal:              str = ""
    level:             str = ""
    forcedIndoorByAqi: bool
    aqiAtGeneration:   int
    exercises:         list[Exercise]
    timestamp:         str


# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class InsightAggregates(BaseModel):
    avgCalories:  str
    avgSteps:     str
    avgSleep:     str
    habitRate:    str
    waterLogged:  str = "0L"


class InsightTrends(BaseModel):
    calories: TrendItem
    steps:    TrendItem
    sleep:    TrendItem
    habits:   TrendItem


class InsightCharts(BaseModel):
    labels:      list[str]
    bodyMetrics: list[float]
    sleepPattern: list[float]


class WeeklyChartData(BaseModel):
    labels:   list[str]
    calories: list[float]
    steps:    list[float]
    sleep:    list[float]


class DailySnapshot(BaseModel):
    calories:        int = 0
    protein:         int = 0
    carbs:           int = 0
    fats:            int = 0
    fiber:           int = 0
    steps:           int = 0
    sleep:           float = 0.0
    water:           float = 0.0
    habitsCompleted: int = 0
    habitsTotal:     int = 0
    habitRate:       int = 0


class InsightsResponse(BaseModel):
    success:       bool
    aggregates:    InsightAggregates
    trends:        InsightTrends
    insights:      list[InsightCard]
    charts:        InsightCharts
    weekly:        WeeklyChartData | None = None
    dailySnapshot: DailySnapshot | None = None
    timestamp:     str


# ══════════════════════════════════════════════════════════════════════════════
# DEMO — RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════════

class DemoResetResponse(NutritionResponse):
    """Demo reset returns a NutritionResponse with an extra message field."""
    pass  # message: str | None inherited from NutritionResponse
