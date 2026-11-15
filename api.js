/* ============================================================
   H²OS — API Layer  (api.js)  v1.0
   ============================================================
   Centralizes state and provides API-based data flow to
   prepare for FastAPI backend integration.

   Endpoint contracts:
     POST   /api/v1/nutrition/add-meal    → NutritionResponse
     DELETE /api/v1/nutrition/remove-meal → NutritionResponse
     GET    /api/v1/nutrition/daily       → NutritionResponse
     POST   /api/v1/habits/update         → HabitResponse
     GET    /api/v1/health/score          → HealthScoreResponse

   To switch from mock → real FastAPI, flip:
     API_CONFIG.useMock = false
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────
   1. CENTRALIZED APP STATE
   Single source of truth for the entire application.
───────────────────────────────────────────── */
const AppState = {
  user: {
    id: 'default',
    name: 'User',
    age: null,
    weight: null,    // kg
    height: null,   // cm
    goal: 'general',
    plan: 'Basic',
  },

  dailyMetrics: {
    date: new Date().toISOString().split('T')[0],
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    water: 0,   // litres logged today
    sleep: 0,   // hours last night
    steps: null,  // today's step count
  },

  healthScore: 0,
  meals: [],
  habits: [],
  waterState: null,
  sleepState: null,
};

/* ─────────────────────────────────────────────
   2. API CONFIGURATION
───────────────────────────────────────────── */
const API_CONFIG = {
  baseUrl: 'http://localhost:8001',
  timeout: 10000,   // ms timeout
  useMock: false,   // always use real API
};

/* ─────────────────────────────────────────────
   3. DAILY GOALS  (shared reference)
───────────────────────────────────────────── */
const DAILY_GOALS_API = {
  calories: 2500,
  protein: 150,
  carbs: 280,
  fats: 78,
  fiber: 30,
};

/* ─────────────────────────────────────────────
   4. PURE CALCULATION HELPERS
   These are the business logic functions.
   They live here so they can later be ported
   directly to FastAPI Python equivalents.
───────────────────────────────────────────── */

/** Health score 0–100, weighted by macro category importance */
function computeHealthScore(metrics) {
  const g = DAILY_GOALS_API;
  function score(v, goal, maxPts, penalizeOver = true) {
    const r = v / goal;
    if (r <= 0) return 0;
    if (r <= 1.0) return Math.round(r * maxPts);
    return penalizeOver ? Math.max(0, Math.round(maxPts - (r - 1) * maxPts * 0.6)) : maxPts;
  }
  return Math.min(100,
    score(metrics.protein, g.protein, 30) +
    score(metrics.calories, g.calories, 25) +
    score(metrics.carbs, g.carbs, 20) +
    score(metrics.fats, g.fats, 15) +
    score(metrics.fiber, g.fiber, 10, false)
  );
}

