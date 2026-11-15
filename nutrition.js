/* ============================================================
   H²OS — Nutrition Module  (nutrition.js)  v3.0
   ============================================================
   UI rendering for the Nutrition page.

   Architecture:
   - ALL state lives in AppState (api.js)
   - ALL calculations live in api.js (computeHealthScore, etc.)
   - This file owns: food DB, autocomplete, and DOM rendering
   - Every public function is async — it calls the API layer
     and renders from the response object

   Data flow:
     User Action → API call (api.js) → NutritionResponse
     → _renderFromResponse(res) → DOM update
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────
   1. DAILY GOALS  (display reference)
───────────────────────────────────────────── */
const DAILY_GOALS = {
  calories: 2500,
  protein:  150,
  carbs:    280,
  fats:     78,
  fiber:    30,
};

/* ─────────────────────────────────────────────
   2. FOOD DATABASE  (client-side UX only)
   Powers autocomplete — not business logic.
───────────────────────────────────────────── */
const FOOD_DB = [
  // Proteins
  { name: 'Chicken Breast',    cal: 165, protein: 31, carbs: 0,  fats: 4,  fiber: 0  },
  { name: 'Grilled Chicken',   cal: 185, protein: 35, carbs: 0,  fats: 4,  fiber: 0  },
  { name: 'Chicken Salad',     cal: 480, protein: 38, carbs: 12, fats: 14, fiber: 3  },
  { name: 'Salmon Fillet',     cal: 520, protein: 40, carbs: 0,  fats: 28, fiber: 0  },
  { name: 'Tuna (canned)',     cal: 130, protein: 28, carbs: 0,  fats: 1,  fiber: 0  },
  { name: 'Eggs',              cal: 143, protein: 13, carbs: 1,  fats: 10, fiber: 0  },
  { name: 'Eggs (3)',          cal: 250, protein: 25, carbs: 2,  fats: 15, fiber: 0  },
  { name: 'Greek Yogurt',      cal: 130, protein: 14, carbs: 9,  fats: 1,  fiber: 0  },
  { name: 'Whey Shake',        cal: 150, protein: 30, carbs: 2,  fats: 2,  fiber: 0  },
  { name: 'Cottage Cheese',    cal: 110, protein: 13, carbs: 4,  fats: 5,  fiber: 0  },
  { name: 'Tofu',              cal: 145, protein: 17, carbs: 3,  fats: 9,  fiber: 1  },
  { name: 'Lentils',           cal: 230, protein: 18, carbs: 40, fats: 1,  fiber: 16 },
  { name: 'Black Beans',       cal: 220, protein: 15, carbs: 40, fats: 1,  fiber: 15 },
  // Carbs / Grains
  { name: 'Oatmeal',           cal: 320, protein: 8,  carbs: 58, fats: 6,  fiber: 8  },
  { name: 'Brown Rice',        cal: 215, protein: 5,  carbs: 45, fats: 2,  fiber: 4  },
  { name: 'White Rice',        cal: 240, protein: 4,  carbs: 53, fats: 0,  fiber: 1  },
  { name: 'Quinoa',            cal: 220, protein: 8,  carbs: 39, fats: 4,  fiber: 5  },
  { name: 'Whole Wheat Bread', cal: 160, protein: 6,  carbs: 30, fats: 2,  fiber: 4  },
  { name: 'Wheat Bread',       cal: 160, protein: 6,  carbs: 30, fats: 2,  fiber: 4  },
  { name: 'White Bread',       cal: 140, protein: 4,  carbs: 27, fats: 1,  fiber: 1  },
  { name: 'Pasta',             cal: 220, protein: 8,  carbs: 44, fats: 1,  fiber: 2  },
  { name: 'Sweet Potato',      cal: 115, protein: 2,  carbs: 27, fats: 0,  fiber: 4  },
  // Vegetables
  { name: 'Broccoli',          cal: 80,  protein: 5,  carbs: 11, fats: 1,  fiber: 5  },
  { name: 'Spinach',           cal: 23,  protein: 3,  carbs: 4,  fats: 0,  fiber: 2  },
  { name: 'Salad',             cal: 30,  protein: 2,  carbs: 5,  fats: 0,  fiber: 3  },
  { name: 'Kale',              cal: 49,  protein: 4,  carbs: 9,  fats: 1,  fiber: 4  },
  { name: 'Avocado',           cal: 240, protein: 3,  carbs: 13, fats: 22, fiber: 10 },
  { name: 'Tomato',            cal: 22,  protein: 1,  carbs: 5,  fats: 0,  fiber: 1  },
  // Fruits
  { name: 'Apple',             cal: 95,  protein: 0,  carbs: 25, fats: 0,  fiber: 4  },
  { name: 'Banana',            cal: 105, protein: 1,  carbs: 27, fats: 0,  fiber: 3  },
  { name: 'Orange',            cal: 62,  protein: 1,  carbs: 15, fats: 0,  fiber: 3  },
  { name: 'Blueberries',       cal: 57,  protein: 1,  carbs: 14, fats: 0,  fiber: 2  },
  { name: 'Strawberries',      cal: 49,  protein: 1,  carbs: 12, fats: 0,  fiber: 3  },
  // Dairy & Fats
  { name: 'Milk',              cal: 105, protein: 8,  carbs: 12, fats: 2,  fiber: 0  },
  { name: 'Paneer',            cal: 265, protein: 18, carbs: 3,  fats: 21, fiber: 0  },
  { name: 'Peanut Butter',     cal: 190, protein: 8,  carbs: 7,  fats: 16, fiber: 2  },
  { name: 'Almonds',           cal: 164, protein: 6,  carbs: 6,  fats: 14, fiber: 4  },
  // Indian / full meals
  { name: 'Dal',               cal: 200, protein: 12, carbs: 34, fats: 2,  fiber: 10 },
  { name: 'Dal Rice',          cal: 420, protein: 15, carbs: 80, fats: 3,  fiber: 12 },
  { name: 'Roti',              cal: 100, protein: 3,  carbs: 20, fats: 1,  fiber: 2  },
  { name: 'Chapati',           cal: 100, protein: 3,  carbs: 20, fats: 1,  fiber: 2  },
  { name: 'Idli',              cal: 58,  protein: 2,  carbs: 12, fats: 0,  fiber: 1  },
  { name: 'Dosa',              cal: 120, protein: 3,  carbs: 22, fats: 2,  fiber: 1  },
  { name: 'Sambar',            cal: 90,  protein: 5,  carbs: 14, fats: 2,  fiber: 5  },
  { name: 'Pizza (slice)',     cal: 285, protein: 12, carbs: 36, fats: 10, fiber: 2  },
  { name: 'Burger',            cal: 490, protein: 27, carbs: 40, fats: 25, fiber: 3  },
  { name: 'Fried Chicken',     cal: 380, protein: 26, carbs: 14, fats: 25, fiber: 1  },
  { name: 'French Fries',      cal: 365, protein: 4,  carbs: 48, fats: 17, fiber: 4  },
  // Snacks & drinks
  { name: 'Protein Bar',       cal: 220, protein: 20, carbs: 22, fats: 7,  fiber: 5  },
  { name: 'Granola Bar',       cal: 190, protein: 4,  carbs: 29, fats: 7,  fiber: 2  },
  { name: 'Orange Juice',      cal: 112, protein: 2,  carbs: 26, fats: 0,  fiber: 1  },
  { name: 'Coffee (black)',    cal: 5,   protein: 0,  carbs: 1,  fats: 0,  fiber: 0  },
  { name: 'Protein Shake',     cal: 150, protein: 30, carbs: 2,  fats: 2,  fiber: 0  },
];

