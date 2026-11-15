/* ============================================================
   H²OS — Authentication Module (auth.js)
   ============================================================
   Handles user authentication, JWT token management, and auth UI.
*/

'use strict';

// ─────────────────────────────────────────────
// 1. AUTHENTICATION STATE
//─────────────────────────────────────────────
let currentUser = null;
let authToken = null;

// ─────────────────────────────────────────────
// 2. AUTHENTICATION UI FUNCTIONS
//─────────────────────────────────────────────
function showAuthModal() {
  const modal = document.getElementById('authModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  clearAuthForms();
}

function switchToRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('authTitle').textContent = 'Create Account';
}

function switchToLogin() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('authTitle').textContent = 'Welcome to H²OS';
}

function clearAuthForms() {
  // Clear login form
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  
  // Clear register form
  document.getElementById('registerEmail').value = '';
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerConfirmPassword').value = '';
}

// ─────────────────────────────────────────────
// 3. AUTHENTICATION HANDLERS
//─────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store authentication data
      authToken = data.access_token;
      currentUser = data.user;
      
      // Store in localStorage
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Update UI
      updateAuthUI();
      closeAuthModal();
      showToast('success', 'Welcome back!', `Logged in as ${currentUser.email}`);
      
      // Refresh dashboard data
      if (typeof syncGlobalState === 'function') {
        await syncGlobalState();
      }
    } else {
      showToast('error', 'Login Failed', data.detail || 'Invalid email or password');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('error', 'Login Error', 'Network error occurred');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;
  
  // Validate passwords match
  if (password !== confirmPassword) {
    showToast('error', 'Registration Failed', 'Passwords do not match');
    return;
  }
  
  // Validate password length
  if (password.length < 6) {
    showToast('error', 'Registration Failed', 'Password must be at least 6 characters');
    return;
  }
  
  try {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email, 
        password, 
        confirm_password: confirmPassword 
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store authentication data
      authToken = data.access_token;
      currentUser = data.user;
      
      // Store in localStorage
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Update UI
      updateAuthUI();
      closeAuthModal();
      showToast('success', 'Account Created!', `Welcome to H²OS, ${currentUser.email}!`);
      
      // Refresh dashboard data
      if (typeof syncGlobalState === 'function') {
        await syncGlobalState();
      }
    } else {
      showToast('error', 'Registration Failed', data.detail || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast('error', 'Registration Error', 'Network error occurred');
  }
}

async function handleLogout() {
  try {
    // Call logout endpoint (optional, for server-side cleanup)
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear local data
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  
  // Update UI
  updateAuthUI();
  showToast('info', 'Logged Out', 'You have been successfully logged out');
  
  // Redirect to login
  showAuthModal();
}

// ─────────────────────────────────────────────
// 4. UI UPDATES
//─────────────────────────────────────────────
function updateAuthUI() {
  const profileSection = document.querySelector('.sidebar-footer');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (currentUser) {
    // Update profile section
    const profileAvatar = profileSection.querySelector('.profile-avatar');
    const profileName = profileSection.querySelector('.profile-name');
    
    if (profileAvatar) {
      profileAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
    }
    if (profileName) {
      profileName.textContent = currentUser.email.split('@')[0];
    }
    
    // Show logout button if it exists
    if (logoutBtn) {
      logoutBtn.style.display = 'block';
      logoutBtn.onclick = handleLogout;
    }
  } else {
    // Reset profile section
    const profileAvatar = profileSection.querySelector('.profile-avatar');
    const profileName = profileSection.querySelector('.profile-name');
    
    if (profileAvatar) {
      profileAvatar.textContent = 'G';
    }
    if (profileName) {
      profileName.textContent = 'Guest User';
    }
    
    // Hide logout button
    if (logoutBtn) {
      logoutBtn.style.display = 'none';
    }
  }
}

// ─────────────────────────────────────────────
// 5. TOKEN MANAGEMENT
//─────────────────────────────────────────────
function getAuthToken() {
  return authToken || localStorage.getItem('authToken');
}

function getCurrentUser() {
  if (!currentUser) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
}

function isAuthenticated() {
  return !!getAuthToken();
}

// ─────────────────────────────────────────────
// 6. INITIALIZATION
//─────────────────────────────────────────────
function initAuth() {
  // Check for stored authentication
  const storedToken = localStorage.getItem('authToken');
  const storedUser = localStorage.getItem('currentUser');
  
  if (storedToken && storedUser) {
    authToken = storedToken;
    currentUser = JSON.parse(storedUser);
    updateAuthUI();
  } else {
    // Show login modal for unauthenticated users
    showAuthModal();
  }
}

// ─────────────────────────────────────────────
// 7. API HELPER
//─────────────────────────────────────────────
function makeAuthenticatedRequest(url, options = {}) {
  const token = getAuthToken();
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  return fetch(url, options);
}

// ─────────────────────────────────────────────
// 8. TOAST NOTIFICATIONS
//─────────────────────────────────────────────
function showToast(type, title, message = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="removeToast(this)">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }, 5000);
}