/** Generate recommendation objects from current daily metrics */
function computeRecommendations(metrics) {
  const g = DAILY_GOALS_API;
  const recos = [];

  const pPct = metrics.protein / g.protein;
  const cPct = metrics.calories / g.calories;
  const fPct = metrics.fats / g.fats;
  const fiPct = metrics.fiber / g.fiber;

  // — Protein rules —
  if (pPct < 0.40) {
    recos.push({
      id: 'protein-very-low', severity: 'red', icon: '⚡',
      title: 'Very Low Protein',
      message: `Only ${metrics.protein}g of ${g.protein}g goal (${Math.round(pPct * 100)}%). Add chicken, eggs, or a protein shake now.`,
      action: 'Fix Now',
    });
  } else if (pPct < 0.70) {
    recos.push({
      id: 'protein-low', severity: 'warn', icon: '⚡',
      title: 'Increase Protein Intake',
      message: `${metrics.protein}g logged — ${g.protein - metrics.protein}g remaining. Add lean meats, Greek yogurt, or legumes.`,
      action: 'Fix Now',
    });
  } else if (pPct <= 1.10) {
    recos.push({
      id: 'protein-good', severity: 'green', icon: '✅',
      title: 'Great Protein Intake!',
      message: `${metrics.protein}g — ${Math.round(pPct * 100)}% of your protein goal. Keep it up!`,
      action: null,
    });
  }

  // — Calorie rules —
  if (cPct > 1.15) {
    recos.push({
      id: 'calories-very-high', severity: 'red', icon: '🚫',
      title: 'Calorie Intake Too High',
      message: `${metrics.calories} kcal — ${metrics.calories - g.calories} kcal over your ${g.calories} kcal goal.`,
      action: 'Learn More',
    });
  } else if (cPct > 0.92) {
    recos.push({
      id: 'calories-high', severity: 'warn', icon: '🔥',
      title: 'Reduce Calorie Intake',
      message: `At ${Math.round(cPct * 100)}% of ${g.calories} kcal goal. Go easy on dinner.`,
      action: 'View Plan',
    });
  } else if (cPct >= 0.55 && pPct >= 0.60) {
    recos.push({
      id: 'balanced', severity: 'green', icon: '🏆',
      title: 'Well Balanced Day',
      message: 'Great macro balance! Maintain portion control for dinner.',
      action: null,
    });
  }

  // — Fat rule —
  if (fPct > 1.10) {
    recos.push({
      id: 'fats-high', severity: 'warn', icon: '🥑',
      title: 'Reduce Fried / Fatty Foods',
      message: `Fat intake (${metrics.fats}g) exceeds your ${g.fats}g goal. Swap fried for grilled or steamed.`,
      action: 'Learn More',
    });
  }

  // — Fiber rule —
  if (fiPct < 0.50) {
    recos.push({
      id: 'fiber-low', severity: 'blue', icon: '🌿',
      title: 'Eat More Fiber-Rich Foods',
      message: `Only ${metrics.fiber}g of ${g.fiber}g fiber goal. Add vegetables, lentils, or whole grains.`,
      action: 'Suggestions',
    });
  }

  const order = { red: 0, warn: 1, blue: 2, green: 3 };
  return recos
    .sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4))
    .slice(0, 3);
}

/** Suggest the best next meal based on current macro deficits */
function computeSuggestion(metrics) {
  const SUGGESTIONS = [
    { name: 'High-Protein Dinner Bowl', desc: 'Grilled salmon · Brown rice · Edamame · Spinach', emoji: '🥗', cal: 520, protein: 42, carbs: 54, fats: 10, tags: ['protein-low', 'protein-very-low', 'balanced'] },
    { name: 'Egg & Avocado Toast', desc: 'Whole wheat toast · 2 eggs · ½ avocado · Tomato', emoji: '🍳', cal: 380, protein: 20, carbs: 32, fats: 22, tags: ['protein-low', 'balanced'] },
    { name: 'Protein Shake + Banana', desc: 'Whey protein · 1 banana · Almond milk', emoji: '🥛', cal: 280, protein: 32, carbs: 30, fats: 4, tags: ['protein-very-low', 'protein-low'] },
    { name: 'Chicken & Veggies', desc: 'Grilled chicken · Steamed broccoli · Quinoa', emoji: '🍗', cal: 440, protein: 48, carbs: 36, fats: 8, tags: ['protein-low', 'protein-very-low', 'fiber-low'] },
    { name: 'Dal & Roti', desc: 'Lentil curry · 2 chapati · Fresh salad', emoji: '🥘', cal: 400, protein: 21, carbs: 68, fats: 5, tags: ['fiber-low', 'protein-low'] },
    { name: 'Greek Yogurt Parfait', desc: 'Greek yogurt · Granola · Berries · Honey', emoji: '🍓', cal: 270, protein: 16, carbs: 38, fats: 6, tags: ['protein-low', 'fiber-low'] },
    { name: 'Light Salad', desc: 'Mixed greens · Cherry tomatoes · Olive dressing', emoji: '🥗', cal: 120, protein: 4, carbs: 14, fats: 6, tags: ['calories-high', 'calories-very-high', 'fats-high'] },
    { name: 'Veggie Soup', desc: 'Broccoli · Lentil · Carrot · Low-salt broth', emoji: '🍲', cal: 160, protein: 10, carbs: 26, fats: 2, tags: ['calories-high', 'calories-very-high', 'fiber-low'] },
  ];

  const recos = computeRecommendations(metrics);
  const ids = recos.map(r => r.id);
  return SUGGESTIONS
    .map(s => ({ s, score: s.tags.filter(t => ids.includes(t)).length }))
    .sort((a, b) => b.score - a.score)[0]?.s || SUGGESTIONS[0];
}

