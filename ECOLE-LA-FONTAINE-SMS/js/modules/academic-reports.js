// js/modules/academic-reports.js
// Source lines: 30614–31363 of original monolith
// ============================================================

        // Term summary, subject analysis, progress, class comparison, trends
        // ════════════════════════════════════════════════════════════════════════

        async function generateTermSummary() {
            const classId = document.getElementById('term-class')?.value;
            const termId = document.getElementById('term-select')?.value;
            const resultsDiv = document.getElementById('term-summary-results');

            if (!classId) {
                showToast('Please select a class', 'warning');
                return;
            }

            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Generating term summary...</p></div>';

            const cls = getClassById(classId);
            const term = getTermById(termId);
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id == classId && a.term_id == termId);
            const subjects = state.subjects.filter(s => s.level === cls?.level && s.is_active !== false);

            // Calculate subject-wise averages
            const subjectAverages = [];
            for (const subject of subjects) {
                const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
                let totalPct = 0, count = 0;

                for (const student of students) {
                    let score = 0, max = 0;
                    const studentMarks = state.marks.filter(m => m.student_id === student.id);
                    for (const assessment of subjectAssessments) {
                        const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                        if (mark) {
                            score += mark.score;
                            max += assessment.max_marks;
                        }
                    }
                    if (max > 0) {
                        totalPct += (score / max) * 100;
                        count++;
                    }
                }

                subjectAverages.push({
                    name: subject.name,
                    average: count > 0 ? totalPct / count : 0,
                    grade: getGrade(count > 0 ? totalPct / count : 0)
                });
            }

            // Calculate overall statistics
            let classTotalPct = 0, classCount = 0;
            for (const student of students) {
                let score = 0, max = 0;
                const studentMarks = state.marks.filter(m => m.student_id === student.id);
                for (const assessment of assessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        score += mark.score;
                        max += assessment.max_marks;
                    }
                }
                if (max > 0) {
                    classTotalPct += (score / max) * 100;
                    classCount++;
                }
            }

            const classAverage = classCount > 0 ? classTotalPct / classCount : 0;
            const passCount = students.filter(s => {
                let score = 0, max = 0;
                const studentMarks = state.marks.filter(m => m.student_id === s.id);
                for (const assessment of assessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        score += mark.score;
                        max += assessment.max_marks;
                    }
                }
                const pct = max > 0 ? (score / max) * 100 : 0;
                return pct >= 50;
            }).length;
            const passRate = (passCount / (students.length || 1)) * 100;

            subjectAverages.sort((a, b) => b.average - a.average);

            resultsDiv.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📅 Term Summary - ${esc(cls?.name)} (${esc(term?.name)})</span>
            </div>
            <div class="dash-card-body">
                <div class="stats-grid" style="margin-bottom:20px">
                    <div class="stat-card"><div class="stat-value">${students.length}</div><div class="stat-label">Students</div></div>
                    <div class="stat-card"><div class="stat-value">${classAverage.toFixed(1)}%</div><div class="stat-label">Class Average</div></div>
                    <div class="stat-card"><div class="stat-value">${passRate.toFixed(1)}%</div><div class="stat-label">Pass Rate</div></div>
                    <div class="stat-card"><div class="stat-value">${assessments.length}</div><div class="stat-label">Assessments</div></div>
                </div>
                
                <h4>📖 Subject Performance (Highest to Lowest)</h4>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr><th>Rank</th><th>Subject</th><th>Average %</th><th>Grade</th><th>Status</th><tr>
                        </thead>
                        <tbody>
                            ${subjectAverages.map((s, idx) => `
                                <tr>
                                    <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🏆' : ''}</span>
                                    <td><strong>${esc(s.name)}</strong></span>
                                    <td style="text-align:center"><span class="badge ${getGradeClass(s.average)}">${s.average.toFixed(1)}%</span></span>
                                    <td style="text-align:center">${s.grade}</span>
                                    <td style="text-align:center">
                                        <div style="background:var(--border-light); border-radius:99px; height:6px; width:80px; overflow:hidden">
                                            <div style="width:${s.average}%; height:100%; background:${s.average >= 80 ? '#10b981' : s.average >= 60 ? '#f59e0b' : '#ef4444'}; border-radius:99px"></div>
                                        </div>
                                    </span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <h4 style="margin-top:20px">📋 Top 5 Students</h4>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Rank</th><th>Student Name</th><th>Average %</th><th>Grade</th></tr></thead>
                        <tbody id="top-students-list"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

            // Calculate top students
            const studentPercentages = [];
            for (const student of students) {
                let score = 0, max = 0;
                const studentMarks = state.marks.filter(m => m.student_id === student.id);
                for (const assessment of assessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        score += mark.score;
                        max += assessment.max_marks;
                    }
                }
                const pct = max > 0 ? (score / max) * 100 : 0;
                studentPercentages.push({ name: `${student.first_name} ${student.last_name}`, pct });
            }
            studentPercentages.sort((a, b) => b.pct - a.pct);

            const topStudentsHtml = studentPercentages.slice(0, 5).map((s, i) => `
        <tr>
            <td style="text-align:center">${i + 1}</span>
            <td><strong>${esc(s.name)}</strong></span>
            <td style="text-align:center">${s.pct.toFixed(1)}%</span>
            <td style="text-align:center">${getGrade(s.pct)}</span>
        </tr>
    `).join('');

            document.getElementById('top-students-list').innerHTML = topStudentsHtml;

            window._currentTermReport = { classId, termId, subjectAverages, studentPercentages, classAverage, passRate };
        }

        async function generateSubjectAnalysis() {
            const classId = document.getElementById('subject-class')?.value;
            const subjectId = document.getElementById('subject-select')?.value;
            const termId = document.getElementById('subject-term')?.value;
            const resultsDiv = document.getElementById('subject-analysis-results');

            if (!classId || !subjectId) {
                showToast('Please select class and subject', 'warning');
                return;
            }

            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Analyzing subject performance...</p></div>';

            const cls = getClassById(classId);
            const subject = getSubjectById(subjectId);
            const term = getTermById(termId);
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id == classId && a.subject_id == subjectId && a.term_id == termId);

            const studentScores = [];
            for (const student of students) {
                let score = 0, max = 0;
                const studentMarks = state.marks.filter(m => m.student_id === student.id);
                for (const assessment of assessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        score += mark.score;
                        max += assessment.max_marks;
                    }
                }
                const pct = max > 0 ? (score / max) * 100 : 0;
                studentScores.push({
                    name: `${student.first_name} ${student.last_name}`,
                    code: student.student_code,
                    score: score,
                    max: max,
                    pct: pct,
                    grade: getGrade(pct)
                });
            }

            studentScores.sort((a, b) => b.pct - a.pct);

            const classAverage = studentScores.reduce((sum, s) => sum + s.pct, 0) / (studentScores.length || 1);
            const passCount = studentScores.filter(s => s.pct >= 50).length;
            const passRate = (passCount / (studentScores.length || 1)) * 100;
            const highestScore = studentScores[0]?.pct || 0;
            const lowestScore = studentScores[studentScores.length - 1]?.pct || 0;

            resultsDiv.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📖 Subject Analysis - ${esc(subject?.name)} (${esc(cls?.name)}, ${esc(term?.name)})</span>
            </div>
            <div class="dash-card-body">
                <div class="stats-grid" style="margin-bottom:20px">
                    <div class="stat-card"><div class="stat-value">${studentScores.length}</div><div class="stat-label">Students Assessed</div></div>
                    <div class="stat-card"><div class="stat-value">${classAverage.toFixed(1)}%</div><div class="stat-label">Class Average</div></div>
                    <div class="stat-card"><div class="stat-value">${passRate.toFixed(1)}%</div><div class="stat-label">Pass Rate</div></div>
                    <div class="stat-card"><div class="stat-value">${highestScore.toFixed(1)}%</div><div class="stat-label">Highest Score</div></div>
                    <div class="stat-card"><div class="stat-value">${lowestScore.toFixed(1)}%</div><div class="stat-label">Lowest Score</div></div>
                    <div class="stat-card"><div class="stat-value">${assessments.length}</div><div class="stat-label">Assessments</div></div>
                </div>
                
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Student Name</th>
                                <th>Student Code</th>
                                <th>Score</th>
                                <th>Max</th>
                                <th>%</th>
                                <th>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studentScores.map((s, idx) => `
                                <tr>
                                    <td style="text-align:center; font-weight:700">${idx + 1}${idx === 0 ? ' 🏆' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
                                    <td><strong>${esc(s.name)}</strong></span>
                                    <td>${esc(s.code || '—')}</span>
                                    <td style="text-align:right">${s.score.toFixed(1)}</span>
                                    <td style="text-align:right">${s.max}</span>
                                    <td style="text-align:center"><span class="badge ${getGradeClass(s.pct)}">${s.pct.toFixed(1)}%</span></span>
                                    <td style="text-align:center">${s.grade}</span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
        }

        async function generateStudentProgress() {
            const studentId = document.getElementById('progress-student')?.value;
            const startTermId = document.getElementById('progress-start-term')?.value;
            const endTermId = document.getElementById('progress-end-term')?.value;
            const resultsDiv = document.getElementById('student-progress-results');

            if (!studentId) {
                showToast('Please select a student', 'warning');
                return;
            }

            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading student progress...</p></div>';

            const student = getStudentById(studentId);
            const cls = getClassById(student.class_id);
            const allTerms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const startIdx = allTerms.findIndex(t => t.id == startTermId);
            const endIdx = allTerms.findIndex(t => t.id == endTermId);
            const termsToShow = allTerms.slice(startIdx, endIdx + 1);

            const termData = [];
            for (const term of termsToShow) {
                const assessments = state.assessments.filter(a => a.class_id === student.class_id && a.term_id === term.id);
                let score = 0, max = 0;
                const studentMarks = state.marks.filter(m => m.student_id == studentId);

                for (const assessment of assessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        score += mark.score;
                        max += assessment.max_marks;
                    }
                }

                const pct = max > 0 ? (score / max) * 100 : 0;
                termData.push({
                    term: term.name,
                    score: score,
                    max: max,
                    pct: pct,
                    grade: getGrade(pct)
                });
            }

            // Calculate improvement
            const firstPct = termData[0]?.pct || 0;
            const lastPct = termData[termData.length - 1]?.pct || 0;
            const improvement = lastPct - firstPct;
            const trendIcon = improvement > 0 ? '📈 Improving' : improvement < 0 ? '📉 Declining' : '📊 Stable';
            const trendColor = improvement > 0 ? 'var(--success)' : improvement < 0 ? 'var(--danger)' : 'var(--text-muted)';

            resultsDiv.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👤 Student Progress - ${esc(student.first_name)} ${esc(student.last_name)}</span>
            </div>
            <div class="dash-card-body">
                <div class="stats-grid" style="margin-bottom:20px">
                    <div class="stat-card"><div class="stat-value">${firstPct.toFixed(1)}%</div><div class="stat-label">Start (${termsToShow[0]?.name})</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:${trendColor}">${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%</div><div class="stat-label">Change</div></div>
                    <div class="stat-card"><div class="stat-value">${lastPct.toFixed(1)}%</div><div class="stat-label">Current (${termsToShow[termsToShow.length - 1]?.name})</div></div>
                    <div class="stat-card"><div class="stat-value">${trendIcon}</div><div class="stat-label">Trend</div></div>
                </div>
                
                <canvas id="progress-chart" height="250" style="margin-bottom:20px"></canvas>
                
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Term</th>
                                <th>Score</th>
                                <th>Max</th>
                                <th>%</th>
                                <th>Grade</th>
                                <th>Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${termData.map((t, i) => {
                const change = i > 0 ? t.pct - termData[i - 1].pct : 0;
                const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
                const changeColor = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-muted)';
                return `
                                    <tr>
                                        <td><strong>${esc(t.term)}</strong></span>
                                        <td style="text-align:right">${t.score.toFixed(1)}</span>
                                        <td style="text-align:right">${t.max}</span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(t.pct)}">${t.pct.toFixed(1)}%</span></span>
                                        <td style="text-align:center">${t.grade}</span>
                                        <td style="color:${changeColor}">${changeIcon} ${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

            // Create chart
            setTimeout(() => {
                const ctx = document.getElementById('progress-chart')?.getContext('2d');
                if (ctx) {
                    if (window._progressChart) window._progressChart.destroy();
                    window._progressChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: termData.map(t => t.term),
                            datasets: [{
                                label: 'Percentage (%)',
                                data: termData.map(t => t.pct),
                                borderColor: '#3b82f6',
                                backgroundColor: 'rgba(59,130,246,0.1)',
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: '#3b82f6',
                                pointBorderColor: '#fff',
                                pointRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } } }
                        }
                    });
                }
            }, 100);
        }

        async function generateClassComparisonReport() {
            const classSelect = document.getElementById('compare-classes');
            const selectedClasses = Array.from(classSelect.selectedOptions).map(opt => parseInt(opt.value));
            const termId = document.getElementById('compare-term')?.value;
            const resultsDiv = document.getElementById('comparison-report-results');

            if (selectedClasses.length === 0) {
                showToast('Please select at least one class', 'warning');
                return;
            }

            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Comparing classes...</p></div>';

            const term = getTermById(termId);
            const comparisonData = [];

            for (const classId of selectedClasses) {
                const cls = getClassById(classId);
                const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
                const assessments = state.assessments.filter(a => a.class_id == classId && a.term_id == termId);

                let totalPct = 0, studentCount = 0;
                let passCount = 0;
                let highestScore = 0;
                let lowestScore = 100;

                for (const student of students) {
                    let score = 0, max = 0;
                    const studentMarks = state.marks.filter(m => m.student_id === student.id);
                    for (const assessment of assessments) {
                        const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                        if (mark) {
                            score += mark.score;
                            max += assessment.max_marks;
                        }
                    }
                    if (max > 0) {
                        const pct = (score / max) * 100;
                        totalPct += pct;
                        studentCount++;
                        if (pct >= 50) passCount++;
                        if (pct > highestScore) highestScore = pct;
                        if (pct < lowestScore) lowestScore = pct;
                    }
                }

                const avgPct = studentCount > 0 ? totalPct / studentCount : 0;
                const passRate = studentCount > 0 ? (passCount / studentCount) * 100 : 0;

                comparisonData.push({
                    name: cls.name,
                    students: students.length,
                    avgPct: avgPct,
                    grade: getGrade(avgPct),
                    passRate: passRate,
                    highest: highestScore,
                    lowest: lowestScore
                });
            }

            comparisonData.sort((a, b) => b.avgPct - a.avgPct);

            resultsDiv.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Class Comparison - ${esc(term?.name)}</span>
            </div>
            <div class="dash-card-body">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Class</th>
                                <th>Students</th>
                                <th>Average %</th>
                                <th>Grade</th>
                                <th>Pass Rate</th>
                                <th>Highest</th>
                                <th>Lowest</th>
                                <th>Performance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${comparisonData.map((c, idx) => `
                                <tr>
                                    <td style="text-align:center; font-weight:700">${idx + 1}${idx === 0 ? ' 🏆' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
                                    <td><strong>${esc(c.name)}</strong></span>
                                    <td style="text-align:center">${c.students}</span>
                                    <td style="text-align:center"><span class="badge ${getGradeClass(c.avgPct)}">${c.avgPct.toFixed(1)}%</span></span>
                                    <td style="text-align:center">${c.grade}</span>
                                    <td style="text-align:center">${c.passRate.toFixed(1)}%</span>
                                    <td style="text-align:center">${c.highest.toFixed(1)}%</span>
                                    <td style="text-align:center">${c.lowest.toFixed(1)}%</span>
                                    <td style="text-align:center">
                                        <div style="background:var(--border-light); border-radius:99px; height:6px; width:100px; overflow:hidden">
                                            <div style="width:${c.avgPct}%; height:100%; background:${c.avgPct >= 80 ? '#10b981' : c.avgPct >= 60 ? '#f59e0b' : '#ef4444'}; border-radius:99px"></div>
                                        </div>
                                    </span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
        }

        async function generateTrendReport() {
            const classId = document.getElementById('report-trend-class')?.value;
            const subjectId = document.getElementById('report-trend-subject')?.value;
            const metric = document.getElementById('report-trend-metric')?.value;
            const resultsDiv = document.getElementById('trend-report-results');

            if (!classId) {
                showToast('Please select a class', 'warning');
                return;
            }

            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Calculating trends...</p></div>';

            const allTerms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const trendData = [];

            for (const term of allTerms) {
                let value = 0;
                const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
                let assessments = state.assessments.filter(a => a.class_id == classId && a.term_id === term.id);

                if (subjectId) {
                    assessments = assessments.filter(a => a.subject_id == subjectId);
                }

                if (metric === 'average') {
                    let totalPct = 0, count = 0;
                    for (const student of students) {
                        let score = 0, max = 0;
                        const studentMarks = state.marks.filter(m => m.student_id === student.id);
                        for (const assessment of assessments) {
                            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                            if (mark) {
                                score += mark.score;
                                max += assessment.max_marks;
                            }
                        }
                        if (max > 0) {
                            totalPct += (score / max) * 100;
                            count++;
                        }
                    }
                    value = count > 0 ? totalPct / count : 0;
                } else if (metric === 'pass_rate') {
                    let passCount = 0, totalCount = 0;
                    for (const student of students) {
                        let score = 0, max = 0;
                        const studentMarks = state.marks.filter(m => m.student_id === student.id);
                        for (const assessment of assessments) {
                            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                            if (mark) {
                                score += mark.score;
                                max += assessment.max_marks;
                            }
                        }
                        if (max > 0) {
                            totalCount++;
                            if ((score / max) * 100 >= 50) passCount++;
                        }
                    }
                    value = totalCount > 0 ? (passCount / totalCount) * 100 : 0;
                } else if (metric === 'top_student') {
                    let topPct = 0;
                    for (const student of students) {
                        let score = 0, max = 0;
                        const studentMarks = state.marks.filter(m => m.student_id === student.id);
                        for (const assessment of assessments) {
                            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                            if (mark) {
                                score += mark.score;
                                max += assessment.max_marks;
                            }
                        }
                        const pct = max > 0 ? (score / max) * 100 : 0;
                        if (pct > topPct) topPct = pct;
                    }
                    value = topPct;
                }

                trendData.push({
                    term: term.name,
                    value: value
                });
            }

            const subject = subjectId ? getSubjectById(subjectId) : null;
            const metricLabel = metric === 'average' ? 'Class Average' : metric === 'pass_rate' ? 'Pass Rate' : 'Top Student Score';

            resultsDiv.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📈 Performance Trends - ${metricLabel}</span>
            </div>
            <div class="dash-card-body">
                <canvas id="trend-report-chart" height="300"></canvas>
                <div class="table-wrapper" style="margin-top:20px">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Term</th>
                                <th>Value</th>
                                <th>Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trendData.map((t, i) => {
                const change = i > 0 ? t.value - trendData[i - 1].value : 0;
                const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
                const changeColor = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-muted)';
                return `
                                    <tr>
                                        <td><strong>${esc(t.term)}</strong></span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(t.value)}">${t.value.toFixed(1)}%</span></span>
                                        <td style="color:${changeColor}">${changeIcon} ${change > 0 ? '+' : ''}${change.toFixed(1)}%</span>
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
                const ctx = document.getElementById('trend-report-chart')?.getContext('2d');
                if (ctx) {
                    if (window._trendReportChart) window._trendReportChart.destroy();
                    window._trendReportChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: trendData.map(t => t.term),
                            datasets: [{
                                label: metricLabel,
                                data: trendData.map(t => t.value),
                                borderColor: '#3b82f6',
                                backgroundColor: 'rgba(59,130,246,0.1)',
                                fill: true,
                                tension: 0.3,
                                pointBackgroundColor: '#3b82f6',
                                pointBorderColor: '#fff',
                                pointRadius: 5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } } }
                        }
                    });
                }
            }, 100);
        }

        function exportAcademicReport() {
            const activeTab = document.querySelector('#dynamic-content .tab-btn.active')?.textContent;
            let data = [];
            let filename = `Academic_Report_${new Date().toISOString().split('T')[0]}`;

            if (activeTab?.includes('Term')) {
                const report = window._currentTermReport;
                if (report) {
                    data = report.subjectAverages.map(s => ({
                        'Subject': s.name,
                        'Average %': s.average.toFixed(1),
                        'Grade': s.grade
                    }));
                    filename = `Term_Summary_${getClassById(report.classId)?.name}`;
                }
            } else if (activeTab?.includes('Subject')) {
                const table = document.querySelector('#subject-analysis-results table');
                if (table) {
                    const ws = XLSX.utils.table_to_sheet(table);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Subject Analysis');
                    XLSX.writeFile(wb, `Subject_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
                    showToast('✅ Report exported', 'success');
                    return;
                }
            }

            if (data.length === 0) {
                showToast('No data to export', 'warning');
                return;
            }

            exportToExcel(data, filename);
            showToast('✅ Report exported', 'success');
        }

        function printAcademicReport() {
            const activeTab = document.querySelector('#dynamic-content .tab-btn.active')?.textContent;
            let content = '';

            if (activeTab?.includes('Term')) {
                content = document.getElementById('term-summary-results')?.innerHTML;
            } else if (activeTab?.includes('Subject')) {
                content = document.getElementById('subject-analysis-results')?.innerHTML;
            } else if (activeTab?.includes('Student')) {
                content = document.getElementById('student-progress-results')?.innerHTML;
            } else if (activeTab?.includes('Comparison')) {
                content = document.getElementById('comparison-report-results')?.innerHTML;
            } else if (activeTab?.includes('Trends')) {
                content = document.getElementById('trend-report-results')?.innerHTML;
            }

            if (!content) {
                showToast('Generate a report first', 'warning');
                return;
            }

            const school = state.schoolSettings || {};
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Academic Report - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin:10px 0}
                th,td{border:1px solid #ccc;padding:8px}
                th{background:#1a3a5c;color:white}
                .badge{display:inline-block;padding:2px 8px;border-radius:12px}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>${esc(school.school_name || 'ECOLE LA FONTAINE')}</h1>
            <h2 style="text-align:center">Academic Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${content}
        </body>
        </html>
    `);
            printWindow.document.close();
            printWindow.print();
        }

        // ════════════════════════════════════════════════════════════════════════
        // SECTION EX-7 — FAMILY MANAGEMENT MODULE