/* ─────────────────────────────────────────────
   3. FOOD SEARCH HELPERS  (purely client-side)
───────────────────────────────────────────── */
function lookupFood(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  let best = null, bestScore = 0;
  for (const food of FOOD_DB) {
    const name = food.name.toLowerCase();
    let score = 0;
    if (name === q)              score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q))   score = 60;
    else if (q.includes(name))   score = 50;
    else {
      const words = q.split(' ');
      const nw    = name.split(' ');
      const m     = words.filter(w => nw.some(n => n.startsWith(w) || w.startsWith(n)));
      score = (m.length / Math.max(words.length, 1)) * 40;
    }
    if (score > bestScore) { bestScore = score; best = food; }
  }
  return bestScore >= 40 ? best : null;
}

function searchFoods(query, limit = 5) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim();
  return FOOD_DB
    .map(food => {
      const name = food.name.toLowerCase();
      let score = 0;
      if (name === q)              score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q))   score = 60;
      else if (q.split(' ').some(w => name.includes(w) && w.length > 1)) score = 30;
      return { food, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.food);
}

/* ─────────────────────────────────────────────
   4. RESPONSE RENDERER
   Normalises a NutritionResponse from the API
   and calls all DOM update functions.
───────────────────────────────────────────── */
function _renderFromResponse(res) {
  if (!res || !res.success) return;

  const t = res.totals || {};   // Safe default
  const score = res.healthScore || 0;

  // Normalize totals to the shape the render helpers expect internally
  const normalized = {
    cal:     t.calories || 0,
    protein: t.protein || 0,
    carbs:   t.carbs || 0,
    fats:    t.fats || 0,
    fiber:   t.fiber || 0,
  };

  _updateBanner(score, normalized);
  _updateMacroCards(normalized);
  _updateMacroBars(normalized);
  _updateDonut(normalized);
  _updateRecommendations(res.recommendations || []);
  if (res.suggestion) _updateSmartSuggestion(res.suggestion);
}

