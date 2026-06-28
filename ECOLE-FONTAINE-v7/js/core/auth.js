// ============================================================
// AUTHENTICATION - Login, logout, session management
// ============================================================

import { getAll, update, insert, updateSchoolSetting, getSchoolSettings } from './supabase-client.js';
import { state } from './state.js';
import { saveSession, clearSession, getStoredSession, resetSessionExpiry } from './storage.js';
import { showToast } from './helpers.js';
import { logActivity } from './helpers.js';
import { APP_CONFIG } from './config.js';

// Session timer
let _sessionTimer = null;

// Login function
export async function login(role, username, password) {
    if (role === 'admin') {
        const settings = await getSchoolSettings();
        const adminPw = settings.admin_password || 'admin123';
        if (password !== adminPw) {
            return { success: false, error: 'Invalid password' };
        }
        const user = { id: 0, role: 'admin', name: 'Administrator', username: 'admin' };
        await logActivity(0, 'admin', 'User logged in');
        return { success: true, user };
    } else {
        const rows = await getAll('teachers', { username, role });
        const found = rows.find(r => r.username === username && r.password === password);
        if (!found) {
            return { success: false, error: 'Invalid username or password' };
        }
        if (found.is_active === false) {
            return { success: false, error: 'Account is inactive' };
        }
        await update('teachers', found.id, { last_login: new Date().toISOString() });
        const user = {
            id: found.id,
            role: found.role,
            name: found.name,
            username: found.username,
            email: found.email
        };
        await logActivity(found.id, found.role, 'User logged in');
        return { success: true, user };
    }
}

// Logout function
export async function logout() {
    const u = state.currentUser;
    if (u) {
        await logActivity(u.id, u.role, 'User logged out').catch(() => { });
    }
    clearSession();
    state.currentUser = null;
    if (_sessionTimer) {
        clearInterval(_sessionTimer);
        _sessionTimer = null;
    }

    // Hide app, show login
    const appPage = document.getElementById('app-page');
    const loginPage = document.getElementById('login-page');
    if (appPage) appPage.style.display = 'none';
    if (loginPage) {
        loginPage.style.display = 'flex';
        const cardWrap = document.getElementById('card-wrap');
        if (cardWrap) cardWrap.classList.remove('open');
        const passwordInput = document.getElementById('login-password');
        if (passwordInput) passwordInput.value = '';
    }

    showToast('Logged out successfully', 'info');
}

// Change password
export async function changePassword(currentPw, newPw) {
    const u = state.currentUser;
    if (!u) return { ok: false, error: 'Not authenticated' };

    if (u.role === 'admin') {
        const s = await getSchoolSettings();
        if (s.admin_password !== currentPw) {
            return { ok: false, error: 'Current password is incorrect' };
        }
        await updateSchoolSetting('admin_password', newPw);
    } else {
        const t = await getById('teachers', u.id);
        if (!t || t.password !== currentPw) {
            return { ok: false, error: 'Current password is incorrect' };
        }
        await update('teachers', u.id, { password: newPw });
    }
    await logActivity(u.id, u.role, 'Changed password');
    return { ok: true };
}

// Check stored session
export function checkAuth() {
    return getStoredSession();
}

// Start session watcher (auto-logout on expiry)
export function startSessionWatcher() {
    if (_sessionTimer) clearInterval(_sessionTimer);

    _sessionTimer = setInterval(() => {
        if (!checkAuth()) {
            showToast('Session expired. Please login again.', 'warning');
            logout();
        }
    }, 60000);

    // Reset expiry on user activity
    const events = ['click', 'keydown', 'mousemove', 'touchstart'];
    events.forEach(ev => {
        document.addEventListener(ev, () => {
            if (state.currentUser) {
                resetSessionExpiry();
            }
        }, { passive: true });
    });
}

// Get current user from state
export function getCurrentUser() {
    return state.currentUser;
}

// Check if user has specific role
export function hasRole(role) {
    return state.currentUser && state.currentUser.role === role;
}

// Check if user is admin
export function isAdmin() {
    return state.currentUser && state.currentUser.role === 'admin';
}

// Check if user is teacher
export function isTeacher() {
    return state.currentUser && state.currentUser.role === 'teacher';
}

// Check if user is accountant
export function isAccountant() {
    return state.currentUser && state.currentUser.role === 'accountant';
}
// Global exposure for inline onclick handlers
window.logout         = logout;
window.changePassword = changePassword;