/* ─────────────────────────────────────────────
   5. STATE SYNC HELPERS
───────────────────────────────────────────── */

/** Recompute dailyMetrics totals from current meals array */
function _syncMetricsFromMeals() {
  const totals = AppState.meals.reduce((acc, m) => {
    acc.calories += (m.cal || m.calories || 0);
    acc.protein += (m.protein || 0);
    acc.carbs += (m.carbs || 0);
    acc.fats += (m.fats || 0);
    acc.fiber += (m.fiber || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  Object.assign(AppState.dailyMetrics, totals);
}

/** Build the standard NutritionResponse shape */
function _buildNutritionResponse() {
  const m = AppState.dailyMetrics;
  const score = computeHealthScore(m);
  AppState.healthScore = score;

  return {
    success: true,
    date: m.date,
    totals: {
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fats: m.fats,
      fiber: m.fiber,
    },
    meals: [...AppState.meals],
    healthScore: score,
    recommendations: computeRecommendations(m),
    suggestion: computeSuggestion(m),
    goals: { ...DAILY_GOALS_API },
  };
}

/* ─────────────────────────────────────────────
   6. MOCK IMPLEMENTATIONS
   Return identical shapes to what FastAPI would return.
───────────────────────────────────────────── */

function _mockAddMeal(meal) {
  const entry = {
    id: `meal_${Date.now()}`,
    name: meal.name || 'Custom Meal',
    mealType: meal.mealType || 'Snack',
    cal: meal.cal || meal.calories || 0,
    calories: meal.cal || meal.calories || 0,
    protein: meal.protein || 0,
    carbs: meal.carbs || 0,
    fats: meal.fats || 0,
    fiber: meal.fiber || 0,
    timestamp: new Date().toISOString(),
  };
  AppState.meals.push(entry);
  _syncMetricsFromMeals();
  return _buildNutritionResponse();
}

function _mockRemoveMeal(mealId) {
  const idx = AppState.meals.findIndex(m => m.id === mealId || m.name === mealId);
  if (idx !== -1) AppState.meals.splice(idx, 1);
  _syncMetricsFromMeals();
  return _buildNutritionResponse();
}

function _mockGetDaily() {
  return _buildNutritionResponse();
}

function _mockUpdateHabit(habitId, done) {
  const habit = AppState.habits.find(h => h.id === habitId);
  if (habit) {
    habit.done = done;
    if (done) habit.streak = (habit.streak || 0) + 1;
    else if (habit.streak > 0) habit.streak -= 1;
  }
  const score = computeHealthScore(AppState.dailyMetrics);
  AppState.healthScore = score;

  return {
    success: true,
    habit: habit ? { ...habit } : null,
    habits: AppState.habits.map(h => ({ ...h })),
    completedCount: AppState.habits.filter(h => h.done).length,
    total: AppState.habits.length,
    healthScore: score,
  };
}

function _mockGetHealthScore() {
  const m = AppState.dailyMetrics;
  const score = computeHealthScore(m);
  AppState.healthScore = score;

  return {
    success: true,
    score,
    status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
    breakdown: {
      protein: Math.min(30, Math.round((m.protein / DAILY_GOALS_API.protein) * 30)),
      calories: Math.min(25, Math.round((m.calories / DAILY_GOALS_API.calories) * 25)),
      carbs: Math.min(20, Math.round((m.carbs / DAILY_GOALS_API.carbs) * 20)),
      fats: Math.min(15, Math.round((m.fats / DAILY_GOALS_API.fats) * 15)),
      fiber: Math.min(10, Math.round((m.fiber / DAILY_GOALS_API.fiber) * 10)),
    },
    user: { ...AppState.user },
    dailyMetrics: { ...AppState.dailyMetrics },
  };
}

/* ─────────────────────────────────────────────
   7. REALISTIC NETWORK SIMULATION
───────────────────────────────────────────── */

/** Returns a random latency in ms, mimicking real API variability */
function _simulateLatency(type = 'read') {
  // read ops are faster; write ops take a bit longer
  const ranges = {
    read: { min: 120, max: 380 },
    write: { min: 200, max: 620 },
  };
  const { min, max } = ranges[type] || ranges.read;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Wraps a value in a full server-response envelope */
function _envelope(data, endpoint, latencyMs) {
  return {
    ...data,
    _meta: {
      endpoint,
      latencyMs,
      timestamp: new Date().toISOString(),
      source: 'mock',
      apiVersion: 'v1',
      userId: AppState.user.id,
    },
  };
}

const _inFlightReqs = new Map();

/** Core fetch wrapper — handles execution, deduplication, latency tracking, and mock fallbacks */
async function _apiFetch(endpoint, options, mockFn, opType = 'read') {
  const method = options?.method || 'GET';
  
  // Deduplicate identical pending GET requests
  const reqKey = `${method}:${endpoint}`;
  if (method === 'GET' && _inFlightReqs.has(reqKey)) {
    return _inFlightReqs.get(reqKey);
  }

  const execFetch = async () => {
    const t0 = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), API_CONFIG.timeout);
      const headers = { 'Content-Type': 'application/json' };
      
      // Add authentication header if available
      if (typeof getAuthToken === 'function') {
        const token = getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } else if (AppState.user?.id) {
        headers['X-User-ID'] = AppState.user.id;
      }
      
      const res = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
        headers,
        signal: ctrl.signal,
        ...options,
      });
      clearTimeout(timer);
      
      if (!res.ok) {
        let backendError = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.error) backendError = errJson.error;
        } catch (e) { /* ignore */ }
        throw new Error(backendError);
      }
      
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - t0);
      _updateStatusBadge(endpoint, latencyMs);
      return data;
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      
      // Enhanced error handling with specific error types
      let errorMessage = 'Unable to fetch data';
      let errorType = 'error';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timeout - please check your connection';
        errorType = 'warning';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Network error - please check your connection';
        errorType = 'error';
      } else if (err.message.includes('401')) {
        errorMessage = 'Authentication required - please login again';
        errorType = 'error';
      } else if (err.message.includes('403')) {
        errorMessage = 'Access denied - insufficient permissions';
        errorType = 'error';
      } else if (err.message.includes('404')) {
        errorMessage = 'Data not found - please refresh and try again';
        errorType = 'warning';
      } else if (err.message.includes('422') || err.message.includes('400')) {
        errorMessage = 'Invalid data - please check your input';
        errorType = 'error';
      } else if (err.message.includes('500')) {
        errorMessage = 'Server error - please try again later';
        errorType = 'error';
      } else {
        errorMessage = `Unexpected error: ${err.message}`;
        errorType = 'error';
      }
      
      if (typeof showToast === 'function') {
        showToast(errorMessage, errorType, 5000);
      }
      
      _updateStatusBadge(endpoint, latencyMs, true);
      return {
        success: false,
        error: errorMessage,
        endpoint,
        latencyMs,
        data: null
      };
    }
  };

  const promise = execFetch().finally(() => {
    if (method === 'GET') _inFlightReqs.delete(reqKey);
  });

  if (method === 'GET') {
    _inFlightReqs.set(reqKey, promise);
  }

  return promise;
}

