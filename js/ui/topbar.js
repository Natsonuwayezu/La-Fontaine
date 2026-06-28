// ============================================================
// TOPBAR UI - Top bar shell, progress bar, user menu
// ============================================================

import { state } from '../core/state.js';
import { getCurrentUser, logout } from '../core/auth.js';
import { termProgress, getCurrentPhase } from '../core/academic-year-engine.js';
import { saveTheme, getSavedTheme } from '../core/storage.js';
import { showModal, closeModal, showToast } from './modals.js';

// Render topbar HTML shell into <header id="topbar">
export function renderTopbar() {
    const topbar = document.getElementById('topbar');
    if (!topbar || document.getElementById('topbar-avatar')) return; // already rendered

    topbar.innerHTML = `
        <div class="topbar-left">
            <button class="sidebar-toggle-btn" onclick="window.toggleSidebar && window.toggleSidebar()" title="Toggle sidebar">☰</button>
            <h1 class="page-title" id="page-title">Dashboard</h1>
        </div>
        <div class="topbar-center">
            <div class="term-progress-compact" id="term-progress-compact">
                <span id="prog-term-name">—</span>
                <div class="progress-bar-sm">
                    <div class="progress-fill-sm" id="prog-fill" style="width:0%"></div>
                </div>
                <span id="prog-text">—</span>
                <span class="prog-days-badge" id="prog-days">—</span>
                <span class="phase-badge-compact" id="phase-indicator-compact"></span>
                <span class="acad-year-label" id="prog-acad-year"></span>
            </div>
        </div>
        <div class="topbar-right">
            <button class="topbar-icon-btn" id="pwa-install-btn" style="display:none" onclick="window.installPWA && window.installPWA()" title="Install app">📲</button>
            <button class="topbar-icon-btn" onclick="window.toggleTheme && window.toggleTheme()" title="Toggle theme" id="theme-toggle-btn">🌙</button>
            <div class="user-menu" onclick="window.toggleUserDropdown && window.toggleUserDropdown()">
                <div class="topbar-avatar" id="topbar-avatar">👤</div>
                <span class="topbar-username" id="topbar-username">User</span>
                <div class="user-dropdown" id="user-dropdown">
                    <div class="dropdown-user-info">
                        <div class="dropdown-avatar">👤</div>
                        <div>
                            <div class="dropdown-username" id="dropdown-username">—</div>
                            <div class="dropdown-userrole" id="dropdown-userrole">—</div>
                        </div>
                    </div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item" onclick="window.showProfileModal && window.showProfileModal()">
                        👤 My Profile
                    </div>
                    <div class="dropdown-item" onclick="window.toggleTheme && window.toggleTheme()">
                        <span id="dropdown-theme-icon">🌙</span>
                        <span id="dropdown-theme-text">Dark Mode</span>
                    </div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item dropdown-item-danger" onclick="window.logout && window.logout()">
                        🚪 Logout
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function updateTopbarUser(user) {
    renderTopbar(); // ensure shell exists

    const emoji = { admin: '👨‍💼', accountant: '💰', teacher: '👩‍🏫' }[user.role] || '👤';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('topbar-avatar', emoji);
    set('topbar-username', user.name);
    set('dropdown-username', user.name);
    set('dropdown-userrole', user.role);

    const da = document.querySelector('.dropdown-avatar');
    if (da) da.textContent = emoji;
}

export function updateProgressBar() {
    const term = state.currentTerm;
    if (!term) return;

    const { pct, daysLeft, text } = termProgress(term);
    const phase = getCurrentPhase(term);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const fill = document.getElementById('prog-fill');
    if (fill) fill.style.width = pct + '%';
    set('prog-text', text);
    set('prog-days', daysLeft + ' days');
    set('prog-term-name', state.schoolSettings?.current_term || 'Term 3');
    set('prog-acad-year', state.currentAcadYear?.name || '2025-2026');

    const phaseEl = document.getElementById('phase-indicator-compact');
    if (phaseEl) {
        phaseEl.textContent  = phase === 'pre_midterm' ? '📅 Pre' : '📅 Post';
        phaseEl.className    = `phase-badge-compact ${phase === 'pre_midterm' ? 'phase-pre' : 'phase-post'}`;
    }
}

export function toggleUserDropdown() {
    document.getElementById('user-dropdown')?.classList.toggle('open');
}

export function initUserDropdown() {
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-dropdown');
        const userMenu = document.querySelector('.user-menu');
        if (dropdown?.classList.contains('open') && userMenu && !userMenu.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

export function toggleTheme() {
    const current  = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    saveTheme(newTheme);

    const icon = document.getElementById('dropdown-theme-icon');
    const text = document.getElementById('dropdown-theme-text');
    const btn  = document.getElementById('theme-toggle-btn');
    if (icon) icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    if (btn)  btn.textContent  = newTheme === 'dark' ? '☀️' : '🌙';

    showToast(newTheme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode', 'info', 1500);
}

export function initTheme() {
    const savedTheme  = getSavedTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme       = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('dropdown-theme-icon');
    const text = document.getElementById('dropdown-theme-text');
    const btn  = document.getElementById('theme-toggle-btn');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    if (btn)  btn.textContent  = theme === 'dark' ? '☀️' : '🌙';
}

export function showProfileModal() {
    const user = getCurrentUser();
    if (!user) return;
    const teacher = user.role !== 'admin'
        ? (state.teachers || []).find(t => t.id == user.id)
        : null;

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>👤 My Profile</h3>
                    <button class="modal-close" onclick="window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="text-align:center;margin-bottom:16px;font-size:4rem">
                        ${{ admin:'👨‍💼', accountant:'💰', teacher:'👩‍🏫' }[user.role] || '👤'}
                    </div>
                    <div class="form-grid">
                        <div class="form-group"><label>Full Name</label><input readonly value="${esc(user.name)}"></div>
                        <div class="form-group"><label>Username</label><input readonly value="${esc(user.username || '')}"></div>
                        <div class="form-group"><label>Role</label><input readonly value="${esc(user.role)}"></div>
                        <div class="form-group"><label>Email</label><input readonly value="${esc(teacher?.email || user.email || '—')}"></div>
                        ${teacher?.phone ? `<div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone)}"></div>` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="window.closeModal();window.showChangePasswordModal&&window.showChangePasswordModal()">Change Password</button>
                </div>
            </div>
        </div>
    `);
    toggleUserDropdown();
}

export function showChangePasswordModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>🔒 Change Password</h3>
                    <button class="modal-close" onclick="window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger" id="pw-error" style="display:none"></div>
                    <div class="form-group"><label>Current Password</label>
                        <input type="password" id="pw-current" placeholder="Current password"></div>
                    <div class="form-group"><label>New Password</label>
                        <input type="password" id="pw-new" placeholder="Min 4 characters"></div>
                    <div class="form-group"><label>Confirm New Password</label>
                        <input type="password" id="pw-confirm" placeholder="Repeat new password"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitChangePassword&&window.submitChangePassword()">Update Password</button>
                </div>
            </div>
        </div>
    `);
}

export async function submitChangePassword() {
    const current = document.getElementById('pw-current')?.value;
    const newPw   = document.getElementById('pw-new')?.value;
    const confirm = document.getElementById('pw-confirm')?.value;
    const errorEl = document.getElementById('pw-error');
    const showErr = (msg) => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };

    if (!current || !newPw || !confirm) { showErr('All fields are required'); return; }
    if (newPw !== confirm)              { showErr('New passwords do not match'); return; }
    if (newPw.length < 4)               { showErr('Password must be at least 4 characters'); return; }
    if (newPw === current)              { showErr('New password must differ from current'); return; }

    const result = await window.changePassword?.(current, newPw);
    if (!result?.ok) { showErr(result?.error || 'Password change failed'); return; }

    showToast('Password updated! Logging out...', 'success');
    closeModal();
    setTimeout(() => logout(), 1500);
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Expose globally
window.toggleUserDropdown       = toggleUserDropdown;
window.showProfileModal         = showProfileModal;
window.showChangePasswordModal  = showChangePasswordModal;
window.submitChangePassword     = submitChangePassword;
window.toggleTheme              = toggleTheme;
