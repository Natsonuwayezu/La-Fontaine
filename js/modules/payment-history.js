// js/modules/payment-history.js
// Payment History Module - View and manage all payments

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';
import { printReceipt } from './receipts.js';

export async function renderPaymentHistory(container) {
    const sorted = [...state.payments].sort((a, b) =>
        new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at)
    );

    const regularPayments = sorted.filter(p => !p.is_credit_payment && !p.is_credit_addition);
    const creditPayments = sorted.filter(p => p.is_credit_payment === true);
    const creditAdditions = sorted.filter(p => p.is_credit_addition === true);

    const totalRegular = regularPayments.reduce((a, p) => a + p.amount, 0);
    const totalCreditUsed = creditPayments.reduce((a, p) => a + p.amount, 0);
    const totalCreditAdded = creditAdditions.reduce((a, p) => a + p.amount, 0);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📜 Payment History</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportFullPaymentHistory()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
                    <div class="stat-card" style="padding:12px">
                        <div class="stat-value">${fmtCurrency(totalRegular)}</div>
                        <div class="stat-label">Cash Payments Received</div>
                    </div>
                    <div class="stat-card" style="padding:12px;background:var(--info-bg)">
                        <div class="stat-value">${fmtCurrency(totalCreditUsed)}</div>
                        <div class="stat-label">💰 Credit Used</div>
                    </div>
                    <div class="stat-card" style="padding:12px;background:var(--success-bg)">
                        <div class="stat-value">${fmtCurrency(totalCreditAdded)}</div>
                        <div class="stat-label">⭐ Credit Added</div>
                    </div>
                    <div class="stat-card" style="padding:12px">
                        <div class="stat-value">${fmtCurrency(totalRegular + totalCreditUsed)}</div>
                        <div class="stat-label">Total Effective Collection</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <input type="text" class="flex-1" id="ph-search" placeholder="🔍 Search student or receipt..." oninput="window.filterPaymentHistoryTable()">
                    <span class="result-count">${sorted.length} transactions — Total: ${fmtCurrency(sorted.reduce((a, p) => a + p.amount, 0))}</span>
                </div>
                
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Class</th><th>Amount</th><th>Method</th><th>Type</th><th>Action</th></tr>
                        </thead>
                        <tbody id="ph-tbody">
                            ${sorted.map(p => {
        const st = getStudentById(p.student_id);
        let typeBadge = '', typeText = '';
        if (p.is_credit_payment === true) { typeBadge = 'badge-info'; typeText = '💰 Credit Used'; }
        else if (p.is_credit_addition === true) { typeBadge = 'badge-success'; typeText = '⭐ Credit Added'; }
        else { typeBadge = 'badge-primary'; typeText = '💵 Cash Payment'; }
        return `<tr>
                                    <td><code>${esc(p.receipt_number || '—')}</code></td>
                                    <td>${fmtDate(p.payment_date || p.created_at)}</span></td>
                                    <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span></td>
                                    <td>${esc(getClassById(st?.class_id)?.name || '—')}</span></td>
                                    <td><strong>${fmtCurrency(p.amount)}</strong></span></td>
                                    <td>${esc(p.payment_method || '—')}</span></td>
                                    <td><span class="badge ${typeBadge}">${typeText}</span></span></td>
                                    <td><button class="btn btn-sm btn-outline" onclick="window.printReceipt(${p.id})">🖨️</button></span></td>
                                </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No payments recorded</span>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    window.filterPaymentHistoryTable = filterPaymentHistoryTable;
    window.exportFullPaymentHistory = exportFullPaymentHistory;
}

function filterPaymentHistoryTable() {
    const search = document.getElementById('ph-search')?.value.toLowerCase();
    const rows = document.querySelectorAll('#ph-tbody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = !search || text.includes(search) ? '' : 'none';
    });
}

function exportFullPaymentHistory() {
    const data = state.payments.map(p => {
        const st = getStudentById(p.student_id);
        return {
            'Receipt': p.receipt_number || '',
            'Date': fmtDate(p.payment_date || p.created_at),
            'Student': st ? `${st.first_name} ${st.last_name}` : '—',
            'Class': getClassById(st?.class_id)?.name || '—',
            'Amount (RWF)': p.amount,
            'Method': p.payment_method || '—',
            'Reference': p.reference || ''
        };
    });
    exportToExcel(data, 'Payment_History');
}