/* ─────────────────────────────────────────────
   8. PUBLIC API OBJECT
   Matches FastAPI endpoint contracts exactly.
───────────────────────────────────────────── */
const API = {
  addMeal(meal) {
    return _apiFetch('/api/v1/nutrition/add-meal',
      { method: 'POST', body: JSON.stringify(meal) },
      null, 'write');
  },
  removeMeal(mealId) {
    return _apiFetch('/api/v1/nutrition/remove-meal',
      { method: 'DELETE', body: JSON.stringify({ id: mealId }) },
      null, 'write');
  },
  getDaily() {
    return _apiFetch('/api/v1/nutrition/daily',
      { method: 'GET' }, null, 'read');
  },
  updateHabit(habitId, done) {
    return _apiFetch('/api/v1/habits/update',
      { method: 'POST', body: JSON.stringify({ habitId, done, date: AppState.dailyMetrics.date }) },
      null, 'write');
  },
  getHabits() {
    return _apiFetch('/api/v1/habits/',
      { method: 'GET' }, null, 'read');
  },
  logWater(payload) {
    // payload: { amount: Number } or { set: Number }
    return _apiFetch('/api/v1/habits/log-water',
      { method: 'POST', body: JSON.stringify(payload) },
      null, 'write');
  },
  logSleep(payload) {
    // payload: { hours: Number, quality?: Number }
    return _apiFetch('/api/v1/habits/log-sleep',
      { method: 'POST', body: JSON.stringify(payload) },
      null, 'write');
  },
  getHealthScore() {
    return _apiFetch('/api/v1/health/score',
      { method: 'GET' }, null, 'read');
  },
  getEnvironment() {
    return _apiFetch('/api/v1/environment/',
      { method: 'GET' }, null, 'read');
  },
  getFitnessPlan() {
    return _apiFetch('/api/v1/fitness/today',
      { method: 'GET' }, null, 'read');
  },
  getInsights() {
    return _apiFetch('/api/v1/insights/',
      { method: 'GET' }, null, 'read');
  },
  demoReset() {
    return _apiFetch('/api/v1/demo/reset',
      { method: 'POST', body: JSON.stringify({}) },
      null, 'write');
  },
};

