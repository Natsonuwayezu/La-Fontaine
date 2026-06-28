// js/modules/api-settings.js
// API Settings Module - Configure Supabase connection and database settings

import { state } from '../core/state.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { esc } from '../core/utils.js';

// Default values from original HTML
const DEFAULT_URL = 'https://hejdppzparottbcnycjo.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlamRwcHpwYXJvdHRiY255Y2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Nzg3OTMsImV4cCI6MjA5NDQ1NDc5M30.vi7Xa3eF9D9OTCkDZUYn6ScsyuQPwb0eN9nNazPpFcc';

// Global Supabase variables (these will be set from window or localStorage)
let SUPABASE_URL = localStorage.getItem('sb_url') || DEFAULT_URL;
let SUPABASE_KEY = localStorage.getItem('sb_key') || DEFAULT_KEY;

export async function renderApiSettings(container) {
    const user = state.currentUser;
    if (!user || user.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const currentUrl = SUPABASE_URL;
    const currentKey = SUPABASE_KEY;

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <h3><span>🔌</span> API Settings</h3>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-warning">
                    <strong>⚠️ Warning:</strong> Changing API settings will affect all database connections.
                    The page will reload after saving.
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Supabase URL</label>
                        <input type="text" id="api-url" value="${esc(currentUrl)}" placeholder="https://your-project.supabase.co" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Anon Key</label>
                        <div class="pw-field" style="display:flex; gap:8px;">
                            <input type="password" id="api-key" value="${esc(currentKey)}" placeholder="eyJhbGciOiJIUzI1NiIs..." class="form-control" style="flex:1">
                            <button class="btn btn-sm btn-outline" onclick="window.toggleApiKeyVisibility()" type="button">👁️</button>
                        </div>
                    </div>
                </div>
                <div class="btn-group" style="margin-top:16px">
                    <button class="btn btn-primary" onclick="window.testApiConnection()">🔌 Test Connection</button>
                    <button class="btn btn-success" onclick="window.saveApiSettings()">💾 Save Settings</button>
                    <button class="btn btn-outline" onclick="window.resetApiSettings()">🔄 Reset to Default</button>
                    <button class="btn btn-outline" onclick="window.showDataSummary()">📊 Data Summary</button>
                </div>
                <div id="api-connection-status" style="margin-top:20px;display:none"></div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <h3><span>🗄️</span> Database Information</h3>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Current Environment</label>
                        <input type="text" readonly value="${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'Development' : 'Production'}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>API Version</label>
                        <input type="text" readonly value="v1 (REST)" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Last Connection Test</label>
                        <input type="text" readonly id="last-connection-test" value="${localStorage.getItem('last_api_test') || 'Never'}" class="form-control">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Register global functions
    window.toggleApiKeyVisibility = toggleApiKeyVisibility;
    window.testApiConnection = testApiConnection;
    window.saveApiSettings = saveApiSettings;
    window.resetApiSettings = resetApiSettings;
    window.showDataSummary = showDataSummary;
}

function toggleApiKeyVisibility() {
    const keyInput = document.getElementById('api-key');
    if (keyInput) {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    }
}

async function testApiConnection() {
    const url = document.getElementById('api-url')?.value.trim().replace(/\/$/, '');
    const key = document.getElementById('api-key')?.value.trim();
    const statusDiv = document.getElementById('api-connection-status');

    if (!url || !key) {
        statusDiv.innerHTML = '<div class="alert alert-danger">Please enter both URL and API Key</div>';
        statusDiv.style.display = 'block';
        return;
    }

    statusDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Testing connection...</p></div>';
    statusDiv.style.display = 'block';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(`${url}/rest/v1/school_settings?select=key&limit=1`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
            statusDiv.innerHTML = '<div class="alert alert-success">✅ Connection successful! Database is reachable.</div>';
            localStorage.setItem('last_api_test', new Date().toLocaleString());
            const lastTestInput = document.getElementById('last-connection-test');
            if (lastTestInput) lastTestInput.value = new Date().toLocaleString();
        } else if (resp.status === 401) {
            statusDiv.innerHTML = '<div class="alert alert-danger">❌ Authentication failed. Invalid API key.</div>';
        } else if (resp.status === 404) {
            statusDiv.innerHTML = '<div class="alert alert-danger">❌ URL not found. Check your Supabase URL.</div>';
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ Connection failed: HTTP ${resp.status}</div>`;
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            statusDiv.innerHTML = '<div class="alert alert-danger">❌ Connection timeout. Check your network and URL.</div>';
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ Connection error: ${err.message}</div>`;
        }
    }
}

async function saveApiSettings() {
    const url = document.getElementById('api-url')?.value.trim().replace(/\/$/, '');
    const key = document.getElementById('api-key')?.value.trim();

    if (!url || !key) {
        showToast('Please enter both URL and API Key', 'error');
        return;
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        showToast('Invalid URL format', 'error');
        return;
    }

    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);

    // Update global variables
    SUPABASE_URL = url;
    SUPABASE_KEY = key;

    // Also update window variables for compatibility with existing code
    if (typeof window !== 'undefined') {
        window.SUPABASE_URL = url;
        window.SUPABASE_KEY = key;
    }

    showToast('✅ API settings saved! Page will reload.', 'success');
    setTimeout(() => location.reload(), 1500);
}

function resetApiSettings() {
    if (confirm('Reset API settings to default? This will revert to the original Supabase connection.')) {
        document.getElementById('api-url').value = DEFAULT_URL;
        document.getElementById('api-key').value = DEFAULT_KEY;
        showToast('Settings reset to default. Click Save to apply.', 'info');
    }
}

async function showDataSummary() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📊 Database Record Summary</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div id="summary-content" class="loading-container">
                        <div class="spinner"></div>
                        <p>Loading data counts...</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);

    // Load summary data
    const summaryDiv = document.getElementById('summary-content');
    if (!summaryDiv) return;

    const tables = [
        { name: 'Students', key: 'students' },
        { name: 'Teachers', key: 'teachers' },
        { name: 'Classes', key: 'classes' },
        { name: 'Subjects', key: 'subjects' },
        { name: 'Terms', key: 'terms' },
        { name: 'Academic Years', key: 'academicYears' },
        { name: 'Assessments', key: 'assessments' },
        { name: 'Marks', key: 'marks' },
        { name: 'Payments', key: 'payments' },
        { name: 'Fee Categories', key: 'feeCategories' },
        { name: 'Student Fees', key: 'studentFees' },
        { name: 'Families', key: 'families' }
    ];

    let totalRecords = 0;
    const rows = tables.map(table => {
        const count = state[table.key]?.length || 0;
        totalRecords += count;
        return `
            <tr>
                <td><strong>${table.name}</strong></span>
                <td>${count.toLocaleString()}</span>
                <td><span class="badge ${count > 0 ? 'badge-success' : 'badge-neutral'}">${count > 0 ? '✅' : '⚠️'}</span></span>
            </tr>
        `;
    }).join('');

    summaryDiv.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr><th>Table</th><th style="text-align:right">Records</th><th>Status</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="font-weight:700;background:var(--bg-tertiary)">
                        <td><strong>TOTAL RECORDS</strong></span>
                        <td style="text-align:right"><strong>${totalRecords.toLocaleString()}</strong></span>
                        <td></span>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div class="alert alert-info" style="margin-top:12px;font-size:.8rem">
            Data as of ${new Date().toLocaleString()}
        </div>
    `;
}