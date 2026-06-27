// ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 35.1 — Student List & Enrolment
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Full paginated student list with search, class filter, status filter.
         * Quick actions: view details, view fees, edit, archive.
         */
        async function renderStudentList(container) {
            await ensureStateLoaded();

            const user = getCurrentUser();
            const isAdminUser = isAdmin();
            const isAccountantUser = isAccountant();
            const isTeacherUser = isTeacher();

            // Determine which columns/actions to show based on role
            const canEnroll = isAdminUser;
            const canImport = isAdminUser;
            const canExport = true;
            const canRecordPayment = (isAdminUser || isAccountantUser);
            const canEdit = (isAdminUser || isAccountantUser);
            const canDelete = isAdminUser;

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">👥 Students</span>
                                <div class="btn-group">
                                    ${canEnroll ? `<button class="btn btn-sm btn-primary" onclick="navigateTo('enroll-student')">➕ Enroll Student</button>` : ''}
                                    ${canImport ? `<button class="btn btn-sm btn-outline" onclick="navigateTo('bulk-import')">📤 Import Excel</button>` : ''}
                                    ${canExport ? `<button class="btn btn-sm btn-outline" onclick="window.exportStudentsData()">📥 Export</button>` : ''}
                                </div>
                            </div>
                            <div class="dash-card-body">
                                <div class="filters-bar">
                                    <select id="sf-class" onchange="window.filterStudentList()">
                                        <option value="">All Classes</option>
                                        ${(state.classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                    </select>
                                    <select id="sf-status" onchange="window.filterStudentList()">
                                        <option value="">All Status</option>
                                        <option>Active</option>
                                        <option>Inactive</option>
                                        <option>Transferred</option>
                                        <option>Graduated</option>
                                    </select>
                                    <input type="text" class="flex-1" id="sf-search" placeholder="🔍 Search name or code..." oninput="window.filterStudentList()">
                                    <span class="result-count" id="sf-count"></span>
                                </div>
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Full Name</th>
                                                <th>Class</th>
                                                <th>Gender</th>
                                                <th>Guardian</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="students-tbody"></tbody>
                                    </table>
                                </div>
                                <div class="pagination" id="students-pagination"></div>
                            </div>
                        </div>
                    `;

            window.filterStudentList = filterStudentList;
            window.renderStudentTable = renderStudentTable;
            window.exportStudentsData = exportStudentsData;
            window.viewStudentDetail = viewStudentDetail;
            window.openEditStudentModal = openEditStudentModal;
            window.submitEditStudent = submitEditStudent;
            window.deleteStudentPrompt = deleteStudentPrompt;

            filterStudentList();
        }


        /**
         * Enroll a new student: personal details, guardian info, class assignment.
         * Auto-generates student code. Optionally assigns fee structure.
         */
        async function renderEnrollStudent(el) {
            await ensureStateLoaded();

            el.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">➕ Enroll New Student</span>
                        <button class="btn btn-sm btn-outline" onclick="navigateTo('student-list')">← Back</button>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-info">Fill in the student information below. Fields marked * are required.</div>
                        <div id="enroll-error" class="alert alert-danger" style="display:none"></div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>First Name *</label>
                                <input type="text" id="en-first" placeholder="First name">
                            </div>
                            <div class="form-group">
                                <label>Last Name *</label>
                                <input type="text" id="en-last" placeholder="Last name">
                            </div>
                            <div class="form-group">
                                <label>Class *</label>
                                <select id="en-class" onchange="previewFeesForNewStudent()">
                                    <option value="">— Select class —</option>
                                    ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Gender</label>
                                <select id="en-gender">
                                    <option value="">— Select —</option>
                                    <option>Male</option>
                                    <option>Female</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date of Birth</label>
                                <input type="date" id="en-dob">
                            </div>
                            <div class="form-group">
                                <label>Nationality</label>
                                <input type="text" id="en-nationality" placeholder="e.g. Rwandan">
                            </div>
                            <div class="form-group">
                                <label>Guardian Name *</label>
                                <input type="text" id="en-guardian" placeholder="Parent/guardian full name">
                            </div>
                            <div class="form-group">
                                <label>Guardian Phone</label>
                                <input type="tel" id="en-phone" placeholder="+250 7xx xxx xxx">
                            </div>
                            <div class="form-group">
                                <label>Guardian Email</label>
                                <input type="email" id="en-email" placeholder="guardian@email.com">
                            </div>
                            <div class="form-group">
                                <label>Enrollment Date</label>
                                <input type="date" id="en-date" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group full">
                                <label>Notes</label>
                                <textarea id="en-notes" rows="2" placeholder="Optional notes..."></textarea>
                            </div>
                        </div>

                        <!-- FEE CHECKBOX SELECTOR -->
                        <div id="fee-preview-section" style="display:none;margin-top:20px;border:1px solid var(--border-medium);border-radius:var(--r-lg);overflow:hidden">
                            <div style="background:var(--bg-tertiary);padding:12px 16px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between">
                                <strong>💰 Fees to Apply on Enrollment</strong>
                                <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:600;cursor:pointer">
                                    <input type="checkbox" id="enroll-fee-all" onchange="document.querySelectorAll('.enroll-fee-cb').forEach(c=>c.checked=this.checked);updateEnrollFeeTotal()"> Select All
                                </label>
                            </div>
                            <div id="fee-preview-list" style="padding:0 16px"></div>
                            <div id="fee-preview-total" style="padding:10px 16px;font-weight:700;background:var(--bg-tertiary);border-top:1px solid var(--border-light)"></div>
                            <div style="padding:8px 16px 12px;font-size:.78rem;color:var(--text-muted)">✅ Only checked fees will be applied. Uncheck any you don't want to apply now.</div>
                        </div>

                        <div class="btn-group" style="margin-top:var(--lg)">
                            <button class="btn btn-success" onclick="submitEnrollStudent()">✅ Enroll Student</button>
                            <button class="btn btn-outline" onclick="navigateTo('student-list')">Cancel</button>
                        </div>
                    </div>
                </div>
            `;

            // Register preview function
            window.previewFeesForNewStudent = function () {
                const classId = document.getElementById('en-class')?.value;
                const section = document.getElementById('fee-preview-section');
                const listEl = document.getElementById('fee-preview-list');
                const totEl = document.getElementById('fee-preview-total');
                if (!classId) { section.style.display = 'none'; return; }

                const activeCategories = state.feeCategories.filter(c => c.is_active !== false);
                const fees = [];
                for (const cat of activeCategories) {
                    let amount = cat.amount || 0;
                    const override = state.feeAmounts.find(fa =>
                        fa.fee_category_id === cat.id && fa.class_id == classId &&
                        fa.academic_year_id === state.currentAcadYear?.id
                    );
                    if (override) amount = override.amount;
                    if (amount > 0) fees.push({ id: cat.id, name: cat.name, amount });
                }

                if (!fees.length) { section.style.display = 'none'; return; }

                listEl.innerHTML = fees.map(f => `
                            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)">
                                <input type="checkbox" class="enroll-fee-cb" value="${f.id}" data-amount="${f.amount}" checked onchange="updateEnrollFeeTotal()" style="width:16px;height:16px;flex-shrink:0">
                                <span style="flex:1">${esc(f.name)}</span>
                                <span style="font-weight:600;color:var(--role-secondary)">${fmtCurrency(f.amount)}</span>
                            </div>`).join('');

                document.getElementById('enroll-fee-all').checked = true;
                updateEnrollFeeTotal();
                section.style.display = 'block';
            };

            window.updateEnrollFeeTotal = function () {
                const checked = [...document.querySelectorAll('.enroll-fee-cb:checked')];
                const total = checked.reduce((s, cb) => s + parseFloat(cb.dataset.amount || 0), 0);
                const totEl = document.getElementById('fee-preview-total');
                if (totEl) totEl.innerHTML = `<div style="display:flex;justify-content:space-between"><span>TOTAL TO APPLY (${checked.length} fee${checked.length !== 1 ? 's' : ''})</span><span style="color:var(--role-secondary)">${fmtCurrency(total)}</span></div>`;
            };
        }


        /**
         * Full student profile: personal info, academic history, fee balance,
         * attendance record, family links. Edit and archive actions.
         */
        async function renderStudentDetails(el) {
            const id = parseInt(localStorage.getItem('elf_view_student'));
            const s = id ? getStudentById(id) : null;
            // TAB HEADERS - Role-based visibility
            const userRole = state.currentUser?.role;
            const isAdmin = userRole === 'admin';
            const isAccountant = userRole === 'accountant';
            const isTeacher = userRole === 'teacher';

            if (!s) {
                el.innerHTML = `
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <span class="dash-card-title">ℹ️ Student Details</span>
                        </div>
                        <div class="dash-card-body">
                            <p>No student selected. Go to <a href="#" onclick="navigateTo('student-list')">Student List</a> and click 👁️.</p>
                        </div>
                    </div>`;
                return;
            }

            _currentStudentId = s.id;
            _activeStudentTab = 'info';
            const cls = getClassById(s.class_id);
            const age = s.date_of_birth ? Math.floor((new Date() - new Date(s.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25)) : null;

            // Render the 5-tab layout
            el.innerHTML = `
                <div class="btn-group" style="margin-bottom:var(--md)">
                    <button class="btn btn-outline" onclick="navigateTo('student-list')">← Back to List</button>
                    ${state.currentUser?.role === 'admin' ? `<button class="btn btn-primary" onclick="openEditStudentModal(${s.id})">✏️ Edit</button>` : ''}
                </div>

                <!-- TAB HEADERS - Role-based visibility -->
        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
            <button class="tab-btn ${_activeStudentTab === 'info' ? 'active' : ''}" onclick="switchStudentTab('info', ${s.id}, event)" style="padding:10px 20px; background:none; border:none; cursor:pointer; font-weight:600; border-bottom:2px solid transparent; ${_activeStudentTab === 'info' ? 'border-bottom:2px solid var(--role-primary); color:var(--role-primary)' : 'color:var(--text-muted)'}">
                📋 Info
            </button>
            ${state.currentUser?.role !== 'teacher' ? `<button class="tab-btn ${_activeStudentTab === 'fees' ? 'active' : ''}" onclick="switchStudentTab('fees', ${s.id}, event)" style="padding:10px 20px; background:none; border:none; cursor:pointer; font-weight:600; border-bottom:2px solid transparent; ${_activeStudentTab === 'fees' ? 'border-bottom:2px solid var(--role-primary); color:var(--role-primary)' : 'color:var(--text-muted)'}">
                💰 Fees
            </button>` : ''}
            ${state.currentUser?.role !== 'accountant' ? `<button class="tab-btn ${_activeStudentTab === 'academics' ? 'active' : ''}" onclick="switchStudentTab('academics', ${s.id}, event)" style="padding:10px 20px; background:none; border:none; cursor:pointer; font-weight:600; border-bottom:2px solid transparent; ${_activeStudentTab === 'academics' ? 'border-bottom:2px solid var(--role-primary); color:var(--role-primary)' : 'color:var(--text-muted)'}">
                📊 Academics
            </button>` : ''}
            <button class="tab-btn ${_activeStudentTab === 'family' ? 'active' : ''}" onclick="switchStudentTab('family', ${s.id}, event)" style="padding:10px 20px; background:none; border:none; cursor:pointer; font-weight:600; border-bottom:2px solid transparent; ${_activeStudentTab === 'family' ? 'border-bottom:2px solid var(--role-primary); color:var(--role-primary)' : 'color:var(--text-muted)'}">
                👨‍👩‍👧 Family
            </button>
            <button class="tab-btn ${_activeStudentTab === 'history' ? 'active' : ''}" onclick="switchStudentTab('history', ${s.id}, event)" style="padding:10px 20px; background:none; border:none; cursor:pointer; font-weight:600; border-bottom:2px solid transparent; ${_activeStudentTab === 'history' ? 'border-bottom:2px solid var(--role-primary); color:var(--role-primary)' : 'color:var(--text-muted)'}">
                📜 History
            </button>
        </div>

                <!-- TAB CONTENT CONTAINER -->
                <div id="student-tab-content">
                    <div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>
                </div>
            `;

            // Load the active tab content
            await loadStudentTabContent(_activeStudentTab, s.id);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 35.2 — Student Archive & Promotion
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Archived students list with restore and permanent delete options.
         */
        async function renderStudentArchive(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const archived = (state.students || []).filter(s => s.is_deleted || s.status === 'Graduated' || s.status ===
                'Transferred');
            const inactiveStudents = (state.students || []).filter(s => s.status === 'Inactive' && !s.is_deleted);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const autoArchiveCandidates = inactiveStudents.filter(s => new Date(s.updated_at || s.created_at) < oneYearAgo); let
                archivedHtml = ''; if (archived.length) {
                    for (const student of archived) {
                        const cls = getClassById(student.class_id);
                        archivedHtml += ` <tr>
            <td><strong>${esc(student.first_name + ' ' + student.last_name)}</strong></td>
            <td><span class="badge badge-neutral">${esc(student.status)}</span></td>
            <td>${esc(cls?.name || '—')}</td>
            <td>${fmtDate(student.updated_at || student.created_at)}</span>
            <td>
                <button class="btn btn-sm btn-success" onclick="window.restoreStudent(${student.id})">♻️ Restore</button>
                <button class="btn btn-sm btn-danger" onclick="window.permanentlyDeleteStudent(${student.id})">🗑️ Permanently
                    Delete</button>
                </span>
                </tr>
                `;
                    }
                } else {
                archivedHtml = `<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">Archive is empty</span></tr>`;
            }

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">📦 Student Archive</span>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-warning" onclick="window.runAutoArchive()">🔄 Run Auto-Archive
                                            Now</button>
                                    </div>
                                </div>
                                <div class="dash-card-body">
                                    ${autoArchiveCandidates.length > 0 ? `
                            <div class="alert alert-info">
                                ⚠️ ${autoArchiveCandidates.length} students have been inactive for over 1 year and are ready for
                                archiving.
                                <button class="btn btn-sm btn-primary" onclick="window.runAutoArchive()">Archive Now</button>
                            </div>
                            ` : ''}
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Status</th>
                                                    <th>Class (Last)</th>
                                                    <th>Last Active</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>${archivedHtml}</tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            `;

            window.restoreStudent = restoreStudent;
            window.permanentlyDeleteStudent = permanentlyDeleteStudent;
            window.runAutoArchive = runAutoArchive;
        }


        /**
         * End-of-year class promotion: review all students, set promote/retain/graduate.
         * Applies class changes in bulk.
         */
        async function renderStudentPromotion(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const currentYear = (state.academicYears || []).find(y => y.is_active);
            promotionData = [];

            for (const rule of PROMOTION_RULES) {
                const fromClass = (state.classes || []).find(c => c.name === rule.from);
                if (fromClass) {
                    const students = (state.students || []).filter(s => s.class_id === fromClass.id && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
                    const toClass = rule.to === 'GRADUATED' ? null : (state.classes || []).find(c => c.name === rule.to);
                    promotionData.push({ from_class: rule.from, from_id: fromClass.id, to_class: rule.to, to_id: toClass?.id, students: students });
                }
            }

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <h3><span>🚀</span> Student Promotion Wizard</h3>
                                </div>
                                <div class="dash-card-body">
                                    <div class="alert alert-info"><strong>📅 Promotion Details:</strong> From: <strong>${currentYear?.name || 'Current Year'}</strong> → To: <strong>Next Academic Year</strong><br>Promotion Date: <strong>${new Date().toLocaleDateString()}</strong></div>
                                    <div id="promotion-classes-container">
                                        ${promotionData.map(p => `
                                <div class="dash-card" style="margin-bottom:16px">
                                    <div class="dash-card-header" style="cursor:pointer" onclick="togglePromotionClass('class-${p.from_id}')">
                                        <span><strong>${esc(p.from_class)}</strong> → ${p.to_class === 'GRADUATED' ? '<span class="badge badge-warning">🎓 GRADUATED</span>' : esc(p.to_class)}</span>
                                        <span>${p.students.length} students <span class="nav-section-arrow">▾</span></span>
                                    </div>
                                    <div id="class-${p.from_id}" class="promotion-class-content" style="display:none;padding:16px">
                                        <div class="alert alert-warning" style="margin-bottom:12px">✅ Checked students will be promoted. Uncheck to keep in same class (repeat).</div>
                                        <div class="table-wrapper">
                                            <table class="data-table">
                                                <thead>
                                                    <tr><th><input type="checkbox" id="select-all-${p.from_id}" onchange="toggleSelectAll(${p.from_id})"> Select All</th><th>Student Name</th><th>Student Code</th><th>Current Class</th><th>Promoting To</th><th>Status</th></tr>
                                                </thead>
                                                <tbody>${p.students.map(s => `
                                                    <tr><td><input type="checkbox" class="student-promo-${p.from_id}" data-student-id="${s.id}" data-from="${p.from_id}" data-to="${p.to_id || ''}" data-to-name="${p.to_class}"></td>
                                                    <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                                                    <td>${esc(s.student_code || '—')}</td>
                                                    <td>${esc(p.from_class)}</td>
                                                    <td>${p.to_class === 'GRADUATED' ? '🎓 Graduated' : esc(p.to_class)}</td>
                                                    <td><span class="badge badge-success">Ready</span></td>
                                                </tr>`).join('')}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                                    </div>
                                    <div class="form-group" style="margin-top:20px"><label>Promotion Batch Name</label><input type="text" id="promotion-batch-name-full" class="form-control" value="End of Year ${currentYear?.name || ''} Promotion"></div>
                                    <div class="btn-group"><button class="btn btn-outline" onclick="previewFullPromotion()">👁️ Preview Selected</button><button class="btn btn-warning" onclick="executeFullPromotion()">✅ Execute Promotion</button></div>
                                </div>
                            </div>
                            <div id="promotion-history-full" class="dash-card" style="margin-top:20px">
                                <div class="dash-card-header"><h3>📜 Promotion History</h3></div>
                                <div class="dash-card-body"><div id="promotion-history-list-full">Loading...</div></div>
                            </div>
                            `;

            await loadFullPromotionHistory();
        }

        /**
         * Loads and renders past promotion batches into #promotion-history-list-full.
         * Reads from the optional 'promotions' table (handled gracefully if it
         * doesn't exist yet — executeFullPromotion() currently only updates
         * students directly, so this list may be empty until promotion-batch
         * logging is added to the write side).
         */
        async function loadFullPromotionHistory() {
            const container = document.getElementById('promotion-history-list-full');
            if (!container) return;
            try {
                const history = await getAll('promotions');
                if (!history || !history.length) {
                    container.innerHTML = '<div class="alert alert-info">No promotion batches recorded yet.</div>';
                    return;
                }
                const sorted = [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                container.innerHTML = `
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Batch Name</th><th>From</th><th>To</th><th>Students</th></tr></thead>
                        <tbody>
                            ${sorted.map(p => `
                                <tr>
                                    <td>${fmtDate(p.created_at)}</td>
                                    <td>${esc(p.batch_name || '—')}</td>
                                    <td>${esc(p.from_class || '—')}</td>
                                    <td>${esc(p.to_class || '—')}</td>
                                    <td>${p.student_count ?? '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } catch (e) {
                container.innerHTML = '<div class="alert alert-info">No promotion batches recorded yet.</div>';
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 35.3 — Bulk Operations
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Import students from an Excel template.
         * Shows a preview before confirming the import.
         */


        /**
         * Export all or filtered students to Excel with all fields.
         */

        async function renderBulkImport(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header"><span class="dash-card-title">📤 Bulk Import Students</span></div>
                                <div class="dash-card-body">
                                    <div class="alert alert-info">Upload an Excel file (.xlsx) with columns: <strong>First Name, Last Name, Class, Gender, Guardian Name, Guardian Phone</strong>.</div>
                                    <div style="margin:var(--lg) 0;display:flex;gap:var(--md);flex-wrap:wrap;align-items:center">
                                        <button class="btn btn-outline" onclick="downloadImportTemplate()">📥 Download Template</button>
                                        <input type="file" id="bulk-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="previewBulkImport()">
                                            <button class="btn btn-primary" onclick="document.getElementById('bulk-file').click()">📂 Choose File</button>
                                    </div>
                                    <div id="bulk-preview"></div>
                                </div>
                            </div>
                            `;
        }

        async function renderBulkExport(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">📥 Bulk Export Data</span>
                                </div>
                                <div class="dash-card-body">
                                    <div class="form-grid">
                                        <div class="form-group">
                                            <label>Export Type</label>
                                            <select id="bulk-export-type" onchange="window.updateBulkExportOptions()">
                                                <option value="students">Students</option>
                                                <option value="teachers">Teachers</option>
                                                <option value="marks">Marks</option>
                                                <option value="payments">Payments</option>
                                                <option value="assessments">Assessments</option>
                                                <option value="fee_structure">Fee Structure</option>
                                            </select>
                                        </div>
                                        <div class="form-group" id="bulk-export-class-group" style="display:none">
                                            <label>Class</label>
                                            <select id="bulk-export-class">
                                                <option value="">All Classes</option>
                                                ${(state.classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>
                                            `).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group" id="bulk-export-term-group" style="display:none">
                                            <label>Term</label>
                                            <select id="bulk-export-term">
                                                <option value="">All Terms</option>
                                                ${(state.terms || []).map(t => `<option value="${t.id}">${esc(t.name)}</option>
                                            `).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Format</label>
                                            <select id="bulk-export-format">
                                                <option value="excel">Excel (.xlsx)</option>
                                                <option value="csv">CSV (.csv)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="btn-group">
                                        <button class="btn btn-primary" onclick="window.executeBulkExport()">📥 Export Data</button>
                                        <button class="btn btn-outline" onclick="window.resetBulkExportFilters()">🔄 Reset
                                            Filters</button>
                                    </div>
                                    <div id="bulk-export-preview" style="margin-top:20px;display:none" class="alert alert-info">
                                    </div>
                                </div>
                            </div>
                            `;

            window.updateBulkExportOptions = updateBulkExportOptions;
            window.executeBulkExport = executeBulkExport;
            window.resetBulkExportFilters = resetBulkExportFilters;
        }


        /**
         * Bulk financial actions: assign fees, waive fees, record payments
         * for multiple students at once.
         */
        async function renderBulkFinanceActions(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot access financial functions.</div>';
                return;
            }

            const classes = state.classes.filter(c => c.is_active !== false);
            const categories = state.feeCategories.filter(c => c.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">💰 Bulk Finance Actions</span>
                                </div>
                                <div class="dash-card-body">
                                    <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                                        <button class="tab-btn active" onclick="window.showBulkTab('payments', event)">💸 Bulk Payments</button>
                                        <button class="tab-btn" onclick="window.showBulkTab('fees', event)">🏷️ Bulk Apply Fees</button>
                                        <button class="tab-btn" onclick="window.showBulkTab('adjustments', event)">⚙️ Bulk Adjustments</button>
                                        <button class="tab-btn" onclick="window.showBulkTab('waivers', event)">🎁 Bulk Waivers</button>
                                    </div>

                                    <div id="bulk-payments-tab">
                                        <div class="alert alert-info">Record payments for multiple students at once. Upload Excel or enter manually.</div>
                                        <div class="form-grid" style="margin-bottom:16px">
                                            <div class="form-group">
                                                <label>Select Class</label>
                                                <select id="bulk-pay-class" class="form-control" onchange="window.loadBulkPayStudents()">
                                                    <option value="">-- Select Class --</option>
                                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Payment Date</label>
                                                <input type="date" id="bulk-pay-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                                            </div>
                                            <div class="form-group">
                                                <label>Payment Method</label>
                                                <select id="bulk-pay-method" class="form-control">
                                                    <option value="Cash">💵 Cash</option>
                                                    <option value="Mobile-Money">📱 Mobile-Money</option>
                                                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                                                    <option value="Cheque">📄 Cheque</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="btn-group" style="margin-bottom:16px">
                                            <button class="btn btn-sm btn-outline" onclick="window.downloadBulkPaymentTemplate()">📥 Download Template</button>
                                            <button class="btn btn-sm btn-outline" onclick="window.importBulkPaymentExcel()">📤 Import from Excel</button>
                                            <button class="btn btn-sm btn-primary" onclick="window.selectAllBulkPay(true)">✓ Select All</button>
                                            <button class="btn btn-sm btn-outline" onclick="window.selectAllBulkPay(false)">✗ Deselect All</button>
                                        </div>
                                        <div id="bulk-pay-students-list" style="max-height:500px;overflow-y:auto">
                                            <div class="loading-container"><div class="spinner"></div><p>Select a class to load students</p></div>
                                        </div>
                                        <div class="btn-group" style="margin-top:16px">
                                            <button class="btn btn-success" onclick="window.processBulkPayments()">💰 Process Bulk Payments</button>
                                        </div>
                                    </div>

                                    <div id="bulk-fees-tab" style="display:none">
                                        <div class="alert alert-info">Apply a fee to multiple students at once.</div>
                                        <div class="form-grid" style="margin-bottom:16px">
                                            <div class="form-group">
                                                <label>Select Class</label>
                                                <select id="bulk-fee-class" class="form-control">
                                                    <option value="">-- Select Class --</option>
                                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Fee Category</label>
                                                <select id="bulk-fee-category" class="form-control">
                                                    <option value="">-- Select Fee --</option>
                                                    ${categories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Amount Override (RWF)</label>
                                                <input type="number" id="bulk-fee-amount" class="form-control" placeholder="Leave empty for default" min="0">
                                            </div>
                                            <div class="form-group">
                                                <label>Due Date</label>
                                                <input type="date" id="bulk-fee-due" class="form-control">
                                            </div>
                                            <div class="form-group">
                                                <label>Term</label>
                                                <select id="bulk-fee-term" class="form-control">
                                                    ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                        </div>
                                        <div class="btn-group">
                                            <button class="btn btn-warning" onclick="window.applyBulkFeeToClass()">🏷️ Apply Fee to Class</button>
                                            <button class="btn btn-outline" onclick="window.previewBulkFee()">👁️ Preview</button>
                                        </div>
                                        <div id="bulk-fee-preview" style="margin-top:16px;display:none"></div>
                                    </div>

                                    <div id="bulk-adjustments-tab" style="display:none">
                                        <div class="alert alert-warning">⚠️ Bulk adjustments will modify student balances. Use with caution.</div>
                                        <div class="form-grid" style="margin-bottom:16px">
                                            <div class="form-group">
                                                <label>Select Class</label>
                                                <select id="bulk-adj-class" class="form-control">
                                                    <option value="">-- Select Class --</option>
                                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Adjustment Type</label>
                                                <select id="bulk-adj-type" class="form-control">
                                                    <option value="add_fee">➕ Add Fee (Increase Balance)</option>
                                                    <option value="add_payment">💰 Add Payment (Decrease Balance)</option>
                                                    <option value="add_credit">⭐ Add Credit</option>
                                                    <option value="waive_fee">🎁 Waive Fee</option>
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Amount (RWF)</label>
                                                <input type="number" id="bulk-adj-amount" class="form-control" min="0" step="1000">
                                            </div>
                                            <div class="form-group full">
                                                <label>Reason</label>
                                                <input type="text" id="bulk-adj-reason" class="form-control" placeholder="Reason for bulk adjustment">
                                            </div>
                                        </div>
                                        <div class="btn-group">
                                            <button class="btn btn-warning" onclick="window.previewBulkAdjustment()">👁️ Preview</button>
                                            <button class="btn btn-danger" onclick="window.executeBulkAdjustment()">⚙️ Apply Adjustment</button>
                                        </div>
                                        <div id="bulk-adj-preview" style="margin-top:16px;display:none"></div>
                                    </div>

                                    <div id="bulk-waivers-tab" style="display:none">
                                        <div class="alert alert-info">Apply fee waivers to multiple students.</div>
                                        <div class="form-grid" style="margin-bottom:16px">
                                            <div class="form-group">
                                                <label>Select Class</label>
                                                <select id="bulk-waive-class" class="form-control">
                                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Fee Category</label>
                                                <select id="bulk-waive-category" class="form-control">
                                                    ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Waiver Amount (RWF)</label>
                                                <input type="number" id="bulk-waive-amount" class="form-control" min="0" step="1000">
                                            </div>
                                            <div class="form-group full">
                                                <label>Reason</label>
                                                <input type="text" id="bulk-waive-reason" class="form-control" placeholder="e.g., Sibling discount, Scholarship">
                                            </div>
                                        </div>
                                        <div class="btn-group">
                                            <button class="btn btn-warning" onclick="window.previewBulkWaiver()">👁️ Preview</button>
                                            <button class="btn btn-success" onclick="window.applyBulkWaiver()">🎁 Apply Waivers</button>
                                        </div>
                                        <div id="bulk-waive-preview" style="margin-top:16px;display:none"></div>
                                    </div>
                                </div>
                            </div>
                            `;

            // Register functions
            window.showBulkTab = showBulkTab;
            window.loadBulkPayStudents = loadBulkPayStudents;
            window.downloadBulkPaymentTemplate = downloadBulkPaymentTemplate;
            window.importBulkPaymentExcel = importBulkPaymentExcel;
            window.selectAllBulkPay = selectAllBulkPay;
            window.processBulkPayments = processBulkPayments;
            window.applyBulkFeeToClass = applyBulkFeeToClass;
            window.previewBulkFee = previewBulkFee;
            window.previewBulkAdjustment = previewBulkAdjustment;
            window.executeBulkAdjustment = executeBulkAdjustment;
            window.previewBulkWaiver = previewBulkWaiver;
            window.applyBulkWaiver = applyBulkWaiver;
        }


        /**
         * Bulk student actions: promote, archive, export selected students.
         */
        async function renderBulkStudentActions(container) {
            // Bulk actions on multiple students (promote, archive, export)
            await ensureStateLoaded();
            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">⚡ Bulk Student Actions</span>
                                </div>
                                <div class="dash-card-body">
                                    <div class="alert alert-info">
                                        Select an action to apply to multiple students at once.
                                    </div>
                                    <div class="btn-group" style="flex-wrap:wrap;gap:12px">
                                        <button class="btn btn-primary" onclick="navigateTo('student-promotion')">🎓 Promote Students</button>
                                        <button class="btn btn-warning" onclick="navigateTo('student-archive')">📦 Archive Students</button>
                                        <button class="btn btn-outline" onclick="navigateTo('bulk-export')">📥 Export All</button>
                                        <button class="btn btn-outline" onclick="navigateTo('bulk-import')">📤 Import Students</button>
                                    </div>
                                </div>
                            </div>`;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 35.4 — Student Statements
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Full financial statement for one student: all fees, payments,
         * balance history. Printable and exportable.
         */
        async function renderStudentStatements(container) {
            if (isTeacher()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view statements.</div>';
                return;
            }

            await ensureStateLoaded();

            const students = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));

            container.innerHTML = `
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">📄 Student Fee Statements</span>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-outline" onclick="window.printStudentStatement()">🖨️ Print</button>
                                        <button class="btn btn-sm btn-outline" onclick="window.exportStatementToExcel()">📥 Export</button>
                                    </div>
                                </div>
                                <div class="dash-card-body">
                                    <div class="form-grid" style="margin-bottom:20px">
                                        <div class="form-group">
                                            <label>Select Student</label>
                                            <select id="statement-student" class="form-control" onchange="window.generateStudentStatement()">
                                                <option value="">-- Select Student --</option>
                                                ${students.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Statement Type</label>
                                            <select id="statement-type" class="form-control" onchange="window.generateStudentStatement()">
                                                <option value="full">Full Statement (All Terms)</option>
                                                <option value="current">Current Term Only</option>
                                                <option value="outstanding">Outstanding Balance Only</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div id="statement-content" class="statement-container" style="background:white; color:black; padding:20px; border-radius:8px; min-height:400px">
                                        <div class="alert alert-info">Select a student to generate statement</div>
                                    </div>
                                </div>
                            </div>
                            `;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 36 — STUDENT FEES & FAMILY LINKING
