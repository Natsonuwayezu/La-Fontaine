// ============================================================
// ATTENDANCE REPORTS - Full reports with absent names/reasons
// ============================================================


async function renderAttendanceReports(container) {
    const user = getCurrentUser();
    const role = user?.role;
    let classes = (state.classes || []).filter(c => c.is_active !== false)
        .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    if (isTeacher()) {
        const assignments = await getAll('teacher_assignments', { teacher_id: user?.id });
        const ids = new Set(assignments.map(a => a.class_id));
        classes = classes.filter(c => ids.has(c.id));
    }

    const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Attendance Reports</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.printAttendanceReport()">🖨️ Print</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportAttReport()">📥 Excel</button>
                    <button class="btn btn-sm btn-primary" onclick="window.downloadAttReportPDF()">📑 PDF</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="form-grid" style="margin-bottom:16px">
                    <div class="form-group">
                        <label>Report Type</label>
                        <select id="att-rtype" onchange="window.toggleAttReportFields()">
                            <option value="daily">Daily Absent List</option>
                            <option value="class">Class Summary</option>
                            <option value="term">Term Summary</option>
                            <option value="student">Individual Student</option>
                        </select>
                    </div>
                    <div class="form-group" id="fg-class">
                        <label>Class</label>
                        <select id="att-rclass">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="fg-date">
                        <label>Date</label>
                        <input type="date" id="att-rdate" value="${today}">
                    </div>
                    <div class="form-group" id="fg-dates" style="display:none">
                        <label>From</label>
                        <input type="date" id="att-rfrom" value="${monthStart}">
                    </div>
                    <div class="form-group" id="fg-datee" style="display:none">
                        <label>To</label>
                        <input type="date" id="att-rto" value="${today}">
                    </div>
                    <div class="form-group" id="fg-term" style="display:none">
                        <label>Term</label>
                        <select id="att-rterm">
                            ${terms.map(t => `<option value="${t.id}" ${state.currentTerm?.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="fg-student" style="display:none">
                        <label>Student</label>
                        <select id="att-rstudent">
                            <option value="">— Select student —</option>
                            ${(state.students || []).filter(s => s.status === 'Active')
                                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                                .map(s => `<option value="${s.id}">${esc(s.last_name)}, ${esc(s.first_name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="align-self:flex-end">
                        <button class="btn btn-primary" onclick="window.generateAttReport()">📊 Generate</button>
                    </div>
                </div>
                <div id="att-report-output"></div>
            </div>
        </div>
    `;

    window.toggleAttReportFields = toggleAttReportFields;
    window.generateAttReport = generateAttReport;
    window.printAttendanceReport = printAttendanceReport;
    window.exportAttReport = exportAttReport;
    window.downloadAttReportPDF = downloadAttReportPDF;
    toggleAttReportFields();
}

function toggleAttReportFields() {
    const type = document.getElementById('att-rtype')?.value;
    const show = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis ? 'block' : 'none'; };
    show('fg-class',   ['class','term','student'].includes(type) || type === 'daily');
    show('fg-date',    type === 'daily');
    show('fg-dates',   type === 'class');
    show('fg-datee',   type === 'class');
    show('fg-term',    type === 'term');
    show('fg-student', type === 'student');
}

async function generateAttReport() {
    const type    = document.getElementById('att-rtype')?.value;
    const classId = document.getElementById('att-rclass')?.value;
    const date    = document.getElementById('att-rdate')?.value;
    const from    = document.getElementById('att-rfrom')?.value;
    const to      = document.getElementById('att-rto')?.value;
    const termId  = document.getElementById('att-rterm')?.value;
    const stuId   = document.getElementById('att-rstudent')?.value;
    const out     = document.getElementById('att-report-output');

    out.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';

    let all = [];
    try { all = await getAll('attendance'); } catch (e) { all = []; }

    if (type === 'daily') {
        await renderDailyAbsentReport(out, all, date, classId);
    } else if (type === 'class') {
        renderClassSummaryReport(out, all, classId, from, to);
    } else if (type === 'term') {
        const term = (state.terms || []).find(t => t.id == termId);
        renderTermReport(out, all, classId, term);
    } else if (type === 'student') {
        renderStudentReport(out, all, stuId);
    }
}

async function renderDailyAbsentReport(out, all, date, classId) {
    let records = all.filter(a => a.date === date && a.status !== 'present');
    if (classId) records = records.filter(a => a.class_id == classId);
    records.sort((a, b) => {
        const sa = getStudentById(a.student_id), sb = getStudentById(b.student_id);
        return (sa?.last_name || '').localeCompare(sb?.last_name || '');
    });

    const clsName = classId ? (getClassById(parseInt(classId))?.name || 'All') : 'All Classes';
    const statusIcon = { absent: '❌ Absent', late: '⏰ Late', excused: '📝 Excused' };

    if (records.length === 0) {
        out.innerHTML = `<div class="alert alert-success">🎉 All students present on ${fmtDate(date)} in ${clsName}!</div>`;
        return;
    }

    out.innerHTML = `
        <h4 style="margin-bottom:12px">❌ Non-present Students — ${fmtDate(date)} — ${esc(clsName)}</h4>
        <div class="table-wrapper" id="att-report-table">
            <table class="data-table">
                <thead><tr><th>#</th><th>Student</th><th>Class</th><th>Status</th><th>Reason</th><th>Notes</th></tr></thead>
                <tbody>
                    ${records.map((r, i) => {
                        const s = getStudentById(r.student_id);
                        const cls = getClassById(r.class_id);
                        return `<tr>
                            <td>${i + 1}</td>
                            <td><strong>${s ? esc(s.last_name + ', ' + s.first_name) : '—'}</strong></td>
                            <td>${esc(cls?.name || '—')}</td>
                            <td>${statusIcon[r.status] || r.status}</td>
                            <td>${esc(r.reason || '—')}</td>
                            <td>${esc(r.notes || '—')}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <p style="margin-top:8px;color:var(--text-muted);font-size:13px">Total non-present: ${records.length}</p>
    `;
    // store for export
    window._attReportData = records.map((r, i) => {
        const s = getStudentById(r.student_id);
        const cls = getClassById(r.class_id);
        return { '#': i+1, 'Student': s ? `${s.last_name}, ${s.first_name}` : '—', 'Class': cls?.name || '—', 'Status': r.status, 'Reason': r.reason || '', 'Notes': r.notes || '' };
    });
    window._attReportTitle = `Absent_Report_${date}`;
}

function renderClassSummaryReport(out, all, classId, from, to) {
    let records = all.filter(a => a.date >= from && a.date <= to);
    if (classId) records = records.filter(a => a.class_id == classId);

    const stuMap = new Map();
    for (const r of records) {
        if (!stuMap.has(r.student_id)) stuMap.set(r.student_id, { present: 0, absent: 0, late: 0, excused: 0 });
        const m = stuMap.get(r.student_id);
        m[r.status] = (m[r.status] || 0) + 1;
    }

    const rows = [...stuMap.entries()].map(([sid, m]) => {
        const s = getStudentById(sid);
        const total = m.present + m.absent + m.late + m.excused;
        const rate = total > 0 ? (((m.present + m.late) / total) * 100).toFixed(1) : '0.0';
        return { sid, name: s ? `${s.last_name}, ${s.first_name}` : sid, cls: getClassById(s?.class_id)?.name || '—', ...m, total, rate };
    }).sort((a, b) => a.name.localeCompare(b.name));

    out.innerHTML = `
        <h4 style="margin-bottom:12px">📋 Attendance Summary — ${fmtDate(from)} to ${fmtDate(to)}</h4>
        <div class="table-wrapper" id="att-report-table">
            <table class="data-table">
                <thead><tr><th>Student</th><th>Class</th><th>✅ Present</th><th>❌ Absent</th><th>⏰ Late</th><th>📝 Excused</th><th>Total</th><th>Rate</th></tr></thead>
                <tbody>
                    ${rows.map(r => `<tr>
                        <td><strong>${esc(r.name)}</strong></td>
                        <td>${esc(r.cls)}</td>
                        <td>${r.present}</td>
                        <td style="color:${r.absent > 3 ? 'var(--danger)' : 'inherit'}">${r.absent}</td>
                        <td>${r.late}</td>
                        <td>${r.excused}</td>
                        <td>${r.total}</td>
                        <td><span class="badge ${parseFloat(r.rate) >= 90 ? 'badge-success' : parseFloat(r.rate) >= 75 ? 'badge-warning' : 'badge-danger'}">${r.rate}%</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
    window._attReportData = rows.map(r => ({ 'Student': r.name, 'Class': r.cls, 'Present': r.present, 'Absent': r.absent, 'Late': r.late, 'Excused': r.excused, 'Total': r.total, 'Rate': r.rate + '%' }));
    window._attReportTitle = `Attendance_Summary_${from}_to_${to}`;
}

function renderTermReport(out, all, classId, term) {
    if (!term) { out.innerHTML = '<div class="alert alert-warning">Term not found.</div>'; return; }
    renderClassSummaryReport(out, all, classId, term.start_date, term.end_date);
    window._attReportTitle = `Term_${term.name}_Attendance`;
}

function renderStudentReport(out, all, stuId) {
    if (!stuId) { out.innerHTML = '<div class="alert alert-warning">Select a student.</div>'; return; }
    const records = all.filter(a => a.student_id == stuId).sort((a, b) => a.date.localeCompare(b.date));
    const s = getStudentById(parseInt(stuId));
    const present = records.filter(r => r.status === 'present').length;
    const absent  = records.filter(r => r.status === 'absent').length;
    const late    = records.filter(r => r.status === 'late').length;
    const excused = records.filter(r => r.status === 'excused').length;
    const rate = records.length > 0 ? (((present + late) / records.length) * 100).toFixed(1) : 0;

    out.innerHTML = `
        <h4 style="margin-bottom:12px">👤 ${esc(s ? s.first_name + ' ' + s.last_name : 'Student')} — Attendance History</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;margin-bottom:16px">
            ${[['✅ Present', present,'success'],['❌ Absent',absent,'danger'],['⏰ Late',late,'warning'],['📝 Excused',excused,'info'],['📅 Total',records.length,''],['📊 Rate',rate+'%','']].map(([l,v,c]) =>
                `<div style="background:var(--bg-secondary);border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:var(--text-muted)">${l}</div><div style="font-size:20px;font-weight:700;color:${c ? 'var(--'+c+')' : 'inherit'}">${v}</div></div>`
            ).join('')}
        </div>
        <div class="table-wrapper" id="att-report-table">
            <table class="data-table">
                <thead><tr><th>Date</th><th>Status</th><th>Reason</th><th>Notes</th></tr></thead>
                <tbody>
                    ${records.map(r => `<tr>
                        <td>${fmtDate(r.date)}</td>
                        <td>${{ present:'✅ Present', absent:'❌ Absent', late:'⏰ Late', excused:'📝 Excused' }[r.status] || r.status}</td>
                        <td>${esc(r.reason || '—')}</td>
                        <td>${esc(r.notes || '—')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
    window._attReportData = records.map(r => ({ 'Date': r.date, 'Status': r.status, 'Reason': r.reason || '', 'Notes': r.notes || '' }));
    window._attReportTitle = `Student_Attendance_${s?.last_name || stuId}`;
}

function printAttendanceReport() {
    const el = document.getElementById('att-report-table');
    if (!el) { showToast('Generate a report first', 'warning'); return; }
    const school = state.schoolSettings?.school_name || 'ECOLE LA FONTAINE';
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Attendance Report</title>
        <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:7px;font-size:12px}th{background:#1a3a5c;color:#fff}
        h3{color:#1a3a5c}</style></head><body>
        <h3>${school} — Attendance Report</h3>
        <p>Generated: ${new Date().toLocaleString()}</p>
        ${el.outerHTML}
        <script>window.print();<\/script></body></html>`);
    w.document.close();
}

function exportAttReport() {
    const data = window._attReportData;
    if (!data?.length) { showToast('Generate a report first', 'warning'); return; }
    exportToExcel(data, window._attReportTitle || 'Attendance_Report');
    showToast('✅ Exported', 'success');
}

function downloadAttReportPDF() {
    const el = document.getElementById('att-report-table');
    if (!el) { showToast('Generate a report first', 'warning'); return; }
    if (typeof html2pdf === 'undefined') { showToast('PDF library not loaded', 'error'); return; }
    html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: (window._attReportTitle || 'Attendance_Report') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).save();
}