/* ─────────────────────────────────────────────
   9. NAMED STANDALONE API FUNCTIONS
   ─────────────────────────────────────────────
   These are the primary public interface.
   Named explicitly so any module can call them
   without needing to know about the API object.

   Each function:
     • Simulates variable network latency
     • Returns a realistic, fully-shaped JSON response
     • Logs the call with timing to the console
     • Works identically to what FastAPI would return
─────────────────────────────────────────────── */

/**
 * addMealAPI(meal)
 * Simulates: POST /api/nutrition/add-meal
 *
 * @param {{ name, mealType, cal, protein, carbs, fats, fiber }} meal
 * @returns {Promise<NutritionResponse>}
 *
 * Example response:
 * {
 *   success: true,
 *   meal: { id, name, mealType, cal, protein, carbs, fats, fiber, timestamp },
 *   totals: { calories, protein, carbs, fats, fiber },
 *   healthScore: 74,
 *   recommendations: [...],
 *   suggestion: { name, desc, emoji, cal, protein, carbs, fats },
 *   goals: { calories, protein, carbs, fats, fiber },
 *   _meta: { endpoint, latencyMs, timestamp, source, apiVersion }
 * }
 */
async function addMealAPI(meal) {
  const res = await API.addMeal(meal);
  return res;
}

