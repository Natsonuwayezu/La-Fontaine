// js/modules/receipts.js
// Receipts Module - Print and manage payment receipts

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast } from '../ui/modals.js';
import { fmtCurrency, fmtDate, fmtDateTime, esc } from '../core/utils.js';
import { getStudentById, getClassById } from './student-fees.js';

export async function renderReceipts(container) {
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🧾 Receipts</span></div>
            <div class="dash-card-body">
                <div class="alert alert-info">Select a payment to view and print its receipt.</div>
                <div class="form-group" style="max-width:400px">
                    <label>Search Payment / Receipt #</label>
                    <input type="text" id="rc-search-full" placeholder="Receipt # or student name..." oninput="window.renderFullReceiptsList()">
                </div>
                <div id="receipts-list-full" class="table-wrapper" style="margin-top:var(--md)"></div>
            </div>
        </div>
    `;

    window.renderFullReceiptsList = renderFullReceiptsList;
    window.printEnhancedReceipt = printEnhancedReceipt;

    renderFullReceiptsList();
}

function renderFullReceiptsList() {
    const q = document.getElementById('rc-search-full')?.value.toLowerCase() || '';
    const filtered = state.payments.filter(p => {
        const st = getStudentById(p.student_id);
        return (p.receipt_number || '').toLowerCase().includes(q) ||
            (st ? `${st.first_name} ${st.last_name}`.toLowerCase() : '').includes(q);
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);

    const div = document.getElementById('receipts-list-full');
    div.innerHTML = `
        <table class="data-table">
            <thead><tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th></th></tr></thead>
            <tbody>
                ${filtered.map(p => {
        const st = getStudentById(p.student_id);
        return `
                        <tr>
                            <td><code>${esc(p.receipt_number || '—')}</code></td>
                            <td>${fmtDate(p.payment_date || p.created_at)}</span></td>
                            <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span></td>
                            <td>${fmtCurrency(p.amount)}</span></td>
                            <td>${esc(p.payment_method || '—')}</span></td>
                            <td><button class="btn btn-sm btn-primary" onclick="window.printReceipt(${p.id})">🖨️ Print</button></td>
                        </tr>
                    `;
    }).join('') || `<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No receipts found</span>`}
            </tbody>
        </table>
    `;
}

export async function printReceipt(paymentId) {
    const payment = state.payments.find(p => p.id == paymentId) ||
        (await getAll('payments').catch(() => [])).find(p => p.id == paymentId);
    if (!payment) { showToast('Payment not found', 'error'); return; }

    const st = getStudentById(payment.student_id);
    const cls = st ? getClassById(st.class_id) : null;
    const school = state.schoolSettings || {};
    const logo = school.school_logo || '';

    let logoHtml = '';
    if (logo && (logo.startsWith('data:') || logo.startsWith('http')))
        logoHtml = `<img src="${logo}" style="width:32px;height:32px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'">`;

    let allocations = [];
    try { allocations = await getAll('payment_allocations', { payment_id: paymentId }); } catch (e) { }
    const allFees = (state.studentFees || []).filter(f => f.student_id === payment.student_id && !f.is_credit && !f.is_waived);
    const feeRows = allocations.length > 0
        ? allocations.map(a => {
            const fee = (state.studentFees || []).find(f => f.id === a.student_fee_id);
            const cat = (state.feeCategories || []).find(c => c.id === fee?.fee_category_id);
            const feeTotal = fee?.amount || 0, feePaid = (fee?.paid_amount || 0), feeDue = Math.max(0, feeTotal - feePaid);
            return { cat: cat?.name || 'Fee', feeTotal, thisPmt: a.amount, feeDue };
        })
        : allFees.map(f => {
            const cat = (state.feeCategories || []).find(c => c.id === f.fee_category_id);
            const due = Math.max(0, f.amount - (f.paid_amount || 0));
            return { cat: cat?.name || 'Fee', feeTotal: f.amount, thisPmt: f.paid_amount || 0, feeDue: due };
        });

    const grandTotal = allFees.reduce((s, f) => s + f.amount, 0);
    const grandPaid = allFees.reduce((s, f) => s + (f.paid_amount || 0), 0);
    const grandDue = Math.max(0, grandTotal - grandPaid);
    const paidStatus = grandDue === 0 ? { t: 'PAID IN FULL', bg: '#d1fae5', col: '#065f46' }
        : grandPaid > 0 ? { t: 'PARTIALLY PAID', bg: '#fef3c7', col: '#92400e' }
            : { t: 'OUTSTANDING', bg: '#fee2e2', col: '#991b1b' };

    const fmtC = n => Number(n || 0).toLocaleString('en-RW') + ' RWF';
    const fmtD = s => { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s || '—'; } };
    const esc2 = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const receiptNum = payment.receipt_number || `RCP-${payment.id}`;
    const schoolName = school.school_name || 'ECOLE LA FONTAINE';
    const schoolAddr = school.school_address || school.school_location || '';
    const schoolPhone = school.school_phone || '';
    const schoolMotto = school.school_motto || '';
    const recordedBy = (state.teachers || []).find(t => t.id === payment.recorded_by)?.name ||
        (state.currentUser?.name) || 'Cashier';
    const parentName = st ? (st.guardian_name || '') : '';
    const termName = state.currentTerm?.name || '';
    const printedTime = new Date().toLocaleString('en-RW');

    const feeTableRows = feeRows.length
        ? feeRows.map(r => `
            <tr>
                <td style="padding:2px 0">${esc2(r.cat)}</span>
                <td class="tr">${fmtC(r.feeTotal)}</span>
                <td class="tr">${fmtC(r.thisPmt)}</span>
                <td class="tr" style="${r.feeDue > 0 ? 'color:#dc2626;font-weight:600' : 'color:#10b981'}">${fmtC(r.feeDue)}</span>
            </tr>
        `).join('')
        : '<tr><td colspan="4" style="text-align:center;padding:6px 0;color:#999">No fee breakdown available</td></tr>';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Receipt ${receiptNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e2e8f0;display:flex;flex-direction:column;align-items:center;padding:20px 12px;font-family:'Courier New',Monaco,Menlo,monospace;min-height:100vh}
.receipt{width:320px;background:#fff;border:1px solid #ccc;border-radius:4px;padding:10px 10px;box-shadow:0 2px 8px rgba(0,0,0,.1);font-size:9px;line-height:1.35}
.rh{text-align:center;margin-bottom:8px}
.rh-top{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px}
.sname{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
.rtitle{font-size:8px;font-weight:700;letter-spacing:1px;color:#444}
.rnum{font-size:8px;background:#f0f4f8;display:inline-block;padding:1px 8px;margin-top:3px;border-radius:3px;font-weight:700;color:#1a3a5c;border:1px solid #ddd}
.ssub{font-size:7px;color:#666;margin-top:1px}
.dash{border-top:1px dashed #999;margin:5px 0}
.solid{border-top:1px solid #000;margin:5px 0}
.dot{border-top:1px dotted #bbb;margin:4px 0}
.ir{display:flex;justify-content:space-between;margin:3px 0;font-size:8px}
.il{font-weight:700;color:#555}
.iv{font-weight:500;text-align:right}
.fee-table{width:100%;border-collapse:collapse;font-size:7.5px;margin:5px 0}
.fee-table th{text-align:left;border-bottom:1px solid #bbb;padding:2px 0;font-size:6.5px;text-transform:uppercase}
.fee-table td{padding:2px 0;border-bottom:1px dotted #eee}
.tr{text-align:right}
.sr{display:flex;justify-content:space-between;margin:3px 0;font-weight:700;font-size:9px}
.grand{font-size:11px;font-weight:800;color:#065f46}
.sig-line{display:flex;justify-content:space-between;margin:10px 0 5px 0;padding-top:5px}
.sig-item{text-align:center;width:45%}
.sig-label{font-size:6.5px;font-weight:700;color:#555;margin-bottom:2px}
.sig-space{border-top:1px solid #000;width:100%;margin-top:14px;padding-top:3px;font-size:6px;color:#555}
.rf{text-align:center;font-size:6.5px;color:#888;margin-top:8px}
.badge{display:inline-block;padding:1px 6px;border-radius:10px;font-size:6.5px;font-weight:700}
.print-btn{margin-top:12px;background:#1a3a5c;color:#fff;border:none;padding:6px 18px;border-radius:30px;font-size:11px;cursor:pointer}
.print-btn:hover{background:#2d5a8e}
@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border:1px solid #000;width:100%}.print-btn,.no-print{display:none!important}@page{size:A6 portrait;margin:6mm}}
</style>
</head>
<body>
<div class="receipt">
  <div class="rh">
    <div class="rh-top">${logoHtml ? `<div style="flex-shrink:0">${logoHtml}</div>` : ''}<div><div class="sname">${esc2(schoolName)}</div>${schoolMotto ? `<div class="ssub">"${esc2(schoolMotto)}"</div>` : ''}</div></div>
    ${schoolAddr ? `<div class="ssub">${esc2(schoolAddr)}</div>` : ''}
    ${schoolPhone ? `<div class="ssub">Tel: ${esc2(schoolPhone)}</div>` : ''}
    <div class="rtitle">PAYMENT RECEIPT</div>
    <div class="rnum">${esc2(receiptNum)}</div>
  </div>
  <div class="dash"></div>
  <div class="ir"><span class="il">Student:</span><span class="iv">${st ? (esc2(st.first_name) + ' ' + esc2(st.last_name)).toUpperCase() : '—'}</span></div>
  <div class="ir"><span class="il">Code:</span><span class="iv">${esc2(st?.student_code || '—')}</span></div>
  <div class="ir"><span class="il">Class:</span><span class="iv">${esc2(cls?.name || '—')}</span></div>
  ${parentName ? `<div class="ir"><span class="il">Guardian:</span><span class="iv">${esc2(parentName)}</span></div>` : ''}
  <div class="dot"></div>
  <div class="ir"><span class="il">Date:</span><span class="iv">${fmtD(payment.payment_date || payment.created_at)}</span></div>
  <div class="ir"><span class="il">Method:</span><span class="iv">${esc2((payment.payment_method || '—').toUpperCase())}</span></div>
  ${payment.reference ? `<div class="ir"><span class="il">Reference:</span><span class="iv">${esc2(payment.reference)}</span></div>` : ''}
  <div class="ir"><span class="il">Received By:</span><span class="iv">${esc2(recordedBy)}</span></div>
  ${termName ? `<div class="ir"><span class="il">Term:</span><span class="iv">${esc2(termName)}</span></div>` : ''}
  <div class="dash"></div>
  <table class="fee-table">
    <thead><tr><th>Fee</th><th class="tr">Amount</th><th class="tr">Paid</th><th class="tr">Due</th></tr></thead>
    <tbody>${feeTableRows}</tbody>
  </table>
  <div class="dash"></div>
  <div class="sr"><span>TOTAL FEES:</span><span>${fmtC(grandTotal)}</span></div>
  <div class="sr"><span>THIS PAYMENT:</span><span class="grand">${fmtC(payment.amount)}</span></div>
  <div class="sr"><span>REMAINING:</span><span style="color:${grandDue > 0 ? '#dc2626' : '#10b981'}">${fmtC(grandDue)}</span></div>
  <div class="dot"></div>
  <div class="ir"><span class="il">Status:</span><span class="badge" style="background:${paidStatus.bg};color:${paidStatus.col}">${paidStatus.t}</span></div>
  ${payment.notes ? `<div class="ir" style="margin-top:4px"><span class="il">Notes:</span><span class="iv">${esc2(payment.notes)}</span></div>` : ''}
  <div class="solid"></div>
  <div class="sig-line">
    <div class="sig-item"><div class="sig-label">PARENT/GUARDIAN</div><div class="sig-space">${esc2(parentName) || '_________________'}</div></div>
    <div class="sig-item"><div class="sig-label">CASHIER</div><div class="sig-space">${esc2(recordedBy)}</div></div>
  </div>
  <div class="rf">
    <div>✩ ${esc2(schoolName)} ✩</div>
    <div style="margin-top:2px">Printed: ${printedTime}</div>
  </div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ PRINT / PDF</button>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=400,height=650,scrollbars=yes');
    if (!win) { showToast('Pop-up blocked — please allow pop-ups', 'warning'); return; }
    win.document.write(html);
    win.document.close();
}

function printEnhancedReceipt(paymentId) {
    return printReceipt(paymentId);
}