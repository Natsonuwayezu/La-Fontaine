// js/modules/analytics-settings.js
// Analytics Settings - Configure analytics and reporting preferences

import { state } from '../core/state.js';
import { getAll, insert, update, updateSchoolSetting } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';

export async function renderAnalyticsSettings(container) {
    await ensureStateLoaded();

    const settings = state.schoolSettings;

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Analytics Settings</span>
                <button class="btn btn-sm btn-success" onclick="window.saveAnalyticsSettings()">💾 Save Settings</button>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Default Analytics Period</label>
                        <select id="analytics-period" class="form-control">
                            <option value="current_term" ${settings.analytics_period === 'current_term' ? 'selected' : ''}>Current Term</option>
                            <option value="current_year" ${settings.analytics_period === 'current_year' ? 'selected' : ''}>Current Academic Year</option>
                            <option value="last_3_years" ${settings.analytics_period === 'last_3_years' ? 'selected' : ''}>Last 3 Years</option>
                            <option value="all" ${settings.analytics_period === 'all' ? 'selected' : ''}>All Time</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Dashboard Charts Refresh Rate (seconds)</label>
                        <input type="number" id="analytics-refresh-rate" value="${settings.analytics_refresh_rate || 60}" min="10" max="3600" class="form-control">
                        <small class="field-hint">How often auto-refresh analytics charts (0 = disabled)</small>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="analytics-show-comparison" ${settings.analytics_show_comparison !== false ? 'checked' : ''}> Show Year-over-Year Comparison</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="analytics-show-trend-lines" ${settings.analytics_show_trend_lines !== false ? 'checked' : ''}> Show Trend Lines on Charts</label>
                    </div>
                    <div class="form-group full">
                        <label>Default Report Format</label>
                        <select id="analytics-default-format" class="form-control">
                            <option value="pdf" ${settings.analytics_default_format === 'pdf' ? 'selected' : ''}>PDF Document</option>
                            <option value="excel" ${settings.analytics_default_format === 'excel' ? 'selected' : ''}>Excel Spreadsheet</option>
                            <option value="csv" ${settings.analytics_default_format === 'csv' ? 'selected' : ''}>CSV File</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📈 Report Templates</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportReportTemplates()">📥 Export Templates</button>
                    <button class="btn btn-sm btn-primary" onclick="window.openUploadTemplateModal()">📤 Upload Custom Template</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div id="report-templates-list" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading templates...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Cached Analytics Data</span>
                <button class="btn btn-sm btn-danger" onclick="window.clearAnalyticsCache()">🗑️ Clear Cache</button>
            </div>
            <div class="dash-card-body">
                <div id="cache-stats" class="alert alert-info">
                    Last cache update: ${localStorage.getItem('analytics_cache_time') ? new Date(localStorage.getItem('analytics_cache_time')).toLocaleString() : 'Never'}
                </div>
            </div>
        </div>
    `;

    await loadReportTemplates();

    window.saveAnalyticsSettings = saveAnalyticsSettings;
    window.exportReportTemplates = exportReportTemplates;
    window.openUploadTemplateModal = openUploadTemplateModal;
    window.clearAnalyticsCache = clearAnalyticsCache;
}

async function loadReportTemplates() {
    let templates = [];
    try {
        templates = await getAll('report_templates');
    } catch (e) {
        templates = [];
    }

    const container = document.getElementById('report-templates-list');
    if (!container) return;

    if (templates.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No custom report templates uploaded yet</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Template Name</th><th>Type</th><th>Uploaded</th><th>Size</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${templates.map(t => `
                    <tr>
                        <td><strong>${esc(t.name)}</strong></span>
                        <td><span class="badge badge-info">${esc(t.type)}</span></span>
                        <td>${fmtDate(t.created_at)}</span>
                        <td>${t.file_size ? (t.file_size / 1024).toFixed(1) + ' KB' : '—'}</span>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="window.previewTemplate(${t.id})">👁️ Preview</button>
                            <button class="btn btn-sm btn-danger" onclick="window.deleteTemplate(${t.id})">🗑️</button>
                         </span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function saveAnalyticsSettings() {
    const period = document.getElementById('analytics-period')?.value;
    const refreshRate = parseInt(document.getElementById('analytics-refresh-rate')?.value) || 60;
    const showComparison = document.getElementById('analytics-show-comparison')?.checked || false;
    const showTrendLines = document.getElementById('analytics-show-trend-lines')?.checked || false;
    const defaultFormat = document.getElementById('analytics-default-format')?.value;

    await updateSchoolSetting('analytics_period', period);
    await updateSchoolSetting('analytics_refresh_rate', String(refreshRate));
    await updateSchoolSetting('analytics_show_comparison', String(showComparison));
    await updateSchoolSetting('analytics_show_trend_lines', String(showTrendLines));
    await updateSchoolSetting('analytics_default_format', defaultFormat);

    // Reload settings
    await refreshTable('school_settings');
    showToast('✅ Analytics settings saved', 'success');
}

function exportReportTemplates() {
    // Get templates from localStorage or generate default
    const templates = {
        report_card: 'Standard report card template with grades and comments',
        transcript: 'Academic transcript with all subjects and terms',
        attendance: 'Monthly attendance summary report',
        fee_statement: 'Fee payment statement with receipt history'
    };

    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_templates_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Templates exported', 'success');
}

function openUploadTemplateModal() {
    showModal(`
        <div class="modal-overlay" id="upload-template-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📤 Upload Report Template</h3>
                    <button class="modal-close" onclick="closeModal('upload-template-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Template Name *</label>
                            <input type="text" id="template-name" placeholder="e.g., Custom Report Card" class="form-control">
                        </div>
                        <div class="form-group full">
                            <label>Template Type</label>
                            <select id="template-type" class="form-control">
                                <option value="report_card">Report Card</option>
                                <option value="transcript">Transcript</option>
                                <option value="fee_statement">Fee Statement</option>
                                <option value="attendance">Attendance Report</option>
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>HTML Template File *</label>
                            <input type="file" id="template-file" accept=".html,.htm" class="form-control">
                            <small class="field-hint">Upload an HTML file with the template structure</small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('upload-template-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.uploadTemplate()">📤 Upload</button>
                </div>
            </div>
        </div>
    `);

    window.uploadTemplate = uploadTemplate;
}

async function uploadTemplate() {
    const name = document.getElementById('template-name')?.value.trim();
    const type = document.getElementById('template-type')?.value;
    const file = document.getElementById('template-file')?.files[0];

    if (!name || !file) {
        showToast('Template name and file are required', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;

        await insert('report_templates', {
            name: name,
            type: type,
            content: content,
            file_size: file.size,
            created_at: new Date().toISOString(),
            created_by: state.currentUser?.id
        });

        closeModal('upload-template-modal');
        showToast('✅ Template uploaded successfully', 'success');
        await loadReportTemplates();
    };
    reader.readAsText(file);
}

async function deleteTemplate(templateId) {
    if (!await confirmDialog('Delete this template?')) return;
    await remove('report_templates', templateId);
    showToast('✅ Template deleted', 'success');
    await loadReportTemplates();
}

function clearAnalyticsCache() {
    if (confirm('Clear all cached analytics data? Charts will reload from database.')) {
        localStorage.removeItem('analytics_cache');
        localStorage.removeItem('analytics_cache_time');
        showToast('✅ Analytics cache cleared', 'success');
        document.getElementById('cache-stats').innerHTML = 'Cache cleared. Data will reload on next analytics view.';
    }
}