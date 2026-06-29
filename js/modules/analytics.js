// js/modules/analytics.js
// Analytics Dashboard - Advanced analytics and reporting


let analyticsChart = null;

async function renderAnalytics(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (!user || user.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const terms = state.terms.filter(t => t.academic_year_id === (state.currentAcadYear?.id || 1));

    // Prepare data for term comparison chart
    const classPerformanceByTerm = {};
    for (const term of terms) {
        classPerformanceByTerm[term.name] = [];
        for (const cls of state.classes) {
            const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id === cls.id && a.term_id === term.id);
            let totalPct = 0, cnt = 0;
            for (const st of students) {
                let score = 0, max = 0;
                for (const a of assessments) {
                    const m = state.marks.find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                    if (m) { score += m.score; max += a.max_marks; }
                }
                if (max > 0) { totalPct += (score / max) * 100; cnt++; }
            }
            classPerformanceByTerm[term.name].push({ class_name: cls.name, average: cnt > 0 ? totalPct / cnt : 0 });
        }
    }

    // Prepare subject performance data
    const subjectPerformance = [];
    for (const subject of state.subjects) {
        const termScores = { term1: 0, term2: 0, term3: 0 };
        for (const term of terms) {
            const assessments = state.assessments.filter(a => a.subject_id === subject.id && a.term_id === term.id);
            let totalPercentage = 0, count = 0;
            for (const assessment of assessments) {
                const marks = state.marks.filter(m => m.assessment_id === assessment.id);
                for (const mark of marks) {
                    totalPercentage += (mark.score / assessment.max_marks) * 100;
                    count++;
                }
            }
            const avg = count > 0 ? totalPercentage / count : 0;
            if (term.name === 'Term 1') termScores.term1 = avg;
            else if (term.name === 'Term 2') termScores.term2 = avg;
            else if (term.name === 'Term 3') termScores.term3 = avg;
        }
        subjectPerformance.push({ name: subject.name, ...termScores });
    }

    // Prepare teacher ranking
    const teacherRanking = [];
    for (const teacher of state.teachers) {
        if (teacher.role !== 'teacher') continue;
        const assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        let totalAvg = 0;
        for (const classId of classIds) {
            const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id === classId && a.term_id === state.currentTerm?.id);
            let totalPct = 0, cnt = 0;
            for (const st of students) {
                let score = 0, max = 0;
                for (const a of assessments) {
                    const m = state.marks.find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                    if (m) { score += m.score; max += a.max_marks; }
                }
                if (max > 0) { totalPct += (score / max) * 100; cnt++; }
            }
            totalAvg += cnt > 0 ? totalPct / cnt : 0;
        }
        teacherRanking.push({ name: teacher.name, avg: classIds.length > 0 ? totalAvg / classIds.length : 0, classes: classIds.length });
    }
    teacherRanking.sort((a, b) => b.avg - a.avg);

    container.innerHTML = `
        <div class="analytics-module">
            <div class="dash-card">
                <div class="dash-card-header">
                    <h3><span>📈</span> Advanced Analytics Dashboard</h3>
                    <div class="header-actions">
                        <button class="btn btn-sm btn-outline" onclick="window.exportAnalyticsReport()">📤 Export Report</button>
                        <button class="btn btn-sm btn-outline" onclick="window.printAnalyticsDashboard()">🖨️ Print</button>
                    </div>
                </div>
                <div class="dash-card-body">
                    <div class="dash-card" style="margin-bottom:24px">
                        <div class="dash-card-header"><span class="dash-card-title">📊 Term Performance Comparison</span></div>
                        <div class="dash-card-body"><canvas id="termComparisonChart" style="height:300px"></canvas></div>
                    </div>
                    <div class="dash-card" style="margin-bottom:24px">
                        <div class="dash-card-header"><span class="dash-card-title">📖 Subject Performance by Term</span></div>
                        <div class="dash-card-body">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead><tr><th>Subject</th><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Trend</th></tr></thead>
                                    <tbody>
                                        ${subjectPerformance.slice(0, 15).map(s => `
                                            <tr>
                                                <td><strong>${esc(s.name)}</strong></span>
                                                <td><span class="badge ${getGradeClass(s.term1)}">${s.term1.toFixed(1)}%</span></span>
                                                <td><span class="badge ${getGradeClass(s.term2)}">${s.term2.toFixed(1)}%</span></span>
                                                <td><span class="badge ${getGradeClass(s.term3)}">${s.term3.toFixed(1)}%</span></span>
                                                <td>${s.term3 > s.term2 ? '📈 Improving' : (s.term3 < s.term2 ? '📉 Declining' : '📊 Stable')}</span>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="dash-card">
                        <div class="dash-card-header"><span class="dash-card-title">👩‍🏫 Teacher Performance Ranking</span></div>
                        <div class="dash-card-body">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead><tr><th>Rank</th><th>Teacher</th><th>Class Avg</th><th>Classes</th><th>Trend</th></tr></thead>
                                    <tbody>
                                        ${teacherRanking.slice(0, 15).map((t, idx) => `
                                            <tr>
                                                <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
                                                <td><strong>${esc(t.name)}</strong></span>
                                                <td><span class="badge ${getGradeClass(t.avg)}">${t.avg.toFixed(1)}%</span></span>
                                                <td>${t.classes}</span>
                                                <td><span class="stat-trend ${t.avg > 70 ? 'up' : (t.avg > 50 ? '' : 'down')}">${t.avg > 70 ? '📈 High' : (t.avg > 50 ? '📊 Average' : '📉 Low')}</span></span>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render chart after DOM is ready
    setTimeout(() => {
        const ctx = document.getElementById('termComparisonChart')?.getContext('2d');
        if (ctx) {
            const classNames = state.classes.slice(0, 8).map(c => c.name.substring(0, 3));
            const term1Data = classPerformanceByTerm['Term 1']?.slice(0, 8).map(c => c.average) || [];
            const term2Data = classPerformanceByTerm['Term 2']?.slice(0, 8).map(c => c.average) || [];
            const term3Data = classPerformanceByTerm['Term 3']?.slice(0, 8).map(c => c.average) || [];

            if (analyticsChart) analyticsChart.destroy();
            analyticsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: classNames,
                    datasets: [
                        { label: 'Term 1', data: term1Data, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3 },
                        { label: 'Term 2', data: term2Data, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 },
                        { label: 'Term 3', data: term3Data, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` } } },
                    scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } }
                }
            });
        }
    }, 200);

    window.exportAnalyticsReport = exportAnalyticsReport;
    window.printAnalyticsDashboard = printAnalyticsDashboard;
}

