// js/modules/overdue-payments.js
// Overdue Payments Module - Track and manage late fee payments

import { state } from '../core/state.js';
import { showToast } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc } from '../core/utils.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';
import { openRecordPaymentForStudent } from './payment-recording.js';
import { openBulkPaymentModal } from './bulk-finance-actions.js';

export async function renderOverduePayments(container) {
    await ensureStateLoaded();

    const overdueList = [];
    for (const s of state.students.filter(s => s.status === 'Active')) {
        const fees = state.studentFees.filter(f => f.student_id === s.id && !f.is_paid && !f.is_waived);
        const oldest = fees.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))[0];
        if (oldest?.due_date) {
            const days = Math.ceil((Date.now() - new Date(oldest.due_date)) / 86400000);
            if (days >= 7) {
                const b = getFullStudentBalance(s.id);
                overdueList.push({ s, b, days, cls: getClassById(s.class_id), oldestFee: oldest });
            }
        }
    }
    overdueList.sort((a, b) => b.days - a.days);

    const critical = overdueList.filter(o => o.days >= 30);
    const warning = overdueList.filter(o => o.days >= 15 && o.days < 30);
    const mild = overdueList.filter(o => o.days >= 7 && o.days < 15);

    container.innerHTML = `
        <div class="dash-card">
            <div class="btn-group" style="margin-bottom:16px; padding:0 16px; padding-top:16px">
                <button class="btn btn-primary" onclick="window.openBulkPaymentModal()">💰 Bulk Record Payments</button>
                <button class="btn btn-outline" onclick="window.exportBulkPaymentTemplate()">📥 Download Template</button>
            </div>
            <div class="dash-card-header">
                <span class="dash-card-title">⚠️ Overdue Payments</span>
                <span class="result-count">${overdueList.length} students with overdue fees (7+ days)</span>
            </div>
            <div class="dash-card-body" style="padding:0">
                ${critical.length > 0 ? `
                <div style="background:var(--danger-bg);padding:12px 16px;">
                    <strong>🔴 CRITICAL (${critical.length} students - 30+ days)</strong>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></tr></thead>
                        <tbody>
                            ${critical.map(({ s, b, days, cls, oldestFee }) => `
                                <tr>
                                    <td><strong>${esc(s.first_name + ' ' + s.last_name)}</strong></td>
                                    <td>${esc(cls?.name || '—')}</td>
                                    <td>${fmtCurrency(b.balance)}</span></td>
                                    <td><span class="overdue-red">${days} days 🔴</span></td>
                                    <td>${fmtDate(oldestFee.due_date)}</span></td>
                                    <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${s.id})">💰 Pay Now</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                
                ${warning.length > 0 ? `
                <div style="background:var(--warning-bg);padding:12px 16px;margin-top:16px;">
                    <strong>🟠 WARNING (${warning.length} students - 15-29 days)</strong>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></tr></thead>
                        <tbody>
                            ${warning.map(({ s, b, days, cls, oldestFee }) => `
                                <tr>
                                    <td><strong>${esc(s.first_name + ' ' + s.last_name)}</strong></td>
                                    <td>${esc(cls?.name || '—')}</td>
                                    <td>${fmtCurrency(b.balance)}</span></td>
                                    <td><span class="overdue-orange">${days} days 🟠</span></td>
                                    <td>${fmtDate(oldestFee.due_date)}</span></td>
                                    <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${s.id})">💰 Pay Now</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                
                ${mild.length > 0 ? `
                <div style="background:var(--info-bg);padding:12px 16px;margin-top:16px;">
                    <strong>🟡 MILD (${mild.length} students - 7-14 days)</strong>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></tr></thead>
                        <tbody>
                            ${mild.map(({ s, b, days, cls, oldestFee }) => `
                                <tr>
                                    <td><strong>${esc(s.first_name + ' ' + s.last_name)}</strong></td>
                                    <td>${esc(cls?.name || '—')}</td>
                                    <td>${fmtCurrency(b.balance)}</span></td>
                                    <td><span class="overdue-yellow">${days} days 🟡</span></td>
                                    <td>${fmtDate(oldestFee.due_date)}</span></td>
                                    <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${s.id})">💰 Pay Now</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                
                ${overdueList.length === 0 ? `<div class="alert alert-success" style="margin:16px">🎉 No overdue payments! All fees are up to date.</div>` : ''}
            </div>
        </div>
    `;

    window.openBulkPaymentModal = openBulkPaymentModal;
    window.openRecordPaymentForStudent = openRecordPaymentForStudent;
}

async function ensureStateLoaded() {
    if (!state.students.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
