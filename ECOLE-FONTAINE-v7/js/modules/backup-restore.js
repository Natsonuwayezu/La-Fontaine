// js/modules/backup-restore.js
// Backup & Restore Module - Full system backup and restore functionality

import { state } from '../core/state.js';
import { getAll, insert, remove, removeWhere } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, fmtDateTime, esc, downloadBlob } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';

const BACKUP_KEY = 'ecole_auto_backups';
const MAX_BACKUPS = 10;

export async function renderBackupRestore(container) {
    await ensureStateLoaded();

    let backupHistory = [];
    try {
        backupHistory = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backupHistory = [];
    }

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
                <!-- MANUAL BACKUP -->
                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                    <h4 style="margin-bottom: 12px;">💾 MANUAL BACKUP</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Download a complete backup of all school data.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="window.doFullBackupWithHistory()">📥 Download Full Backup</button>
                        <button class="btn btn-outline" onclick="window.createFullBackup()">💾 Create Backup (Keep in System)</button>
                    </div>
                    <span style="margin-left: 12px; font-size: 12px; color: var(--text-muted);">Last backup: ${backupHistory[0] ? fmtDate(backupHistory[0].date) : 'Never'}</span>
                </div>

                <!-- RESTORE FROM BACKUP -->
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

                <!-- AUTOMATIC BACKUP SCHEDULE -->
                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                    <h4 style="margin-bottom: 12px;">🤖 AUTOMATIC BACKUP SCHEDULE</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Enable Auto-Backup</label>
                            <select id="auto-backup-enabled" class="form-control">
                                <option value="true" ${localStorage.getItem('auto_backup_enabled') === 'true' ? 'selected' : ''}>Yes</option>
                                <option value="false" ${localStorage.getItem('auto_backup_enabled') !== 'true' ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Frequency</label>
                            <select id="auto-backup-frequency" class="form-control">
                                <option value="daily" ${localStorage.getItem('auto_backup_frequency') === 'daily' ? 'selected' : ''}>Daily</option>
                                <option value="weekly" ${localStorage.getItem('auto_backup_frequency') === 'weekly' ? 'selected' : ''}>Weekly</option>
                                <option value="monthly" ${localStorage.getItem('auto_backup_frequency') === 'monthly' || !localStorage.getItem('auto_backup_frequency') ? 'selected' : ''}>Monthly</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Keep backups</label>
                            <select id="auto-backup-keep" class="form-control">
                                <option value="3">Last 3 backups</option>
                                <option value="5">Last 5 backups</option>
                                <option value="10" selected>Last 10 backups</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="window.saveAutoBackupSettings()" style="margin-top: 12px;">💾 Save Settings</button>
                </div>

                <!-- BACKUP HISTORY -->
                <div>
                    <h4 style="margin-bottom: 12px;">📋 BACKUP HISTORY</h4>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Size</th>
                                    <th>Records</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="backup-history-tbody">
                                ${backupHistory.map(b => `
                                    <tr>
                                        <td>${fmtDateTime(b.date)}</span>
                                        <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
                                        <td>${b.size || '—'} </span>
                                        <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</span>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.downloadBackupFile('${b.filename}', '${b.data}')">📥 Download</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteBackupRecord('${b.filename}')">🗑️ Delete</button>
                                         </span>
                                    </table>
                                `).join('') || '<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No backups found</span>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Register functions
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

async function createFullBackup(label = 'manual') {
    const user = state.currentUser;
    if (user?.role !== 'admin') {
        showToast('Only admin can create backups', 'error');
        return null;
    }

    const backup = {
        version: '7.0',
        timestamp: new Date().toISOString(),
        label: label,
        school: state.schoolSettings,
        students: state.students,
        teachers: state.teachers,
        classes: state.classes,
        subjects: state.subjects,
        terms: state.terms,
        academicYears: state.academicYears,
        assessments: state.assessments,
        marks: state.marks,
        payments: state.payments,
        feeCategories: state.feeCategories,
        feeAmounts: state.feeAmounts,
        studentFees: state.studentFees,
        families: state.families || [],
        gradingScale: state.gradingScale
    };

    backup.checksum = Object.values(backup).map(v => JSON.stringify(v).length).reduce((a, b) => a + b, 0);
    return backup;
}

async function doFullBackupWithHistory() {
    const backup = await createFullBackup('manual');
    if (!backup) return;

    const jsonData = JSON.stringify(backup, null, 2);
    const filename = `EcoleLaFontaine_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const size = (jsonData.length / 1024).toFixed(1) + ' KB';

    // Save to history
    let backupHistory = [];
    try {
        backupHistory = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backupHistory = [];
    }

    backupHistory.unshift({
        date: new Date().toISOString(),
        filename: filename,
        size: size,
        type: 'manual',
        data: jsonData,
        records: {
            students: state.students.length,
            marks: state.marks.length,
            payments: state.payments.length
        }
    });

    // Keep only last MAX_BACKUPS
    backupHistory = backupHistory.slice(0, MAX_BACKUPS);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backupHistory));

    downloadBlob(jsonData, filename, 'application/json');
    showToast('✅ Backup downloaded and saved to history', 'success');

    renderBackupRestore(document.getElementById('dynamic-content'));
}

async function previewRestoreFile() {
    const file = document.getElementById('restore-file')?.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            const preview = document.getElementById('restore-preview');
            const restoreBtn = document.getElementById('restore-btn');

            // Verify backup integrity
            if (!data.version || !data.timestamp || !data.students) {
                throw new Error('Invalid backup file structure');
            }

            preview.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Backup Summary:</strong><br>
                    Version: ${data.version}<br>
                    Date: ${fmtDateTime(data.timestamp)}<br>
                    Students: ${data.students?.length || 0}<br>
                    Teachers: ${data.teachers?.length || 0}<br>
                    Classes: ${data.classes?.length || 0}<br>
                    Assessments: ${data.assessments?.length || 0}<br>
                    Marks: ${data.marks?.length || 0}<br>
                    Payments: ${data.payments?.length || 0}
                </div>
            `;
            preview.style.display = 'block';
            restoreBtn.style.display = 'inline-flex';
            window._restoreData = data;
        } catch (e) {
            showToast('Invalid backup file: ' + e.message, 'error');
        }
    };
    reader.readAsText(file);
}

async function confirmRestore() {
    if (!await confirmDialog('⚠️ WARNING: This will replace ALL current data! This action CANNOT be undone!\n\nAre you absolutely sure?')) return;

    const confirmation = prompt('Type "RESTORE" to confirm:');
    if (confirmation !== 'RESTORE') return;

    const data = window._restoreData;
    if (!data) return;

    showToast('Restoring data... This may take a moment.', 'info');

    try {
        // Clear existing data
        await removeWhere('students', 'id IS NOT NULL');
        await removeWhere('teachers', 'id>0');
        await removeWhere('classes', 'id IS NOT NULL');
        await removeWhere('subjects', 'id IS NOT NULL');
        await removeWhere('assessments', 'id IS NOT NULL');
        await removeWhere('marks', 'id IS NOT NULL');
        await removeWhere('payments', 'id IS NOT NULL');
        await removeWhere('student_fees', 'id IS NOT NULL');
        await removeWhere('fee_categories', 'id IS NOT NULL');
        await removeWhere('fee_amounts', 'id IS NOT NULL');
        await removeWhere('families', 'id IS NOT NULL');

        // Insert new data
        for (const student of (data.students || [])) {
            await insert('students', student);
        }
        for (const teacher of (data.teachers || [])) {
            await insert('teachers', teacher);
        }
        for (const cls of (data.classes || [])) {
            await insert('classes', cls);
        }
        for (const subject of (data.subjects || [])) {
            await insert('subjects', subject);
        }
        for (const assessment of (data.assessments || [])) {
            await insert('assessments', assessment);
        }
        for (const mark of (data.marks || [])) {
            await insert('marks', mark);
        }
        for (const payment of (data.payments || [])) {
            await insert('payments', payment);
        }
        for (const fee of (data.studentFees || [])) {
            await insert('student_fees', fee);
        }
        for (const category of (data.feeCategories || [])) {
            await insert('fee_categories', category);
        }
        for (const amount of (data.feeAmounts || [])) {
            await insert('fee_amounts', amount);
        }
        for (const family of (data.families || [])) {
            await insert('families', family);
        }

        await refreshTable('students');
        await refreshTable('teachers');
        await refreshTable('classes');
        await refreshTable('subjects');
        await refreshTable('assessments');
        await refreshTable('marks');
        await refreshTable('payments');
        await refreshTable('student_fees');
        await refreshTable('fee_categories');
        await refreshTable('fee_amounts');
        await refreshTable('families');

        showToast('✅ Restore complete! Reloading...', 'success');
        setTimeout(() => location.reload(), 2000);
    } catch (error) {
        showToast('Restore failed: ' + error.message, 'error');
    }
}

function saveAutoBackupSettings() {
    const enabled = document.getElementById('auto-backup-enabled')?.value === 'true';
    const frequency = document.getElementById('auto-backup-frequency')?.value;
    const keep = document.getElementById('auto-backup-keep')?.value;

    localStorage.setItem('auto_backup_enabled', enabled);
    localStorage.setItem('auto_backup_frequency', frequency);
    localStorage.setItem('auto_backup_keep', keep);

    showToast('✅ Auto-backup settings saved', 'success');
}

function showBackupList() {
    let backups = [];
    try {
        backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backups = [];
    }

    const rows = backups.map((b, i) => `
        <tr>
            <td>${fmtDateTime(b.date)}</span>
            <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
            <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</span>
            <td>${b.size || '—'} </span>
            <td><button class="btn btn-sm btn-outline" onclick="window.downloadBackupFile('${b.filename}', '${b.data}')">📥 Download</button></span>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center">No backup history found</span>';

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>📋 Backup History</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Type</th><th>Records</th><th>Size</th><th>Action</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportAllBackups() {
    let backups = [];
    try {
        backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backups = [];
    }

    if (!backups.length) {
        showToast('No backups to export', 'warning');
        return;
    }

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

function downloadBackupFile(filename, data) {
    downloadBlob(data, filename, 'application/json');
    showToast('✅ Backup downloaded', 'success');
}

function deleteBackupRecord(filename) {
    let backupHistory = [];
    try {
        backupHistory = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch (e) {
        backupHistory = [];
    }

    backupHistory = backupHistory.filter(b => b.filename !== filename);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backupHistory));

    showToast('✅ Backup record deleted', 'success');
    renderBackupRestore(document.getElementById('dynamic-content'));
}