// SECTION 65: BACKUP & RESTORE
        // ================================================================

        async function renderBackupRestore(container) {
            await ensureStateLoaded();

            let backupHistory = [];
            try {
                backupHistory = JSON.parse(localStorage.getItem('elf_backup_history') || '[]');
            } catch (e) { backupHistory = []; }

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">💾 Backup & Restore</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.showBackupList()">📋 Backup History</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportAllBackups()">📤 Export All Backups</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                    <h4 style="margin-bottom: 12px;">💾 MANUAL BACKUP</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Download a complete backup of all school data.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="window.doFullBackupWithHistory()">📥 Download Full Backup</button>
                        <button class="btn btn-outline" onclick="window.createFullBackup()">💾 Create Backup (Keep in System)</button>
                    </div>
                    <span style="margin-left: 12px; font-size: 12px; color: var(--text-muted);">Last backup: ${backupHistory[0] ? fmtDate(backupHistory[0].date) : 'Never'}</span>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                    <h4 style="margin-bottom: 12px;">🔄 RESTORE FROM BACKUP</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">⚠️ Warning: Restoring will replace ALL current data!</p>
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <input type="file" id="restore-file" accept=".json" style="display:none" onchange="window.previewRestoreFile()">
                        <button class="btn btn-outline" onclick="document.getElementById('restore-file').click()">📂 Select Backup File</button>
                        <button class="btn btn-danger" id="restore-btn" style="display:none" onclick="window.confirmRestore()">⚠️ Restore Data</button>
                    </div>
                    <div id="restore-preview" style="margin-top: 12px; display: none;"></div>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                    <h4 style="margin-bottom: 12px;">🤖 AUTOMATIC BACKUP SCHEDULE</h4>
                    <div class="form-grid">
                        <div class="form-group"><label>Enable Auto-Backup</label><select id="auto-backup-enabled" class="form-control"><option value="true" ${localStorage.getItem('auto_backup_enabled') === 'true' ? 'selected' : ''}>Yes</option><option value="false" ${localStorage.getItem('auto_backup_enabled') !== 'true' ? 'selected' : ''}>No</option></select></div>
                        <div class="form-group"><label>Frequency</label><select id="auto-backup-frequency" class="form-control"><option value="daily" ${localStorage.getItem('auto_backup_frequency') === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${localStorage.getItem('auto_backup_frequency') === 'weekly' ? 'selected' : ''}>Weekly</option><option value="monthly" ${localStorage.getItem('auto_backup_frequency') === 'monthly' || !localStorage.getItem('auto_backup_frequency') ? 'selected' : ''}>Monthly</option></select></div>
                        <div class="form-group"><label>Keep backups</label><select id="auto-backup-keep" class="form-control"><option value="3">Last 3 backups</option><option value="5">Last 5 backups</option><option value="10" selected>Last 10 backups</option></select></div>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="window.saveAutoBackupSettings()" style="margin-top: 12px;">💾 Save Settings</button>
                </div>

                <div>
                    <h4 style="margin-bottom: 12px;">📋 BACKUP HISTORY</h4>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Type</th><th>Size</th><th>Records</th><th>Actions</th></tr>
                            </thead>
                            <tbody id="backup-history-tbody">
                                ${backupHistory.map(b => `
                                    <tr>
                                        <td>${fmtDateTime(b.date)}</td>
                                        <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
                                        <td>${b.size || '—'}</td>
                                        <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.downloadBackupFile('${b.filename}', '${b.data}')">📥 Download</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteBackupRecord('${b.filename}')">🗑️ Delete</button>
                                        </td>
                                    </tr>
                                `).join('') || '<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No backups found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

            window.doFullBackupWithHistory = doFullBackupWithHistory;
            window.createFullBackup = createFullBackup;
            window.previewRestoreFile = previewRestoreFile;
            window.confirmRestore = confirmRestore;
            window.saveAutoBackupSettings = saveAutoBackupSettings;
            window.showBackupList = showBackupList;
            window.exportAllBackups = exportAllBackups;
            window.downloadBackupFile = downloadBackupFile;
            window.deleteBackupRecord = deleteBackupRecord;
        }
        window.renderBackupRestore = renderBackupRestore;

        async function createFullBackup() {
            await ensureStateLoaded();
            showToast('⏳ Creating backup…', 'info', 3000);
            const tables = ['students', 'classes', 'subjects', 'teachers', 'terms', 'academicYears', 'assessments', 'marks', 'payments', 'studentFees', 'feeCategories', 'attendance', 'families', 'activityLogs', 'announcements'];
            const backup = { version: '9.0', created_at: new Date().toISOString(), school: state.schoolSettings?.school_name || 'ECOLE LA FONTAINE', data: {} };
            for (const table of tables) {
                const stateKey = table;
                const dbTable = table.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (state[stateKey]?.length) { backup.data[dbTable] = state[stateKey]; }
                else {
                    try {
                        const r = await apiRequest(dbTable + '?limit=10000');
                        if (r.success) backup.data[dbTable] = r.data;
                    } catch (e) { }
                }
            }
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ELF_Backup_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Created full backup', 'backup');
            showToast('✅ Backup downloaded', 'success');
        }
        window.createFullBackup = createFullBackup;

        async function doFullBackupWithHistory() { await createFullBackup(); }
        window.doFullBackupWithHistory = doFullBackupWithHistory;

        async function downloadBackupFile(filename, data) {
            if (data) {
                downloadBlob(data, filename, 'application/json');
                showToast('✅ Backup downloaded', 'success');
            } else {
                await createFullBackup();
            }
        }
        window.downloadBackupFile = downloadBackupFile;

        function saveAutoBackupSettings() {
            const enabled = document.getElementById('auto-backup-enabled')?.value === 'true';
            const frequency = document.getElementById('auto-backup-frequency')?.value;
            const keep = document.getElementById('auto-backup-keep')?.value;
            localStorage.setItem('auto_backup_enabled', enabled);
            localStorage.setItem('auto_backup_frequency', frequency);
            localStorage.setItem('auto_backup_keep', keep);
            showToast('✅ Auto-backup settings saved', 'success');
        }
        window.saveAutoBackupSettings = saveAutoBackupSettings;

        function showBackupList() {
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('elf_backup_history') || '[]'); } catch (e) { backups = []; }
            const rows = backups.map(b => `
        <tr>
            <td>${fmtDateTime(b.date)}</td>
            <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
            <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</td>
            <td>${b.size || '—'}</td>
            <td><button class="btn btn-sm btn-outline" onclick="downloadBackupFile('${esc(b.filename)}','')">📥 Download</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBackupRecord('${esc(b.filename)}')">🗑️</button></td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No backup history found</td></tr>';
            showModal(`<div class="modal-overlay"><div class="modal modal-lg" style="max-width:700px"><div class="modal-header"><h3>📋 Backup History</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Records</th><th>Size</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button></div></div></div>`);
        }
        window.showBackupList = showBackupList;

        function exportAllBackups() {
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('elf_backup_history') || '[]'); } catch (e) { backups = []; }
            if (!backups.length) { showToast('No backups to export', 'warning'); return; }
            const exportData = backups.map(b => ({
                date: b.date,
                type: b.type,
                filename: b.filename,
                size: b.size,
                records: b.records
            }));
            downloadBlob(JSON.stringify(exportData, null, 2), `Backup_History_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
            showToast('✅ Backup history exported', 'success');
        }
        window.exportAllBackups = exportAllBackups;

        function deleteBackupRecord(filename) {
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('elf_backup_history') || '[]'); } catch (e) { backups = []; }
            backups = backups.filter(b => b.filename !== filename);
            localStorage.setItem('elf_backup_history', JSON.stringify(backups));
            showToast('✅ Backup record deleted', 'success');
            renderBackupRestore(document.getElementById('dynamic-content'));
        }
        window.deleteBackupRecord = deleteBackupRecord;

        // ================================================================
