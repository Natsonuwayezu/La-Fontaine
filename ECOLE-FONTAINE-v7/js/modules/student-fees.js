// js/modules/student-fees.js
// Student Fees Module - Manage individual student fee balances and payments

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, fmtPct, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';

export async function renderStudentFees(container) {
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
                <span class="dash-card-title">💳 Student Fee Balances</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportStudentFeeBalances()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printFeeReport()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="stf-class" class="form-control" style="width:180px" onchange="window.renderStudentFeesTable()">
                        <option value="">All Classes</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="stf-status" class="form-control" style="width:150px" onchange="window.renderStudentFeesTable()">
                        <option value="">All Status</option>
                        <option value="has_balance">Has Balance 🔴</option>
                        <option value="paid">Paid ✅</option>
                        <option value="credit">Has Credit ⭐</option>
                    </select>
                    <input type="text" id="stf-search" class="form-control flex-1" placeholder="🔍 Search student name or code..." oninput="window.renderStudentFeesTable()">
                    <span class="result-count" id="stf-count"></span>
                </div>
                
                <div class="table-wrapper" id="stf-table-container">
                    <div class="loading-container"><div class="spinner"></div><p>Loading student fees...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Fee Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="fee-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading summary...</p></div>
                </div>
            </div>
        </div>
    `;

    window.renderStudentFeesTable = renderStudentFeesTable;
    window.exportStudentFeeBalances = exportStudentFeeBalances;
    window.printFeeReport = printFeeReport;
    window.openStudentFeeDetails = openStudentFeeDetails;

    await renderStudentFeesTable();
    await renderFeeSummary();
}

async function renderStudentFeesTable() {
    const classFilter = document.getElementById('stf-class')?.value;
    const statusFilter = document.getElementById('stf-status')?.value;
    const search = document.getElementById('stf-search')?.value.toLowerCase();
    const container = document.getElementById('stf-table-container');

    if (!container) return;

    let students = state.students.filter(s => s.status === 'Active');
    if (classFilter) students = students.filter(s => s.class_id == classFilter);
    if (search) students = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search) ||
        (s.student_code || '').toLowerCase().includes(search)
    );

    const feeData = [];
    for (const student of students) {
        const balance = getFullStudentBalance(student.id);
        const credit = getStudentCreditBalance(student.id);

        let include = true;
        if (statusFilter === 'has_balance' && balance.balance <= 0) include = false;
        if (statusFilter === 'paid' && balance.balance !== 0) include = false;
        if (statusFilter === 'credit' && credit.available <= 0) include = false;

        if (include) {
            feeData.push({
                student: student,
                cls: getClassById(student.class_id),
                balance: balance,
                credit: credit
            });
        }
    }

    feeData.sort((a, b) => b.balance.balance - a.balance.balance);

    const countSpan = document.getElementById('stf-count');
    if (countSpan) countSpan.textContent = `${feeData.length} student${feeData.length !== 1 ? 's' : ''}`;

    if (feeData.length === 0) {
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
                    <th style="text-align:right">Paid</th>
                    <th style="text-align:right">Balance</th>
                    <th style="text-align:center">%</th>
                    <th style="text-align:center">Credit</th>
                    <th style="text-align:center">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${feeData.map(data => {
        const s = data.student;
        const cls = data.cls;
        const bal = data.balance;
        const credit = data.credit;
        const balanceColor = bal.balance > 0 ? 'var(--danger)' : (bal.balance < 0 ? 'var(--success)' : 'var(--text-muted)');

        return `
                        <tr>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
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
                                    <button class="btn btn-sm btn-outline" onclick="window.openStudentFeeDetails(${s.id})" title="View Details">👁️</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.openManualBalanceModal(${s.id}, '${esc(s.first_name)} ${esc(s.last_name)}')" title="Adjust Balance">⚙️</button>
                                </div>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function renderFeeSummary() {
    const container = document.getElementById('fee-summary-stats');
    if (!container) return;

    const activeStudents = state.students.filter(s => s.status === 'Active');
    let totalFees = 0;
    let totalPaid = 0;
    let totalCredit = 0;
    let studentsWithBalance = 0;
    let fullyPaid = 0;

    for (const student of activeStudents) {
        const balance = getFullStudentBalance(student.id);
        const credit = getStudentCreditBalance(student.id);
        totalFees += balance.total;
        totalPaid += balance.paid;
        if (balance.balance > 0) studentsWithBalance++;
        if (balance.balance === 0 && balance.total > 0) fullyPaid++;
        if (credit.available > 0) totalCredit += credit.available;
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
            <div class="stat-trend up">${collectionRate.toFixed(1)}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${fmtCurrency(outstanding)}</div>
            <div class="stat-label">Outstanding Balance</div>
            <div class="stat-trend down">${studentsWithBalance} students</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${fullyPaid}</div>
            <div class="stat-label">Fully Paid Students</div>
        </div>
    `;
}

function openStudentFeeDetails(studentId) {
    const student = getStudentById(studentId);
    if (!student) return;

    const fees = state.studentFees.filter(f => f.student_id === studentId && !f.is_credit);
    const payments = state.payments.filter(p => p.student_id === studentId);
    const balance = getFullStudentBalance(studentId);

    const feeRows = fees.map(fee => {
        const cat = state.feeCategories.find(c => c.id === fee.fee_category_id);
        const remaining = fee.amount - (fee.paid_amount || 0);
        return `
            <tr>
                <td>${esc(cat?.name || 'Unknown')}</span>
                <td style="text-align:right">${fmtCurrency(fee.amount)}</span>
                <td style="text-align:right">${fmtCurrency(fee.paid_amount || 0)}</span>
                <td style="text-align:right; ${remaining > 0 ? 'color:var(--danger); font-weight:600' : ''}">${fmtCurrency(remaining)}</span>
                <td style="text-align:center">${fee.is_waived ? '✅ Waived' : (fee.is_paid ? '✅ Paid' : (fee.paid_amount > 0 ? '⚠️ Partial' : '🔴 Due'))}</span>
            </tr>
        `;
    }).join('');

    const paymentRows = payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(p => `
        <tr>
            <td>${fmtDate(p.payment_date || p.created_at)}</span>
            <td style="text-align:right">${fmtCurrency(p.amount)}</span>
            <td>${esc(p.payment_method || '—')}</span>
            <td><code>${esc(p.receipt_number || '—')}</code></span>
        </tr>
    `).join('');

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 800px; max-height: 80vh; overflow-y: auto">
                <div class="modal-header">
                    <h3>💰 Fee Details - ${esc(student.first_name)} ${esc(student.last_name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px; margin-bottom:16px">
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; text-align:center">
                            <div><div style="font-size:11px">Total Fees</div><div style="font-size:18px; font-weight:700">${fmtCurrency(balance.total)}</div></div>
                            <div><div style="font-size:11px">Total Paid</div><div style="font-size:18px; font-weight:700; color:var(--success)">${fmtCurrency(balance.paid)}</div></div>
                            <div><div style="font-size:11px">Outstanding</div><div style="font-size:18px; font-weight:700; ${balance.balance > 0 ? 'color:var(--danger)' : ''}">${fmtCurrency(balance.balance)}</div></div>
                        </div>
                    </div>
                    
                    <h4>📋 Fee Breakdown</h4>
                    <div class="table-wrapper" style="margin-bottom:20px">
                        <table class="data-table">
                            <thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Remaining</th><th>Status</th></tr></thead>
                            <tbody>${feeRows || '<td><td colspan="5" style="text-align:center;padding:20px">No fees recorded</span>'`}</tbody>
                        </table>
                    </div>
                    
                    <h4>📜 Payment History</h4>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead><tr><th>Date</th><th style="text-align:right">Amount</th><th>Method</th><th>Receipt #</th></tr></thead>
                            <tbody>${paymentRows} || '<td><td colspan="4" style="text-align:center;padding:20px">No payments recorded</span>'`}</tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal(); window.openRecordPaymentForStudent(${studentId})">💰 Record Payment</button>
                </div>
            </div>
        </div>
    `);
}

