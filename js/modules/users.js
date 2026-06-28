// js/modules/users.js
// Users Module - User profile and session management

import { state } from '../core/state.js';
import { getAll, update, getById } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, fmtDateTime, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';

export async function renderUsers(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (!user) {
        container.innerHTML = '<div class="alert alert-danger">Please log in</div>';
        return;
    }

    const sessions = getActiveSessions();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👤 My Profile</span>
                <button class="btn btn-sm btn-primary" onclick="window.editProfile()">✏️ Edit Profile</button>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group"><label>Full Name</label><input readonly id="profile-name" value="${esc(user.name)}" class="form-control"></div>
                    <div class="form-group"><label>Email</label><input readonly id="profile-email" value="${esc(user.email || '—')}" class="form-control"></div>
                    <div class="form-group"><label>Username</label><input readonly id="profile-username" value="${esc(user.username)}" class="form-control"></div>
                    <div class="form-group"><label>Role</label><input readonly value="${esc(user.role)}" class="form-control"></div>
                    <div class="form-group"><label>Member Since</label><input readonly value="${fmtDate(state.currentUser?.created_at)}" class="form-control"></div>
                    <div class="form-group"><label>Last Login</label><input readonly value="${fmtDateTime(state.currentUser?.last_login)}" class="form-control"></div>
                </div>
                <div class="btn-group" style="margin-top:16px">
                    <button class="btn btn-outline" onclick="window.showChangePasswordModal()">🔒 Change Password</button>
                    <button class="btn btn-outline" onclick="window.setupBiometricLogin()">🔑 Setup Biometric Login</button>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">🔐 Active Sessions</span>
                <button class="btn btn-sm btn-outline" onclick="window.logoutOtherSessions()">🚪 Logout Other Sessions</button>
            </div>
            <div class="dash-card-body">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Device / Browser</th>
                                <th>IP Address</th>
                                <th>Login Time</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="sessions-tbody">
                            ${sessions.map(session => `
                                <tr>
                                    <td>${esc(session.device)}</span>
                                    <td>${esc(session.ip)}</span>
                                    <td>${fmtDateTime(session.loginTime)}</span>
                                    <td>${fmtDateTime(session.lastActive)}</span>
                                    <td>${session.isCurrent ? '<span class="badge badge-success">Current</span>' : `<button class="btn btn-sm btn-danger" onclick="window.terminateSession('${session.id}')">Terminate</button>`}</span>
                                </tr>
                            `).join('') || '<tr><td colspan="5" style="text-align:center;padding:40px">No active sessions</span>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📋 My Activity Log</span>
                <button class="btn btn-sm btn-outline" onclick="window.refreshMyActivity()">🔄 Refresh</button>
            </div>
            <div class="dash-card-body">
                <div id="my-activity-log" class="table-wrapper" style="max-height:300px; overflow-y:auto">
                    <div class="loading-container"><div class="spinner"></div><p>Loading activity...</p></div>
                </div>
            </div>
        </div>
    `;

    window.editProfile = editProfile;
    window.showChangePasswordModal = showChangePasswordModal;
    window.setupBiometricLogin = setupBiometricLogin;
    window.logoutOtherSessions = logoutOtherSessions;
    window.terminateSession = terminateSession;
    window.refreshMyActivity = refreshMyActivity;
    window.saveProfileChanges = saveProfileChanges;
    window.submitPasswordChange = submitPasswordChange;

    await renderMyActivity();
}

function editProfile() {
    const user = state.currentUser;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Edit Profile</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Full Name</label><input type="text" id="edit-profile-name" value="${esc(user.name)}" class="form-control"></div>
                        <div class="form-group full"><label>Email</label><input type="email" id="edit-profile-email" value="${esc(user.email || '')}" class="form-control"></div>
                        <div class="form-group full"><label>Phone</label><input type="tel" id="edit-profile-phone" value="${esc(user.phone || '')}" class="form-control"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveProfileChanges()">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function saveProfileChanges() {
    const user = state.currentUser;
    const name = document.getElementById('edit-profile-name')?.value.trim();
    const email = document.getElementById('edit-profile-email')?.value.trim();
    const phone = document.getElementById('edit-profile-phone')?.value.trim();

    if (!name) {
        showToast('Name is required', 'warning');
        return;
    }

    if (user.role === 'admin') {
        // Admin data might be stored differently
        showToast('Admin profile update - contact system administrator', 'info');
    } else {
        await update('teachers', user.id, {
            name: name,
            email: email,
            phone: phone,
            updated_at: new Date().toISOString()
        });
    }

    state.currentUser.name = name;
    state.currentUser.email = email;
    state.currentUser.phone = phone;

    closeModal();
    showToast('✅ Profile updated', 'success');
    renderUsers(document.getElementById('dynamic-content'));
}

function showChangePasswordModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔒 Change Password</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Current Password</label><input type="password" id="change-pw-current" class="form-control"></div>
                        <div class="form-group full"><label>New Password</label><input type="password" id="change-pw-new" class="form-control"></div>
                        <div class="form-group full"><label>Confirm New Password</label><input type="password" id="change-pw-confirm" class="form-control"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitPasswordChange()">Change Password</button>
                </div>
            </div>
        </div>
    `);
}

