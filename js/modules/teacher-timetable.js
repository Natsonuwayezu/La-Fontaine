// js/modules/teacher-timetable.js
// Teacher Timetable Module - View timetable for specific teacher


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

async function renderTeacherTimetable(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const teacherOpts = teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

    // Default to current user if teacher
    const defaultTeacherId = user.role === 'teacher' ? user.id : '';

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🕐 Teacher Timetable</span>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <select id="tt-teacher-select" class="form-control" style="min-width:200px" onchange="window.loadTeacherTimetable()">
                        <option value="">-- Select Teacher --</option>
                        ${teacherOpts}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="window.exportTeacherTimetable()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printTeacherTimetable()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0;overflow-x:auto">
                <div id="teacher-timetable-container">
                    <div class="loading-container"><div class="spinner"></div><p>${defaultTeacherId ? 'Loading your timetable...' : 'Select a teacher to view timetable'}</p></div>
                </div>
            </div>
        </div>
    `;

    window.loadTeacherTimetable = loadTeacherTimetable;
    window.exportTeacherTimetable = exportTeacherTimetable;
    window.printTeacherTimetable = printTeacherTimetable;

    if (defaultTeacherId) {
        setTimeout(() => {
            const select = document.getElementById('tt-teacher-select');
            if (select) {
                select.value = defaultTeacherId;
                loadTeacherTimetable();
            }
        }, 100);
    }
}

async function loadTeacherTimetable() {
    const teacherId = document.getElementById('tt-teacher-select')?.value;
    const container = document.getElementById('teacher-timetable-container');

    if (!teacherId) {
        container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Select a teacher to view timetable</p></div>';
        return;
    }

    const teacher = getTeacherById(parseInt(teacherId));
    if (!teacher) {
        container.innerHTML = '<div class="alert alert-danger">Teacher not found</div>';
        return;
    }

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading timetable...</p></div>';

    try {
        let slots = await getAll('timetable_slots');
        slots = slots.filter(s => s.teacher_id == teacherId);

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

        const isAdmin = state.currentUser?.role === 'admin';

        let html = `
            <div style="padding:12px 16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                <strong>👩‍🏫 Teacher Timetable — ${esc(teacher.name)}</strong>
                <span style="margin-left:12px;font-size:12px;">Week of ${new Date().toLocaleDateString()}</span>
                ${teacher.department ? `<span style="margin-left:12px;font-size:12px;color:var(--text-muted)">${esc(teacher.department)}</span>` : ''}
            </div>
            <table class="data-table" id="teacher-timetable-table" style="min-width:800px;font-size:12px">
                <thead>
                    <tr style="background:var(--bg-tertiary)">
                        <th style="min-width:100px">Time / Day</th>
                        ${DAYS.map(d => `<th style="min-width:140px">${d}</th>`).join('')}
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
                        ${isBreak ? (ts === '10:20-10:40' ? '🍎' : ts === '12:00-13:00' ? '🍽️' : '☕') : '—'}
                    </td>`;
                } else {
                    html += `<td style="padding:4px 6px;vertical-align:top">`;
                    for (const sl of daySlots) {
                        const cls = getClassById(sl.class_id);
                        const subj = getSubjectById(sl.subject_id);
                        const bgColor = subj ? `hsl(${((subj.id || 0) * 47) % 360}, 60%, 92%)` : 'var(--info-bg)';

                        html += `
                            <div style="background:${bgColor};border-radius:var(--r-sm);padding:8px 10px;margin:4px 0;border-left:3px solid hsl(${((subj?.id || 0) * 47) % 360}, 60%, 55%)">
                                <div style="font-weight:700;font-size:13px">${esc(subj?.name || '?')}</div>
                                <div style="font-size:11px;color:var(--text-secondary)">📚 ${esc(cls?.name || '?')}</div>
                                ${sl.room ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">📍 Room: ${esc(sl.room)}</div>` : ''}
                                ${sl.notes ? `<div style="font-size:10px;color:var(--text-muted);font-style:italic">📝 ${esc(sl.notes)}</div>` : ''}
                            </div>
                        `;
                    }
                    html += `</td>`;
                }
            }
            html += `<tr>`;
        }

        html += `
                </tbody>
            </table>
        `;

        // Add summary
        const totalSlots = slots.length;
        const uniqueClasses = new Set(slots.map(s => s.class_id)).size;
        const uniqueSubjects = new Set(slots.map(s => s.subject_id)).size;

        html += `
            <div style="margin-top:16px;padding:12px 16px;background:var(--bg-tertiary);border-radius:var(--r-lg);display:flex;gap:20px;flex-wrap:wrap;font-size:13px">
                <span>📊 <strong>${totalSlots}</strong> total slots</span>
                <span>🏛️ <strong>${uniqueClasses}</strong> classes</span>
                <span>📖 <strong>${uniqueSubjects}</strong> subjects</span>
                <span>📅 ${DAYS.length} days</span>
            </div>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error('[TeacherTimetable]', e);
        container.innerHTML = `<div class="alert alert-danger" style="margin:16px">⚠️ Could not load timetable: ${esc(e.message)}</div>`;
    }
}

function exportTeacherTimetable() {
    const table = document.getElementById('teacher-timetable-table');
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
    XLSX.utils.book_append_sheet(wb, ws, 'Teacher Timetable');

    const teacherId = document.getElementById('tt-teacher-select')?.value;
    const teacher = getTeacherById(parseInt(teacherId));
    const filename = teacher ? `Timetable_${teacher.name.replace(/\s/g, '_')}` : 'Teacher_Timetable';

    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Timetable exported', 'success');
}

function printTeacherTimetable() {
    const container = document.getElementById('teacher-timetable-container');
    if (!container) return;

    const teacherId = document.getElementById('tt-teacher-select')?.value;
    const teacher = getTeacherById(parseInt(teacherId));
    const teacherName = teacher?.name || 'Teacher';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Teacher Timetable - ${esc(teacherName)}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h2{text-align:center;margin-bottom:16px}
                table{border-collapse:collapse;width:100%;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px 8px}
                th{background:#f0f0f0;font-weight:700}
                .teacher-info{text-align:center;margin-bottom:16px;color:#666}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h2>ECOLE LA FONTAINE — Teacher Timetable</h2>
            <div class="teacher-info">${esc(teacherName)} | Week of ${new Date().toLocaleDateString()}</div>
            ${container.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}