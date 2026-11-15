/* ============================================================
   H²OS — Human Health Operating System
   Main Application Script
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. CHART.JS — Load from CDN dynamically
// ─────────────────────────────────────────────
(function loadChartJS() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  script.onload = () => {
    initCharts();
    // Once macroDonut exists, let the nutrition engine sync everything
    if (typeof updateNutritionUI === 'function') updateNutritionUI();
  };
  document.head.appendChild(script);
})();

// ─────────────────────────────────────────────
// 2. GLOBAL STATE SYNCHRONIZATION
// ─────────────────────────────────────────────
window.syncGlobalState = async function() {
  if (typeof updateHealthScoreUI === 'function') await updateHealthScoreUI();
  if (typeof syncDashboard === 'function') await syncDashboard();
};

// ─────────────────────────────────────────────
// 3. NAVIGATION
// ─────────────────────────────────────────────
const pages = ['dashboard', 'nutrition', 'habits', 'fitness', 'insights', 'profile'];

function switchPage(pageName) {
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add('active');

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  // Scroll to top
  document.querySelector('.main-content').scrollTop = 0;
  window.scrollTo(0, 0);

  // Page-specific data refresh
  if (pageName === 'habits'    && typeof loadHabitsPage    === 'function') loadHabitsPage();
  if (pageName === 'nutrition' && typeof updateNutritionUI === 'function') updateNutritionUI();
  if (pageName === 'fitness'   && typeof loadFitnessPage   === 'function') loadFitnessPage();
  if (pageName === 'insights'  && typeof loadInsightsPage  === 'function') loadInsightsPage();
}

// Attach nav listeners
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(el.dataset.page);
  });
});

// ─────────────────────────────────────────────
// 3. GREETING & DATE
// ─────────────────────────────────────────────
(function setGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';
  const greetEl = document.getElementById('greeting-text');
  if (greetEl) greetEl.textContent = greeting;

  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', opts);
  }
})();

// ─────────────────────────────────────────────
// 4. HEALTH SCORE ANIMATION & RING (Canvas)
// ─────────────────────────────────────────────
let _healthRingParams = { startAngle: -Math.PI / 2, currentScore: 0, currentAngle: -Math.PI / 2 };

window.updateHealthScoreUI = async function() {
  const numEl = document.getElementById('healthScoreNum');
  const barEl = document.getElementById('healthBar');
  const canvas = document.getElementById('healthRingCanvas');
  
  if (typeof API === 'undefined') return;

  try {
    const res = await API.getHealthScore();
    const targetScore = res?.score ?? AppState?.healthScore ?? 65;

    // 1. Text & Bar Animation
    if (numEl && barEl) {
      let currentVal = parseInt(numEl.textContent) || 0;
      const duration = 1400;
      const step = Math.sign(targetScore - currentVal) * Math.abs(targetScore - currentVal) / (duration / 16);
      
      function tickText() {
        if (Math.abs(currentVal - targetScore) <= Math.abs(step)) {
          currentVal = targetScore;
        } else {
          currentVal += step;
        }
        numEl.textContent = Math.round(currentVal);
        barEl.style.width = (currentVal / 100 * 100) + '%';
        
        if (currentVal !== targetScore) requestAnimationFrame(tickText);
      }
      setTimeout(tickText, 50);
    }

    // 2. Ring Animation
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const cx = 80, cy = 80, radius = 60;
      const endTarget = _healthRingParams.startAngle + (2 * Math.PI * targetScore / 100);
      
      function drawFrame() {
        ctx.clearRect(0, 0, 160, 160);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, _healthRingParams.startAngle, _healthRingParams.currentAngle);
        const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        grad.addColorStop(0, '#4ade80');
        grad.addColorStop(1, '#a7f3d0');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SCORE', cx, cy + 14);

        if (Math.abs(_healthRingParams.currentAngle - endTarget) > 0.05) {
          const dir = Math.sign(endTarget - _healthRingParams.currentAngle);
          _healthRingParams.currentAngle += dir * 0.04;
          requestAnimationFrame(drawFrame);
        } else {
          _healthRingParams.currentAngle = endTarget;
        }
      }
      setTimeout(drawFrame, 50);
    }
  } catch(err) {
    console.warn('[HealthScore] Update failed:', err);
  }
};

// Initialize on load
updateHealthScoreUI();

// ─────────────────────────────────────────────
// 6. CHART.JS CHARTS
// ─────────────────────────────────────────────
let weeklyChart, macroDonut, bodyMetricsChart, sleepChart;

const chartData = {
  calories: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [0, 0, 0, 0, 0, 0, 0],
    color: '#f97316',
  },
  steps: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [0, 0, 0, 0, 0, 0, 0],
    color: '#22c55e',
  },
  sleep: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [0, 0, 0, 0, 0, 0, 0],
    color: '#6366f1',
  },
};

function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

function getChartDefaults() {
  return {
    gridColor: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    textColor: isDark() ? '#8b949e' : '#9aa3b0',
    surfaceColor: isDark() ? '#1c2230' : '#ffffff',
  };
}

function initCharts() {
  const { gridColor, textColor } = getChartDefaults();

  // ── Weekly Chart (Bar + Line)
  const wCtx = document.getElementById('weeklyChart');
  if (wCtx) {
    weeklyChart = new Chart(wCtx, {
      type: 'bar',
      data: {
        labels: chartData.calories.labels,
        datasets: [{
          data: chartData.calories.data,
          backgroundColor: chartData.calories.data.map((v, i) =>
            i === 6 ? '#f97316' : 'rgba(249,115,22,0.25)'
          ),
          borderColor: '#f97316',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()} kcal` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, weight: '600' } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        },
      },
    });
  }

  // Chart tab switching
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const metric = tab.dataset.metric;
      const d = chartData[metric];
      if (weeklyChart) {
        weeklyChart.data.labels = d.labels;
        weeklyChart.data.datasets[0].data = d.data;
        weeklyChart.data.datasets[0].backgroundColor = d.data.map((v, i) =>
          i === 6 ? d.color : hexAlpha(d.color, 0.25)
        );
        weeklyChart.data.datasets[0].borderColor = d.color;
        weeklyChart.update();
      }
    });
  });

  // ── Macro Donut
  const mCtx = document.getElementById('macroDonut');
  if (mCtx) {
    macroDonut = new Chart(mCtx, {
      type: 'doughnut',
      data: {
        labels: ['Carbs', 'Protein', 'Fats'],
        datasets: [{
          data: [840, 272, 522],
          backgroundColor: ['#f97316', '#ef4444', '#eab308'],
          borderColor: isDark() ? '#1c2230' : '#ffffff',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: false, cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} kcal` } } },
      },
    });
    // Expose globally so nutrition.js can update the donut after meal changes
    window.macroDonut = macroDonut;
  }

  // ── Body Metrics Chart
  const bmCtx = document.getElementById('bodyMetricsChart');
  if (bmCtx) {
    bodyMetricsChart = new Chart(bmCtx, {
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Weight (kg)',
            data: [76.2, 75.8, 75.1, 74.4],
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.08)',
            tension: 0.4, fill: true,
            pointBackgroundColor: '#22c55e', pointRadius: 5,
          },
          {
            label: 'Body Fat (%)',
            data: [18.2, 17.9, 17.5, 17.1],
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
            tension: 0.4, fill: true,
            pointBackgroundColor: '#f97316', pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } },
          },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        },
      },
    });
  }

  // ── Sleep Chart
  const sCtx = document.getElementById('sleepChart');
  if (sCtx) {
    sleepChart = new Chart(sCtx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Deep Sleep',
            data: [2.2, 1.8, 2.5, 2.0, 1.5, 2.3, 2.1],
            backgroundColor: '#6366f1',
            borderRadius: 4, borderSkipped: false,
          },
          {
            label: 'Light Sleep',
            data: [3.8, 3.2, 4.2, 3.5, 3.2, 3.9, 3.7],
            backgroundColor: 'rgba(99,102,241,0.35)',
            borderRadius: 4, borderSkipped: false,
          },
          {
            label: 'REM',
            data: [1.5, 1.8, 1.3, 1.7, 1.8, 1.6, 1.53],
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderRadius: 4, borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => v + 'h' } },
        },
      },
    });
  }
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Period toggle (insights)
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─────────────────────────────────────────────
// 7. HABITS MODULE  — habits · water · sleep
// ─────────────────────────────────────────────

/* ── Shared renderer: update all habit UI from API response ── */
function _renderHabitsResponse(res) {
  if (!res) return;

  // Progress label
  const label = document.getElementById('habitProgressLabel');
  if (label && res.completedCount != null) {
    label.textContent = `${res.completedCount} / ${res.total} done`;
  }

  // Water tracker
  if (res.water) _renderWater(res.water);

  // Sleep tracker (on Habits page)
  if (res.sleep) _renderSleep(res.sleep);

  // Streak banner
  if (res.streakLeader) {
    const streakNum = document.querySelector('.streak-num');
    if (streakNum) streakNum.textContent = `${res.streakLeader.streak} Day Streak`;
  }
}

