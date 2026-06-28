// js/modules/fee-waivers.js
// Fee Waivers Module - Manage fee waivers, discounts, scholarships

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderFeeWaivers(container) {
    await ensureStateLoaded();

    const waivers = state.studentFees.filter(f => f.is_waived === true);

    const waiverSummary = {};
    for (const w of waivers) {
        if (!waiverSummary[w.student_id]) {
            waiverSummary[w.student_id] = { total: 0, count: 0, student: getStudentById(w.student_id) };
        }
        waiverSummary[w.student_id].total += w.amount;
        waiverSummary[w.student_id].count++;
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🎁 Fee Waivers</span>
                <button class="btn btn-sm btn-primary" onclick="window.openFullWaiverModal()">➕ Add Waiver</button>
            </div>
            <div class="dash-card-body" style="padding:0">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px;background:var(--bg-tertiary);border-bottom:1px solid var(--border-light)">
                    <div class="stat-card" style="margin:0;padding:12px">
                        <div class="stat-value">${fmtCurrency(waivers.reduce((a, w) => a + w.amount, 0))}</div>
                        <div class="stat-label">Total Waived Amount</div>
                    </div>
                    <div class="stat-card" style="margin:0;padding:12px">
                        <div class="stat-value">${waivers.length}</div>
                        <div class="stat-label">Total Waivers</div>
                    </div>
                    <div class="stat-card" style="margin:0;padding:12px">
                        <div class="stat-value">${Object.keys(waiverSummary).length}</div>
                        <div class="stat-label">Students with Waivers</div>
                    </div>
                </div>
                
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr><th>Student</th><th>Class</th><th>Category</th><th>Amount Waived</th><th>Reason</th><th>Date</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            ${waivers.length ? waivers.map(w => {
        const st = getStudentById(w.student_id);
        const cat = state.feeCategories.find(f => f.id === w.fee_category_id);
        const cls = st ? getClassById(st.class_id) : null;
        return `
                                    <tr>
                                        <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}<br><small>${esc(st?.student_code || '')}</small></td>
                                        <td>${esc(cls?.name || '—')}</td>
                                        <td>${esc(cat?.name || '—')}</td>
                                        <td style="color:var(--success);font-weight:600">- ${fmtCurrency(w.amount)}</span></td>
                                        <td>${esc(w.waiver_reason || '—')}</span></td>
                                        <td>${fmtDate(w.created_at)}</span></td>
                                        <td><button class="btn btn-sm btn-danger" onclick="window.removeWaiver(${w.id})">🗑️ Remove</button></td>
                                    </tr>
                                `;
    }).join('') : `<tr><td colspan="7" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No waivers recorded</span>`}
                        </tbody>
                    </table>
                </div>
                
                <div class="alert alert-info" style="margin:16px;font-size:.8rem">
                    <strong>📊 Impact of Waivers:</strong><br>
                    • Total fees removed from student balances: <strong>${fmtCurrency(waivers.reduce((a, w) => a + w.amount, 0))}</strong><br>
                    • This amount is <strong>NOT included</strong> in student fee balances or financial reports.<br>
                    • Removing a waiver will add the amount back to the student's balance.
                </div>
            </div>
        </div>
    `;

    window.openFullWaiverModal = openFullWaiverModal;
    window.submitFullWaiver = submitFullWaiver;
    window.removeWaiver = removeWaiver;
}

function openFullWaiverModal() {
    showModal(`
        <div class="modal-overlay"><div class="modal"><div class="modal-header"><h3>🎁 Add Fee Waiver</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Student *</label><select id="full-wv-student"><option value="">— Select —</option>${state.students.filter(s => s.status === 'Active').map(s => `<option value="${s.id}">${esc(s.first_name + ' ' + s.last_name)}</option>`).join('')}</select></div>
            <div class="form-group"><label>Fee Category</label><select id="full-wv-cat">${state.feeCategories.filter(f => f.is_active !== false).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div>
            <div class="form-group"><label>Amount Waived (RWF)</label><input type="number" id="full-wv-amount" min="0"></div>
            <div class="form-group full"><label>Reason *</label><textarea id="full-wv-reason" rows="2" placeholder="e.g., Sibling discount, Financial hardship, Scholarship..."></textarea></div>
        </div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="window.submitFullWaiver()">Apply Waiver</button></div></div></div>
    `);
}

async function submitFullWaiver() {
    const studentId = document.getElementById('full-wv-student')?.value;
    const catId = document.getElementById('full-wv-cat')?.value;
    const amount = parseFloat(document.getElementById('full-wv-amount')?.value);
    const reason = document.getElementById('full-wv-reason')?.value.trim();

    if (!studentId || !reason || isNaN(amount) || amount <= 0) {
        showToast('All fields required', 'warning');
        return;
    }

    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;

    let existingFee = state.studentFees.find(f =>
        f.student_id == studentId && f.fee_category_id == catId &&
        f.term_id == termId && !f.is_waived
    );

    if (existingFee) {
        await update('student_fees', existingFee.id, {
            is_waived: true, waiver_reason: reason,
            updated_at: new Date().toISOString()
        });
        showToast(`✅ Fee waived for student`, 'success');
    } else {
        await insert('student_fees', {
            student_id: parseInt(studentId), fee_category_id: parseInt(catId),
            amount: amount, is_waived: true, waiver_reason: reason,
            academic_year_id: yearId, term_id: termId,
            paid_amount: 0, is_paid: false,
            due_date: state.currentTerm?.end_date || null,
            created_at: new Date().toISOString()
        });
        showToast(`✅ Waiver of ${fmtCurrency(amount)} applied`, 'success');
    }

    state.studentFees = await getAll('student_fees');
    state.payments = await getAll('payments');
    closeModal();

    const dynEl = document.getElementById('dynamic-content');
    const mid = window._activeModuleId || '';
    if (mid === 'fee-waivers') renderFeeWaivers(dynEl);
    else if (mid === 'student-fees') renderStudentFees(dynEl);
    else if (mid === 'overdue-payments') renderOverduePayments(dynEl);
    else renderFeeWaivers(dynEl);
}

async function removeWaiver(waiverId) {
    const waiver = state.studentFees.find(f => f.id === waiverId);
    if (!waiver) return;

    const student = getStudentById(waiver.student_id);
    const category = state.feeCategories.find(c => c.id === waiver.fee_category_id);

    if (!await confirmDialog(`Remove waiver for ${student ? (student.first_name + ' ' + student.last_name) : '?'} — ${category?.name || '?'} (${fmtCurrency(waiver.amount)})?\n\nThis will restore the fee to the student's outstanding balance.`)) return;

    await update('student_fees', waiverId, {
        is_waived: false, waiver_reason: null, waived_amount: 0,
        updated_at: new Date().toISOString()
    });

    state.studentFees = await getAll('student_fees');
    state.payments = await getAll('payments');

    showToast(`✅ Waiver removed. ${fmtCurrency(waiver.amount)} restored to ${student?.first_name || ''}'s balance`, 'success');
    renderFeeWaivers(document.getElementById('dynamic-content'));
}