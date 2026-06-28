// js/modules/class-timetable.js
// Class Timetable Module - View and manage class schedules

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
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

export async function renderClassTimetable(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isAdmin = user?.role === 'admin';
    const classes = state.classes.filter(c => c.is_active !== false);
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🕐 Class Timetable</span>
                <div class="btn-group">
                    <select id="tt-class-select" class="form-control" style="width:200px" onchange="window.loadClassTimetable()">
                        <option value="">-- Select Class --</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="window.exportClassTimetable()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printClassTimetable()">🖨️ Print</button>
                    ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="window.openAddTimetableSlot()">➕ Add Slot</button>` : ''}
                </div>
            </div>
            <div class="dash-card-body" style="padding:0;overflow-x:auto">
                <div id="class-timetable-container">
                    <div class="loading-container"><div class="spinner"></div><p>Select a class to view timetable</p></div>
                </div>
            </div>
        </div>
        
        <div id="tt-modal-wrap"></div>
    `;

    window.loadClassTimetable = loadClassTimetable;
    window.exportClassTimetable = exportClassTimetable;
    window.printClassTimetable = printClassTimetable;
    window.openAddTimetableSlot = openAddTimetableSlot;
    window.openEditTimetableSlot = openEditTimetableSlot;
    window.deleteTimetableSlot = deleteTimetableSlot;
}