function _renderWater(water) {
  const w = water || {};
  const logged = w.logged || 0;
  const percent = w.percent || 0;
  const goal = w.goal || 2.5;
  const remaining = w.remaining || 0;

  // Updates water tracker elements — only exist on the Habits page
  const valEl = document.getElementById('waterLoggedVal');
  const barEl = document.getElementById('waterBarFill');
  const pctEl = document.getElementById('waterPctLabel');
  const remEl = document.getElementById('waterRemainingLabel');

  if (valEl) valEl.textContent = logged.toFixed(1);
  if (barEl) barEl.style.width = `${percent}%`;
  if (pctEl) pctEl.textContent = `${percent}% of ${goal}L`;
  if (remEl) {
    remEl.textContent = remaining > 0
      ? `${remaining.toFixed(1)}L remaining`
      : '✅ Daily goal reached!';
  }

  // Also update dashboard water card
  const dashVal  = document.getElementById('dashWaterVal');
  const dashBar  = document.getElementById('dashWaterBar');
  const dashMeta = document.getElementById('dashWaterMeta');
  if (dashVal)  dashVal.textContent  = `${logged.toFixed(1)}L`;
  if (dashBar)  dashBar.style.width  = `${percent}%`;
  if (dashMeta) dashMeta.textContent = `${percent}% of ${goal}L goal`;
}

function _renderSleep(sleep) {
  const s = sleep || {};
  const hours = s.hours || 0;
  const label = s.label || 'No data';
  const percent = s.percent || 0;

  // Updates sleep tracker elements — only exist on the Habits page
  const valEl    = document.getElementById('sleepLoggedVal');
  const labelEl  = document.getElementById('sleepLabelBadge');
  const sliderEl = document.getElementById('sleepSlider');

  if (valEl)    valEl.textContent   = hours;
  if (labelEl)  labelEl.textContent = label;
  if (sliderEl) sliderEl.value      = hours;

  // Also update dashboard sleep card
  const dashVal  = document.getElementById('dashSleepVal');
  const dashBar  = document.getElementById('dashSleepBar');
  const dashMeta = document.getElementById('dashSleepMeta');
  if (dashVal)  dashVal.textContent  = hours > 0 ? `${hours}h` : '—';
  if (dashBar)  dashBar.style.width  = `${percent}%`;
  if (dashMeta) dashMeta.textContent = label;
}

/* ── Load habits page from API ── */
async function loadHabitsPage() {
  if (typeof API === 'undefined') return;
  try {
    const res = await API.getHabits();
    _renderHabitsResponse(res);
  } catch (err) {
    console.warn('[Habits] Load failed:', err);
    showToast('Could not load habits. Check backend connection.', 'warn', 3000);
  }
}


/* ── Toggle habit ── */
let _lastHabitToggle = 0;
function toggleHabit(checkEl) {
  // Debounce: ignore rapid clicks within 500ms
  const now = Date.now();
  if (now - _lastHabitToggle < 500) return;
  _lastHabitToggle = now;

  const item = checkEl.closest('.habit-item');
  if (!item) return;

  const habitId = parseInt(item.dataset.habit ?? '-1');
  if (isNaN(habitId) || habitId < 0) return; // guard invalid ids
  const isDone  = item.classList.toggle('done');

  // Immediate visual feedback
  if (isDone) {
    checkEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    item.style.transform = 'scale(1.02) translateX(3px)';
    setTimeout(() => { item.style.transform = ''; }, 300);
  } else {
    checkEl.innerHTML = '';
  }

  if (typeof API !== 'undefined' && habitId >= 0) {
    API.updateHabit(habitId, isDone).then(async res => {
      _renderHabitsResponse(res);
      await window.syncGlobalState();
    }).catch(err => {

      const doneNow  = document.querySelectorAll('.habit-item.done').length;
      const totalNow = document.querySelectorAll('.habit-item').length;
      const label    = document.getElementById('habitProgressLabel');
      if (label) label.textContent = `${doneNow} / ${totalNow} done`;
    });
  } else {
    const doneNow  = document.querySelectorAll('.habit-item.done').length;
    const totalNow = document.querySelectorAll('.habit-item').length;
    const label    = document.getElementById('habitProgressLabel');
    if (label) label.textContent = `${doneNow} / ${totalNow} done`;
  }
}

