/* ============================================================
   H²OS - Habits Module (habits.js) v1.0
   ============================================================
   UI rendering and interaction for the Habits page.
   
   Architecture:
   - ALL state lives in AppState (api.js)
   - ALL calculations happen in backend services
   - This file handles: UI rendering, user interactions, and API calls
   - Every public function is async and calls the API layer
*/

'use strict';

/* --------------------------------------------------------------
   1. HABIT UI RENDERING
   -------------------------------------------------------------- */

function renderHabits(habitsData) {
  if (!habitsData || !habitsData.success) {
    console.warn('Invalid habits data received:', habitsData);
    return;
  }

  const habits = habitsData.habits || [];
  const container = document.querySelector('.habits-list');
  if (!container) return;

  // Clear existing habits
  container.innerHTML = '';

  // Render each habit
  habits.forEach(habit => {
    const habitEl = document.createElement('div');
    habitEl.className = `habit-item ${habit.done ? 'done' : ''}`;
    habitEl.dataset.habitId = habit.id;
    
    habitEl.innerHTML = `
      <div class="habit-check" onclick="toggleHabit(${habit.id})"></div>
      <div class="habit-info">
        <p class="habit-name">${habit.name}</p>
        <p class="habit-meta">${habit.category} · ${getCategoryEmoji(habit.category)}</p>
      </div>
      <span class="habit-streak">${habit.streak > 0 ? '?? ' + habit.streak : ''}</span>
    `;
    
    container.appendChild(habitEl);
  });

  // Update progress
  updateHabitsProgress(habitsData);
  
  // Update water and sleep if available
  if (habitsData.water) {
    renderWater(habitsData.water);
  }
  if (habitsData.sleep) {
    renderSleep(habitsData.sleep);
  }
}

function updateHabitsProgress(habitsData) {
  const completed = habitsData.completedCount || 0;
  const total = habitsData.total || 0;
  const rate = habitsData.completionRate || 0;
  
  const progressLabel = document.getElementById('habitProgressLabel');
  if (progressLabel) {
    progressLabel.textContent = `${completed} / ${total} done`;
  }
  
  const progressFill = document.getElementById('habitProgressFill');
  if (progressFill) {
    progressFill.style.width = `${rate}%`;
  }
  
  const progressText = document.getElementById('habitProgressText');
  if (progressText) {
    progressText.textContent = `${rate}%`;
  }
}

function getCategoryEmoji(category) {
  const emojis = {
    'mindfulness': '??',
    'hydration': '??',
    'nutrition': '??',
    'fitness': '??',
    'sleep': '??',
    'recovery': '??',
    'productivity': '??',
    'social': '??'
  };
  return emojis[category] || '??';
}

/* --------------------------------------------------------------
   2. WATER TRACKING UI
   -------------------------------------------------------------- */

function renderWater(waterData) {
  const logged = waterData.logged || 0;
  const goal = waterData.goal || 2.5;
  const percent = waterData.percent || 0;
  
  // Update water amount display
  const waterVal = document.getElementById('waterLoggedVal');
  if (waterVal) {
    waterVal.textContent = logged.toFixed(1);
  }
  
  // Update progress bar
  const waterBarFill = document.getElementById('waterBarFill');
  if (waterBarFill) {
    waterBarFill.style.width = `${percent}%`;
  }
  
  // Update percentage label
  const waterPctLabel = document.getElementById('waterPctLabel');
  if (waterPctLabel) {
    waterPctLabel.textContent = `${Math.round(percent)}% of ${goal}L`;
  }
  
  // Update goal label
  const waterGoalLabel = document.getElementById('waterGoalLabel');
  if (waterGoalLabel) {
    waterGoalLabel.textContent = `Goal: ${goal}L`;
  }
  
  // Store in AppState
  if (typeof AppState !== 'undefined') {
    AppState.dailyMetrics.water = logged;
    AppState.waterState = waterData;
  }
}

/* --------------------------------------------------------------
   3. SLEEP TRACKING UI
   -------------------------------------------------------------- */

function renderSleep(sleepData) {
  const hours = sleepData.hours || 0;
  const goal = sleepData.goal || 8;
  const quality = sleepData.quality;
  const label = sleepData.label || 'Not logged';
  
  // Update sleep hours display
  const sleepHours = document.getElementById('sleepHours');
  if (sleepHours) {
    sleepHours.textContent = hours.toFixed(1);
  }
  
  // Update sleep quality
  const sleepQuality = document.getElementById('sleepQuality');
  if (sleepQuality) {
    sleepQuality.textContent = label;
    sleepQuality.className = `sleep-quality ${quality ? 'logged' : 'not-logged'}`;
  }
  
  // Update progress bar
  const sleepBarFill = document.getElementById('sleepBarFill');
  if (sleepBarFill) {
    const percent = Math.min((hours / goal) * 100, 100);
    sleepBarFill.style.width = `${percent}%`;
  }
  
  // Update goal label
  const sleepGoalLabel = document.getElementById('sleepGoalLabel');
  if (sleepGoalLabel) {
    sleepGoalLabel.textContent = `Goal: ${goal}h`;
  }
  
  // Store in AppState
  if (typeof AppState !== 'undefined') {
    AppState.dailyMetrics.sleep = hours;
    AppState.sleepState = sleepData;
  }
}

