// js/modules/carry-forward.js
// Carry Forward Module - Transfer unpaid fees and balances to next academic year

import { state } from '../core/state.js';
import { getAll, insert, update } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderCarryForward(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const currentYear = state.currentAcadYear;
    const nextYear = state.academicYears.find(y => !y.is_active && y.id !== currentYear?.id) ||
        state.academicYears[state.academicYears.length - 1];
    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🔄 Carry Forward Unpaid Fees</span>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-warning">
                    <strong>⚠️ Important:</strong> This will transfer unpaid fees from the current academic year 
                    to the next academic year. Paid fees will NOT be carried forward.
                </div>
                
                <div class="form-grid" style="margin-bottom:20px">
                    <div class="form-group">
                        <label>From Academic Year</label>
                        <input type="text" readonly value="${esc(currentYear?.name || 'Current Year')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>To Academic Year</label>
                        <select id="carry-target-year" class="form-control">
                            <option value="">-- Select Target Year --</option>
                            ${state.academicYears.filter(y => y.id !== currentYear?.id).map(y => `<option value="${y.id}">${esc(y.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Filter by Class</label>
                        <select id="carry-class-filter" class="form-control">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Minimum Balance to Carry</label>
                        <input type="number" id="carry-min-balance" value="0" min="0" step="1000" class="form-control">
                    </div>
                </div>
                
                <div class="btn-group" style="margin-bottom:20px">
                    <button class="btn btn-outline" onclick="window.previewCarryForward()">👁️ Preview</button>
                    <button class="btn btn-warning" onclick="window.executeCarryForward()">🔄 Execute Carry Forward</button>
                    <button class="btn btn-outline" onclick="window.exportCarryPreview()">📥 Export Preview</button>
                </div>
                
                <div id="carry-preview-container" style="display:none">
                    <h4>📋 Preview: Fees to be Carried Forward</h4>
                    <div id="carry-preview-table" class="table-wrapper">
                        <div class="loading-container"><div class="spinner"></div><p>Loading preview...</p></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📜 Carry Forward History</span>
                <button class="btn btn-sm btn-outline" onclick="window.loadCarryHistory()">🔄 Refresh</button>
            </div>
            <div class="dash-card-body">
                <div id="carry-history-container" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading history...</p></div>
                </div>
            </div>
        </div>
    `;

    window.previewCarryForward = previewCarryForward;
    window.executeCarryForward = executeCarryForward;
    window.exportCarryPreview = exportCarryPreview;
    window.loadCarryHistory = loadCarryHistory;

    await loadCarryHistory();
}

async function getCarryForwardData() {
    const targetYearId = document.getElementById('carry-target-year')?.value;
    const classFilter = document.getElementById('carry-class-filter')?.value;
    const minBalance = parseFloat(document.getElementById('carry-min-balance')?.value) || 0;

    if (!targetYearId) {
        showToast('Please select a target academic year', 'warning');
        return null;
    }

    const currentTermId = state.currentTerm?.id;
    let students = state.students.filter(s => s.status === 'Active');
    if (classFilter) students = students.filter(s => s.class_id == classFilter);

    const carryData = [];
    let totalCarryAmount = 0;
    let totalStudents = 0;

    for (const student of students) {
        // Get unpaid fees for current term
        const unpaidFees = state.studentFees.filter(f =>
            f.student_id === student.id &&
            f.term_id === currentTermId &&
            !f.is_paid &&
            !f.is_waived &&
            !f.is_credit &&
            !f.carried_over
        );

        const totalUnpaid = unpaidFees.reduce((sum, f) => sum + (f.amount - (f.paid_amount || 0)), 0);

        if (totalUnpaid >= minBalance) {
            carryData.push({
                student: student,
                cls: getClassById(student.class_id),
                unpaidFees: unpaidFees,
                totalUnpaid: totalUnpaid
            });
            totalCarryAmount += totalUnpaid;
            totalStudents++;
        }
    }

    return { carryData, totalCarryAmount, totalStudents, targetYearId };
}

async function previewCarryForward() {
    const container = document.getElementById('carry-preview-container');
    const tableContainer = document.getElementById('carry-preview-table');

    if (!container || !tableContainer) return;

    const data = await getCarryForwardData();
    if (!data) return;

    const { carryData, totalCarryAmount, totalStudents, targetYearId } = data;
    const targetYear = state.academicYears.find(y => y.id == targetYearId);

    if (carryData.length === 0) {
        tableContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No unpaid fees to carry forward</div>';
        container.style.display = 'block';
        return;
    }

    tableContainer.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Unpaid Amount</th>
                    <th>Fees to Carry</th>
                </tr>
            </thead>
            <tbody>
                ${carryData.map(item => `
                    <tr>
                        <td><strong>${esc(item.student.first_name)} ${esc(item.student.last_name)}</strong></span>
                        <td>${esc(item.cls?.name || '—')}</span>
                        <td>${fmtCurrency(item.totalUnpaid)}</span>
                        <td>${item.unpaidFees.length} fee${item.unpaidFees.length !== 1 ? 's' : ''}</span>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="background:var(--bg-tertiary);font-weight:700">
                    <td colspan="2" style="text-align:right">TOTALS:</td>
                    <td>${fmtCurrency(totalCarryAmount)}</span>
                    <td>${totalStudents} student${totalStudents !== 1 ? 's' : ''}</span>
                </tr>
            </tfoot>
        </table>
    `;

    container.style.display = 'block';
}

async function executeCarryForward() {
    const data = await getCarryForwardData();
    if (!data) return;

    const { carryData, totalCarryAmount, totalStudents, targetYearId } = data;

    if (carryData.length === 0) {
        showToast('No unpaid fees to carry forward', 'info');
        return;
    }

    if (!await confirmDialog(
        `Carry forward ${fmtCurrency(totalCarryAmount)} for ${totalStudents} students to the next academic year?\n\n` +
        `This action cannot be undone.`
    )) return;

    let carriedCount = 0;
    let carriedFeesCount = 0;

    for (const item of carryData) {
        for (const fee of item.unpaidFees) {
            const remainingAmount = fee.amount - (fee.paid_amount || 0);
            if (remainingAmount > 0) {
                // Mark original fee as carried
                await update('student_fees', fee.id, { carried_over: true, updated_at: new Date().toISOString() });

                // Create new fee in target year
                await insert('student_fees', {
                    student_id: fee.student_id,
                    fee_category_id: fee.fee_category_id,
                    term_id: null, // Will be set when term starts
                    academic_year_id: parseInt(targetYearId),
                    amount: remainingAmount,
                    paid_amount: 0,
                    is_paid: false,
                    is_waived: false,
                    is_credit: false,
                    carried_over: true,
                    notes: `Carried over from previous academic year`,
                    original_fee_id: fee.id,
                    created_at: new Date().toISOString()
                });
                carriedFeesCount++;
            }
        }
        carriedCount++;
    }

    // Log the carry forward action
    await insert('activity_logs', {
        user_id: state.currentUser?.id,
        user_role: state.currentUser?.role,
        action: `Carried forward ${fmtCurrency(totalCarryAmount)} for ${carriedCount} students`,
        entity_type: 'carry_forward',
        details: JSON.stringify({ totalAmount: totalCarryAmount, studentCount: carriedCount, feeCount: carriedFeesCount }),
        created_at: new Date().toISOString()
    });

    await refreshTable('student_fees');
    showToast(`✅ Carried forward ${fmtCurrency(totalCarryAmount)} for ${carriedCount} students (${carriedFeesCount} fees)`, 'success');

    await previewCarryForward();
    await loadCarryHistory();
}

function exportCarryPreview() {
    const previewData = [];
    const rows = document.querySelectorAll('#carry-preview-table tbody tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            previewData.push({
                'Student': cells[0]?.textContent?.trim() || '',
                'Class': cells[1]?.textContent?.trim() || '',
                'Unpaid Amount': cells[2]?.textContent?.trim() || '',
                'Fees to Carry': cells[3]?.textContent?.trim() || ''
            });
        }
    });

    if (previewData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    exportToExcel(previewData, `Carry_Forward_Preview_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Preview exported', 'success');
}

async function loadCarryHistory() {
    const container = document.getElementById('carry-history-container');
    if (!container) return;

    try {
        const logs = await getAll('activity_logs', { entity_type: 'carry_forward', order: 'created_at.desc', limit: 50 });

        if (logs.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No carry forward history found</div>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>Date</th><th>Action</th><th>User</th><th>Details</th></tr>
                </thead>
                <tbody>
                    ${logs.map(log => {
            let details = '';
            try {
                const parsed = JSON.parse(log.details || '{}');
                details = `${fmtCurrency(parsed.totalAmount)} for ${parsed.studentCount} students`;
            } catch (e) {
                details = log.details || '—';
            }
            return `
                            <tr>
                                <td>${fmtDate(log.created_at)}</span>
                                <td>${esc(log.action)}</span>
                                <td>${esc(log.user_role || 'System')}</span>
                                <td>${details}</span>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Unable to load history</div>';
    }
}