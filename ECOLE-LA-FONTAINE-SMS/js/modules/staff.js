// js/modules/staff.js
// Source lines: 20930–21607 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * Builds the HTML table body for one staff tab (teachers, accountants,
         * or admins) on the merged Staff & User Management page. Returns a
         * string (not async) since it's interpolated directly into HTML set
         * via innerHTML, not a template literal evaluated at render time.
         */
        function renderTeacherTable(list, role) {
            if (!list.length) {
                return `<div class="alert alert-info">No ${esc(role)}s found</div>`;
            }
            return `
                <table class="data-table">
                    <thead>
                        <tr><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${list.map(t => `
                            <tr>
                                <td><strong>${esc((t.last_name || '') + ' ' + (t.first_name || '') || '—')}</strong></td>
                                <td>${esc(t.username || '—')}</td>
                                <td>${esc(t.email || '—')}</td>
                                <td>${esc(t.phone || '—')}</td>
                                <td><span class="badge ${t.is_active !== false ? 'badge-success' : 'badge-danger'}">${t.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                <td>
                                    <div class="btn-group" style="gap:4px">
                                        <button class="btn btn-sm btn-outline" onclick="window.editTeacher(${t.id})">✏️</button>
                                        <button class="btn btn-sm btn-outline" onclick="window.resetTeacherPassword(${t.id})">🔑</button>
                                        <button class="btn btn-sm ${t.is_active !== false ? 'btn-danger' : 'btn-success'}" onclick="window.toggleTeacherStatus(${t.id})">${t.is_active !== false ? 'Deactivate' : 'Activate'}</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }


        /**
         * Manage subjects: add, edit, delete, set MG/EX max marks,
         * sort order, and class assignments.
         */
        async function renderSubjects(container) {
            await ensureStateLoaded();

            const nurserySubjects = state.subjects.filter(s => s.level === 'Nursery');
            const primarySubjects = state.subjects.filter(s => s.level === 'Primary');

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📖 Subjects</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddSubjectModal()">➕ Add Subject</button>
                            <button class="btn btn-sm btn-success" onclick="window.saveAllSubjects()">💾 Save All</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="tabs">
                            <button class="tab-btn active" onclick="window.showSubjectTab('nursery', event)">🎒 Nursery</button>
                            <button class="tab-btn" onclick="window.showSubjectTab('primary', event)">📚 Primary</button>
                        </div>
                        <div id="nursery-subjects">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>#</th><th>Subject Name</th><th>Code</th><th>MG Max</th><th>EX Max</th><th>Post-Mid Only</th><th>Status</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        ${nurserySubjects.map((s, i) => `
                                            <tr>
                                                <td>${i + 1}</span>
                                                <td><input type="text" id="subj-name-${s.id}" value="${esc(s.name)}" style="width:100%"></span>
                                                <td><code>${esc(s.code)}</code></span>
                                                <td><input type="number" id="subj-mg-${s.id}" value="${s.mg_max}" style="width:60px"></span>
                                                <td><input type="number" id="subj-ex-${s.id}" value="${s.ex_max}" style="width:60px"></span>
                                                <td><input type="checkbox" id="subj-midonly-${s.id}" ${s.appears_only_post_midterm ? 'checked' : ''}></span>
                                                <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">${s.is_active ? 'Active' : 'Hidden'}</span></span>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.toggleSubjectStatus(${s.id},${s.is_active})">${s.is_active ? 'Hide' : 'Show'}</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteSubject(${s.id},'${esc(s.name)}')">🗑️</button>
                                                 </span>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div id="primary-subjects" style="display:none">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>#</th><th>Subject Name</th><th>Code</th><th>MG Max</th><th>EX Max</th><th>Post-Mid Only</th><th>Status</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        ${primarySubjects.map((s, i) => `
                                            <tr>
                                                <td>${i + 1}</span>
                                                <td><input type="text" id="subj-name-${s.id}" value="${esc(s.name)}" style="width:100%"></span>
                                                <td><code>${esc(s.code)}</code></span>
                                                <td><input type="number" id="subj-mg-${s.id}" value="${s.mg_max}" style="width:60px"></span>
                                                <td><input type="number" id="subj-ex-${s.id}" value="${s.ex_max}" style="width:60px"></span>
                                                <td><input type="checkbox" id="subj-midonly-${s.id}" ${s.appears_only_post_midterm ? 'checked' : ''}></span>
                                                <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">${s.is_active ? 'Active' : 'Hidden'}</span></span>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.toggleSubjectStatus(${s.id},${s.is_active})">${s.is_active ? 'Hide' : 'Show'}</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteSubject(${s.id},'${esc(s.name)}')">🗑️</button>
                                                 </span>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            window.showSubjectTab = showSubjectTab;
            window.openAddSubjectModal = openAddSubjectModal;
            window.saveAllSubjects = saveAllSubjects;
            window.toggleSubjectStatus = toggleSubjectStatus;
            window.deleteSubject = deleteSubject;
            window.createSubject = createSubject;
        }


        /**
         * Assign teachers to classes and subjects.
         * View which teacher covers which subject in which class.
         */
        async function renderTeacherAssignments(container) {
            await ensureStateLoaded();

            const assignments = await getAll('teacher_assignments').catch(() => []);
            const teachers = (state.teachers || []).filter(t => t.role === 'teacher' && t.is_active !== false);
            const classes = (state.classes || []).filter(c => c.is_active !== false);
            const subjects = (state.subjects || []).filter(s => s.is_active !== false);

            const assignmentsByTeacher = new Map();
            for (const a of assignments) {
                if (!assignmentsByTeacher.has(a.teacher_id)) assignmentsByTeacher.set(a.teacher_id, []);
                assignmentsByTeacher.get(a.teacher_id).push({
                    class_id: a.class_id, subject_id: a.subject_id,
                    class_name: getClassById(a.class_id)?.name,
                    subject_name: getSubjectById(a.subject_id)?.name
                });
            }

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header"><span class="dash-card-title">📌 Teacher Assignments</span>
                                <button class="btn btn-sm btn-primary" onclick="window.openAssignmentModal()">➕ Assign</button>
                                <button class="btn btn-sm btn-outline" onclick="window.exportAssignments()">📥 Export</button>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                <div class="table-wrapper"><table class="data-table">
                                    <thead><tr><th>Teacher</th><th>Department</th><th>Assigned Classes & Subjects</th><th>Load</th><th>Actions</th></tr></thead>
                                    <tbody>${teachers.map(teacher => {
                const teacherAssignments = assignmentsByTeacher.get(teacher.id) || [];
                const loadClass = teacherAssignments.length > 10 ? 'badge-danger' : (teacherAssignments.length > 5 ? 'badge-warning' : 'badge-success');
                return `
                                            <tr>
                                                <td><strong>${esc(teacher.name)}</strong><br><small>${esc(teacher.email || '')}</small></td>
                                                <td>${esc(teacher.department || 'General')}</span>
                                                <td><div style="display:flex; flex-wrap:wrap; gap:6px">${teacherAssignments.map(a => `<span class="badge badge-info">${esc(a.class_name)} - ${esc(a.subject_name)}</span>`).join('') || '<span style="color:var(--text-muted)">No assignments</span>'}</div></span>
                                                <td style="text-align:center"><span class="badge ${loadClass}">${teacherAssignments.length} classes</span></span>
                                                <td style="text-align:center"><button class="btn btn-sm btn-outline" onclick="window.editTeacherAssignments(${teacher.id})">✏️ Edit</button>
                                                <button class="btn btn-sm btn-danger" onclick="window.clearTeacherAssignments(${teacher.id}, '${esc(teacher.name)}')">🗑️ Clear All</button></span>
                                            </tr>`;
            }).join('') || '<td><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No teachers found</span>'}
                                    </tbody>
                                </table></div>
                            </div>
                        </div>
                        <div class="dash-card" style="margin-top:20px">
                            <div class="dash-card-header"><span class="dash-card-title">📊 Assignment Summary</span></div>
                            <div class="dash-card-body"><div id="assignment-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)"><div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div></div></div>
                        </div>
                    `;

            document.getElementById('assignment-stats').innerHTML = `
                        <div class="stat-card"><div class="stat-value">${teachers.length}</div><div class="stat-label">Total Teachers</div></div>
                        <div class="stat-card"><div class="stat-value">${assignments.length}</div><div class="stat-label">Total Assignments</div></div>
                        <div class="stat-card"><div class="stat-value">${teachers.length ? (assignments.length / teachers.length).toFixed(1) : 0}</div><div class="stat-label">Avg per Teacher</div></div>
                        <div class="stat-card"><div class="stat-value">${teachers.filter(t => !assignmentsByTeacher.has(t.id)).length}</div><div class="stat-label">Unassigned Teachers</div></div>
                    `;

            window.openAssignmentModal = () => {
                showModal(`<div class="modal-overlay"><div class="modal" style="max-width:500px"><div class="modal-header"><h3>➕ Assign Teacher to Class & Subject</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
                        <div class="modal-body"><div class="form-grid"><div class="form-group full"><label>Teacher</label><select id="assign-teacher"><option value="">-- Select Teacher --</option>${teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
                        <div class="form-group full"><label>Class</label><select id="assign-class"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                        <div class="form-group full"><label>Subject</label><select id="assign-subject"><option value="">-- Select Subject --</option>${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Academic Year</label><select id="assign-year">${(state.academicYears || []).map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div></div></div>
                        <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="window.submitAssignment()">Assign</button></div></div></div>`);
                window.submitAssignment = async () => {
                    const teacherId = document.getElementById('assign-teacher')?.value;
                    const classId = document.getElementById('assign-class')?.value;
                    const subjectId = document.getElementById('assign-subject')?.value;
                    const yearId = document.getElementById('assign-year')?.value;
                    if (!teacherId || !classId || !subjectId) { showToast('Please select teacher, class, and subject', 'warning'); return; }
                    const existing = await getAll('teacher_assignments', { teacher_id: teacherId, class_id: classId, subject_id: subjectId, academic_year_id: yearId });
                    if (existing.length) { showToast('This assignment already exists', 'warning'); return; }
                    await insert('teacher_assignments', { teacher_id: parseInt(teacherId), class_id: parseInt(classId), subject_id: parseInt(subjectId), academic_year_id: parseInt(yearId) });
                    await refreshTable('teacher_assignments');
                    closeModal();
                    showToast('✅ Assignment created', 'success');
                    renderTeacherAssignments(document.getElementById('dynamic-content'));
                };
            };

            window.editTeacherAssignments = async (teacherId) => {
                const teacher = (state.teachers || []).find(t => t.id === teacherId);
                const existing = await getAll('teacher_assignments', { teacher_id: teacherId });
                const existingSet = new Set(existing.map(a => `${a.class_id}|${a.subject_id}`));
                showModal(`<div class="modal-overlay"><div class="modal modal-lg" style="max-width:700px"><div class="modal-header"><h3>✏️ Edit Assignments - ${esc(teacher?.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
                        <div class="modal-body"><div class="alert alert-info">Check the boxes to assign the teacher to a class and subject combination.</div>
                        <div class="table-wrapper" style="max-height:500px;overflow-y:auto"><table class="data-table"><thead><tr><th style="width:40px">Assign</th><th>Class</th>${subjects.map(s => `<th>${esc(s.name)}</th>`).join('')}</thead>
                        <tbody>${classes.map(cls => `<tr><td style="text-align:center"><input type="checkbox" class="select-all-row" data-class="${cls.id}" onchange="window.toggleRowSubjects(${cls.id}, this.checked)"></td>
                        <td><strong>${esc(cls.name)}</strong></td>${subjects.map(sub => `<td style="text-align:center"><input type="checkbox" class="assign-cb" data-class="${cls.id}" data-subject="${sub.id}" ${existingSet.has(`${cls.id}|${sub.id}`) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
                        <div class="form-group" style="margin-top:16px"><label>Academic Year</label><select id="edit-assign-year">${(state.academicYears || []).map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div></div>
                        <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="window.saveTeacherAssignments(${teacherId})">Save Assignments</button></div></div></div>`);
                window.toggleRowSubjects = (classId, checked) => { document.querySelectorAll(`.assign-cb[data-class="${classId}"]`).forEach(cb => cb.checked = checked); };
                window.saveTeacherAssignments = async (teacherId) => {
                    const yearId = document.getElementById('edit-assign-year')?.value;
                    const selected = [...document.querySelectorAll('.assign-cb:checked')].map(cb => ({ class_id: parseInt(cb.dataset.class), subject_id: parseInt(cb.dataset.subject) }));
                    await removeWhere('teacher_assignments', `teacher_id=eq.${teacherId} AND academic_year_id=eq.${yearId}`);
                    for (const s of selected) await insert('teacher_assignments', { teacher_id: teacherId, class_id: s.class_id, subject_id: s.subject_id, academic_year_id: parseInt(yearId) });
                    await refreshTable('teacher_assignments');
                    closeModal();
                    showToast(`✅ Saved ${selected.length} assignments`, 'success');
                    renderTeacherAssignments(document.getElementById('dynamic-content'));
                };
            };

            window.clearTeacherAssignments = async (teacherId, teacherName) => {
                const count = (await getAll('teacher_assignments', { teacher_id: teacherId })).length;
                if (count === 0) { showToast('No assignments to clear', 'info'); return; }
                if (!await confirmDialog(`Remove ALL ${count} assignments for ${teacherName}?`)) return;
                await removeWhere('teacher_assignments', `teacher_id=eq.${teacherId}`);
                await refreshTable('teacher_assignments');
                showToast(`✅ Cleared ${count} assignments`, 'success');
                renderTeacherAssignments(document.getElementById('dynamic-content'));
            };

            window.exportAssignments = () => {
                const data = [];
                for (const a of assignments) {
                    const teacher = getTeacherById(a.teacher_id);
                    const cls = getClassById(a.class_id);
                    const sub = getSubjectById(a.subject_id);
                    data.push({ 'Teacher': teacher?.name || '—', 'Class': cls?.name || '—', 'Subject': sub?.name || '—', 'Academic Year': (state.academicYears || []).find(y => y.id === a.academic_year_id)?.name || '—' });
                }
                exportToExcel(data, `Teacher_Assignments_${new Date().toISOString().split('T')[0]}`);
                showToast('✅ Assignments exported', 'success');
            };
        }


        /**
         * Teacher performance report: marks entry rate, assessment completion,
         * on-time submission, and comparison across staff.
         */
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

            // Calculate performance metrics for each teacher
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

                    // Calculate average performance for students in this class
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

                    // Count marks entered by this teacher
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

            // Sort by performance (highest first)
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
                                            <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
                                            <td><strong>${esc(tp.teacher.name)}</strong><br><small>${esc(tp.teacher.email || '')}</small></span>
                                            <td>${esc(tp.teacher.department || 'General')}</span>
                                            <td style="text-align:center">${tp.classCount}</span>
                                            <td style="text-align:center">${tp.subjectCount}</span>
                                            <td style="text-align:center"><span class="badge ${tp.performanceClass}">${tp.avgPerformance.toFixed(1)}%</span></span>
                                            <td style="text-align:center">${tp.performanceGrade}</span>
                                            <td style="text-align:center">${tp.marksEntered.toLocaleString()}</span>
                                            <td style="text-align:center">
                                                <button class="btn btn-sm btn-outline" onclick="viewTeacherDetails(${tp.teacher.id})">👁️</button>
                                            </span>
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


        /**
         * Individual teacher profile modal.
         */
        async function renderTeacherProfile(container, teacher) {
            // Get assignments for this teacher
            let assignments = [];
            try {
                assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
            } catch (e) { }

            const classNames = [...new Set(assignments.map(a => getClassById(a.class_id)?.name).filter(Boolean))];
            const subjectNames = [...new Set(assignments.map(a => getSubjectById(a.subject_id)?.name).filter(Boolean))];

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">👩‍🏫 My Profile</span>
                        <button class="btn btn-sm btn-primary" onclick="window.editTeacherProfile()">✏️ Edit</button>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group"><label>Full Name</label><input readonly value="${esc(teacher.name)}" class="form-control"></div>
                            <div class="form-group"><label>Email</label><input readonly value="${esc(teacher.email || '—')}" class="form-control"></div>
                            <div class="form-group"><label>Username</label><input readonly value="${esc(teacher.username)}" class="form-control"></div>
                            <div class="form-group"><label>Role</label><input readonly value="${teacher.role}" class="form-control"></div>
                            <div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone || '—')}" class="form-control"></div>
                            <div class="form-group"><label>Department</label><input readonly value="${esc(teacher.department || '—')}" class="form-control"></div>
                            <div class="form-group"><label>Qualification</label><input readonly value="${esc(teacher.qualification || '—')}" class="form-control"></div>
                        </div>

                        <h4 style="margin-top:20px">📋 My Assigned Classes</h4>
                        <div class="form-group">
                            <textarea readonly class="form-control" rows="3">${classNames.join(', ') || 'No assignments'}</textarea>
                        </div>

                        <h4>📖 My Subjects</h4>
                        <div class="form-group">
                            <textarea readonly class="form-control" rows="3">${subjectNames.join(', ') || 'No subjects'}</textarea>
                        </div>

                        <div class="btn-group" style="margin-top:20px">
                            <button class="btn btn-outline" onclick="window.showChangePasswordModal()">🔒 Change Password</button>
                            <button class="btn btn-outline" onclick="window.setupBiometricLogin()">🔑 Setup Biometric Login</button>
                        </div>
                    </div>
                </div>
            `;

            window.editTeacherProfile = () => editTeacher(teacher.id);
        }


        /**
         * Create and manage user accounts (teachers and accountants).
         * Reset passwords, set roles, activate/deactivate.
         */
        /**
         * Unified Staff & User Management page (merges what were previously
         * two separate sidebar modules — "Staff Management" and "User
         * Management" — since both showed the same state.teachers data with
         * overlapping, partially-broken features). Combines: role tabs,
         * search/status filtering, create/edit/reset-password/activate
         * actions, summary stats, and the user activity log.
         */
        async function renderUserManagement(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const users = state.teachers || [];

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">👥 Staff & User Management</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddTeacherModal()">➕ Create User</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportTeachers()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="user-status-filter" class="form-control" style="width:150px" onchange="window.filterUsersList()">
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <input type="text" id="user-search" class="form-control flex-1" placeholder="🔍 Search by name, email, or username..." oninput="window.filterUsersList()">
                            <span class="result-count" id="user-count"></span>
                        </div>

                        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin:16px 0">
                            <button class="tab-btn active" onclick="window.showTeacherTab('teachers', event)">👩‍🏫 Teachers (${users.filter(u => u.role === 'teacher').length})</button>
                            <button class="tab-btn" onclick="window.showTeacherTab('accountants', event)">💰 Accountants (${users.filter(u => u.role === 'accountant').length})</button>
                            <button class="tab-btn" onclick="window.showTeacherTab('admins', event)">👨‍💼 Admins (${users.filter(u => u.role === 'admin').length})</button>
                        </div>

                        <div id="teachers-list-tab"></div>
                        <div id="accountants-list-tab" style="display:none"></div>
                        <div id="admins-list-tab" style="display:none"></div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 User Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="user-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔐 User Activity Log</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="user-activity-log" class="table-wrapper" style="max-height:300px; overflow-y:auto">
                            <div class="loading-container"><div class="spinner"></div><p>Loading activity...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window._allUsers = users;
            window.showTeacherTab = showTeacherTab;
            window.openAddTeacherModal = openAddTeacherModal;
            window.exportTeachers = exportTeachers;
            window.editTeacher = editTeacher;
            window.deleteTeacher = deleteTeacher;
            window.toggleTeacherStatus = toggleTeacherStatus;
            window.resetTeacherPassword = resetTeacherPassword;
            window.filterUsersList = filterUsersList;

            await filterUsersList();
            await renderUserStats();
            await renderUserActivityLog();
        }

        /**
         * Filters state.teachers by the search box + status dropdown, then
         * re-renders the 3 role tabs (teachers/accountants/admins) using
         * renderTeacherTable() so the active tab reflects the filtered set.
         * Also updates #user-count with the total matching users.
         */
        async function filterUsersList() {
            const q = (document.getElementById('user-search')?.value || '').toLowerCase();
            const status = document.getElementById('user-status-filter')?.value || '';
            let users = window._allUsers || state.teachers || [];
            if (status === 'active') users = users.filter(u => u.is_active !== false);
            else if (status === 'inactive') users = users.filter(u => u.is_active === false);
            if (q) users = users.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q));

            const teachersTab = document.getElementById('teachers-list-tab');
            const accountantsTab = document.getElementById('accountants-list-tab');
            const adminsTab = document.getElementById('admins-list-tab');
            if (teachersTab) teachersTab.innerHTML = renderTeacherTable(users.filter(u => u.role === 'teacher'), 'teacher');
            if (accountantsTab) accountantsTab.innerHTML = renderTeacherTable(users.filter(u => u.role === 'accountant'), 'accountant');
            if (adminsTab) adminsTab.innerHTML = renderTeacherTable(users.filter(u => u.role === 'admin'), 'admin');

            const countEl = document.getElementById('user-count');
            if (countEl) countEl.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
        }

        /**
         * Renders summary stat cards into #user-stats: total users by role
         * (teacher/accountant/admin) and how many are inactive.
         */
        async function renderUserStats() {
            const container = document.getElementById('user-stats');
            if (!container) return;

            const users = state.teachers || [];
            const teacherCount = users.filter(u => u.role === 'teacher').length;
            const accountantCount = users.filter(u => u.role === 'accountant').length;
            const adminCount = users.filter(u => u.role === 'admin').length;
            const inactiveCount = users.filter(u => u.is_active === false).length;

            container.innerHTML = `
                <div class="stat-card"><div class="stat-value">${teacherCount}</div><div class="stat-label">👩‍🏫 Teachers</div></div>
                <div class="stat-card"><div class="stat-value">${accountantCount}</div><div class="stat-label">💰 Accountants</div></div>
                <div class="stat-card"><div class="stat-value">${adminCount}</div><div class="stat-label">👨‍💼 Admins</div></div>
                <div class="stat-card"><div class="stat-value">${inactiveCount}</div><div class="stat-label">🚫 Inactive</div></div>
            `;
        }

        /**
         * Renders the most recent user-related activity log entries
         * (logins, logouts, password changes, account creation/edits) into
         * #user-activity-log.
         */
        async function renderUserActivityLog() {
            const container = document.getElementById('user-activity-log');
            if (!container) return;

            const logs = (state.activityLogs || [])
                .filter(l => /login|logout|password|user|account/i.test(l.action || ''))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 50);

            if (!logs.length) {
                container.innerHTML = '<div class="alert alert-info">No recent user activity recorded</div>';
                return;
            }

            container.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>Date/Time</th><th>User</th><th>Role</th><th>Action</th></tr></thead>
                    <tbody>
                        ${logs.map(l => `
                            <tr>
                                <td>${fmtDate(l.created_at)} ${new Date(l.created_at).toLocaleTimeString()}</td>
                                <td>${esc((() => { const u = (state.teachers || []).find(u => u.id === l.user_id); return u ? (u.last_name + ' ' + u.first_name) : (l.user_id === 0 ? 'System Admin' : '—'); })())}</td>
                                <td><span class="badge badge-info">${esc(l.user_role || '—')}</span></td>
                                <td>${esc(l.action || '—')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 50 — SETTINGS