/* --------------------------------------------------------------
   4. USER INTERACTIONS
   -------------------------------------------------------------- */

async function toggleHabit(habitId) {
  if (typeof API === 'undefined') {
    console.error('API not available');
    return;
  }

  // Find current state
  const habitEl = document.querySelector(`[data-habit-id="${habitId}"]`);
  if (!habitEl) return;
  
  const isDone = !habitEl.classList.contains('done');
  
  // Show loading state
  habitEl.classList.add('loading');
  
  try {
    const res = await API.updateHabit(habitId, isDone);
    if (res && res.success) {
      renderHabits(res);
      
      // Show toast feedback
      const habitName = res.habit?.name || `Habit ${habitId}`;
      const action = isDone ? 'completed' : 'uncompleted';
      showToast(`?? ${habitName} ${action}!`, 'success', 2000);
      
      // Sync global state
      if (typeof window.syncGlobalState === 'function') {
        await window.syncGlobalState();
      }
    } else {
      throw new Error(res?.error || 'Failed to update habit');
    }
  } catch (err) {
    console.error('Error updating habit:', err);
    showToast('Could not update habit - please try again', 'error', 3000);
    
    // Revert UI state on error
    habitEl.classList.toggle('done', !isDone);
  } finally {
    habitEl.classList.remove('loading');
  }
}

async function logWaterAmount(litres, triggerBtn = null) {
  if (typeof API === 'undefined') {
    console.error('API not available');
    return;
  }

  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Logging...';
  }

  try {
    const res = await API.logWater({ amount: litres });
    if (res && res.success && res.water) {
      renderWater(res.water);
      showToast(`?? +${(litres * 1000)}ml logged!`, 'success', 2000);
      
      // Sync global state
      if (typeof window.syncGlobalState === 'function') {
        await window.syncGlobalState();
      }
    } else {
      throw new Error(res?.error || 'Failed to log water');
    }
  } catch (err) {
    console.error('Error logging water:', err);
    showToast('Could not log water - please try again', 'error', 3000);
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = triggerBtn.textContent.replace('Logging...', '+ ');
    }
  }
}

async function logWaterCustom() {
  const input = document.getElementById('waterCustomInput');
  const val = parseFloat(input?.value);
  
  if (!val || val <= 0 || val > 5) {
    showToast('Enter a valid amount between 0.1 and 5L', 'warn', 2000);
    return;
  }
  
  const btn = document.querySelector('button[onclick="logWaterCustom()"]');
  await logWaterAmount(val, btn);
  if (input) input.value = '';
}

async function logSleep() {
  if (typeof API === 'undefined') {
    console.error('API not available');
    return;
  }

  const hoursInput = document.getElementById('sleepHoursInput');
  const qualityInput = document.getElementById('sleepQualityInput');
  
  const hours = parseFloat(hoursInput?.value) || 0;
  const quality = parseInt(qualityInput?.value) || null;
  
  if (hours < 0 || hours > 24) {
    showToast('Enter valid sleep hours (0-24)', 'warn', 2000);
    return;
  }
  
  if (quality && (quality < 0 || quality > 100)) {
    showToast('Enter valid quality (0-100)', 'warn', 2000);
    return;
  }

  try {
    const payload = { hours };
    if (quality !== null) payload.quality = quality;
    
    const res = await API.logSleep(payload);
    if (res && res.success && res.sleep) {
      renderSleep(res.sleep);
      showToast(`?? ${hours}h of sleep logged!`, 'success', 2000);
      
      // Clear inputs
      if (hoursInput) hoursInput.value = '';
      if (qualityInput) qualityInput.value = '';
      
      // Sync global state
      if (typeof window.syncGlobalState === 'function') {
        await window.syncGlobalState();
      }
    } else {
      throw new Error(res?.error || 'Failed to log sleep');
    }
  } catch (err) {
    console.error('Error logging sleep:', err);
    showToast('Could not log sleep - please try again', 'error', 3000);
  }
}

/* --------------------------------------------------------------
   5. INITIALIZATION
   -------------------------------------------------------------- */

async function initHabitsPage() {
  try {
    if (typeof API !== 'undefined') {
      const res = await API.getHabits();
      if (res && res.success) {
        renderHabits(res);
      } else {
        throw new Error(res?.error || 'Failed to load habits');
      }
    }
  } catch (err) {
    console.error('Error initializing habits page:', err);
    showToast('Could not load habits - please refresh', 'error', 3000);
  }
}

/* --------------------------------------------------------------
   6. GLOBAL FUNCTIONS (for HTML onclick handlers)
   -------------------------------------------------------------- */

// Make functions globally available for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.toggleHabit = toggleHabit;
  window.logWaterAmount = logWaterAmount;
  window.logWaterCustom = logWaterCustom;
  window.logSleep = logSleep;
  window.initHabitsPage = initHabitsPage;
}

/* --------------------------------------------------------------
   7. AUTO-INITIALIZE
   -------------------------------------------------------------- */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHabitsPage);
} else {
  initHabitsPage();
}
