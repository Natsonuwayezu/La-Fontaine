// ============================================================
// ASSESSMENTS MODULE
// ============================================================
import { state } from '../core/state.js';
import { insert, update, remove, getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/database.js';
import { showToast } from '../core/helpers.js';
import { showModal, closeModal } from '../ui/modals.js';
import { esc, fmtDate } from '../core/utils.js';
import { logActivity } from '../core/helpers.js';

export async function renderAssessments(container) {
    await window.ensureStateLoaded?.();
    const role = state.currentUser?.role;
    const myClasses = role === 'teacher'
        ? state.classes.filter(c => (state.teachers.find(t => t.id === state.currentUser?.id)?.class_ids || []).includes(c.id) || (state.assignments || []).some(a => a.teacher_id === state.currentUser?.id && a.class_id === c.id))
        : state.classes;
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
    const termOpts = terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    const classOpts = myClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const typeOpts = ['Quiz', 'Assignment', 'Mid-term', 'Exam 1', 'Exam 2', 'Final Exam'].map(t => `<option value="${t}">${t}</option>`).join('');

    container.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">📝 Assessments</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-primary" onclick="window.openAddAssessmentModal && openAddAssessmentModal()">➕ New Assessment</button>
          <button class="btn btn-sm btn-outline" onclick="window.bulkLockAssessments && bulkLockAssessments()">🔒 Bulk Lock</button>
        </div>
      </div>
      <div class="dash-card-body">
        <div class="filters-bar">
          <select id="af-class" onchange="window.filterAssessments && filterAssessments()"><option value="">All Classes</option>${classOpts}</select>
          <select id="af-term" onchange="window.filterAssessments && filterAssessments()"><option value="">All Terms</option>${termOpts}</select>
          <select id="af-type" onchange="window.filterAssessments && filterAssessments()"><option value="">All Types</option>${typeOpts}</select>
          <input type="text" id="af-search" placeholder="🔍 Search..." oninput="window.filterAssessments && filterAssessments()">
        </div>
        <div class="table-wrapper" style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Type</th><th>Class</th><th>Subject</th><th>Term</th><th>Max Marks</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="assessments-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;
    filterAssessments();
}

window.filterAssessments = function () {
    const classId = document.getElementById('af-class')?.value;
    const termId = document.getElementById('af-term')?.value;
    const type = document.getElementById('af-type')?.value;
    const search = document.getElementById('af-search')?.value.toLowerCase() || '';
    let rows = state.assessments.filter(a => {
        if (classId && a.class_id != classId) return false;
        if (termId && a.term_id != termId) return false;
        if (type && a.assessment_type !== type) return false;
        if (search && !a.assessment_name?.toLowerCase().includes(search)) return false;
        return true;
    });
    const tbody = document.getElementById('assessments-tbody');
    if (!tbody) return;
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted)">No assessments found</td></tr>'; return; }
    tbody.innerHTML = rows.map(a => {
        const cls = state.classes.find(c => c.id === a.class_id);
        const sub = state.subjects.find(s => s.id === a.subject_id);
        const term = state.terms.find(t => t.id === a.term_id);
        const marksCount = state.marks.filter(m => m.assessment_id === a.id).length;
        const expectedCount = state.students.filter(s => s.class_id === a.class_id && s.status === 'Active').length;
        const pct = expectedCount > 0 ? Math.round(marksCount / expectedCount * 100) : 0;
        return `<tr>
            <td><strong>${esc(a.assessment_name)}</strong></td>
            <td><span class="badge badge-module">${esc(a.assessment_type)}</span></td>
            <td>${esc(cls?.name || '—')}</td>
            <td>${esc(sub?.name || '—')}</td>
            <td>${esc(term?.name || '—')}</td>
            <td style="text-align:center">${a.max_marks}</td>
            <td>${a.date ? fmtDate(a.date) : '—'}</td>
            <td>${a.is_locked ? '<span class="badge badge-danger">🔒 Locked</span>' : `<span class="badge badge-success">✏️ Open</span><small style="display:block;color:var(--text-muted)">${marksCount}/${expectedCount} (${pct}%)</small>`}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="window.openEditAssessmentModal && openEditAssessmentModal(${a.id})" title="Edit" ${a.is_locked ? 'disabled' : ''}>✏️</button>
                ${a.is_locked ? `<button class="btn btn-sm btn-outline" onclick="window.unlockAssessment && unlockAssessment(${a.id})" title="Unlock">🔓</button>` : `<button class="btn btn-sm btn-outline" onclick="window.lockAssessment && lockAssessment(${a.id})" title="Lock">🔒</button>`}
                <button class="btn btn-sm btn-danger" onclick="window.deleteAssessmentPrompt && deleteAssessmentPrompt(${a.id},'${esc(a.assessment_name)}')" title="Delete" ${a.is_locked ? 'disabled' : ''}>🗑️</button>
            </td>
        </tr>`;
    }).join('');
};

