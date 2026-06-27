// ══════════════════════════════════════════════════════════════════════════


        /**
         * Admin dashboard: school-wide stats, recent activity, quick actions,
         * fee collection chart, student count by class, and alerts.
         */
        async function renderAdminDashboard(container) {
            if (!container) return;

            await ensureStateLoaded();

            const students = state.students || [];
            const active = students.filter(s => s.status === 'Active');
            const termObj = state.currentTerm;
            const termAssess = (state.assessments || []).filter(a => a.term_id === termObj?.id);
            const totalMarks = (state.marks || []).length;
            const weekAgo = new Date(Date.now() - 7 * 86400000);
            const newMarks = (state.marks || []).filter(m => new Date(m.entered_at || m.created_at) >= weekAgo).length;

            // Fee totals - CORRECTED calculation
            let totalFees = 0;
            let totalPaid = 0;

            // Calculate total expected fees from fee_amounts for current academic year
            for (const fa of (state.feeAmounts || [])) {
                if (fa.academic_year_id === state.currentAcadYear?.id) {
                    totalFees += fa.amount;
                }
            }

            // Calculate total collected from payments
            for (const p of (state.payments || [])) {
                // Only count non-refund, non-credit payments
                if (!p.is_refund && !p.is_credit_payment) {
                    totalPaid += p.amount;
                }
            }

            const collRate = totalFees > 0 ? Math.round(totalPaid / totalFees * 100) : 0;

            // Activity logs
            let logs = [];
            try { logs = await getAll('activity_logs'); } catch (e) { logs = []; }
            logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const recent10 = logs.slice(0, 10);

            // Class performance calculation
            const classPerf = (state.classes || []).map(cls => {
                const clsStudents = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');
                const clsAssess = (state.assessments || []).filter(a => a.class_id === cls.id && a.term_id === termObj?.id);
                let totalPct = 0, cnt = 0;

                clsStudents.forEach(st => {
                    let score = 0, max = 0;
                    clsAssess.forEach(a => {
                        const m = (state.marks || []).find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                        if (m) { score += m.score; max += a.max_marks; }
                    });
                    if (max > 0) { totalPct += (score / max) * 100; cnt++; }
                });
                const avg = cnt > 0 ? totalPct / cnt : 0;
                return { name: cls.name, students: clsStudents.length, avg, grade: getGrade(avg) };
            }).filter(c => c.students > 0);

            // Chart data - Fee Collection by Class
            const classNames = (state.classes || []).slice(0, 8).map(c => {
                // Shorten long class names
                let name = c.name;
                if (name.length > 12) name = name.substring(0, 10) + '..';
                return name;
            });

            const expectedData = (state.classes || []).slice(0, 8).map(cls => {
                let total = 0;
                for (const fa of (state.feeAmounts || [])) {
                    if (fa.class_id === cls.id && fa.academic_year_id === state.currentAcadYear?.id) {
                        total += fa.amount;
                    }
                }
                return total / 1000000; // Convert to millions
            });

            const collectedData = (state.classes || []).slice(0, 8).map(cls => {
                let total = 0;
                // Get student IDs in this class
                const studentIds = (state.students || []).filter(s => s.class_id === cls.id).map(s => s.id);
                for (const p of (state.payments || [])) {
                    if (studentIds.includes(p.student_id) && !p.is_refund && !p.is_credit_payment) {
                        total += p.amount;
                    }
                }
                return total / 1000000;
            });

            // Build HTML
            container.innerHTML = `
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">👥</div>
                                <div class="stat-value">${students.length}</div>
                                <div class="stat-label">Total Students</div>
                                <div class="stat-trend neutral">All enrolled</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">✅</div>
                                <div class="stat-value">${active.length}</div>
                                <div class="stat-label">Active Students</div>
                                <div class="stat-trend up">📈 Currently enrolled</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">📝</div>
                                <div class="stat-value">${termAssess.length}</div>
                                <div class="stat-label">Assessments (${state.schoolSettings?.current_term || 'Term 3'})</div>
                                <div class="stat-trend neutral">This term</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">✏️</div>
                                <div class="stat-value">${totalMarks}</div>
                                <div class="stat-label">Total Marks in DB</div>
                                <div class="stat-trend up">+${newMarks} this week</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">💰</div>
                                <div class="stat-value">${fmtCurrency(totalPaid)}</div>
                                <div class="stat-label">Collected Fees</div>
                                <div class="stat-trend ${collRate >= 70 ? 'up' : 'down'}">${collRate}% of total</div>
                            </div>
                        </div>

                        <div class="two-col">
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">💰 Fee Collection by Class</span>
                                    <button class="btn btn-sm btn-outline" onclick="window.exportCollectionByClass && exportCollectionByClass()">📥 Export</button>
                                </div>
                                <div class="dash-card-body">
                                    <canvas id="fee-chart" height="220"></canvas>
                                </div>
                            </div>
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">🔄 Recent Actions (Top 10)</span>
                                    <span style="font-size:.75rem;color:var(--text-muted)">Live from activity log</span>
                                </div>
                                <div class="dash-card-body" style="padding:0">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Action</th><th>By</th><th>When</th></tr></thead>
                                            <tbody>
                                                ${recent10.length ? recent10.map(l =>
                '<tr><td>' + esc(l.action) + '</td><td>' + esc(l.user_role) + '</td><td>' + fmtAgo(l.created_at) + '</td></tr>'
            ).join('') : '<tr><td colspan="3" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No activity yet</td></tr>'}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">📊 Class Performance Summary</span>
                                <button class="btn btn-sm btn-outline" onclick="window.exportClassPerf && exportClassPerf()">📥 Export</button>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead><tr><th>Class</th><th>Students</th><th>Avg %</th><th>Grade</th></tr></thead>
                                        <tbody>
                                            ${classPerf.length ? classPerf.map(c => `
                                                <tr>
                                                    <td><strong>${esc(c.name)}</strong></td>
                                                    <td>${c.students}</td>
                                                    <td><span class="badge ${getGradeClass(c.avg)}">${fmtPct(c.avg)}</span></td>
                                                    <td>${c.grade}</td>
                                                </tr>
                                            `).join('') : `
                                                <tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No performance data yet</td></tr>
                                            `}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">⚡ Quick Actions</span>
                            </div>
                            <div class="dash-card-body">
                                <div class="quick-actions">
                                    <div class="quick-btn" onclick="navigateTo('enroll-student')">
                                        <div class="qb-icon">➕</div>
                                        <div class="qb-title">Enroll Student</div>
                                        <div class="qb-sub">Add new student</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('fee-structure')">
                                        <div class="qb-icon">🏷️</div>
                                        <div class="qb-title">Fee Structure</div>
                                        <div class="qb-sub">Manage fees</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('financial-reports')">
                                        <div class="qb-icon">📊</div>
                                        <div class="qb-title">Reports</div>
                                        <div class="qb-sub">Generate reports</div>
                                    </div>
                                    <div class="quick-btn" onclick="window.promptPromoteStudents && promptPromoteStudents()">
                                        <div class="qb-icon">👥➡️</div>
                                        <div class="qb-title">Promote Students</div>
                                        <div class="qb-sub">Next class</div>
                                    </div>
                                    <div class="quick-btn" onclick="window.doFullBackup && doFullBackup()">
                                        <div class="qb-icon">💾</div>
                                        <div class="qb-title">Backup Data</div>
                                        <div class="qb-sub">Download JSON</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('school-settings')">
                                        <div class="qb-icon">⚙️</div>
                                        <div class="qb-title">Settings</div>
                                        <div class="qb-sub">Configure</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

            // Initialize chart after DOM is ready
            setTimeout(() => {
                const ctx = document.getElementById('fee-chart')?.getContext('2d');
                if (ctx) {
                    // Destroy existing chart if any
                    if (window._feeChart) window._feeChart.destroy();
                    window._feeChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: classNames,
                            datasets: [
                                {
                                    label: 'Expected (M RWF)',
                                    data: expectedData,
                                    backgroundColor: 'rgba(26, 58, 92, 0.6)',
                                    borderRadius: 6,
                                    barPercentage: 0.7
                                },
                                {
                                    label: 'Collected (M RWF)',
                                    data: collectedData,
                                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                                    borderRadius: 6,
                                    barPercentage: 0.7
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}M RWF`
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Millions RWF' }
                                }
                            }
                        }
                    });
                }
            }, 100);
        }


        /**
         * Accountant dashboard: today's collections, outstanding balances,
         * overdue payments, recent transactions, and quick finance links.
         */
        async function renderAccountantDashboard(container) {
            if (!container) return;

            await ensureStateLoaded();

            const currentTerm = state.currentTerm;
            const currentYear = state.currentAcadYear;

            // Calculate totals for current term ONLY
            let totalFees = 0;
            let totalPaid = 0;
            let totalWaived = 0;

            // Get current term fees (non-waived, non-credit)
            const currentTermFees = (state.studentFees || []).filter(f =>
                f.term_id === currentTerm?.id &&
                !f.is_waived &&
                !f.is_credit &&
                !f.manually_deleted
            );

            for (const fee of currentTermFees) {
                totalFees += fee.amount;
                totalPaid += fee.paid_amount || 0;
            }

            // Count waived fees separately
            const waivedFees = (state.studentFees || []).filter(f =>
                f.term_id === currentTerm?.id && f.is_waived === true
            );
            for (const fee of waivedFees) {
                totalWaived += fee.amount;
            }

            // Calculate collection rate
            const effectivePaid = totalPaid;
            const pending = Math.max(0, totalFees - effectivePaid);
            const collectionRate = totalFees > 0 ? (effectivePaid / totalFees) * 100 : 0;

            // Calculate overdue students
            const overdueStudents = [];
            const activeStudents = (state.students || []).filter(s => s.status === 'Active');

            for (const student of activeStudents) {
                // Calculate student's balance for current term
                const studentFees = (state.studentFees || []).filter(f =>
                    f.student_id === student.id &&
                    f.term_id === currentTerm?.id &&
                    !f.is_waived &&
                    !f.is_credit &&
                    !f.manually_deleted
                );
                const studentPaid = studentFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
                const studentTotal = studentFees.reduce((sum, f) => sum + f.amount, 0);
                const balance = studentTotal - studentPaid;

                if (balance <= 0) continue;

                const cls = getClassById(student.class_id);
                const unpaidFees = (state.studentFees || []).filter(f =>
                    f.student_id === student.id &&
                    !f.is_paid &&
                    !f.is_waived &&
                    !f.is_credit &&
                    f.term_id === currentTerm?.id
                );
                const oldest = unpaidFees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

                if (!oldest?.due_date) continue;

                const days = Math.ceil((Date.now() - new Date(oldest.due_date)) / 86400000);
                if (days < 7) continue;

                overdueStudents.push({
                    id: student.id,
                    name: `${student.first_name} ${student.last_name}`,
                    class_name: cls?.name || '—',
                    amount: balance,
                    days: days
                });
            }
            overdueStudents.sort((a, b) => b.days - a.days);

            // Get recent payments (last 10 for current term)
            const recent = [...(state.payments || [])]
                .filter(p => {
                    // Filter by current term date range if term has dates
                    if (currentTerm?.start_date && currentTerm?.end_date && p.payment_date) {
                        return p.payment_date >= currentTerm.start_date && p.payment_date <= currentTerm.end_date;
                    }
                    return true;
                })
                .sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at))
                .slice(0, 10);

            // Calculate collection by class for chart
            const classData = [];
            for (const cls of (state.classes || [])) {
                let expected = 0;
                let collected = 0;

                // Get students in this class
                const studentsInClass = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');

                // Calculate expected and collected for this class (current term)
                for (const student of studentsInClass) {
                    const studentFeesForTerm = (state.studentFees || []).filter(f =>
                        f.student_id === student.id &&
                        f.term_id === currentTerm?.id &&
                        !f.is_waived &&
                        !f.is_credit &&
                        !f.manually_deleted
                    );
                    expected += studentFeesForTerm.reduce((sum, f) => sum + f.amount, 0);
                    collected += studentFeesForTerm.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
                }

                if (expected > 0 || collected > 0) {
                    classData.push({
                        name: cls.name,
                        expected: expected / 1000,
                        collected: collected / 1000,
                        rate: expected > 0 ? (collected / expected) * 100 : 0
                    });
                }
            }
            classData.sort((a, b) => b.rate - a.rate);

            container.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px">
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline" onclick="window.refreshAccountantDashboard && refreshAccountantDashboard()">
                                    🔄 Refresh Data
                                </button>
                                <button class="btn btn-sm btn-outline" onclick="window.exportAccountantDashboard && exportAccountantDashboard()">
                                    📥 Export Report
                                </button>
                            </div>
                            <div style="display:flex; gap:8px; align-items:center">
                                <span class="badge badge-info">📅 ${currentTerm?.name || 'Current Term'} ${currentYear?.name || ''}</span>
                                ${totalWaived > 0 ? `<span class="badge badge-warning">🎁 Waived: ${fmtCurrency(totalWaived)}</span>` : ''}
                            </div>
                        </div>

                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">💵</div>
                                <div class="stat-value">${fmtCurrency(totalFees)}</div>
                                <div class="stat-label">Total Fees (${currentTerm?.name || 'Current Term'})</div>
                                <div class="stat-trend neutral">All categories</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">✅</div>
                                <div class="stat-value">${fmtCurrency(effectivePaid)}</div>
                                <div class="stat-label">Collected</div>
                                <div class="stat-trend up">${fmtPct(collectionRate)} of total</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">⏳</div>
                                <div class="stat-value">${fmtCurrency(pending)}</div>
                                <div class="stat-label">Pending</div>
                                <div class="stat-trend down">${fmtPct(100 - collectionRate)} remaining</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">🔴</div>
                                <div class="stat-value">${overdueStudents.length}</div>
                                <div class="stat-label">Overdue Students</div>
                                <div class="stat-trend down">7+ days late</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">📊</div>
                                <div class="stat-value">${fmtPct(collectionRate)}</div>
                                <div class="stat-label">Collection Rate</div>
                                <div style="background:var(--border-light);border-radius:99px;height:6px;margin-top:8px;overflow:hidden">
                                    <div style="height:100%;width:${Math.min(100, collectionRate)}%;background:var(--accountant-primary);border-radius:99px;"></div>
                                </div>
                            </div>
                        </div>

                        <div class="two-col">
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">📊 Collection by Class (${currentTerm?.name || 'Current Term'})</span>
                                </div>
                                <div class="dash-card-body">
                                    <canvas id="acc-class-chart" height="220"></canvas>
                                </div>
                            </div>
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">💳 Recent Payments (${currentTerm?.name || 'Current Term'})</span>
                                    <button class="btn btn-sm btn-outline" onclick="navigateTo('payment-history')">View All</button>
                                </div>
                                <div class="dash-card-body" style="padding:0">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Receipt</th></tr></thead>
                                            <tbody>
                                                ${recent.length ? recent.map(p => {
                const st = getStudentById(p.student_id);
                return `
                                                        <tr>
                                                            <td style="white-space:nowrap">${fmtDate(p.payment_date || p.created_at)}</td>
                                                            <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</td>
                                                            <td><strong>${fmtCurrency(p.amount)}</strong></td>
                                                            <td><code>${esc(p.receipt_number || '—')}</code></td>
                                                        </tr>
                                                    `;
            }).join('') : `
                                                    <tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No payments recorded this term</td></tr>
                                                `}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">⚠️ Overdue Payments (Action Required)</span>
                                <span style="font-size:.75rem;color:var(--danger)">${overdueStudents.length} students</span>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class</th>
                                                <th style="text-align:right">Balance</th>
                                                <th style="text-align:center">Days Overdue</th>
                                                <th style="text-align:center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${overdueStudents.length ? overdueStudents.map(s => `
                                                <tr>
                                                    <td><strong>${esc(s.name)}</strong></td>
                                                    <td>${esc(s.class_name)}</td>
                                                    <td style="text-align:right">${fmtCurrency(s.amount)}</td>
                                                    <td style="text-align:center">
                                                        <span class="${s.days >= 44 ? 'overdue-critical' : s.days >= 30 ? 'overdue-warning' : 'overdue-mild'}">
                                                            ${s.days} days ${s.days >= 44 ? '🔴' : s.days >= 30 ? '🟠' : '🟡'}
                                                        </span>
                                                    </td>
                                                    <td style="text-align:center">
                                                        <button class="btn btn-sm btn-primary" onclick="localStorage.setItem('elf_pay_student','${s.id}');navigateTo('record-payment')">💰 Pay</button>
                                                    </td>
                                                </tr>
                                            `).join('') : `
                                                <tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">🎉 No overdue payments! All fees are up to date.</td></tr>
                                            `}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">⚡ Quick Actions</span>
                            </div>
                            <div class="dash-card-body">
                                <div class="quick-actions">
                                    <div class="quick-btn" onclick="navigateTo('record-payment')">
                                        <div class="qb-icon">💰</div>
                                        <div class="qb-title">Record Payment</div>
                                        <div class="qb-sub">Add payment</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('receipts')">
                                        <div class="qb-icon">📄</div>
                                        <div class="qb-title">Generate Receipt</div>
                                        <div class="qb-sub">Print PDF</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('student-fees')">
                                        <div class="qb-icon">👥</div>
                                        <div class="qb-title">Student Fees</div>
                                        <div class="qb-sub">View balances</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('fee-structure')">
                                        <div class="qb-icon">🏷️</div>
                                        <div class="qb-title">Fee Structure</div>
                                        <div class="qb-sub">Manage categories</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('financial-reports')">
                                        <div class="qb-icon">📊</div>
                                        <div class="qb-title">Export Report</div>
                                        <div class="qb-sub">Financial summary</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('overdue-payments')">
                                        <div class="qb-icon">⚠️</div>
                                        <div class="qb-title">Overdue</div>
                                        <div class="qb-sub">Follow up</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

            // Initialize chart after DOM is ready
            setTimeout(() => {
                const ctx = document.getElementById('acc-class-chart')?.getContext('2d');
                if (ctx && classData.length) {
                    const labels = classData.map(c => {
                        let name = c.name;
                        if (name.length > 10) name = name.substring(0, 8) + '..';
                        return name;
                    });
                    const expectedData = classData.map(c => c.expected);
                    const collectedData = classData.map(c => c.collected);

                    if (window._accChart) window._accChart.destroy();
                    window._accChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Expected (K RWF)',
                                    data: expectedData,
                                    backgroundColor: 'rgba(13,148,136,0.3)',
                                    borderColor: '#0d9488',
                                    borderWidth: 1,
                                    borderRadius: 6
                                },
                                {
                                    label: 'Collected (K RWF)',
                                    data: collectedData,
                                    backgroundColor: 'rgba(20,184,166,0.6)',
                                    borderColor: '#14b8a6',
                                    borderWidth: 1,
                                    borderRadius: 6
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(0)}K RWF`
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Thousands (RWF)' }
                                }
                            }
                        }
                    });
                }
            }, 100);
        }


        /**
         * Teacher dashboard: my classes, upcoming assessments, recent marks,
         * attendance summary, and quick access to marks entry.
         */
        async function renderTeacherDashboard(container) {
            if (!container) return;

            await ensureStateLoaded();

            const user = getCurrentUser();
            const termObj = state.currentTerm;

            // Get teacher's assigned classes
            let teacherClasses = [];
            if (user.role === 'teacher') {
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                teacherClasses = (state.classes || []).filter(c => classIds.includes(c.id));
            } else {
                teacherClasses = (state.classes || []).filter(c => c.is_active !== false);
            }

            // Class performance calculation for teacher's classes
            const classPerf = teacherClasses.map(cls => {
                const students = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');
                const assessments = (state.assessments || []).filter(a => a.class_id === cls.id && a.term_id === termObj?.id);
                let totalPct = 0, cnt = 0;

                students.forEach(st => {
                    let score = 0, max = 0;
                    assessments.forEach(a => {
                        const mark = (state.marks || []).find(m => m.assessment_id === a.id && m.student_id === st.id);
                        if (mark) { score += mark.score; max += a.max_marks; }
                    });
                    if (max > 0) { totalPct += (score / max) * 100; cnt++; }
                });
                const avg = cnt > 0 ? totalPct / cnt : 0;
                return { name: cls.name, count: students.length, avg, grade: getGrade(avg) };
            });

            // Find pending marks entry
            const pending = [];
            const myAssess = (state.assessments || []).filter(a =>
                a.term_id === termObj?.id && teacherClasses.some(c => c.id === a.class_id)
            );

            for (const assessment of myAssess) {
                const expected = (state.students || []).filter(s => s.class_id === assessment.class_id && s.status === 'Active').length;
                const entered = (state.marks || []).filter(m => m.assessment_id === assessment.id).length;
                if (entered < expected) {
                    const cls = getClassById(assessment.class_id);
                    const sub = getSubjectById(assessment.subject_id);
                    const dueDate = assessment.due_date ? new Date(assessment.due_date) : null;
                    const days = dueDate ? Math.ceil((dueDate - Date.now()) / 86400000) : null;
                    let priority = 'medium';
                    if (days === null) priority = 'medium';
                    else if (days < 0) priority = 'overdue';
                    else if (days <= 3) priority = 'high';

                    pending.push({
                        id: assessment.id,
                        name: assessment.assessment_name,
                        type: assessment.assessment_type,
                        cls: cls?.name,
                        sub: sub?.name,
                        entered,
                        expected,
                        due: assessment.due_date,
                        priority
                    });
                }
            }

            const totalMarksEntered = (state.marks || []).filter(m => {
                const assessment = (state.assessments || []).find(a => a.id === m.assessment_id);
                return assessment && teacherClasses.some(c => c.id === assessment.class_id);
            }).length;

            const avgScore = classPerf.length ? classPerf.reduce((a, c) => a + c.avg, 0) / classPerf.length : 0;
            const totalStudents = classPerf.reduce((a, c) => a + c.count, 0);

            container.innerHTML = `
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">👥</div>
                                <div class="stat-value">${totalStudents}</div>
                                <div class="stat-label">My Students</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">📝</div>
                                <div class="stat-value">${myAssess.length}</div>
                                <div class="stat-label">Assessments</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">✏️</div>
                                <div class="stat-value">${totalMarksEntered}</div>
                                <div class="stat-label">Marks Entered</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">📊</div>
                                <div class="stat-value">${fmtPct(avgScore)}</div>
                                <div class="stat-label">Avg Class Score</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">✅</div>
                                <div class="stat-value">${pending.length}</div>
                                <div class="stat-label">Pending Tasks</div>
                            </div>
                        </div>

                        <div class="two-col">
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">📊 My Classes</span>
                                </div>
                                <div class="dash-card-body" style="padding:0">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Class</th><th>Students</th><th>Avg %</th><th>Grade</th></tr></thead>
                                            <tbody>
                                                ${classPerf.length ? classPerf.map(c => `
                                                    <tr>
                                                        <td><strong>${esc(c.name)}</strong></td>
                                                        <td>${c.count}</td>
                                                        <td><span class="badge ${getGradeClass(c.avg)}">${fmtPct(c.avg)}</span></td>
                                                        <td>${c.grade}</td>
                                                    </tr>
                                                `).join('') : `
                                                    <tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No classes assigned</td></tr>
                                                `}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div class="dash-card">
                                <div class="dash-card-header">
                                    <span class="dash-card-title">⏰ Pending Marks (${pending.length})</span>
                                    <button class="btn btn-sm btn-primary" onclick="navigateTo('marks-entry')">✏️ Enter Marks</button>
                                </div>
                                <div class="dash-card-body" style="padding:0">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Assessment</th><th>Class</th><th>Progress</th><th>Priority</th></tr></thead>
                                            <tbody>
                                                ${pending.length ? pending.slice(0, 8).map(p => `
                                                    <tr>
                                                        <td><strong>${esc(p.name)}</strong><br><small>${esc(p.sub)}</small></td>
                                                        <td>${esc(p.cls)}</span>
                                                        <td>${p.entered}/${p.expected}</span>
                                                        <td><span class="badge ${p.priority === 'overdue' ? 'badge-danger' : p.priority === 'high' ? 'badge-warning' : 'badge-info'}">${p.priority}</span>
                                                    </tr>
                                                `).join('') : `
                                                    <tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No pending tasks 🎉</span></tr>
                                                `}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">⚡ Quick Actions</span>
                            </div>
                            <div class="dash-card-body">
                                <div class="quick-actions">
                                    <div class="quick-btn" onclick="navigateTo('marks-entry')">
                                        <div class="qb-icon">✏️</div>
                                        <div class="qb-title">Enter Marks</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('class-register')">
                                        <div class="qb-icon">📋</div>
                                        <div class="qb-title">Class Register</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('report-cards')">
                                        <div class="qb-icon">📄</div>
                                        <div class="qb-title">Report Cards</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('statistics')">
                                        <div class="qb-icon">📈</div>
                                        <div class="qb-title">Statistics</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('assessments')">
                                        <div class="qb-icon">📝</div>
                                        <div class="qb-title">Assessments</div>
                                    </div>
                                    <div class="quick-btn" onclick="navigateTo('student-list')">
                                        <div class="qb-icon">👥</div>
                                        <div class="qb-title">Students</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        }


        /**
         * Finance overview dashboard: total fees, collected, outstanding,
         * collection rate chart, top owing students, and term comparison.
         */
        async function renderFinanceDashboard(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view finance dashboard.</div > ';
                return;
            }

            // Calculate summary metrics
            const activeStudents = state.students.filter(s => s.status === 'Active');
            let totalFees = 0;
            let totalPaid = 0;
            let totalCredit = 0;
            let studentsWithBalance = 0;
            let overdueCount = 0;
            let monthlyTotals = {};

            for (const student of activeStudents) {
                const balance = await getFullStudentBalance(student.id);
                const credit = getStudentCreditBalance(student.id);
                totalFees += balance.total;
                totalPaid += balance.paid;
                totalCredit += credit.available;
                if (balance.balance > 0) studentsWithBalance++;
            }

            // Calculate overdue payments
            const today = new Date();
            for (const fee of state.studentFees) {
                if (!fee.is_paid && !fee.is_waived && fee.due_date && new Date(fee.due_date) < today) {
                    overdueCount++;
                }
            }

            // Calculate monthly collection trend
            for (const payment of state.payments) {
                const month = (payment.payment_date || payment.created_at || '').slice(0, 7);
                if (month) {
                    monthlyTotals[month] = (monthlyTotals[month] || 0) + payment.amount;
                }
            }

            const months = Object.keys(monthlyTotals).sort().slice(-6);
            const monthlyData = months.map(m => monthlyTotals[m]);

            // Calculate collection by class
            const classData = [];
            for (const cls of state.classes) {
                const classStudents = activeStudents.filter(s => s.class_id === cls.id);
                let classFees = 0;
                let classPaid = 0;
                for (const student of classStudents) {
                    const balance = await getFullStudentBalance(student.id);
                    classFees += balance.total;
                    classPaid += balance.paid;
                }
                if (classFees > 0 || classPaid > 0) {
                    classData.push({
                        name: cls.name,
                        expected: classFees,
                        collected: classPaid,
                        rate: classFees > 0 ? (classPaid / classFees) * 100 : 0
                    });
                }
            }
            classData.sort((a, b) => b.rate - a.rate);

            const totalOutstanding = totalFees - totalPaid;
            const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

            container.innerHTML = `
                            <div class="finance-dashboard">
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-icon">💰</div>
                                        <div class="stat-value">${fmtCurrency(totalFees)}</div>
                                        <div class="stat-label">Total Expected Fees</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">✅</div>
                                        <div class="stat-value">${fmtCurrency(totalPaid)}</div>
                                        <div class="stat-label">Total Collected</div>
                                        <div class="stat-trend up">${collectionRate.toFixed(1)}% of total</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⏳</div>
                                        <div class="stat-value">${fmtCurrency(totalOutstanding)}</div>
                                        <div class="stat-label">Outstanding Balance</div>
                                        <div class="stat-trend down">${studentsWithBalance} students</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⭐</div>
                                        <div class="stat-value">${fmtCurrency(totalCredit)}</div>
                                        <div class="stat-label">Credit Available</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⚠️</div>
                                        <div class="stat-value">${overdueCount}</div>
                                        <div class="stat-label">Overdue Payments</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">📊</div>
                                        <div class="stat-value">${collectionRate.toFixed(1)}%</div>
                                        <div class="stat-label">Collection Rate</div>
                                        <div
                                            style="background:var(--border-light);border-radius:99px;height:6px;margin-top:8px;overflow:hidden">
                                            <div
                                                style="height:100%;width:${collectionRate}%;background:var(--role-primary);border-radius:99px;">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="two-col">
                                    <div class="dash-card">
                                        <div class="dash-card-header">
                                            <span class="dash-card-title">📈 Monthly Collection Trend</span>
                                            <button class="btn btn-sm btn-outline" onclick="exportMonthlyTrend()">📥
                                                Export</button>
                                        </div>
                                        <div class="dash-card-body">
                                            <canvas id="monthly-collection-chart" height="250"></canvas>
                                        </div>
                                    </div>
                                    <div class="dash-card">
                                        <div class="dash-card-header">
                                            <span class="dash-card-title">🏆 Top Performing Classes</span>
                                            <button class="btn btn-sm btn-outline" onclick="exportClassCollection()">📥
                                                Export</button>
                                        </div>
                                        <div class="dash-card-body">
                                            <div class="table-wrapper">
                                                <table class="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Class</th>
                                                            <th style="text-align:right">Expected</th>
                                                            <th style="text-align:right">Collected</th>
                                                            <th style="text-align:center">Rate</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${classData.slice(0, 8).map(c => `
                                                        <tr>
                                                            <td><strong>${esc(c.name)}</strong></span>
                                                            <td style="text-align:right">${fmtCurrency(c.expected)}</span>
                                                            <td style="text-align:right">${fmtCurrency(c.collected)}</span>
                                                            <td style="text-align:center"><span
                                                                    class="badge ${c.rate >= 80 ? 'badge-success' : (c.rate >= 50 ? 'badge-warning' : 'badge-danger')}">${c.rate.toFixed(1)}%</span></span>
                                                        </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="dash-card">
                                    <div class="dash-card-header">
                                        <span class="dash-card-title">⚡ Quick Actions</span>
                                    </div>
                                    <div class="dash-card-body">
                                        <div class="quick-actions">
                                            <div class="quick-btn" onclick="navigateTo('record-payment')">
                                                <div class="qb-icon">💰</div>
                                                <div class="qb-title">Record Payment</div>
                                                <div class="qb-sub">Add payment</div>
                                            </div>
                                            <div class="quick-btn" onclick="navigateTo('payment-history')">
                                                <div class="qb-icon">📜</div>
                                                <div class="qb-title">Payment History</div>
                                                <div class="qb-sub">View all</div>
                                            </div>
                                            <div class="quick-btn" onclick="navigateTo('financial-reports')">
                                                <div class="qb-icon">📊</div>
                                                <div class="qb-title">Financial Reports</div>
                                                <div class="qb-sub">Generate reports</div>
                                            </div>
                                            <div class="quick-btn" onclick="navigateTo('overdue-payments')">
                                                <div class="qb-icon">⚠️</div>
                                                <div class="qb-title">Overdue Payments</div>
                                                <div class="qb-sub">Follow up</div>
                                            </div>
                                            <div class="quick-btn" onclick="navigateTo('fee-structure')">
                                                <div class="qb-icon">🏷️</div>
                                                <div class="qb-title">Fee Structure</div>
                                                <div class="qb-sub">Manage fees</div>
                                            </div>
                                            <div class="quick-btn" onclick="navigateTo('receipts')">
                                                <div class="qb-icon">🧾</div>
                                                <div class="qb-title">Receipts</div>
                                                <div class="qb-sub">Print receipts</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            `;

            // Initialize chart
            setTimeout(() => {
                const ctx = document.getElementById('monthly-collection-chart')?.getContext('2d');
                if (ctx) {
                    if (financeChart) financeChart.destroy();
                    financeChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: months,
                            datasets: [{
                                label: 'Amount Collected (RWF)',
                                data: monthlyData,
                                backgroundColor: '#0d9488',
                                borderRadius: 6,
                                barPercentage: 0.7
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: (ctx) => `${fmtCurrency(ctx.raw)}`
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: (v) => fmtCurrency(v)
                                    }
                                }
                            }
                        }
                    });
                }
            }, 100);

        } // end renderFinanceDashboard




        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 21 — ACADEMICS: MARKS
