// js/modules/balances.js
// Balances Module - Student fee balance management and tracking


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

async function renderBalancesTable() {
    const classFilter = document.getElementById('balance-class-filter')?.value;
    const statusFilter = document.getElementById('balance-status-filter')?.value;
    const search = document.getElementById('balance-search')?.value.toLowerCase();
    const container = document.getElementById('balances-table-container');
    
    if (!container) return;
    
    let students = state.students.filter(s => s.status === 'Active');
    
    if (classFilter) students = students.filter(s => s.class_id == classFilter);
    if (search) students = students.filter(s => 
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search) ||
        (s.student_code || '').toLowerCase().includes(search)
    );
    
    // Calculate balances
    const balanceData = [];
    for (const student of students) {
        const balance = getFullStudentBalance(student.id);
        const creditBalance = getStudentCreditBalance(student.id);
        
        let include = true;
        if (statusFilter === 'positive' && balance.balance <= 0) include = false;
        if (statusFilter === 'zero' && balance.balance !== 0) include = false;
        if (statusFilter === 'credit' && creditBalance.available <= 0) include = false;
        
        if (include) {
            balanceData.push({
                student: student,
                cls: getClassById(student.class_id),
                balance: balance,
                credit: creditBalance
            });
        }
    }
    
    // Sort by balance amount (highest first)
    balanceData.sort((a, b) => b.balance.balance - a.balance.balance);
    
    const countSpan = document.getElementById('balance-count');
    if (countSpan) countSpan.textContent = `${balanceData.length} student${balanceData.length !== 1 ? 's' : ''}`;
    
    if (balanceData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No students found</div>';
        return;
    }
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Student Code</th>
                    <th style="text-align:right">Total Fees</th>
                    <th style="text-align:right">Total Paid</th>
                    <th style="text-align:right">Balance</th>
                    <th style="text-align:center">Collection %</th>
                    <th style="text-align:center">Credit Available</th>
                    <th style="text-align:center">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${balanceData.map(data => {
                    const s = data.student;
                    const cls = data.cls;
                    const bal = data.balance;
                    const credit = data.credit;
                    const balanceClass = bal.balance > 0 ? 'balance-positive' : (bal.balance < 0 ? 'balance-negative' : 'balance-zero');
                    const balanceColor = bal.balance > 0 ? 'var(--danger)' : (bal.balance < 0 ? 'var(--success)' : 'var(--text-muted)');
                    
                    return `
                        <tr>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td><code>${esc(s.student_code || '—')}</code></span>
                            <td style="text-align:right">${fmtCurrency(bal.total)}</span>
                            <td style="text-align:right">${fmtCurrency(bal.paid)}</span>
                            <td style="text-align:right; color:${balanceColor}; font-weight:600">${fmtCurrency(bal.balance)}</span>
                            <td style="text-align:center"><span class="badge ${bal.pct >= 100 ? 'badge-success' : bal.pct >= 50 ? 'badge-warning' : 'badge-danger'}">${fmtPct(bal.pct)}</span></span>
                            <td style="text-align:center">${credit.available > 0 ? fmtCurrency(credit.available) : '—'}</span>
                            <td style="text-align:center">
                                <div class="btn-group" style="gap:4px; justify-content:center">
                                    <button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${s.id})" title="Record Payment">💰</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.openManualBalanceModal(${s.id}, '${esc(s.first_name)} ${esc(s.last_name)}')" title="Adjust Balance">⚙️</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.showFeeTermStatus(${s.id})" title="Term Status">📊</button>
                                </div>
                            </span>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function renderBalanceSummary() {
    const container = document.getElementById('balance-summary-stats');
    if (!container) return;
    
    const activeStudents = state.students.filter(s => s.status === 'Active');
    
    let totalFees = 0;
    let totalPaid = 0;
    let totalCredit = 0;
    let studentsWithBalance = 0;
    let studentsWithCredit = 0;
    let fullyPaid = 0;
    
    for (const student of activeStudents) {
        const balance = getFullStudentBalance(student.id);
        const credit = getStudentCreditBalance(student.id);
        
        totalFees += balance.total;
        totalPaid += balance.paid;
        if (balance.balance > 0) studentsWithBalance++;
        if (balance.balance === 0 && balance.total > 0) fullyPaid++;
        if (credit.available > 0) {
            totalCredit += credit.available;
            studentsWithCredit++;
        }
    }
    
    const outstanding = totalFees - totalPaid;
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;
    
    container.innerHTML = `
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
            <div class="stat-value">${fmtCurrency(outstanding)}</div>
            <div class="stat-label">Outstanding Balance</div>
            <div class="stat-trend down">${studentsWithBalance} students</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">${fmtCurrency(totalCredit)}</div>
            <div class="stat-label">Total Credit Available</div>
            <div class="stat-trend neutral">${studentsWithCredit} students</div>
        </div>
    `;
}

function exportBalancesToExcel() {
    const students = state.students.filter(s => s.status === 'Active');
    const data = [];
    
    for (const student of students) {
        const balance = getFullStudentBalance(student.id);
        const credit = getStudentCreditBalance(student.id);
        const cls = getClassById(student.class_id);
        
        data.push({
            'Student Name': `${student.first_name} ${student.last_name}`,
            'Student Code': student.student_code || '',
            'Class': cls?.name || '',
            'Total Fees (RWF)': balance.total,
            'Total Paid (RWF)': balance.paid,
            'Balance (RWF)': balance.balance,
            'Collection Rate %': balance.pct.toFixed(1),
            'Credit Available (RWF)': credit.available,
            'Status': balance.balance === 0 ? (balance.total > 0 ? '✅ Paid' : 'No Fees') : (balance.balance > 0 ? '🔴 Due' : '⭐ Credit')
        });
    }
    
    exportToExcel(data, `Fee_Balances_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Balances exported', 'success');
}

function printBalanceReport() {
    const table = document.querySelector('#balances-table-container table');
    if (!table) {
        showToast('No data to print', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Fee Balances - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Student Fee Balances Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${table.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}s