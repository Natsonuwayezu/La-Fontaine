// js/modules/finance-reports.js
// Finance Reports Module - Comprehensive financial reporting

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast, showModal } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderFinanceReports(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view financial reports.</div>';
        return;
    }

    const classes = state.classes.filter(c => c.is_active !== false);
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Financial Reports</span>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showReportTab('collection', event)">💰 Collection Report</button>
                    <button class="tab-btn" onclick="window.showReportTab('outstanding', event)">⏳ Outstanding Report</button>
                    <button class="tab-btn" onclick="window.showReportTab('waivers', event)">🎁 Waivers Report</button>
                    <button class="tab-btn" onclick="window.showReportTab('credit', event)">⭐ Credit Report</button>
                    <button class="tab-btn" onclick="window.showReportTab('class', event)">🏛️ Class Summary</button>
                </div>
                
                <div id="collection-report-tab">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Date From</label>
                            <input type="date" id="report-date-from" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Date To</label>
                            <input type="date" id="report-date-to" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Payment Method</label>
                            <select id="report-payment-method" class="form-control">
                                <option value="">All Methods</option>
                                <option value="Cash">Cash</option>
                                <option value="Mobile-Money">Mobile-Money</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                        <div class="form-group" style="align-self:end">
                            <button class="btn btn-primary" onclick="window.generateCollectionReport()">📊 Generate Report</button>
                        </div>
                    </div>
                    <div id="collection-report-content" class="table-wrapper"></div>
                </div>
                
                <div id="outstanding-report-tab" style="display:none">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Class</label>
                            <select id="outstanding-class" class="form-control">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Minimum Balance</label>
                            <input type="number" id="outstanding-min" class="form-control" placeholder="Min balance" min="0">
                        </div>
                        <div class="form-group" style="align-self:end">
                            <button class="btn btn-primary" onclick="window.generateOutstandingReport()">📊 Generate Report</button>
                        </div>
                    </div>
                    <div id="outstanding-report-content" class="table-wrapper"></div>
                </div>
                
                <div id="waivers-report-tab" style="display:none">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Date From</label>
                            <input type="date" id="waiver-date-from" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Date To</label>
                            <input type="date" id="waiver-date-to" class="form-control">
                        </div>
                        <div class="form-group" style="align-self:end">
                            <button class="btn btn-primary" onclick="window.generateWaiversReport()">📊 Generate Report</button>
                        </div>
                    </div>
                    <div id="waivers-report-content" class="table-wrapper"></div>
                </div>
                
                <div id="credit-report-tab" style="display:none">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Class</label>
                            <select id="credit-class" class="form-control">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="align-self:end">
                            <button class="btn btn-primary" onclick="window.generateCreditReport()">📊 Generate Report</button>
                        </div>
                    </div>
                    <div id="credit-report-content" class="table-wrapper"></div>
                </div>
                
                <div id="class-report-tab" style="display:none">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Term</label>
                            <select id="class-term" class="form-control">
                                <option value="">All Terms</option>
                                ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="align-self:end">
                            <button class="btn btn-primary" onclick="window.generateClassReport()">📊 Generate Report</button>
                        </div>
                    </div>
                    <div id="class-report-content" class="table-wrapper"></div>
                </div>
            </div>
        </div>
    `;

    window.showReportTab = showReportTab;
    window.generateCollectionReport = generateCollectionReport;
    window.generateOutstandingReport = generateOutstandingReport;
    window.generateWaiversReport = generateWaiversReport;
    window.generateCreditReport = generateCreditReport;
    window.generateClassReport = generateClassReport;
}

function showReportTab(tabName, event) {
    const tabs = ['collection', 'outstanding', 'waivers', 'credit', 'class'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-report-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

async function generateCollectionReport() {
    const dateFrom = document.getElementById('report-date-from')?.value;
    const dateTo = document.getElementById('report-date-to')?.value;
    const paymentMethod = document.getElementById('report-payment-method')?.value;
    const container = document.getElementById('collection-report-content');

    let payments = [...state.payments];
    if (dateFrom) payments = payments.filter(p => (p.payment_date || p.created_at) >= dateFrom);
    if (dateTo) payments = payments.filter(p => (p.payment_date || p.created_at) <= dateTo);
    if (paymentMethod) payments = payments.filter(p => p.payment_method === paymentMethod);

    payments.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    if (payments.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No payments found for selected criteria</div>';
        return;
    }

    container.innerHTML = `
        <div class="alert alert-info" style="margin-bottom:16px">
            <strong>Summary:</strong> ${payments.length} payment(s) | Total: ${fmtCurrency(totalAmount)}
        </div>
        <table class="data-table">
            <thead>
                <tr><th>Date</th><th>Receipt #</th><th>Student</th><th>Class</th><th>Amount</th><th>Method</th><th>Reference</th></tr>
            </thead>
            <tbody>
                ${payments.map(p => {
        const st = getStudentById(p.student_id);
        const cls = st ? getClassById(st.class_id) : null;
        return `
                        <tr>
                            <td>${fmtDate(p.payment_date || p.created_at)}</span>
                            <td><code>${esc(p.receipt_number || '—')}</code></span>
                            <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td style="text-align:right; font-weight:700">${fmtCurrency(p.amount)}</span>
                            <td>${esc(p.payment_method || '—')}</span>
                            <td>${esc(p.reference || '—')}</span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:var(--bg-tertiary); font-weight:700">
                    <td colspan="4" style="text-align:right">TOTAL:</td>
                    <td style="text-align:right">${fmtCurrency(totalAmount)}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
    `;
}

async function generateOutstandingReport() {
    const classFilter = document.getElementById('outstanding-class')?.value;
    const minBalance = parseFloat(document.getElementById('outstanding-min')?.value) || 0;
    const container = document.getElementById('outstanding-report-content');

    let students = state.students.filter(s => s.status === 'Active');
    if (classFilter) students = students.filter(s => s.class_id == classFilter);

    const outstandingData = [];
    let totalOutstanding = 0;

    for (const student of students) {
        const balance = getFullStudentBalance(student.id);
        if (balance.balance >= minBalance) {
            outstandingData.push({
                student: student,
                class: getClassById(student.class_id),
                balance: balance
            });
            totalOutstanding += balance.balance;
        }
    }

    outstandingData.sort((a, b) => b.balance.balance - a.balance.balance);

    if (outstandingData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No outstanding balances found</div>';
        return;
    }

    container.innerHTML = `
        <div class="alert alert-warning" style="margin-bottom:16px">
            <strong>Summary:</strong> ${outstandingData.length} student(s) | Total Outstanding: ${fmtCurrency(totalOutstanding)}
        </div>
        <table class="data-table">
            <thead>
                <td><th>Student</th><th>Class</th><th>Student Code</th><th style="text-align:right">Total Fees</th><th style="text-align:right">Paid</th><th style="text-align:right">Outstanding</th><th>%</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${outstandingData.map(data => {
        const s = data.student;
        const cls = data.class;
        const bal = data.balance;
        return `
                        <tr>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td>${esc(s.student_code || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(bal.total)}</span>
                            <td style="text-align:right">${fmtCurrency(bal.paid)}</span>
                            <td style="text-align:right; color:var(--danger); font-weight:700">${fmtCurrency(bal.balance)}</span>
                            <td style="text-align:center">${bal.pct.toFixed(1)}%</span>
                            <td style="text-align:center">
                                <button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${s.id})">💰 Pay</button>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function generateWaiversReport() {
    const dateFrom = document.getElementById('waiver-date-from')?.value;
    const dateTo = document.getElementById('waiver-date-to')?.value;
    const container = document.getElementById('waivers-report-content');

    let waivers = state.studentFees.filter(f => f.is_waived === true);
    if (dateFrom) waivers = waivers.filter(w => w.created_at >= dateFrom);
    if (dateTo) waivers = waivers.filter(w => w.created_at <= `${dateTo}T23:59:59`);

    const totalWaived = waivers.reduce((sum, w) => sum + w.amount, 0);

    if (waivers.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No waivers found for selected criteria</div>';
        return;
    }

    container.innerHTML = `
        <div class="alert alert-info" style="margin-bottom:16px">
            <strong>Summary:</strong> ${waivers.length} waiver(s) | Total Waived: ${fmtCurrency(totalWaived)}
        </div>
        <table class="data-table">
            <thead>
                <tr><th>Date</th><th>Student</th><th>Class</th><th>Fee Category</th><th style="text-align:right">Amount</th><th>Reason</th></tr>
            </thead>
            <tbody>
                ${waivers.map(w => {
        const st = getStudentById(w.student_id);
        const cls = st ? getClassById(st.class_id) : null;
        const cat = state.feeCategories.find(c => c.id === w.fee_category_id);
        return `
                        <tr>
                            <td>${fmtDate(w.created_at)}</span>
                            <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td>${esc(cat?.name || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(w.amount)}</span>
                            <td>${esc(w.waiver_reason || '—')}</span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function generateCreditReport() {
    const classFilter = document.getElementById('credit-class')?.value;
    const container = document.getElementById('credit-report-content');

    let students = state.students.filter(s => s.status === 'Active');
    if (classFilter) students = students.filter(s => s.class_id == classFilter);

    const creditData = [];
    let totalCredit = 0;

    for (const student of students) {
        const creditFees = state.studentFees.filter(f => f.student_id === student.id && f.is_credit === true);
        const creditAmount = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
        const usedCredit = creditFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        const available = creditAmount - usedCredit;

        if (available > 0) {
            creditData.push({
                student: student,
                class: getClassById(student.class_id),
                creditAmount: creditAmount,
                usedCredit: usedCredit,
                available: available
            });
            totalCredit += available;
        }
    }

    creditData.sort((a, b) => b.available - a.available);

    if (creditData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No credit balances found</div>';
        return;
    }

    container.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:16px">
            <strong>Summary:</strong> ${creditData.length} student(s) | Total Refundable Credit: ${fmtCurrency(totalCredit)}
        </div>
        <table class="data-table">
            <thead>
                <tr><th>Student</th><th>Class</th><th style="text-align:right">Total Credit</th><th style="text-align:right">Used</th><th style="text-align:right">Available</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${creditData.map(data => {
        const s = data.student;
        const cls = data.class;
        return `
                        <tr>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(data.creditAmount)}</span>
                            <td style="text-align:right">${fmtCurrency(data.usedCredit)}</span>
                            <td style="text-align:right; color:var(--success); font-weight:700">${fmtCurrency(data.available)}</span>
                            <td style="text-align:center">
                                <button class="btn btn-sm btn-primary" onclick="window.openCreditRefundModal(${s.id}, ${data.available})">💰 Refund</button>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function generateClassReport() {
    const termId = document.getElementById('class-term')?.value;
    const container = document.getElementById('class-report-content');

    const classes = state.classes.filter(c => c.is_active !== false);
    const reportData = [];
    let totalFeesAll = 0;
    let totalPaidAll = 0;

    for (const cls of classes) {
        const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
        let classFees = 0;
        let classPaid = 0;

        for (const student of students) {
            let fees = state.studentFees.filter(f => f.student_id === student.id && !f.is_waived && !f.is_credit);
            if (termId) fees = fees.filter(f => f.term_id == termId);

            classFees += fees.reduce((sum, f) => sum + f.amount, 0);
            classPaid += fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        }

        totalFeesAll += classFees;
        totalPaidAll += classPaid;

        reportData.push({
            name: cls.name,
            students: students.length,
            totalFees: classFees,
            totalPaid: classPaid,
            outstanding: classFees - classPaid,
            rate: classFees > 0 ? (classPaid / classFees) * 100 : 0
        });
    }

    reportData.sort((a, b) => b.outstanding - a.outstanding);

    if (reportData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No class data available</div>';
        return;
    }

    container.innerHTML = `
        <div class="alert alert-info" style="margin-bottom:16px">
            <strong>Summary:</strong> ${reportData.length} class(es) | Total Fees: ${fmtCurrency(totalFeesAll)} | Total Collected: ${fmtCurrency(totalPaidAll)} | Overall Rate: ${totalFeesAll > 0 ? ((totalPaidAll / totalFeesAll) * 100).toFixed(1) : 0}%
        </div>
        <table class="data-table">
            <thead>
                <tr><th>Class</th><th>Students</th><th style="text-align:right">Total Fees</th><th style="text-align:right">Collected</th><th style="text-align:right">Outstanding</th><th style="text-align:center">Rate</th><th>Status</th></tr>
            </thead>
            <tbody>
                ${reportData.map(data => {
        const rateClass = data.rate >= 80 ? 'badge-success' : (data.rate >= 50 ? 'badge-warning' : 'badge-danger');
        const status = data.outstanding === 0 ? '✅ Fully Paid' : (data.rate > 0 ? '⚠️ Partial' : '🔴 Due');
        return `
                        <tr>
                            <td><strong>${esc(data.name)}</strong></span>
                            <td style="text-align:center">${data.students}</span>
                            <td style="text-align:right">${fmtCurrency(data.totalFees)}</span>
                            <td style="text-align:right">${fmtCurrency(data.totalPaid)}</span>
                            <td style="text-align:right; ${data.outstanding > 0 ? 'color:var(--danger); font-weight:700' : ''}">${fmtCurrency(data.outstanding)}</span>
                            <td style="text-align:center"><span class="badge ${rateClass}">${data.rate.toFixed(1)}%</span></span>
                            <td style="text-align:center">${status}</span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}