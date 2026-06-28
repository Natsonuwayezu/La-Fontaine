// ============================================================
// MARKS DATABASE MODULE - View, edit, and manage all marks
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, fmtPct, getGrade, esc } from '../core/utils.js';
import { showToast } from '../core/helpers.js';
import { confirmDialog } from '../ui/modals.js';;
import { getAll, update, remove } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { exportToExcel } from '../core/utils.js';

// Render Marks Database page
export async function renderMarksDatabase(container) {
    if (isAccountant()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks.</div>';
        return;
    }

    await ensureStateLoaded();

    const user = getCurrentUser();
    let availableClasses = (state.classes || []).filter(c => c.is_active !== false);

    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        availableClasses = availableClasses.filter(c => classIds.includes(c.id));
        if (availableClasses.length === 0) {
            container.innerHTML = `<div class="alert alert-warning">You have not been assigned to any classes.</div>`;
            return;
        }
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🗄️ Marks Database</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="refreshMarksData()">🔄 Refresh</button>
                    <button class="btn btn-sm btn-outline" onclick="exportAllMarksToExcel()">📤 Export All</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="db-class" onchange="loadDatabaseSubjects()" style="padding:8px 12px;border-radius:8px">
                        <option value="">-- Select Class --</option>
                        ${availableClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="db-subject" onchange="loadDatabaseAssessments()" style="padding:8px 12px;border-radius:8px">
                        <option value="">-- Select Subject --</option>
                    </select>
                    <select id="db-assessment" style="padding:8px 12px;border-radius:8px">
                        <option value="">-- Select Assessment --</option>
                    </select>
                    <button class="btn btn-primary" onclick="loadMarksDatabase()">🔍 Load Marks</button>
                </div>
                <div id="marks-database-content">
                    <div class="alert alert-info" style="text-align:center;padding:40px">👆 Select a class, subject, and assessment to view marks</div>
                </div>
            </div>
        </div>
    `;
}

// Load subjects for selected class
window.loadDatabaseSubjects = async function () {
    const classId = document.getElementById('db-class')?.value;
    if (!classId) {
        document.getElementById('db-subject').innerHTML = '<option value="">-- Select Subject --</option>';
        document.getElementById('db-assessment').innerHTML = '<option value="">-- Select Assessment --</option>';
        return;
    }

    const selectedClass = getClassById(classId);
    let subjects = (state.subjects || []).filter(s => s.level === selectedClass?.level && s.is_active !== false);

    const user = getCurrentUser();
    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: user.id, class_id: parseInt(classId) });
        const subjectIds = new Set(assignments.map(a => a.subject_id));
        subjects = subjects.filter(s => subjectIds.has(s.id));
    }

    const subjectSelect = document.getElementById('db-subject');
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>' + subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    document.getElementById('db-assessment').innerHTML = '<option value="">-- Select Assessment --</option>';
};

// Load assessments for selected subject
window.loadDatabaseAssessments = function () {
    const classId = document.getElementById('db-class')?.value;
    const subjectId = document.getElementById('db-subject')?.value;
    if (!classId || !subjectId) {
        document.getElementById('db-assessment').innerHTML = '<option value="">-- Select Assessment --</option>';
        return;
    }

    const currentTerm = state.currentTerm;
    const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.subject_id == subjectId && a.term_id === currentTerm?.id);
    const assessmentSelect = document.getElementById('db-assessment');
    assessmentSelect.innerHTML = '<option value="">-- Select Assessment --</option>' + assessments.map(a => `<option value="${a.id}">${esc(a.assessment_name)} (${esc(a.assessment_type)})</option>`).join('');
};

// Load marks database table
window.loadMarksDatabase = async function () {
    const classId = document.getElementById('db-class')?.value;
    const subjectId = document.getElementById('db-subject')?.value;
    const assessmentId = document.getElementById('db-assessment')?.value;
    const contentDiv = document.getElementById('marks-database-content');

    if (!classId || !subjectId || !assessmentId) {
        contentDiv.innerHTML = '<div class="alert alert-warning">Please select class, subject, and assessment</div>';
        return;
    }

    contentDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading marks...</p></div>';

    try {
        const assessment = (state.assessments || []).find(a => a.id == assessmentId);
        if (!assessment) throw new Error('Assessment not found');

        const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
        const marks = (state.marks || []).filter(m => m.assessment_id == assessmentId);
        const marksMap = new Map(marks.map(m => [m.student_id, m.score]));
        const user = getCurrentUser();
        const canEdit = !assessment.is_locked || isAdmin();

        const subject = getSubjectById(subjectId);
        const className = getClassById(classId)?.name;

        let html = `
            <div class="dash-card">
                <div class="dash-card-header">
                    <div><strong>${esc(assessment.assessment_name)}</strong> - ${esc(subject?.name)} (${esc(className)})</div>
                    <div class="btn-group">
                        ${isAdmin() ? `<button class="btn btn-sm btn-warning" onclick="toggleAssessmentLockStatus(${assessmentId}, ${assessment.is_locked})">${assessment.is_locked ? '🔓 Unlock' : '🔒 Lock'}</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteAssessmentWithAllMarks(${assessmentId}, '${esc(assessment.assessment_name)}')">🗑️ Delete Assessment</button>
                    </div>
                </div>
                <div class="dash-card-body" style="padding:0">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>#</th><th>Student Name</th><th>Score / ${assessment.max_marks}</th><th>%</th><th>Grade</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${students.map((student, idx) => {
            const score = marksMap.get(student.id);
            const percentage = score ? (score / assessment.max_marks) * 100 : null;
            const grade = percentage ? getGrade(percentage) : '—';
            return `
                                        <tr>
                                            <td style="text-align:center">${idx + 1}</span>
                                            <td><strong>${esc(student.first_name)} ${esc(student.last_name)}</strong></span>
                                            <td>${canEdit ? `<input type="number" id="mark-${assessmentId}-${student.id}" value="${score !== undefined ? score : ''}" min="0" max="${assessment.max_marks}" step="0.5" style="width:90px;text-align:center" onchange="updateSingleMarkInDB(${assessmentId}, ${student.id}, ${assessment.max_marks})">` : (score !== undefined ? score : '—')}</span>
                                            <td>${percentage !== null ? percentage.toFixed(1) + '%' : '—'}</span>
                                            <td>${grade}</span>
                                            <td>${score !== undefined ? '<span class="badge badge-success">✅ Entered</span>' : '<span class="badge badge-warning">⏳ Pending</span>'}</span>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="btn-group" style="padding:16px;border-top:1px solid var(--border-light)">
                        <button class="btn btn-success" onclick="bulkUpdateMarks(${assessmentId}, ${assessment.max_marks})">💾 Save All Changes</button>
                        <button class="btn btn-outline" onclick="exportAssessmentToExcel(${assessmentId})">📥 Export to Excel</button>
                    </div>
                </div>
            </div>
        `;

        contentDiv.innerHTML = html;
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Error loading marks: ${esc(error.message)}</div>`;
    }
};

// Update single mark
window.updateSingleMarkInDB = async function (assessmentId, studentId, maxMarks) {
    const input = document.getElementById(`mark-${assessmentId}-${studentId}`);
    if (!input) return;

    let score = parseFloat(input.value);
    if (isNaN(score)) { input.value = ''; return; }
    if (score < 0) score = 0;
    if (score > maxMarks) score = maxMarks;

    const user = getCurrentUser();
    try {
        const existing = (state.marks || []).find(m => m.assessment_id == assessmentId && m.student_id == studentId);
        if (existing) {
            await update('marks', existing.id, { score: score, entered_by: user.id });
        } else {
            await insert('marks', { assessment_id: assessmentId, student_id: studentId, score: score, entered_by: user.id });
        }
        showToast('Mark updated', 'success');
    } catch (error) {
        showToast('Error updating mark', 'error');
    }
};

// Bulk update marks
window.bulkUpdateMarks = async function (assessmentId, maxMarks) {
    const inputs = document.querySelectorAll(`input[id^="mark-${assessmentId}-"]`);
    let updated = 0, errors = 0;

    for (const input of inputs) {
        const score = parseFloat(input.value);
        if (isNaN(score)) continue;

        const studentId = parseInt(input.id.split('-')[2]);
        try {
            const existing = (state.marks || []).find(m => m.assessment_id == assessmentId && m.student_id == studentId);
            if (existing) {
                await update('marks', existing.id, { score: score });
            } else {
                await insert('marks', { assessment_id: assessmentId, student_id: studentId, score: score });
            }
            updated++;
        } catch (error) { errors++; }
    }
    await refreshTable('marks');
    showToast(`✅ Saved ${updated} marks (${errors} errors)`, errors === 0 ? 'success' : 'warning');
    loadMarksDatabase();
};

// Toggle assessment lock status
window.toggleAssessmentLockStatus = async function (assessmentId, currentLockState) {
    const newState = !currentLockState;
    if (!await confirmDialog(`${newState ? 'Lock' : 'Unlock'} this assessment?`)) return;
    await update('assessments', assessmentId, { is_locked: newState });
    await refreshTable('assessments');
    showToast(`Assessment ${newState ? 'locked' : 'unlocked'}`, 'success');
    loadMarksDatabase();
};

// Delete assessment with all marks
window.deleteAssessmentWithAllMarks = async function (assessmentId, assessmentName) {
    if (!await confirmDialog(`⚠️ Delete "${assessmentName}"? This will delete ALL marks. Cannot undo!`)) return;

    const marksToDelete = (state.marks || []).filter(m => m.assessment_id == assessmentId);
    for (const m of marksToDelete) await remove('marks', m.id);
    await remove('assessments', assessmentId);
    await refreshTable('assessments');
    await refreshTable('marks');
    showToast(`✅ Assessment "${assessmentName}" deleted`, 'success');
    loadMarksDatabase();
};

// Export single assessment to Excel
window.exportAssessmentToExcel = function (assessmentId) {
    const assessment = (state.assessments || []).find(a => a.id == assessmentId);
    if (!assessment) return;

    const students = (state.students || []).filter(s => s.class_id === assessment.class_id && s.status === 'Active');
    const marks = (state.marks || []).filter(m => m.assessment_id === assessmentId);
    const marksMap = new Map(marks.map(m => [m.student_id, m.score]));
    const cls = getClassById(assessment.class_id);
    const sub = getSubjectById(assessment.subject_id);

    const data = students.map(s => {
        const score = marksMap.get(s.id);
        const percentage = score ? (score / assessment.max_marks * 100).toFixed(1) : null;
        return {
            'Student Name': `${s.first_name} ${s.last_name}`,
            'Student Code': s.student_code,
            'Class': cls?.name,
            'Subject': sub?.name,
            'Assessment': assessment.assessment_name,
            'Score': score !== undefined ? score : 'Not Entered',
            'Max Marks': assessment.max_marks,
            'Percentage': percentage ? percentage + '%' : '—',
            'Grade': percentage ? getGrade(percentage) : '—'
        };
    });

    exportToExcel(data, `${cls?.name}_${sub?.name}_${assessment.assessment_name}_Marks`);
    showToast('✅ Assessment exported', 'success');
};

// Export all marks to Excel
window.exportAllMarksToExcel = function () {
    const data = (state.marks || []).map(m => {
        const a = (state.assessments || []).find(x => x.id === m.assessment_id);
        const s = getStudentById(m.student_id);
        return {
            'Student': s ? `${s.first_name} ${s.last_name}` : '—',
            'Assessment': a?.assessment_name,
            'Type': a?.assessment_type,
            'Class': getClassById(a?.class_id)?.name,
            'Subject': getSubjectById(a?.subject_id)?.name,
            'Score': m.score,
            'Max': a?.max_marks,
            'Percentage': a ? ((m.score / a.max_marks) * 100).toFixed(1) + '%' : '—',
            'Grade': a ? getGrade((m.score / a.max_marks) * 100) : '—',
            'Entered Date': fmtDate(m.entered_at || m.created_at)
        };
    });
    exportToExcel(data, `All_Marks_Export_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ All marks exported', 'success');
};

// Refresh marks data
window.refreshMarksData = function () {
    loadMarksDatabase();
};

// Helper functions



async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.subjects.length) await refreshTable('subjects');
    if (!state.assessments.length) await refreshTable('assessments');
    if (!state.marks.length) await refreshTable('marks');
}