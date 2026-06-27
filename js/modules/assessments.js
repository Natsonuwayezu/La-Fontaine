// ══════════════════════════════════════════════════════════════════════════


        /**
         * Manage assessments: create, edit, lock, delete.
         * Filter by class, subject, term, and assessment type.
         * Shows completion status (how many marks entered vs expected).
         */
        async function renderAssessments(container) {
            await ensureStateLoaded();
            const user = getCurrentUser();
            const isAdmin = user?.role === 'admin';
            const isTeacher = user?.role === 'teacher';
            const isAccountant = user?.role === 'accountant';

            const currentTerm = state.currentTerm;
            const today = new Date();

            // Get all assessments for current term
            let allAssessments = state.assessments.filter(a => a.term_id === currentTerm?.id);

            // Filter by teacher role
            let teacherAssignments = [];
            let teacherClassIds = [];
            if (isTeacher) {
                teacherAssignments = await getAll('teacher_assignments', { teacher_id: user.id });
                teacherClassIds = [...new Set(teacherAssignments.map(a => a.class_id))];
                allAssessments = allAssessments.filter(a => teacherClassIds.includes(a.class_id));
            }

            // Categorize assessments
            const upcoming = allAssessments.filter(a => {
                if (a.is_locked) return false;
                if (!a.due_date) return false;
                const dueDate = new Date(a.due_date);
                return dueDate >= today;
            }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

            const completed = allAssessments.filter(a => {
                if (a.is_locked) return false;
                if (!a.due_date) return false;
                const dueDate = new Date(a.due_date);
                return dueDate < today;
            }).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

            const locked = state.assessments.filter(a => a.is_locked === true)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Get unique classes and subjects for filters
            const uniqueClasses = [...new Map(allAssessments.map(a => [a.class_id, getClassById(a.class_id)])).values()].filter(c => c);
            const uniqueSubjects = [...new Map(allAssessments.map(a => [a.subject_id, getSubjectById(a.subject_id)])).values()].filter(s => s);

            // Helper functions
            function getDaysLeft(dueDate) {
                if (!dueDate) return null;
                const days = Math.ceil((new Date(dueDate) - today) / (1000 * 60 * 60 * 24));
                if (days < 0) return null;
                if (days === 0) return 'Today';
                if (days === 1) return 'Tomorrow';
                return `${days} days`;
            }

            function getAssessmentAverage(assessmentId) {
                const marks = state.marks.filter(m => m.assessment_id === assessmentId);
                if (marks.length === 0) return null;
                const assessment = state.assessments.find(a => a.id === assessmentId);
                if (!assessment) return null;
                const totalPercentage = marks.reduce((sum, m) => sum + ((m.score / assessment.max_marks) * 100), 0);
                return (totalPercentage / marks.length).toFixed(1);
            }

            // Function to check if teacher can edit a specific assessment
            function canTeacherEditAssessment(assessment) {
                if (!isTeacher) return false;
                return teacherAssignments.some(a => a.class_id === assessment.class_id && a.subject_id === assessment.subject_id);
            }

            // Build upcoming assessments HTML (synchronously)
            let upcomingHtml = '';
            for (const a of upcoming) {
                const cls = getClassById(a.class_id);
                const sub = getSubjectById(a.subject_id);
                const daysLeft = getDaysLeft(a.due_date);
                const statusClass = daysLeft === 'Today' || daysLeft === 'Tomorrow' ? 'badge-warning' : 'badge-info';
                const statusText = daysLeft ? (daysLeft === 'Today' ? '⚠️ Due Today' : (daysLeft === 'Tomorrow' ? '⚠️ Due Tomorrow' : `Due in ${daysLeft}`)) : 'No due date';
                const canEdit = isAdmin || (isTeacher && canTeacherEditAssessment(a));

                upcomingHtml += `<tr>
                    <td><strong>${esc(a.assessment_name)}</strong><br><small>${esc(a.assessment_type)}</small></td>
                    <td>${esc(cls?.name || '—')}</td>
                    <td>${esc(sub?.name || '—')}</td>
                    <td>${fmtDate(a.due_date)}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewAssessmentDetails(${a.id})">👁️ View</button>
                        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="editAssessment(${a.id})">✏️ Edit</button>` : ''}
                    </td>
                </tr>`;
            }

            if (upcomingHtml === '') {
                upcomingHtml = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No upcoming assessments</td></tr>';
            }

            // Build completed assessments HTML
            let completedHtml = '';
            for (const a of completed) {
                const cls = getClassById(a.class_id);
                const sub = getSubjectById(a.subject_id);
                const avg = getAssessmentAverage(a.id);
                const canEdit = isAdmin || (isTeacher && canTeacherEditAssessment(a));

                completedHtml += `<tr>
                    <td><strong>${esc(a.assessment_name)}</strong><br><small>${esc(a.assessment_type)}</small></td>
                    <td>${esc(cls?.name || '—')}</td>
                    <td>${esc(sub?.name || '—')}</td>
                    <td>${fmtDate(a.date || a.created_at)}</td>
                    <td>${avg ? `<span class="badge ${getGradeClass(avg)}">${avg}%</span>` : '<span class="badge badge-neutral">No marks</span>'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewAssessmentDetails(${a.id})">👁️ View</button>
                        ${canEdit && !a.is_locked ? `<button class="btn btn-sm btn-warning" onclick="lockAssessment(${a.id})">🔒 Lock</button>` : ''}
                    </td>
                </tr>`;
            }

            if (completedHtml === '') {
                completedHtml = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No completed assessments</td></tr>';
            }

            // Build locked assessments HTML
            let lockedHtml = '';
            for (const a of locked) {
                const cls = getClassById(a.class_id);
                const sub = getSubjectById(a.subject_id);
                const term = getTermById(a.term_id);
                const avg = getAssessmentAverage(a.id);

                lockedHtml += `<tr>
                    <td><strong>${esc(a.assessment_name)}</strong><br><small>${esc(a.assessment_type)}</small></td>
                    <td>${esc(cls?.name || '—')}</td>
                    <td>${esc(sub?.name || '—')}</td>
                    <td>${esc(term?.name || '—')}</td>
                    <td>${avg ? `<span class="badge ${getGradeClass(avg)}">${avg}%</span>` : '<span class="badge badge-neutral">—</span>'}</td>
                    <td><button class="btn btn-sm btn-outline" onclick="viewAssessmentDetails(${a.id})">👁️ View</button></td>
                </tr>`;
            }

            if (lockedHtml === '') {
                lockedHtml = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No locked assessments</td></tr>';
            }

            const html = `
                <div class="dash-card">
                    <div class="dash-card-header" style="flex-wrap:wrap;gap:8px">
                        <span class="dash-card-title">📝 ASSESSMENTS</span>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                            <select id="assess-class-filter" onchange="filterAssessmentsTable()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Classes</option>
                                ${uniqueClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="assess-subject-filter" onchange="filterAssessmentsTable()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Subjects</option>
                                ${uniqueSubjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                            </select>
                            <select id="assess-status-filter" onchange="filterAssessmentsTable()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Status</option>
                                <option value="upcoming">Upcoming</option>
                                <option value="completed">Completed</option>
                                <option value="locked">Locked</option>
                            </select>
                            <input type="text" id="assess-search" placeholder="🔍 Search..." style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)" oninput="filterAssessmentsTable()">
                            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="openCreateAssessmentModal()">➕ Create New Assessment</button>` : ''}
                            <button class="btn btn-sm btn-outline" onclick="exportAssessmentsToExcel()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <!-- UPCOMING ASSESSMENTS SECTION -->
                        <div style="padding:16px; border-bottom:1px solid var(--border-light)">
                            <h4 style="margin-bottom:12px">📋 UPCOMING ASSESSMENTS (This Week)</h4>
                            <div class="table-wrapper">
                                <table class="data-table" id="upcoming-assessments-table">
                                    <thead>
                                        <tr>
                                            <th>Assessment</th>
                                            <th>Class</th>
                                            <th>Subject</th>
                                            <th>Due Date</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="upcoming-assessments-tbody">
                                        ${upcomingHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- COMPLETED ASSESSMENTS SECTION -->
                        <div style="padding:16px; border-bottom:1px solid var(--border-light)">
                            <h4 style="margin-bottom:12px">📋 COMPLETED ASSESSMENTS (This Term)</h4>
                            <div class="table-wrapper">
                                <table class="data-table" id="completed-assessments-table">
                                    <thead>
                                        <tr>
                                            <th>Assessment</th>
                                            <th>Class</th>
                                            <th>Subject</th>
                                            <th>Date</th>
                                            <th>Avg %</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="completed-assessments-tbody">
                                        ${completedHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- LOCKED ASSESSMENTS SECTION -->
                        <div style="padding:16px">
                            <h4 style="margin-bottom:12px">📋 LOCKED ASSESSMENTS (Previous Terms)</h4>
                            <div class="table-wrapper">
                                <table class="data-table" id="locked-assessments-table">
                                    <thead>
                                        <tr>
                                            <th>Assessment</th>
                                            <th>Class</th>
                                            <th>Subject</th>
                                            <th>Term</th>
                                            <th>Avg %</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="locked-assessments-tbody">
                                        ${lockedHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Store filter function globally
            window.filterAssessmentsTable = function () {
                const classFilter = document.getElementById('assess-class-filter')?.value;
                const subjectFilter = document.getElementById('assess-subject-filter')?.value;
                const statusFilter = document.getElementById('assess-status-filter')?.value;
                const search = document.getElementById('assess-search')?.value.toLowerCase();

                const upcomingRows = document.querySelectorAll('#upcoming-assessments-tbody tr');
                const completedRows = document.querySelectorAll('#completed-assessments-tbody tr');
                const lockedRows = document.querySelectorAll('#locked-assessments-tbody tr');

                const filterRow = (row, status) => {
                    const text = row.innerText.toLowerCase();
                    let classMatch = true;
                    let subjectMatch = true;

                    if (classFilter) {
                        const classCell = row.cells[1];
                        if (classCell) {
                            const className = classCell.innerText.toLowerCase();
                            const targetClass = getClassById(parseInt(classFilter));
                            classMatch = !classFilter || (targetClass && className.includes(targetClass.name.toLowerCase()));
                        }
                    }

                    if (subjectFilter) {
                        const subjectCell = row.cells[2];
                        if (subjectCell) {
                            const subjectName = subjectCell.innerText.toLowerCase();
                            const targetSubject = getSubjectById(parseInt(subjectFilter));
                            subjectMatch = !subjectFilter || (targetSubject && subjectName.includes(targetSubject.name.toLowerCase()));
                        }
                    }

                    const searchMatch = !search || text.includes(search);
                    const statusMatch = !statusFilter || statusFilter === 'all' || status === statusFilter;

                    row.style.display = (classMatch && subjectMatch && searchMatch && statusMatch) ? '' : 'none';
                };

                if (upcomingRows) upcomingRows.forEach(row => filterRow(row, 'upcoming'));
                if (completedRows) completedRows.forEach(row => filterRow(row, 'completed'));
                if (lockedRows) lockedRows.forEach(row => filterRow(row, 'locked'));
            };
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 24 — ACADEMICS: REPORT CARDS, GRADES & RANKINGS