/* ─────────────────────────────────────────────
   5. PUBLIC API (async — all go through api.js)
───────────────────────────────────────────── */

/** Called on page load and after any mutation — refresh entire nutrition UI */
async function updateNutritionUI() {
  try {
    const res = await API.getDaily();
    _renderFromResponse(res);
  } catch (err) {

  }
}

/** Called from app.js when user saves a new meal */
async function nutritionAddMeal(meal) {
  try {
    const res = await API.addMeal(meal);
    // Slight delay so the card animation finishes first
    setTimeout(() => {
      _renderFromResponse(res);
      if (typeof window.syncGlobalState === 'function') window.syncGlobalState();
    }, 360);
  } catch (err) {

  }
}

/** Called from app.js deleteMealCard handler */
async function nutritionRemoveMeal(btnOrName) {
  let mealName = typeof btnOrName === 'string' ? btnOrName : null;

  if (btnOrName instanceof Element) {
    const card  = btnOrName.closest('.meal-card');
    if (card) {
      const nameEl = card.querySelector('.meal-item-name');
      mealName = nameEl ? nameEl.textContent.trim() : '';

      // Animate card out
      card.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(-20px)';
      setTimeout(() => card.remove(), 310);
      if (typeof showToast === 'function') showToast('Meal removed', 'info', 1800);
    }
  }

  try {
    const res = await API.removeMeal(mealName);
    setTimeout(() => {
      _renderFromResponse(res);
      if (typeof window.syncGlobalState === 'function') window.syncGlobalState();
    }, 360);
  } catch (err) {

  }
}

/* ─────────────────────────────────────────────
   6. DOM RENDER HELPERS
   Accept pre-computed data and update the DOM.
   These functions are pure UI — no calculation.
───────────────────────────────────────────── */

function pct(val, goal) { return Math.min(Math.round((val / goal) * 100), 200); }

