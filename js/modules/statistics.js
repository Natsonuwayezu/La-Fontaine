// js/modules/statistics.js
// Statistics Module - Academic performance analytics and reports


let statsChart = null;
let gradeChart = null;
let subjectChart = null;

async function renderStatistics(container) {
    await ensureStateLoaded();

    const user = state.currentUser;

    // Get available classes for teacher role
    let availableClasses = state.classes.filter(c => c.is_active !== false);
    if (user.role === 'teacher') {
        const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        availableClasses = availableClasses.filter(c => classIds.includes(c.id));
    }

    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header" style="flex-wrap:wrap;gap:8px">
                <span class="dash-card-title">📈 STATISTICS</span>
                <div class="btn-group" style="flex-wrap:wrap;gap:6px">
                    <select id="stats-view-type" class="form-control" style="width:160px" onchange="window.loadStatisticsData()">
                        <option value="by-class">By Class</option>
                        <option value="annual">Annual Comparison</option>
                        <option value="grade-distribution">Grade Distribution</option>
                        <option value="subject-analysis">Subject Analysis</option>
                    </select>
                    <select id="stats-class-filter" class="form-control" style="width:160px" onchange="window.loadStatisticsData()">
                        <option value="">All Classes</option>
                        ${availableClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="stats-term-filter" class="form-control" style="width:160px" onchange="window.loadStatisticsData()">
                        <option value="">All Terms</option>
                        ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="window.exportStatisticsData()">📤 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printStatisticsReport()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div id="stats-content">
                    <div class="loading-container"><div class="spinner"></div><p>Loading statistics...</p></div>
                </div>
            </div>
        </div>
    `;

    window.loadStatisticsData = loadStatisticsData;
    window.exportStatisticsData = exportStatisticsData;
    window.printStatisticsReport = printStatisticsReport;

    await loadStatisticsData();
}

async function loadStatisticsData() {
    const contentDiv = document.getElementById('stats-content');
    if (!contentDiv) return;

    const viewType = document.getElementById('stats-view-type')?.value || 'by-class';
    const classFilter = document.getElementById('stats-class-filter')?.value;
    const termFilter = document.getElementById('stats-term-filter')?.value;

    contentDiv.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading statistics...</p></div>`;

    try {
        let classes = state.classes.filter(c => c.is_active !== false);
        if (classFilter) classes = classes.filter(c => c.id == classFilter);

        let terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
        if (termFilter) terms = terms.filter(t => t.id == termFilter);

        const performanceData = [];
        const termAverages = {};

        for (const term of terms) {
            termAverages[term.name] = [];
            for (const cls of classes) {
                const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
                const assessments = state.assessments.filter(a => a.class_id === cls.id && a.term_id === term.id);

                let totalPercentage = 0;
                let studentCount = 0;
                let highestScore = 0;
                let lowestScore = 100;
                let passCount = 0;
                let topStudent = '';

                for (const student of students) {
                    let totalScore = 0;
                    let totalMax = 0;

                    for (const assessment of assessments) {
                        const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                        if (mark) {
                            totalScore += mark.score;
                            totalMax += assessment.max_marks;
                        }
                    }

                    if (totalMax > 0) {
                        const percentage = (totalScore / totalMax) * 100;
                        totalPercentage += percentage;
                        studentCount++;

                        if (percentage > highestScore) {
                            highestScore = percentage;
                            topStudent = `${student.first_name} ${student.last_name}`;
                        }
                        if (percentage < lowestScore) lowestScore = percentage;
                        if (percentage >= 50) passCount++;
                    }
                }

                const avgPercentage = studentCount > 0 ? totalPercentage / studentCount : 0;
                termAverages[term.name].push({ className: cls.name, average: avgPercentage });

                performanceData.push({
                    className: cls.name,
                    termName: term.name,
                    students: students.length,
                    average: avgPercentage,
                    highest: highestScore,
                    lowest: lowestScore,
                    passRate: studentCount > 0 ? (passCount / studentCount) * 100 : 0,
                    topStudent: topStudent,
                    grade: getGrade(avgPercentage)
                });
            }
        }

        const allStudents = state.students.filter(s => s.status === 'Active');
        let gradeDistribution = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

        for (const student of allStudents) {
            let totalScore = 0, totalMax = 0;
            const assessments = state.assessments.filter(a => a.class_id === student.class_id);

            for (const assessment of assessments) {
                const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                if (mark) {
                    totalScore += mark.score;
                    totalMax += assessment.max_marks;
                }
            }

            const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            const grade = getGrade(percentage);
            if (gradeDistribution.hasOwnProperty(grade)) gradeDistribution[grade]++;
        }

        const subjectPerformance = [];
        for (const subject of state.subjects) {
            const subjectData = { name: subject.name, averages: {} };
            for (const term of terms) {
                const assessments = state.assessments.filter(a => a.subject_id === subject.id && a.term_id === term.id);
                let totalPercentage = 0;
                let markCount = 0;

                for (const assessment of assessments) {
                    const marks = state.marks.filter(m => m.assessment_id === assessment.id);
                    for (const mark of marks) {
                        totalPercentage += (mark.score / assessment.max_marks) * 100;
                        markCount++;
                    }
                }
                subjectData.averages[term.name] = markCount > 0 ? totalPercentage / markCount : 0;
            }
            subjectPerformance.push(subjectData);
        }

        if (viewType === 'by-class') {
            renderByClassView(contentDiv, performanceData, classes, termAverages);
        } else if (viewType === 'annual') {
            renderAnnualView(contentDiv, classes, terms, performanceData);
        } else if (viewType === 'grade-distribution') {
            renderGradeDistributionView(contentDiv, gradeDistribution, allStudents);
        } else if (viewType === 'subject-analysis') {
            renderSubjectAnalysisView(contentDiv, subjectPerformance, terms);
        }

    } catch (error) {
        console.error('Statistics error:', error);
        contentDiv.innerHTML = `<div class="alert alert-danger">Error loading statistics: ${error.message}</div>`;
    }
}

function renderByClassView(container, performanceData, classes, termAverages) {
    const classNames = classes.map(c => c.name.substring(0, 3));
    const term1Data = termAverages['Term 1']?.slice(0, 8).map(d => d.average) || [];
    const term2Data = termAverages['Term 2']?.slice(0, 8).map(d => d.average) || [];
    const term3Data = termAverages['Term 3']?.slice(0, 8).map(d => d.average) || [];

    const classTableData = {};
    for (const data of performanceData) {
        if (!classTableData[data.className]) {
            classTableData[data.className] = { Term1: '—', Term2: '—', Term3: '—', Students: data.students };
        }
        if (data.termName === 'Term 1') classTableData[data.className].Term1 = data.average.toFixed(1) + '%';
        if (data.termName === 'Term 2') classTableData[data.className].Term2 = data.average.toFixed(1) + '%';
        if (data.termName === 'Term 3') classTableData[data.className].Term3 = data.average.toFixed(1) + '%';
    }

    container.innerHTML = `
        <div class="two-col">
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📊 PERFORMANCE OVERVIEW</span></div>
                <div class="dash-card-body"><canvas id="performance-chart" height="250"></canvas></div>
            </div>
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📋 CLASS PERFORMANCE TABLE</span></div>
                <div class="dash-card-body" style="padding:0">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead><tr><th>Class</th><th>Students</th><th>Term 1</th><th>Term 2</th><th>Term 3</th></tr></thead>
                            <tbody>
                                ${Object.entries(classTableData).map(([className, data]) => `
                                    <tr>
                                        <td><strong>${esc(className)}</strong></td>
                                        <td style="text-align:center">${data.Students}</span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(parseFloat(data.Term1))}">${data.Term1}</span></span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(parseFloat(data.Term2))}">${data.Term2}</span></span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(parseFloat(data.Term3))}">${data.Term3}</span></span>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header"><span class="dash-card-title">📋 DETAILED PERFORMANCE</span></div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr><th>Class</th><th>Term</th><th>Students</th><th>Avg %</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Top Performer</th><th>Grade</th></tr>
                        </thead>
                        <tbody>
                            ${performanceData.map(data => `
                                <tr>
                                    <td><strong>${esc(data.className)}</strong></td>
                                    <td>${data.termName}</span>
                                    <td style="text-align:center">${data.students}</span>
                                    <td style="text-align:center"><span class="badge ${getGradeClass(data.average)}">${data.average.toFixed(1)}%</span></span>
                                    <td style="text-align:center">${data.highest.toFixed(1)}%</span>
                                    <td style="text-align:center">${data.lowest.toFixed(1)}%</span>
                                    <td style="text-align:center">${data.passRate.toFixed(1)}%</span>
                                    <td>${esc(data.topStudent || '—')}</span>
                                    <td style="text-align:center">${data.grade}</span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('performance-chart')?.getContext('2d');
        if (ctx) {
            if (statsChart) statsChart.destroy();
            statsChart = new Chart(ctx, {
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
    }, 100);
}

function renderAnnualView(container, classes, terms, performanceData) {
    const annualData = {};
    for (const cls of classes) {
        const classData = performanceData.filter(d => d.className === cls.name);
        const termAverages = classData.map(d => d.average);
        const validAverages = termAverages.filter(a => a > 0);
        const annualAvg = validAverages.length > 0 ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length : 0;
        annualData[cls.name] = {
            Term1: classData.find(d => d.termName === 'Term 1')?.average || 0,
            Term2: classData.find(d => d.termName === 'Term 2')?.average || 0,
            Term3: classData.find(d => d.termName === 'Term 3')?.average || 0,
            Annual: annualAvg,
            Grade: getGrade(annualAvg)
        };
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">📊 ANNUAL PERFORMANCE COMPARISON</span></div>
            <div class="dash-card-body"><canvas id="annual-chart" height="300"></canvas></div>
        </div>
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header"><span class="dash-card-title">📋 ANNUAL SUMMARY BY CLASS</span></div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Class</th><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Annual Avg</th><th>Grade</th></tr></thead>
                        <tbody>
                            ${Object.entries(annualData).map(([className, data]) => `
                                <tr>
                                    <td><strong>${esc(className)}</strong></td>
                                    <td style="text-align:center">${data.Term1 > 0 ? data.Term1.toFixed(1) + '%' : '—'}</span>
                                    <td style="text-align:center">${data.Term2 > 0 ? data.Term2.toFixed(1) + '%' : '—'}</span>
                                    <td style="text-align:center">${data.Term3 > 0 ? data.Term3.toFixed(1) + '%' : '—'}</span>
                                    <td style="text-align:center"><strong>${data.Annual.toFixed(1)}%</strong></span>
                                    <td style="text-align:center"><span class="badge ${getGradeClass(data.Annual)}">${data.Grade}</span></span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('annual-chart')?.getContext('2d');
        if (ctx) {
            const classNames = Object.keys(annualData);
            const term1Data = classNames.map(c => annualData[c].Term1);
            const term2Data = classNames.map(c => annualData[c].Term2);
            const term3Data = classNames.map(c => annualData[c].Term3);

            if (window.annualChart) window.annualChart.destroy();
            window.annualChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: classNames,
                    datasets: [
                        { label: 'Term 1', data: term1Data, backgroundColor: '#3b82f6', borderRadius: 4 },
                        { label: 'Term 2', data: term2Data, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Term 3', data: term3Data, backgroundColor: '#f59e0b', borderRadius: 4 }
                    ]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } } }
            });
        }
    }, 100);
}

