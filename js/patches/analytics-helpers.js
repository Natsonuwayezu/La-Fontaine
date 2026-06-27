// ══════════════════════════════════════════════════════════════════════════

        async function saveAnalyticsSettings() {
            const period = document.getElementById('analytics-period')?.value;
            const refreshRate = parseInt(document.getElementById('analytics-refresh-rate')?.value) || 60;
            const showComp = document.getElementById('analytics-show-comparison')?.checked || false;
            const showTrend = document.getElementById('analytics-show-trend-lines')?.checked || false;
            const defaultFmt = document.getElementById('analytics-default-format')?.value;
            await updateSchoolSetting('analytics_period', period);
            await updateSchoolSetting('analytics_refresh_rate', String(refreshRate));
            await updateSchoolSetting('analytics_show_comparison', String(showComp));
            await updateSchoolSetting('analytics_show_trend_lines', String(showTrend));
            await updateSchoolSetting('analytics_default_format', defaultFmt);
            showToast('✅ Analytics settings saved', 'success');
        }

        function exportReportTemplates() {
            const templates = {
                report_card: 'Standard report card template with grades and comments',
                transcript: 'Academic transcript with all subjects and terms',
                attendance: 'Monthly attendance summary report',
                fee_statement: 'Fee payment statement with receipt history'
            };
            downloadBlob(JSON.stringify(templates, null, 2),
                `report_templates_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
            showToast('✅ Templates exported', 'success');
        }

        function openUploadTemplateModal() {
            showModal(`
                <div class="modal-overlay" id="upload-template-modal">
                    <div class="modal" onclick="event.stopPropagation()" style="max-width:500px">
                        <div class="modal-header"><h3>📤 Upload Report Template</h3>
                            <button class="modal-close" onclick="closeModal('upload-template-modal')">✕</button></div>
                        <div class="modal-body"><div class="form-grid">
                            <div class="form-group full"><label>Template Name *</label>
                                <input type="text" id="template-name" placeholder="e.g., Custom Report Card"></div>
                            <div class="form-group full"><label>Template Type</label>
                                <select id="template-type">
                                    <option value="report_card">Report Card</option>
                                    <option value="transcript">Transcript</option>
                                    <option value="fee_statement">Fee Statement</option>
                                    <option value="attendance">Attendance Report</option>
                                </select></div>
                            <div class="form-group full"><label>HTML Template File *</label>
                                <input type="file" id="template-file" accept=".html,.htm">
                                <small>Upload an HTML file with the template structure</small></div>
                        </div></div>
                        <div class="modal-footer">
                            <button class="btn btn-outline" onclick="closeModal('upload-template-modal')">Cancel</button>
                            <button class="btn btn-primary" onclick="window.uploadTemplate()">📤 Upload</button>
                        </div>
                    </div>
                </div>`);
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

        function clearAnalyticsCache() {
            if (confirm('Clear all cached analytics data? Charts will reload from the database.')) {
                localStorage.removeItem('analytics_cache');
                localStorage.removeItem('analytics_cache_time');
                showToast('✅ Analytics cache cleared', 'success');
                const el = document.getElementById('cache-stats');
                if (el) el.innerHTML = 'Cache cleared. Data will reload on next analytics view.';
            }
        }

        window.saveAnalyticsSettings = saveAnalyticsSettings;
        window.exportReportTemplates = exportReportTemplates;
        window.openUploadTemplateModal = openUploadTemplateModal;
        window.clearAnalyticsCache = clearAnalyticsCache;


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 103 — ANNOUNCEMENTS helpers