/** Score banner (top card with donut ring) */
function _updateBanner(score, t) {
  const g = DAILY_GOALS;

  // Big score number
  const scoreEl = document.querySelector('.nsb-score');
  if (scoreEl) {
    scoreEl.textContent = score;
    scoreEl.classList.remove('score-updating');
    void scoreEl.offsetWidth; // force reflow to restart animation
    scoreEl.classList.add('score-updating');
  }

  // SVG ring — stroke-dashoffset = circumference × (1 - score/100)
  const ring = document.querySelector('.nsb-circle-track circle:last-child');
  if (ring) {
    const circumference = 201; // 2π × 32
    ring.setAttribute('stroke-dashoffset', Math.round(circumference * (1 - score / 100)));
  }

  // Percentage text inside ring
  const ringVal = document.querySelector('.nsb-circle-val');
  if (ringVal) ringVal.textContent = score + '%';

  // Badge
  const badge = document.querySelector('.nsb-badge');
  if (badge) {
    if (score >= 80) {
      badge.textContent = 'On Track 🎯';
      badge.className   = 'nsb-badge good';
      badge.removeAttribute('style');
    } else if (score >= 55) {
      badge.textContent = 'Needs Attention';
      badge.className   = 'nsb-badge warn';
      badge.removeAttribute('style');
    } else {
      badge.textContent   = 'Poor Balance';
      badge.className     = 'nsb-badge';
      badge.style.cssText = 'background:rgba(239,68,68,0.25);color:#f87171;border:1px solid rgba(239,68,68,0.4)';
    }
  }

  // Hint text
  const hint = document.querySelector('.nsb-hint');
  if (hint) {
    const protPct = pct(t.protein, g.protein);
    const calPct  = pct(t.cal, g.calories);
    if      (score >= 80)            hint.textContent = 'Great balance today — keep it up! 🎉';
    else if (t.cal > g.calories)     hint.textContent = `Over calorie goal by ${t.cal - g.calories} kcal. Lighter meals recommended.`;
    else if (protPct < 50)           hint.textContent = `Protein is dragging your score down (${protPct}% of goal).`;
    else if (calPct < 40)            hint.textContent = `Low calories logged (${calPct}%) — make sure you eat enough.`;
    else                             hint.textContent = 'Keep logging meals for a more accurate score.';
  }
}

/** 3 macro stat cards (Calories, Protein, Carbs) */
function _updateMacroCards(t) {
  const g = DAILY_GOALS;
  _setCard('calories', t.cal,     g.calories, 'kcal', (t.cal / g.calories) * 100,     false);
  _setCard('protein',  t.protein, g.protein,  'g',    (t.protein / g.protein) * 100,  t.protein / g.protein < 0.50);
  _setCard('carbs',    t.carbs,   g.carbs,    'g',    (t.carbs / g.carbs) * 100,       false);
}

function _setCard(cls, value, goal, unit, percent, isLow) {
  const card = document.querySelector('.nmc-card.' + cls);
  if (!card) return;

  const valEl  = card.querySelector('.nmc-val');
  const metaEl = card.querySelector('.nmc-meta');
  const barEl  = card.querySelector('.nmc-bar');

  if (valEl) valEl.textContent = unit === 'kcal' ? value.toLocaleString() : value;

  if (metaEl) {
    const p       = Math.round(Math.min(percent, 200));
    const goalStr = unit === 'kcal' ? (goal / 1000).toFixed(1) + 'k' : goal + unit;
    metaEl.textContent = `${p}% of ${goalStr} goal` + (isLow ? ' — Low ⚠️' : '');
    metaEl.className   = 'nmc-meta' + (isLow ? ' low' : '');
  }

  if (barEl) {
    barEl.style.width = Math.min(percent, 100) + '%';
    barEl.style.background =
      percent > 110 ? 'var(--red)' :
      percent > 90  ? 'var(--orange)' :
      isLow         ? 'var(--red)' : '';
  }
}

/** Macro progress bars (Carbs / Protein / Fats / Fiber) */
function _updateMacroBars(t) {
  const g = DAILY_GOALS;
  const rows = [
    { val: t.carbs,   goal: g.carbs   },
    { val: t.protein, goal: g.protein },
    { val: t.fats,    goal: g.fats    },
    { val: t.fiber,   goal: g.fiber   },
  ];

  document.querySelectorAll('.macro-bar-item').forEach((item, i) => {
    const row = rows[i];
    if (!row) return;
    const fill = item.querySelector('.macro-bar-fill');
    const val  = item.querySelector('.macro-val');
    const p    = Math.min((row.val / row.goal) * 100, 100);
    if (fill) fill.style.width = p + '%';
    if (val) {
      const goalSpan = val.querySelector('.macro-goal');
      const text     = `${row.val}g `;
      val.childNodes[0].textContent = text;
      if (goalSpan) goalSpan.textContent = `/ ${row.goal}g`;
    }
  });
}

