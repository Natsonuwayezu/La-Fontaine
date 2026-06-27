// SECTION 54: STUDENT BALANCES
        // ================================================================

        async function renderBalances(container) {
            await ensureStateLoaded();
            const classes = state.classes.filter(c => c.is_active !== false);
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">💰 Student Fee Balances</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="window.exportBalancesToExcel()">📥 Export to Excel</button><button class="btn btn-sm btn-outline" onclick="window.printBalanceReport()">🖨️ Print Report</button></div></div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="balance-class-filter" class="form-control" style="width:180px" onchange="window.renderBalancesTable()"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
                    <select id="balance-status-filter" class="form-control" style="width:150px" onchange="window.renderBalancesTable()"><option value="">All Status</option><option value="positive">Has Balance 🔴</option><option value="zero">Paid ✅</option><option value="credit">Has Credit ⭐</option></select>
                    <input type="text" id="balance-search" class="form-control flex-1" placeholder="🔍 Search student name or code..." oninput="window.renderBalancesTable()">
                    <span class="result-count" id="balance-count"></span>
                </div>
                <div class="table-wrapper" id="balances-table-container"><div class="loading-container"><div class="spinner"></div><p>Loading balances...</p></div></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📊 Balance Summary</span></div><div class="dash-card-body"><div id="balance-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)"><div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div></div></div></div>
    `;
            window.renderBalancesTable = renderBalancesTable;
            window.exportBalancesToExcel = exportBalancesToExcel;
            window.printBalanceReport = printBalanceReport;
            await renderBalancesTable();
            await renderBalanceSummary();
        }
        window.renderBalances = renderBalances;

        async function renderBalancesTable() {
            const container = document.getElementById('balances-table-container');
            if (!container) return;
            const classFilter = document.getElementById('balance-class-filter')?.value;
            const statusFilter = document.getElementById('balance-status-filter')?.value;
            const search = document.getElementById('balance-search')?.value.toLowerCase();
            let students = state.students.filter(s => s.status === 'Active');
            if (classFilter) students = students.filter(s => String(s.class_id) === classFilter);
            if (search) students = students.filter(s => (s.first_name + ' ' + s.last_name).toLowerCase().includes(search) || (s.student_code || '').toLowerCase().includes(search));

            const rows = await Promise.all(students.map(async s => {
                const bal = await getFullStudentBalance(s.id);
                const cls = getClassById(s.class_id);
                const status = bal.balance <= 0 ? 'zero' : bal.paid > 0 ? 'partial' : 'positive';
                const hasCredit = bal.credit > 0;
                return { student: s, cls, bal, status, hasCredit };
            }));

            const filtered = statusFilter ? rows.filter(r => {
                if (statusFilter === 'positive') return r.balance.balance > 0;
                if (statusFilter === 'zero') return r.balance.balance === 0 && !r.hasCredit;
                if (statusFilter === 'credit') return r.hasCredit;
                return true;
            }) : rows;

            const countEl = document.getElementById('balance-count');
            if (countEl) countEl.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;

            const tbody = container.tagName === 'TBODY' ? container : container.querySelector('tbody');
            if (!tbody) return;

            if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No students found</td></tr>'; return; }

            tbody.innerHTML = filtered.map(({ student, cls, bal, hasCredit }) => {
                const statusText = bal.balance <= 0 ? (hasCredit ? '⭐ Has Credit' : '✅ Paid') : (bal.paid > 0 ? '⚡ Partial' : '🔴 Due');
                const statusClass = bal.balance <= 0 ? (hasCredit ? 'badge-info' : 'badge-success') : (bal.paid > 0 ? 'badge-warning' : 'badge-danger');
                return `<tr>
            <td><a href="#" onclick="navigateToWithData('student-details',{student_id:${student.id}});return false" style="font-weight:600;color:var(--primary)">${esc(student.first_name)} ${esc(student.last_name)}</a></td>
            <td>${esc(cls?.name || '—')}</td>
            <td style="text-align:right">${fmtCurrency(bal.total || 0)}</td>
            <td style="text-align:right;color:var(--success);font-weight:600">${fmtCurrency(bal.paid || 0)}</td>
            <td style="text-align:right;color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:700">${fmtCurrency(bal.balance || 0)}</td>
            <td style="text-align:center">${hasCredit ? fmtCurrency(bal.credit) : '—'}</td>
            <td style="text-align:center"><span class="badge ${statusClass}">${statusText}</span></td>
            <td style="text-align:center"><button class="btn btn-sm btn-primary" onclick="navigateToWithData('record-payment',{student_id:${student.id}})">💰 Pay</button></td>
        </tr>`;
            }).join('');
        }
        window.renderBalancesTable = renderBalancesTable;

        async function renderBalanceSummary() {
            const container = document.getElementById('balance-summary-stats');
            if (!container) return;
            const students = state.students.filter(s => s.status === 'Active');
            let totalOutstanding = 0, dueCount = 0, paidCount = 0, creditCount = 0;
            for (const s of students) {
                const bal = await getFullStudentBalance(s.id);
                totalOutstanding += Math.max(0, bal.balance);
                if (bal.balance > 0) dueCount++; else paidCount++;
                if (bal.hasCredit) creditCount++;
            }
            container.innerHTML = `
        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${fmtCurrency(totalOutstanding)}</div><div class="stat-label">🔴 Total Outstanding</div></div>
        <div class="stat-card"><div class="stat-value">${dueCount}</div><div class="stat-label">📌 Students with Balance</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${paidCount}</div><div class="stat-label">✅ Paid in Full</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--info)">${creditCount}</div><div class="stat-label">⭐ With Credit</div></div>
    `;
        }
        window.renderBalanceSummary = renderBalanceSummary;

        function exportBalancesToExcel() {
            const data = state.students.filter(s => s.status === 'Active').map(s => {
                const bal = getFullStudentBalance(s.id);
                return { 'Student': s.first_name + ' ' + s.last_name, 'Code': s.student_code || '', 'Class': getClassById(s.class_id)?.name || '', 'Total (RWF)': bal.total || 0, 'Paid (RWF)': bal.paid || 0, 'Balance (RWF)': bal.balance || 0, 'Credit (RWF)': bal.credit || 0, 'Status': bal.balance <= 0 ? (bal.credit > 0 ? 'Has Credit' : 'Paid') : (bal.paid > 0 ? 'Partial' : 'Due') };
            });
            exportToExcel(data, 'Student_Balances_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Balances exported', 'success');
        }
        window.exportBalancesToExcel = exportBalancesToExcel;

        function printBalanceReport() {
            const container = document.getElementById('balances-table-container');
            if (!container?.querySelector('table')) { showToast('Load data first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Balance Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px;font-size:11px}th{background:#1a3a5c;color:#fff}</style></head><body><h2>Student Balances — ${new Date().toLocaleDateString()}</h2>${container.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }
        window.printBalanceReport = printBalanceReport;

        // ================================================================
