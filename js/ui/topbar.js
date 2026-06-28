// js/ui/topbar.js
// Topbar — render, user info, progress bar, bell, theme, dropdown
// No ES module imports — uses globals

// ── RENDER TOPBAR ─────────────────────────────────────────────────────────────
// Topbar HTML lives in index.html already.
// This file handles behaviour only (no innerHTML injection needed).

function updateTopbarUser(user) {
    const emoji = { admin: '👨‍💼', accountant: '💰', teacher: '👩‍🏫' }[user.role] || '👤';
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('topbar-avatar',      emoji);
    set('topbar-username',    user.name);
    set('dropdown-username',  user.name);
    set('dropdown-userrole',  _roleLabel(user.role));

    const da = document.querySelector('.dropdown-avatar');
    if (da) da.textContent = emoji;
}

// ── TERM PROGRESS BAR ─────────────────────────────────────────────────────────
function updateProgressBar() {
    const s    = window.AppState || {};
    const term = s.currentTerm;
    if (!term) return;

    const today      = new Date();
    const start      = new Date(term.start_date);
    const end        = new Date(term.end_date);
    const midterm    = new Date(term.midterm_date);

    const totalDays  = Math.max(1, Math.round((end - start) / 864e5));
    const elapsed    = Math.max(0, Math.round((today - start) / 864e5));
    const daysLeft   = Math.max(0, Math.round((end - today) / 864e5));
    const pct        = Math.min(100, Math.round((elapsed / totalDays) * 100));

    const phase      = today < midterm ? 'pre_midterm' : 'post_midterm';
    const phaseLabel = phase === 'pre_midterm' ? '📅 Pre-Mid' : '📅 Post-Mid';
    const yearLabel  = s.currentAcadYear?.year_label || s.currentAcadYear?.name || '2025-2026';
    const termLabel  = term.term_label || `Term ${term.term_number}`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const fill = document.getElementById('prog-fill');

    if (fill) fill.style.width = pct + '%';
    set('prog-term-name', termLabel);
    set('prog-acad-year', yearLabel);
    set('prog-text',      `${elapsed} days in`);
    set('prog-days',      daysLeft);

    const phaseEl = document.getElementById('phase-indicator-compact');
    if (phaseEl) {
        phaseEl.textContent = phaseLabel;
        phaseEl.className   = `phase-badge-compact ${phase === 'pre_midterm' ? 'phase-pre' : 'phase-post'}`;
    }
}

// ── NOTIFICATION BELL ─────────────────────────────────────────────────────────
// Bell navigates to notification-center module — never opens a modal
function updateBellCount(count) {
    const dot = document.getElementById('notif-dot');
    if (!dot) return;
    if (count > 0) {
        dot.textContent = count > 99 ? '99+' : count;
        dot.style.display = 'flex';
    } else {
        dot.style.display = 'none';
    }
}

// ── USER DROPDOWN ──────────────────────────────────────────────────────────────
function toggleUserDropdown() {
    const dd = document.getElementById('user-dropdown');
    if (!dd) return;
    const isOpen = dd.classList.toggle('open');
    if (isOpen) {
        // Close when clicking outside
        setTimeout(() => {
            document.addEventListener('click', _closeDropdownOutside, { once: true });
        }, 0);
    }
}

function _closeDropdownOutside(e) {
    const dd   = document.getElementById('user-dropdown');
    const menu = document.querySelector('.user-menu');
    if (dd && menu && !menu.contains(e.target)) {
        dd.classList.remove('open');
    }
}

