// js/modules/credit-balances.js
// Credit Balances Module - Manage student credit balances and refunds

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance, getStudentCreditBalance, updateStudentCredit } from './student-fees.js';

export async function renderCreditBalances(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view credit balances.</div>';
        return;
    }

    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">⭐ Credit Balances Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportCreditBalances()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="credit-class-filter" class="form-control" style="width:180px" onchange="window.renderCreditTable()">
                        <option value="">All Classes</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="credit-status-filter" class="form-control" style="width:150px" onchange="window.renderCreditTable()">
                        <option value="">All Status</option>
                        <option value="has_credit">Has Credit ⭐</option>
                        <option value="no_credit">No Credit</option>
                    </select>
                    <input type="text" id="credit-search" class="form-control flex-1" placeholder="🔍 Search student..." oninput="window.renderCreditTable()">
                    <span class="result-count" id="credit-count"></span>
                </div>
                
                <div class="table-wrapper" id="credit-table-container">
                    <div class="loading-container"><div class="spinner"></div><p>Loading credit balances...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Credit Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="credit-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                </div>
            </div>
        </div>
    `;

    window.renderCreditTable = renderCreditTable;
    window.exportCreditBalances = exportCreditBalances;
    window.openCreditRefundModal = openCreditRefundModal;
    window.adjustCreditBalance = adjustCreditBalance;

    await renderCreditTable();
    await renderCreditSummary();
}

async function renderCreditTable() {
    const classFilter = document.getElementById('credit-class-filter')?.value;
    const statusFilter = document.getElementById('credit-status-filter')?.value;
    const search = document.getElementById('credit-search')?.value.toLowerCase();
    const container = document.getElementById('credit-table-container');

    if (!container) return;

    let students = state.students.filter(s => s.status === 'Active');

    if (classFilter) students = students.filter(s => s.class_id == classFilter);
    if (search) students = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search) ||
        (s.student_code || '').toLowerCase().includes(search)
    );

    const creditData = [];
    for (const student of students) {
        const credit = getStudentCreditBalance(student.id);
        const balance = getFullStudentBalance(student.id);

        let include = true;
        if (statusFilter === 'has_credit' && credit.available <= 0) include = false;
        if (statusFilter === 'no_credit' && credit.available > 0) include = false;

        if (include && (credit.total > 0 || credit.available > 0)) {
            creditData.push({
                student: student,
                cls: getClassById(student.class_id),
                credit: credit,
                balance: balance
            });
        }
    }

    creditData.sort((a, b) => b.credit.available - a.credit.available);

    const countSpan = document.getElementById('credit-count');
    if (countSpan) countSpan.textContent = `${creditData.length} student${creditData.length !== 1 ? 's' : ''} with credit`;

    if (creditData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No students with credit balances found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Student Code</th>
                    <th style="text-align:right">Total Credit</th>
                    <th style="text-align:right">Used Credit</th>
                    <th style="text-align:right">Available Credit</th>
                    <th style="text-align:right">Outstanding Balance</th>
                    <th style="text-align:center">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${creditData.map(data => {
        const s = data.student;
        const cls = data.cls;
        const credit = data.credit;
        const balance = data.balance;

        return `
                        <tr>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td><code>${esc(s.student_code || '—')}</code></span>
                            <td style="text-align:right">${fmtCurrency(credit.total)}</span>
                            <td style="text-align:right">${fmtCurrency(credit.used)}</span>
                            <td style="text-align:right; color:var(--success); font-weight:600">${fmtCurrency(credit.available)}</span>
                            <td style="text-align:right; ${balance.balance > 0 ? 'color:var(--danger)' : ''}">${fmtCurrency(balance.balance)}</span>
                            <td style="text-align:center">
                                <div class="btn-group" style="gap:4px; justify-content:center">
                                    <button class="btn btn-sm btn-primary" onclick="window.openCreditRefundModal(${s.id}, ${credit.available})" title="Process Refund">💰 Refund</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.adjustCreditBalance(${s.id})" title="Adjust Credit">⚙️ Adjust</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.showCreditHistory(${s.id})" title="View History">📜</button>
                                </div>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function renderCreditSummary() {
    const container = document.getElementById('credit-summary-stats');
    if (!container) return;

    const activeStudents = state.students.filter(s => s.status === 'Active');

    let totalCredit = 0;
    let totalUsed = 0;
    let studentsWithCredit = 0;
    let totalRefundable = 0;

    for (const student of activeStudents) {
        const credit = getStudentCreditBalance(student.id);
        if (credit.total > 0) {
            totalCredit += credit.total;
            totalUsed += credit.used;
            totalRefundable += credit.available;
            studentsWithCredit++;
        }
    }

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">${fmtCurrency(totalCredit)}</div>
            <div class="stat-label">Total Credit Issued</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-value">${fmtCurrency(totalUsed)}</div>
            <div class="stat-label">Credit Used</div>
            <div class="stat-trend up">Applied to fees</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-value">${fmtCurrency(totalRefundable)}</div>
            <div class="stat-label">Refundable Credit</div>
            <div class="stat-trend neutral">Available for refund</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${studentsWithCredit}</div>
            <div class="stat-label">Students with Credit</div>
        </div>
    `;
}

function openCreditRefundModal(studentId, creditAmount) {
    const student = getStudentById(studentId);
    if (!student || creditAmount <= 0) {
        showToast('No credit balance available for refund', 'warning');
        return;
    }

    showModal(`
        <div class="modal-overlay" id="credit-refund-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>💰 Credit Balance Refund</h3>
                    <button class="modal-close" onclick="closeModal('credit-refund-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <strong>Student:</strong> ${esc(student.first_name)} ${esc(student.last_name)}<br>
                        <strong>Available Credit:</strong> <span style="color:var(--success);font-size:18px;font-weight:700">${fmtCurrency(creditAmount)}</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Refund Amount (RWF)</label>
                            <input type="number" id="refund-amount" class="form-control" min="0" max="${creditAmount}" step="1000" value="${creditAmount}" oninput="window.validateRefundAmount(${creditAmount})">
                            <small id="refund-max-hint" style="color:var(--text-muted)">Max: ${fmtCurrency(creditAmount)}</small>
                        </div>
                        <div class="form-group full">
                            <label>Refund Method</label>
                            <select id="refund-method" class="form-control">
                                <option value="Cash">💵 Cash</option>
                                <option value="Bank Transfer">🏦 Bank Transfer</option>
                                <option value="Mobile-Money">📱 Mobile-Money</option>
                                <option value="Cheque">📄 Cheque</option>
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Reference / Transaction ID</label>
                            <input type="text" id="refund-reference" class="form-control" placeholder="Optional reference number">
                        </div>
                        <div class="form-group full">
                            <label>Reason for Refund</label>
                            <textarea id="refund-reason" class="form-control" rows="2" placeholder="e.g., Overpayment refund, Parent request, etc."></textarea>
                        </div>
                    </div>
                    <div class="alert alert-warning" style="margin-top:12px">
                        ⚠️ This will create a negative payment record (refund) and reduce the student's credit balance.
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('credit-refund-modal')">Cancel</button>
                    <button class="btn btn-danger" onclick="window.processCreditRefund(${studentId})">💰 Process Refund</button>
                </div>
            </div>
        </div>
    `);

    window.validateRefundAmount = (maxAmount) => {
        const input = document.getElementById('refund-amount');
        const amount = parseFloat(input.value);
        if (isNaN(amount) || amount < 0) input.value = 0;
        if (amount > maxAmount) {
            input.value = maxAmount;
            showToast(`Maximum refund amount is ${fmtCurrency(maxAmount)}`, 'warning');
        }
    };

    window.processCreditRefund = async (studentId) => {
        const amount = parseFloat(document.getElementById('refund-amount')?.value);
        const method = document.getElementById('refund-method')?.value;
        const reference = document.getElementById('refund-reference')?.value.trim();
        const reason = document.getElementById('refund-reason')?.value.trim();

        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid refund amount', 'warning');
            return;
        }

        const student = getStudentById(studentId);
        const currentCredit = getStudentCreditBalance(studentId).available;

        if (amount > currentCredit) {
            showToast(`Refund amount cannot exceed available credit of ${fmtCurrency(currentCredit)}`, 'warning');
            return;
        }

        if (!await confirmDialog(
            `Process refund of ${fmtCurrency(amount)} for ${student?.first_name} ${student?.last_name}?\n\nMethod: ${method}\nReason: ${reason || 'Not specified'}`
        )) return;

        try {
            const receiptNum = `RFD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;

            const refundPayment = await insert('payments', {
                student_id: studentId,
                amount: -amount,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: method,
                receipt_number: receiptNum,
                reference: reference || `Refund for overpayment`,
                notes: reason || `Credit balance refund`,
                recorded_by: state.currentUser?.id,
                created_at: new Date().toISOString(),
                is_refund: true
            });

            const existingCredit = state.studentFees.find(f =>
                f.student_id == studentId && f.is_credit === true && f.term_id === state.currentTerm?.id
            );

            if (existingCredit) {
                const newCreditAmount = (existingCredit.credit_amount || 0) - amount;
                const newPaidAmount = (existingCredit.paid_amount || 0) - amount;

                if (newCreditAmount <= 0) {
                    await remove('student_fees', existingCredit.id);
                } else {
                    await update('student_fees', existingCredit.id, {
                        credit_amount: newCreditAmount,
                        paid_amount: newPaidAmount,
                        updated_at: new Date().toISOString(),
                        notes: `Credit reduced by refund: ${fmtCurrency(amount)}`
                    });
                }
            }

            await refreshTable('payments');
            await refreshTable('student_fees');

            showToast(`✅ Refund of ${fmtCurrency(amount)} processed successfully`, 'success');
            closeModal('credit-refund-modal');

            await renderCreditTable();
            await renderCreditSummary();
        } catch (error) {
            showToast('Error processing refund: ' + error.message, 'error');
        }
    };
}