/* ── Water tracking ── */
async function logWaterAmount(litres, triggerBtn = null) {
  if (typeof API === 'undefined') return;
  if (triggerBtn) setLoading(triggerBtn, true, 'Logging...');
  try {
    const res = await API.logWater({ amount: litres });
    if (res?.water) _renderWater(res.water);
    showToast(`💧 +${(litres * 1000)}ml logged!`, 'success', 2000);
    await window.syncGlobalState();
  } catch (err) {
    showToast('Could not log water — check backend', 'warn');
  } finally {
    if (triggerBtn) setLoading(triggerBtn, false);
  }
}

async function logWaterCustom() {
  const input = document.getElementById('waterCustomInput');
  const val   = parseFloat(input?.value);
  if (!val || val <= 0 || val > 5) {
    showToast('Enter a valid amount between 0.1 and 5L', 'warn', 2000);
    return;
  }
  const btn = document.querySelector('button[onclick="logWaterCustom()"]');
  await logWaterAmount(val, btn);
  if (input) input.value = '';
}

/* ── Sleep tracking ── */
let _pendingSleepHours = 0;

function updateSleepPreview(hours) {
  _pendingSleepHours = parseFloat(hours) || 0;
  const valEl = document.getElementById('sleepLoggedVal');
  if (valEl) valEl.textContent = _pendingSleepHours;

  // Highlight closest quick button
  [6, 7, 8, 9].forEach(h => {
    const btn = document.getElementById(`btn-sleep-${h}`);
    if (btn) btn.classList.toggle('active', h === _pendingSleepHours);
  });
}

function setSleepHours(hours) {
  _pendingSleepHours = hours;
  const slider = document.getElementById('sleepSlider');
  if (slider) slider.value = hours;
  updateSleepPreview(hours);
}