/**
 * getDailyNutrition()
 * Simulates: GET /api/nutrition/daily
 *
 * @returns {Promise<NutritionResponse>}
 *
 * Example response:
 * {
 *   success: true,
 *   date: "2026-03-31",
 *   totals: { calories: 1690, protein: 111, carbs: 110, fats: 50, fiber: 20 },
 *   meals: [ ...all logged meals today... ],
 *   healthScore: 65,
 *   breakdown: { protein: 22, calories: 17, carbs: 8, fats: 9, fiber: 7 },
 *   recommendations: [...],
 *   suggestion: { name, desc, emoji, cal, protein, carbs, fats },
 *   goals: { calories: 2500, protein: 150, carbs: 280, fats: 78, fiber: 30 },
 *   _meta: { endpoint, latencyMs, timestamp, source, apiVersion }
 * }
 */
async function getDailyNutrition() {
  const res = await API.getDaily();
  // Enrich with a breakdown field (calorie contribution per macro)
  if (res.totals) {
      res.breakdown = {
        protein: Math.min(30, Math.round((res.totals.protein / DAILY_GOALS_API.protein) * 30)),
        carbs: Math.min(25, Math.round((res.totals.carbs / DAILY_GOALS_API.carbs) * 25)),
        fats: Math.min(20, Math.round((res.totals.fats / DAILY_GOALS_API.fats) * 20)),
        fiber: Math.min(10, Math.round((res.totals.fiber / DAILY_GOALS_API.fiber) * 10)),
      };
  }
  return res;
}

/**
 * updateHabitsAPI(habitId, done)
 * Simulates: POST /api/habits/update
 *
 * @param {number} habitId  - Index of the habit in AppState.habits
 * @param {boolean} done    - New completion state
 * @returns {Promise<HabitResponse>}
 *
 * Example response:
 * {
 *   success: true,
 *   habit: { id, name, category, done, streak },
 *   habits: [ ...all habits with updated state... ],
 *   completedCount: 5,
 *   total: 6,
 *   completionRate: 83,        ← percentage
 *   streakLeader: { name, streak: 14 },
 *   healthScore: 74,
 *   _meta: { endpoint, latencyMs, timestamp, source, apiVersion }
 * }
 */
async function updateHabitsAPI(habitId, done) {
  const res = await API.updateHabit(habitId, done);
  // Enrich with extra fields the UI or future features may need
  if (res.completedCount != null) {
    res.completionRate = Math.round((res.completedCount / res.total) * 100);
    const leader = [...AppState.habits].sort((a, b) => b.streak - a.streak)[0];
    res.streakLeader = leader ? { name: leader.name, streak: leader.streak } : null;
  }
  return res;
}

/**
 * getHealthScoreAPI()
 * Simulates: GET /api/health/score
 *
 * @returns {Promise<HealthScoreResponse>}
 *
 * Example response:
 * {
 *   success: true,
 *   score: 74,
 *   status: "good",
 *   grade: "B",
 *   breakdown: { protein: 22, calories: 17, carbs: 8, fats: 9, fiber: 7 },
 *   insights: [ "Great protein tracking!", "Add more fiber-rich foods" ],
 *   user: { id, name, age, weight, height, goal, plan },
 *   dailyMetrics: { date, calories, protein, carbs, fats, fiber, water, sleep, steps },
 *   _meta: { endpoint, latencyMs, timestamp, source, apiVersion }
 * }
 */
async function getHealthScoreAPI() {
  const res = await API.getHealthScore();
  // Enrich with letter grade and human-readable insights
  const score = res.score ?? 0;
  res.grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B'
    : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
  res.insights = _generateInsights(AppState.dailyMetrics, score);
  return res;
}

