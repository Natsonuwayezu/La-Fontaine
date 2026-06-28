// js/modules/timetable.js
// Timetable Module - Main timetable view and management

import { state } from '../core/state.js';
import { getAll, insert, update, remove, removeWhere } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getTeacherById } from './student-fees.js';

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

export async function renderTimetable(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isAdmin = user?.role === 'admin';
    const classes = state.classes.filter(c => c.is_active !== false);
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🕐 Timetable / Emploi du Temps</span>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <select id="tt-view-type" class="form-control" style="width:140px" onchange="window.switchTimetableView()">
                        <option value="class">📚 Class View</option>
                        <option value="teacher">👩‍🏫 Teacher View</option>
                    </select>
                    <select id="tt-class-filter" class="form-control" style="width:160px" onchange="window.loadTimetable()">
                        <option value="">-- Select Class --</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="tt-teacher-filter" class="form-control" style="width:180px; display:none" onchange="window.loadTimetable()">
                        <option value="">-- Select Teacher --</option>
                        ${teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                    </select>
                    <div class="btn-group">
                        ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="window.openAddSlotModal()">➕ Add Slot</button>` : ''}
                        <button class="btn btn-sm btn-outline" onclick="window.exportTimetable()">📥 Export</button>
                        <button class="btn btn-sm btn-outline" onclick="window.printTimetable()">🖨️ Print</button>
                    </div>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0;overflow-x:auto">
                <div id="timetable-container">
                    <div class="loading-container"><div class="spinner"></div><p>Select a class or teacher to view timetable</p></div>
                </div>
            </div>
        </div>
        <div id="tt-modal-wrap"></div>
    `;

    window.switchTimetableView = switchTimetableView;
    window.loadTimetable = loadTimetable;
    window.exportTimetable = exportTimetable;
    window.printTimetable = printTimetable;
    window.openAddSlotModal = openAddSlotModal;
    window.openEditSlotModal = openEditSlotModal;
    window.deleteSlot = deleteSlot;
}

function switchTimetableView() {
    const viewType = document.getElementById('tt-view-type')?.value;
    const classFilter = document.getElementById('tt-class-filter');
    const teacherFilter = document.getElementById('tt-teacher-filter');

    if (viewType === 'teacher') {
        classFilter.style.display = 'none';
        teacherFilter.style.display = 'inline-flex';
    } else {
        classFilter.style.display = 'inline-flex';
        teacherFilter.style.display = 'none';
    }
    loadTimetable();
}

async function loadTimetable() {
    const viewType = document.getElementById('tt-view-type')?.value || 'class';
    const classId = document.getElementById('tt-class-filter')?.value;
    const teacherId = document.getElementById('tt-teacher-filter')?.value;
    const container = document.getElementById('timetable-container');

    if ((viewType === 'class' && !classId) || (viewType === 'teacher' && !teacherId)) {
        container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Select a class or teacher to view timetable</p></div>';
        return;
    }

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading timetable...</p></div>';

    try {
        let slots = await getAll('timetable_slots');

        if (viewType === 'class' && classId) {
            slots = slots.filter(s => s.class_id == classId);
        } else if (viewType === 'teacher' && teacherId) {
            slots = slots.filter(s => s.teacher_id == teacherId);
        }

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

        const isAdmin = state.currentUser?.role === 'admin';
        let title = '';
        if (viewType === 'class') {
            const cls = getClassById(parseInt(classId));
            title = `<strong>📅 Class Timetable — ${esc(cls?.name || 'Class')}</strong>`;
        } else {
            const teacher = getTeacherById(parseInt(teacherId));
            title = `<strong>👩‍🏫 Teacher Timetable — ${esc(teacher?.name || 'Teacher')}</strong>`;
        }

        let html = `
            <div style="padding:12px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                ${title}
                <span style="margin-left:12px;font-size:12px;">Week of ${new Date().toLocaleDateString()}</span>
            </div>
            <table class="data-table" style="min-width:800px;font-size:12px">
                <thead>
                    <tr style="background:var(--bg-tertiary)">
                        <th style="min-width:100px">Time / Day</th>
                        ${DAYS.map(d => `<th style="min-width:130px">${d}</th>`).join('')}
                    </table>
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
                            (isAdmin ? `<button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 6px" onclick="window.openAddSlotModal('${day}','${ts}')">＋</button>` : '—')}
                    </td>`;
                } else {
                    html += `<td style="padding:4px 6px">`;
                    for (const sl of daySlots) {
                        const subj = getSubjectById(sl.subject_id);
                        const tch = getTeacherById(sl.teacher_id);
                        const cls = getClassById(sl.class_id);
                        html += `
                            <div style="background:var(--role-light,var(--info-bg));border-radius:var(--r-sm);padding:4px 8px;margin:2px 0;border-left:3px solid var(--role-primary,var(--info))">
                                <div style="font-weight:600;font-size:12px">${esc(subj?.name || '?')}</div>
                                ${viewType === 'class' ?
                                `<div style="color:var(--text-muted);font-size:10px">👤 ${esc(tch?.name || '—')}</div>` :
                                `<div style="color:var(--text-muted);font-size:10px">📚 ${esc(cls?.name || '?')}</div>`
                            }
                                ${sl.room ? `<div style="color:var(--text-muted);font-size:10px">📍 Room: ${esc(sl.room)}</div>` : ''}
                                ${isAdmin ? `
                                    <div style="margin-top:4px;display:flex;gap:4px">
                                        <button class="btn btn-sm btn-outline" style="font-size:9px;padding:1px 5px" onclick="window.openEditSlotModal(${sl.id})">✏️</button>
                                        <button class="btn btn-sm btn-danger" style="font-size:9px;padding:1px 5px" onclick="window.deleteSlot(${sl.id})">🗑️</button>
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
        console.error('[Timetable]', e);
        container.innerHTML = `<div class="alert alert-danger" style="margin:16px">⚠️ Could not load timetable: ${esc(e.message)}</div>`;
    }
}

function openAddSlotModal(prefillDay = '', prefillTime = '') {
    const viewType = document.getElementById('tt-view-type')?.value;
    const classId = document.getElementById('tt-class-filter')?.value;
    const teacherId = document.getElementById('tt-teacher-filter')?.value;

    const classes = state.classes.filter(c => c.is_active !== false);
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    let defaultClassId = '';
    let defaultTeacherId = '';

    if (viewType === 'class' && classId) defaultClassId = classId;
    if (viewType === 'teacher' && teacherId) defaultTeacherId = teacherId;

    showModal(`
        <div class="modal-overlay" id="tt-add-modal" onclick="if(event.target===this)closeModal('tt-add-modal')">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>➕ Add Timetable Slot</h3>
                    <button class="modal-close" onclick="closeModal('tt-add-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Day</label><select id="tt-day">${DAYS.map(d => `<option value="${d}" ${d === prefillDay ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Time Slot</label><select id="tt-time">${TIME_SLOTS.map(t => `<option value="${t}" ${t === prefillTime ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Class</label><select id="tt-class"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}" ${c.id == defaultClassId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Subject</label><select id="tt-subject"><option value="">-- Select Subject --</option>${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Teacher</label><select id="tt-teacher"><option value="">-- Select Teacher --</option>${teachers.map(t => `<option value="${t.id}" ${t.id == defaultTeacherId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Room</label><input type="text" id="tt-room" placeholder="e.g., Room 101"></div>
                        <div class="form-group full"><label>Notes</label><textarea id="tt-notes" rows="2" placeholder="Optional notes"></textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('tt-add-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveNewSlot()">Save Slot</button>
                </div>
            </div>
        </div>
    `);

    window.saveNewSlot = saveNewSlot;
}

async function saveNewSlot() {
    const day = document.getElementById('tt-day')?.value;
    const timeSlot = document.getElementById('tt-time')?.value;
    const classId = document.getElementById('tt-class')?.value;
    const subjectId = document.getElementById('tt-subject')?.value;
    const teacherId = document.getElementById('tt-teacher')?.value;
    const room = document.getElementById('tt-room')?.value;
    const notes = document.getElementById('tt-notes')?.value;

    if (!day || !timeSlot || !classId || !subjectId) {
        showToast('Day, time, class, and subject are required', 'warning');
        return;
    }

    // Check for conflicts
    const existing = await getAll('timetable_slots', {
        class_id: classId,
        day: day,
        time_slot: timeSlot
    });

    if (existing.length > 0 && !await confirmDialog('A slot already exists at this time for this class. Replace it?')) return;

    if (existing.length > 0) {
        await update('timetable_slots', existing[0].id, { subject_id: subjectId, teacher_id: teacherId || null, room: room, notes: notes });
        showToast('✅ Slot updated', 'success');
    } else {
        await insert('timetable_slots', {
            class_id: parseInt(classId),
            subject_id: parseInt(subjectId),
            teacher_id: teacherId ? parseInt(teacherId) : null,
            day: day,
            time_slot: timeSlot,
            room: room || null,
            notes: notes || null,
            created_at: new Date().toISOString()
        });
        showToast('✅ Slot added', 'success');
    }

    closeModal('tt-add-modal');
    await loadTimetable();
}

async function openEditSlotModal(slotId) {
    const slots = await getAll('timetable_slots');
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    const classes = state.classes.filter(c => c.is_active !== false);
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    showModal(`
        <div class="modal-overlay" id="tt-edit-modal" onclick="if(event.target===this)closeModal('tt-edit-modal')">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>✏️ Edit Timetable Slot</h3>
                    <button class="modal-close" onclick="closeModal('tt-edit-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Day</label><select id="edit-tt-day">${DAYS.map(d => `<option value="${d}" ${d === slot.day ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Time Slot</label><select id="edit-tt-time">${TIME_SLOTS.map(t => `<option value="${t}" ${t === slot.time_slot ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Class</label><select id="edit-tt-class"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}" ${c.id === slot.class_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Subject</label><select id="edit-tt-subject">${subjects.map(s => `<option value="${s.id}" ${s.id === slot.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Teacher</label><select id="edit-tt-teacher"><option value="">-- Select Teacher --</option>${teachers.map(t => `<option value="${t.id}" ${t.id === slot.teacher_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Room</label><input type="text" id="edit-tt-room" value="${esc(slot.room || '')}"></div>
                        <div class="form-group full"><label>Notes</label><textarea id="edit-tt-notes" rows="2">${esc(slot.notes || '')}</textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('tt-edit-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateSlot(${slotId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);

    window.updateSlot = async (slotId) => {
        const day = document.getElementById('edit-tt-day')?.value;
        const timeSlot = document.getElementById('edit-tt-time')?.value;
        const classId = document.getElementById('edit-tt-class')?.value;
        const subjectId = document.getElementById('edit-tt-subject')?.value;
        const teacherId = document.getElementById('edit-tt-teacher')?.value;
        const room = document.getElementById('edit-tt-room')?.value;
        const notes = document.getElementById('edit-tt-notes')?.value;

        await update('timetable_slots', slotId, {
            day: day,
            time_slot: timeSlot,
            class_id: parseInt(classId),
            subject_id: parseInt(subjectId),
            teacher_id: teacherId ? parseInt(teacherId) : null,
            room: room || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
        });

        closeModal('tt-edit-modal');
        showToast('✅ Slot updated', 'success');
        await loadTimetable();
    };
}

async function deleteSlot(slotId) {
    if (!await confirmDialog('Delete this timetable slot?')) return;
    await remove('timetable_slots', slotId);
    showToast('✅ Slot deleted', 'success');
    await loadTimetable();
}

function exportTimetable() {
    const table = document.getElementById('timetable-container table');
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
    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    XLSX.writeFile(wb, `Timetable_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Timetable exported', 'success');
}

function printTimetable() {
    const container = document.getElementById('timetable-container');
    if (!container) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Timetable - ECOLE LA FONTAINE</title>
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
            <h2>ECOLE LA FONTAINE — Timetable</h2>
            <p style="text-align:center;margin-bottom:16px">Generated on ${new Date().toLocaleDateString()}</p>
            ${container.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}