async function saveSleepLog() {
  if (_pendingSleepHours <= 0) {
    showToast('Set sleep hours first using the slider or quick buttons', 'warn', 2500);
    return;
  }
  if (typeof API === 'undefined') return;
  const btn = document.querySelector('button[onclick="saveSleepLog()"]');
  if (btn) setLoading(btn, true, 'Saving...');
  try {
    const res = await API.logSleep({ hours: _pendingSleepHours });
    if (res?.sleep) _renderSleep(res.sleep);
    showToast(`😴 ${_pendingSleepHours}h sleep logged!`, 'success', 2500);
    await window.syncGlobalState();
  } catch (err) {
    showToast('Could not log sleep — check backend', 'warn');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ─────────────────────────────────────────────
// 8. MODAL LOGIC
// ─────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Trigger buttons
const addMealBtn = document.getElementById('btn-add-meal');
if (addMealBtn) addMealBtn.addEventListener('click', () => openModal('addMealModal'));

const addMealMainBtn = document.getElementById('btn-add-meal-main');
if (addMealMainBtn) addMealMainBtn.addEventListener('click', () => openModal('addMealModal'));

const addMealCard = document.getElementById('addMealCard');
if (addMealCard) addMealCard.addEventListener('click', () => openModal('addMealModal'));

// Meal type selection in modal
document.querySelectorAll('.mts-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mts-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─────────────────────────────────────────────
// 9. START WORKOUT BUTTON
// ─────────────────────────────────────────────
const startWorkoutBtn = document.getElementById('startWorkoutBtn');
if (startWorkoutBtn) {
  let started = false;
  let elapsed = 0;
  let timer = null;

  startWorkoutBtn.addEventListener('click', () => {
    if (!started) {
      started = true;
      startWorkoutBtn.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      startWorkoutBtn.style.boxShadow = '0 4px 16px rgba(239,68,68,0.35)';
      timer = setInterval(() => {
        elapsed++;
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        startWorkoutBtn.textContent = `⏸ ${min}:${sec}`;
      }, 1000);
    } else {
      started = false;
      clearInterval(timer);
      elapsed = 0;
      startWorkoutBtn.textContent = '▶ Start Workout';
      startWorkoutBtn.style.background = '';
      startWorkoutBtn.style.boxShadow = '';
    }
  });
}

// ─────────────────────────────────────────────
// 10. DARK MODE
// ─────────────────────────────────────────────
function toggleDarkMode(checkbox) {
  const isDark = checkbox.checked;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('h2os-theme', isDark ? 'dark' : 'light');

  // Rebuild charts for new colors
  if (typeof Chart !== 'undefined') {
    [weeklyChart, macroDonut, bodyMetricsChart, sleepChart].forEach(chart => {
      if (!chart) return;
      const { gridColor, textColor, surfaceColor } = getChartDefaults();
      chart.options.scales && Object.values(chart.options.scales).forEach(axis => {
        if (axis.grid) axis.grid.color = gridColor;
        if (axis.ticks) axis.ticks.color = textColor;
      });
      if (chart.data.datasets[0] && chart.data.datasets[0].borderColor === '#ffffff') {
        chart.data.datasets[0].borderColor = surfaceColor;
      }
      chart.update();
    });
  }
}

// Init theme from storage
(function initTheme() {
  const saved = localStorage.getItem('h2os-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const toggle = document.getElementById('toggle-dark');
    if (toggle) toggle.checked = true;
  }
})();

// ─────────────────────────────────────────────
// 11. SUMMARY CARD ANIMATIONS (Intersection Observer)
// ─────────────────────────────────────────────
(function animateSummaryCards() {
  const cards = document.querySelectorAll('.summary-card, .insight-stat-card, .exercise-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(12px)';
    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    observer.observe(card);
  });
})();

// ─────────────────────────────────────────────
// 12. KEYBOARD NAVIGATION
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ─────────────────────────────────────────────
// 13. LOADING STATE UTILITIES
// ─────────────────────────────────────────────

/**
 * Disable/enable a button with a loading label during async calls.
 * @param {HTMLElement|string} btn   - Button element or its id
 * @param {boolean}            on    - true = loading, false = restore
 * @param {string}             label - Original label to restore when done
 */
function setLoading(btn, on, label = '') {
  const el = typeof btn === 'string' ? document.getElementById(btn) : btn;
  if (!el) return;
  if (on) {
    el.disabled = true;
    el._originalLabel = el.innerHTML;
    el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">
      <span style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>
      ${label || 'Loading...'}
    </span>`;
  } else {
    el.disabled = false;
    el.innerHTML = el._originalLabel || label;
  }
}

function showToast(message, type = 'info', duration = 3000) {
  // Create toast if not exists
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position:fixed; bottom:90px; right:20px; z-index:9999;
      display:flex; flex-direction:column; gap:10px; pointer-events:none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = { info: '#3b82f6', success: '#22c55e', warn: '#eab308', error: '#ef4444' };
  toast.style.cssText = `
    background: var(--surface);
    border-left: 4px solid ${colors[type] || colors.info};
    border-radius: 10px;
    padding: 12px 18px;
    font-size: 13px; font-weight: 500;
    color: var(--text);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    opacity:0; transform:translateX(20px);
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    pointer-events:all;
    min-width:220px; max-width:300px;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

const notifBtn = document.getElementById('notifBtn');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    showToast('3 active health alerts need attention', 'warn');
  });
}

// Dummy edit/logout handlers
const editProfileBtn = document.getElementById('btn-edit-profile');
if (editProfileBtn) editProfileBtn.addEventListener('click', () => showToast('Profile editing coming soon!', 'info'));

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', () => showToast('Signing out...', 'info'));

// ─────────────────────────────────────────────
// 14. BOTTOM NAV — active on mobile
// ─────────────────────────────────────────────
// Already handled by switchPage — unified

// ─────────────────────────────────────────────
// 15. RIPPLE EFFECT on buttons
// ─────────────────────────────────────────────
function createRipple(event) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.cssText = `
    position:absolute; width:${size}px; height:${size}px;
    left:${x}px; top:${y}px;
    background:rgba(255,255,255,0.25);
    border-radius:50%; transform:scale(0);
    animation:rippleAnim 0.55s linear;
    pointer-events:none;
  `;

  if (!button.style.position || button.style.position === 'static') {
    button.style.position = 'relative';
  }
  button.style.overflow = 'hidden';
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// Inject ripple CSS
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
  @keyframes rippleAnim {
    to { transform: scale(2.5); opacity: 0; }
  }
`;
document.head.appendChild(rippleStyle);

document.querySelectorAll('.primary-btn, .start-workout-btn, .quick-action-btn').forEach(btn => {
  btn.addEventListener('click', createRipple);
});

// ─────────────────────────────────────────────
// 16. ALERT DISMISS
// ─────────────────────────────────────────────
document.querySelector('.section-header .text-btn')?.addEventListener('click', function () {
  const alerts = document.querySelectorAll('.alert-item');
  alerts.forEach((alert, i) => {
    setTimeout(() => {
      alert.style.transition = 'all 0.3s ease';
      alert.style.opacity = '0';
      alert.style.transform = 'translateX(-20px)';
      setTimeout(() => alert.remove(), 300);
    }, i * 80);
  });
  showToast('All alerts dismissed', 'success', 2000);
});

// ─────────────────────────────────────────────
// 17. NUTRITION MODULE — Meal Modal Logic
// ─────────────────────────────────────────────

/** Switch between Manual Entry, Quick Pick, Smart Log, and Camera modes */
function switchMealMode(mode) {
  const panelManual = document.getElementById('panelManual');
  const panelQuick = document.getElementById('panelQuick');
  const panelSmart = document.getElementById('panelSmart');
  const panelCamera = document.getElementById('panelCamera');
  
  const tabManual = document.getElementById('modeManual');
  const tabQuick = document.getElementById('modeQuick');
  const tabSmart = document.getElementById('modeSmart');
  const tabCamera = document.getElementById('modeCamera');

  // Hide all
  if (panelManual) panelManual.style.display = 'none';
  if (panelQuick) panelQuick.style.display = 'none';
  if (panelSmart) panelSmart.style.display = 'none';
  if (panelCamera) panelCamera.style.display = 'none';
  
  if (tabManual) tabManual.classList.remove('active');
  if (tabQuick) tabQuick.classList.remove('active');
  if (tabSmart) tabSmart.classList.remove('active');
  if (tabCamera) tabCamera.classList.remove('active');

  // Kill camera stream if navigating away from camera tab
  if (mode !== 'camera' && typeof window.stopNutritionCamera === 'function') {
    window.stopNutritionCamera();
  }

  // Show active
  if (mode === 'manual') {
    if (panelManual) panelManual.style.display = 'block';
    if (tabManual) tabManual.classList.add('active');
  } else if (mode === 'quick') {
    if (panelQuick) panelQuick.style.display = 'block';
    if (tabQuick) tabQuick.classList.add('active');
  } else if (mode === 'smart') {
    if (panelSmart) panelSmart.style.display = 'block';
    if (tabSmart) tabSmart.classList.add('active');
  } else if (mode === 'camera') {
    if (panelCamera) panelCamera.style.display = 'block';
    if (tabCamera) tabCamera.classList.add('active');
    if (typeof window.startNutritionCamera === 'function') {
      window.startNutritionCamera();
    }
  }
}

/** Live macro preview — update as user types */
(function initLivePreview() {
  const fields = ['mealCalories', 'mealProtein', 'mealCarbs', 'mealFats'];
  const previews = ['previewCal', 'previewProt', 'previewCarbs', 'previewFats'];

  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = el.value.trim();
      const previewEl = document.getElementById(previews[i]);
      if (previewEl) previewEl.textContent = val ? val : '—';
    });
  });
})();

/** Quick Pick food selection */
let selectedQuickFood = null;

function selectQuickFood(el) {
  // Deselect all
  document.querySelectorAll('.qp-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');

  selectedQuickFood = {
    name: el.querySelector('.qp-name')?.textContent || 'Food',
    cal: parseInt(el.dataset.cal) || 0,
    prot: parseInt(el.dataset.prot) || 0,
    carbs: parseInt(el.dataset.carbs) || 0,
    fats: parseInt(el.dataset.fats) || 0,
  };

  // Show preview
  const preview = document.getElementById('qpSelectedPreview');
  const macrosEl = document.getElementById('qpSelectedMacros');
  if (preview && macrosEl) {
    macrosEl.innerHTML = `
      <span class="qpsp-macro cal">🔥 ${selectedQuickFood.cal} kcal</span>
      <span class="qpsp-macro prot">💪 ${selectedQuickFood.prot}g protein</span>
      <span class="qpsp-macro carb">🌾 ${selectedQuickFood.carbs}g carbs</span>
      <span class="qpsp-macro fat">🥑 ${selectedQuickFood.fats}g fats</span>
    `;
    preview.style.display = 'block';
  }
}

/** Determine active meal type label */
function getActiveMealType() {
  const activeBtn = document.querySelector('#mealTypeSelector .mts-btn.active');
  return activeBtn ? activeBtn.dataset.type || activeBtn.textContent.trim() : 'Meal';
}

/** Meal type emoji map */
const mealEmojis = {
  Breakfast: '🌅', Lunch: '☀️', Dinner: '🌆', Snack: '🍎'
};

/** Save Meal — appends a new card to the meal log */
function saveMealEntry() {
 try {
  const isManual = document.getElementById('panelManual')?.style.display !== 'none';
  const isSmart = document.getElementById('panelSmart')?.style.display === 'block';
  const isCamera = document.getElementById('panelCamera')?.style.display === 'block';
  let name = '', cal = 0, prot = 0, carbs = 0, fats = 0;
  const mealType = getActiveMealType();

  if (isCamera) {
    const list = document.getElementById('cameraItemsList');
    if (!list || !list.children.length) {
      showToast('Please capture and extract food first.', 'warn', 2500);
      return;
    }
    let totalName = [];
    Array.from(list.children).forEach(row => {
      const qtyInput = row.querySelector('input[type="number"]');
      const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 0;
      if (qty <= 0) return;
      const baseName = row.dataset.name;
      const baseCal = parseInt(row.dataset.cal) || 0;
      const baseProt = parseInt(row.dataset.prot) || 0;
      const baseCarbs = parseInt(row.dataset.carbs) || 0;
      const baseFats = parseInt(row.dataset.fats) || 0;
      
      totalName.push(`${qty}x ${baseName}`);
      cal += baseCal * qty;
      prot += baseProt * qty;
      carbs += baseCarbs * qty;
      fats += baseFats * qty;
    });
    if (!totalName.length) {
      showToast('Please set a quantity > 0 for at least one item.', 'warn', 2500);
      return;
    }
    name = totalName.join(' + ');
  } else if (isSmart) {
    const list = document.getElementById('smartItemsList');
    if (!list || !list.children.length) {
      showToast('Please press Parse Text first.', 'warn', 2500);
      return;
    }
    let totalName = [];
    Array.from(list.children).forEach(row => {
      // Check if it's an un-mapped text entry or a mapped DB object
      if (row.dataset.name) {
        const qtyInput = row.querySelector('input[type="number"]');
        const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 0;
        if (qty <= 0) return;
        const baseName = row.dataset.name;
        const baseCal = parseInt(row.dataset.cal) || 0;
        const baseProt = parseInt(row.dataset.prot) || 0;
        const baseCarbs = parseInt(row.dataset.carbs) || 0;
        const baseFats = parseInt(row.dataset.fats) || 0;
        
        totalName.push(`${qty}x ${baseName}`);
        cal += baseCal * qty;
        prot += baseProt * qty;
        carbs += baseCarbs * qty;
        fats += baseFats * qty;
      }
    });
    if (!totalName.length) {
      showToast('Please ensure you have valid detected items.', 'warn', 2500);
      return;
    }
    name = totalName.join(' + ');
  } else if (isManual) {
    name = document.getElementById('foodSearch')?.value?.trim() || 'Custom Meal';
    cal = parseInt(document.getElementById('mealCalories')?.value) || 0;
    prot = parseInt(document.getElementById('mealProtein')?.value) || 0;
    carbs = parseInt(document.getElementById('mealCarbs')?.value) || 0;
    fats = parseInt(document.getElementById('mealFats')?.value) || 0;

    // Enhanced validation for manual entry
    if (isManual) {
      if (!name || name.trim() === '') {
        showToast('Food name is required', 'error', 3000);
        return;
      }
      if (name.length > 100) {
        showToast('Food name cannot exceed 100 characters', 'error', 3000);
        return;
      }
      if (cal <= 0) {
        showToast('Calories must be greater than 0', 'error', 3000);
        return;
      }
      if (cal > 10000) {
        showToast('Calories cannot exceed 10,000 for a single meal', 'error', 3000);
        return;
      }
      if (prot < 0 || prot > 1000) {
        showToast('Protein must be between 0 and 1000g', 'error', 3000);
        return;
      }
      if (carbs < 0 || carbs > 5000) {
        showToast('Carbs must be between 0 and 5000g', 'error', 3000);
        return;
      }
      if (fats < 0 || fats > 2000) {
        showToast('Fats must be between 0 and 2000g', 'error', 3000);
        return;
      }
    }
  } else {
    if (!selectedQuickFood) {
      showToast('Please select a food from the grid first.', 'warn', 2500);
      return;
    }
    name = selectedQuickFood.name;
    cal = selectedQuickFood.cal;
    prot = selectedQuickFood.prot;
    carbs = selectedQuickFood.carbs;
    fats = selectedQuickFood.fats;
  }

  // Cap absurd values to prevent data corruption
  cal = Math.min(Math.round(cal), 25000);
  prot = Math.min(Math.round(prot), 2000);
  carbs = Math.min(Math.round(carbs), 5000);
  fats = Math.min(Math.round(fats), 2000);
  if (cal <= 0) {
    showToast('Meal has 0 calories. Please check quantities.', 'warn', 2500);
    return;
  }

  // Build meal card HTML
  const emoji = mealEmojis[mealType] || '🍽️';
  const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const mealId = Date.now();

  const card = document.createElement('div');
  card.className = 'meal-card';
  card.dataset.mealId = mealId;
  card.style.opacity = '0';
  card.style.transform = 'translateY(12px)';
  card.innerHTML = `
    <div class="meal-card-header">
      <div class="meal-time-badge">${emoji} ${mealType} · ${timeNow}</div>
      <button class="meal-delete-btn" onclick="deleteMealCard(this)" title="Remove meal">✕</button>
    </div>
    <div class="meal-items">
      <div class="meal-item">
        <span class="meal-item-name">${name}</span>
        <div class="meal-item-macros">
          <span class="mim-cal">${cal} kcal</span>
          ${prot ? `<span class="mim-chip prot">${prot}g P</span>` : ''}
          ${carbs ? `<span class="mim-chip carb">${carbs}g C</span>` : ''}
        </div>
      </div>
    </div>
    <div class="meal-footer">
      <div class="meal-foot-macros">
        <span class="mfm-item">🔥 ${cal} kcal</span>
        ${prot ? `<span class="mfm-item">💪 ${prot}g</span>` : ''}
        ${carbs ? `<span class="mfm-item">🌾 ${carbs}g</span>` : ''}
        ${fats ? `<span class="mfm-item">🥑 ${fats}g</span>` : ''}
      </div>
    </div>
  `;

  // Insert before the "add card" placeholder
  const list = document.getElementById('mealLogList');
  const addCard = document.getElementById('addMealCard');
  if (list && addCard) list.insertBefore(card, addCard);

  // Animate in
  requestAnimationFrame(() => {
    card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  // ── Nutrition Engine: push meal into state → recalculate score & recs
  const saveBtn = document.getElementById('saveMealBtn');
  if (saveBtn) setLoading(saveBtn, true, 'Saving...');
  
  resetMealModal();
  closeModal('addMealModal');
  showToast(`✅ ${name} logged successfully!`, 'success', 2500);

  if (typeof nutritionAddMeal === 'function') {
    nutritionAddMeal({ name, cal, protein: prot, carbs, fats, fiber: 0 }).finally(() => {
      if (saveBtn) setLoading(saveBtn, false);
    });
  } else {
    if (saveBtn) setLoading(saveBtn, false);
  }

 } catch (err) {
    const saveBtn = document.getElementById('saveMealBtn');
    if (saveBtn) setLoading(saveBtn, false);
    if (typeof showToast === 'function') showToast('Something went wrong saving your meal. Please try again.', 'warn', 3000);
 }
}

/** Delete meal card with animation */
function deleteMealCard(btn) {
  // Delegate fully to nutrition engine (handles animation + state + score update)
  if (typeof nutritionRemoveMeal === 'function') {
    nutritionRemoveMeal(btn);
  } else {
    // Fallback if engine not loaded yet
    const card = btn.closest('.meal-card');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';
      card.style.transition = 'all 0.28s ease';
      setTimeout(() => card.remove(), 310);
    }
    showToast('Meal removed', 'info', 1800);
  }
}

/** Reset meal modal inputs */
function resetMealModal() {
  // Reset fields
  ['foodSearch', 'mealCalories', 'mealProtein', 'mealCarbs', 'mealFats', 'smartTextInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Reset live preview
  ['previewCal', 'previewProt', 'previewCarbs', 'previewFats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  // Reset quick pick
  document.querySelectorAll('.qp-item').forEach(i => i.classList.remove('selected'));
  selectedQuickFood = null;
  const preview = document.getElementById('qpSelectedPreview');
  if (preview) preview.style.display = 'none';
  // Reset to manual mode
  switchMealMode('manual');
  // Reset meal type to Breakfast
  document.querySelectorAll('#mealTypeSelector .mts-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
}

// ─────────────────────────────────────────────
// DEMO RESET
// ─────────────────────────────────────────────
async function demoReset() {
  const btn = document.getElementById('btnDemoReset');
  if (btn) setLoading(btn, true, 'Resetting...');
  try {
    const res = await API.demoReset();

    // Clear meal log UI
    const mealLogList = document.getElementById('mealLogList');
    const addMealCard = document.getElementById('addMealCard');
    if (mealLogList) {
      Array.from(mealLogList.children).forEach(c => { if (c !== addMealCard) c.remove(); });
    }

    // Seed demo meal cards into the log UI
    const demoMeals = [
      { name: 'Oatmeal + Banana',       type: 'Breakfast', cal: 425, prot: 9,  carbs: 85, fats: 6  },
      { name: 'Grilled Chicken + Rice', type: 'Lunch',     cal: 620, prot: 52, carbs: 60, fats: 8  },
      { name: 'Whey Protein Shake',     type: 'Snack',     cal: 150, prot: 30, carbs: 2,  fats: 2  },
    ];
    const emojis = { Breakfast: '🌅', Lunch: '☀️', Snack: '🍎', Dinner: '🌆' };
    demoMeals.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = 'meal-card';
      card.dataset.mealId = `demo_${idx}`;
      const tStr = idx === 0 ? '8:00 AM' : idx === 1 ? '1:00 PM' : '4:00 PM';
      card.innerHTML = `
        <div class="meal-card-header">
          <div class="meal-time-badge">${emojis[m.type] || '🍽️'} ${m.type} · ${tStr}</div>
          <button class="meal-delete-btn" onclick="deleteMealCard(this)" title="Remove meal">✕</button>
        </div>
        <div class="meal-items"><div class="meal-item">
          <span class="meal-item-name">${m.name}</span>
          <div class="meal-item-macros">
            <span class="mim-cal">${m.cal} kcal</span>
            ${m.prot ? `<span class="mim-chip prot">${m.prot}g P</span>` : ''}
            ${m.carbs ? `<span class="mim-chip carb">${m.carbs}g C</span>` : ''}
          </div>
        </div></div>
        <div class="meal-footer"><div class="meal-foot-macros">
          <span class="mfm-item">🔥 ${m.cal} kcal</span>
          ${m.prot ? `<span class="mfm-item">💪 ${m.prot}g</span>` : ''}
          ${m.carbs ? `<span class="mfm-item">🌾 ${m.carbs}g</span>` : ''}
          ${m.fats ? `<span class="mfm-item">🥑 ${m.fats}g</span>` : ''}
        </div></div>
      `;
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
      if (mealLogList && addMealCard) mealLogList.insertBefore(card, addMealCard);
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      });
    });

    // Refresh all UI modules
    if (typeof updateNutritionUI === 'function') await updateNutritionUI();
    if (typeof loadHabitsPage === 'function')    await loadHabitsPage();
    if (typeof window.syncGlobalState === 'function') await window.syncGlobalState();

    showToast('🎯 Demo data restored! Ready to present.', 'success', 3000);
  } catch (err) {
    showToast('Reset failed. Is the backend running?', 'warn', 3000);
  } finally {
    if (btn) setLoading(btn, false);
  }
}


// ─────────────────────────────────────────────
// 10. ENVIRONMENT INTELLIGENCE
// ─────────────────────────────────────────────
async function updateEnvironmentUI() {
  if (typeof API === 'undefined' || !API.getEnvironment) return;

  try {
    const res = await API.getEnvironment();
    if (!res || !res.success) return;

    // 1. Dashboard Alert Card
    const alertCard = document.getElementById('envAlertCard');
    const alertIcon = document.getElementById('envAlertIcon');
    const alertTitle = document.getElementById('envAlertTitle');
    const alertDesc = document.getElementById('envAlertDesc');

    if (alertCard && res.recommendations && res.recommendations.length > 0) {
      const topReco = res.recommendations[0];
      
      let alertClass = 'warning';
      if (res.color === 'good') alertClass = 'info';
      if (res.color === 'danger' || res.color === 'hazardous' || res.color === 'sensitive') alertClass = 'danger';
      
      alertCard.className = `alert-item alert-${alertClass}`;
      
      if (alertIcon) alertIcon.textContent = topReco.icon || '🌡️';
      if (alertTitle) alertTitle.textContent = topReco.title || 'Environment Update';
      if (alertDesc) alertDesc.textContent = res.recommendation;
    }

    // 2. Fitness Page AQI Badge
    const fitnessAqiVal = document.getElementById('fitnessAqiVal');
    if (fitnessAqiVal) {
      fitnessAqiVal.textContent = res.aqi;
      fitnessAqiVal.className = `aqi-value ${res.color}`;
    }

  } catch (err) {
    console.warn('[Environment] Update failed:', err);
  }
}

// Boot
updateEnvironmentUI();



// ─────────────────────────────────────────────
// 11. FITNESS INTELLIGENCE
// ─────────────────────────────────────────────
async function loadFitnessPage() {
  if (typeof API === 'undefined' || !API.getFitnessPlan) return;

  try {
    const res = await API.getFitnessPlan();
    if (!res || !res.success) return;

    // Update Top Level Stats
    const titleEl = document.getElementById('fitnessWorkoutTitle');
    const typeBadge = document.getElementById('fitnessWorkoutTypeBadge');
    const modeBadge = document.getElementById('fitnessModeBadge');
    const durationVal = document.getElementById('fitnessDurationVal');
    const calVal = document.getElementById('fitnessCaloriesVal');
    const listEl = document.getElementById('fitnessExerciseList');
    const countVal = document.getElementById('fitnessExercisesVal');

    if (titleEl) titleEl.textContent = res.workoutType;
    if (durationVal) durationVal.textContent = res.duration || 0;
    if (calVal) calVal.textContent = res.calories || 0;
    
    // Type badges
    if (typeBadge) {
      if (res.workoutType.toLowerCase().includes('strength') || res.workoutType.toLowerCase().includes('body')) {
        typeBadge.innerHTML = '💪 Strength';
      } else {
        typeBadge.innerHTML = '🏃 Cardio';
      }
    }

    if (modeBadge) {
      modeBadge.textContent = res.mode === 'Indoor' ? '🏠 Indoor' : '🌳 Outdoor';
      if (res.mode === 'Indoor') {
        modeBadge.className = 'workout-badge indoor';
      } else {
        modeBadge.className = 'workout-badge';
        modeBadge.style.background = 'var(--surface)';
      }
    }
    
    // Check if forced indoor overlay notification should be shown via toast
    if (res.forcedIndoorByAqi && !window._hasShownIndoorToast) {
       if (typeof showToast === 'function') {
           showToast(`AQI is ${res.aqiAtGeneration}. Workout moved indoor.`, 'warning', 4000);
           window._hasShownIndoorToast = true;
       }
    }

    // Process exercises list
    if (listEl && res.exercises) {
      listEl.innerHTML = '';
      if (countVal) countVal.textContent = res.exercises.length;

      res.exercises.forEach((ex, idx) => {
        const iStr = (idx + 1).toString().padStart(2, '0');
        const snippet = `
          <div class="exercise-item">
            <div class="exercise-num">${iStr}</div>
            <div class="exercise-info">
              <p class="exercise-name">${ex.name}</p>
              <p class="exercise-meta">${ex.sets} sets × ${ex.reps}</p>
            </div>
            <span class="exercise-muscle">${ex.muscle || 'Active'}</span>
          </div>
        `;
        listEl.insertAdjacentHTML('beforeend', snippet);
      });
    }

  } catch (err) {
    console.warn('[Fitness] Load failed:', err);
    showToast('Could not load fitness plan.', 'warn', 3000);
  }
}


// ─────────────────────────────────────────────
// 12. INSIGHTS INTELLIGENCE
// ─────────────────────────────────────────────
async function loadInsightsPage() {
  if (typeof API === 'undefined' || !API.getInsights) return;

  try {
    const res = await API.getInsights();
    if (!res || !res.success) return;

    // 1. Update Aggregate Stats
    const valMap = {
      'avgCalories': 'insAvgCalories',
      'avgSteps': 'insAvgSteps',
      'avgSleep': 'insAvgSleep',
      'habitRate': 'insHabitRate'
    };
    for (const [key, elementId] of Object.entries(valMap)) {
      const el = document.getElementById(elementId);
      if (el && res.aggregates && res.aggregates[key] !== undefined) el.textContent = res.aggregates[key];
    }

    // 2. Update Trends
    const trendMap = {
      'calories': 'insTrendCalories',
      'steps': 'insTrendSteps',
      'sleep': 'insTrendSleep',
      'habits': 'insTrendHabits'
    };
    for (const [key, elementId] of Object.entries(trendMap)) {
      const el = document.getElementById(elementId);
      if (el && res.trends && res.trends[key]) {
        const t = res.trends[key];
        let pre = (t.dir === 'up' ? '↑ ' : '↓ ');
        el.textContent = pre + t.val + ' vs last week';
        el.className = 'ist-change ' + t.dir;
      }
    }

    // 3. Update AI Insights List
    const listContainer = document.getElementById('insightsListContainer');
    if (listContainer && res.insights) {
      // Also update dashboard insight widget with the first primary insight
      const titleEl = document.getElementById('dashInsightTitle');
      const textEl  = document.getElementById('dashInsightText');
      if (titleEl && res.insights.length > 0) titleEl.textContent = res.insights[0].tag + " (" + res.insights[0].time + ")";
      if (textEl && res.insights.length > 0) textEl.textContent  = res.insights[0].text;

      listContainer.innerHTML = ''; // clear static layout
      res.insights.forEach(insight => {
        const snippet = `
          <div class="ai-insight-card">
            <div class="ai-insight-header">
              <span class="ai-tag ${insight.style}">${insight.tag}</span>
              <span class="ai-date">${insight.time}</span>
            </div>
            <p class="ai-insight-text">${insight.text}</p>
          </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', snippet);
      });
    }

    // 4. Update Charts with Historical API Data
    if (res.charts) {
      if (typeof bodyMetricsChart !== 'undefined' && bodyMetricsChart != null) {
        bodyMetricsChart.data.labels = res.charts.labels;
        bodyMetricsChart.data.datasets[0].data = res.charts.bodyMetrics;
        bodyMetricsChart.update();
      }
      
      if (typeof sleepChart !== 'undefined' && sleepChart != null) {
        sleepChart.data.labels = res.charts.labels;
        sleepChart.data.datasets[0].data = res.charts.sleepPattern;
        sleepChart.update();
      }
    }

  } catch (err) {
    console.warn('[Insights] Load failed:', err);
  }
}

