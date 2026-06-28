// ============================================================
// ATTENDANCE MODULE - Daily attendance entry (Admin + Accountant)
// ============================================================
import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { getAll, insert, update } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

export const ATTENDANCE_STATUS = {
    PRESENT: 'present', ABSENT: 'absent', LATE: 'late', EXCUSED: 'excused'
};

const ABSENCE_REASONS = [
    'Sick / Illness', 'Family Emergency', 'Travel / Trip',
    'Weather / Roads', 'School Event', 'Suspension',
    'Unknown', 'Other'
];

// Admin and Accountant can record attendance; teacher only for own classes
function canRecordAttendance() {
    const role = getCurrentUser()?.role;
    return role === 'admin' || role === 'accountant' || role === 'teacher';
}

export async function renderAttendanceEntry(container) {
    if (!canRecordAttendance()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied.</div>';
        return;
    }
    let classes = (state.classes || []).filter(c => c.is_active !== false)
        .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
        const classIds = new Set(assignments.map(a => a.class_id));
        classes = classes.filter(c => classIds.has(c.id));
    }

    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📋 Daily Attendance Entry</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.navigateTo('attendance-reports')">📊 Reports</button>
                    <button class="btn btn-sm btn-outline" onclick="window.navigateTo('attendance-summary')">📈 Summary</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="form-grid" style="margin-bottom:16px">
                    <div class="form-group">
                        <label>Class *</label>
                        <select id="att-class" onchange="window.loadAttendanceStudents()">
                            <option value="">-- Select Class --</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="att-date" value="${today}" onchange="window.loadAttendanceStudents()">
                    </div>
                    <div class="form-group" style="align-self:flex-end">
                        <button class="btn btn-primary" onclick="window.loadAttendanceStudents()">📋 Load</button>
                    </div>
                </div>
                <div id="att-toolbar" style="display:none;margin-bottom:12px">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                        <strong id="att-summary-line" style="color:var(--text-muted);font-size:13px"></strong>
                        <button class="btn btn-sm btn-success" onclick="window.markAllPresent()">✅ All Present</button>
                        <button class="btn btn-sm btn-outline" onclick="window.markAllAbsent()">❌ All Absent</button>
                        <button class="btn btn-sm btn-outline" onclick="window.exportAttendanceDay()">📥 Export</button>
                    </div>
                </div>
                <div id="attendance-students-container"></div>
                <div id="att-save-row" style="display:none;margin-top:16px">
                    <button class="btn btn-success" onclick="window.saveAttendance()">💾 Save Attendance</button>
                </div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px" id="att-absent-report" style="display:none">
            <div class="dash-card-header">
                <span class="dash-card-title">❌ Today's Absent Students</span>
            </div>
            <div class="dash-card-body" id="att-absent-list">
                <p style="color:var(--text-muted)">Save attendance first to see the absent report.</p>
            </div>
        </div>
    `;

    window.loadAttendanceStudents = loadAttendanceStudents;
    window.markAllPresent = markAllPresent;
    window.markAllAbsent = markAllAbsent;
    window.saveAttendance = saveAttendance;
    window.exportAttendanceDay = exportAttendanceDay;
    window.updateAttSummary = updateAttSummary;
}

async function loadAttendanceStudents() {
    const classId = document.getElementById('att-class')?.value;
    const date = document.getElementById('att-date')?.value;
    const container = document.getElementById('attendance-students-container');
    const toolbar = document.getElementById('att-toolbar');
    const saveRow = document.getElementById('att-save-row');

    if (!classId || !date) {
        container.innerHTML = '<div class="alert alert-info">Select a class and date.</div>';
        return;
    }

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';

    const students = (state.students || [])
        .filter(s => s.class_id == classId && s.status === 'Active')
        .sort((a, b) => a.last_name.localeCompare(b.last_name));

    let existingMap = new Map();
    try {
        const existing = await getAll('attendance', { class_id: classId, date });
        existing.forEach(a => existingMap.set(a.student_id, a));
    } catch (e) {}

    if (students.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No active students in this class.</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table" id="att-table">
                <thead>
                    <tr>
                        <th style="width:32px">#</th>
                        <th>Student Name</th>
                        <th style="width:90px">Status</th>
                        <th>Reason (if absent/late/excused)</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map((s, i) => {
        const rec = existingMap.get(s.id);
        const status = rec?.status || 'present';
        const reason = rec?.reason || '';
        const notes = rec?.notes || '';
        const isAbsent = status !== 'present';
        return `<tr id="att-row-${s.id}" class="${isAbsent ? 'att-absent-row' : ''}">
                            <td style="color:var(--text-muted)">${i + 1}</td>
                            <td><strong>${esc(s.last_name)}, ${esc(s.first_name)}</strong></td>
                            <td>
                                <select class="att-status form-control" data-sid="${s.id}"
                                    onchange="window.updateAttSummary(); window.onStatusChange(this)"
                                    style="padding:4px 6px;font-size:12px">
                                    <option value="present" ${status === 'present' ? 'selected' : ''}>✅ Present</option>
                                    <option value="absent"  ${status === 'absent'  ? 'selected' : ''}>❌ Absent</option>
                                    <option value="late"    ${status === 'late'    ? 'selected' : ''}>⏰ Late</option>
                                    <option value="excused" ${status === 'excused' ? 'selected' : ''}>📝 Excused</option>
                                </select>
                            </td>
                            <td>
                                <select class="att-reason form-control" data-sid="${s.id}"
                                    style="padding:4px 6px;font-size:12px;display:${isAbsent ? 'block' : 'none'}">
                                    <option value="">— Select reason —</option>
                                    ${ABSENCE_REASONS.map(r => `<option value="${r}" ${reason === r ? 'selected' : ''}>${r}</option>`).join('')}
                                </select>
                            </td>
                            <td>
                                <input class="att-notes form-control" data-sid="${s.id}"
                                    type="text" placeholder="Optional" value="${esc(notes)}"
                                    style="font-size:12px;padding:4px 6px">
                            </td>
                        </tr>`;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    toolbar.style.display = 'block';
    saveRow.style.display = 'block';
    window.onStatusChange = onStatusChange;
    updateAttSummary();
}

function onStatusChange(select) {
    const sid = select.dataset.sid;
    const isAbsent = select.value !== 'present';
    const row = document.getElementById(`att-row-${sid}`);
    const reasonSelect = document.querySelector(`.att-reason[data-sid="${sid}"]`);
    if (row) row.className = isAbsent ? 'att-absent-row' : '';
    if (reasonSelect) reasonSelect.style.display = isAbsent ? 'block' : 'none';
    updateAttSummary();
}

function updateAttSummary() {
    const statuses = [...document.querySelectorAll('.att-status')];
    const total = statuses.length;
    const present = statuses.filter(s => s.value === 'present').length;
    const absent = statuses.filter(s => s.value === 'absent').length;
    const late = statuses.filter(s => s.value === 'late').length;
    const excused = statuses.filter(s => s.value === 'excused').length;
    const el = document.getElementById('att-summary-line');
    if (el) el.textContent = `Total: ${total} | ✅ Present: ${present} | ❌ Absent: ${absent} | ⏰ Late: ${late} | 📝 Excused: ${excused}`;
}

function markAllPresent() {
    document.querySelectorAll('.att-status').forEach(s => {
        s.value = 'present';
        onStatusChange(s);
    });
    showToast('All marked present', 'info', 1500);
}

function markAllAbsent() {
    document.querySelectorAll('.att-status').forEach(s => {
        s.value = 'absent';
        onStatusChange(s);
    });
    showToast('All marked absent', 'info', 1500);
}

async function saveAttendance() {
    const classId = document.getElementById('att-class')?.value;
    const date = document.getElementById('att-date')?.value;
    if (!classId || !date) { showToast('Select class and date', 'warning'); return; }

    const rows = document.querySelectorAll('.att-status');
    if (rows.length === 0) { showToast('No students to save', 'warning'); return; }

    let saved = 0, errors = 0;
    const absentStudents = [];

    for (const select of rows) {
        const sid = parseInt(select.dataset.sid);
        const status = select.value;
        const reason = document.querySelector(`.att-reason[data-sid="${sid}"]`)?.value || null;
        const notes = document.querySelector(`.att-notes[data-sid="${sid}"]`)?.value || null;

        try {
            const existing = await getAll('attendance', { class_id: classId, student_id: sid, date });
            const payload = { status, reason: reason || null, notes: notes || null, updated_at: new Date().toISOString() };
            if (existing.length > 0) {
                await update('attendance', existing[0].id, payload);
            } else {
                await insert('attendance', {
                    class_id: parseInt(classId), student_id: sid, date, status,
                    reason: reason || null, notes: notes || null,
                    recorded_by: getCurrentUser()?.id, created_at: new Date().toISOString()
                });
            }
            saved++;
            if (status !== 'present') {
                const s = getStudentById(sid);
                absentStudents.push({ name: `${s?.last_name || ''}, ${s?.first_name || ''}`, status, reason: reason || '—', notes: notes || '—' });
            }
        } catch (e) { errors++; }
    }

    showToast(`✅ ${saved} records saved${errors > 0 ? ` (${errors} errors)` : ''}`, errors > 0 ? 'warning' : 'success');

    // Show absent report
    const absentCard = document.getElementById('att-absent-report');
    const absentList = document.getElementById('att-absent-list');
    if (absentCard && absentList) {
        absentCard.style.display = 'block';
        if (absentStudents.length === 0) {
            absentList.innerHTML = '<div class="alert alert-success">🎉 All students are present today!</div>';
        } else {
            absentList.innerHTML = `
                <p style="margin-bottom:8px"><strong>${absentStudents.length} student(s) not present today (${date}):</strong></p>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Name</th><th>Status</th><th>Reason</th><th>Notes</th></tr></thead>
                        <tbody>
                            ${absentStudents.map(a => `<tr>
                                <td><strong>${esc(a.name)}</strong></td>
                                <td>${a.status === 'absent' ? '❌ Absent' : a.status === 'late' ? '⏰ Late' : '📝 Excused'}</td>
                                <td>${esc(a.reason)}</td>
                                <td>${esc(a.notes)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="window.printAbsentReport('${date}')">🖨️ Print Absent Report</button>
            `;
            window.printAbsentReport = (d) => {
                const w = window.open('', '_blank', 'width=700,height=500');
                w.document.write(`<html><head><title>Absent Report ${d}</title>
                    <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}
                    th,td{border:1px solid #ccc;padding:8px}th{background:#1a3a5c;color:#fff}
                    h2{color:#1a3a5c}</style></head><body>
                    <h2>❌ Absent Students — ${d}</h2>
                    <p>Class: ${document.getElementById('att-class')?.options[document.getElementById('att-class')?.selectedIndex]?.text || '—'}</p>
                    <table><thead><tr><th>#</th><th>Name</th><th>Status</th><th>Reason</th><th>Notes</th></tr></thead>
                    <tbody>${absentStudents.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.name)}</td><td>${a.status}</td><td>${esc(a.reason)}</td><td>${esc(a.notes)}</td></tr>`).join('')}</tbody></table>
                    <script>window.print();<\/script></body></html>`);
                w.document.close();
            };
        }
    }
}

function exportAttendanceDay() {
    const rows = [...document.querySelectorAll('.att-status')];
    const date = document.getElementById('att-date')?.value;
    const clsName = document.getElementById('att-class')?.options[document.getElementById('att-class')?.selectedIndex]?.text;
    const data = rows.map(s => {
        const sid = s.dataset.sid;
        const student = getStudentById(parseInt(sid));
        return {
            'Name': student ? `${student.last_name}, ${student.first_name}` : sid,
            'Status': s.value,
            'Reason': document.querySelector(`.att-reason[data-sid="${sid}"]`)?.value || '',
            'Notes': document.querySelector(`.att-notes[data-sid="${sid}"]`)?.value || ''
        };
    });
    exportToExcel(data, `Attendance_${clsName}_${date}`);
}
