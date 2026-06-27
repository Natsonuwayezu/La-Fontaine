// SECTION 68: ANALYTICS SETTINGS
        // ================================================================

        async function renderAnalyticsSettings(container) {
            await ensureStateLoaded();

            const settings = state.schoolSettings;

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">📊 Analytics Settings</span><button class="btn btn-sm btn-success" onclick="window.saveAnalyticsSettings()">💾 Save Settings</button></div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group"><label>Default Analytics Period</label><select id="analytics-period" class="form-control"><option value="current_term" ${settings.analytics_period === 'current_term' ? 'selected' : ''}>Current Term</option><option value="current_year" ${settings.analytics_period === 'current_year' ? 'selected' : ''}>Current Academic Year</option><option value="last_3_years" ${settings.analytics_period === 'last_3_years' ? 'selected' : ''}>Last 3 Years</option><option value="all" ${settings.analytics_period === 'all' ? 'selected' : ''}>All Time</option></select></div>
                    <div class="form-group"><label>Dashboard Charts Refresh Rate (seconds)</label><input type="number" id="analytics-refresh-rate" value="${settings.analytics_refresh_rate || 60}" min="10" max="3600" class="form-control"><small class="field-hint">How often auto-refresh analytics charts (0 = disabled)</small></div>
                    <div class="form-group"><label><input type="checkbox" id="analytics-show-comparison" ${settings.analytics_show_comparison !== false ? 'checked' : ''}> Show Year-over-Year Comparison</label></div>
                    <div class="form-group"><label><input type="checkbox" id="analytics-show-trend-lines" ${settings.analytics_show_trend_lines !== false ? 'checked' : ''}> Show Trend Lines on Charts</label></div>
                    <div class="form-group full"><label>Default Report Format</label><select id="analytics-default-format" class="form-control"><option value="pdf" ${settings.analytics_default_format === 'pdf' ? 'selected' : ''}>PDF Document</option><option value="excel" ${settings.analytics_default_format === 'excel' ? 'selected' : ''}>Excel Spreadsheet</option><option value="csv" ${settings.analytics_default_format === 'csv' ? 'selected' : ''}>CSV File</option></select></div>
                </div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📈 Report Templates</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="window.exportReportTemplates()">📥 Export Templates</button><button class="btn btn-sm btn-primary" onclick="window.openUploadTemplateModal()">📤 Upload Custom Template</button></div></div><div class="dash-card-body"><div id="report-templates-list" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading templates...</p></div></div></div></div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📊 Cached Analytics Data</span><button class="btn btn-sm btn-danger" onclick="window.clearAnalyticsCache()">🗑️ Clear Cache</button></div><div class="dash-card-body"><div id="cache-stats" class="alert alert-info">Last cache update: ${localStorage.getItem('analytics_cache_time') ? new Date(localStorage.getItem('analytics_cache_time')).toLocaleString() : 'Never'}</div></div></div>
    `;
        }
        window.renderAnalyticsSettings = renderAnalyticsSettings;

        function saveAnalyticsSettings() {
            const period = document.getElementById('analytics-period')?.value;
            const refreshRate = parseInt(document.getElementById('analytics-refresh-rate')?.value) || 60;
            const showComp = document.getElementById('analytics-show-comparison')?.checked || false;
            const showTrend = document.getElementById('analytics-show-trend-lines')?.checked || false;
            const defaultFmt = document.getElementById('analytics-default-format')?.value;
            localStorage.setItem('analytics_period', period);
            localStorage.setItem('analytics_refresh_rate', String(refreshRate));
            localStorage.setItem('analytics_show_comparison', String(showComp));
            localStorage.setItem('analytics_show_trend_lines', String(showTrend));
            localStorage.setItem('analytics_default_format', defaultFmt);
            showToast('✅ Analytics settings saved', 'success');
        }
        window.saveAnalyticsSettings = saveAnalyticsSettings;

        function exportReportTemplates() {
            const templates = {
                report_card: 'Standard report card template with grades and comments',
                transcript: 'Academic transcript with all subjects and terms',
                attendance: 'Monthly attendance summary report',
                fee_statement: 'Fee payment statement with receipt history'
            };
            downloadBlob(JSON.stringify(templates, null, 2), `report_templates_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
            showToast('✅ Templates exported', 'success');
        }
        window.exportReportTemplates = exportReportTemplates;

        function openUploadTemplateModal() {
            showModal(`<div class="modal-overlay" id="upload-template-modal"><div class="modal" onclick="event.stopPropagation()" style="max-width:500px"><div class="modal-header"><h3>📤 Upload Report Template</h3><button class="modal-close" onclick="closeModal('upload-template-modal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group full"><label>Template Name *</label><input type="text" id="template-name" placeholder="e.g., Custom Report Card"></div><div class="form-group full"><label>Template Type</label><select id="template-type"><option value="report_card">Report Card</option><option value="transcript">Transcript</option><option value="fee_statement">Fee Statement</option><option value="attendance">Attendance Report</option></select></div><div class="form-group full"><label>HTML Template File *</label><input type="file" id="template-file" accept=".html,.htm"><small>Upload an HTML file with the template structure</small></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('upload-template-modal')">Cancel</button><button class="btn btn-primary" onclick="window.uploadTemplate()">📤 Upload</button></div></div></div>`);
            window.uploadTemplate = async function () {
                const name = document.getElementById('template-name')?.value.trim();
                const type = document.getElementById('template-type')?.value;
                const file = document.getElementById('template-file')?.files[0];
                if (!name || !file) { showToast('Name and file required', 'warning'); return; }
                const reader = new FileReader();
                reader.onload = async e => {
                    await insert('report_templates', {
                        name, type, content: e.target.result,
                        file_size: file.size, created_at: new Date().toISOString(),
                        created_by: state.currentUser?.id
                    });
                    closeModal('upload-template-modal');
                    showToast('✅ Template uploaded', 'success');
                };
                reader.readAsText(file);
            };
        }
        window.openUploadTemplateModal = openUploadTemplateModal;

        function clearAnalyticsCache() {
            if (confirm('Clear all cached analytics data? Charts will reload from the database.')) {
                localStorage.removeItem('analytics_cache');
                localStorage.removeItem('analytics_cache_time');
                showToast('✅ Analytics cache cleared', 'success');
                const el = document.getElementById('cache-stats');
                if (el) el.innerHTML = 'Cache cleared. Data will reload on next analytics view.';
            }
        }
        window.clearAnalyticsCache = clearAnalyticsCache;

        // ================================================================