// ─────────────────────────────────────────────
// 13. UNIFIED DASHBOARD SYNC
// ─────────────────────────────────────────────
/**
 * Fetch all backend data and update every dashboard card.
 * Called on boot and after any data mutation.
 */
async function syncDashboard() {
  if (typeof API === 'undefined') return;

  try {
    // Fetch insights (has dailySnapshot with everything)
    const ins = await API.getInsights();
    if (!ins || !ins.success) return;

    const snap = ins.dailySnapshot || {};
    const goals = (typeof DAILY_GOALS_API !== 'undefined') ? DAILY_GOALS_API : { calories: 2500, protein: 150, carbs: 280, fats: 78, fiber: 30 };

    // ── Calories card
    const calPct = goals.calories ? Math.round((snap.calories / goals.calories) * 100) : 0;
    _setDashCard('dashCalVal', `${(snap.calories || 0).toLocaleString()}`, 'dashCalBar', calPct, 'dashCalMeta', `${calPct}% of ${goals.calories.toLocaleString()} goal`);

    // ── Protein card
    const protPct = goals.protein ? Math.round((snap.protein / goals.protein) * 100) : 0;
    const protWarn = protPct < 60 ? ' — Low' : '';
    _setDashCard('dashProtVal', `${snap.protein || 0}g`, 'dashProtBar', protPct, 'dashProtMeta', `${protPct}% of ${goals.protein}g${protWarn}`);

    // ── Water card
    const waterPct = Math.round(Math.min(((snap.water || 0) / 2.5) * 100, 100));
    _setDashCard('dashWaterVal', `${(snap.water || 0).toFixed(1)}L`, 'dashWaterBar', waterPct, 'dashWaterMeta', `${waterPct}% of 2.5L goal`);

    // ── Steps card
    const stepsPct = Math.round(Math.min(((snap.steps || 0) / 10000) * 100, 100));
    _setDashCard('dashStepsVal', `${(snap.steps || 0).toLocaleString()}`, 'dashStepsBar', stepsPct, 'dashStepsMeta', `${stepsPct}% of 10k goal`);

    // ── Sleep card
    const sleepPct = Math.round(Math.min(((snap.sleep || 0) / 8) * 100, 100));
    const sleepLabel = snap.sleep > 0 ? `${snap.sleep}h` : '—';
    _setDashCard('dashSleepVal', sleepLabel, 'dashSleepBar', sleepPct, 'dashSleepMeta', snap.sleep > 0 ? `${sleepPct}% of 8h goal` : 'Not logged');

    // ── Habits card
    const habitRate = snap.habitRate || 0;
    _setDashCard('dashHabitsVal', `${snap.habitsCompleted || 0}/${snap.habitsTotal || 0}`, 'dashHabitsBar', habitRate, 'dashHabitsMeta', `${habitRate}% completion`);

    // ── Weekly chart data from API
    if (ins.weekly) {
      chartData.calories.data = ins.weekly.calories;
      chartData.calories.labels = ins.weekly.labels;
      chartData.steps.data = ins.weekly.steps;
      chartData.steps.labels = ins.weekly.labels;
      chartData.sleep.data = ins.weekly.sleep;
      chartData.sleep.labels = ins.weekly.labels;

      // Update whichever chart tab is active
      if (weeklyChart) {
        const activeTab = document.querySelector('.chart-tab.active');
        const metric = activeTab ? activeTab.dataset.metric : 'calories';
        const d = chartData[metric];
        weeklyChart.data.labels = d.labels;
        weeklyChart.data.datasets[0].data = d.data;
        weeklyChart.data.datasets[0].backgroundColor = d.data.map((v, i) =>
          i === d.data.length - 1 ? d.color : hexAlpha(d.color, 0.25)
        );
        weeklyChart.data.datasets[0].borderColor = d.color;
        weeklyChart.update();
      }
    }

    // ── Update insights page charts
    if (ins.charts) {
      if (bodyMetricsChart) {
        bodyMetricsChart.data.labels = ins.charts.labels;
        bodyMetricsChart.data.datasets[0].data = ins.charts.bodyMetrics;
        if (bodyMetricsChart.data.datasets[1]) {
          bodyMetricsChart.data.datasets[1].data = ins.charts.sleepPattern;
        }
        bodyMetricsChart.update();
      }
      if (sleepChart) {
        sleepChart.data.labels = ins.charts.labels;
        sleepChart.data.datasets[0].data = ins.charts.sleepPattern;
        if (sleepChart.data.datasets[1]) sleepChart.data.datasets[1].data = ins.charts.sleepPattern.map(v => Math.max(0, v - 2));
        if (sleepChart.data.datasets[2]) sleepChart.data.datasets[2].data = ins.charts.sleepPattern.map(v => Math.max(0, v * 0.2));
        sleepChart.update();
      }
    }

    // ── Update insights aggregate text
    if (ins.aggregates) {
      const valMap = { 'avgCalories': 'insAvgCalories', 'avgSteps': 'insAvgSteps', 'avgSleep': 'insAvgSleep', 'habitRate': 'insHabitRate' };
      for (const [key, elementId] of Object.entries(valMap)) {
        const el = document.getElementById(elementId);
        if (el && ins.aggregates[key] !== undefined) el.textContent = ins.aggregates[key];
      }
    }

    // ── Update dashboard insight alert
    if (ins.insights && ins.insights.length > 0) {
      const titleEl = document.getElementById('dashInsightTitle');
      const textEl  = document.getElementById('dashInsightText');
      if (titleEl) titleEl.textContent = ins.insights[0].tag + ' (' + ins.insights[0].time + ')';
      if (textEl)  textEl.textContent  = ins.insights[0].text;
    }

  } catch (err) {
    console.warn('[syncDashboard] Failed:', err);
  }
}

/** Helper to set a dashboard card's value, bar, and meta */
function _setDashCard(valId, valText, barId, barPct, metaId, metaText) {
  const valEl  = document.getElementById(valId);
  const barEl  = document.getElementById(barId);
  const metaEl = document.getElementById(metaId);
  if (valEl)  valEl.textContent = valText;
  if (barEl)  barEl.style.width = Math.min(barPct, 100) + '%';
  if (metaEl) metaEl.textContent = metaText;
}

// Boot dashboard sync
syncDashboard();