function adjustCreditBalance(studentId) {
    const student = getStudentById(studentId);
    const currentCredit = getStudentCreditBalance(studentId);

    showModal(`
        <div class="modal-overlay" id="adjust-credit-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>⚙️ Adjust Credit Balance - ${esc(student?.first_name)} ${esc(student?.last_name)}</h3>
                    <button class="modal-close" onclick="closeModal('adjust-credit-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <strong>Current Credit:</strong> ${fmtCurrency(currentCredit.available)}<br>
                        <strong>Total Credit Issued:</strong> ${fmtCurrency(currentCredit.total)}<br>
                        <strong>Credit Used:</strong> ${fmtCurrency(currentCredit.used)}
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Adjustment Type</label>
                            <select id="credit-adjust-type" class="form-control">
                                <option value="add">➕ Add Credit</option>
                                <option value="remove">➖ Remove Credit</option>
                                <option value="set">📝 Set Exact Amount</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Amount (RWF)</label>
                            <input type="number" id="credit-adjust-amount" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group full">
                            <label>Reason</label>
                            <textarea id="credit-adjust-reason" class="form-control" rows="2" placeholder="Reason for adjustment..."></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('adjust-credit-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitCreditAdjustment(${studentId})">Apply Adjustment</button>
                </div>
            </div>
        </div>
    `);

    window.submitCreditAdjustment = async (studentId) => {
        const type = document.getElementById('credit-adjust-type')?.value;
        const amount = parseFloat(document.getElementById('credit-adjust-amount')?.value);
        const reason = document.getElementById('credit-adjust-reason')?.value.trim();

        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        const currentCredit = getStudentCreditBalance(studentId);
        let newCreditAmount = currentCredit.available;

        if (type === 'add') {
            newCreditAmount = currentCredit.available + amount;
        } else if (type === 'remove') {
            if (amount > currentCredit.available) {
                showToast(`Cannot remove more than available credit (${fmtCurrency(currentCredit.available)})`, 'warning');
                return;
            }
            newCreditAmount = currentCredit.available - amount;
        } else if (type === 'set') {
            newCreditAmount = amount;
        }

        const existingCredit = state.studentFees.find(f =>
            f.student_id == studentId && f.is_credit === true && f.term_id === state.currentTerm?.id
        );

        if (existingCredit) {
            const adjustment = newCreditAmount - currentCredit.available;
            await update('student_fees', existingCredit.id, {
                credit_amount: (existingCredit.credit_amount || 0) + adjustment,
                paid_amount: (existingCredit.paid_amount || 0) + adjustment,
                updated_at: new Date().toISOString(),
                notes: reason || `Credit adjustment: ${type} ${fmtCurrency(amount)}`
            });
        } else if (newCreditAmount > 0) {
            await insert('student_fees', {
                student_id: studentId,
                fee_category_id: null,
                term_id: state.currentTerm?.id,
                academic_year_id: state.currentAcadYear?.id,
                amount: 0,
                paid_amount: newCreditAmount,
                is_paid: false,
                is_waived: false,
                is_credit: true,
                credit_amount: newCreditAmount,
                notes: reason || 'Manual credit adjustment',
                created_at: new Date().toISOString()
            });
        }

        await refreshTable('student_fees');
        closeModal('adjust-credit-modal');
        showToast(`✅ Credit adjusted to ${fmtCurrency(newCreditAmount)}`, 'success');
        await renderCreditTable();
        await renderCreditSummary();
    };
}

