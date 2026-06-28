// js/modules/settings.js
// Settings Module - Main settings router for all settings pages

import { state } from '../core/state.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { esc } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';

export async function renderSettings(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const modules = [
        { id: 'school-settings', icon: '🏫', name: 'School Settings', description: 'Configure school information, logo, contact details' },
        { id: 'academic-calendar', icon: '📅', name: 'Academic Calendar', description: 'Manage terms, holidays, and auto-reset rules' },
        { id: 'class-management', icon: '🏛️', name: 'Class Management', description: 'Manage classes, sections, capacities' },
        { id: 'grading-scale', icon: '📊', name: 'Grading Scale', description: 'Configure grade boundaries and descriptions' },
        { id: 'user-management', icon: '👥', name: 'User Management', description: 'Manage teacher and staff accounts' },
        { id: 'backup-restore', icon: '💾', name: 'Backup & Restore', description: 'Backup and restore system data' },
        { id: 'system-logs', icon: '📋', name: 'System Logs', description: 'View and export system activity logs' },
        { id: 'api-settings', icon: '🔌', name: 'API Settings', description: 'Configure Supabase connection settings' },
        { id: 'academic-years', icon: '📆', name: 'Academic Years', description: 'Manage academic years and terms' },
        { id: 'analytics-settings', icon: '📈', name: 'Analytics Settings', description: 'Configure analytics and reporting preferences' },
        { id: 'system-health', icon: '🩺', name: 'System Health', description: 'Monitor system performance and status' }
    ];

    container.innerHTML = `
        <div class="settings-container">
            <div class="dash-card">
                <div class="dash-card-header">
                    <span class="dash-card-title">⚙️ System Settings</span>
                </div>
                <div class="dash-card-body">
                    <div class="settings-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px">
                        ${modules.map(module => `
                            <div class="setting-card" style="
                                background:var(--bg-secondary);
                                border:1px solid var(--border-light);
                                border-radius:var(--r-lg);
                                padding:16px;
                                cursor:pointer;
                                transition:all 0.2s;
                                display:flex;
                                align-items:center;
                                gap:16px;
                            " onclick="window.navigateTo('${module.id}')">
                                <div style="font-size:2rem;">${module.icon}</div>
                                <div style="flex:1">
                                    <div style="font-weight:700; margin-bottom:4px">${module.name}</div>
                                    <div style="font-size:12px; color:var(--text-muted)">${module.description}</div>
                                </div>
                                <div style="font-size:1.2rem; color:var(--text-muted)">→</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="dash-card" style="margin-top:20px">
                <div class="dash-card-header">
                    <span class="dash-card-title">ℹ️ System Information</span>
                </div>
                <div class="dash-card-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Version</label><input readonly value="7.0.0" class="form-control"></div>
                        <div class="form-group"><label>Environment</label><input readonly value="${window.location.hostname === 'localhost' ? 'Development' : 'Production'}" class="form-control"></div>
                        <div class="form-group"><label>Last Login</label><input readonly value="${new Date().toLocaleString()}" class="form-control"></div>
                        <div class="form-group"><label>Database Status</label><input readonly value="${navigator.onLine ? '🟢 Connected' : '🔴 Offline'}" class="form-control"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}