function removeToast(button) {
  const toast = button.closest('.toast');
  if (toast) {
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

// ─────────────────────────────────────────────
// 9. EXPORT FUNCTIONS
//─────────────────────────────────────────────
async function exportNutritionData() {
  if (!isAuthenticated()) {
    showToast('error', 'Authentication Required', 'Please login to export data');
    showAuthModal();
    return;
  }

  const button = event.target;
  button.classList.add('loading');
  button.textContent = 'Exporting...';

  try {
    const response = await makeAuthenticatedRequest('/api/v1/export/nutrition/csv?days=7');
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFilenameFromResponse(response) || 'nutrition_export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('success', 'Export Successful', 'Nutrition data exported successfully');
    } else {
      const error = await response.json();
      showToast('error', 'Export Failed', error.detail || 'Failed to export nutrition data');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast('error', 'Export Error', 'Network error occurred during export');
  } finally {
    button.classList.remove('loading');
    button.textContent = 'Export CSV';
  }
}

async function exportHabitsData() {
  if (!isAuthenticated()) {
    showToast('error', 'Authentication Required', 'Please login to export data');
    showAuthModal();
    return;
  }

  const button = event.target;
  button.classList.add('loading');
  button.textContent = 'Exporting...';

  try {
    const response = await makeAuthenticatedRequest('/api/v1/export/habits/csv?days=30');
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFilenameFromResponse(response) || 'habits_export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('success', 'Export Successful', 'Habits data exported successfully');
    } else {
      const error = await response.json();
      showToast('error', 'Export Failed', error.detail || 'Failed to export habits data');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast('error', 'Export Error', 'Network error occurred during export');
  } finally {
    button.classList.remove('loading');
    button.textContent = 'Export CSV';
  }
}

async function exportHealthReport() {
  if (!isAuthenticated()) {
    showToast('error', 'Authentication Required', 'Please login to export data');
    showAuthModal();
    return;
  }

  const button = event.target;
  button.classList.add('loading');
  button.textContent = 'Generating...';

  try {
    const response = await makeAuthenticatedRequest('/api/v1/export/report/pdf?days=7');
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFilenameFromResponse(response) || 'health_report.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('success', 'Report Generated', 'Health report generated successfully');
    } else {
      const error = await response.json();
      showToast('error', 'Report Failed', error.detail || 'Failed to generate health report');
    }
  } catch (error) {
    console.error('Report generation error:', error);
    showToast('error', 'Report Error', 'Network error occurred during report generation');
  } finally {
    button.classList.remove('loading');
    button.textContent = 'Generate Report';
  }
}

function getFilenameFromResponse(response) {
  const contentDisposition = response.headers.get('Content-Disposition');
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      return filenameMatch[1];
    }
  }
  return null;
}

// Initialize auth when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