window.openAddAssessmentModal = function () {
    const classes = state.classes;
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
    showModal(`<div class="modal-overlay"><div class="modal">
        <div class="modal-header"><h3>📝 New Assessment</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="modal-body">
            <div class="form-grid">
                <div class="form-group"><label>Assessment Name *</label><input type="text" id="a-name" placeholder="e.g. Term 1 Quiz 1"></div>
                <div class="form-group"><label>Type *</label><select id="a-type"><option>Quiz</option><option>Assignment</option><option>Mid-term</option><option>Exam 1</option><option>Exam 2</option><option>Final Exam</option></select></div>
                <div class="form-group"><label>Class *</label><select id="a-class" onchange="window.loadAssessSubjects && loadAssessSubjects()"><option value="">Select class...</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Subject *</label><select id="a-subject"><option value="">Select class first</option></select></div>
                <div class="form-group"><label>Term *</label><select id="a-term"><option value="">Select term...</option>${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Max Marks *</label><input type="number" id="a-max" value="100" min="1" max="1000"></div>
                <div class="form-group"><label>Date</label><input type="date" id="a-date"></div>
                <div class="form-group"><label>Due Date</label><input type="date" id="a-due"></div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="window.submitAddAssessment && submitAddAssessment()">Save Assessment</button>
        </div>
    </div></div>`);
};

window.loadAssessSubjects = function () {
    const classId = document.getElementById('a-class')?.value;
    const sel = document.getElementById('a-subject');
    if (!sel || !classId) return;
    const subs = state.subjects.filter(s => !s.class_level || state.classes.find(c => c.id == classId)?.level === s.class_level || true);
    sel.innerHTML = `<option value="">Select subject...</option>${subs.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}`;
};

window.submitAddAssessment = async function () {
    const name = document.getElementById('a-name')?.value.trim();
    const type = document.getElementById('a-type')?.value;
    const classId = parseInt(document.getElementById('a-class')?.value);
    const subjectId = parseInt(document.getElementById('a-subject')?.value);
    const termId = parseInt(document.getElementById('a-term')?.value);
    const max = parseFloat(document.getElementById('a-max')?.value);
    const date = document.getElementById('a-date')?.value || null;
    const due = document.getElementById('a-due')?.value || null;
    if (!name || !classId || !subjectId || !termId || !max) { showToast('Please fill all required fields', 'warning'); return; }
    try {
        await insert('assessments', { class_id: classId, subject_id: subjectId, term_id: termId, academic_year_id: state.currentAcadYear?.id, assessment_type: type, assessment_name: name, max_marks: max, date, due_date: due, is_locked: false, entered_by: state.currentUser?.id, created_at: new Date().toISOString() });
        await refreshTable('assessments');
        closeModal();
        showToast('✅ Assessment created', 'success');
        filterAssessments();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
};

window.lockAssessment = async function (id) {
    if (!confirm('Lock this assessment? Marks cannot be edited after locking.')) return;
    await update('assessments', id, { is_locked: true });
    await refreshTable('assessments');
    showToast('🔒 Assessment locked', 'success');
    filterAssessments();
};

window.unlockAssessment = async function (id) {
    if (!confirm('Unlock this assessment to allow mark editing?')) return;
    await update('assessments', id, { is_locked: false });
    await refreshTable('assessments');
    showToast('🔓 Assessment unlocked', 'info');
    filterAssessments();
};

window.bulkLockAssessments = function () {
    const termId = document.getElementById('af-term')?.value;
    const classId = document.getElementById('af-class')?.value;
    showModal(`<div class="modal-overlay"><div class="modal modal-sm">
        <div class="modal-header"><h3>🔒 Bulk Lock Assessments</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="modal-body">
            <div class="alert alert-warning">This will lock all open assessments matching current filters. This action cannot be undone easily.</div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="window.confirmBulkLock && confirmBulkLock('${termId}','${classId}')">🔒 Lock All</button>
        </div>
    </div></div>`);
};

window.confirmBulkLock = async function (termId, classId) {
    let toLock = state.assessments.filter(a => !a.is_locked);
    if (termId) tolock = tolock.filter(a => a.term_id == termId);
    if (classId) tolock = tolock.filter(a => a.class_id == classId);
    for (const a of tolock || tolock || []) { await update('assessments', a.id, { is_locked: true }); }
    await refreshTable('assessments');
    closeModal();
    showToast(`🔒 Assessments locked`, 'success');
    filterAssessments();
};

window.deleteAssessmentPrompt = async function (id, name) {
    if (!confirm(`Delete assessment "${name}"? All marks for this assessment will also be deleted.`)) return;
    await remove('assessments', id);
    const marksToDelete = state.marks.filter(m => m.assessment_id === id);
    for (const m of marksToDelete) { await remove('marks', m.id); }
    await refreshTable('assessments');
    await refreshTable('marks');
    showToast('🗑️ Assessment deleted', 'info');
    filterAssessments();
};

window.renderAssessments = renderAssessments;