// SECTION 55: CREDIT BALANCES
        // ================================================================

        async function renderCreditBalances(container) {
            const user = state.currentUser;
            if (user?.role === 'teacher') { container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view credit balances.</div>'; return; }
            await ensureStateLoaded();
            const classes = state.classes.filter(c => c.is_active !== false);
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">⭐ Credit Balances Management</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="exportCreditBalances()">📥 Export</button><button class="btn btn-sm btn-outline" onclick="window.renderCreditBalances(document.getElementById('dynamic-content'))">🔄 Refresh</button></div></div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="credit-class-filter" class="form-control" style="width:180px" onchange="renderCreditTable()"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
                    <select id="credit-status-filter" class="form-control" style="width:150px" onchange="renderCreditTable()"><option value="">All Status</option><option value="has_credit">Has Credit ⭐</option><option value="no_credit">No Credit</option></select>
                    <input type="text" id="credit-search" class="form-control flex-1" placeholder="🔍 Search student..." oninput="renderCreditTable()">
                    <span class="result-count" id="credit-count"></span>
                </div>
                <div class="table-wrapper" id="credit-table-container"><div class="loading-container"><div class="spinner"></div><p>Loading credit balances...</p></div></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📊 Credit Summary</span></div><div class="dash-card-body"><div id="credit-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)"><div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div></div></div></div>
    `;
            await renderCreditTable();
            await renderCreditSummary();
        }
        window.renderCreditBalances = renderCreditBalances;

        async function renderCreditTable() {
            const container = document.getElementById('credit-table-container');
            if (!container) return;
            const classFilter = document.getElementById('credit-class-filter')?.value;
            const statusFilter = document.getElementById('credit-status-filter')?.value;
            const search = document.getElementById('credit-search')?.value.toLowerCase();
            let students = state.students.filter(s => s.status === 'Active');
            if (classFilter) students = students.filter(s => String(s.class_id) === classFilter);
            if (search) students = students.filter(s => (s.first_name + ' ' + s.last_name).toLowerCase().includes(search) || (s.student_code || '').toLowerCase().includes(search));

            const rows = students.map(s => {
                const credit = getStudentCreditBalance(s.id);
                const cls = getClassById(s.class_id);
                const hasCredit = credit.available > 0;
                return { student: s, cls, credit, hasCredit };
            });

            const filtered = statusFilter ? rows.filter(r => {
                if (statusFilter === 'has_credit') return r.hasCredit;
                if (statusFilter === 'no_credit') return !r.hasCredit;
                return true;
            }) : rows;

            const countEl = document.getElementById('credit-count');
            if (countEl) countEl.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;

            const tbody = container.tagName === 'TBODY' ? container : container.querySelector('tbody');
            if (!tbody) return;

            if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No students found</td></tr>'; return; }

            tbody.innerHTML = filtered.map(({ student, cls, credit, hasCredit }) => `
        <tr>
            <td><a href="#" onclick="navigateToWithData('student-details',{student_id:${student.id}});return false" style="font-weight:600;color:var(--primary)">${esc(student.first_name)} ${esc(student.last_name)}</a></td>
            <td>${esc(cls?.name || '—')}</td>
            <td style="text-align:right;font-weight:600">${fmtCurrency(credit.total || 0)}</td>
            <td style="text-align:right;color:var(--warning)">${fmtCurrency(credit.used || 0)}</td>
            <td style="text-align:right;color:var(--success);font-weight:700">${fmtCurrency(credit.available || 0)}</td>
            <td style="text-align:center">${hasCredit ? '<span class="badge badge-success">⭐ Has Credit</span>' : '<span class="badge badge-neutral">—</span>'}</td>
        </tr>
    `).join('');
        }
        window.renderCreditTable = renderCreditTable;

        async function renderCreditSummary() {
            const container = document.getElementById('credit-summary-stats');
            if (!container) return;
            const students = state.students.filter(s => s.status === 'Active');
            let totalCredit = 0, totalUsed = 0, totalAvailable = 0, studentsWithCredit = 0;
            for (const s of students) {
                const c = getStudentCreditBalance(s.id);
                totalCredit += c.total;
                totalUsed += c.used;
                totalAvailable += c.available;
                if (c.available > 0) studentsWithCredit++;
            }
            container.innerHTML = `
        <div class="stat-card"><div class="stat-value">${fmtCurrency(totalCredit)}</div><div class="stat-label">⭐ Total Credit Issued</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${fmtCurrency(totalUsed)}</div><div class="stat-label">📤 Credit Used</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${fmtCurrency(totalAvailable)}</div><div class="stat-label">✅ Available</div></div>
        <div class="stat-card"><div class="stat-value">${studentsWithCredit}</div><div class="stat-label">👥 Students with Credit</div></div>
    `;
        }
        window.renderCreditSummary = renderCreditSummary;

        function exportCreditBalances() {
            const data = state.students.filter(s => s.status === 'Active').map(s => {
                const credit = getStudentCreditBalance(s.id);
                return credit.total > 0 ? { 'Student': `${s.first_name} ${s.last_name}`, 'Code': s.student_code || '—', 'Class': getClassById(s.class_id)?.name || '—', 'Credit Total': credit.total, 'Credit Used': credit.used, 'Available Credit': credit.available } : null;
            }).filter(Boolean);
            if (!data.length) { showToast('No credit balances found', 'info'); return; }
            exportToExcel(data, 'Credit_Balances');
            showToast('✅ Credit balances exported', 'success');
        }
        window.exportCreditBalances = exportCreditBalances;

        // ================================================================
