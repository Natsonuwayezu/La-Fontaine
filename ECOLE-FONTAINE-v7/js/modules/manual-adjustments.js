// js/modules/manual-adjustments.js
// Manual Adjustments Module - Manually adjust student balances, add fees, add payments

import { state } from '../core/state.js';
import { getAll, insert, update } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance, getStudentCreditBalance, updateStudentCredit } from './student-fees.js';

export async function renderManualAdjustments(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot make manual adjustments.</div>';
        return;
    }

    const students = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    const categories = state.feeCategories.filter(c => c.is_active !== false);
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">⚙️ Manual Balance Adjustments</span>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-warning">
                    <strong>⚠️ Warning:</strong> Manual adjustments directly modify student balances. 
                    All changes are logged for audit purposes.
                </div>
                
                <div class="form-grid">
                    <div class="form-group full">
                        <label>Select Student</label>
                        <select id="adj-student" class="form-control" onchange="window.loadStudentBalanceInfo()">
                            <option value="">-- Select Student --</option>
                            ${students.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <div id="student-balance-info" style="display:none; margin:16px 0; padding:12px; background:var(--bg-tertiary); border-radius:8px"></div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label>Adjustment Type</label>
                        <select id="adj-type" class="form-control" onchange="window.toggleAdjustmentFields()">
                            <option value="add_fee">➕ Add Fee (Increase Balance)</option>
                            <option value="add_payment">💰 Add Payment (Decrease Balance)</option>
                            <option value="add_credit">⭐ Add Credit (Overpayment/Refund)</option>
                            <option value="waive_fee">🎁 Waive Fee (Remove from Balance)</option>
                            <option value="adjust_balance">📊 Direct Balance Adjustment</option>
                        </select>
                    </div>
                    <div class="form-group" id="adj-fee-category-group" style="display:none">
                        <label>Fee Category</label>
                        <select id="adj-fee-category" class="form-control">
                            <option value="">-- Select Fee Category --</option>
                            ${categories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="adj-term-group" style="display:none">
                        <label>Term</label>
                        <select id="adj-term" class="form-control">
                            ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (RWF)</label>
                        <input type="number" id="adj-amount" class="form-control" min="0" step="1000" placeholder="Enter amount">
                    </div>
                    <div class="form-group full" id="adj-reason-group">
                        <label>Reason / Notes *</label>
                        <textarea id="adj-reason" class="form-control" rows="2" placeholder="Provide reason for this adjustment..."></textarea>
                    </div>
                </div>
                
                <div class="btn-group" style="margin-top:20px">
                    <button class="btn btn-danger" onclick="window.submitManualAdjustment()">⚠️ Apply Adjustment</button>
                    <button class="btn btn-outline" onclick="window.resetAdjustmentForm()">🗑️ Clear Form</button>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📜 Recent Adjustments</span>
                <button class="btn btn-sm btn-outline" onclick="window.loadAdjustmentHistory()">🔄 Refresh</button>
            </div>
            <div class="dash-card-body">
                <div id="adjustment-history" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading adjustment history...</p></div>
                </div>
            </div>
        </div>
    `;

    window.loadStudentBalanceInfo = loadStudentBalanceInfo;
    window.toggleAdjustmentFields = toggleAdjustmentFields;
    window.submitManualAdjustment = submitManualAdjustment;
    window.resetAdjustmentForm = resetAdjustmentForm;
    window.loadAdjustmentHistory = loadAdjustmentHistory;
}

async function loadStudentBalanceInfo() {
    const studentId = document.getElementById('adj-student')?.value;
    const infoDiv = document.getElementById('student-balance-info');

    if (!studentId) {
        infoDiv.style.display = 'none';
        return;
    }

    const student = getStudentById(studentId);
    const balance = getFullStudentBalance(studentId);
    const credit = getStudentCreditBalance(studentId);
    const cls = getClassById(student?.class_id);

    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; text-align:center">
            <div>
                <div style="font-size:11px; color:var(--text-muted)">Student</div>
                <div style="font-weight:700">${esc(student?.first_name)} ${esc(student?.last_name)}</div>
                <div style="font-size:11px">${esc(cls?.name || '—')}</div>
            </div>
            <div>
                <div style="font-size:11px; color:var(--text-muted)">Total Fees</div>
                <div style="font-weight:700">${fmtCurrency(balance.total)}</div>
            </div>
            <div>
                <div style="font-size:11px; color:var(--text-muted)">Paid</div>
                <div style="font-weight:700; color:var(--success)">${fmtCurrency(balance.paid)}</div>
            </div>
            <div>
                <div style="font-size:11px; color:var(--text-muted)">Balance / Credit</div>
                <div style="font-weight:700; ${balance.balance > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">
                    ${balance.balance > 0 ? fmtCurrency(balance.balance) : (credit.available > 0 ? `⭐ ${fmtCurrency(credit.available)}` : '✅ Paid')}
                </div>
            </div>
        </div>
    `;
}

function toggleAdjustmentFields() {
    const type = document.getElementById('adj-type')?.value;
    const feeCategoryGroup = document.getElementById('adj-fee-category-group');
    const termGroup = document.getElementById('adj-term-group');
    const reasonGroup = document.getElementById('adj-reason-group');

    feeCategoryGroup.style.display = (type === 'add_fee' || type === 'waive_fee') ? 'block' : 'none';
    termGroup.style.display = (type === 'add_fee' || type === 'waive_fee') ? 'block' : 'none';
    reasonGroup.style.display = 'block';
}

async function submitManualAdjustment() {
    const studentId = document.getElementById('adj-student')?.value;
    const type = document.getElementById('adj-type')?.value;
    const amount = parseFloat(document.getElementById('adj-amount')?.value);
    const feeCategoryId = document.getElementById('adj-fee-category')?.value;
    const termId = document.getElementById('adj-term')?.value;
    const reason = document.getElementById('adj-reason')?.value.trim();

    if (!studentId) {
        showToast('Please select a student', 'warning');
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }

    if (!reason) {
        showToast('Please provide a reason for this adjustment', 'warning');
        return;
    }

    if ((type === 'add_fee' || type === 'waive_fee') && !feeCategoryId) {
        showToast('Please select a fee category', 'warning');
        return;
    }

    const student = getStudentById(studentId);
    const user = state.currentUser;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date();
    const receiptNum = `ADJ-${Date.now()}-${studentId}`;

    if (!await confirmDialog(
        `Apply ${type === 'add_fee' ? 'fee' : type === 'add_payment' ? 'payment' : type === 'add_credit' ? 'credit' : type === 'waive_fee' ? 'waiver' : 'adjustment'} of ${fmtCurrency(amount)} for ${student?.first_name} ${student?.last_name}?\n\nReason: ${reason}`
    )) return;

    try {
        switch (type) {
            case 'add_fee':
                await insert('student_fees', {
                    student_id: parseInt(studentId),
                    fee_category_id: parseInt(feeCategoryId),
                    term_id: parseInt(termId),
                    academic_year_id: yearId,
                    amount: amount,
                    paid_amount: 0,
                    is_paid: false,
                    is_waived: false,
                    notes: `Manual adjustment: ${reason}`,
                    due_date: dueDate,
                    created_at: new Date().toISOString()
                });
                break;

            case 'add_payment':
                const payment = await insert('payments', {
                    student_id: parseInt(studentId),
                    amount: amount,
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'Manual Adjustment',
                    receipt_number: receiptNum,
                    notes: reason,
                    recorded_by: user.id,
                    created_at: new Date().toISOString()
                });

                if (payment) {
                    let remainingAmount = amount;
                    const unpaidFees = state.studentFees.filter(f =>
                        f.student_id == studentId && !f.is_paid && !f.is_waived && !f.is_credit
                    ).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

                    for (const fee of unpaidFees) {
                        if (remainingAmount <= 0) break;
                        const feeRemaining = fee.amount - (fee.paid_amount || 0);
                        const allocation = Math.min(remainingAmount, feeRemaining);
                        if (allocation > 0) {
                            await update('student_fees', fee.id, {
                                paid_amount: (fee.paid_amount || 0) + allocation,
                                is_paid: (fee.paid_amount || 0) + allocation >= fee.amount,
                                updated_at: new Date().toISOString()
                            });
                            remainingAmount -= allocation;
                        }
                    }

                    if (remainingAmount > 0) {
                        await insert('student_fees', {
                            student_id: parseInt(studentId),
                            fee_category_id: null,
                            term_id: state.currentTerm?.id,
                            academic_year_id: yearId,
                            amount: 0,
                            paid_amount: remainingAmount,
                            is_paid: false,
                            is_waived: false,
                            is_credit: true,
                            credit_amount: remainingAmount,
                            notes: `Credit from manual payment: ${reason}`,
                            created_at: new Date().toISOString()
                        });
                    }
                }
                break;

            case 'add_credit':
                const existingCredit = state.studentFees.find(f =>
                    f.student_id == studentId && f.is_credit === true && f.term_id === state.currentTerm?.id
                );

                await insert('payments', {
                    student_id: parseInt(studentId),
                    amount: amount,
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'Credit Note',
                    receipt_number: `CRD-${Date.now()}-${studentId}`,
                    notes: reason,
                    recorded_by: user.id,
                    created_at: new Date().toISOString(),
                    is_credit_addition: true
                });

                if (existingCredit) {
                    await update('student_fees', existingCredit.id, {
                        credit_amount: (existingCredit.credit_amount || 0) + amount,
                        paid_amount: (existingCredit.paid_amount || 0) + amount,
                        notes: (existingCredit.notes || '') + ` | Credit added: ${reason}`,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    await insert('student_fees', {
                        student_id: parseInt(studentId),
                        fee_category_id: null,
                        term_id: state.currentTerm?.id,
                        academic_year_id: yearId,
                        amount: 0,
                        paid_amount: amount,
                        is_paid: false,
                        is_waived: false,
                        is_credit: true,
                        credit_amount: amount,
                        notes: reason,
                        created_at: new Date().toISOString()
                    });
                }
                break;

            case 'waive_fee':
                await insert('student_fees', {
                    student_id: parseInt(studentId),
                    fee_category_id: parseInt(feeCategoryId),
                    term_id: parseInt(termId),
                    academic_year_id: yearId,
                    amount: amount,
                    paid_amount: 0,
                    is_paid: false,
                    is_waived: true,
                    waiver_reason: reason,
                    due_date: dueDate,
                    created_at: new Date().toISOString()
                });
                break;

            case 'adjust_balance':
                const currentBalance = getFullStudentBalance(studentId);
                const newBalance = amount;
                const difference = newBalance - currentBalance.balance;

                if (difference > 0) {
                    // Need to add fee
                    const defaultCategory = state.feeCategories[0];
                    if (defaultCategory) {
                        await insert('student_fees', {
                            student_id: parseInt(studentId),
                            fee_category_id: defaultCategory.id,
                            term_id: state.currentTerm?.id,
                            academic_year_id: yearId,
                            amount: difference,
                            paid_amount: 0,
                            is_paid: false,
                            is_waived: false,
                            notes: `Balance adjustment to ${fmtCurrency(newBalance)}: ${reason}`,
                            created_at: new Date().toISOString()
                        });
                    }
                } else if (difference < 0) {
                    // Need to add payment
                    await insert('payments', {
                        student_id: parseInt(studentId),
                        amount: -difference,
                        payment_date: new Date().toISOString().split('T')[0],
                        payment_method: 'Balance Adjustment',
                        receipt_number: receiptNum,
                        notes: `Balance adjustment to ${fmtCurrency(newBalance)}: ${reason}`,
                        recorded_by: user.id,
                        created_at: new Date().toISOString()
                    });
                }
                break;
        }

        await logAdjustment(studentId, type, amount, reason);
        await refreshTable('student_fees');
        await refreshTable('payments');

        showToast(`✅ ${type === 'add_fee' ? 'Fee added' : type === 'add_payment' ? 'Payment recorded' : type === 'add_credit' ? 'Credit added' : type === 'waive_fee' ? 'Fee waived' : 'Balance adjusted'} successfully`, 'success');

        resetAdjustmentForm();
        await loadStudentBalanceInfo();
        await loadAdjustmentHistory();

    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function logAdjustment(studentId, type, amount, reason) {
    const student = getStudentById(studentId);
    try {
        await insert('activity_logs', {
            user_id: state.currentUser?.id,
            user_role: state.currentUser?.role,
            action: `Manual ${type} adjustment: ${fmtCurrency(amount)}`,
            entity_type: 'manual_adjustment',
            entity_id: studentId,
            details: JSON.stringify({ student: student?.first_name + ' ' + student?.last_name, type, amount, reason }),
            created_at: new Date().toISOString()
        });
    } catch (e) { }
}

function resetAdjustmentForm() {
    document.getElementById('adj-student').value = '';
    document.getElementById('adj-type').value = 'add_fee';
    document.getElementById('adj-amount').value = '';
    document.getElementById('adj-fee-category').value = '';
    document.getElementById('adj-reason').value = '';
    document.getElementById('student-balance-info').style.display = 'none';
    toggleAdjustmentFields();
    showToast('Form cleared', 'info', 1500);
}

async function loadAdjustmentHistory() {
    const container = document.getElementById('adjustment-history');
    if (!container) return;

    const logs = state.activityLogs.filter(log => log.entity_type === 'manual_adjustment').slice(0, 50);

    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No adjustment history found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Date</th><th>Student</th><th>Action</th><th>Amount</th><th>Reason</th><th>By</th></tr>
            </thead>
            <tbody>
                ${logs.map(log => {
        let details = {};
        try {
            details = JSON.parse(log.details || '{}');
        } catch (e) { }
        return `
                        <tr>
                            <td>${fmtDateTime(log.created_at)}</span>
                            <td>${esc(details.student || '—')}</span>
                            <td>${esc(log.action || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(parseFloat(log.action?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || 0))}</span>
                            <td>${esc(details.reason || '—')}</span>
                            <td>${esc(log.user_role || 'System')}</span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}