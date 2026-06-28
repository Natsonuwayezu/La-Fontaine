// js/modules/bulk-finance-actions.js
// Bulk Finance Actions - Bulk payments, fee applications, and adjustments

import { state } from '../core/state.js';
import { getAll, insert, update } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel, downloadBlob } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance, getStudentCreditBalance, updateStudentCredit } from './student-fees.js';

let selectedBulkFees = new Map();

export async function renderBulkFinanceActions(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot access financial functions.</div>';
        return;
    }

    const classes = state.classes.filter(c => c.is_active !== false);
    const categories = state.feeCategories.filter(c => c.is_active !== false);
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">💰 Bulk Finance Actions</span>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showBulkTab('payments', event)">💸 Bulk Payments</button>
                    <button class="tab-btn" onclick="window.showBulkTab('fees', event)">🏷️ Bulk Apply Fees</button>
                    <button class="tab-btn" onclick="window.showBulkTab('adjustments', event)">⚙️ Bulk Adjustments</button>
                    <button class="tab-btn" onclick="window.showBulkTab('waivers', event)">🎁 Bulk Waivers</button>
                </div>
                
                <div id="bulk-payments-tab">
                    <div class="alert alert-info">Record payments for multiple students at once. Upload Excel or enter manually.</div>
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Select Class</label>
                            <select id="bulk-pay-class" class="form-control" onchange="window.loadBulkPayStudents()">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Payment Date</label>
                            <input type="date" id="bulk-pay-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Payment Method</label>
                            <select id="bulk-pay-method" class="form-control">
                                <option value="Cash">💵 Cash</option>
                                <option value="Mobile-Money">📱 Mobile-Money</option>
                                <option value="Bank Transfer">🏦 Bank Transfer</option>
                                <option value="Cheque">📄 Cheque</option>
                            </select>
                        </div>
                    </div>
                    <div class="btn-group" style="margin-bottom:16px">
                        <button class="btn btn-sm btn-outline" onclick="window.downloadBulkPaymentTemplate()">📥 Download Template</button>
                        <button class="btn btn-sm btn-outline" onclick="window.importBulkPaymentExcel()">📤 Import from Excel</button>
                        <button class="btn btn-sm btn-primary" onclick="window.selectAllBulkPay(true)">✓ Select All</button>
                        <button class="btn btn-sm btn-outline" onclick="window.selectAllBulkPay(false)">✗ Deselect All</button>
                    </div>
                    <div id="bulk-pay-students-list" style="max-height:500px;overflow-y:auto">
                        <div class="loading-container"><div class="spinner"></div><p>Select a class to load students</p></div>
                    </div>
                    <div class="btn-group" style="margin-top:16px">
                        <button class="btn btn-success" onclick="window.processBulkPayments()">💰 Process Bulk Payments</button>
                    </div>
                </div>
                
                <div id="bulk-fees-tab" style="display:none">
                    <div class="alert alert-info">Apply a fee to multiple students at once.</div>
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Select Class</label>
                            <select id="bulk-fee-class" class="form-control">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fee Category</label>
                            <select id="bulk-fee-category" class="form-control">
                                <option value="">-- Select Fee --</option>
                                ${categories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Amount Override (RWF)</label>
                            <input type="number" id="bulk-fee-amount" class="form-control" placeholder="Leave empty for default" min="0">
                        </div>
                        <div class="form-group">
                            <label>Due Date</label>
                            <input type="date" id="bulk-fee-due" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Term</label>
                            <select id="bulk-fee-term" class="form-control">
                                ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-warning" onclick="window.applyBulkFeeToClass()">🏷️ Apply Fee to Class</button>
                        <button class="btn btn-outline" onclick="window.previewBulkFee()">👁️ Preview</button>
                    </div>
                    <div id="bulk-fee-preview" style="margin-top:16px;display:none"></div>
                </div>
                
                <div id="bulk-adjustments-tab" style="display:none">
                    <div class="alert alert-warning">⚠️ Bulk adjustments will modify student balances. Use with caution.</div>
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Select Class</label>
                            <select id="bulk-adj-class" class="form-control">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Adjustment Type</label>
                            <select id="bulk-adj-type" class="form-control">
                                <option value="add_fee">➕ Add Fee (Increase Balance)</option>
                                <option value="add_payment">💰 Add Payment (Decrease Balance)</option>
                                <option value="add_credit">⭐ Add Credit</option>
                                <option value="waive_fee">🎁 Waive Fee</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Amount (RWF)</label>
                            <input type="number" id="bulk-adj-amount" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group full">
                            <label>Reason</label>
                            <input type="text" id="bulk-adj-reason" class="form-control" placeholder="Reason for bulk adjustment">
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-warning" onclick="window.previewBulkAdjustment()">👁️ Preview</button>
                        <button class="btn btn-danger" onclick="window.executeBulkAdjustment()">⚙️ Apply Adjustment</button>
                    </div>
                    <div id="bulk-adj-preview" style="margin-top:16px;display:none"></div>
                </div>
                
                <div id="bulk-waivers-tab" style="display:none">
                    <div class="alert alert-info">Apply fee waivers to multiple students.</div>
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group">
                            <label>Select Class</label>
                            <select id="bulk-waive-class" class="form-control">
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fee Category</label>
                            <select id="bulk-waive-category" class="form-control">
                                ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Waiver Amount (RWF)</label>
                            <input type="number" id="bulk-waive-amount" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group full">
                            <label>Reason</label>
                            <input type="text" id="bulk-waive-reason" class="form-control" placeholder="e.g., Sibling discount, Scholarship">
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-warning" onclick="window.previewBulkWaiver()">👁️ Preview</button>
                        <button class="btn btn-success" onclick="window.applyBulkWaiver()">🎁 Apply Waivers</button>
                    </div>
                    <div id="bulk-waive-preview" style="margin-top:16px;display:none"></div>
                </div>
            </div>
        </div>
    `;

    // Register functions
    window.showBulkTab = showBulkTab;
    window.loadBulkPayStudents = loadBulkPayStudents;
    window.downloadBulkPaymentTemplate = downloadBulkPaymentTemplate;
    window.importBulkPaymentExcel = importBulkPaymentExcel;
    window.selectAllBulkPay = selectAllBulkPay;
    window.processBulkPayments = processBulkPayments;
    window.applyBulkFeeToClass = applyBulkFeeToClass;
    window.previewBulkFee = previewBulkFee;
    window.previewBulkAdjustment = previewBulkAdjustment;
    window.executeBulkAdjustment = executeBulkAdjustment;
    window.previewBulkWaiver = previewBulkWaiver;
    window.applyBulkWaiver = applyBulkWaiver;
}

function showBulkTab(tabName, event) {
    const tabs = ['payments', 'fees', 'adjustments', 'waivers'];
    for (const t of tabs) {
        const el = document.getElementById(`bulk-${t}-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

async function loadBulkPayStudents() {
    const classId = document.getElementById('bulk-pay-class')?.value;
    const container = document.getElementById('bulk-pay-students-list');

    if (!classId) {
        container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Select a class to load students</p></div>';
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active')
        .sort((a, b) => a.last_name.localeCompare(b.last_name));

    if (students.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No active students in this class</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:32px"><input type="checkbox" id="bulk-pay-select-all" onchange="window.selectAllBulkPay(this.checked)"></th>
                    <th>Student Name</th>
                    <th>Student Code</th>
                    <th>Outstanding Balance</th>
                    <th>Payment Amount (RWF)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${students.map(s => {
        const balance = getFullStudentBalance(s.id);
        const hasCredit = balance.credit > 0;
        return `
                        <tr>
                            <td style="text-align:center"><input type="checkbox" class="bulk-pay-cb" data-id="${s.id}" data-balance="${balance.balance}" onchange="window.updateBulkPayTotal()"></td>
                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                            <td><code>${esc(s.student_code || '—')}</code></span>
                            <td style="color:${balance.balance > 0 ? 'var(--danger)' : (hasCredit ? 'var(--success)' : '')}">${balance.balance > 0 ? fmtCurrency(balance.balance) : (hasCredit ? '⭐ Credit: ' + fmtCurrency(balance.credit) : '✅ Paid')}</span>
                            <td><input type="number" class="bulk-pay-amount" data-id="${s.id}" value="0" min="0" step="1000" style="width:120px" onchange="window.updateBulkPayTotal()" ${balance.balance <= 0 && !hasCredit ? 'disabled' : ''}></span>
                            <td style="text-align:center"><span class="badge ${balance.balance > 0 ? 'badge-warning' : (hasCredit ? 'badge-info' : 'badge-success')}">${balance.balance > 0 ? 'Due' : (hasCredit ? 'Has Credit' : 'Paid')}</span></span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:var(--bg-tertiary);font-weight:700">
                    <td colspan="4" style="text-align:right">TOTAL SELECTED:</td>
                    <td id="bulk-pay-total-amount">0 RWF</td>
                    <td id="bulk-pay-count">0 students</td>
                </tr>
            </tfoot>
        </table>
    `;
}

function selectAllBulkPay(select) {
    const checkboxes = document.querySelectorAll('.bulk-pay-cb');
    checkboxes.forEach(cb => cb.checked = select);
    updateBulkPayTotal();
}

function updateBulkPayTotal() {
    let totalAmount = 0;
    let selectedCount = 0;

    document.querySelectorAll('.bulk-pay-cb:checked').forEach(cb => {
        const amountInput = document.querySelector(`.bulk-pay-amount[data-id="${cb.dataset.id}"]`);
        const amount = parseFloat(amountInput?.value) || 0;
        if (amount > 0) {
            totalAmount += amount;
            selectedCount++;
        }
    });

    const totalEl = document.getElementById('bulk-pay-total-amount');
    const countEl = document.getElementById('bulk-pay-count');
    if (totalEl) totalEl.textContent = fmtCurrency(totalAmount);
    if (countEl) countEl.textContent = `${selectedCount} student${selectedCount !== 1 ? 's' : ''}`;
}

async function processBulkPayments() {
    const paymentDate = document.getElementById('bulk-pay-date')?.value;
    const paymentMethod = document.getElementById('bulk-pay-method')?.value;

    if (!paymentDate) {
        showToast('Please select a payment date', 'warning');
        return;
    }

    const payments = [];
    document.querySelectorAll('.bulk-pay-cb:checked').forEach(cb => {
        const amountInput = document.querySelector(`.bulk-pay-amount[data-id="${cb.dataset.id}"]`);
        const amount = parseFloat(amountInput?.value) || 0;
        if (amount > 0) {
            payments.push({ studentId: parseInt(cb.dataset.id), amount });
        }
    });

    if (payments.length === 0) {
        showToast('No payments to process', 'warning');
        return;
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    if (!await confirmDialog(
        `Process ${payments.length} payments totaling ${fmtCurrency(totalAmount)}?\n\nPayment Date: ${paymentDate}\nMethod: ${paymentMethod}`
    )) return;

    const user = state.currentUser;
    let successCount = 0;
    let errorCount = 0;
    let totalProcessed = 0;

    showToast(`Processing ${payments.length} payments...`, 'info');

    for (const payment of payments) {
        try {
            const student = getStudentById(payment.studentId);
            const receiptNum = `BULK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}-${payment.studentId}`;

            const paymentRecord = await insert('payments', {
                student_id: payment.studentId,
                amount: payment.amount,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                receipt_number: receiptNum,
                reference: `Bulk payment ${new Date().toISOString().split('T')[0]}`,
                notes: `Bulk payment processed on ${new Date().toLocaleString()}`,
                recorded_by: user.id,
                created_at: new Date().toISOString()
            });

            if (paymentRecord) {
                // Allocate payment to oldest unpaid fees
                let remainingAmount = payment.amount;
                const unpaidFees = state.studentFees.filter(f =>
                    f.student_id == payment.studentId && !f.is_paid && !f.is_waived && !f.is_credit
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
                        student_id: payment.studentId,
                        fee_category_id: null,
                        term_id: state.currentTerm?.id,
                        academic_year_id: state.currentAcadYear?.id,
                        amount: 0,
                        paid_amount: remainingAmount,
                        is_paid: false,
                        is_waived: false,
                        is_credit: true,
                        credit_amount: remainingAmount,
                        notes: `Credit from bulk payment (receipt ${receiptNum})`,
                        created_at: new Date().toISOString()
                    });
                }

                successCount++;
                totalProcessed += payment.amount;
            }
        } catch (error) {
            console.error('Bulk payment error:', error);
            errorCount++;
        }
    }

    await refreshTable('payments');
    await refreshTable('student_fees');

    if (errorCount === 0) {
        showToast(`✅ Processed ${successCount} payments totaling ${fmtCurrency(totalProcessed)}`, 'success');
        loadBulkPayStudents();
    } else {
        showToast(`⚠️ Processed ${successCount} payments, ${errorCount} failed`, 'warning');
    }
}

function downloadBulkPaymentTemplate() {
    const data = [
        { 'Student Code': 'STU001', 'Student Name': 'John Doe', 'Payment Amount (RWF)': '', 'Notes': '' },
        { 'Student Code': 'STU002', 'Student Name': 'Jane Smith', 'Payment Amount (RWF)': '', 'Notes': '' }
    ];
    exportToExcel(data, 'Bulk_Payment_Template');
}

function importBulkPaymentExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);

                let imported = 0;
                let notFound = 0;

                for (const row of rows) {
                    const studentCode = row['Student Code'] || row['student_code'] || '';
                    const amount = parseFloat(row['Payment Amount (RWF)'] || row['amount'] || 0);

                    if (!studentCode || isNaN(amount) || amount <= 0) continue;

                    const student = state.students.find(s => s.student_code === studentCode);
                    if (student) {
                        const checkbox = document.querySelector(`.bulk-pay-cb[data-id="${student.id}"]`);
                        const amountInput = document.querySelector(`.bulk-pay-amount[data-id="${student.id}"]`);
                        if (checkbox && amountInput) {
                            checkbox.checked = true;
                            amountInput.value = amount;
                            imported++;
                        }
                    } else {
                        notFound++;
                    }
                }

                updateBulkPayTotal();
                showToast(`📤 Imported ${imported} payments (${notFound} students not found)`, 'success');
            } catch (err) {
                showToast('Error reading file: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

async function applyBulkFeeToClass() {
    const classId = document.getElementById('bulk-fee-class')?.value;
    const categoryId = document.getElementById('bulk-fee-category')?.value;
    const amountOverride = parseFloat(document.getElementById('bulk-fee-amount')?.value);
    const dueDate = document.getElementById('bulk-fee-due')?.value;
    const termId = document.getElementById('bulk-fee-term')?.value;

    if (!classId) { showToast('Please select a class', 'warning'); return; }
    if (!categoryId) { showToast('Please select a fee category', 'warning'); return; }

    const cls = getClassById(classId);
    const category = state.feeCategories.find(c => c.id == categoryId);
    let amount = amountOverride || category?.amount || 0;

    if (amount <= 0) { showToast('Fee amount must be greater than 0', 'warning'); return; }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');

    if (!await confirmDialog(`Apply ${category?.name} (${fmtCurrency(amount)}) to ${students.length} students in ${cls?.name}?`)) return;

    let applied = 0;
    for (const student of students) {
        const existing = state.studentFees.find(f =>
            f.student_id === student.id && f.fee_category_id == categoryId &&
            f.term_id == termId && !f.is_waived
        );
        if (existing) continue;

        // Check for credit balance
        const creditBalance = getStudentCreditBalance(student.id);
        let amountToAdd = amount;
        let usedCredit = 0;

        if (creditBalance.available > 0 && amountToAdd > 0) {
            usedCredit = Math.min(creditBalance.available, amountToAdd);
            amountToAdd = amountToAdd - usedCredit;
            await updateStudentCredit(student.id, creditBalance.available - usedCredit);
        }

        await insert('student_fees', {
            student_id: student.id,
            fee_category_id: parseInt(categoryId),
            term_id: parseInt(termId),
            academic_year_id: state.currentAcadYear?.id,
            amount: amountToAdd,
            paid_amount: usedCredit,
            is_paid: amountToAdd === 0,
            is_waived: false,
            due_date: dueDate || state.currentTerm?.end_date || null,
            created_at: new Date().toISOString()
        });
        applied++;
    }

    await refreshTable('student_fees');
    showToast(`✅ Applied ${category?.name} to ${applied} students`, 'success');
}

async function previewBulkFee() {
    const classId = document.getElementById('bulk-fee-class')?.value;
    const categoryId = document.getElementById('bulk-fee-category')?.value;
    const previewDiv = document.getElementById('bulk-fee-preview');

    if (!classId || !categoryId) {
        previewDiv.style.display = 'none';
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Preview:</strong> Will apply to ${students.length} students in ${getClassById(classId)?.name}
        </div>
    `;
}

async function previewBulkAdjustment() {
    const classId = document.getElementById('bulk-adj-class')?.value;
    const type = document.getElementById('bulk-adj-type')?.value;
    const amount = parseFloat(document.getElementById('bulk-adj-amount')?.value);
    const previewDiv = document.getElementById('bulk-adj-preview');

    if (!classId || isNaN(amount) || amount <= 0) {
        previewDiv.style.display = 'none';
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `
        <div class="alert alert-warning">
            <strong>Preview:</strong> Will ${type === 'add_fee' ? 'add' : type === 'add_payment' ? 'add payment' : type === 'add_credit' ? 'add credit' : 'waive'} ${fmtCurrency(amount)} 
            for ${students.length} students in ${getClassById(classId)?.name}
        </div>
    `;
}

async function executeBulkAdjustment() {
    const classId = document.getElementById('bulk-adj-class')?.value;
    const type = document.getElementById('bulk-adj-type')?.value;
    const amount = parseFloat(document.getElementById('bulk-adj-amount')?.value);
    const reason = document.getElementById('bulk-adj-reason')?.value;

    if (!classId || isNaN(amount) || amount <= 0) {
        showToast('Please select a class and enter a valid amount', 'warning');
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');

    if (!await confirmDialog(`Apply ${type} of ${fmtCurrency(amount)} to ${students.length} students?`)) return;

    let applied = 0;
    for (const student of students) {
        try {
            if (type === 'add_fee') {
                // Find a default fee category or create generic adjustment
                const defaultCategory = state.feeCategories.find(c => c.name === 'Adjustment');
                if (defaultCategory) {
                    await insert('student_fees', {
                        student_id: student.id,
                        fee_category_id: defaultCategory.id,
                        term_id: state.currentTerm?.id,
                        academic_year_id: state.currentAcadYear?.id,
                        amount: amount,
                        paid_amount: 0,
                        is_paid: false,
                        is_waived: false,
                        notes: reason || 'Bulk adjustment',
                        created_at: new Date().toISOString()
                    });
                }
            } else if (type === 'add_payment') {
                const receiptNum = `ADJ-${Date.now()}-${student.id}`;
                await insert('payments', {
                    student_id: student.id,
                    amount: amount,
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'Bulk Adjustment',
                    receipt_number: receiptNum,
                    notes: reason || 'Bulk payment adjustment',
                    recorded_by: state.currentUser?.id,
                    created_at: new Date().toISOString()
                });
            } else if (type === 'add_credit') {
                const existingCredit = state.studentFees.find(f =>
                    f.student_id === student.id && f.is_credit === true
                );
                if (existingCredit) {
                    await update('student_fees', existingCredit.id, {
                        credit_amount: (existingCredit.credit_amount || 0) + amount,
                        paid_amount: (existingCredit.paid_amount || 0) + amount,
                        notes: reason || 'Bulk credit adjustment'
                    });
                } else {
                    await insert('student_fees', {
                        student_id: student.id,
                        fee_category_id: null,
                        term_id: state.currentTerm?.id,
                        amount: 0,
                        paid_amount: amount,
                        is_credit: true,
                        credit_amount: amount,
                        notes: reason || 'Bulk credit adjustment',
                        created_at: new Date().toISOString()
                    });
                }
            } else if (type === 'waive_fee') {
                const defaultCategory = state.feeCategories.find(c => c.name === 'Adjustment');
                if (defaultCategory) {
                    await insert('student_fees', {
                        student_id: student.id,
                        fee_category_id: defaultCategory.id,
                        term_id: state.currentTerm?.id,
                        amount: amount,
                        paid_amount: 0,
                        is_paid: false,
                        is_waived: true,
                        waiver_reason: reason || 'Bulk waiver',
                        created_at: new Date().toISOString()
                    });
                }
            }
            applied++;
        } catch (e) {
            console.error('Adjustment error:', e);
        }
    }

    await refreshTable('student_fees');
    await refreshTable('payments');
    showToast(`✅ Applied ${type} to ${applied} students`, 'success');
}

async function previewBulkWaiver() {
    const classId = document.getElementById('bulk-waive-class')?.value;
    const categoryId = document.getElementById('bulk-waive-category')?.value;
    const amount = parseFloat(document.getElementById('bulk-waive-amount')?.value);
    const previewDiv = document.getElementById('bulk-waive-preview');

    if (!classId || !categoryId || isNaN(amount) || amount <= 0) {
        previewDiv.style.display = 'none';
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Preview:</strong> Will waive ${fmtCurrency(amount)} for ${students.length} students in ${getClassById(classId)?.name}
        </div>
    `;
}

async function applyBulkWaiver() {
    const classId = document.getElementById('bulk-waive-class')?.value;
    const categoryId = document.getElementById('bulk-waive-category')?.value;
    const amount = parseFloat(document.getElementById('bulk-waive-amount')?.value);
    const reason = document.getElementById('bulk-waive-reason')?.value;

    if (!classId || !categoryId || isNaN(amount) || amount <= 0) {
        showToast('Please select class, category, and enter amount', 'warning');
        return;
    }

    const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');

    if (!await confirmDialog(`Waive ${fmtCurrency(amount)} for ${students.length} students?`)) return;

    let applied = 0;
    for (const student of students) {
        await insert('student_fees', {
            student_id: student.id,
            fee_category_id: parseInt(categoryId),
            term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id,
            amount: amount,
            paid_amount: 0,
            is_paid: false,
            is_waived: true,
            waiver_reason: reason || 'Bulk waiver',
            created_at: new Date().toISOString()
        });
        applied++;
    }

    await refreshTable('student_fees');
    showToast(`✅ Waived ${fmtCurrency(amount)} for ${applied} students`, 'success');
}
export async function openBulkPaymentModal(studentIds) {
    const { showModal, showToast } = await import('../ui/modals.js');
    if (!studentIds?.length) { showToast('No students selected', 'warning'); return; }
    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>💰 Bulk Payment</h3>
                    <button class="modal-close" onclick="window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <p>Apply payment for <strong>${studentIds.length}</strong> student(s).</p>
                    <div class="form-group"><label>Amount per student (RWF)</label>
                        <input type="number" id="bulk-pay-amount" min="0" placeholder="0"></div>
                    <div class="form-group"><label>Payment date</label>
                        <input type="date" id="bulk-pay-date" value="${new Date().toISOString().split('T')[0]}"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-success" onclick="window.executeBulkPayment&&window.executeBulkPayment(${JSON.stringify(studentIds)})">✅ Apply</button>
                </div>
            </div>
        </div>`);
}