function exportStudentFeeBalances() {
    const data = state.students.filter(s => s.status === 'Active').map(s => {
        const b = getFullStudentBalance(s.id);
        return {
            'Student': `${s.first_name} ${s.last_name}`,
            'Student Code': s.student_code,
            'Class': getClassById(s.class_id)?.name,
            'Total Fees (RWF)': b.total,
            'Paid (RWF)': b.paid,
            'Balance (RWF)': b.balance,
            'Collection Rate %': b.pct.toFixed(1)
        };
    });
    exportToExcel(data, 'Student_Fee_Balances');
}

function printFeeReport() {
    const table = document.querySelector('#stf-table-container table');
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
}

// Helper functions
export function getStudentById(id) {
    return state.students.find(s => s.id == id) || null;
}

export function getClassById(id) {
    return state.classes.find(c => c.id == id) || null;
}

export function getTeacherById(id) {
    return state.teachers.find(t => t.id == id) || null;
}

export function getSubjectById(id) {
    return state.subjects.find(s => s.id == id) || null;
}

export function getTermById(id) {
    return state.terms.find(t => t.id == id) || null;
}

export function getFullStudentBalance(studentId) {
    const fees = state.studentFees.filter(f => f.student_id == studentId && !f.is_waived && !f.is_credit);
    const paidFromFees = fees.reduce((a, f) => a + (f.paid_amount || 0), 0);
    const payments = state.payments.filter(p => p.student_id == studentId);
    const totalPaidFromPayments = payments.reduce((a, p) => a + p.amount, 0);
    const effectivePaid = Math.max(paidFromFees, totalPaidFromPayments);
    const total = fees.reduce((a, f) => a + f.amount, 0);
    const rawBalance = total - effectivePaid;
    const balance = Math.max(0, rawBalance);
    const credit = Math.max(0, -rawBalance);
    const pct = total > 0 ? Math.min(100, (effectivePaid / total) * 100) : (effectivePaid > 0 ? 100 : 0);
    return { total, paid: effectivePaid, balance, credit, pct };
}

