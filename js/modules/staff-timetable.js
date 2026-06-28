// js/modules/staff-timetable.js
// Staff Timetable Module - View all teachers' weekly schedules

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getTeacherById } from '../core/state.js';;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
    '08:20-09:00', '09:00-09:40', '09:40-10:20', '10:20-10:40',
    '10:40-11:20', '11:20-12:00', '12:00-13:00', '13:00-13:40',
    '13:40-14:20', '14:20-15:00', '15:00-15:20', '15:20-16:00', '16:00-16:40'
];

function isBreakSlot(ts) {
    return ts === '10:20-10:40' || ts === '12:00-13:00' || ts === '15:00-15:20';
}

function getBreakIcon(ts) {
    if (ts === '10:20-10:40') return '🍎';
    if (ts === '12:00-13:00') return '🍽️';
    if (ts === '15:00-15:20') return '☕';
    return '';
}

export async function renderStaffTimetable(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const teacherOpts = teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🕐 Staff Timetable / Emploi du Temps du Personnel</span>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <select id="stt-teacher-filter" class="form-control" style="min-width:180px" onchange="window.loadStaffTimetable()">
                        <option value="">All Teachers</option>
                        ${teacherOpts}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="window.exportStaffTimetable()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printStaffTimetable()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0;overflow-x:auto">
                <div id="staff-timetable-container">
                    <div class="loading-container"><div class="spinner"></div><p>Loading staff timetable...</p></div>
                </div>
            </div>
        </div>
    `;

    window.loadStaffTimetable = loadStaffTimetable;
    window.exportStaffTimetable = exportStaffTimetable;
    window.printStaffTimetable = printStaffTimetable;

    await loadStaffTimetable();
}

async function loadStaffTimetable() {
    const container = document.getElementById('staff-timetable-container');
    if (!container) return;

    const teacherIdFilter = document.getElementById('stt-teacher-filter')?.value;

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading timetable...</p></div>';

    try {
        let slots = await getAll('timetable_slots');
        const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
        const displayTeachers = teacherIdFilter ? teachers.filter(t => String(t.id) === String(teacherIdFilter)) : teachers;

        if (displayTeachers.length === 0) {
            container.innerHTML = '<div class="alert alert-info" style="margin:16px">No teachers found.</div>';
            return;
        }

        // Build index of slots by teacher
        const teacherSlotsMap = {};
        for (const s of slots) {
            if (!teacherSlotsMap[s.teacher_id]) teacherSlotsMap[s.teacher_id] = {};
            if (!teacherSlotsMap[s.teacher_id][s.day]) teacherSlotsMap[s.teacher_id][s.day] = {};
            if (!teacherSlotsMap[s.teacher_id][s.day][s.time_slot]) teacherSlotsMap[s.teacher_id][s.day][s.time_slot] = [];
            teacherSlotsMap[s.teacher_id][s.day][s.time_slot].push(s);
        }

        const user = state.currentUser;
        const isAdmin = user?.role === 'admin';

        let html = `
            <div style="padding:12px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                <strong>👩‍🏫 TEACHER TIMETABLE</strong>
                <span style="margin-left:12px;font-size:12px;">Week of ${new Date().toLocaleDateString()}</span>
                <span style="margin-left:12px;font-size:12px;color:var(--text-muted)">${displayTeachers.length} teacher${displayTeachers.length !== 1 ? 's' : ''} shown</span>
            </div>
        `;

        for (const teacher of displayTeachers) {
            const teacherSlots = teacherSlotsMap[teacher.id] || {};

            html += `
                <div style="margin-top:24px;background:var(--bg-secondary);border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border-light)">
                    <div style="padding:12px 16px;background:var(--bg-tertiary);font-weight:700;border-bottom:1px solid var(--border-light)">
                        👤 ${esc(teacher.name)} 
                        ${teacher.department ? `<span style="font-weight:400;color:var(--text-muted)">(${esc(teacher.department)})</span>` : ''}
                    </div>
                    <div style="overflow-x:auto">
                        <table class="data-table" style="min-width:700px;font-size:12px;border-collapse:collapse">
                            <thead>
                                <tr style="background:var(--bg-tertiary)">
                                    <th style="min-width:100px;padding:10px 12px">Time / Day</th>
                                    ${DAYS.map(d => `<th style="min-width:140px;padding:10px 12px;text-align:center">${d}</th>`).join('')}
                                </td>
                            </thead>
                            <tbody>
            `;

            for (const ts of TIME_SLOTS) {
                const breakIcon = getBreakIcon(ts);
                const isBreak = isBreakSlot(ts);
                const breakLabel = isBreak ? (ts === '10:20-10:40' ? '🍎 BREAK' : ts === '12:00-13:00' ? '🍽️ LUNCH' : '☕ BREAK') : '';

                html += `
                    <tr style="${isBreak ? 'background:var(--bg-tertiary)' : ''}">
                        <td style="font-weight:600;white-space:nowrap;padding:8px 12px;vertical-align:middle">
                            ${ts}${breakIcon ? ` ${breakIcon}` : ''}<br>
                            ${breakLabel ? `<span style="font-size:10px;color:var(--text-muted)">${breakLabel}</span>` : ''}
                        </td>
                `;

                for (const day of DAYS) {
                    const daySlots = teacherSlots[day]?.[ts] || [];

                    if (daySlots.length === 0) {
                        html += `<td style="text-align:center;color:var(--text-muted);${isBreak ? 'font-style:italic' : ''};padding:8px 12px">
                            ${isBreak ? (ts === '10:20-10:40' ? '🍎' : ts === '12:00-13:00' ? '🍽️' : '☕') : '—'}
                        </td>`;
                    } else {
                        html += `<td style="padding:4px 6px;vertical-align:top">`;
                        for (const sl of daySlots) {
                            const cls = getClassById(sl.class_id);
                            const subj = getSubjectById(sl.subject_id);
                            const bgColor = subj ? `hsl(${((subj.id || 0) * 47) % 360}, 60%, 92%)` : 'var(--info-bg)';

                            html += `
                                <div style="background:${bgColor};border-radius:var(--r-sm);padding:6px 10px;margin:4px 0;border-left:3px solid hsl(${((subj?.id || 0) * 47) % 360}, 60%, 55%)">
                                    <div style="font-weight:700;font-size:12px">${esc(subj?.name || '?')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary)">📚 ${esc(cls?.name || '?')}</div>
                                    ${sl.room ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">📍 Room: ${esc(sl.room)}</div>` : ''}
                                    ${sl.notes ? `<div style="font-size:10px;color:var(--text-muted);font-style:italic">📝 ${esc(sl.notes)}</div>` : ''}
                                    ${isAdmin ? `
                                        <div style="margin-top:6px;display:flex;gap:4px;justify-content:flex-end">
                                            <button class="btn btn-sm btn-outline" style="font-size:9px;padding:2px 8px" onclick="window.openEditTimetableSlot(${sl.id})">✏️</button>
                                            <button class="btn btn-sm btn-danger" style="font-size:9px;padding:2px 8px" onclick="window.deleteTimetableSlot(${sl.id})">🗑️</button>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }
                        html += `</td>`;
                    }
                }
                html += `</tr>`;
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Add summary footer
        const totalSlots = slots.length;
        const activeTeachers = new Set(slots.map(s => s.teacher_id)).size;

        html += `
            <div style="margin-top:20px;padding:12px 16px;background:var(--bg-tertiary);border-radius:var(--r-lg);display:flex;gap:20px;flex-wrap:wrap;font-size:13px">
                <span>📊 <strong>${totalSlots}</strong> total slots</span>
                <span>👩‍🏫 <strong>${activeTeachers}</strong> teachers with assigned slots</span>
                <span>📅 <strong>${DAYS.length}</strong> days</span>
                <span>⏰ <strong>${TIME_SLOTS.filter(ts => !isBreakSlot(ts)).length}</strong> teaching periods per day</span>
            </div>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error('[StaffTimetable]', e);
        container.innerHTML = `<div class="alert alert-danger" style="margin:16px">⚠️ Could not load staff timetable: ${esc(e.message)}</div>`;
    }
}

function exportStaffTimetable() {
    const container = document.getElementById('staff-timetable-container');
    if (!container) return;

    const tables = container.querySelectorAll('table');
    if (tables.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const wb = XLSX.utils.book_new();
    tables.forEach((table, idx) => {
        const rows = [];
        table.querySelectorAll('tr').forEach(tr => {
            rows.push(Array.from(tr.querySelectorAll('th,td')).map(td => td.innerText.replace(/[\n\r]+/g, ' ').trim()));
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, `Teacher_${idx + 1}`);
    });

    XLSX.writeFile(wb, `Staff_Timetable_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Staff timetable exported', 'success');
}

function printStaffTimetable() {
    const container = document.getElementById('staff-timetable-container');
    if (!container) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Staff Timetable - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
                h2{text-align:center;margin-bottom:16px}
                table{border-collapse:collapse;width:100%;margin-bottom:20px}
                th,td{border:1px solid #ccc;padding:6px 8px}
                th{background:#f0f0f0;font-weight:700}
                .teacher-header{background:#1a3a5c;color:white;padding:10px;margin-top:20px}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h2>ECOLE LA FONTAINE — Staff Timetable</h2>
            <p style="text-align:center;margin-bottom:16px">Generated on ${new Date().toLocaleDateString()}</p>
            ${container.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}