async function loadClassTimetable() {
    const classId = document.getElementById('tt-class-select')?.value;
    const container = document.getElementById('class-timetable-container');

    if (!classId) {
        container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Select a class to view timetable</p></div>';
        return;
    }

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading timetable...</p></div>';

    try {
        let slots = await getAll('timetable_slots');
        slots = slots.filter(s => s.class_id == classId);

        // Sort slots by day and time
        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
        const timeOrder = {};
        TIME_SLOTS.forEach((ts, idx) => { timeOrder[ts] = idx; });

        slots.sort((a, b) => {
            if (a.day !== b.day) return (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
            return (timeOrder[a.time_slot] || 0) - (timeOrder[b.time_slot] || 0);
        });

        const idx = {};
        for (const s of slots) {
            if (!idx[s.day]) idx[s.day] = {};
            if (!idx[s.day][s.time_slot]) idx[s.day][s.time_slot] = [];
            idx[s.day][s.time_slot].push(s);
        }

        const className = getClassById(classId)?.name || 'Class';
        const user = state.currentUser;
        const isAdmin = user?.role === 'admin';

        let html = `
            <div style="padding:12px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                <strong>📅 Class Timetable — ${esc(className)}</strong>
                <span style="margin-left:12px;font-size:12px;">Week of ${new Date().toLocaleDateString()}</span>
            </div>
            <table class="data-table" id="timetable-table" style="min-width:800px;font-size:12px">
                <thead>
                    <tr style="background:var(--bg-tertiary)">
                        <th style="min-width:100px">Time / Day</th>
                        ${DAYS.map(d => `<th style="min-width:130px">${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        for (const ts of TIME_SLOTS) {
            const breakIcon = getBreakIcon(ts);
            const isBreak = isBreakSlot(ts);
            const breakLabel = isBreak ? (ts === '10:20-10:40' ? '🍎 MORNING BREAK' : ts === '12:00-13:00' ? '🍽️ LUNCH BREAK' : '☕ AFTERNOON BREAK') : '';

            html += `
                <tr style="${isBreak ? 'background:var(--bg-tertiary)' : ''}">
                    <td style="font-weight:600;white-space:nowrap;padding:8px 12px">
                        ${ts}${breakIcon ? ` ${breakIcon}` : ''}<br>
                        ${breakLabel ? `<span style="font-size:10px;color:var(--text-muted)">${breakLabel}</span>` : ''}
                    </td>
            `;

            for (const day of DAYS) {
                const daySlots = idx[day]?.[ts] || [];
                if (daySlots.length === 0) {
                    html += `<td style="text-align:center;color:var(--text-muted);${isBreak ? 'font-style:italic' : ''}">
                        ${isBreak ? (ts === '10:20-10:40' ? '🍎' : ts === '12:00-13:00' ? '🍽️' : '☕') :
                            (isAdmin ? `<button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 6px" onclick="window.openAddTimetableSlot('${day}','${ts}')">＋</button>` : '—')}
                    </table>`;
                } else {
                    html += `<td style="padding:4px 6px">`;
                    for (const sl of daySlots) {
                        const subj = getSubjectById(sl.subject_id);
                        const tch = getTeacherById(sl.teacher_id);
                        html += `
                            <div style="background:var(--role-light,var(--info-bg));border-radius:var(--r-sm);padding:4px 8px;margin:2px 0;border-left:3px solid var(--role-primary,var(--info))">
                                <div style="font-weight:600;font-size:12px">${esc(subj?.name || '?')}</div>
                                <div style="color:var(--text-muted);font-size:10px">👤 ${esc(tch?.name || '—')}</div>
                                ${sl.room ? `<div style="color:var(--text-muted);font-size:10px">📍 Room: ${esc(sl.room)}</div>` : ''}
                                ${isAdmin ? `
                                    <div style="margin-top:4px;display:flex;gap:4px">
                                        <button class="btn btn-sm btn-outline" style="font-size:9px;padding:1px 5px" onclick="window.openEditTimetableSlot(${sl.id})">✏️</button>
                                        <button class="btn btn-sm btn-danger" style="font-size:9px;padding:1px 5px" onclick="window.deleteTimetableSlot(${sl.id})">🗑️</button>
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

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (e) {
        console.error('[ClassTimetable]', e);
        container.innerHTML = `<div class="alert alert-danger" style="margin:16px">⚠️ Could not load timetable: ${esc(e.message)}</div>`;
    }
}

function openAddTimetableSlot(prefillDay = '', prefillTime = '') {
    const classId = document.getElementById('tt-class-select')?.value;
    if (!classId) {
        showToast('Please select a class first', 'warning');
        return;
    }

    const classOpts = `<option value="${classId}" selected>${esc(getClassById(classId)?.name || 'Class')}</option>`;
    const teacherOpts = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false)
        .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    const subjectOpts = state.subjects.filter(s => s.is_active !== false)
        .map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const dayOpts = DAYS.map(d => `<option value="${d}" ${d === prefillDay ? 'selected' : ''}>${d}</option>`).join('');
    const tsOpts = TIME_SLOTS.map(t => `<option value="${t}" ${t === prefillTime ? 'selected' : ''}>${t}</option>`).join('');

    showModal(`
        <div class="modal-overlay" id="tt-modal" onclick="if(event.target===this)closeModal('tt-modal')">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>➕ Add Timetable Slot</h3>
                    <button class="modal-close" onclick="closeModal('tt-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Day</label><select id="tt-day">${dayOpts}</select></div>
                        <div class="form-group"><label>Time Slot</label><select id="tt-time">${tsOpts}</select></div>
                        <div class="form-group"><label>Class</label><select id="tt-class">${classOpts}</select></div>
                        <div class="form-group"><label>Subject *</label><select id="tt-subject">${subjectOpts}</select></div>
                        <div class="form-group"><label>Teacher</label><select id="tt-teacher">${teacherOpts}</select></div>
                        <div class="form-group"><label>Room</label><input type="text" id="tt-room" placeholder="e.g., Room 101"></div>
                        <div class="form-group"><label>Notes</label><input type="text" id="tt-notes" placeholder="Optional notes"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('tt-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveTimetableSlot()">Save Slot</button>
                </div>
            </div>
        </div>
    `);

    window.saveTimetableSlot = saveTimetableSlot;
}

async function openEditTimetableSlot(slotId) {
    const slots = await getAll('timetable_slots');
    const slot = slots.find(s => s.id == slotId);
    if (!slot) return;

    const classOpts = `<option value="${slot.class_id}" selected>${esc(getClassById(slot.class_id)?.name || 'Class')}</option>`;
    const teacherOpts = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false)
        .map(t => `<option value="${t.id}" ${t.id == slot.teacher_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const subjectOpts = state.subjects.filter(s => s.is_active !== false)
        .map(s => `<option value="${s.id}" ${s.id == slot.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    const dayOpts = DAYS.map(d => `<option value="${d}" ${d === slot.day ? 'selected' : ''}>${d}</option>`).join('');
    const tsOpts = TIME_SLOTS.map(t => `<option value="${t}" ${t === slot.time_slot ? 'selected' : ''}>${t}</option>`).join('');

    showModal(`
        <div class="modal-overlay" id="tt-modal" onclick="if(event.target===this)closeModal('tt-modal')">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>✏️ Edit Timetable Slot</h3>
                    <button class="modal-close" onclick="closeModal('tt-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Day</label><select id="tt-day">${dayOpts}</select></div>
                        <div class="form-group"><label>Time Slot</label><select id="tt-time">${tsOpts}</select></div>
                        <div class="form-group"><label>Class</label><select id="tt-class">${classOpts}</select></div>
                        <div class="form-group"><label>Subject *</label><select id="tt-subject">${subjectOpts}</select></div>
                        <div class="form-group"><label>Teacher</label><select id="tt-teacher">${teacherOpts}</select></div>
                        <div class="form-group"><label>Room</label><input type="text" id="tt-room" value="${esc(slot.room || '')}"></div>
                        <div class="form-group"><label>Notes</label><input type="text" id="tt-notes" value="${esc(slot.notes || '')}"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('tt-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateTimetableSlot(${slotId})">Update Slot</button>
                </div>
            </div>
        </div>
    `);

    window.updateTimetableSlot = updateTimetableSlot;
}

async function saveTimetableSlot() {
    const day = document.getElementById('tt-day')?.value;
    const time_slot = document.getElementById('tt-time')?.value;
    const class_id = parseInt(document.getElementById('tt-class')?.value);
    const subject_id = parseInt(document.getElementById('tt-subject')?.value);
    const teacher_id = parseInt(document.getElementById('tt-teacher')?.value) || null;
    const room = document.getElementById('tt-room')?.value.trim() || null;
    const notes = document.getElementById('tt-notes')?.value.trim() || null;

    if (!day || !time_slot || !class_id || !subject_id) {
        showToast('Day, time, class and subject are required', 'warning');
        return;
    }

    // Check for conflicts
    const existing = await getAll('timetable_slots', {
        class_id: class_id,
        day: day,
        time_slot: time_slot
    });

    if (existing.length > 0) {
        if (!await confirmDialog(`A slot already exists at this time for this class. Replace it?`)) return;
        await update('timetable_slots', existing[0].id, { subject_id, teacher_id, room, notes, updated_at: new Date().toISOString() });
        showToast('✅ Slot updated', 'success');
    } else {
        await insert('timetable_slots', {
            day, time_slot, class_id, subject_id, teacher_id, room, notes,
            created_at: new Date().toISOString()
        });
        showToast('✅ Slot added', 'success');
    }

    closeModal('tt-modal');
    await loadClassTimetable();
}

async function updateTimetableSlot(slotId) {
    const day = document.getElementById('tt-day')?.value;
    const time_slot = document.getElementById('tt-time')?.value;
    const class_id = parseInt(document.getElementById('tt-class')?.value);
    const subject_id = parseInt(document.getElementById('tt-subject')?.value);
    const teacher_id = parseInt(document.getElementById('tt-teacher')?.value) || null;
    const room = document.getElementById('tt-room')?.value.trim() || null;
    const notes = document.getElementById('tt-notes')?.value.trim() || null;

    await update('timetable_slots', slotId, {
        day, time_slot, class_id, subject_id, teacher_id, room, notes,
        updated_at: new Date().toISOString()
    });

    closeModal('tt-modal');
    showToast('✅ Slot updated', 'success');
    await loadClassTimetable();
}

async function deleteTimetableSlot(slotId) {
    if (!await confirmDialog('Delete this timetable slot?')) return;
    await remove('timetable_slots', slotId);
    showToast('✅ Slot deleted', 'success');
    await loadClassTimetable();
}

function exportClassTimetable() {
    const table = document.getElementById('timetable-table');
    if (!table) {
        showToast('No data to export', 'warning');
        return;
    }

    const rows = [];
    table.querySelectorAll('tr').forEach(tr => {
        rows.push(Array.from(tr.querySelectorAll('th,td')).map(td => td.innerText.replace(/[\n\r]+/g, ' ').trim()));
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Class Timetable');
    XLSX.writeFile(wb, `Class_Timetable_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Timetable exported', 'success');
}

function printClassTimetable() {
    const container = document.getElementById('class-timetable-container');
    if (!container) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Class Timetable - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h2{text-align:center;margin-bottom:16px}
                table{border-collapse:collapse;width:100%;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px 8px}
                th{background:#f0f0f0;font-weight:700}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h2>ECOLE LA FONTAINE — Class Timetable</h2>
            <p style="text-align:center;margin-bottom:16px">Generated on ${new Date().toLocaleDateString()}</p>
            ${container.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}