/** Chart.js macro donut (calorie center label + dataset) */
function _updateDonut(t) {
  const centerEl = document.querySelector('.macro-cal-num');
  if (centerEl) centerEl.textContent = t.cal.toLocaleString();

  // macroDonut is declared in app.js — access via window to avoid ReferenceError
  const chart = window.macroDonut;
  if (chart && chart.data) {
    chart.data.datasets[0].data = [t.carbs * 4, t.protein * 4, t.fats * 9];
    chart.update('none');
  }
}

/** Dietary recommendations list */
function _updateRecommendations(recos) {
  const list  = document.querySelector('.reco-list');
  const count = document.querySelector('.reco-count');
  if (!list) return;

  list.innerHTML = '';

  const clsMap = { red: 'reco-red', warn: 'reco-warn', blue: 'reco-blue', green: 'reco-green' };
  const iconBg  = { red: 'red', warn: 'warn', blue: 'blue', green: 'warn' };

  if (recos.length === 0) {
    list.innerHTML = `
      <div class="reco-card reco-green">
        <div class="reco-left">
          <div class="reco-icon-wrap" style="background:#dcfce7">✅</div>
          <div class="reco-body">
            <p class="reco-title">All Goals Met!</p>
            <p class="reco-desc">Excellent balance today. Keep it up!</p>
          </div>
        </div>
      </div>`;
    if (count) { count.textContent = '0'; count.style.background = 'var(--green-light)'; count.style.color = 'var(--green-dark)'; }
    return;
  }

  const negCount = recos.filter(r => r.severity === 'red' || r.severity === 'warn').length;
  if (count) {
    count.textContent       = negCount > 0 ? negCount : '0';
    count.style.background  = negCount > 0 ? '' : 'var(--green-light)';
    count.style.color       = negCount > 0 ? '' : 'var(--green-dark)';
  }

  recos.forEach(r => {
    const severityClass = { red: 'severity-red', warn: 'severity-warn', blue: 'severity-blue', green: 'severity-green' }[r.severity] || 'severity-warn';
    const card = document.createElement('div');
    card.className = `rec-card ${severityClass}`;
    card.innerHTML = `
      <div class="rec-icon">${r.icon}</div>
      <div class="rec-info">
        <p class="rec-title">${r.title}</p>
        <p class="rec-msg">${r.message}</p>
      </div>
      ${r.action ? `<button class="rec-action-btn" onclick="openModal('addMealModal')">${r.action}</button>` : ''}
    `;
    list.appendChild(card);
  });
}

/** Smart suggestion card */
function _updateSmartSuggestion(meal) {
  const s = sel => document.querySelector(sel);
  if (s('.ss-meal-name')) s('.ss-meal-name').textContent = meal.name;
  if (s('.ss-meal-desc')) s('.ss-meal-desc').textContent = meal.desc;
  if (s('.ss-meal-icon')) s('.ss-meal-icon').textContent = meal.emoji;
  const macros = s('.ss-meal-macros');
  if (macros) macros.innerHTML = `
    <span class="ss-macro cal">🔥 ${meal.cal} kcal</span>
    <span class="ss-macro prot">💪 ${meal.protein}g protein</span>
    <span class="ss-macro carb">🌾 ${meal.carbs}g carbs</span>
  `;
}

/* ─────────────────────────────────────────────
   7. AUTOCOMPLETE  (client-side UX)
───────────────────────────────────────────── */
function _initAutocomplete() {
  const input = document.getElementById('foodSearch');
  if (!input) return;

  // Build dropdown
  const dropdown = document.createElement('div');
  dropdown.id = 'foodDropdown';
  Object.assign(dropdown.style, {
    position:     'absolute', top: '100%', left: '0', right: '0',
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderTop:    'none',
    borderRadius: '0 0 12px 12px',
    boxShadow:    '0 8px 24px rgba(0,0,0,0.12)',
    zIndex:       '999',
    maxHeight:    '220px',
    overflowY:    'auto',
    display:      'none',
  });

  const wrap = input.closest('.search-wrap') || input.parentElement;
  wrap.style.position = 'relative';
  wrap.appendChild(dropdown);

  // Input handler
  input.addEventListener('input', () => {
    const q       = input.value.trim();
    const results = searchFoods(q, 6);
    dropdown.innerHTML = '';
    if (!results.length) { dropdown.style.display = 'none'; return; }

    results.forEach(food => {
      const item = document.createElement('div');
      Object.assign(item.style, {
        padding: '10px 14px', cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '13px', transition: 'background 0.15s',
      });
      item.innerHTML = `
        <span style="font-weight:600">${food.name}</span>
        <span style="color:var(--text3);font-size:11px">
          🔥 ${food.cal} · 💪 ${food.protein}g · 🌾 ${food.carbs}g
        </span>
      `;
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg2)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _fillFields(food);
        dropdown.style.display = 'none';
      });
      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  });

  input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) input.dispatchEvent(new Event('input')); });
}