function renderGradeDistributionView(container, gradeDistribution, allStudents) {
    const total = allStudents.length;
    const gradePercentages = {};
    for (const [grade, count] of Object.entries(gradeDistribution)) {
        gradePercentages[grade] = total > 0 ? (count / total) * 100 : 0;
    }

    container.innerHTML = `
        <div class="two-col">
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">🥧 GRADE DISTRIBUTION</span></div>
                <div class="dash-card-body"><canvas id="grade-pie-chart" height="250"></canvas></div>
            </div>
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📊 GRADE BREAKDOWN</span></div>
                <div class="dash-card-body">
                    ${Object.entries(gradePercentages).map(([grade, pct]) => `
                        <div style="margin-bottom:12px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                                <span><strong>${grade}</strong></span>
                                <span>${gradeDistribution[grade]} students (${pct.toFixed(1)}%)</span>
                            </div>
                            <div style="background:var(--border-light);border-radius:99px;height:8px;overflow:hidden">
                                <div style="width:${pct}%;height:100%;background:${getGradeColor(grade)};border-radius:99px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('grade-pie-chart')?.getContext('2d');
        if (ctx) {
            const labels = Object.keys(gradeDistribution).filter(g => gradeDistribution[g] > 0);
            const data = labels.map(g => gradeDistribution[g]);
            const colors = labels.map(g => getGradeColor(g));

            if (gradeChart) gradeChart.destroy();
            gradeChart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }, 100);
}

