// js/modules/record-payment.js
// Record Payment Module - Record new payments with fee allocation


let selectedFees = new Map();
let currentStudentId = null;

async function renderRecordPayment(container) {
    const preselId = localStorage.getItem('elf_pay_student');
    localStorage.removeItem('elf_pay_student');

    const activeStudents = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    currentStudentId = preselId ? parseInt(preselId) : null;

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">💸 RECORD PAYMENT</span>
                <button class="modal-close" style="position:static" onclick="window.navigateTo('payment-history')">✕</button>
            </div>
            <div class="dash-card-body">
                <div class="form-grid" style="margin-bottom:20px">
                    <div class="form-group">
                        <label>Student *</label>
                        <select id="pay-student" onchange="window.onStudentChangeForPayment()">
                            <option value="">— Select student —</option>
                            ${activeStudents.map(s => `<option value="${s.id}" ${s.id == preselId ? 'selected' : ''}>${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || 'STU')}) - ${esc(getClassById(s.class_id)?.name || '?')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Class</label><input type="text" id="pay-student-class" readonly style="background:var(--bg-tertiary)"></div>
                </div>
                
                <div style="margin-bottom:20px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                        <strong>📋 FEE CATEGORIES</strong>
                        <button class="btn btn-sm btn-outline" onclick="window.selectAllFees()">✓ Select All</button>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" style="width:100%">
                            <thead><tr><th>Fee Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Remaining</th><th style="text-align:center">Select</th></tr></thead>
                            <tbody id="record-fee-tbody"><tr><td colspan="5" style="text-align:center;padding:40px">Select a student to view fees</td></tr></tbody>
                            <tfoot id="record-fee-total"><tr><td colspan="3"><strong>TOTAL SELECTED</strong></td><td style="text-align:right"><strong>0 RWF</strong></td><td></td></tr></tfoot>
                        </table>
                    </div>
                </div>
                
                <div style="margin-bottom:20px">
                    <strong>💳 PAYMENT DETAILS</strong>
                    <div class="form-grid">
                        <div class="form-group"><label>Amount Paid *</label><input type="number" id="pay-amount" min="0" step="1000" placeholder="Enter amount" oninput="window.updateReceiptPreview()"></div>
                        <div class="form-group"><label>Payment Date *</label><input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="form-group"><label>Payment Method</label><select id="pay-method" onchange="window.updateReceiptPreview()"><option>Cash</option><option>Mobile-Money</option><option>Bank Transfer</option><option>Cheque</option></select></div>
                        <div class="form-group"><label>Reference</label><input type="text" id="pay-ref" placeholder="Optional"></div>
                        <div class="form-group full"><label>Notes</label><textarea id="pay-notes" rows="2" placeholder="Optional"></textarea></div>
                    </div>
                </div>
                
                <div style="margin-bottom:20px">
                    <strong>🧾 RECEIPT PREVIEW</strong>
                    <div id="receipt-preview-content"><div style="text-align:center;padding:20px;color:var(--text-muted)">Select a student and enter amount</div></div>
                </div>
                
                <div class="btn-group" style="justify-content:flex-end">
                    <button class="btn btn-outline" onclick="window.resetPaymentForm()">🗑️ Clear</button>
                    <button class="btn btn-success" onclick="window.submitRecordPayment()">✅ Record Payment</button>
                    <button class="btn btn-primary" onclick="window.submitAndPrintPayment()">📄 Record & Print</button>
                </div>
            </div>
        </div>
    `;

    // Register global functions
    window.onStudentChangeForPayment = onStudentChangeForPayment;
    window.toggleFeeSelection = toggleFeeSelection;
    window.selectAllFees = selectAllFees;
    window.updateReceiptPreview = updateReceiptPreview;
    window.resetPaymentForm = resetPaymentForm;
    window.submitRecordPayment = () => processPayment(false);
    window.submitAndPrintPayment = () => processPayment(true);

    if (preselId) setTimeout(() => onStudentChangeForPayment(), 100);
}

function calculateStudentTotals(studentId) {
    const fees = state.studentFees.filter(f => f.student_id == studentId && !f.is_paid && !f.is_waived && !f.is_credit);
    let totalAmount = 0, totalPaid = 0, totalRemaining = 0;
    for (const fee of fees) {
        const paid = fee.paid_amount || 0;
        totalAmount += fee.amount;
        totalPaid += paid;
        totalRemaining += (fee.amount - paid);
    }
    const creditFees = state.studentFees.filter(f => f.student_id == studentId && f.is_credit === true);
    const totalCredit = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
    return { fees, totalAmount, totalPaid, totalRemaining, totalCredit };
}

function getSelectedTotal() {
    let total = 0;
    for (const [feeId, selected] of selectedFees.entries()) {
        if (selected) {
            const fee = state.studentFees.find(f => f.id === feeId);
            if (fee) total += (fee.amount - (fee.paid_amount || 0));
        }
    }
    return total;
}

function onStudentChangeForPayment() {
    const studentId = document.getElementById('pay-student')?.value;
    if (!studentId) {
        document.getElementById('record-fee-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">Select a student to view fees</td></tr>';
        document.getElementById('pay-student-class').value = '';
        return;
    }
    currentStudentId = parseInt(studentId);
    selectedFees.clear();
    const student = state.students.find(s => s.id == currentStudentId);
    const cls = student ? getClassById(student.class_id) : null;
    document.getElementById('pay-student-class').value = cls?.name || '—';
    renderFeeTable();
    updateReceiptPreview();
}

function toggleFeeSelection(feeId) {
    const current = selectedFees.get(feeId) || false;
    if (current) selectedFees.delete(feeId);
    else selectedFees.set(feeId, true);
    renderFeeTable();
    updateReceiptPreview();
}

function selectAllFees() {
    const { fees } = calculateStudentTotals(currentStudentId);
    for (const fee of fees) selectedFees.set(fee.id, true);
    renderFeeTable();
    updateReceiptPreview();
}

function renderFeeTable() {
    if (!currentStudentId) return;
    const { fees, totalCredit } = calculateStudentTotals(currentStudentId);
    const tbody = document.getElementById('record-fee-tbody');
    if (!tbody) return;
    if (fees.length === 0 && totalCredit === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">No pending fees for this student</td></tr>';
        return;
    }
    tbody.innerHTML = fees.map(fee => {
        const cat = state.feeCategories.find(c => c.id === fee.fee_category_id);
        const paid = fee.paid_amount || 0;
        const remaining = fee.amount - paid;
        const isSelected = selectedFees.get(fee.id) || false;
        return `
            <tr>
                <td style="padding:10px 8px"><strong>${esc(cat?.name || 'Unknown')}</strong></td>
                <td style="padding:10px 8px;text-align:right">${fmtCurrency(fee.amount)}</td>
                <td style="padding:10px 8px;text-align:right">${fmtCurrency(paid)}</td>
                <td style="padding:10px 8px;text-align:right;font-weight:600">${fmtCurrency(remaining)}</td>
                <td style="padding:10px 8px;text-align:center">
                    <input type="checkbox" data-fee-id="${fee.id}" ${isSelected ? 'checked' : ''} onchange="window.toggleFeeSelection(${fee.id})">
                </td>
            </tr>
        `;
    }).join('');

    const totalRow = document.getElementById('record-fee-total');
    if (totalRow) {
        totalRow.innerHTML = `<tr><td colspan="3" style="padding:10px 8px;font-weight:700">TOTAL SELECTED</td>
            <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--role-primary)">${fmtCurrency(getSelectedTotal())}</td>
            <td style="padding:10px 8px"></td></tr>`;
    }
    const amountInput = document.getElementById('pay-amount');
    if (amountInput) amountInput.max = getSelectedTotal();
}

function updateReceiptPreview() {
    const student = state.students.find(s => s.id == currentStudentId);
    const cls = student ? getClassById(student.class_id) : null;
    const amount = parseFloat(document.getElementById('pay-amount')?.value) || 0;
    const method = document.getElementById('pay-method')?.value || '—';
    const previewDiv = document.getElementById('receipt-preview-content');
    if (!previewDiv || !student) return;
    const receiptNum = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
    previewDiv.innerHTML = `<div style="background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:8px;padding:12px;font-size:12px">
        <div style="text-align:center;margin-bottom:8px"><strong>ECOLE LA FONTAINE</strong><br><small>OFFICIAL PAYMENT RECEIPT</small></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">
            <span style="color:var(--text-muted)">Receipt #:</span><span><strong>${receiptNum}</strong></span>
            <span style="color:var(--text-muted)">Date:</span><span>${new Date().toLocaleDateString()}</span>
            <span style="color:var(--text-muted)">Student:</span><span>${esc(student.first_name)} ${esc(student.last_name)}</span>
            <span style="color:var(--text-muted)">Class:</span><span>${esc(cls?.name || '—')}</span>
            <span style="color:var(--text-muted)">Amount:</span><span><strong>${fmtCurrency(amount)}</strong></span>
            <span style="color:var(--text-muted)">Method:</span><span>${method}</span>
        </div>
        ${amount > 0 ? `<div style="text-align:center;margin-top:8px;padding:8px;background:var(--success-bg);border-radius:6px;color:var(--success);font-weight:600">✅ Amount: ${fmtCurrency(amount)}</div>` : ''}
    </div>`;
}

function resetPaymentForm() {
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-ref').value = '';
    document.getElementById('pay-notes').value = '';
    selectedFees.clear();
    if (currentStudentId) renderFeeTable();
    showToast('Form cleared', 'info', 1500);
}

async function processPayment(printAfter = false) {
    if (!currentStudentId) { showToast('Please select a student', 'warning'); return; }
    const amount = parseFloat(document.getElementById('pay-amount')?.value);
    const date = document.getElementById('pay-date')?.value;
    const method = document.getElementById('pay-method')?.value;
    const ref = document.getElementById('pay-ref')?.value || null;
    const notes = document.getElementById('pay-notes')?.value || null;
    if (!date) { showToast('Please select a payment date', 'warning'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'warning'); return; }

    const selectedFeeIds = [];
    for (const [feeId, selected] of selectedFees.entries()) if (selected) selectedFeeIds.push(feeId);
    if (selectedFeeIds.length === 0) { showToast('Please select at least one fee to pay', 'warning'); return; }

    const student = state.students.find(s => s.id == currentStudentId);
    const receiptNum = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(state.payments.length + 1).padStart(4, '0')}`;

    const payment = await insert('payments', {
        student_id: currentStudentId, amount: amount, payment_date: date,
        payment_method: method, receipt_number: receiptNum, reference: ref, notes: notes,
        recorded_by: state.currentUser?.id || null, created_at: new Date().toISOString()
    });
    if (!payment) { showToast('Failed to record payment', 'error'); return; }

    let remainingAmount = amount;
    const sortedFees = selectedFeeIds.map(id => state.studentFees.find(f => f.id === id)).filter(f => f)
        .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

    for (const fee of sortedFees) {
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
            student_id: currentStudentId, fee_category_id: null, term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id, amount: 0, paid_amount: remainingAmount,
            is_paid: false, is_waived: false, is_credit: true, credit_amount: remainingAmount,
            notes: `Overpayment credit from receipt ${receiptNum}`, created_at: new Date().toISOString()
        });
        showToast(`⚠️ ${fmtCurrency(remainingAmount)} credit created`, 'warning');
    }

    await refreshTable('payments');
    await refreshTable('student_fees');
    showToast(`✅ Payment of ${fmtCurrency(amount)} recorded (${receiptNum})`, 'success');

    // Auto-print if setting is enabled
    const autoPrint = localStorage.getItem('receipt_auto_print') === 'yes';
    if (autoPrint && !printAfter && payment?.id) {
        await printReceipt(payment.id);
    }

    if (printAfter) {
        await printReceipt(payment.id);
    }
    resetPaymentForm();
    if (printAfter) {
        window.navigateTo('payment-history');
    }
}