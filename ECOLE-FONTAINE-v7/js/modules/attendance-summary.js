// ============================================================
// ATTENDANCE SUMMARY MODULE - View attendance summaries
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, esc } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

// Render Attendance Summary page
export async function renderAttendanceSummary(container) {
    await ensureStateLoaded();
    
    let classes = (state.classes || []).filter(c => c.is_active !== false);
    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        classes = classes.filter(c => classIds.includes(c.id));
    }
    
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Attendance Summary</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="exportAttendanceSummary()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="form-grid" style="margin-bottom: 20px;">
                    <div class="form-group">
                        <label>Class</label>
                        <select id="summary-class" onchange="loadAttendanceSummary()">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="summary-start" value="${getStartOfTerm()}">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="summary-end" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group" style="align-self: flex-end;">
                        <button class="btn btn-primary" onclick="loadAttendanceSummary()">🔍 Load Summary</button>
                    </div>
                </div>
                <div id="attendance-summary-container"></div>
            </div>
        </div>
    `;
}

// Get start of term date
function getStartOfTerm() {
    if (state.currentTerm?.start_date) return state.currentTerm.start_date;
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
}

// Load attendance summary
window.loadAttendanceSummary = async function() {
    const classId = document.getElementById('summary-class')?.value;
    const startDate = document.getElementById('summary-start')?.value;
    const endDate = document.getElementById('summary-end')?.value;
    const container = document.getElementById('attendance-summary-container');
    
    if (!startDate || !endDate) {
        container.innerHTML = '<div class="alert alert-info">Please select date range.</div>';
        return;
    }
    
    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading summary...</p></div>';
    
    let attendance = [];
    try { attendance = await getAll('attendance'); } catch(e) { attendance = []; }
    
    // Filter by date range
    attendance = attendance.filter(a => a.date >= startDate && a.date <= endDate);
    
    if (classId) attendance = attendance.filter(a => a.class_id == classId);
    
    // Group by class
    const classMap = new Map();
    for (const record of attendance) {
        if (!classMap.has(record.class_id)) classMap.set(record.class_id, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
        const stats = classMap.get(record.class_id);
        stats.total++;
        if (record.status === 'present') stats.present++;
        else if (record.status === 'absent') stats.absent++;
        else if (record.status === 'late') stats.late++;
        else if (record.status === 'excused') stats.excused++;
    }
    
    if (classMap.size === 0) {
        container.innerHTML = '<div class="alert alert-info">No attendance records found for the selected period.</div>';
        return;
    }
    
    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Total</th><th>Attendance Rate</th></tr></thead><tbody>';
    
    for (const [classId, stats] of classMap) {
        const cls = getClassById(classId);
        const rate = stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) : 0;
        html += `<tr>
            <td><strong>${esc(cls?.name || 'Unknown')}</strong></td>
            <td>${stats.present} (${stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 0}%)</span>
            <td>${stats.absent}</span>
            <td>${stats.late}</span>
            <td>${stats.excused}</span>
            <td>${stats.total}</span>
            <td><span class="badge ${rate >= 90 ? 'badge-success' : rate >= 75 ? 'badge-warning' : 'badge-danger'}">${rate}%</span></span>
        </tr>`;
    }
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
};

// Export attendance summary
window.exportAttendanceSummary = async function() {
    const classId = document.getElementById('summary-class')?.value;
    const startDate = document.getElementById('summary-start')?.value;
    const endDate = document.getElementById('summary-end')?.value;
    
    if (!startDate || !endDate) {
        showToast('Please select date range', 'warning');
        return;
    }
    
    let attendance = [];
    try { attendance = await getAll('attendance'); } catch(e) { attendance = []; }
    
    attendance = attendance.filter(a => a.date >= startDate && a.date <= endDate);
    if (classId) attendance = attendance.filter(a => a.class_id == classId);
    
    const data = [];
    for (const record of attendance) {
        const student = getStudentById(record.student_id);
        const cls = getClassById(record.class_id);
        data.push({
            'Date': record.date,
            'Student': student ? `${student.first_name} ${student.last_name}` : '—',
            'Class': cls?.name || '—',
            'Status': record.status,
            'Notes': record.notes || ''
        });
    }
    
    exportToExcel(data, `Attendance_Summary_${startDate}_to_${endDate}`);
    showToast('✅ Attendance summary exported', 'success');
};

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
}