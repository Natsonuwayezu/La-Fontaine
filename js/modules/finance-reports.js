// ══════════════════════════════════════════════════════════════════════════


        /**
         * Full balance sheet: every student's total fees, paid, and outstanding.
         * Sort, search, and export. Color-coded by payment percentage.
         */
        async function renderBalances(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const isTeacher = user?.role === 'teacher';

            if (isTeacher) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view fee balances.</div>';
                return;
            }

            const classes = state.classes.filter(c => c.is_active !== false);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">💰 Student Fee Balances</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportBalancesToExcel()">📥 Export to Excel</button>
                            <button class="btn btn-sm btn-outline" onclick="window.printBalanceReport()">🖨️ Print Report</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="balance-class-filter" class="form-control" style="width:180px" onchange="window.renderBalancesTable()">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="balance-status-filter" class="form-control" style="width:150px" onchange="window.renderBalancesTable()">
                                <option value="">All Status</option>
                                <option value="positive">Has Balance 🔴</option>
                                <option value="zero">Paid ✅</option>
                                <option value="credit">Has Credit ⭐</option>
                            </select>
                            <input type="text" id="balance-search" class="form-control flex-1" placeholder="🔍 Search student name or code..." oninput="window.renderBalancesTable()">
                            <span class="result-count" id="balance-count"></span>
                        </div>

                        <div class="table-wrapper" id="balances-table-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading balances...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Balance Summary</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="balance-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.renderBalancesTable = renderBalancesTable;
            window.exportBalancesToExcel = exportBalancesToExcel;
            window.printBalanceReport = printBalanceReport;

            await renderBalancesTable();
            await renderBalanceSummary();
        }

        /**
         * Renders 4 summary stat cards into #balance-summary-stats: total
         * outstanding across all active students, count with a balance due,
         * count paid in full, and count carrying a credit.
         */
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


        /**
         * Comprehensive financial reports: term summary, class breakdown,
         * fee category analysis, collection trends chart. Export to Excel/PDF.
         */
        async function renderFinancialReports(el) {
            await ensureStateLoaded();

            // Current state for filters
            let currentFilter = {
                type: 'all',           // 'all', 'class', 'student', 'category'
                classId: null,
                studentId: null,
                categoryId: null
            };

            // Store chart instances for cleanup
            let monthlyChart = null;
            let categoryChart = null;
            let trendChart = null;

            // Helper: Calculate financial metrics based on filters
            // Helper: Calculate financial metrics based on filters
            function calculateMetrics() {
                let filteredFees = [...state.studentFees];
                let filteredPayments = [...state.payments];
                let filteredStudents = [...state.students];

                // Apply filters
                if (currentFilter.type === 'class' && currentFilter.classId) {
                    const studentIds = state.students.filter(s => s.class_id == currentFilter.classId && s.status === 'Active').map(s => s.id);
                    filteredFees = filteredFees.filter(f => studentIds.includes(f.student_id));
                    filteredPayments = filteredPayments.filter(p => studentIds.includes(p.student_id));
                    filteredStudents = filteredStudents.filter(s => s.class_id == currentFilter.classId);
                } else if (currentFilter.type === 'student' && currentFilter.studentId) {
                    filteredFees = filteredFees.filter(f => f.student_id == currentFilter.studentId);
                    filteredPayments = filteredPayments.filter(p => p.student_id == currentFilter.studentId);
                    filteredStudents = filteredStudents.filter(s => s.id == currentFilter.studentId);
                } else if (currentFilter.type === 'category' && currentFilter.categoryId) {
                    // CRITICAL FIX: When filtering by category, also filter payments
                    // to only include payments that were allocated to this category
                    filteredFees = filteredFees.filter(f => f.fee_category_id == currentFilter.categoryId);

                    // Get fee IDs for this category (to filter payments)
                    const feeIdsForCategory = filteredFees.map(f => f.id);

                    // Filter payments to only those allocated to these fees
                    // Also need to consider payment_allocations table
                    filteredPayments = filteredPayments.filter(p => {
                        // Check if this payment has allocations to fees in this category
                        // Look for payment_allocations linking this payment to fees in our filtered list
                        // Since we don't have payment_allocations loaded, we need to check student_fees
                        // A payment is relevant if the student has any fee in this category
                        const studentHasCategoryFee = state.studentFees.some(f =>
                            f.student_id === p.student_id &&
                            f.fee_category_id == currentFilter.categoryId &&
                            !f.is_waived
                        );
                        return studentHasCategoryFee;
                    });
                }

                // Calculate totals
                let totalExpectedRaw = 0;
                let totalWaived = 0;
                let totalPaid = 0;
                let totalCreditPayments = 0;
                let totalCashPayments = 0;

                for (const fee of filteredFees) {
                    if (fee.is_waived) {
                        totalWaived += fee.amount;
                    } else {
                        totalExpectedRaw += fee.amount;
                        totalPaid += fee.paid_amount || 0;
                    }
                }

                for (const payment of filteredPayments) {
                    if (payment.is_credit_payment === true) {
                        totalCreditPayments += payment.amount;
                    } else if (payment.is_credit_addition !== true && !payment.is_refund) {
                        totalCashPayments += payment.amount;
                    }
                }

                // For category filter, we need to be careful about double-counting
                // Use the paid amount from fees as the primary source
                let effectiveTotalPaid = totalPaid;

                // If we're filtering by category, don't add cash payments separately
                if (currentFilter.type === 'category') {
                    effectiveTotalPaid = totalPaid;
                } else {
                    effectiveTotalPaid = totalPaid;
                }

                const totalExpected = totalExpectedRaw - totalWaived;
                const totalUnpaid = Math.max(0, totalExpected - effectiveTotalPaid);
                const totalEffectiveCollection = effectiveTotalPaid;
                const collectionRate = totalExpectedRaw > 0 ? (totalEffectiveCollection / totalExpectedRaw) * 100 : 0;
                const cashback = totalCreditPayments;
                const studentCount = filteredStudents.filter(s => s.status === 'Active').length || 1;

                return {
                    totalExpectedRaw,
                    totalWaived,
                    totalExpected,
                    totalPaid: totalEffectiveCollection,
                    totalCashPayments,
                    totalCreditPayments,
                    totalUnpaid,
                    cashback,
                    collectionRate,
                    studentCount
                };
            }

            // Helper: Get filtered data for tables
            function getFilteredData() {
                let fees = [...state.studentFees];
                let payments = [...state.payments];

                if (currentFilter.type === 'class' && currentFilter.classId) {
                    const studentIds = state.students.filter(s => s.class_id == currentFilter.classId && s.status === 'Active').map(s => s.id);
                    fees = fees.filter(f => studentIds.includes(f.student_id));
                    payments = payments.filter(p => studentIds.includes(p.student_id));
                } else if (currentFilter.type === 'student' && currentFilter.studentId) {
                    fees = fees.filter(f => f.student_id == currentFilter.studentId);
                    payments = payments.filter(p => p.student_id == currentFilter.studentId);
                } else if (currentFilter.type === 'category' && currentFilter.categoryId) {
                    fees = fees.filter(f => f.fee_category_id == currentFilter.categoryId);
                }

                return { fees, payments };
            }

            // Helper: Get student name
            function getStudentName(id) {
                const s = state.students.find(s => s.id == id);
                return s ? `${s.first_name} ${s.last_name}` : 'Unknown';
            }

            // Helper: Get class name
            function getClassName(id) {
                const c = state.classes.find(c => c.id == id);
                return c ? c.name : 'Unknown';
            }

            // Helper: Get category name
            function getCategoryName(id) {
                const c = state.feeCategories.find(c => c.id == id);
                return c ? c.name : 'Unknown';
            }

            // Render function
            async function render() {
                const metrics = calculateMetrics();
                const { fees, payments } = getFilteredData();

                // Prepare monthly trend data
                const monthlyData = {};
                payments.forEach(p => {
                    const month = (p.payment_date || p.created_at || '').slice(0, 7);
                    if (month) monthlyData[month] = (monthlyData[month] || 0) + p.amount;
                });
                const months = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

                // Prepare category breakdown
                const categoryData = {};
                fees.forEach(f => {
                    if (!f.is_waived) {
                        const catName = getCategoryName(f.fee_category_id);
                        if (!categoryData[catName]) categoryData[catName] = { expected: 0, paid: 0 };
                        categoryData[catName].expected += f.amount;
                        categoryData[catName].paid += f.paid_amount || 0;
                    }
                });

                // Prepare class breakdown
                const classData = {};
                state.classes.forEach(cls => {
                    const studentIds = state.students.filter(s => s.class_id === cls.id && s.status === 'Active').map(s => s.id);
                    let classExpected = 0, classPaid = 0;
                    fees.forEach(f => {
                        if (studentIds.includes(f.student_id) && !f.is_waived) {
                            classExpected += f.amount;
                            classPaid += f.paid_amount || 0;
                        }
                    });
                    if (classExpected > 0 || classPaid > 0) {
                        classData[cls.name] = { expected: classExpected, paid: classPaid };
                    }
                });

                // Prepare student breakdown (top 10)
                const studentData = {};
                fees.forEach(f => {
                    if (!f.is_waived) {
                        const studentName = getStudentName(f.student_id);
                        if (!studentData[studentName]) studentData[studentName] = { expected: 0, paid: 0, studentId: f.student_id };
                        studentData[studentName].expected += f.amount;
                        studentData[studentName].paid += f.paid_amount || 0;
                    }
                });
                const topStudents = Object.entries(studentData)
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.paid - a.paid)
                    .slice(0, 10);

                // Build the HTML
                const filterOptions = `
                    <div class="filters-bar" style="flex-wrap:wrap;gap:12px;margin-bottom:20px">
                        <div class="form-group" style="margin:0;min-width:150px">
                            <label style="font-size:.7rem">Filter Type</label>
                            <select id="report-filter-type" onchange="updateFinancialReportFilters()">
                                <option value="all" ${currentFilter.type === 'all' ? 'selected' : ''}>📊 All Students</option>
                                <option value="class" ${currentFilter.type === 'class' ? 'selected' : ''}>🏛️ By Class</option>
                                <option value="student" ${currentFilter.type === 'student' ? 'selected' : ''}>👤 By Student</option>
                                <option value="category" ${currentFilter.type === 'category' ? 'selected' : ''}>🏷️ By Fee Category</option>
                            </select>
                        </div>

                        <div class="form-group" id="filter-class-group" style="margin:0;min-width:150px;${currentFilter.type !== 'class' ? 'display:none' : ''}">
                            <label style="font-size:.7rem">Select Class</label>
                            <select id="report-filter-class" onchange="updateFinancialReportFilters()">
                                <option value="">-- All Classes --</option>
                                ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}" ${currentFilter.classId == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" id="filter-student-group" style="margin:0;min-width:200px;${currentFilter.type !== 'student' ? 'display:none' : ''}">
                            <label style="font-size:.7rem">Select Student</label>
                            <select id="report-filter-student" onchange="updateFinancialReportFilters()">
                                <option value="">-- Select Student --</option>
                                ${state.students.filter(s => s.status === 'Active').map(s => `<option value="${s.id}" ${currentFilter.studentId == s.id ? 'selected' : ''}>${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" id="filter-category-group" style="margin:0;min-width:150px;${currentFilter.type !== 'category' ? 'display:none' : ''}">
                            <label style="font-size:.7rem">Select Category</label>
                            <select id="report-filter-category" onchange="updateFinancialReportFilters()">
                                <option value="">-- All Categories --</option>
                                ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}" ${currentFilter.categoryId == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>

                        <div style="flex:1"></div>

                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="exportFinancialReportData()">📥 Export Report</button>
                            <button class="btn btn-sm btn-outline" onclick="printFinancialReport()">🖨️ Print</button>
                        </div>
                    </div>
                `;

                const statsCards = `
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">💰</div>
                            <div class="stat-value">${fmtCurrency(metrics.totalExpected)}</div>
                            <div class="stat-label">Total Expected <small>(After Waivers)</small></div>
                            <div class="stat-trend neutral">Base: ${fmtCurrency(metrics.totalExpectedRaw)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">✅</div>
                            <div class="stat-value">${fmtCurrency(metrics.totalPaid)}</div>
                            <div class="stat-label">Total Collected</div>
                            <div class="stat-trend up">${metrics.collectionRate.toFixed(1)}% of expected</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏳</div>
                            <div class="stat-value">${fmtCurrency(metrics.totalUnpaid)}</div>
                            <div class="stat-label">Outstanding Balance</div>
                            <div class="stat-trend down">To be collected</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🎁</div>
                            <div class="stat-value">${fmtCurrency(metrics.totalWaived)}</div>
                            <div class="stat-label">Total Waived</div>
                            <div class="stat-trend neutral">Discounts/Scholarships</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⚡</div>
                            <div class="stat-value">${fmtCurrency(metrics.cashback)}</div>
                            <div class="stat-label">Cashback Available</div>
                            <div class="stat-trend up">Overpayment Credit</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-value">${metrics.collectionRate.toFixed(1)}%</div>
                            <div class="stat-label">Collection Rate</div>
                            <div style="background:var(--border-light);border-radius:99px;height:6px;margin-top:8px;overflow:hidden">
                                <div style="height:100%;width:${Math.min(100, metrics.collectionRate)}%;background:var(--accountant-primary);border-radius:99px;"></div>
                            </div>
                        </div>
                    </div>
                `;

                const chartsSection = `
                    <div class="two-col">
                        <div class="dash-card">
                            <div class="dash-card-header"><span class="dash-card-title">📈 Monthly Collection Trend</span></div>
                            <div class="dash-card-body"><canvas id="monthly-trend-chart" height="220"></canvas></div>
                        </div>
                        <div class="dash-card">
                            <div class="dash-card-header"><span class="dash-card-title">🥧 Collection by Category</span></div>
                            <div class="dash-card-body"><canvas id="category-chart" height="220"></canvas></div>
                        </div>
                    </div>
                `;

                const classTable = `
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <span class="dash-card-title">📋 Summary by Class</span>
                            <button class="btn btn-sm btn-outline" onclick="exportClassBreakdown()">📥 Export</button>
                        </div>
                        <div class="dash-card-body" style="padding:0">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>Class</th><th>Expected (RWF)</th><th>Collected (RWF)</th><th>Balance (RWF)</th><th>Rate</th>
                                    </tr></thead>
                                    <tbody>
                                        ${Object.entries(classData).length ? Object.entries(classData).map(([name, data]) => {
                    const balance = data.expected - data.paid;
                    const rate = data.expected > 0 ? (data.paid / data.expected) * 100 : 0;
                    return `<tr>
                                                <td><strong>${esc(name)}</strong></td>
                                                <td>${fmtCurrency(data.expected)}</td>
                                                <td>${fmtCurrency(data.paid)}</td>
                                                <td class="${balance > 0 ? 'text-danger' : ''}">${fmtCurrency(balance)}</td>
                                                <td><span class="badge ${rate >= 80 ? 'badge-success' : rate >= 50 ? 'badge-warning' : 'badge-danger'}">${rate.toFixed(1)}%</span></td>
                                            </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No data for selected filters</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                const studentTable = `
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <span class="dash-card-title">🏆 Top Payers</span>
                            <button class="btn btn-sm btn-outline" onclick="exportTopPayers()">📥 Export</button>
                        </div>
                        <div class="dash-card-body" style="padding:0">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>Rank</th><th>Student</th><th>Total Expected</th><th>Total Paid</th><th>Balance</th><th>Status</th>
                                    </tr></thead>
                                    <tbody>
                                        ${topStudents.length ? topStudents.map((s, idx) => {
                    const balance = s.expected - s.paid;
                    const status = balance <= 0 ? (balance < 0 ? '⚡ Credit' : '✅ Paid') : (balance > 0 ? '🔴 Due' : '✅ Paid');
                    return `<tr>
                                                <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</td>
                                                <td><strong>${esc(s.name)}</strong></td>
                                                <td>${fmtCurrency(s.expected)}</td>
                                                <td>${fmtCurrency(s.paid)}</td>
                                                <td class="${balance > 0 ? 'text-danger' : balance < 0 ? 'text-success' : ''}">${fmtCurrency(Math.abs(balance))} ${balance < 0 ? 'credit' : ''}</td>
                                                <td><span class="badge ${balance <= 0 ? 'badge-success' : 'badge-warning'}">${status}</span></td>
                                            </tr>`;
                }).join('') : `<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No data for selected filters</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                const categoryTable = `
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <span class="dash-card-title">🏷️ Fee Category Breakdown</span>
                            <button class="btn btn-sm btn-outline" onclick="exportCategoryBreakdown()">📥 Export</button>
                        </div>
                        <div class="dash-card-body" style="padding:0">
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>Category</th><th>Expected (RWF)</th><th>Collected (RWF)</th><th>Balance (RWF)</th><th>Rate</th>
                                    </tr></thead>
                                    <tbody>
                                        ${Object.entries(categoryData).length ? Object.entries(categoryData).map(([name, data]) => {
                    const balance = data.expected - data.paid;
                    const rate = data.expected > 0 ? (data.paid / data.expected) * 100 : 0;
                    return `<tr>
                                                <td><strong>${esc(name)}</strong></td>
                                                <td>${fmtCurrency(data.expected)}</td>
                                                <td>${fmtCurrency(data.paid)}</td>
                                                <td class="${balance > 0 ? 'text-danger' : ''}">${fmtCurrency(balance)}</td>
                                                <td><span class="badge ${rate >= 80 ? 'badge-success' : rate >= 50 ? 'badge-warning' : 'badge-danger'}">${rate.toFixed(1)}%</span></td>
                                            </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No data for selected filters</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                const formulaExplanation = `
                    <div class="alert alert-info" style="margin-top:20px;font-size:.8rem">
                        <strong>📐 Calculation Formulas:</strong><br>
                        • <strong>Total Expected</strong> = SUM(all non-waived fees) = ${fmtCurrency(metrics.totalExpectedRaw)} - Waived: ${fmtCurrency(metrics.totalWaived)} = ${fmtCurrency(metrics.totalExpected)}<br>
                        • <strong>Outstanding Balance</strong> = Total Expected - Total Collected = ${fmtCurrency(metrics.totalUnpaid)}<br>
                        • <strong>Cashback/Credit</strong> = Total overpaid amount that can be refunded = ${fmtCurrency(metrics.cashback)}<br>
                        • <strong>Collection Rate</strong> = (Collected / Expected) × 100 = ${metrics.collectionRate.toFixed(1)}%<br>
                        • <strong>Per Student Average</strong> = ${fmtCurrency(metrics.totalExpected / metrics.studentCount)} per student
                    </div>
                `;

                el.innerHTML = filterOptions + statsCards + chartsSection + classTable + studentTable + categoryTable + formulaExplanation;

                // Initialize charts
                setTimeout(() => {
                    // Monthly trend chart
                    const mCtx = document.getElementById('monthly-trend-chart')?.getContext('2d');
                    if (mCtx) {
                        if (monthlyChart) monthlyChart.destroy();
                        monthlyChart = new Chart(mCtx, {
                            type: 'line',
                            data: {
                                labels: months.map(m => m[0]),
                                datasets: [{
                                    label: 'Collected (RWF)',
                                    data: months.map(m => m[1]),
                                    borderColor: '#0d9488',
                                    backgroundColor: 'rgba(13,148,136,.15)',
                                    fill: true,
                                    tension: 0.4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: true,
                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${fmtCurrency(ctx.raw)}` } } },
                                scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmtCurrency(v) } } }
                            }
                        });
                    }

                    // Category chart
                    const cCtx = document.getElementById('category-chart')?.getContext('2d');
                    if (cCtx && Object.keys(categoryData).length) {
                        if (categoryChart) categoryChart.destroy();
                        categoryChart = new Chart(cCtx, {
                            type: 'doughnut',
                            data: {
                                labels: Object.keys(categoryData),
                                datasets: [{
                                    data: Object.values(categoryData).map(v => v.expected),
                                    backgroundColor: ['#1a3a5c', '#3b82f6', '#0d9488', '#14b8a6', '#7c3aed', '#ec4899', '#f59e0b', '#10b981']
                                }]
                            },
                            options: { responsive: true, plugins: { legend: { position: 'right' } } }
                        });
                    }
                }, 100);
            }

            // Initial render
            await render();

            // Store filter update function globally
            window.updateFinancialReportFilters = async function () {
                const filterType = document.getElementById('report-filter-type')?.value;
                currentFilter.type = filterType;

                if (filterType === 'class') {
                    currentFilter.classId = document.getElementById('report-filter-class')?.value || null;
                    currentFilter.studentId = null;
                    currentFilter.categoryId = null;
                } else if (filterType === 'student') {
                    currentFilter.studentId = document.getElementById('report-filter-student')?.value || null;
                    currentFilter.classId = null;
                    currentFilter.categoryId = null;
                } else if (filterType === 'category') {
                    currentFilter.categoryId = document.getElementById('report-filter-category')?.value || null;
                    currentFilter.classId = null;
                    currentFilter.studentId = null;
                } else {
                    currentFilter.classId = null;
                    currentFilter.studentId = null;
                    currentFilter.categoryId = null;
                }

                await render();
            };
            window.toggleCreditSelection = function (creditAmount) {
                const checkbox = event.target;
                if (checkbox.checked) {
                    const amountInput = document.getElementById('pay-amount');
                    if (amountInput) {
                        const currentAmount = parseFloat(amountInput.value) || 0;
                        amountInput.value = currentAmount + creditAmount;
                        amountInput.dispatchEvent(new Event('input'));
                    }
                    showToast(`Credit of ${fmtCurrency(creditAmount)} applied to payment`, 'success');
                }
            };
            // Show/hide filter groups
            window.toggleFinancialFilterGroups = function () {
                const filterType = document.getElementById('report-filter-type')?.value;
                document.getElementById('filter-class-group').style.display = filterType === 'class' ? 'block' : 'none';
                document.getElementById('filter-student-group').style.display = filterType === 'student' ? 'block' : 'none';
                document.getElementById('filter-category-group').style.display = filterType === 'category' ? 'block' : 'none';
            };

            // Initial setup
            window.toggleFinancialFilterGroups();
        }


        // Alias for backwards-compatible module IDs
        async function renderFinanceReports(container) { return renderFinancialReports(container); }


        /**
         * Audit trail for all financial transactions: payments, reversals,
         * waivers, adjustments. Filter by date, user, and action type.
         */
        async function renderFinanceAudit(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const auditLogs = state.activityLogs.filter(log =>
                log.entity_type === 'payments' ||
                log.entity_type === 'student_fees' ||
                log.entity_type === 'fee_amounts' ||
                log.entity_type === 'fee_categories'
            ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔍 Financial Audit Trail</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportAuditLog()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="window.refreshAuditLog()">🔄 Refresh</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="audit-type-filter" class="form-control" style="width:150px" onchange="window.filterAuditLog()">
                                <option value="">All Types</option>
                                <option value="payments">Payments</option>
                                <option value="student_fees">Fee Assignments</option>
                                <option value="fee_amounts">Fee Amounts</option>
                                <option value="fee_categories">Fee Categories</option>
                            </select>
                            <select id="audit-action-filter" class="form-control" style="width:150px" onchange="window.filterAuditLog()">
                                <option value="">All Actions</option>
                                <option value="insert">Created</option>
                                <option value="update">Modified</option>
                                <option value="delete">Deleted</option>
                            </select>
                            <input type="date" id="audit-date-start" class="form-control" style="width:150px" onchange="window.filterAuditLog()">
                            <input type="date" id="audit-date-end" class="form-control" style="width:150px" onchange="window.filterAuditLog()">
                            <input type="text" id="audit-search" class="form-control flex-1" placeholder="🔍 Search..." oninput="window.filterAuditLog()">
                            <span class="result-count" id="audit-count"></span>
                        </div>

                        <div class="table-wrapper" id="audit-table-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading audit logs...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Audit Summary</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="audit-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading summary...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.exportAuditLog = exportAuditLog;
            window.refreshAuditLog = refreshAuditLog;
            window.filterAuditLog = filterAuditLog;
            window.viewAuditDetails = viewAuditDetails;

            await refreshAuditLog();
            await renderAuditSummary();
        }

        /**
         * Renders 4 summary stat cards into #audit-summary-stats: total
         * finance-related audit entries and a breakdown by action type
         * (created/modified/deleted).
         */
        async function renderAuditSummary() {
            const container = document.getElementById('audit-summary-stats');
            if (!container) return;
            const auditLogs = state.activityLogs.filter(log =>
                log.entity_type === 'payments' ||
                log.entity_type === 'student_fees' ||
                log.entity_type === 'fee_amounts' ||
                log.entity_type === 'fee_categories'
            );
            const created = auditLogs.filter(l => /insert|created|recorded/i.test(l.action || '')).length;
            const modified = auditLogs.filter(l => /update|modified|edited|changed/i.test(l.action || '')).length;
            const deleted = auditLogs.filter(l => /delete|removed|reversed/i.test(l.action || '')).length;
            container.innerHTML = `
                <div class="stat-card"><div class="stat-value">${auditLogs.length}</div><div class="stat-label">📋 Total Entries</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--success)">${created}</div><div class="stat-label">➕ Created</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${modified}</div><div class="stat-label">✏️ Modified</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${deleted}</div><div class="stat-label">🗑️ Deleted/Reversed</div></div>
            `;
        }


        /**
         * Students with credit (overpaid) balances: apply credit to new fees,
         * or refund the credit.
         */
        async function renderCreditBalances(container) {
            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view credit balances.</div > ';
                return;
            }

            await ensureStateLoaded();

            const classes = state.classes.filter(c => c.is_active !== false);

            container.innerHTML = `
                                <div class="dash-card">
                                    <div class="dash-card-header">
                                        <span class="dash-card-title">⭐ Credit Balances Management</span>
                                        <div class="btn-group">
                                            <button class="btn btn-sm btn-outline" onclick="exportCreditBalances()">📥
                                                Export</button>
                                            <button class="btn btn-sm btn-outline"
                                                onclick="window.renderCreditBalances(document.getElementById('dynamic-content'))">🔄
                                                Refresh</button>
                                        </div>
                                    </div>
                                    <div class="dash-card-body">
                                        <div class="filters-bar">
                                            <select id="credit-class-filter" class="form-control" style="width:180px"
                                                onchange="renderCreditTable()">
                                                <option value="">All Classes</option>
                                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                            </select>
                                            <select id="credit-status-filter" class="form-control" style="width:150px"
                                                onchange="renderCreditTable()">
                                                <option value="">All Status</option>
                                                <option value="has_credit">Has Credit ⭐</option>
                                                <option value="no_credit">No Credit</option>
                                            </select>
                                            <input type="text" id="credit-search" class="form-control flex-1"
                                                placeholder="🔍 Search student..." oninput="renderCreditTable()">
                                            <span class="result-count" id="credit-count"></span>
                                        </div>
                                        <div class="table-wrapper" id="credit-table-container">
                                            <div class="loading-container">
                                                <div class="spinner"></div>
                                                <p>Loading credit balances...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="dash-card" style="margin-top:20px">
                                    <div class="dash-card-header">
                                        <span class="dash-card-title">📊 Credit Summary</span>
                                    </div>
                                    <div class="dash-card-body">
                                        <div id="credit-summary-stats" class="stats-grid"
                                            style="grid-template-columns:repeat(4,1fr)">
                                            <div class="loading-container">
                                                <div class="spinner"></div>
                                                <p>Loading stats...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                `;

            await renderCreditTable();
            await renderCreditSummary();
        }

        /**
         * Renders 3 summary stat cards into #credit-summary-stats: total
         * credit issued, total credit used, and total credit currently
         * available across all active students.
         */
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


        /**
         * Carry forward outstanding balances to the next term/year.
         * Creates balance-forward entries in student_fees.
         */
        async function renderCarryForward(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div > ';
                return;
            }

            await ensureStateLoaded();

            const currentYear = state.currentAcadYear;
            const classes = state.classes.filter(c => c.is_active !== false);

            container.innerHTML = `
                                                        <div class="dash-card">
                                                            <div class="dash-card-header">
                                                                <span class="dash-card-title">🔄 Carry Forward Unpaid
                                                                    Fees</span>
                                                            </div>
                                                            <div class="dash-card-body">
                                                                <div class="alert alert-warning">
                                                                    <strong>⚠️ Important:</strong> This will transfer unpaid
                                                                    fees from the current academic year
                                                                    to the next academic year. Paid fees will NOT be carried
                                                                    forward.
                                                                </div>

                                                                <div class="form-grid" style="margin-bottom:20px">
                                                                    <div class="form-group">
                                                                        <label>From Academic Year</label>
                                                                        <input type="text" readonly
                                                                            value="${esc(currentYear?.name || 'Current Year')}"
                                                                            class="form-control">
                                                                    </div>
                                                                    <div class="form-group">
                                                                        <label>To Academic Year</label>
                                                                        <select id="carry-target-year" class="form-control">
                                                                            <option value="">-- Select Target Year --</option>
                                                                            ${state.academicYears.filter(y => y.id !==
                currentYear?.id).map(y => `<option value="${y.id}">
                                                                                ${esc(y.name)}</option>`).join('')}
                                                                        </select>
                                                                    </div>
                                                                    <div class="form-group">
                                                                        <label>Filter by Class</label>
                                                                        <select id="carry-class-filter" class="form-control">
                                                                            <option value="">All Classes</option>
                                                                            ${classes.map(c => `<option value="${c.id}">
                                                                                ${esc(c.name)}</option>`).join('')}
                                                                        </select>
                                                                    </div>
                                                                    <div class="form-group">
                                                                        <label>Minimum Balance to Carry</label>
                                                                        <input type="number" id="carry-min-balance" value="0"
                                                                            min="0" step="1000" class="form-control">
                                                                    </div>
                                                                </div>

                                                                <div class="btn-group" style="margin-bottom:20px">
                                                                    <button class="btn btn-outline"
                                                                        onclick="previewCarryForward()">👁️ Preview</button>
                                                                    <button class="btn btn-warning"
                                                                        onclick="executeCarryForward()">🔄 Execute Carry
                                                                        Forward</button>
                                                                    <button class="btn btn-outline"
                                                                        onclick="exportCarryPreview()">📥 Export
                                                                        Preview</button>
                                                                </div>

                                                                <div id="carry-preview-container" style="display:none">
                                                                    <h4>📋 Preview: Fees to be Carried Forward</h4>
                                                                    <div id="carry-preview-table" class="table-wrapper">
                                                                        <div class="loading-container">
                                                                            <div class="spinner"></div>
                                                                            <p>Loading preview...</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div class="dash-card" style="margin-top:20px">
                                                            <div class="dash-card-header">
                                                                <span class="dash-card-title">📜 Carry Forward History</span>
                                                                <button class="btn btn-sm btn-outline"
                                                                    onclick="loadCarryHistory()">🔄 Refresh</button>
                                                            </div>
                                                            <div class="dash-card-body">
                                                                <div id="carry-history-container" class="table-wrapper">
                                                                    <div class="loading-container">
                                                                        <div class="spinner"></div>
                                                                        <p>Loading history...</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        `;
        }


        /**
         * Manage discount schemes: sibling discount, early-payment discount,
         * scholarship discount. Apply to individual students or class-wide.
         */
        async function renderDiscounts(container) {
            if (isTeacher()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage discounts.</div>';
                return;
            }

            await ensureStateLoaded();

            const families = state.families || [];
            const classes = state.classes.filter(c => c.is_active !== false);

            // Auto-detect sibling groups
            const siblingGroups = [];
            const guardianMap = new Map();
            const studentsWithoutFamily = state.students.filter(s => !s.family_id && s.status === 'Active');

            for (const student of studentsWithoutFamily) {
                const key = (student.guardian_name || '').toLowerCase().trim();
                if (key && key !== '') {
                    if (!guardianMap.has(key)) guardianMap.set(key, []);
                    guardianMap.get(key).push(student);
                }
            }

            for (const [guardian, students] of guardianMap) {
                if (students.length > 1) {
                    siblingGroups.push({ guardian, students });
                }
            }

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🎁 Discounts Management</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddDiscountRuleModal()">➕ Add Discount Rule</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportDiscountsData()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                            <button class="tab-btn active" onclick="window.showDiscountTab('family', event)">🏠 Family Discounts</button>
                            <button class="tab-btn" onclick="window.showDiscountTab('sibling', event)">👨‍👩‍👧 Sibling Discounts</button>
                            <button class="tab-btn" onclick="window.showDiscountTab('bulk', event)">📦 Bulk Discounts</button>
                            <button class="tab-btn" onclick="window.showDiscountTab('rules', event)">📋 Discount Rules</button>
                        </div>

                        <div id="family-discounts-tab">
                            <div class="alert alert-info">Family discounts apply to all siblings in the same family group.</div>
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Family Code</th>
                                            <th>Guardian Name</th>
                                            <th>Students</th>
                                            <th>Discount Amount</th>
                                            <th>Discount Type</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${families.map(f => {
                const studentCount = state.students.filter(s => s.family_id === f.id && s.status === 'Active').length;
                return `
                                                <tr>
                                                    <td><code>${esc(f.family_code)}</code></td>
                                                    <td><strong>${esc(f.guardian_name || '—')}</strong></td>
                                                    <td style="text-align:center">${studentCount}</td>
                                                    <td>${fmtCurrency(f.discount_amount || 0)}</td>
                                                    <td><span class="badge badge-info">${f.discount_type || 'Fixed'}</span></td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline" onclick="window.editFamilyDiscount(${f.id})">✏️</button>
                                                        <button class="btn btn-sm btn-primary" onclick="window.applyFamilyDiscountToAll(${f.id})">💰 Apply</button>
                                                    </td>
                                                </tr>
                                            `;
            }).join('') || '<tr><td colspan="6" style="text-align:center;padding:40px">No families found</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div id="sibling-discounts-tab" style="display:none">
                            <div class="alert alert-info">Auto-detected sibling groups without family associations.</div>
                            ${siblingGroups.length > 0 ? `
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead>
                                            <tr><th>Guardian Name</th><th>Siblings</th><th>Actions</th></tr>
                                        </thead>
                                        <tbody>
                                            ${siblingGroups.map(group => `
                                                <tr>
                                                    <td><strong>${esc(group.guardian)}</strong></td>
                                                    <td>${group.students.map(s => `${esc(s.first_name)} ${esc(s.last_name)}`).join(', ')}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-primary" onclick="window.createFamilyFromSiblings('${group.students.map(s => s.id).join(',')}', '${esc(group.guardian)}')">🏠 Create Family</button>
                                                        <button class="btn btn-sm btn-outline" onclick="window.applySiblingDiscount(${group.students.map(s => s.id).join(',')}, 5000)">💰 Apply 5,000 RWF Discount</button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="alert alert-success">No unlinked sibling groups detected</div>'}
                        </div>

                        <div id="bulk-discounts-tab" style="display:none">
                            <div class="form-grid" style="margin-bottom:20px">
                                <div class="form-group">
                                    <label>Select Class</label>
                                    <select id="bulk-discount-class" class="form-control">
                                        <option value="">All Classes</option>
                                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Discount Type</label>
                                    <select id="bulk-discount-type" class="form-control">
                                        <option value="fixed">Fixed Amount (RWF)</option>
                                        <option value="percentage">Percentage (%)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Discount Value</label>
                                    <input type="number" id="bulk-discount-value" class="form-control" min="0" step="1000">
                                </div>
                                <div class="form-group">
                                    <label>Apply to Fee Category</label>
                                    <select id="bulk-discount-category" class="form-control">
                                        <option value="">All Categories</option>
                                        ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="btn-group">
                                <button class="btn btn-warning" onclick="window.previewBulkDiscount()">👁️ Preview</button>
                                <button class="btn btn-primary" onclick="window.applyBulkDiscountToClass()">🎁 Apply Discount</button>
                            </div>
                            <div id="bulk-discount-preview" style="margin-top:16px; display:none"></div>
                        </div>

                        <div id="discount-rules-tab" style="display:none">
                            <div class="alert alert-info">Create reusable discount rules for different scenarios.</div>
                            <div id="discount-rules-list"></div>
                        </div>
                    </div>
                </div>
            `;

            await loadDiscountRules();
        }

        /**
         * Loads discount rules from the 'discounts' table and renders them
         * into #discount-rules-list.
         */
        async function loadDiscountRules() {
            const container = document.getElementById('discount-rules-list');
            if (!container) return;
            container.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
            let discounts = [];
            try { const r = await apiRequest('discounts?order=created_at.desc&limit=200'); discounts = r.success ? r.data : []; } catch (e) { }
            state.discounts = discounts;
            if (!discounts.length) {
                container.innerHTML = '<div class="alert alert-info">No discount rules created yet.</div>';
                return;
            }
            container.innerHTML = `
                <table class="data-table">
                    <thead><tr><th>Name</th><th>Applies To</th><th>Type</th><th>Value</th><th>Condition</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${discounts.map(d => {
                const cat = state.feeCategories.find(c => c.id === d.fee_category_id);
                return `<tr>
                                <td><strong>${esc(d.name)}</strong></td>
                                <td>${esc(cat?.name || 'All Fees')}</td>
                                <td>${d.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</td>
                                <td>${d.discount_type === 'percentage' ? d.discount_value + '%' : fmtCurrency(d.discount_value)}</td>
                                <td>${esc(d.condition || 'always')}</td>
                                <td><span class="badge ${d.is_active !== false ? 'badge-success' : 'badge-danger'}">${d.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                <td><button class="btn btn-sm btn-danger" onclick="window._deleteDiscountRule(${d.id})">🗑️</button></td>
                            </tr>`;
            }).join('')}
                    </tbody>
                </table>
            `;
            window._deleteDiscountRule = async (id) => {
                if (!await confirmDialog('Delete this discount rule?')) return;
                const r = await apiRequest('discounts?id=eq.' + id, 'DELETE');
                if (r.success) { showToast('✅ Discount rule deleted', 'success'); await loadDiscountRules(); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 45 — STAFF MANAGEMENT