/** Populate form fields from a FOOD_DB entry */
function _fillFields(food) {
  const set     = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('foodSearch',   food.name);
  set('mealCalories', food.cal);
  set('mealProtein',  food.protein);
  set('mealCarbs',    food.carbs);
  set('mealFats',     food.fats);
  setText('previewCal',   food.cal);
  setText('previewProt',  food.protein);
  setText('previewCarbs', food.carbs);
  setText('previewFats',  food.fats);
}

/* ─────────────────────────────────────────────
   7.5 SMART LOG EXTRACTION
───────────────────────────────────────────── */
function nutritionParseSmartMeal() {
  const input = document.getElementById('smartTextInput')?.value || '';
  if (!input.trim()) {
    if (typeof showToast === 'function') showToast('Please describe your meal first.', 'warn', 2500);
    return;
  }
  if (input.trim().length > 500) {
    if (typeof showToast === 'function') showToast('Input too long. Please keep it under 500 characters.', 'warn', 2500);
    return;
  }
  const parseBtn = document.getElementById('btnParseSmart');
  if (typeof setLoading === 'function' && parseBtn) setLoading(parseBtn, true, 'Parsing...');

  // 1. Natural Language Pre-processing
  let cleanInput = input.toLowerCase();
  const fillers = [
    /\bi\s+had\b/g, /\bi\s+ate\b/g, /\bi\s+drank\b/g, /\bwe\s+had\b/g, /\bwe\s+ate\b/g,
    /\bglass\s+of\b/g, /\bbowl\s+of\b/g, /\bcup\s+of\b/g, /\bplate\s+of\b/g, /\bpiece\s+of\b/g,
    /\bglasses\b/g, /\bbowls\b/g, /\bcups\b/g, /\bplates\b/g, /\bglass\b/g, /\bbowl\b/g, /\bcup\b/g, /\bplate\b/g, /\bpiece\b/g, /\bpieces\b/g,
    /\ba\b/g, /\ban\b/g, /\bthe\b/g, /\bwith\b/g, /\bsome\b/g
  ];
  fillers.forEach(rx => { cleanInput = cleanInput.replace(rx, ' '); });

  // 2. Tokenize
  const segments = cleanInput.split(/,|\band\b|&|\+/i).map(s => s.trim()).filter(Boolean);
  const parsedItems = [];
  
  let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFats = 0;

  segments.forEach(seg => {
    let qty = 1;
    let foodQuery = seg;
    
    // Check for numbers acting as multipliers (e.g. "2 rotis", "1.5 egg")
    const match = foodQuery.match(/(?:^|\s)([\d.]+)\s*(.*)/);
    if (match) {
      qty = parseFloat(match[1]) || 1;
      if (qty > 50) qty = 50; // cap absurd quantities
      foodQuery = match[2] || foodQuery.replace(match[1], '').trim();
    }
    
    // De-pluralize: fries -> fry, tomatoes -> tomato, eggs -> egg (but retain double-S like glass)
    foodQuery = foodQuery.trim()
                          .replace(/ies$/, 'y')
                          .replace(/oes$/, 'o')
                          .replace(/([^s])s$/, '$1'); 

    if (!foodQuery) return; // if it was just "2" with no food

    // 3. Fuzzy search 
    const result = searchFoods(foodQuery, 1)[0]; 
    if (result) {
      parsedItems.push({
        origQuery: seg,
        name: result.name,
        qty: qty,
        baseCal: result.cal,
        baseProt: result.protein,
        baseCarbs: result.carbs,
        baseFats: result.fats,
      });
    }
  });

  const previewArea = document.getElementById('smartPreviewArea');
  const previewList = document.getElementById('smartItemsList');

  // 4. Fallback if no matching DB entities found
  if (!parsedItems.length) {
    if (typeof showToast === 'function') {
      showToast('Food not recognized. Switching to Manual Entry.', 'warn', 3500);
    }
    previewArea.style.display = 'none';
    // Switch to manual mode for the user automatically
    if (typeof switchMealMode === 'function') {
        switchMealMode('manual');
    }
    if (typeof setLoading === 'function' && parseBtn) setLoading(parseBtn, false);
    return;
  }

  // 5. Render components breakdown as interactive inputs
  previewList.innerHTML = '';
  parsedItems.forEach(pi => {
      const div = document.createElement('div');
      div.dataset.name = pi.name;
      div.dataset.cal = pi.baseCal;
      div.dataset.prot = pi.baseProt;
      div.dataset.carbs = pi.baseCarbs;
      div.dataset.fats = pi.baseFats;
      div.style = 'display:flex; justify-content:space-between; align-items:center;';
      
      div.innerHTML = `
        <span style="font-weight: 500;">${pi.name} <small style="color:var(--text3); font-weight: normal;">(${pi.baseCal} kcal/pt)</small></span>
        <div style="display:flex; align-items:center; gap: 8px;">
          <input type="number" min="0" step="0.5" value="${pi.qty}" oninput="smartLogRecalculateTotals()" style="width: 55px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; text-align: center; background: var(--surface); color: var(--text);">
          <button style="background:transparent; color:var(--red); font-size:16px; border:none; cursor:pointer;" onclick="this.parentElement.parentElement.remove(); smartLogRecalculateTotals();">✕</button>
        </div>
      `;
      previewList.appendChild(div);
  });
  
  smartLogRecalculateTotals();
  previewArea.style.display = 'block';
  if (typeof setLoading === 'function' && parseBtn) setLoading(parseBtn, false);
  if (typeof showToast === 'function') showToast('Meals recognized! Review and confirm with Save.', 'success', 2500);
}

