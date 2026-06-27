// SECTION 61: TEACHER PERFORMANCE
        // ================================================================

        async function renderTeacherPerformance(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }
            await ensureStateLoaded();

            const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const currentTermId = state.currentTerm?.id;

            const teacherPerformance = [];

            for (const teacher of teachers) {
                const assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                const subjectIds = [...new Set(assignments.map(a => a.subject_id))];

                let totalStudentPerformance = 0;
                let totalClasses = 0;
                let totalMarksEntered = 0;
                let totalAssessments = 0;

                for (const classId of classIds) {
                    const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
                    const assessments = state.assessments.filter(a =>
                        a.class_id === classId &&
                        a.term_id === currentTermId &&
                        subjectIds.includes(a.subject_id)
                    );

                    totalAssessments += assessments.length;

                    let classTotalPct = 0;
                    let studentCount = 0;

                    for (const student of students) {
                        let studentScore = 0;
                        let studentMax = 0;

                        for (const assessment of assessments) {
                            const mark = state.marks.find(m =>
                                m.assessment_id === assessment.id &&
                                m.student_id === student.id
                            );
                            if (mark) {
                                studentScore += mark.score;
                                studentMax += assessment.max_marks;
                            }
                        }

                        if (studentMax > 0) {
                            classTotalPct += (studentScore / studentMax) * 100;
                            studentCount++;
                        }
                    }

                    if (studentCount > 0) {
                        totalStudentPerformance += classTotalPct / studentCount;
                        totalClasses++;
                    }

                    const teacherMarks = state.marks.filter(m => {
                        const assessment = state.assessments.find(a => a.id === m.assessment_id);
                        return assessment && subjectIds.includes(assessment.subject_id) && classIds.includes(assessment.class_id);
                    });
                    totalMarksEntered += teacherMarks.length;
                }

                const avgPerformance = totalClasses > 0 ? totalStudentPerformance / totalClasses : 0;
                const performanceGrade = getGrade(avgPerformance);
                const performanceClass = getGradeClass(avgPerformance);

                teacherPerformance.push({
                    teacher: teacher,
                    classCount: classIds.length,
                    subjectCount: subjectIds.length,
                    avgPerformance: avgPerformance,
                    performanceGrade: performanceGrade,
                    performanceClass: performanceClass,
                    marksEntered: totalMarksEntered,
                    assessmentCount: totalAssessments,
                    assignments: assignments.length
                });
            }

            teacherPerformance.sort((a, b) => b.avgPerformance - a.avgPerformance);

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">⭐ Teacher Performance Dashboard</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="exportTeacherPerformance()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="printTeacherPerformance()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="perf-term-filter" class="form-control" style="width:150px" onchange="loadTeacherPerformance()">
                        <option value="">All Terms</option>
                        ${terms.map(t => `<option value="${t.id}" ${t.id === currentTermId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                    </select>
                    <input type="text" id="perf-search" class="form-control flex-1" placeholder="🔍 Search teacher..." oninput="filterTeacherPerformance()">
                    <span class="result-count" id="perf-count"></span>
                </div>

                <div class="table-wrapper" id="teacher-performance-table">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Teacher</th>
                                <th>Department</th>
                                <th>Classes</th>
                                <th>Subjects</th>
                                <th>Avg Score</th>
                                <th>Grade</th>
                                <th>Marks Entered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherPerformance.map((tp, idx) => `
                                <tr>
                                    <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</td>
                                    <td><strong>${esc(tp.teacher.name)}</strong><br><small>${esc(tp.teacher.email || '')}</small></td>
                                    <td>${esc(tp.teacher.department || 'General')}</td>
                                    <td style="text-align:center">${tp.classCount}</td>
                                    <td style="text-align:center">${tp.subjectCount}</td>
                                    <td style="text-align:center"><span class="badge ${tp.performanceClass}">${tp.avgPerformance.toFixed(1)}%</span></td>
                                    <td style="text-align:center">${tp.performanceGrade}</td>
                                    <td style="text-align:center">${tp.marksEntered.toLocaleString()}</td>
                                    <td style="text-align:center">
                                        <button class="btn btn-sm btn-outline" onclick="viewTeacherDetails(${tp.teacher.id})">👁️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Performance Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="perf-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.length}</div>
                        <div class="stat-label">Active Teachers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.filter(t => t.avgPerformance >= 70).length}</div>
                        <div class="stat-label">High Performers (≥70%)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.filter(t => t.avgPerformance < 50).length}</div>
                        <div class="stat-label">Needs Improvement (&lt;50%)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.reduce((sum, t) => sum + t.marksEntered, 0).toLocaleString()}</div>
                        <div class="stat-label">Total Marks Entered</div>
                    </div>
                </div>
            </div>
        </div>
    `;

            window._teacherPerformanceData = teacherPerformance;
        }
        window.renderTeacherPerformance = renderTeacherPerformance;

        function filterTeacherPerformance() {
            const term = (document.getElementById('perf-search')?.value || '').toLowerCase();
            const rows = document.querySelectorAll('#teacher-performance-table tbody tr');
            let visible = 0;
            rows.forEach(row => {
                const show = !term || row.innerText.toLowerCase().includes(term);
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const count = document.getElementById('perf-count');
            if (count) count.textContent = visible + ' teacher' + (visible !== 1 ? 's' : '');
        }
        window.filterTeacherPerformance = filterTeacherPerformance;

        function exportTeacherPerformance() {
            const data = (state.teachers || []).map(t => {
                return {
                    'Teacher': t.name,
                    'Role': t.role,
                    'Status': t.is_active === false ? 'Inactive' : 'Active',
                    'Last Login': fmtDate(t.last_login)
                };
            });
            exportToExcel(data, 'Teacher_Performance');
            showToast('✅ Teacher performance exported', 'success');
        }
        window.exportTeacherPerformance = exportTeacherPerformance;

        function printTeacherPerformance() {
            const content = document.getElementById('dynamic-content');
            if (!content) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Teacher Performance</title>
        <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px}th{background:#1a3a5c;color:#fff}
        h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
        <body><h2>ECOLE LA FONTAINE — Teacher Performance</h2>
        <p style="text-align:center">${new Date().toLocaleDateString()}</p>${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }
        window.printTeacherPerformance = printTeacherPerformance;

        // ================================================================