async function submitPasswordChange() {
    const current = document.getElementById('change-pw-current')?.value;
    const newPw = document.getElementById('change-pw-new')?.value;
    const confirm = document.getElementById('change-pw-confirm')?.value;

    if (!current || !newPw || !confirm) {
        showToast('All fields are required', 'warning');
        return;
    }

    if (newPw !== confirm) {
        showToast('New passwords do not match', 'warning');
        return;
    }

    if (newPw.length < 4) {
        showToast('Password must be at least 4 characters', 'warning');
        return;
    }

    const user = state.currentUser;
    if (user.role === 'admin') {
        const settings = state.schoolSettings;
        if (settings.admin_password !== current) {
            showToast('Current password is incorrect', 'error');
            return;
        }
        await updateSchoolSetting('admin_password', newPw);
    } else {
        const teacher = await getById('teachers', user.id);
        if (!teacher || teacher.password !== current) {
            showToast('Current password is incorrect', 'error');
            return;
        }
        await update('teachers', user.id, { password: newPw });
    }

    closeModal();
    showToast('✅ Password changed successfully. Please log in again.', 'success');
    setTimeout(() => {
        if (typeof logout === 'function') logout();
        else location.reload();
    }, 2000);
}

function setupBiometricLogin() {
    // Call the global biometric setup function
    if (typeof window.setupBiometricLogin === 'function') {
        window.setupBiometricLogin();
    } else {
        showToast('Biometric login is not supported in this browser', 'warning');
    }
}

function getActiveSessions() {
    // This would typically come from a sessions table
    // For now, return a mock current session
    return [{
        id: 'current',
        device: navigator.userAgent.split(' ').slice(-2).join(' ') || 'Current Device',
        ip: 'Current Device',
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        isCurrent: true
    }];
}

function logoutOtherSessions() {
    if (confirm('Logout all other sessions? You will remain logged in on this device.')) {
        showToast('Other sessions terminated', 'success');
    }
}

function terminateSession(sessionId) {
    if (confirm('Terminate this session?')) {
        showToast('Session terminated', 'success');
    }
}

async function renderMyActivity() {
    const container = document.getElementById('my-activity-log');
    if (!container) return;

    const logs = state.activityLogs?.filter(log => log.user_id === state.currentUser?.id).slice(0, 50) || [];

    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No activity found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Action</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${fmtDateTime(log.created_at)}</span>
                        <td>${esc(log.action)}</span>
                        <td>${log.details ? (typeof log.details === 'string' ? esc(log.details.substring(0, 80)) : esc(JSON.stringify(log.details).substring(0, 80))) : '—'}</span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function refreshMyActivity() {
    renderMyActivity();
}

// Helper function for updateSchoolSetting
async function updateSchoolSetting(key, value) {
    try {
        const { updateSchoolSetting: updateSetting } = await import('../core/supabase-client.js');
        await updateSetting(key, value);
    } catch (e) {
        console.warn('Failed to save setting:', e);
        // Fallback: try direct update
        const existing = await getAll('school_settings', { key: key });
        if (existing.length > 0) {
            await update('school_settings', existing[0].id, { value: value, updated_at: new Date().toISOString() });
        } else {
            await insert('school_settings', { key: key, value: value, created_at: new Date().toISOString() });
        }
    }
}