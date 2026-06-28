// js/modules/fee-term-status.js
// Fee Term Status Module - View fee status across terms for students

import { state } from '../core/state.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderFeeTermStatus(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot view fee term status.</div>';
        return;
    }

    const students = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Fee Term Status</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportFeeTermStatus()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printFeeTermStatus()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="fts-class-filter" class="form-control" style="width:180px" onchange="window.renderFeeTermTable()">
                        <option value="">All Classes</option>
                        ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <input type="text" id="fts-search" class="form-control flex-1" placeholder="🔍 Search student..." oninput="window.renderFeeTermTable()">
                    <span class="result-count" id="fts-count"></span>
                </div>
                
                <div class="table-wrapper" id="fee-term-table">
                    <div class="loading-container"><div class="spinner"></div><p>Loading fee term data...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📈 Term Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="term-summary-stats" class="stats-grid" style="grid-template-columns:repeat(${terms.length}, 1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading summary...</p></div>
                </div>
            </div>
        </div>
    `;

    window.renderFeeTermTable = renderFeeTermTable;
    window.exportFeeTermStatus = exportFeeTermStatus;
    window.printFeeTermStatus = printFeeTermStatus;
    window.showStudentTermDetails = showStudentTermDetails;

    await renderFeeTermTable();
    await renderTermSummary();
}

async function renderFeeTermTable() {
    const classFilter = document.getElementById('fts-class-filter')?.value;
    const search = document.getElementById('fts-search')?.value.toLowerCase();
    const container = document.getElementById('fee-term-table');

    if (!container) return;

    let students = state.students.filter(s => s.status === 'Active');
    if (classFilter) students = students.filter(s => s.class_id == classFilter);
    if (search) students = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search) ||
        (s.student_code || '').toLowerCase().includes(search)
    );

    students = students.sort((a, b) => a.last_name.localeCompare(b.last_name));

    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);

    const countSpan = document.getElementById('fts-count');
    if (countSpan) countSpan.textContent = `${students.length} student${students.length !== 1 ? 's' : ''}`;

    if (students.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No students found</div>';
        return;
    }

    // Build term header
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Student Code</th>
                    ${terms.map(term => `<th>${esc(term.name)}</th>`).join('')}
                    <th>Total</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const student of students) {
        const cls = getClassById(student.class_id);
        let termTotals = [];
        let overallTotal = 0;

        for (const term of terms) {
            const fees = state.studentFees.filter(f =>
                f.student_id === student.id &&
                f.term_id === term.id &&
                !f.is_waived &&
                !f.is_credit
            );
            const total = fees.reduce((sum, f) => sum + f.amount, 0);
            const paid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
            const balance = total - paid;
            overallTotal += balance;

            let statusClass = '';
            let statusIcon = '';
            if (balance === 0 && total > 0) {
                statusClass = 'badge-success';
                statusIcon = '✅';
            } else if (balance > 0 && paid > 0) {
                statusClass = 'badge-warning';
                statusIcon = '⚠️';
            } else if (balance > 0) {
                statusClass = 'badge-danger';
                statusIcon = '🔴';
            } else {
                statusClass = 'badge-neutral';
                statusIcon = '—';
            }

            termTotals.push(`
                <td style="text-align:center">
                    <div class="badge ${statusClass}" style="cursor:pointer" onclick="window.showStudentTermDetails(${student.id}, ${term.id})" title="Click for details">
                        ${statusIcon} ${fmtCurrency(balance)}
                    </div>
                </td>
            `);
        }

        const overallClass = overallTotal > 0 ? 'text-danger' : (overallTotal < 0 ? 'text-success' : '');

        html += `
            <tr>
                <td><strong>${esc(student.first_name)} ${esc(student.last_name)}</strong></span>
                <td>${esc(cls?.name || '—')}</span>
                <td>${esc(student.student_code || '—')}</span>
                ${termTotals.join('')}
                <td style="text-align:right; font-weight:700; ${overallClass}">${fmtCurrency(overallTotal)}</span>
                <td style="text-align:center">
                    <button class="btn btn-sm btn-outline" onclick="window.showStudentTermDetails(${student.id}, null)">📊 View All</button>
                </td>
            </tr>
        `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function renderTermSummary() {
    const container = document.getElementById('term-summary-stats');
    if (!container) return;

    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);
    const termSummaries = [];

    for (const term of terms) {
        const fees = state.studentFees.filter(f => f.term_id === term.id && !f.is_waived && !f.is_credit);
        const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
        const totalPaid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        const outstanding = totalFees - totalPaid;
        const paidCount = fees.filter(f => f.is_paid).length;
        const partiallyPaid = fees.filter(f => !f.is_paid && (f.paid_amount || 0) > 0).length;
        const unpaid = fees.filter(f => !f.is_paid && (f.paid_amount || 0) === 0).length;

        termSummaries.push({
            term: term,
            totalFees: totalFees,
            totalPaid: totalPaid,
            outstanding: outstanding,
            paidCount: paidCount,
            partiallyPaid: partiallyPaid,
            unpaid: unpaid,
            collectionRate: totalFees > 0 ? (totalPaid / totalFees) * 100 : 100
        });
    }

    if (termSummaries.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No term data available</div>';
        return;
    }

    container.innerHTML = termSummaries.map(ts => `
        <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">${esc(ts.term.name)}</div>
            <div class="stat-label">${fmtCurrency(ts.totalFees)} total</div>
            <div class="stat-trend up">${ts.collectionRate.toFixed(1)}% collected</div>
            <div style="margin-top:8px; font-size:11px">
                <div>✅ Paid: ${ts.paidCount}</div>
                <div>⚠️ Partial: ${ts.partiallyPaid}</div>
                <div>🔴 Unpaid: ${ts.unpaid}</div>
            </div>
        </div>
    `).join('');
}

function showStudentTermDetails(studentId, termId = null) {
    const student = getStudentById(studentId);
    if (!student) return;

    let fees = state.studentFees.filter(f => f.student_id === studentId && !f.is_credit);
    if (termId) fees = fees.filter(f => f.term_id === termId);

    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);

    // Group by term
    const feesByTerm = new Map();
    for (const fee of fees) {
        if (!feesByTerm.has(fee.term_id)) feesByTerm.set(fee.term_id, []);
        feesByTerm.get(fee.term_id).push(fee);
    }

    let termRows = '';
    for (const term of terms) {
        const termFees = feesByTerm.get(term.id) || [];
        const total = termFees.reduce((sum, f) => sum + f.amount, 0);
        const paid = termFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        const balance = total - paid;
        const statusClass = balance === 0 ? 'badge-success' : (paid > 0 ? 'badge-warning' : 'badge-danger');
        const statusText = balance === 0 ? '✅ Paid' : (paid > 0 ? '⚠️ Partial' : '🔴 Due');

        termRows += `
            <div style="border:1px solid var(--border-light); border-radius:8px; margin-bottom:12px; overflow:hidden">
                <div style="background:var(--bg-tertiary); padding:10px 16px; font-weight:700; display:flex; justify-content:space-between">
                    <span>${esc(term.name)}</span>
                    <span class="badge ${statusClass}">${statusText} - ${fmtCurrency(balance)}</span>
                </div>
                <div style="padding:12px">
                    ${termFees.length ? `
                        <table class="data-table" style="font-size:12px">
                            <thead>
                                <tr><th>Fee Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th><th>Due Date</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${termFees.map(fee => {
            const cat = state.feeCategories.find(c => c.id === fee.fee_category_id);
            const remaining = fee.amount - (fee.paid_amount || 0);
            return `
                                        <tr>
                                            <td>${esc(cat?.name || 'Unknown')}</span>
                                            <td style="text-align:right">${fmtCurrency(fee.amount)}</span>
                                            <td style="text-align:right">${fmtCurrency(fee.paid_amount || 0)}</span>
                                            <td style="text-align:right; ${remaining > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">${fmtCurrency(remaining)}</span>
                                            <td>${fmtDate(fee.due_date)}</span>
                                            <td>${fee.is_waived ? '✅ Waived' : (fee.is_paid ? '✅ Paid' : (fee.paid_amount > 0 ? '⚠️ Partial' : '🔴 Due'))}</span>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    ` : '<div style="text-align:center;padding:20px;color:var(--text-muted)">No fees for this term</div>'}
                </div>
            </div>
        `;
    }

    const balance = getFullStudentBalance(studentId);

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 800px; max-height: 80vh; overflow-y: auto">
                <div class="modal-header">
                    <h3>📊 Fee Details - ${esc(student.first_name)} ${esc(student.last_name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px; margin-bottom:16px">
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; text-align:center">
                            <div><div style="font-size:11px">Total Fees</div><div style="font-size:18px; font-weight:700">${fmtCurrency(balance.total)}</div></div>
                            <div><div style="font-size:11px">Total Paid</div><div style="font-size:18px; font-weight:700; color:var(--success)">${fmtCurrency(balance.paid)}</div></div>
                            <div><div style="font-size:11px">Outstanding</div><div style="font-size:18px; font-weight:700; ${balance.balance > 0 ? 'color:var(--danger)' : ''}">${fmtCurrency(balance.balance)}</div></div>
                        </div>
                    </div>
                    ${termRows}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal(); window.openRecordPaymentForStudent(${studentId})">💰 Record Payment</button>
                </div>
            </div>
        </div>
    `);
}

function exportFeeTermStatus() {
    const students = state.students.filter(s => s.status === 'Active');
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.term_number - b.term_number);
    const data = [];

    for (const student of students) {
        const cls = getClassById(student.class_id);
        const row = {
            'Student Name': `${student.first_name} ${student.last_name}`,
            'Student Code': student.student_code || '',
            'Class': cls?.name || '',
        };

        for (const term of terms) {
            const fees = state.studentFees.filter(f =>
                f.student_id === student.id && f.term_id === term.id && !f.is_waived && !f.is_credit
            );
            const total = fees.reduce((sum, f) => sum + f.amount, 0);
            const paid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
            const balance = total - paid;
            row[`${term.name} Balance`] = balance;
            row[`${term.name} Status`] = balance === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Due');
        }

        const allFees = state.studentFees.filter(f => f.student_id === student.id && !f.is_waived && !f.is_credit);
        const totalAll = allFees.reduce((sum, f) => sum + f.amount, 0);
        const paidAll = allFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        row['Overall Balance'] = totalAll - paidAll;

        data.push(row);
    }

    exportToExcel(data, `Fee_Term_Status_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Fee term status exported', 'success');
}

function printFeeTermStatus() {
    const table = document.querySelector('#fee-term-table table');
    if (!table) {
        showToast('No data to print', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Fee Term Status - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px;text-align:left}
                th{background:#1a3a5c;color:white}
                .badge{display:inline-block;padding:2px 6px;border-radius:10px;font-size:10px}
                .badge-success{background:#d1fae5;color:#065f46}
                .badge-warning{background:#fef3c7;color:#92400e}
                .badge-danger{background:#fee2e2;color:#991b1b}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Fee Term Status Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${table.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}