// ── THEME TOGGLE ───────────────────────────────────────────────────────────────
function toggleTheme() {
    const current  = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('elf_theme', newTheme);
    _applyThemeIcons(newTheme);
    _showToast(newTheme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode', 'info', 1500);
}

function initTheme() {
    const saved       = localStorage.getItem('elf_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme       = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    _applyThemeIcons(theme);
}

function _applyThemeIcons(theme) {
    const icon = document.getElementById('dropdown-theme-icon');
    const text = document.getElementById('dropdown-theme-text');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// ── PROFILE MODAL ──────────────────────────────────────────────────────────────
function showProfileModal() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    const s       = window.AppState || {};
    const teacher = user.role !== 'admin'
        ? (s.teachers || []).find(t => t.id == user.id)
        : null;

    // For admin: name is headteacher from school_settings
    const displayName = user.role === 'admin'
        ? (s.settings?.head_teacher || s.settings?.school_name || 'UWAYO GANZA Eugene')
        : user.name;

    _showModal(`
        <div class="modal-overlay" onclick="if(event.target===this)window.closeModal&&window.closeModal()">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>👤 My Profile</h3>
                    <button class="modal-close" onclick="window.closeModal&&window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="text-align:center;margin-bottom:16px;font-size:3.5rem">
                        ${{ admin:'👨‍💼', accountant:'💰', teacher:'👩‍🏫' }[user.role] || '👤'}
                    </div>
                    <div class="form-grid">
                        <div class="form-group"><label>Full Name</label>
                            <input readonly value="${_esc(displayName)}"></div>
                        <div class="form-group"><label>Role</label>
                            <input readonly value="${_esc(_roleLabel(user.role))}"></div>
                        ${user.role !== 'admin' ? `
                        <div class="form-group"><label>Username</label>
                            <input readonly value="${_esc(user.username || '')}"></div>
                        <div class="form-group"><label>Email</label>
                            <input readonly value="${_esc(teacher?.email || '—')}"></div>
                        ${teacher?.phone ? `<div class="form-group"><label>Phone</label>
                            <input readonly value="${_esc(teacher.phone)}"></div>` : ''}
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal&&window.closeModal()">Close</button>
                    <button class="btn btn-primary"
                        onclick="window.closeModal&&window.closeModal();setTimeout(()=>window.showChangePasswordModal&&window.showChangePasswordModal(),100)">
                        Change Password
                    </button>
                </div>
            </div>
        </div>
    `);
    document.getElementById('user-dropdown')?.classList.remove('open');
}

// ── CHANGE PASSWORD MODAL ──────────────────────────────────────────────────────
function showChangePasswordModal() {
    _showModal(`
        <div class="modal-overlay" onclick="if(event.target===this)window.closeModal&&window.closeModal()">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>🔒 Change Password</h3>
                    <button class="modal-close" onclick="window.closeModal&&window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger" id="pw-error" style="display:none"></div>
                    <div class="form-group">
                        <label>Current Password</label>
                        <input type="password" id="pw-current" placeholder="Current password">
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="pw-new" placeholder="Min 4 characters">
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input type="password" id="pw-confirm" placeholder="Repeat new password"
                            onkeydown="if(event.key==='Enter')window.submitChangePassword&&window.submitChangePassword()">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal&&window.closeModal()">Cancel</button>
                    <button class="btn btn-primary"
                        onclick="window.submitChangePassword&&window.submitChangePassword()">
                        Update Password
                    </button>
                </div>
            </div>
        </div>
    `);
}

async function submitChangePassword() {
    const current = document.getElementById('pw-current')?.value?.trim();
    const newPw   = document.getElementById('pw-new')?.value?.trim();
    const confirm = document.getElementById('pw-confirm')?.value?.trim();
    const showErr = (msg) => {
        const el = document.getElementById('pw-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    };
    if (!current || !newPw || !confirm) return showErr('All fields are required');
    if (newPw !== confirm)              return showErr('New passwords do not match');
    if (newPw.length < 4)              return showErr('Minimum 4 characters required');
    if (newPw === current)             return showErr('New password must differ from current');

    const result = await (window.changePassword?.(current, newPw));
    if (!result?.ok) return showErr(result?.error || 'Password change failed');

    _showToast('✅ Password updated — logging out...', 'success');
    window.closeModal?.();
    setTimeout(() => window.logout?.(), 1800);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _roleLabel(role) {
    return { admin: 'Administrator', accountant: 'Accountant', teacher: 'Teacher' }[role] || role;
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
    );
}

// Fallback if modals.js not yet loaded
function _showModal(html) {
    if (window.showModal) { window.showModal(html); return; }
    const c = document.getElementById('modals-container');
    if (c) c.innerHTML = html;
}

function _showToast(msg, type, duration) {
    if (window.showToast) window.showToast(msg, type, duration);
    else console.log('[TOAST]', msg);
}

// ── GLOBALS ───────────────────────────────────────────────────────────────────
window.updateTopbarUser        = updateTopbarUser;
window.updateProgressBar       = updateProgressBar;
window.updateBellCount         = updateBellCount;
window.toggleUserDropdown      = toggleUserDropdown;
window.toggleTheme             = toggleTheme;
window.initTheme               = initTheme;
window.showProfileModal        = showProfileModal;
window.showChangePasswordModal = showChangePasswordModal;
window.submitChangePassword    = submitChangePassword;
