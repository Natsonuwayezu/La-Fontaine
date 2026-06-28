// ============================================================
// MARKS MODULE - Marks entry and management
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtPct, getGrade, getGradeClass, esc } from '../core/utils.js';
import { showToast } from '../core/helpers.js';
import { confirmDialog } from '../ui/modals.js';;
import { getAll, insert, update } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { logActivity } from '../core/helpers.js';

// Module state
let _meStudents = [];
let _meAssessmentId = null;
let _meLocked = false;

// Render Marks Entry page
export async function renderMarksEntry(container) {
    if (isAccountant()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks.</div>';
        return;
    }

    await ensureStateLoaded();

    const user = getCurrentUser();
    const termObj = state.currentTerm;
    const phase = getCurrentPhase(termObj);

    let availClasses = (state.classes || []).filter(c => c.is_active !== false);

    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        availClasses = availClasses.filter(c => classIds.includes(c.id));
        if (availClasses.length === 0) {
            container.innerHTML = `<div class="alert alert-warning">You have not been assigned to any classes.</div>`;
            return;
        }
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">✏️ MARKS ENTRY</span>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700;${phase === 'pre_midterm' ? 'background:#dbeafe;color:#1e40af' : 'background:#d1fae5;color:#065f46'}">
                        ${phase === 'pre_midterm' ? '📋 PRE-MIDTERM PHASE' : '📝 POST-MIDTERM PHASE'}
                    </span>
                    <span style="font-size:.75rem;color:var(--text-muted)">${termObj?.name || ''} — ${state.schoolSettings.current_year || ''}</span>
                    <button class="btn btn-sm btn-outline" onclick="showExistingAssessments()">📋 Existing</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;align-items:end">
                    <div class="form-group" style="margin:0"><label>Class *</label><select id="me-class" onchange="loadMESubjectsAndStudents()"><option value="">— Select —</option>${availClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group" style="margin:0"><label>Subject *</label><select id="me-subject" onchange="updateMEMaxFromSubject()"><option value="">— Select class first —</option></select></div>
                    <div class="form-group" style="margin:0"><label>Type *</label><select id="me-type" onchange="updateMEMaxFromSubject()"><option value="Quiz">Quiz</option><option value="Assignment">Assignment</option><option value="Mid-term">Mid-term</option>${phase === 'post_midterm' ? `<option value="Exam">Exam</option><option value="Final Exam">Final Exam</option>` : `<option value="Exam" disabled style="color:var(--text-muted)">Exam (post-midterm only)</option>`}</select></div>
                    <div class="form-group" style="margin:0"><label>Name *</label><input type="text" id="me-name" placeholder="e.g. Quiz 3"></div>
                    <div class="form-group" style="margin:0"><label>Max Marks</label><input type="number" id="me-max" value="50" min="1" max="200"></div>
                    <div class="form-group" style="margin:0"><label>Date</label><input type="date" id="me-date" value="${new Date().toISOString().split('T')[0]}"></div>
                </div>
                <div style="margin-top:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem"><input type="checkbox" id="me-lock-after"> Lock after saving</label>
                    <button class="btn btn-primary" onclick="loadMEStudentsTable()">📋 Load Students</button>
                    <input type="hidden" id="me-due" value="">
                </div>
            </div>
        </div>
        <div class="dash-card" id="me-table-card" style="display:none">
            <div class="dash-card-header"><span class="dash-card-title" id="me-table-title">📝 Student Marks</span><span id="me-summary" style="font-size:.82rem;color:var(--text-muted)"></span></div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper"><table class="data-table"><thead><tr><th style="width:40px;text-align:center">#</th><th>Student Name</th><th style="width:110px;text-align:center">Score</th><th style="width:60px;text-align:center">/ Max</th><th style="width:100px;text-align:center">% Grade</th><th style="width:80px;text-align:center">Status</th></tr></thead><tbody id="me-tbody"></tbody></table></div>
                <div id="me-offline-notice" style="display:none;padding:10px 16px;background:var(--warning-bg);border-top:1px solid var(--border-light);font-size:.85rem;color:var(--warning)">📴 Offline — marks will sync when connection restores.</div>
            </div>
            <div style="position:sticky;bottom:0;z-index:10;padding:12px 16px;border-top:1px solid var(--border-light);background:var(--bg-primary);display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 -2px 8px rgba(0,0,0,.08)">
                <button class="btn btn-success" id="me-save-btn" onclick="saveMarks()">💾 Save to DB</button>
                <button class="btn btn-outline" onclick="clearMarksTable()">🗑️ Clear</button>
                <button class="btn btn-outline" onclick="importMarksExcel()">📤 Import Excel</button>
                <button class="btn btn-outline" onclick="exportMarksExcel()">📥 Export Excel</button>
                <span id="me-status-label" style="margin-left:auto;font-size:.82rem;color:var(--text-muted)"></span>
            </div>
        </div>
    `;
}

// Load subjects for selected class
window.loadMESubjectsAndStudents = function () {
    const classId = document.getElementById('me-class')?.value;
    if (!classId) return;

    const cls = getClassById(classId);
    const phase = getCurrentPhase();
    const user = getCurrentUser();

    let subjects = (state.subjects || []).filter(s => (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() && s.is_active !== false);
    if (phase === 'pre_midterm') subjects = subjects.filter(s => !s.appears_only_post_midterm);
    subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    const sel = document.getElementById('me-subject');
    sel.innerHTML = '<option value="">— Select subject —</option>' + subjects.map(s => `<option value="${s.id}" data-mg="${s.mg_max || 50}" data-ex="${s.ex_max || 50}">${esc(s.name)}</option>`).join('');
    updateMEMaxFromSubject();
};

// Update max marks based on subject
window.updateMEMaxFromSubject = function () {
    const sel = document.getElementById('me-subject');
    const opt = sel?.options[sel.selectedIndex];
    const type = document.getElementById('me-type')?.value;
    if (!opt?.value) return;
    const isExam = ['Exam', 'Final Exam'].includes(type);
    document.getElementById('me-max').value = isExam ? (opt.dataset.ex || 50) : (opt.dataset.mg || 50);
};

// Load students table
window.loadMEStudentsTable = async function () {
    const classId = document.getElementById('me-class')?.value;
    const subjectId = document.getElementById('me-subject')?.value;
    const name = document.getElementById('me-name')?.value.trim();
    const max = parseFloat(document.getElementById('me-max')?.value) || 50;

    if (!classId) { showToast('Please select a class', 'warning'); return; }
    if (!subjectId) { showToast('Please select a subject', 'warning'); return; }
    if (!name) { showToast('Please enter an assessment name', 'warning'); return; }

    const user = getCurrentUser();
    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: user.id, class_id: parseInt(classId), subject_id: parseInt(subjectId) });
        if (assignments.length === 0) {
            showToast('You are not authorized to enter marks for this subject in this class.', 'error');
            return;
        }
    }

    _meStudents = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    document.getElementById('me-table-card').style.display = 'block';

    const existing = (state.assessments || []).find(a => a.class_id == classId && a.subject_id == subjectId && a.assessment_name === name && a.term_id === state.currentTerm?.id);
    _meAssessmentId = existing?.id || null;
    _meLocked = existing?.is_locked || false;

    const existingMarks = _meAssessmentId ? await getAll('marks', { assessment_id: _meAssessmentId }) : [];
    const marksMap = new Map(existingMarks.map(m => [m.student_id, m.score]));
    renderMETable(max, marksMap);
    updateMESummary();
};

function renderMETable(max, marksMap = {}) {
    const tbody = document.getElementById('me-tbody');
    if (!tbody) return;
    const titleEl = document.getElementById('me-table-title');
    if (titleEl) titleEl.textContent = `📝 Student Marks (${_meStudents.length} students loaded)`;

    tbody.innerHTML = _meStudents.map((s, i) => {
        const existing = marksMap.get(s.id);
        const val = existing !== undefined ? existing : '';
        const pct = val !== '' ? (val / max * 100) : null;
        const statusHtml = _meLocked ? '🔒 Locked' : val !== '' ? (pct < 50 ? '<span style="color:#f59e0b">⚠️ Low</span>' : '<span style="color:#10b981">✅ Saved</span>') : '<span style="color:#94a3b8">❌ Empty</span>';
        return `<tr id="me-row-${s.id}"><td style="text-align:center;color:var(--text-muted)">${i + 1}</td><td><strong>${esc(s.last_name + ' ' + s.first_name)}</strong></td><td style="text-align:center"><input class="marks-input" type="number" id="score-${s.id}" value="${val}" min="0" max="${max}" step="0.5" oninput="updateMERow(${s.id},${max})" ${_meLocked ? 'disabled' : ''}></td><td style="text-align:center;color:var(--text-muted)">${max}</td><td style="text-align:center;font-size:.82rem" id="pct-${s.id}">${pct !== null ? fmtPct(pct) + ' ' + getGrade(pct) : '—'}</td><td style="text-align:center;font-size:.82rem" id="status-${s.id}">${statusHtml}</td></tr>`;
    }).join('');
}

function updateMERow(studentId, max) {
    const input = document.getElementById(`score-${studentId}`);
    if (!input) return;
    let val = parseFloat(input.value);
    if (isNaN(val) || input.value.trim() === '') {
        document.getElementById(`pct-${studentId}`).textContent = '—';
        document.getElementById(`status-${studentId}`).innerHTML = '<span style="color:#94a3b8">❌ Empty</span>';
        updateMESummary();
        return;
    }
    const clamped = Math.min(max, Math.max(0, val));
    if (clamped !== val) input.value = clamped;
    const pct = (clamped / max) * 100;
    document.getElementById(`pct-${studentId}`).textContent = fmtPct(pct) + ' ' + getGrade(pct);
    document.getElementById(`status-${studentId}`).innerHTML = pct < 50 ? '<span style="color:#f59e0b">⚠️ Low</span>' : '<span style="color:#10b981">✅</span>';
    updateMESummary();
}

function updateMESummary() {
    const max = parseFloat(document.getElementById('me-max')?.value) || 50;
    const scores = [];
    _meStudents.forEach(s => { const v = parseFloat(document.getElementById(`score-${s.id}`)?.value); if (!isNaN(v)) scores.push(v); });
    const total = _meStudents.length, count = scores.length, pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
    const avg = count ? (scores.reduce((a, b) => a + b, 0) / count / max * 100).toFixed(1) : '—';
    const passing = scores.filter(v => v / max * 100 >= 50).length, passRate = count ? ((passing / count) * 100).toFixed(0) + '%' : '—';
    const summary = document.getElementById('me-summary');
    if (summary) summary.innerHTML = `📊 <strong>${count}/${total}</strong> entered (${pct}%) | Avg: <strong>${avg}%</strong> | Pass Rate: <strong>${passRate}</strong>`;
}

// Save marks
window.saveMarks = async function () {
    const classId = document.getElementById('me-class')?.value;
    const subjectId = document.getElementById('me-subject')?.value;
    const type = document.getElementById('me-type')?.value;
    const name = document.getElementById('me-name')?.value.trim();
    const max = parseFloat(document.getElementById('me-max')?.value) || 50;
    const date = document.getElementById('me-date')?.value;
    const due = document.getElementById('me-due')?.value;
    const lockAfter = document.getElementById('me-lock-after')?.checked;

    if (!classId || !subjectId || !name) { showToast('Fill in all required fields', 'warning'); return; }
    if (_meLocked) { showToast('This assessment is locked. Unlock it first.', 'warning'); return; }

    const btn = document.getElementById('me-save-btn');
    btn.disabled = true; btn.innerHTML = 'Saving...';

    try {
        if (!_meAssessmentId) {
            const assess = await insert('assessments', {
                class_id: parseInt(classId), subject_id: parseInt(subjectId),
                term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id,
                assessment_type: type, assessment_name: name, max_marks: max, date,
                due_date: due || null, is_locked: false, entered_by: getCurrentUser()?.id,
                created_at: new Date().toISOString()
            });
            if (!assess) throw new Error('Failed to create assessment');
            _meAssessmentId = assess.id;
        } else {
            await update('assessments', _meAssessmentId, { assessment_type: type, assessment_name: name, max_marks: max, date, due_date: due || null });
        }

        let saved = 0, skipped = 0;
        for (const st of _meStudents) {
            const val = parseFloat(document.getElementById(`score-${st.id}`)?.value);
            if (isNaN(val)) { skipped++; continue; }
            const existing = await getAll('marks', { assessment_id: _meAssessmentId, student_id: st.id });
            if (existing.length) await update('marks', existing[0].id, { score: val, entered_at: new Date().toISOString() });
            else await insert('marks', { assessment_id: _meAssessmentId, student_id: st.id, score: val, entered_at: new Date().toISOString(), entered_by: getCurrentUser()?.id });
            saved++;
        }
        if (lockAfter) { await update('assessments', _meAssessmentId, { is_locked: true }); _meLocked = true; }
        await refreshTable('assessments');
        await refreshTable('marks');
        await logActivity(getCurrentUser()?.id, getCurrentUser()?.role, `Entered marks: ${name} (${type}) — ${getClassById(classId)?.name}`, 'marks', _meAssessmentId, `${saved} marks saved, ${skipped} skipped`);
        showToast(`✅ Saved ${saved} marks (${skipped} skipped)`, 'success');
        updateMESummary();
    } catch (err) { console.error(err); showToast('Error saving marks: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '💾 Save to Database'; }
};

// Helper functions
function getCurrentPhase() {
    const term = state.currentTerm;
    if (!term?.midterm_date) return 'post_midterm';
    return new Date() < new Date(term.midterm_date) ? 'pre_midterm' : 'post_midterm';
}



async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.subjects.length) await refreshTable('subjects');
    if (!state.students.length) await refreshTable('students');
}

// Export functions to window
window.updateMERow = updateMERow;
window.clearMarksTable = function () {
    _meStudents.forEach(s => {
        const inp = document.getElementById(`score-${s.id}`);
        if (inp) { inp.value = ''; updateMERow(s.id, parseFloat(document.getElementById('me-max')?.value) || 50); }
    });
    showToast('Marks cleared', 'info', 1500);
};

window.exportMarksExcel = function () {
    if (!_meStudents.length) { showToast('No students loaded', 'warning'); return; }
    const max = parseFloat(document.getElementById('me-max')?.value) || 50;
    const name = document.getElementById('me-name')?.value || 'Assessment';
    const data = _meStudents.map((s, i) => {
        const val = parseFloat(document.getElementById(`score-${s.id}`)?.value);
        const pct = !isNaN(val) ? (val / max * 100) : null;
        return { '#': i + 1, 'Student': `${s.first_name} ${s.last_name}`, 'Score': isNaN(val) ? '' : val, '/Max': max, '%': pct !== null ? fmtPct(pct) : '', 'Grade': pct !== null ? getGrade(pct) : '' };
    });
    exportToExcel(data, name.replace(/\s/g, '_'));
};

window.importMarksExcel = function () {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv';
    input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);
                const max = parseFloat(document.getElementById('me-max')?.value) || 50;
                let applied = 0;
                rows.forEach(row => {
                    const name = (row['Student'] || row['Name'] || '').toLowerCase();
                    const score = parseFloat(row['Score'] || row['Marks'] || 0);
                    const st = _meStudents.find(s => `${s.first_name} ${s.last_name}`.toLowerCase() === name);
                    if (st && !isNaN(score)) {
                        const inp = document.getElementById(`score-${st.id}`);
                        if (inp) { inp.value = Math.min(max, Math.max(0, score)); updateMERow(st.id, max); applied++; }
                    }
                });
                showToast(`📤 Applied ${applied} scores from Excel`, 'success');
            } catch (e) { showToast('Error reading file: ' + e.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
};

window.showExistingAssessments = async function () {
    const assess = [...(state.assessments || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    showModal(`<div class="modal-overlay"><div class="modal modal-lg"><div class="modal-header"><h3>📋 All Assessments</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Class</th><th>Subject</th><th>Name</th><th>Type</th><th>Max</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${assess.map(a => `</td>
        <td>${esc(getClassById(a.class_id)?.name || '—')}</td><td>${esc(getSubjectById(a.subject_id)?.name || '—')}</td><td>${esc(a.assessment_name)}</td><td>${esc(a.assessment_type)}</td><td>${a.max_marks}</td><td>${fmtDate(a.date)}</td><td>${a.is_locked ? '🔒 Locked' : '✅ Open'}</td>
        <td><button class="btn btn-sm btn-outline" onclick="closeModal();loadExistingAssessment(${a.id})">Edit</button>${!a.is_locked ? `<button class="btn btn-sm btn-warning" onclick="lockAssessment(${a.id})">Lock</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No assessments yet</td>'}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button></div></div></div>`);
};

window.loadExistingAssessment = async function (assessId) {
    const a = (state.assessments || []).find(x => x.id === assessId);
    if (!a) return;
    _meAssessmentId = a.id; _meLocked = a.is_locked;
    document.getElementById('me-class').value = a.class_id;
    loadMESubjectsAndStudents();
    setTimeout(() => {
        document.getElementById('me-subject').value = a.subject_id;
        document.getElementById('me-type').value = a.assessment_type;
        document.getElementById('me-name').value = a.assessment_name;
        document.getElementById('me-max').value = a.max_marks;
        if (a.date) document.getElementById('me-date').value = a.date;
        if (a.due_date) document.getElementById('me-due').value = a.due_date;
        loadMEStudentsTable();
    }, 200);
};

window.lockAssessment = async function (id) {
    if (!await confirmDialog('Lock this assessment? No further edits will be possible.')) return;
    await update('assessments', id, { is_locked: true });
    await refreshTable('assessments');
    closeModal();
    showToast('🔒 Assessment locked', 'info');
};

function exportToExcel(data, filename) {
    if (!data?.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function showModal(html) {
    const container = document.getElementById('modals-container');
    if (container) container.innerHTML = html;
}

function closeModal() {
    const container = document.getElementById('modals-container');
    if (container) container.innerHTML = '';
}