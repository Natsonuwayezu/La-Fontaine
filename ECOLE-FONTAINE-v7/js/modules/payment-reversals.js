// js/modules/payment-reversals.js
// Payment Reversals Module - Reverse incorrect payments and issue refunds

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, fmtDateTime, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderPaymentReversals(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin' && user?.role !== 'accountant') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin or Accountant privileges required.</div>';
        return;
    }

    const payments = [...state.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🔄 Payment Reversals & Refunds</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportReversalHistory()">📥 Export History</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-warning">
                    <strong>⚠️ Warning:</strong> Reversing a payment will:
                    <ul style="margin-top:8px; margin-left:20px">
                        <li>Remove the payment from the student's account</li>
                        <li>Restore the original fee balances</li>
                        <li>Create a reversal record for audit purposes</li>
                        <li>This action CANNOT be undone</li>
                    </ul>
                </div>
                
                <div class="filters-bar">
                    <input type="text" id="reversal-search" class="form-control flex-1" placeholder="🔍 Search by receipt #, student name..." oninput="window.filterReversalPayments()">
                    <select id="reversal-method-filter" class="form-control" style="width:150px" onchange="window.filterReversalPayments()">
                        <option value="">All Methods</option>
                        <option value="Cash">Cash</option>
                        <option value="Mobile-Money">Mobile-Money</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                    <span class="result-count" id="reversal-count"></span>
                </div>
                
                <div class="table-wrapper" id="reversal-payments-table">
                    <div class="loading-container"><div class="spinner"></div><p>Loading payments...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📜 Reversal History</span>
            </div>
            <div class="dash-card-body">
                <div id="reversal-history" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading history...</p></div>
                </div>
            </div>
        </div>
    `;

    window.filterReversalPayments = filterReversalPayments;
    window.exportReversalHistory = exportReversalHistory;
    window.reversePayment = reversePayment;
    window.viewReversalDetails = viewReversalDetails;

    await renderPaymentsList();
    await loadReversalHistory();
}

async function renderPaymentsList() {
    let payments = [...state.payments].filter(p => !p.is_refund && !p.is_reversed);
    payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    window._allReversalPayments = payments;
    filterReversalPayments();
}

function filterReversalPayments() {
    const search = document.getElementById('reversal-search')?.value.toLowerCase();
    const methodFilter = document.getElementById('reversal-method-filter')?.value;
    const container = document.getElementById('reversal-payments-table');

    let filtered = window._allReversalPayments || [];

    if (search) {
        filtered = filtered.filter(p => {
            const st = getStudentById(p.student_id);
            return (p.receipt_number || '').toLowerCase().includes(search) ||
                (st?.first_name?.toLowerCase() || '').includes(search) ||
                (st?.last_name?.toLowerCase() || '').includes(search);
        });
    }
    if (methodFilter) filtered = filtered.filter(p => p.payment_method === methodFilter);

    const countSpan = document.getElementById('reversal-count');
    if (countSpan) countSpan.textContent = `${filtered.length} payment${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No payments found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th style="text-align:right">Amount</th>
                    <th>Method</th>
                    <th>Recorded By</th>
                    <th>Age</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(p => {
        const st = getStudentById(p.student_id);
        const cls = st ? getClassById(st.class_id) : null;
        const daysOld = Math.ceil((Date.now() - new Date(p.created_at)) / 86400000);
        const canReverse = daysOld <= 30;

        return `
                        <tr>
                            <td>${fmtDate(p.payment_date || p.created_at)}</span>
                            <td><code>${esc(p.receipt_number || '—')}</code></span>
                            <td><strong>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td style="text-align:right; font-weight:700">${fmtCurrency(p.amount)}</span>
                            <td>${esc(p.payment_method || '—')}</span>
                            <td>${esc(p.recorded_by ? (state.teachers.find(t => t.id === p.recorded_by)?.name || 'System') : 'System')}</span>
                            <td style="text-align:center">${daysOld} day${daysOld !== 1 ? 's' : ''}</span>
                            <td style="text-align:center">
                                ${canReverse ?
                `<button class="btn btn-sm btn-danger" onclick="window.reversePayment(${p.id}, '${p.receipt_number}', ${p.amount})" ${p.is_reversed ? 'disabled' : ''}>
                                        🔄 Reverse Payment
                                    </button>` :
                `<span class="badge badge-danger">Too Old (${daysOld} days)</span>`
            }
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function reversePayment(paymentId, receiptNumber, amount) {
    const payment = state.payments.find(p => p.id === paymentId);
    if (!payment) {
        showToast('Payment not found', 'error');
        return;
    }

    const student = getStudentById(payment.student_id);
    const reason = prompt(`Enter reason for reversing payment ${receiptNumber} (${fmtCurrency(amount)}):\n\nStudent: ${student?.first_name} ${student?.last_name}`);

    if (!reason) {
        showToast('Reason is required for reversal', 'warning');
        return;
    }

    if (!await confirmDialog(
        `⚠️ REVERSE PAYMENT ⚠️\n\n` +
        `Receipt: ${receiptNumber}\n` +
        `Student: ${student?.first_name} ${student?.last_name}\n` +
        `Amount: ${fmtCurrency(amount)}\n` +
        `Reason: ${reason}\n\n` +
        `This will remove the payment and restore fee balances.\n` +
        `This action CANNOT be undone!\n\n` +
        `Type "REVERSE" to confirm.`
    )) {
        const confirmation = prompt('Type "REVERSE" to confirm:');
        if (confirmation !== 'REVERSE') return;
    }

    try {
        // Get payment allocations
        let allocations = [];
        try {
            allocations = await getAll('payment_allocations', { payment_id: paymentId });
        } catch (e) { }

        // Reverse each allocation - restore fee balances
        for (const alloc of allocations) {
            const fee = state.studentFees.find(f => f.id === alloc.student_fee_id);
            if (fee) {
                const newPaidAmount = (fee.paid_amount || 0) - alloc.amount;
                await update('student_fees', fee.id, {
                    paid_amount: Math.max(0, newPaidAmount),
                    is_paid: false,
                    updated_at: new Date().toISOString(),
                    reversal_notes: `Payment ${receiptNumber} reversed: ${reason}`
                });
            }
        }

        // Mark payment as reversed
        await update('payments', paymentId, {
            is_reversed: true,
            reversed_at: new Date().toISOString(),
            reversed_by: state.currentUser?.id,
            reversal_reason: reason
        });

        // Create reversal record
        await insert('payment_reversals', {
            original_payment_id: paymentId,
            receipt_number: receiptNumber,
            amount: amount,
            student_id: payment.student_id,
            reversal_date: new Date().toISOString(),
            reversed_by: state.currentUser?.id,
            reason: reason,
            created_at: new Date().toISOString()
        });

        // Log the reversal
        await insert('activity_logs', {
            user_id: state.currentUser?.id,
            user_role: state.currentUser?.role,
            action: `Reversed payment ${receiptNumber} (${fmtCurrency(amount)})`,
            entity_type: 'payment_reversal',
            entity_id: paymentId,
            details: JSON.stringify({ receipt: receiptNumber, amount, reason, student: student?.first_name + ' ' + student?.last_name }),
            created_at: new Date().toISOString()
        });

        await refreshTable('payments');
        await refreshTable('student_fees');

        showToast(`✅ Payment ${receiptNumber} reversed successfully`, 'success');
        await renderPaymentsList();
        await loadReversalHistory();

    } catch (error) {
        showToast('Error reversing payment: ' + error.message, 'error');
    }
}

async function loadReversalHistory() {
    const container = document.getElementById('reversal-history');
    if (!container) return;

    let reversals = [];
    try {
        reversals = await getAll('payment_reversals', { order: 'reversal_date.desc', limit: 100 });
    } catch (e) {
        // Table might not exist yet
        reversals = [];
    }

    if (reversals.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No reversal history found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Student</th>
                    <th style="text-align:right">Amount</th>
                    <th>Reversed By</th>
                    <th>Reason</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${reversals.map(r => {
        const st = getStudentById(r.student_id);
        const reversedBy = state.teachers.find(t => t.id === r.reversed_by)?.name || 'System';
        return `
                        <tr>
                            <td>${fmtDateTime(r.reversal_date)}</span>
                            <td><code>${esc(r.receipt_number)}</code></span>
                            <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span>
                            <td style="text-align:right; color:var(--danger); font-weight:700">-${fmtCurrency(r.amount)}</span>
                            <td>${esc(reversedBy)}</span>
                            <td>${esc(r.reason)}</span>
                            <td style="text-align:center">
                                <button class="btn btn-sm btn-outline" onclick="window.viewReversalDetails(${r.id})">👁️</button>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function viewReversalDetails(reversalId) {
    let reversal;
    try {
        reversal = await getById('payment_reversals', reversalId);
    } catch (e) {
        showToast('Reversal record not found', 'error');
        return;
    }

    if (!reversal) return;

    const student = getStudentById(reversal.student_id);
    const reversedBy = state.teachers.find(t => t.id === reversal.reversed_by)?.name || 'System';

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📋 Payment Reversal Details</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Reversal Date</label><input readonly value="${fmtDateTime(reversal.reversal_date)}" class="form-control"></div>
                        <div class="form-group"><label>Receipt Number</label><input readonly value="${esc(reversal.receipt_number)}" class="form-control"></div>
                        <div class="form-group"><label>Student</label><input readonly value="${student ? esc(student.first_name + ' ' + student.last_name) : '—'}" class="form-control"></div>
                        <div class="form-group"><label>Amount</label><input readonly value="${fmtCurrency(reversal.amount)}" class="form-control" style="color:var(--danger)"></div>
                        <div class="form-group"><label>Reversed By</label><input readonly value="${esc(reversedBy)}" class="form-control"></div>
                        <div class="form-group full"><label>Reason</label><textarea readonly class="form-control" rows="3">${esc(reversal.reason)}</textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportReversalHistory() {
    const data = [];
    const reversals = window._allReversalPayments?.filter(p => p.is_reversed) || [];

    for (const payment of reversals) {
        const st = getStudentById(payment.student_id);
        data.push({
            'Reversal Date': fmtDateTime(payment.reversed_at),
            'Original Date': fmtDate(payment.payment_date || payment.created_at),
            'Receipt #': payment.receipt_number,
            'Student': st ? `${st.first_name} ${st.last_name}` : '—',
            'Amount (RWF)': -payment.amount,
            'Method': payment.payment_method,
            'Reason': payment.reversal_reason || '—',
            'Reversed By': payment.reversed_by ? (state.teachers.find(t => t.id === payment.reversed_by)?.name || 'System') : 'System'
        });
    }

    if (data.length === 0) {
        showToast('No reversal history to export', 'warning');
        return;
    }

    exportToExcel(data, `Payment_Reversals_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Reversal history exported', 'success');
}

function getById(table, id) {
    return getAll(table, { id: id }).then(r => r[0]);
}