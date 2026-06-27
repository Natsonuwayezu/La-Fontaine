// ══════════════════════════════════════════════════════════════════════════


        /**
         * Daily attendance entry: select class and date, mark each student
         * as Present / Absent / Late / Excused. Saves in bulk.
         */
        async function renderAttendanceEntry(container) {
            if (!canRecordAttendance()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied.</div>';
                return;
            }
            let classes = (state.classes || []).filter(c => c.is_active !== false)
                .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
                const classIds = new Set(assignments.map(a => a.class_id));
                classes = classes.filter(c => classIds.has(c.id));
            }

            const today = new Date().toISOString().split('T')[0];

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📋 Daily Attendance Entry</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.navigateTo('attendance-reports')">📊 Reports</button>
                            <button class="btn btn-sm btn-outline" onclick="window.navigateTo('attendance-summary')">📈 Summary</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid" style="margin-bottom:16px">
                            <div class="form-group">
                                <label>Class *</label>
                                <select id="att-class" onchange="window.loadAttendanceStudents()">
                                    <option value="">-- Select Class --</option>
                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date *</label>
                                <input type="date" id="att-date" value="${today}" onchange="window.loadAttendanceStudents()">
                            </div>
                            <div class="form-group" style="align-self:flex-end">
                                <button class="btn btn-primary" onclick="window.loadAttendanceStudents()">📋 Load</button>
                            </div>
                        </div>
                        <div id="att-toolbar" style="display:none;margin-bottom:12px">
                            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                                <strong id="att-summary-line" style="color:var(--text-muted);font-size:13px"></strong>
                                <button class="btn btn-sm btn-success" onclick="window.markAllPresent()">✅ All Present</button>
                                <button class="btn btn-sm btn-outline" onclick="window.markAllAbsent()">❌ All Absent</button>
                                <button class="btn btn-sm btn-outline" onclick="window.exportAttendanceDay()">📥 Export</button>
                            </div>
                        </div>
                        <div id="attendance-students-container"></div>
                        <div id="att-save-row" style="display:none;margin-top:16px">
                            <button class="btn btn-success" onclick="window.saveAttendance()">💾 Save Attendance</button>
                        </div>
                    </div>
                </div>
                <div class="dash-card" style="margin-top:20px" id="att-absent-report" style="display:none">
                    <div class="dash-card-header">
                        <span class="dash-card-title">❌ Today's Absent Students</span>
                    </div>
                    <div class="dash-card-body" id="att-absent-list">
                        <p style="color:var(--text-muted)">Save attendance first to see the absent report.</p>
                    </div>
                </div>
            `;

            window.loadAttendanceStudents = loadAttendanceStudents;
            window.markAllPresent = markAllPresent;
            window.markAllAbsent = markAllAbsent;
            window.saveAttendance = saveAttendance;
            window.exportAttendanceDay = exportAttendanceDay;
            window.updateAttSummary = updateAttSummary;
        }


        /**
         * Attendance reports: per-student, per-class, date-range filters.
         * Shows absence rates and generates printable reports.
         */
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
                    .map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)}</option>`).join('')}
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


        /**
         * High-level attendance summary with charts: attendance rate by class,
         * most-absent students, daily trends.
         */
        async function renderAttendanceSummary(container) {
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
                        <span class="dash-card-title">📊 Attendance Summary</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="exportAttendanceSummary()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid" style="margin-bottom: 20px;">
                            <div class="form-group">
                                <label>Class</label>
                                <select id="summary-class" onchange="loadAttendanceSummary()">
                                    <option value="">All Classes</option>
                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Start Date</label>
                                <input type="date" id="summary-start" value="${getStartOfTerm()}">
                            </div>
                            <div class="form-group">
                                <label>End Date</label>
                                <input type="date" id="summary-end" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group" style="align-self: flex-end;">
                                <button class="btn btn-primary" onclick="loadAttendanceSummary()">🔍 Load Summary</button>
                            </div>
                        </div>
                        <div id="attendance-summary-container"></div>
                    </div>
                </div>
            `;
        }


        /**
         * Advanced attendance analytics: predictive absence, chronic absenteeism
         * flags, and parent notification lists.
         */
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



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 35 — STUDENT MANAGEMENT