window.smartLogRecalculateTotals = function() {
  const list = document.getElementById('smartItemsList');
  let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFats = 0;
  
  if (list) {
    Array.from(list.children).forEach(row => {
      const qtyInput = row.querySelector('input[type="number"]');
      const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 0;
      if (qty <= 0) return;
      const baseCal = parseInt(row.dataset.cal) || 0;
      const baseProt = parseInt(row.dataset.prot) || 0;
      const baseCarbs = parseInt(row.dataset.carbs) || 0;
      const baseFats = parseInt(row.dataset.fats) || 0;
      
      totalCal += baseCal * qty;
      totalProt += baseProt * qty;
      totalCarbs += baseCarbs * qty;
      totalFats += baseFats * qty;
    });
  }

  const setElem = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(val); };
  setElem('smartPrevCal', totalCal);
  setElem('smartPrevProt', totalProt);
  setElem('smartPrevCarbs', totalCarbs);
  setElem('smartPrevFats', totalFats);
};

window.smartLogAddEmptyItem = function() {
  const q = prompt("Enter food name to add (e.g., 'Apple'):");
  if (!q) return;
  const result = searchFoods(q, 1)[0];
  if (!result) {
    if (typeof showToast === 'function') showToast('Food not found in database.', 'warn', 2500);
    return;
  }
  
  const previewList = document.getElementById('smartItemsList');
  if (!previewList) return;
  
  const div = document.createElement('div');
  div.dataset.name = result.name;
  div.dataset.cal = result.cal;
  div.dataset.prot = result.protein;
  div.dataset.carbs = result.carbs;
  div.dataset.fats = result.fats;
  div.style = 'display:flex; justify-content:space-between; align-items:center;';
  
  div.innerHTML = `
    <span style="font-weight: 500;">${result.name} <small style="color:var(--text3); font-weight: normal;">(${result.cal} kcal/pt)</small></span>
    <div style="display:flex; align-items:center; gap: 8px;">
      <input type="number" min="0" step="0.5" value="1" oninput="smartLogRecalculateTotals()" style="width: 55px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; text-align: center; background: var(--surface); color: var(--text);">
      <button style="background:transparent; color:var(--red); font-size:16px; border:none; cursor:pointer;" onclick="this.parentElement.parentElement.remove(); smartLogRecalculateTotals();">✕</button>
    </div>
  `;
  previewList.appendChild(div);
  smartLogRecalculateTotals();
  if (typeof showToast === 'function') showToast(result.name + ' added!', 'info', 2000);
};

