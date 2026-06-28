// js/modules/teacher-assignments.js
// Teacher Assignments Module - Assign teachers to classes and subjects

import { state } from '../core/state.js';
import { getAll, insert, update, remove, removeWhere } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getTeacherById } from './student-fees.js';

export async function renderTeacherAssignments(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const classes = state.classes.filter(c => c.is_active !== false);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    let assignments = [];
    try {
        assignments = await getAll('teacher_assignments');
        window._allAssignments = assignments;
    } catch (e) {
        assignments = [];
        window._allAssignments = [];
    }

    // Group assignments by teacher
    const assignmentsByTeacher = new Map();
    for (const a of assignments) {
        if (!assignmentsByTeacher.has(a.teacher_id)) {
            assignmentsByTeacher.set(a.teacher_id, []);
        }
        assignmentsByTeacher.get(a.teacher_id).push({
            class_id: a.class_id,
            subject_id: a.subject_id,
            class_name: getClassById(a.class_id)?.name,
            subject_name: getSubjectById(a.subject_id)?.name
        });
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📌 Teacher Assignments</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAssignmentModal()">➕ Assign</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportAssignments()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Teacher</th>
                                <th>Department</th>
                                <th>Assigned Classes & Subjects</th>
                                <th>Load</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teachers.map(teacher => {
        const teacherAssignments = assignmentsByTeacher.get(teacher.id) || [];
        const loadCount = teacherAssignments.length;
        const loadClass = loadCount > 10 ? 'badge-danger' : (loadCount > 5 ? 'badge-warning' : 'badge-success');

        return `
                                    <tr>
                                        <td><strong>${esc(teacher.name)}</strong><br><small>${esc(teacher.email || '')}</small></td>
                                        <td>${esc(teacher.department || 'General')}</span>
                                        <td>
                                            <div style="display:flex; flex-wrap:wrap; gap:6px">
                                                ${teacherAssignments.map(a => `
                                                    <span class="badge badge-info" style="background:var(--info-bg); color:var(--info)">${esc(a.class_name)} - ${esc(a.subject_name)}</span>
                                                `).join('') || '<span style="color:var(--text-muted)">No assignments</span>'}
                                            </div>
                                         </span>
                                        <td style="text-align:center"><span class="badge ${loadClass}">${loadCount} classes</span></td>
                                        <td style="text-align:center">
                                            <div class="btn-group" style="gap:4px; justify-content:center">
                                                <button class="btn btn-sm btn-outline" onclick="window.editTeacherAssignments(${teacher.id})">✏️ Edit</button>
                                                <button class="btn btn-sm btn-danger" onclick="window.clearTeacherAssignments(${teacher.id}, '${esc(teacher.name)}')">🗑️ Clear All</button>
                                            </div>
                                        </span>
                                    </tr>
                                `;
    }).join('') || '<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No teachers found</span>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Assignment Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="assignment-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                </div>
            </div>
        </div>
    `;

    window.openAssignmentModal = openAssignmentModal;
    window.editTeacherAssignments = editTeacherAssignments;
    window.clearTeacherAssignments = clearTeacherAssignments;
    window.exportAssignments = exportAssignments;
    window.submitAssignment = submitAssignment;
    window.toggleRowSubjects = toggleRowSubjects;
    window.saveTeacherAssignments = saveTeacherAssignments;

    renderAssignmentStats(teachers, assignments);
}

function renderAssignmentStats(teachers, assignments) {
    const container = document.getElementById('assignment-stats');
    if (!container) return;

    const totalTeachers = teachers.length;
    const totalAssignments = assignments.length;
    const avgPerTeacher = totalTeachers > 0 ? (totalAssignments / totalTeachers).toFixed(1) : 0;
    const unassignedTeachers = teachers.filter(t => !assignments.some(a => a.teacher_id === t.id)).length;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">👩‍🏫</div>
            <div class="stat-value">${totalTeachers}</div>
            <div class="stat-label">Total Teachers</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-value">${totalAssignments}</div>
            <div class="stat-label">Total Assignments</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${avgPerTeacher}</div>
            <div class="stat-label">Avg per Teacher</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-value">${unassignedTeachers}</div>
            <div class="stat-label">Unassigned Teachers</div>
        </div>
    `;
}

function openAssignmentModal() {
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const classes = state.classes.filter(c => c.is_active !== false);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    showModal(`
        <div class="modal-overlay" id="assignment-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Assign Teacher to Class & Subject</h3>
                    <button class="modal-close" onclick="closeModal('assignment-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Teacher</label>
                            <select id="assign-teacher" class="form-control">
                                <option value="">-- Select Teacher --</option>
                                ${teachers.map(t => `<option value="${t.id}">${esc(t.name)} (${esc(t.department || 'General')})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Class</label>
                            <select id="assign-class" class="form-control">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Subject</label>
                            <select id="assign-subject" class="form-control">
                                <option value="">-- Select Subject --</option>
                                ${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Academic Year</label>
                            <select id="assign-year" class="form-control">
                                ${state.academicYears.map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('assignment-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitAssignment()">Assign</button>
                </div>
            </div>
        </div>
    `);
}

async function submitAssignment() {
    const teacherId = document.getElementById('assign-teacher')?.value;
    const classId = document.getElementById('assign-class')?.value;
    const subjectId = document.getElementById('assign-subject')?.value;
    const yearId = document.getElementById('assign-year')?.value;

    if (!teacherId || !classId || !subjectId) {
        showToast('Please select teacher, class, and subject', 'warning');
        return;
    }

    // Check if assignment already exists
    const existing = await getAll('teacher_assignments', {
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId,
        academic_year_id: yearId
    });

    if (existing.length > 0) {
        showToast('This assignment already exists', 'warning');
        return;
    }

    await insert('teacher_assignments', {
        teacher_id: parseInt(teacherId),
        class_id: parseInt(classId),
        subject_id: parseInt(subjectId),
        academic_year_id: parseInt(yearId),
        created_at: new Date().toISOString()
    });

    await refreshTable('teacher_assignments');
    closeModal('assignment-modal');
    showToast('✅ Assignment created', 'success');
    renderTeacherAssignments(document.getElementById('dynamic-content'));
}

async function editTeacherAssignments(teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return;

    const existing = await getAll('teacher_assignments', { teacher_id: teacherId });
    const existingSet = new Set(existing.map(a => `${a.class_id}|${a.subject_id}`));

    const classes = state.classes.filter(c => c.is_active !== false);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    showModal(`
        <div class="modal-overlay" id="edit-assignments-modal">
            <div class="modal modal-lg" onclick="event.stopPropagation()" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>✏️ Edit Assignments - ${esc(teacher.name)}</h3>
                    <button class="modal-close" onclick="closeModal('edit-assignments-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        Check the boxes to assign the teacher to a class and subject combination.
                    </div>
                    <div class="table-wrapper" style="max-height: 500px; overflow-y: auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width:40px">Assign</th>
                                    <th>Class</th>
                                    ${subjects.map(s => `<th>${esc(s.name)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${classes.map(cls => `
                                    <tr>
                                        <td style="text-align:center"><input type="checkbox" class="select-all-row" data-class="${cls.id}" onchange="window.toggleRowSubjects(${cls.id}, this.checked)"></td>
                                        <td><strong>${esc(cls.name)}</strong></td>
                                        ${subjects.map(sub => `
                                            <td style="text-align:center">
                                                <input type="checkbox" class="assign-cb" data-class="${cls.id}" data-subject="${sub.id}" ${existingSet.has(`${cls.id}|${sub.id}`) ? 'checked' : ''}>
                                            </span>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="form-group" style="margin-top:16px">
                        <label>Academic Year</label>
                        <select id="edit-assign-year" class="form-control">
                            ${state.academicYears.map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-assignments-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveTeacherAssignments(${teacherId})">Save Assignments</button>
                </div>
            </div>
        </div>
    `);
}

function toggleRowSubjects(classId, checked) {
    document.querySelectorAll(`.assign-cb[data-class="${classId}"]`).forEach(cb => cb.checked = checked);
}

async function saveTeacherAssignments(teacherId) {
    const teacher = getTeacherById(teacherId);
    const yearId = document.getElementById('edit-assign-year')?.value;
    const selected = [];
    document.querySelectorAll('.assign-cb:checked').forEach(cb => {
        selected.push({
            class_id: parseInt(cb.dataset.class),
            subject_id: parseInt(cb.dataset.subject)
        });
    });

    // Remove existing assignments for this teacher and year
    await removeWhere('teacher_assignments', `teacher_id=eq.${teacherId} AND academic_year_id=eq.${yearId}`);

    // Insert new assignments
    for (const s of selected) {
        await insert('teacher_assignments', {
            teacher_id: teacherId,
            class_id: s.class_id,
            subject_id: s.subject_id,
            academic_year_id: parseInt(yearId),
            created_at: new Date().toISOString()
        });
    }

    await refreshTable('teacher_assignments');
    closeModal('edit-assignments-modal');
    showToast(`✅ Saved ${selected.length} assignments for ${teacher?.name}`, 'success');
    renderTeacherAssignments(document.getElementById('dynamic-content'));
}

async function clearTeacherAssignments(teacherId, teacherName) {
    const assignmentCount = await getAll('teacher_assignments', { teacher_id: teacherId });
    if (assignmentCount.length === 0) {
        showToast('No assignments to clear', 'info');
        return;
    }

    if (!await confirmDialog(`Remove ALL ${assignmentCount.length} assignments for ${teacherName}?`)) return;

    await removeWhere('teacher_assignments', `teacher_id=eq.${teacherId}`);
    await refreshTable('teacher_assignments');
    showToast(`✅ Cleared ${assignmentCount.length} assignments for ${teacherName}`, 'success');
    renderTeacherAssignments(document.getElementById('dynamic-content'));
}

function exportAssignments() {
    const data = [];
    const assignments = window._allAssignments || [];

    for (const a of assignments) {
        const teacher = getTeacherById(a.teacher_id);
        const cls = getClassById(a.class_id);
        const sub = getSubjectById(a.subject_id);
        const year = state.academicYears.find(y => y.id === a.academic_year_id);

        data.push({
            'Teacher': teacher?.name || '—',
            'Department': teacher?.department || '—',
            'Class': cls?.name || '—',
            'Subject': sub?.name || '—',
            'Academic Year': year?.name || '—',
            'Created': fmtDate(a.created_at)
        });
    }

    exportToExcel(data, `Teacher_Assignments_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Assignments exported', 'success');
}