// ══════════════════════════════════════════════════════════════════════════


        /**
         * Main timetable module: view and edit the class timetable grid.
         * Click any slot to assign a subject/teacher. Detects conflicts.
         */
        async function renderTimetable(container) {
            await ensureStateLoaded();
            const user = getCurrentUser();
            const isAdmin = user?.role === 'admin';
            const isTeacher = user?.role === 'teacher';
            const isAccountant = user?.role === 'accountant';

            // Only admin can edit/manage timetable
            const canManageTimetable = isAdmin;
            const canImport = isAdmin;
            const canExport = true; // Everyone can export
            const canPrint = true; // Everyone can print

            const classOpts = state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
            const teacherOpts = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false)
                .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🕐 Timetable / Emploi du Temps</span>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                            <select id="tt-view-type" onchange="toggleTimetableView()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="class">📚 Class Timetable</option>
                                <option value="teacher">👩‍🏫 Teacher Timetable</option>
                            </select>
                            <select id="tt-class-filter" onchange="loadTimetableData()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Classes</option>
                                ${classOpts}
                            </select>
                            <select id="tt-teacher-filter" style="display:none;padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Teachers</option>
                                ${teacherOpts}
                            </select>
                            <div class="btn-group">
                                ${canManageTimetable ? `<button class="btn btn-sm btn-primary" onclick="openAddTimetableSlot()">➕ Add Slot</button>` : ''}
                                ${canImport ? `<button class="btn btn-sm btn-outline" onclick="openImportTimetableModal()">📤 Import Excel/CSV</button>` : ''}
                                ${canExport ? `<button class="btn btn-sm btn-outline" onclick="exportTimetableToExcel()">📥 Export to Excel</button>` : ''}
                                ${canExport ? `<button class="btn btn-sm btn-outline" onclick="exportTimetableTemplate()">📄 Download Template</button>` : ''}
                                ${canPrint ? `<button class="btn btn-sm btn-outline" onclick="printTimetable()">🖨️ Print</button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0;overflow-x:auto">
                        <div id="timetable-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading timetable...</p></div>
                        </div>
                    </div>
                </div>
                <div id="tt-modal-wrap"></div>
                <div id="tt-import-modal-wrap"></div>`;

            await loadTimetableData();
        }


        /**
         * View the timetable for a specific class.
         */
        async function renderClassTimetable(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const isAdmin = user?.role === 'admin';
            const classes = state.classes.filter(c => c.is_active !== false);
            const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🕐 Class Timetable</span>
                        <div class="btn-group">
                            <select id="tt-class-select" class="form-control" style="width:200px" onchange="window.loadClassTimetable()">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="window.exportClassTimetable()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="window.printClassTimetable()">🖨️ Print</button>
                            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="window.openAddTimetableSlot()">➕ Add Slot</button>` : ''}
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0;overflow-x:auto">
                        <div id="class-timetable-container">
                            <div class="loading-container"><div class="spinner"></div><p>Select a class to view timetable</p></div>
                        </div>
                    </div>
                </div>

                <div id="tt-modal-wrap"></div>
            `;

            window.loadClassTimetable = loadClassTimetable;
            window.exportClassTimetable = exportClassTimetable;
            window.printClassTimetable = printClassTimetable;
            window.openAddTimetableSlot = openAddTimetableSlot;
            window.openEditTimetableSlot = openEditTimetableSlot;
            window.deleteTimetableSlot = deleteTimetableSlot;
        }


        /**
         * View a teacher's personal timetable.
         */
        async function renderTeacherTimetable(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
            const teacherOpts = teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

            const defaultTeacherId = user.role === 'teacher' ? user.id : '';

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🕐 Teacher Timetable / Emploi du Temps</span>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                            <select id="tt-teacher-select" class="form-control" style="min-width:200px" onchange="loadTeacherTimetable()">
                                <option value="">-- Select Teacher --</option>
                                ${teacherOpts}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="exportTeacherTimetable()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="printTeacherTimetable()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0;overflow-x:auto">
                        <div id="teacher-timetable-container">
                            <div class="loading-container"><div class="spinner"></div><p>${defaultTeacherId ? 'Loading your timetable...' : 'Select a teacher to view timetable'}</p></div>
                        </div>
                    </div>
                </div>
            `;

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


        /**
         * Overview of all teachers' timetables.
         */
        async function renderStaffTimetable(container) {
            await ensureStateLoaded();
            const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
            const teacherOpts = teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">🕐 Staff Timetable / Emploi du Temps du Personnel</span>
                                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                                    <select id="stt-teacher-filter" onchange="loadStaffTimetableData()" style="padding:5px 10px;border-radius:var(--r-md);border:1px solid var(--border-medium);min-width:160px">
                                        <option value="">All Teachers</option>
                                        ${teacherOpts}
                                    </select>
                                    <button class="btn btn-sm btn-outline" onclick="exportStaffTimetable()">📥 Export</button>
                                    <button class="btn btn-sm btn-outline" onclick="printStaffTimetable()">🖨️ Print</button>
                                </div>
                            </div>
                            <div class="dash-card-body" style="padding:0;overflow-x:auto">
                                <div id="staff-timetable-wrap">
                                    <div class="loading-container"><div class="spinner"></div><p>Loading staff timetable...</p></div>
                                </div>
                            </div>
                        </div>`;

            await loadStaffTimetableData();
        }



        /**
         * View and resolve detected timetable conflicts (same teacher, same slot).
         */
        async function renderTimetableConflicts(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">⚠️ Timetable Conflict Detector</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.detectAllConflicts()">🔍 Detect Conflicts</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportConflictReport()">📥 Export Report</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-info">
                            <strong>Conflict Types:</strong>
                            <ul style="margin-top:8px; margin-left:20px">
                                <li><strong>Teacher Conflict:</strong> Same teacher assigned to two different classes at the same time</li>
                                <li><strong>Classroom Conflict:</strong> Same classroom assigned to two different classes at the same time</li>
                                <li><strong>Teacher Overload:</strong> Teacher has more than 8 periods in a single day</li>
                            </ul>
                        </div>

                        <div class="filters-bar">
                            <select id="conflict-type-filter" class="form-control" style="width:150px" onchange="window.filterConflicts()">
                                <option value="all">All Conflicts</option>
                                <option value="teacher">Teacher Conflicts</option>
                                <option value="classroom">Classroom Conflicts</option>
                                <option value="overload">Teacher Overload</option>
                            </select>
                            <span class="result-count" id="conflict-count"></span>
                        </div>

                        <div id="conflicts-container" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Click "Detect Conflicts" to start analysis</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Conflict Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="conflict-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Run detection to see stats</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.detectAllConflicts = detectAllConflicts;
            window.exportConflictReport = exportConflictReport;
            window.filterConflicts = filterConflicts;
            window.resolveConflict = resolveConflict;

            window._currentConflicts = [];
        }


        /**
         * Import a timetable from an Excel template.
         */
        async function renderTimetableImport(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📤 Import Timetable from Excel/CSV</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-info">
                            <strong>File Format Requirements:</strong><br>
                            Columns: Day, Time Slot, Class Name, Subject Name, Teacher Name, Room (optional)<br>
                            <button class="btn btn-sm btn-outline" onclick="window.downloadImportTemplate()" style="margin-top:8px">📥 Download Template</button>
                        </div>

                        <div class="form-grid" style="margin-bottom:20px">
                            <div class="form-group full">
                                <label>Import File (.xlsx, .xls, .csv)</label>
                                <input type="file" id="timetable-import-file" accept=".xlsx,.xls,.csv" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Import Action</label>
                                <select id="import-action" class="form-control">
                                    <option value="append">Append to existing slots</option>
                                    <option value="replace_class">Replace slots for matching classes</option>
                                    <option value="clear_all">Clear all slots before import</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Skip invalid rows</label>
                                <select id="skip-invalid" class="form-control">
                                    <option value="true">Yes - Skip invalid rows</option>
                                    <option value="false">No - Show errors</option>
                                </select>
                            </div>
                        </div>

                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="window.previewTimetableImport()">👁️ Preview Import</button>
                            <button class="btn btn-success" id="execute-import-btn" style="display:none" onclick="window.executeTimetableImport()">✅ Execute Import</button>
                        </div>

                        <div id="import-preview-container" style="margin-top:20px; display:none">
                            <h4>📋 Import Preview</h4>
                            <div id="import-preview-table" class="table-wrapper"></div>
                        </div>
                    </div>
                </div>
            `;

            window.downloadImportTemplate = downloadImportTemplate;
            window.previewTimetableImport = previewTimetableImport;
            window.executeTimetableImport = executeTimetableImport;
        }


        /**
         * Preview the timetable before saving.
         */
        function renderTimetablePreview() {
            const tbody = document.getElementById('import-preview-tbody');
            if (!tbody) return;

            tbody.innerHTML = _timetablePreviewData.map((row, idx) => {
                const statusBadge = row.valid
                    ? (row.warning ? '<span class="badge badge-warning">⚠️ Warning</span>' : '<span class="badge badge-success">✅ Valid</span>')
                    : '<span class="badge badge-danger">❌ Invalid</span>';

                const errorMsg = row.error || row.warning || '';

                return `<tr>
                    <td>${esc(row.day)}</td>
                    <td>${esc(row.time_slot)}</td>
                    <td>${esc(row.class_name)}</td>
                    <td>${esc(row.subject_name)}</td>
                    <td>${esc(row.teacher_name)}</td>
                    <td><input type="text" value="${esc(row.room || '')}" style="width:70px" onchange="updatePreviewRow(${idx}, 'room', this.value)"></td>
                    <td>
                        ${statusBadge}
                        ${errorMsg ? `<div style="font-size:10px;color:var(--danger)">${esc(errorMsg)}</div>` : ''}
                        <button class="btn btn-sm btn-danger" style="margin-top:4px" onclick="removePreviewRow(${idx})">🗑️</button>
                    </td>
                </tr>`;
            }).join('');

            // Update count
            const validCount = _timetablePreviewData.filter(r => r.valid).length;
            const previewSection = document.getElementById('import-preview-section');
            if (previewSection) {
                const header = previewSection.querySelector('h4');
                if (header) header.innerHTML = `📋 Import Preview (${_timetablePreviewData.length} rows, ${validCount} valid)`;
            }
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 30 — ATTENDANCE