function showCreditHistory(studentId) {
    const student = getStudentById(studentId);
    const creditTransactions = state.payments.filter(p =>
        p.student_id == studentId && (p.is_credit_payment === true || p.is_credit_addition === true || p.is_refund === true)
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (creditTransactions.length === 0) {
        showToast('No credit transaction history found', 'info');
        return;
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>📜 Credit History - ${esc(student?.first_name)} ${esc(student?.last_name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Type</th><th style="text-align:right">Amount</th><th>Reference</th><th>Notes</th></tr>
                            </thead>
                            <tbody>
                                ${creditTransactions.map(t => {
        let type = '';
        if (t.is_credit_addition) type = '⭐ Credit Added';
        else if (t.is_credit_payment) type = '💰 Credit Used';
        else if (t.is_refund) type = '🔄 Refund';
        else type = '💵 Payment';

        return `
                                        <tr>
                                            <td>${fmtDate(t.created_at)}</span>
                                            <td>${type}</span>
                                            <td style="text-align:right; ${t.amount < 0 ? 'color:var(--danger)' : 'color:var(--success)'}">${fmtCurrency(Math.abs(t.amount))}</span>
                                            <td>${esc(t.receipt_number || '—')}</span>
                                            <td>${esc(t.notes || '—')}</span>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportCreditBalances() {
    const data = [];
    const students = state.students.filter(s => s.status === 'Active');

    for (const student of students) {
        const credit = getStudentCreditBalance(student.id);
        if (credit.total > 0 || credit.available > 0) {
            const cls = getClassById(student.class_id);
            data.push({
                'Student Name': `${student.first_name} ${student.last_name}`,
                'Student Code': student.student_code || '',
                'Class': cls?.name || '',
                'Total Credit (RWF)': credit.total,
                'Credit Used (RWF)': credit.used,
                'Available Credit (RWF)': credit.available,
                'Status': credit.available > 0 ? 'Available for Refund' : 'Fully Used'
            });
        }
    }

    if (data.length === 0) {
        showToast('No credit balances to export', 'warning');
        return;
    }

    exportToExcel(data, `Credit_Balances_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Credit balances exported', 'success');
}