function getGradeClass(pct) {
    if (pct === null || isNaN(pct)) return 'badge-neutral';
    if (pct >= 80) return 'badge-success';
    if (pct >= 60) return 'badge-warning';
    if (pct >= 50) return 'badge-info';
    return 'badge-danger';
}

function exportAnalyticsReport() {
    const data = [];
    for (const cls of state.classes) {
        const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
        const term1Assess = state.assessments.filter(a => a.class_id === cls.id && a.term_id === 1);
        const term2Assess = state.assessments.filter(a => a.class_id === cls.id && a.term_id === 2);
        const term3Assess = state.assessments.filter(a => a.class_id === cls.id && a.term_id === 3);

        let term1Avg = 0, term2Avg = 0, term3Avg = 0;
        for (const st of students) {
            let s1 = 0, m1 = 0, s2 = 0, m2 = 0, s3 = 0, m3 = 0;
            for (const a of term1Assess) {
                const mk = state.marks.find(x => x.assessment_id === a.id && x.student_id === st.id);
                if (mk) { s1 += mk.score; m1 += a.max_marks; }
            }
            for (const a of term2Assess) {
                const mk = state.marks.find(x => x.assessment_id === a.id && x.student_id === st.id);
                if (mk) { s2 += mk.score; m2 += a.max_marks; }
            }
            for (const a of term3Assess) {
                const mk = state.marks.find(x => x.assessment_id === a.id && x.student_id === st.id);
                if (mk) { s3 += mk.score; m3 += a.max_marks; }
            }
            term1Avg += m1 > 0 ? (s1 / m1) * 100 : 0;
            term2Avg += m2 > 0 ? (s2 / m2) * 100 : 0;
            term3Avg += m3 > 0 ? (s3 / m3) * 100 : 0;
        }
        data.push({
            'Class': cls.name,
            'Students': students.length,
            'Term 1 %': students.length > 0 ? (term1Avg / students.length).toFixed(1) : 0,
            'Term 2 %': students.length > 0 ? (term2Avg / students.length).toFixed(1) : 0,
            'Term 3 %': students.length > 0 ? (term3Avg / students.length).toFixed(1) : 0,
            'Annual Average %': students.length > 0 ? ((term1Avg + term2Avg + term3Avg) / (students.length * 3)).toFixed(1) : 0
        });
    }
    exportToExcel(data, `Analytics_Report_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Analytics report exported successfully', 'success');
}

function printAnalyticsDashboard() {
    const content = document.querySelector('.analytics-module');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Analytics Dashboard - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin:10px 0}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px}
                .badge-success{background:#d1fae5;color:#065f46}
                .badge-warning{background:#fef3c7;color:#92400e}
                .badge-danger{background:#fee2e2;color:#991b1b}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Analytics Dashboard</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}