export function getStudentCreditBalance(studentId) {
    const creditFees = state.studentFees.filter(f => f.student_id == studentId && f.is_credit === true);
    const totalCredit = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
    const usedCredit = creditFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
    const available = totalCredit - usedCredit;
    return { total: totalCredit, used: usedCredit, available: Math.max(0, available) };
}

export async function updateStudentCredit(studentId, newCreditAmount) {
    const creditFees = state.studentFees.filter(f => f.student_id == studentId && f.is_credit === true);
    if (creditFees.length === 0 && newCreditAmount > 0) {
        await insert('student_fees', {
            student_id: studentId, fee_category_id: null,
            term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id,
            amount: 0, paid_amount: 0, is_paid: false, is_waived: false,
            is_credit: true, credit_amount: newCreditAmount,
            notes: 'Credit balance', created_at: new Date().toISOString()
        });
    } else if (creditFees.length > 0) {
        await update('student_fees', creditFees[0].id, {
            credit_amount: newCreditAmount, updated_at: new Date().toISOString()
        });
    }
}

export async function recordCreditAsPayment(studentId, amount, appliedToFeeId, reason) {
    const receiptNum = `CRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
    const payment = await insert('payments', {
        student_id: studentId, amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Credit Balance', receipt_number: receiptNum,
        reference: `Credit applied to fee ID: ${appliedToFeeId}`,
        notes: reason || `Credit balance applied to fee`,
        recorded_by: state.currentUser?.id || null,
        created_at: new Date().toISOString(),
        is_credit_payment: true
    });
    return payment;
}