function renderSubjectAnalysisView(container, subjectPerformance, terms) {
    const topSubjects = subjectPerformance.slice(0, 10);
    const termNames = terms.map(t => t.name);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">📊 SUBJECT PERFORMANCE BY TERM</span></div>
            <div class="dash-card-body"><canvas id="subject-chart" height="300"></canvas></div>
        </div>
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header"><span class="dash-card-title">📋 SUBJECT PERFORMANCE TABLE</span></div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Subject</th>${termNames.map(t => `<th>${t}</th>`).join('')}<th>Trend</th></tr></thead>
                        <tbody>
                            ${topSubjects.map(sub => {
        const values = termNames.map(t => sub.averages[t] || 0);
        const trend = values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0;
        const trendIcon = trend > 2 ? '📈 Improving' : (trend < -2 ? '📉 Declining' : '📊 Stable');
        const trendColor = trend > 2 ? 'var(--success)' : (trend < -2 ? 'var(--danger)' : 'var(--text-muted)');
        return `
                                    <tr>
                                        <td><strong>${esc(sub.name)}</strong></td>
                                        ${values.map(v => `<td style="text-align:center"><span class="badge ${getGradeClass(v)}">${v.toFixed(1)}%</span></span>`).join('')}
                                        <td style="text-align:center;color:${trendColor}">${trendIcon}</span>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('subject-chart')?.getContext('2d');
        if (ctx) {
            const labels = topSubjects.map(s => s.name.length > 15 ? s.name.substring(0, 12) + '...' : s.name);
            const datasets = termNames.map((term, idx) => ({
                label: term,
                data: topSubjects.map(s => s.averages[term] || 0),
                borderColor: idx === 0 ? '#3b82f6' : (idx === 1 ? '#10b981' : '#f59e0b'),
                backgroundColor: 'transparent',
                tension: 0.3
            }));

            if (subjectChart) subjectChart.destroy();
            subjectChart = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } } }
            });
        }
    }, 100);
}

function getGradeColor(grade) {
    const colors = {
        'A+': '#d1fae5', 'A': '#d1fae5', 'B': '#fef3c7',
        'C': '#ffedd5', 'D': '#fee2e2', 'F': '#fce7f3'
    };
    return colors[grade] || '#e2e8f0';
}

function getGradeClass(pct) {
    if (pct === null || isNaN(pct)) return 'badge-neutral';
    if (pct >= 80) return 'badge-success';
    if (pct >= 60) return 'badge-warning';
    if (pct >= 50) return 'badge-info';
    return 'badge-danger';
}

function getGrade(pct, scale = state.gradingScale) {
    if (pct === null || pct === undefined || isNaN(pct)) return '—';
    for (const g of scale) {
        const minVal = g.min_percentage !== undefined ? g.min_percentage : g.min;
        const maxVal = g.max_percentage !== undefined ? g.max_percentage : g.max;
        if (pct >= minVal && pct <= maxVal) return g.grade;
    }
    return 'F';
}

function exportStatisticsData() {
    const viewType = document.getElementById('stats-view-type')?.value || 'by-class';
    let exportData = [];

    if (viewType === 'by-class') {
        for (const cls of state.classes) {
            const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
            for (const term of state.terms) {
                const assessments = state.assessments.filter(a => a.class_id === cls.id && a.term_id === term.id);
                let totalPct = 0, count = 0;
                for (const student of students) {
                    let score = 0, max = 0;
                    for (const assessment of assessments) {
                        const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                        if (mark) { score += mark.score; max += assessment.max_marks; }
                    }
                    if (max > 0) { totalPct += (score / max) * 100; count++; }
                }
                exportData.push({
                    'Class': cls.name,
                    'Term': term.name,
                    'Students': students.length,
                    'Average %': count > 0 ? (totalPct / count).toFixed(1) : 0,
                    'Grade': getGrade(count > 0 ? totalPct / count : 0)
                });
            }
        }
    } else if (viewType === 'annual') {
        for (const cls of state.classes) {
            const termAverages = {};
            for (const term of state.terms) {
                const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
                const assessments = state.assessments.filter(a => a.class_id === cls.id && a.term_id === term.id);
                let totalPct = 0, count = 0;
                for (const student of students) {
                    let score = 0, max = 0;
                    for (const assessment of assessments) {
                        const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                        if (mark) { score += mark.score; max += assessment.max_marks; }
                    }
                    if (max > 0) { totalPct += (score / max) * 100; count++; }
                }
                termAverages[term.name] = count > 0 ? totalPct / count : 0;
            }
            const annualAvg = (termAverages['Term 1'] + termAverages['Term 2'] + termAverages['Term 3']) / 3;
            exportData.push({
                'Class': cls.name,
                'Term 1 %': termAverages['Term 1'].toFixed(1),
                'Term 2 %': termAverages['Term 2'].toFixed(1),
                'Term 3 %': termAverages['Term 3'].toFixed(1),
                'Annual %': annualAvg.toFixed(1),
                'Grade': getGrade(annualAvg)
            });
        }
    } else if (viewType === 'grade-distribution') {
        const gradeCount = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        for (const student of state.students) {
            let totalScore = 0, totalMax = 0;
            const assessments = state.assessments.filter(a => a.class_id === student.class_id);
            for (const assessment of assessments) {
                const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                if (mark) { totalScore += mark.score; totalMax += assessment.max_marks; }
            }
            const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            const grade = getGrade(pct);
            if (gradeCount.hasOwnProperty(grade)) gradeCount[grade]++;
        }
        for (const [grade, count] of Object.entries(gradeCount)) {
            exportData.push({ 'Grade': grade, 'Students': count, 'Percentage': ((count / state.students.length) * 100).toFixed(1) + '%' });
        }
    }

    exportToExcel(exportData, `Statistics_Report_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Statistics exported', 'success');
}

function printStatisticsReport() {
    const content = document.getElementById('stats-content');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Statistics Report - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin:10px 0}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Statistics Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}