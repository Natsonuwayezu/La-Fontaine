// js/modules/fee-structure.js
// Source lines: 19254–19803 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * Manage fee categories and per-class fee amounts.
         * Add, edit, delete fee categories and set amounts per class/term.
         */
        async function renderFeeStructure(container) {
            await ensureStateLoaded();

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🏷️ Fee Structure</span>
                        ${state.currentUser?.role !== 'teacher' ? `<button class="btn btn-sm btn-primary" onclick="window.openAddFeeCategory()">➕ Add Category</button>` : ''}
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th>Reset Freq</th>
                                        <th>Status</th>
                                        ${state.currentUser?.role !== 'teacher' ? '<th>Actions</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${state.feeCategories.length ? state.feeCategories.map(f => `
                                        <tr>
                                            <td><strong>${esc(f.name)}</strong></td>
                                            <td>${esc(f.fee_type || '—')}</td>
                                            <td>${esc(f.description || '—')}</td>
                                            <td><span class="badge badge-info">${f.reset_frequency || 'one_time'}</span></td>
                                            <td><span class="badge ${f.is_active !== false ? 'badge-success' : 'badge-neutral'}">${f.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                            ${state.currentUser?.role !== 'teacher' ? `
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.openEditFeeCategory(${f.id})" style="margin-right:4px">✏️ Edit</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteFeeCategory(${f.id},'${esc(f.name)}')">🗑️ Delete</button>
                                                </td>
                                            ` : ''}
                                        </tr>
                                    `).join('') : `<tr><td colspan="${state.currentUser?.role !== 'teacher' ? '6' : '5'}" style="text-align:center;padding:var(--lg)">No fee categories yet</span>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">💰 Fee Amounts by Class</span>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                            <select id="fa-year" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                ${state.academicYears.map(y => `<option value="${y.id}" ${y.id === state.currentAcadYear?.id ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                            </select>
                            <select id="fa-class-filter" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Classes</option>
                                ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="fa-category-filter" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Categories</option>
                                ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="window.exportFeeAmounts()">📥 Export</button>
                            ${state.currentUser?.role !== 'teacher' ? `<button class="btn btn-sm btn-primary" onclick="window.openAddFeeAmount()">➕ Add Amount</button>` : ''}
                        </div>
                    </div>
                    <div id="fee-amounts-container" class="dash-card-body" style="padding:0">
                        <div style="text-align:center;padding:40px">Loading...</div>
                    </div>
                </div>
            `;

            window.refreshFeeAmounts = refreshFeeAmounts;
            window.openAddFeeCategory = openAddFeeCategory;
            window.openAddFeeAmount = openAddFeeAmount;
            window.openEditFeeCategory = openEditFeeCategory;
            window.saveEditFeeCategory = saveEditFeeCategory;
            window.openEditFeeAmount = openEditFeeAmount;
            window.saveEditFeeAmount = saveEditFeeAmount;
            window.deleteFeeCategory = deleteFeeCategory;
            window.exportFeeAmounts = exportFeeAmounts;

            await refreshFeeAmounts();
        }


        /**
         * Extended fee structure management with templates.
         */
        async function renderFeeStructures(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const isTeacher = user?.role === 'teacher';

            if (isTeacher) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage fee structures.</div>';
                return;
            }

            const categories = state.feeCategories.filter(c => c.is_active !== false);
            const classes = state.classes.filter(c => c.is_active !== false);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🏷️ Fee Structures</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddFeeCategoryModal()">➕ Add Category</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportFeeStructures()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                            <button class="tab-btn active" onclick="window.showStructureTab('categories', event)">📋 Fee Categories</button>
                            <button class="tab-btn" onclick="window.showStructureTab('templates', event)">📄 Fee Templates</button>
                            <button class="tab-btn" onclick="window.showStructureTab('class-overrides', event)">🏛️ Class Overrides</button>
                        </div>

                        <div id="categories-tab">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Category Name</th>
                                            <th>Type</th>
                                            <th>Default Amount</th>
                                            <th>Reset Frequency</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${categories.length ? categories.map(cat => `
                                            <tr>
                                                <td><strong>${esc(cat.name)}</strong></td>
                                                <td>${esc(cat.fee_type || '—')}</span>
                                                <td>${fmtCurrency(cat.amount || 0)}</span>
                                                <td><span class="badge badge-info">${cat.reset_frequency || 'one_time'}</span></td>
                                                <td><span class="badge ${cat.is_active !== false ? 'badge-success' : 'badge-danger'}">${cat.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.editFeeCategory(${cat.id})">✏️</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteFeeCategory(${cat.id}, '${esc(cat.name)}')">🗑️</button>
                                                    <button class="btn btn-sm btn-primary" onclick="window.copyFeeCategory(${cat.id})">📋 Copy</button>
                                                 </span>
                                            </tr>
                                        `).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No fee categories found</span>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div id="templates-tab" style="display:none">
                            <div class="alert alert-info">Fee templates allow you to quickly apply predefined fee sets to classes.</div>
                            <div class="btn-group" style="margin-bottom:16px">
                                <button class="btn btn-sm btn-primary" onclick="window.openAddTemplateModal()">➕ Create Template</button>
                            </div>
                            <div id="templates-list" class="table-wrapper">
                                <div class="loading-container"><div class="spinner"></div><p>Loading templates...</p></div>
                            </div>
                        </div>

                        <div id="class-overrides-tab" style="display:none">
                            <div class="alert alert-info">Override default fee amounts for specific classes.</div>
                            <div class="filters-bar">
                                <select id="override-class-filter" class="form-control" style="width:200px" onchange="window.loadClassOverrides()">
                                    <option value="">All Classes</option>
                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                                <button class="btn btn-primary" onclick="window.openAddOverrideModal()">➕ Add Override</button>
                            </div>
                            <div id="class-overrides-list" class="table-wrapper" style="margin-top:16px">
                                <div class="loading-container"><div class="spinner"></div><p>Loading overrides...</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            window.showStructureTab = showStructureTab;
            window.openAddFeeCategoryModal = openAddFeeCategoryModal;
            window.editFeeCategory = editFeeCategory;
            window.deleteFeeCategory = deleteFeeCategory;
            window.copyFeeCategory = copyFeeCategory;
            window.exportFeeStructures = exportFeeStructures;
            window.openAddTemplateModal = openAddTemplateModal;
            window.loadClassOverrides = loadClassOverrides;
            window.openAddOverrideModal = openAddOverrideModal;
            window.createFeeCategory = createFeeCategory;
            window.updateFeeCategory = updateFeeCategory;
            window.saveFeeTemplate = saveFeeTemplate;
            window.updateOverrideDefaultAmount = updateOverrideDefaultAmount;
            window.createOverride = createOverride;
            window.editOverride = editOverride;
            window.deleteOverride = deleteOverride;
            window.viewTemplate = viewTemplate;
            window.applyTemplate = applyTemplate;
            window.applyFeeTemplate = applyFeeTemplate;
            window.deleteTemplate = deleteTemplate;

            await loadTemplates();
            await loadClassOverrides();
        }

        /**
         * Loads fee templates (stored as a JSON array in
         * state.schoolSettings.fee_templates — see saveFeeTemplate()) and
         * renders them into #templates-list.
         */
        async function loadTemplates() {
            const container = document.getElementById('templates-list');
            if (!container) return;
            let templates = [];
            try { templates = JSON.parse(state.schoolSettings.fee_templates || '[]'); } catch (e) { templates = []; }
            if (!templates.length) {
                container.innerHTML = '<div class="alert alert-info">No fee templates created yet.</div>';
                return;
            }
            container.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>Template Name</th><th>Categories</th><th>Created</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${templates.map(t => `
                            <tr>
                                <td><strong>${esc(t.name)}</strong></td>
                                <td>${(t.category_ids || []).length} categories</td>
                                <td>${fmtDate(t.created_at)}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline" onclick="window.viewTemplate('${t.id}')">👁️</button>
                                    <button class="btn btn-sm btn-primary" onclick="window.applyFeeTemplate('${t.id}')">✅ Apply</button>
                                    <button class="btn btn-sm btn-danger" onclick="window.deleteTemplate('${t.id}')">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }


        /**
         * Assign fee structures to individual students.
         * Override class-level fees for specific students.
         */
        async function renderFeeAssignments(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage fee assignments.</div>';
                return;
            }

            const classes = state.classes.filter(c => c.is_active !== false);
            const categories = state.feeCategories.filter(c => c.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const currentTermId = state.currentTerm?.id;

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🏷️ Fee Assignments</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAssignFeeModal()">➕ Assign Fee</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportFeeAssignments()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="assign-class-filter" class="form-control" style="width:180px" onchange="window.renderFeeAssignmentsTable()">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="assign-term-filter" class="form-control" style="width:150px" onchange="window.renderFeeAssignmentsTable()">
                                <option value="">All Terms</option>
                                ${terms.map(t => `<option value="${t.id}" ${t.id === currentTermId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                            </select>
                            <select id="assign-status-filter" class="form-control" style="width:130px" onchange="window.renderFeeAssignmentsTable()">
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="waived">Waived</option>
                                <option value="paid">Paid</option>
                            </select>
                            <span class="result-count" id="assign-count"></span>
                        </div>

                        <div class="table-wrapper" id="fee-assignments-table">
                            <div class="loading-container"><div class="spinner"></div><p>Loading fee assignments...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Assignment Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="assign-stats-container" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.renderFeeAssignmentsTable = renderFeeAssignmentsTable;
            window.openAssignFeeModal = openAssignFeeModal;
            window.exportFeeAssignments = exportFeeAssignments;
            window.editFeeAssignment = editFeeAssignment;
            window.deleteFeeAssignment = deleteFeeAssignment;
            window.bulkAssignToClass = bulkAssignToClass;

            await renderFeeAssignmentsTable();
            await renderAssignmentStats();
        }


        /**
         * Grant full or partial fee waivers to students.
         * Waived fees are excluded from balance calculations.
         */
        async function renderFeeWaivers(container) {
            await ensureStateLoaded();

            const waivers = (state.studentFees || []).filter(f => f.is_waived === true);
            const waiverSummary = {};
            for (const w of waivers) {
                if (!waiverSummary[w.student_id]) {
                    waiverSummary[w.student_id] = { total: 0, count: 0, student: getStudentById(w.student_id) };
                }
                waiverSummary[w.student_id].total += w.amount;
                waiverSummary[w.student_id].count++;
            }

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">🎁 Fee Waivers</span>
                                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openSmartWaiverModal()">➕ Add Waiver</button>
                    <button class="btn btn-sm btn-outline" onclick="window.openFullWaiverModal()">🎯 Full Waiver</button>
                </div>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                                    <div class="stat-card" style="margin:0;padding:12px">
                                        <div class="stat-value">${fmtCurrency(waivers.reduce((a, w) => a + w.amount, 0))}</div>
                                        <div class="stat-label">Total Waived Amount</div>
                                    </div>
                                    <div class="stat-card" style="margin:0;padding:12px">
                                        <div class="stat-value">${waivers.length}</div>
                                        <div class="stat-label">Total Waivers</div>
                                    </div>
                                    <div class="stat-card" style="margin:0;padding:12px">
                                        <div class="stat-value">${Object.keys(waiverSummary).length}</div>
                                        <div class="stat-label">Students with Waivers</div>
                                    </div>
                                </div>
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead><tr><th>Student</th><th>Class</th><th>Category</th><th>Amount Waived</th><th>Reason</th><th>Date</th><th>Action</th></tr></thead>
                                        <tbody>
                                            ${waivers.length ? waivers.map(w => {
                const st = getStudentById(w.student_id);
                const cat = (state.feeCategories || []).find(f => f.id === w.fee_category_id);
                const cls = st ? getClassById(st.class_id) : null;
                return `
                                                    <tr>
                                                        <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}<br><small>${esc(st?.student_code || '')}</small></td>
                                                        <td>${esc(cls?.name || '—')}</td>
                                                        <td>${esc(cat?.name || '—')}</td>
                                                        <td style="color:var(--success);font-weight:600">- ${fmtCurrency(w.amount)}</span></td>
                                                        <td>${esc(w.waiver_reason || '—')}</span></td>
                                                        <td>${fmtDate(w.created_at)}</span></td>
                                                        <td><button class="btn btn-sm btn-danger" onclick="window.removeWaiver(${w.id})">🗑️ Remove</button></span>
                                                    </tr>
                                                `;
            }).join('') : '<tr><td colspan="7" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No waivers recorded</span>'}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="alert alert-info" style="margin:16px;font-size:.8rem">
                                    <strong>📊 Impact of Waivers:</strong><br>
                                    • Total fees removed from student balances: <strong>${fmtCurrency(waivers.reduce((a, w) => a + w.amount, 0))}</strong><br>
                                    • This amount is <strong>NOT included</strong> in student fee balances or financial reports.<br>
                                    • Removing a waiver will add the amount back to the student's balance.
                                </div>
                            </div>
                        </div>
                    `;

            window.openFullWaiverModal = openFullWaiverModal;
            window.submitFullWaiver = submitFullWaiver;
            window.removeWaiver = removeWaiver;
        }


        /**
         * Fee payment status for all students by term.
         * Filter by class. Shows total, paid, balance, and percentage for each student.
         */
        async function renderFeeTermStatus(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view fee term status.</div>';
                return;
            }

            const students = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Fee Term Status</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportFeeTermStatus()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="window.printFeeTermStatus()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="fts-class-filter" class="form-control" style="width:180px" onchange="window.renderFeeTermTable()">
                                <option value="">All Classes</option>
                                ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <input type="text" id="fts-search" class="form-control flex-1" placeholder="🔍 Search student..." oninput="window.renderFeeTermTable()">
                            <span class="result-count" id="fts-count"></span>
                        </div>

                        <div class="table-wrapper" id="fee-term-table">
                            <div class="loading-container"><div class="spinner"></div><p>Loading fee term data...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📈 Term Summary</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="term-summary-stats" class="stats-grid" style="grid-template-columns:repeat(${terms.length}, 1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading summary...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.renderFeeTermTable = renderFeeTermTable;
            window.exportFeeTermStatus = exportFeeTermStatus;
            window.printFeeTermStatus = printFeeTermStatus;
            window.showStudentTermDetails = showStudentTermDetails;

            await renderFeeTermTable();
            await renderTermSummary();
        }

        /**
         * Renders one stat card per term (current academic year) into
         * #term-summary-stats, showing each term's total expected vs
         * collected fees and the collection rate.
         */
        async function renderTermSummary() {
            const container = document.getElementById('term-summary-stats');
            if (!container) return;
            const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const cards = terms.map(t => {
                const fees = (state.studentFees || []).filter(f => f.term_id === t.id);
                const expected = fees.reduce((s, f) => s + (f.amount || 0), 0);
                const collected = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);
                const rate = expected > 0 ? (collected / expected) * 100 : 0;
                return `<div class="stat-card">
                    <div class="stat-value">${rate.toFixed(0)}%</div>
                    <div class="stat-label">${esc(t.name)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${fmtCurrency(collected)} / ${fmtCurrency(expected)}</div>
                </div>`;
            }).join('');
            container.innerHTML = cards || '<div class="alert alert-info">No terms found for the current academic year.</div>';
        }


        /**
         * Family-level fee summary: total fees, paid, and balance for each family group.
         */
        async function renderFamilyFeeSummary(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view family fee summaries.</div>';
                return;
            }

            const families = state.families || [];
            const activeFamilies = families.filter(f => {
                const members = state.students.filter(s => s.family_id === f.id && s.status === 'Active');
                return members.length > 0;
            });

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">👨‍👩‍👧 Family Fee Summary</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportFamilyFeeSummary()">📥 Export All</button>
                            <button class="btn btn-sm btn-outline" onclick="window.refreshFamilySummary()">🔄 Refresh</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <input type="text" id="family-search" class="form-control flex-1" placeholder="🔍 Search family code or guardian name..." oninput="window.filterFamilySummary()">
                            <span class="result-count" id="family-count"></span>
                        </div>

                        <div class="table-wrapper" id="family-summary-table">
                            <div class="loading-container"><div class="spinner"></div><p>Loading family summaries...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Overall Family Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="family-stats-container" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.exportFamilyFeeSummary = exportFamilyFeeSummary;
            window.refreshFamilySummary = refreshFamilySummary;
            window.filterFamilySummary = filterFamilySummary;
            window.viewFamilyDetails = viewFamilyDetails;
            window.printFamilyStatement = printFamilyStatement;

            await refreshFamilySummary();
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 42 — FINANCE: BALANCES, REPORTS & AUDIT
