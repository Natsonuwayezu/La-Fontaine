// js/modules/assessment-locking.js
// Assessment Locking Module - Bulk lock/unlock assessments and individual locking

import { state } from '../core/state.js';
import { getAll, update } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getTermById } from '../core/state.js';;

export async function renderAssessmentLocking(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (!user || user.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🔒 Assessment Locking Manager</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-warning" onclick="window.openBulkLockModal()">🔒 Bulk Lock/Unlock</button>
                    <button class="btn btn-sm btn-outline" onclick="window.refreshAssessmentList()">🔄 Refresh</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="lock-term-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()">
                        <option value="">All Terms</option>
                        ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                    </select>
                    <select id="lock-class-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()">
                        <option value="">All Classes</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <input type="text" id="lock-search" class="form-control flex-1" placeholder="🔍 Search assessments..." oninput="window.filterLockAssessments()">
                    <span class="result-count" id="lock-count"></span>
                </div>
                
                <div class="table-wrapper" id="assessment-lock-table">
                    <div class="loading-container"><div class="spinner"></div><p>Loading assessments...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📋 Locking Rules</span>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info">
                    <strong>Locking Rules:</strong>
                    <ul style="margin-top:8px;margin-left:20px">
                        <li>🔒 <strong>Locked assessments</strong> cannot be edited by teachers</li>
                        <li>🔓 <strong>Unlocked assessments</strong> can be edited by assigned teachers</li>
                        <li>⏰ Assessments can be auto-locked when term ends (configure in Academic Calendar)</li>
                        <li>👑 Only administrators can lock/unlock assessments</li>
                    </ul>
                </div>
                
                <div class="form-group" style="margin-top:16px">
                    <label>Auto-lock after days past due date</label>
                    <div style="display:flex; gap:12px; align-items:center">
                        <input type="number" id="auto-lock-days" value="${state.schoolSettings.auto_lock_days || 7}" min="0" max="90" class="form-control" style="width:100px">
                        <button class="btn btn-sm btn-primary" onclick="window.saveAutoLockSettings()">💾 Save Setting</button>
                    </div>
                    <small class="field-hint">0 = disabled. Assessments will auto-lock X days after due date passes.</small>
                </div>
            </div>
        </div>
    `;

    // Register functions
    window.openBulkLockModal = openBulkLockModal;
    window.refreshAssessmentList = refreshAssessmentList;
    window.filterLockAssessments = filterLockAssessments;
    window.saveAutoLockSettings = saveAutoLockSettings;
    window.toggleAssessmentLock = toggleAssessmentLock;

    await refreshAssessmentList();
}

async function refreshAssessmentList() {
    const container = document.getElementById('assessment-lock-table');
    if (!container) return;

    let assessments = [...state.assessments];
    assessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Store for filtering
    window._allLockAssessments = assessments;

    renderLockAssessmentTable(assessments);
}

function filterLockAssessments() {
    const termFilter = document.getElementById('lock-term-filter')?.value;
    const classFilter = document.getElementById('lock-class-filter')?.value;
    const search = document.getElementById('lock-search')?.value.toLowerCase();

    let filtered = window._allLockAssessments || [];

    if (termFilter) filtered = filtered.filter(a => a.term_id == termFilter);
    if (classFilter) filtered = filtered.filter(a => a.class_id == classFilter);
    if (search) filtered = filtered.filter(a =>
        a.assessment_name.toLowerCase().includes(search) ||
        (getClassById(a.class_id)?.name || '').toLowerCase().includes(search) ||
        (getSubjectById(a.subject_id)?.name || '').toLowerCase().includes(search)
    );

    renderLockAssessmentTable(filtered);
}

function renderLockAssessmentTable(assessments) {
    const container = document.getElementById('assessment-lock-table');
    if (!container) return;

    const countSpan = document.getElementById('lock-count');
    if (countSpan) countSpan.textContent = `${assessments.length} assessment${assessments.length !== 1 ? 's' : ''}`;

    if (assessments.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No assessments found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:40px"><input type="checkbox" id="select-all-lock" onchange="window.toggleSelectAllLock()"></th>
                    <th>Assessment</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Term</th>
                    <th>Due Date</th>
                    <th>Marks</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${assessments.map(a => {
        const cls = getClassById(a.class_id);
        const sub = getSubjectById(a.subject_id);
        const term = getTermById(a.term_id);
        const marksCount = state.marks.filter(m => m.assessment_id === a.id).length;
        const studentsCount = state.students.filter(s => s.class_id === a.class_id && s.status === 'Active').length;
        const isOverdue = a.due_date && new Date(a.due_date) < new Date();

        return `
                        <tr>
                            <td style="text-align:center"><input type="checkbox" class="lock-select-cb" value="${a.id}"></td>
                            <td><strong>${esc(a.assessment_name)}</strong><br><small>${esc(a.assessment_type)}</small></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td>${esc(sub?.name || '—')}</span>
                            <td>${esc(term?.name || '—')}</span>
                            <td>${a.due_date ? fmtDate(a.due_date) + (isOverdue ? ' <span class="badge badge-danger">Overdue</span>' : '') : '—'}</span>
                            <td>${marksCount}/${studentsCount}</span>
                            <td><span class="badge ${a.is_locked ? 'badge-danger' : 'badge-success'}">${a.is_locked ? '🔒 Locked' : '✅ Open'}</span></span>
                            <td>
                                <button class="btn btn-sm ${a.is_locked ? 'btn-success' : 'btn-warning'}" onclick="window.toggleAssessmentLock(${a.id}, ${a.is_locked})">
                                    ${a.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                                </button>
                             </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function toggleSelectAllLock() {
    const selectAll = document.getElementById('select-all-lock')?.checked || false;
    document.querySelectorAll('.lock-select-cb').forEach(cb => cb.checked = selectAll);
}

function openBulkLockModal() {
    showModal(`
        <div class="modal-overlay" id="bulk-lock-modal">
            <div class="modal modal-lg" onclick="event.stopPropagation()" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>🔒 Bulk Lock/Unlock Assessments</h3>
                    <button class="modal-close" onclick="closeModal('bulk-lock-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <strong>⚠️ Warning:</strong> Locked assessments cannot be edited by teachers.
                        Unlocking will allow teachers to modify marks.
                    </div>
                    
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Filter by Term</label>
                            <select id="bulk-term-filter" class="form-control">
                                <option value="">All Terms</option>
                                ${state.terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Filter by Class</label>
                            <select id="bulk-class-filter" class="form-control">
                                <option value="">All Classes</option>
                                ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="btn-group" style="margin:16px 0">
                        <button class="btn btn-sm btn-outline" onclick="window.selectAllBulkLock(true)">✓ Select All</button>
                        <button class="btn btn-sm btn-outline" onclick="window.selectAllBulkLock(false)">✗ Deselect All</button>
                    </div>
                    
                    <div class="table-wrapper" id="bulk-assessments-list" style="max-height:400px;overflow-y:auto">
                        <div class="loading-container"><div class="spinner"></div><p>Loading assessments...</p></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('bulk-lock-modal')">Cancel</button>
                    <button class="btn btn-warning" onclick="window.executeBulkLock(true)">🔒 Lock Selected</button>
                    <button class="btn btn-success" onclick="window.executeBulkLock(false)">🔓 Unlock Selected</button>
                </div>
            </div>
        </div>
    `);

    loadBulkAssessmentsList();

    window.selectAllBulkLock = (select) => {
        document.querySelectorAll('.bulk-lock-cb').forEach(cb => cb.checked = select);
    };
    window.executeBulkLock = executeBulkLock;
}

async function loadBulkAssessmentsList() {
    const termFilter = document.getElementById('bulk-term-filter')?.value;
    const classFilter = document.getElementById('bulk-class-filter')?.value;
    const container = document.getElementById('bulk-assessments-list');

    if (!container) return;

    let assessments = [...state.assessments];
    if (termFilter) assessments = assessments.filter(a => a.term_id == termFilter);
    if (classFilter) assessments = assessments.filter(a => a.class_id == classFilter);
    assessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (assessments.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px">No assessments found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:32px"><input type="checkbox" id="bulk-select-all" onchange="window.selectAllBulkLock(this.checked)"></th>
                    <th>Assessment</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Due Date</th>
                    <th>Current Status</th>
                </tr>
            </thead>
            <tbody>
                ${assessments.map(a => `
                    <tr>
                        <td style="text-align:center"><input type="checkbox" class="bulk-lock-cb" value="${a.id}"></td>
                        <td><strong>${esc(a.assessment_name)}</strong><br><small>${esc(a.assessment_type)}</small></span>
                        <td>${esc(getClassById(a.class_id)?.name || '—')}</span>
                        <td>${esc(getSubjectById(a.subject_id)?.name || '—')}</span>
                        <td>${fmtDate(a.due_date)}</span>
                        <td><span class="badge ${a.is_locked ? 'badge-danger' : 'badge-success'}">${a.is_locked ? 'Locked' : 'Open'}</span></span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function executeBulkLock(lock) {
    const selectedCbs = document.querySelectorAll('.bulk-lock-cb:checked');
    const selectedIds = Array.from(selectedCbs).map(cb => parseInt(cb.value));

    if (selectedIds.length === 0) {
        showToast('No assessments selected', 'warning');
        return;
    }

    if (!await confirmDialog(`${lock ? 'Lock' : 'Unlock'} ${selectedIds.length} assessment${selectedIds.length !== 1 ? 's' : ''}?`)) return;

    let successCount = 0;
    for (const id of selectedIds) {
        try {
            await update('assessments', id, { is_locked: lock, updated_at: new Date().toISOString() });
            successCount++;
        } catch (e) {
            console.error(`Failed to ${lock ? 'lock' : 'unlock'} assessment ${id}:`, e);
        }
    }

    await refreshTable('assessments');
    closeModal('bulk-lock-modal');
    showToast(`✅ ${successCount} assessment${successCount !== 1 ? 's' : ''} ${lock ? 'locked' : 'unlocked'}`, 'success');
    await refreshAssessmentList();
}

async function toggleAssessmentLock(assessmentId, currentLockState) {
    const newState = !currentLockState;
    const action = newState ? 'lock' : 'unlock';

    if (!await confirmDialog(`${newState ? 'Lock' : 'Unlock'} this assessment?`)) return;

    await update('assessments', assessmentId, { is_locked: newState, updated_at: new Date().toISOString() });
    await refreshTable('assessments');
    showToast(`✅ Assessment ${action}ed`, 'success');
    await refreshAssessmentList();
}

async function saveAutoLockSettings() {
    const days = parseInt(document.getElementById('auto-lock-days')?.value) || 0;
    await updateSchoolSetting('auto_lock_days', String(days));
    showToast(`✅ Auto-lock after ${days} days past due date saved`, 'success');
}

async function updateSchoolSetting(key, value) {
    try {
        const { updateSchoolSetting: updateSetting } = await import('../core/supabase-client.js');
        await updateSetting(key, value);
    } catch (e) {
        console.warn('Failed to save setting:', e);
    }
}