/** Helper: generate 2–3 plain-English insight strings */
function _generateInsights(m, score) {
  const g = DAILY_GOALS_API;
  const tips = [];
  const pPct = m.protein / g.protein;
  const calPct = m.calories / g.calories;
  const fibrPct = m.fiber / g.fiber;

  if (pPct < 0.6) tips.push(`Protein is at ${Math.round(pPct * 100)}% — aim for lean meats or legumes.`);
  else tips.push(`Great protein tracking! ${m.protein}g logged so far.`);

  if (calPct > 1.1) tips.push(`Caution: ${m.calories - g.calories} kcal over daily limit.`);
  else if (calPct < 0.4) tips.push(`Only ${Math.round(calPct * 100)}% of calories logged — keep eating!`);
  else tips.push(`Calorie balance looks healthy at ${Math.round(calPct * 100)}%.`);

  if (fibrPct < 0.5) tips.push('Add more fiber-rich foods: vegetables, lentils, or whole grains.');

  if (score >= 80) tips.push('Excellent day! Your macros are well-balanced. 🎯');
  return tips.slice(0, 3);
}

/* ─────────────────────────────────────────────
   10. MOCK-MODE STATUS BADGE
   Shows a small floating badge in the corner
   whenever a mock API call completes, so the
   UI visibly behaves like a real backend.
───────────────────────────────────────────── */
function _updateStatusBadge(endpoint, latencyMs, isFallback = false) {
  let badge = document.getElementById('mockApiBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'mockApiBadge';
    badge.style.cssText = `
      position:fixed; bottom:16px; left:16px; z-index:99999;
      display:flex; align-items:center; gap:7px;
      background:rgba(17,24,39,0.92); backdrop-filter:blur(8px);
      border:1px solid rgba(99,102,241,0.4); border-radius:99px;
      padding:6px 13px 6px 10px; font-size:11px; font-weight:600;
      color:#e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.3);
      transition:opacity 0.4s ease; opacity:0; pointer-events:none;
      font-family:'Inter',sans-serif; letter-spacing:0.02em;
    `;
    document.body.appendChild(badge);
  }

  const dot = isFallback ? '🟡' : '🟢';
  const color = isFallback ? '#fbbf24' : '#4ade80';
  const short = endpoint.split('/').pop();
  badge.innerHTML = `
    <span style="font-size:8px;color:${color}">●</span>
    <span style="color:#94a3b8">Mock API</span>
    <span style="color:#fff;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">/${short}</span>
    <span style="color:${color};margin-left:2px">${latencyMs}ms</span>
  `;

  badge.style.opacity = '1';
  clearTimeout(badge._hideTimer);
  badge._hideTimer = setTimeout(() => { badge.style.opacity = '0'; }, 2800);
}

/* ─────────────────────────────────────────────
   11. SEED INITIAL STATE
───────────────────────────────────────────── */
(function seedInitialState() {
  AppState.meals = [
    { id: 'seed_0', name: 'Oatmeal with berries', mealType: 'Breakfast', cal: 320, calories: 320, protein: 8, carbs: 58, fats: 6, fiber: 8 },
    { id: 'seed_1', name: 'Greek yogurt (150g)', mealType: 'Breakfast', cal: 130, calories: 130, protein: 14, carbs: 9, fats: 1, fiber: 0 },
    { id: 'seed_2', name: 'Grilled chicken salad', mealType: 'Lunch', cal: 480, calories: 480, protein: 38, carbs: 12, fats: 14, fiber: 3 },
    { id: 'seed_3', name: 'Whole wheat bread (2 slices)', mealType: 'Lunch', cal: 160, calories: 160, protein: 6, carbs: 30, fats: 2, fiber: 4 },
    { id: 'seed_4', name: 'Salmon fillet (200g)', mealType: 'Dinner', cal: 520, calories: 520, protein: 40, carbs: 0, fats: 28, fiber: 0 },
    { id: 'seed_5', name: 'Steamed broccoli (150g)', mealType: 'Dinner', cal: 80, calories: 80, protein: 5, carbs: 11, fats: 1, fiber: 5 },
  ];
  _syncMetricsFromMeals();
  AppState.healthScore = computeHealthScore(AppState.dailyMetrics);
})();