/* ─────────────────────────────────────────────
   7.6 CAMERA SCAN EXTRACTION
───────────────────────────────────────────── */
let streamObj = null;

window.startNutritionCamera = async function() {
  const video = document.getElementById('cameraVideo');
  const status = document.getElementById('cameraStatusText');
  const resultsArea = document.getElementById('cameraResultsArea');
  
  if (resultsArea) resultsArea.style.display = 'none';

  try {
    if (status) status.textContent = 'Requesting camera...';
    // Use environment camera
    streamObj = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (video) {
      video.srcObject = streamObj;
      video.play();
    }
    if (status) status.style.display = 'none';
  } catch (err) {
    if (status) status.textContent = 'Camera not available. Please use Smart Log.';
  }
};

window.stopNutritionCamera = function() {
  if (streamObj) {
    streamObj.getTracks().forEach(t => t.stop());
    streamObj = null;
  }
  const video = document.getElementById('cameraVideo');
  if (video) video.srcObject = null;
};

window.captureAndAnalyzeFood = function() {
  const overlay = document.getElementById('cameraScanningOverlay');
  const resultsArea = document.getElementById('cameraResultsArea');
  const itemsList = document.getElementById('cameraItemsList');
  
  if (!overlay || !resultsArea || !itemsList) {
    if (typeof showToast === 'function') showToast('Camera UI not ready. Try again.', 'warn', 2500);
    return;
  }
  if (!streamObj) {
    if (typeof showToast === 'function') showToast('Camera not active. Please allow camera access.', 'warn', 2500);
    return;
  }

  // Visual simulation of analysis
  const captureBtn = document.getElementById('btnCaptureAnalyze');
  if (typeof setLoading === 'function' && captureBtn) setLoading(captureBtn, true, 'Analyzing...');
  overlay.style.display = 'flex';
  
  setTimeout(() => {
    overlay.style.display = 'none';
    
    // Fake ML Detection matching our DB
    const mockDetections = ['White Rice', 'Dal'];
    const matchedObjects = mockDetections.map(name => searchFoods(name, 1)[0]).filter(Boolean);

    if (!matchedObjects.length) {
      if (typeof showToast === 'function') showToast('No food detected.', 'warn', 2500);
      return;
    }

    itemsList.innerHTML = '';
    matchedObjects.forEach(f => {
      const div = document.createElement('div');
      div.dataset.name = f.name;
      div.dataset.cal = f.cal;
      div.dataset.prot = f.protein;
      div.dataset.carbs = f.carbs;
      div.dataset.fats = f.fats;
      div.style = 'display:flex; justify-content:space-between; align-items:center;';
      
      div.innerHTML = `
        <span style="font-weight: 500;">${f.name} <small style="color:var(--text3); font-weight: normal;">(${f.cal} kcal/pt)</small></span>
        <input type="number" min="0" step="0.5" value="1" style="width: 55px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; text-align: center; background: var(--surface); color: var(--text);">
      `;
      itemsList.appendChild(div);
    });

    resultsArea.style.display = 'block';
    if (typeof showToast === 'function') showToast('Food detected! Adjust quantities and save.', 'success', 2500);
  }, 2000);
  setTimeout(() => { if (typeof setLoading === 'function' && captureBtn) setLoading(captureBtn, false); }, 2000);
};

/* ─────────────────────────────────────────────
   8. INIT
───────────────────────────────────────────── */
function _nutritionInit() {
  _initAutocomplete();
  // Give Chart.js (loaded async) time to initialise before first render
  setTimeout(updateNutritionUI, 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _nutritionInit);
} else {
  setTimeout(_nutritionInit, 0);
}

