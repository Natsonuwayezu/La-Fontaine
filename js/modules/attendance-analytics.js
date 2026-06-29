// ============================================================
// ATTENDANCE ANALYTICS MODULE - Charts and analytics
// ============================================================


// Render Attendance Analytics page
async function renderAttendanceAnalytics(container) {
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
                <span class="dash-card-title">📈 Attendance Analytics</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="exportAttendanceAnalytics()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="form-grid" style="margin-bottom: 20px;">
                    <div class="form-group">
                        <label>Class</label>
                        <select id="analytics-class" onchange="loadAttendanceAnalytics()">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Period</label>
                        <select id="analytics-period" onchange="loadAttendanceAnalytics()">
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                            <option value="term">Current Term</option>
                            <option value="year">Academic Year</option>
                        </select>
                    </div>
                </div>
                <div id="analytics-charts">
                    <div class="loading-container"><div class="spinner"></div><p>Loading analytics...</p></div>
                </div>
            </div>
        </div>
    `;

    await loadAttendanceAnalytics();
}

// Load attendance analytics
window.loadAttendanceAnalytics = async function () {
    const classId = document.getElementById('analytics-class')?.value;
    const period = document.getElementById('analytics-period')?.value;
    const container = document.getElementById('analytics-charts');

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading analytics...</p></div>';

    let attendance = [];
    try { attendance = await getAll('attendance'); } catch (e) { attendance = []; }

    if (classId) attendance = attendance.filter(a => a.class_id == classId);

    // Filter by period
    const today = new Date();
    let filteredAttendance = attendance;

    if (period === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredAttendance = attendance.filter(a => a.date >= weekAgo.toISOString().split('T')[0]);
    } else if (period === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        filteredAttendance = attendance.filter(a => a.date >= monthAgo.toISOString().split('T')[0]);
    } else if (period === 'term' && state.currentTerm) {
        filteredAttendance = attendance.filter(a => a.date >= state.currentTerm.start_date && a.date <= state.currentTerm.end_date);
    } else if (period === 'year' && state.currentAcadYear) {
        filteredAttendance = attendance.filter(a => a.date >= state.currentAcadYear.start_date && a.date <= state.currentAcadYear.end_date);
    }

    // Group by date
    const dateMap = new Map();
    for (const record of filteredAttendance) {
        if (!dateMap.has(record.date)) {
            dateMap.set(record.date, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
        }
        const stats = dateMap.get(record.date);
        stats.total++;
        if (record.status === 'present') stats.present++;
        else if (record.status === 'absent') stats.absent++;
        else if (record.status === 'late') stats.late++;
        else if (record.status === 'excused') stats.excused++;
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const presentRates = sortedDates.map(d => {
        const stats = dateMap.get(d);
        return stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) : 0;
    });

    container.innerHTML = `
        <div class="two-col">
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📊 Daily Attendance Rate</span></div>
                <div class="dash-card-body"><canvas id="attendance-line-chart" height="250"></canvas></div>
            </div>
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📋 Status Distribution</span></div>
                <div class="dash-card-body"><canvas id="attendance-pie-chart" height="250"></canvas></div>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">📊 Summary Statistics</span></div>
            <div class="dash-card-body" id="attendance-stats"></div>
        </div>
    `;

    // Calculate summary statistics
    let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalExcused = 0, totalRecords = 0;
    for (const record of filteredAttendance) {
        totalRecords++;
        if (record.status === 'present') totalPresent++;
        else if (record.status === 'absent') totalAbsent++;
        else if (record.status === 'late') totalLate++;
        else if (record.status === 'excused') totalExcused++;
    }

    const overallRate = totalRecords > 0 ? ((totalPresent + totalLate) / totalRecords * 100).toFixed(1) : 0;

    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${totalPresent}</div><div class="stat-label">Present</div><div class="stat-trend up">${totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0}%</div></div>
            <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-value">${totalAbsent}</div><div class="stat-label">Absent</div><div class="stat-trend down">${totalRecords > 0 ? ((totalAbsent / totalRecords) * 100).toFixed(1) : 0}%</div></div>
            <div class="stat-card"><div class="stat-icon">⏰</div><div class="stat-value">${totalLate}</div><div class="stat-label">Late</div><div class="stat-trend neutral">${totalRecords > 0 ? ((totalLate / totalRecords) * 100).toFixed(1) : 0}%</div></div>
            <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${totalExcused}</div><div class="stat-label">Excused</div><div class="stat-trend neutral">${totalRecords > 0 ? ((totalExcused / totalRecords) * 100).toFixed(1) : 0}%</div></div>
            <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${overallRate}%</div><div class="stat-label">Overall Attendance Rate</div><div style="background:var(--border-light);border-radius:99px;height:6px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${overallRate}%;background:var(--role-primary);border-radius:99px;"></div></div></div>
            <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${filteredAttendance.length}</div><div class="stat-label">Total Records</div></div>
        </div>
    `;

    document.getElementById('attendance-stats').innerHTML = statsHtml;

    // Create charts
    setTimeout(() => {
        const lineCtx = document.getElementById('attendance-line-chart')?.getContext('2d');
        if (lineCtx) {
            createLineChart('attendance-line-chart', sortedDates.map(d => fmtDate(d).substring(0, 5)), [{
                label: 'Attendance Rate (%)',
                data: presentRates,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.3
            }], { scales: { y: { min: 0, max: 100, title: { display: true, text: 'Rate (%)' } } } });
        }

        const pieCtx = document.getElementById('attendance-pie-chart')?.getContext('2d');
        if (pieCtx) {
            const pieChart = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Present', 'Absent', 'Late', 'Excused'],
                    datasets: [{
                        data: [totalPresent, totalAbsent, totalLate, totalExcused],
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }, 100);
};

// Export attendance analytics
window.exportAttendanceAnalytics = async function () {
    const classId = document.getElementById('analytics-class')?.value;
    const period = document.getElementById('analytics-period')?.value;

    let attendance = [];
    try { attendance = await getAll('attendance'); } catch (e) { attendance = []; }

    if (classId) attendance = attendance.filter(a => a.class_id == classId);

    const today = new Date();
    if (period === 'week') {
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        attendance = attendance.filter(a => a.date >= weekAgo.toISOString().split('T')[0]);
    } else if (period === 'month') {
        const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);
        attendance = attendance.filter(a => a.date >= monthAgo.toISOString().split('T')[0]);
    } else if (period === 'term' && state.currentTerm) {
        attendance = attendance.filter(a => a.date >= state.currentTerm.start_date && a.date <= state.currentTerm.end_date);
    }

    const exportData = attendance.map(a => {
        const student = getStudentById(a.student_id);
        const cls = getClassById(a.class_id);
        const statusMap = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
        return {
            'Date': a.date,
            'Student': student ? `${student.first_name} ${student.last_name}` : '—',
            'Class': cls?.name || '—',
            'Status': statusMap[a.status] || a.status,
            'Notes': a.notes || ''
        };
    });

    exportToExcel(exportData, `Attendance_Analytics_${period}`);
    showToast('✅ Analytics exported', 'success');
};

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
}