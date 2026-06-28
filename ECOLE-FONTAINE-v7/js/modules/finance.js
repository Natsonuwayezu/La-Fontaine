// js/modules/finance.js
// Core Finance Module - Fee structure, payments, receipts, waivers

import { state } from '../core/state.js';
import { getAll, insert, update, remove, updateWhere, removeWhere } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, fmtPct, esc, exportToExcel, downloadBlob } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getFullStudentBalance, getStudentById, getClassById, getStudentCreditBalance, updateStudentCredit, recordCreditAsPayment } from './student-fees.js';

export async function renderFeeStructure(container) {
    await ensureStateLoaded();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🏷️ Fee Structure</span>
                ${state.currentUser?.role !== 'teacher' ? `<button class="btn btn-sm btn-primary" onclick="window.openAddFeeCategory()">➕ Add Category</button>` : ''}
            </div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Reset Freq</th>
                                <th>Status</th>
                                ${state.currentUser?.role !== 'teacher' ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${state.feeCategories.length ? state.feeCategories.map(f => `
                                <tr>
                                    <td><strong>${esc(f.name)}</strong></td>
                                    <td>${esc(f.fee_type || '—')}</td>
                                    <td>${esc(f.description || '—')}</td>
                                    <td><span class="badge badge-info">${f.reset_frequency || 'one_time'}</span></td>
                                    <td><span class="badge ${f.is_active !== false ? 'badge-success' : 'badge-neutral'}">${f.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                    ${state.currentUser?.role !== 'teacher' ? `
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.openEditFeeCategory(${f.id})" style="margin-right:4px">✏️ Edit</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteFeeCategory(${f.id},'${esc(f.name)}')">🗑️ Delete</button>
                                        </td>
                                    ` : ''}
                                </tr>
                            `).join('') : `<tr><td colspan="${state.currentUser?.role !== 'teacher' ? '6' : '5'}" style="text-align:center;padding:var(--lg)">No fee categories yet</span>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">💰 Fee Amounts by Class</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <select id="fa-year" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                        ${state.academicYears.map(y => `<option value="${y.id}" ${y.id === state.currentAcadYear?.id ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                    </select>
                    <select id="fa-class-filter" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                        <option value="">All Classes</option>
                        ${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="fa-category-filter" onchange="window.refreshFeeAmounts()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                        <option value="">All Categories</option>
                        ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="window.exportFeeAmounts()">📥 Export</button>
                    ${state.currentUser?.role !== 'teacher' ? `<button class="btn btn-sm btn-primary" onclick="window.openAddFeeAmount()">➕ Add Amount</button>` : ''}
                </div>
            </div>
            <div id="fee-amounts-container" class="dash-card-body" style="padding:0">
                <div style="text-align:center;padding:40px">Loading...</div>
            </div>
        </div>
    `;

    window.refreshFeeAmounts = refreshFeeAmounts;
    window.openAddFeeCategory = openAddFeeCategory;
    window.openAddFeeAmount = openAddFeeAmount;
    window.openEditFeeCategory = openEditFeeCategory;
    window.saveEditFeeCategory = saveEditFeeCategory;
    window.openEditFeeAmount = openEditFeeAmount;
    window.saveEditFeeAmount = saveEditFeeAmount;
    window.deleteFeeCategory = deleteFeeCategory;
    window.exportFeeAmounts = exportFeeAmounts;

    await refreshFeeAmounts();
}

async function refreshFeeAmounts() {
    const yearId = parseInt(document.getElementById('fa-year')?.value);
    if (!yearId) {
        const container = document.getElementById('fee-amounts-container');
        if (container) container.innerHTML = '<div style="text-align:center;padding:40px">Select an academic year</div>';
        return;
    }

    const classFilter = document.getElementById('fa-class-filter')?.value;
    const categoryFilter = document.getElementById('fa-category-filter')?.value;

    let amounts = state.feeAmounts.filter(f => f.academic_year_id === yearId);
    if (classFilter) amounts = amounts.filter(f => f.class_id == classFilter);
    if (categoryFilter) amounts = amounts.filter(f => f.fee_category_id == categoryFilter);

    const container = document.getElementById('fee-amounts-container');
    if (!container) return;

    const isTeacher = state.currentUser?.role === 'teacher';

    if (amounts.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No fee amounts found for the selected filters.</div>`;
        return;
    }

    const groupedByClass = {};
    for (const amount of amounts) {
        const className = getClassById(amount.class_id)?.name || 'Unknown';
        if (!groupedByClass[className]) groupedByClass[className] = [];
        groupedByClass[className].push(amount);
    }

    let html = `<div class="table-wrapper"><table class="data-table" style="width:100%">
        <thead>
            <tr>
                <th style="text-align:left">Class</th>
                <th style="text-align:left">Fee Category</th>
                <th style="text-align:right">Amount (RWF)</th>
                <th style="text-align:center">Reset Freq</th>
                <th style="text-align:center">Students</th>
                <th style="text-align:right">Outstanding</th>
                ${!isTeacher ? '<th style="text-align:center">Actions</th>' : ''}
            </tr>
        </thead>
        <tbody>`;

    for (const [className, classAmounts] of Object.entries(groupedByClass)) {
        for (const amount of classAmounts) {
            const cat = state.feeCategories.find(c => c.id === amount.fee_category_id);
            const studentsInClass = state.students.filter(s => s.class_id === amount.class_id && s.status === 'Active').length;

            const studentFeesForThis = state.studentFees.filter(f =>
                f.fee_category_id === amount.fee_category_id &&
                f.term_id === state.currentTerm?.id &&
                !f.is_waived &&
                !f.manually_deleted
            );
            const studentIdsInClass = state.students.filter(s => s.class_id === amount.class_id).map(s => s.id);
            const outstandingInClass = studentFeesForThis
                .filter(f => studentIdsInClass.includes(f.student_id))
                .reduce((sum, f) => sum + (f.amount - (f.paid_amount || 0)), 0);

            html += `
                <table>
                    <td style="text-align:left"><strong>${esc(className)}</strong></td>
                    <td style="text-align:left">${esc(cat?.name || '—')}</span></td>
                    <td style="text-align:right">${fmtCurrency(amount.amount)}</span></td>
                    <td style="text-align:center"><span class="badge badge-info">${cat?.reset_frequency || 'one_time'}</span></td>
                    <td style="text-align:center">${studentsInClass}</span></td>
                    <td style="text-align:right">${outstandingInClass > 0 ? fmtCurrency(outstandingInClass) : '—'}</span></td>
                    ${!isTeacher ? `
                        <td style="text-align:center">
                            <button class="btn btn-sm btn-outline" onclick="window.openEditFeeAmount(${amount.id}, ${amount.amount})" style="margin-right:4px">✏️ Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="window.removeFeeAmountFromClass(${amount.id}, '${esc(className)}', '${esc(cat?.name)}', ${amount.amount})">🗑️ Remove</button>
                        </span>
                    ` : ''}
                </tr>
            `;
        }
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function openAddFeeCategory() {
    const activeCount = state.students.filter(s => s.status === 'Active').length;

    showModal(`
        <div class="modal-overlay" id="add-fee-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 550px;">
                <div class="modal-header">
                    <h3>➕ Add Fee Category</h3>
                    <button class="modal-close" onclick="closeModal('add-fee-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Category Name *</label><input type="text" id="fc-name" placeholder="e.g. School Fees" class="form-control"></div>
                        <div class="form-group"><label>Fee Type</label><select id="fc-type" class="form-control"><option value="Tuition">Tuition</option><option value="Activity">Activity</option><option value="Transport">Transport</option><option value="Meals">Meals</option><option value="Uniform">Uniform</option><option value="Supplies">Supplies</option><option value="Other">Other</option></select></div>
                        <div class="form-group"><label>Description</label><input type="text" id="fc-desc" placeholder="Optional description" class="form-control"></div>
                        <div class="form-group"><label>Default Amount (RWF)</label><input type="number" id="fc-amount" placeholder="e.g. 150000" min="0" class="form-control"></div>
                        <div class="form-group"><label>Apply To</label><select id="fc-apply" class="form-control"><option value="all">All Active Students (${activeCount} students)</option><option value="none">None yet — add amounts manually</option></select></div>
                        <div class="form-group"><label>Reset Frequency</label><select id="fc-freq" class="form-control"><option value="one_time">One-time</option><option value="termly">Termly</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
                    </div>
                    <div class="alert alert-warning" style="margin-top:12px; font-size:.8rem">⚠️ When saved, this fee will be automatically applied to all active students.</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('add-fee-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitAddFeeCategory()">✅ Save & Apply</button>
                </div>
            </div>
        </div>
    `);
}

async function submitAddFeeCategory() {
    const name = document.getElementById('fc-name')?.value.trim();
    if (!name) { showToast('Category name is required', 'warning'); return; }

    const amount = parseFloat(document.getElementById('fc-amount')?.value) || 0;
    const applyTo = document.getElementById('fc-apply')?.value || 'all';
    const freq = document.getElementById('fc-freq')?.value || 'one_time';
    const feeType = document.getElementById('fc-type')?.value;
    const description = document.getElementById('fc-desc')?.value || null;
    const yearId = state.currentAcadYear?.id || state.academicYears[0]?.id;

    const catData = {
        name, fee_type: feeType, description, amount: amount || null,
        reset_frequency: freq, apply_to: applyTo, is_monthly: freq === 'monthly',
        is_active: true, created_at: new Date().toISOString()
    };

    const newCat = await insert('fee_categories', catData);
    if (!newCat) { showToast('Failed to create fee category', 'error'); return; }

    await refreshTable('fee_categories');

    if (amount > 0 && applyTo === 'all' && newCat.id) {
        const targetStudents = state.students.filter(s => s.status === 'Active');
        const termId = state.currentTerm?.id;
        const dueDate = state.currentTerm?.end_date || null;
        let applied = 0;

        for (const student of targetStudents) {
            try {
                await insert('student_fees', {
                    student_id: student.id, fee_category_id: newCat.id,
                    term_id: termId, academic_year_id: yearId,
                    amount: amount, paid_amount: 0, is_paid: false,
                    is_waived: false, due_date: dueDate,
                    created_at: new Date().toISOString()
                });
                applied++;
            } catch (e) { console.warn('Fee application error:', e); }
        }
        await refreshTable('student_fees');
        showToast(`✅ Fee "${name}" added and applied to ${applied} students`, 'success');
    } else {
        showToast(`✅ Fee category "${name}" added`, 'success');
    }

    closeModal('add-fee-modal');
    renderFeeStructure(document.getElementById('dynamic-content'));
}

function openAddFeeAmount() {
    const yearId = parseInt(document.getElementById('fa-year')?.value) || state.currentAcadYear?.id;

    showModal(`
        <div class="modal-overlay" id="add-fee-amount-modal">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>➕ Set Fee Amount</h3>
                    <button class="modal-close" onclick="closeModal('add-fee-amount-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>Class *</label><select id="fa-class" class="form-control"><option value="">-- Select Class --</option>${state.classes.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Fee Category *</label><select id="fa-cat" class="form-control"><option value="">-- Select Category --</option>${state.feeCategories.filter(f => f.is_active !== false).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Amount (RWF) *</label><input type="number" id="fa-amount" class="form-control" placeholder="e.g. 150000" min="0" step="1000"></div>
                    <input type="hidden" id="fa-year-id" value="${yearId}">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('add-fee-amount-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.submitAddFeeAmount()">Save</button>
                </div>
            </div>
        </div>
    `);
}

async function submitAddFeeAmount() {
    const classId = parseInt(document.getElementById('fa-class')?.value);
    const catId = parseInt(document.getElementById('fa-cat')?.value);
    const amount = parseFloat(document.getElementById('fa-amount')?.value);
    const yearId = parseInt(document.getElementById('fa-year-id')?.value) || state.currentAcadYear?.id;

    if (!classId || !catId || isNaN(amount) || amount <= 0) {
        showToast('All fields required with valid amount', 'warning');
        return;
    }

    const cls = getClassById(classId);
    const category = state.feeCategories.find(c => c.id === catId);

    const existing = state.feeAmounts.find(fa =>
        fa.class_id === classId && fa.fee_category_id === catId && fa.academic_year_id === yearId
    );

    if (existing) {
        await saveEditFeeAmount(existing.id);
        return;
    }

    await insert('fee_amounts', {
        class_id: classId, fee_category_id: catId,
        academic_year_id: yearId, amount: amount,
        created_at: new Date().toISOString()
    });

    const studentsInClass = state.students.filter(s => s.class_id === classId && s.status === 'Active');
    let appliedCount = 0;

    for (const student of studentsInClass) {
        const existingFee = state.studentFees.find(f =>
            f.student_id === student.id && f.fee_category_id === catId &&
            f.term_id === state.currentTerm?.id && !f.is_waived && !f.manually_deleted
        );
        if (existingFee) continue;

        await insert('student_fees', {
            student_id: student.id, fee_category_id: catId,
            term_id: state.currentTerm?.id, academic_year_id: yearId,
            amount: amount, paid_amount: 0, is_paid: false,
            is_waived: false, manually_deleted: false,
            is_template_based: true, due_date: state.currentTerm?.end_date || new Date(),
            created_at: new Date().toISOString()
        });
        appliedCount++;
    }

    await refreshTable('fee_amounts');
    await refreshFeeAmounts();
    await refreshTable('student_fees');
    closeModal();

    showToast(`✅ ${category?.name} (${fmtCurrency(amount)}) added for ${appliedCount} students in ${cls?.name}`, 'success');
    await refreshFeeAmounts();
}

function openEditFeeCategory(categoryId) {
    const cat = state.feeCategories.find(c => c.id === categoryId);
    if (!cat) return;

    showModal(`
        <div class="modal-overlay" id="edit-fee-cat-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header"><h3>✏️ Edit Fee Category</h3><button class="modal-close" onclick="closeModal('edit-fee-cat-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Category Name</label><input type="text" id="edit-fc-name" value="${esc(cat.name)}"></div>
                        <div class="form-group"><label>Type</label><select id="edit-fc-type"><option>Tuition</option><option>Activity</option><option>Transport</option><option>Meals</option><option>Uniform</option><option>Other</option></select></div>
                        <div class="form-group"><label>Description</label><input type="text" id="edit-fc-desc" value="${esc(cat.description || '')}"></div>
                        <div class="form-group"><label>Reset Frequency</label><select id="edit-fc-freq"><option value="one_time" ${cat.reset_frequency === 'one_time' ? 'selected' : ''}>One-time</option><option value="termly" ${cat.reset_frequency === 'termly' ? 'selected' : ''}>Termly</option><option value="monthly" ${cat.reset_frequency === 'monthly' ? 'selected' : ''}>Monthly</option><option value="annual" ${cat.reset_frequency === 'annual' ? 'selected' : ''}>Annual</option></select></div>
                        <div class="form-group"><label>Status</label><select id="edit-fc-status"><option value="active" ${cat.is_active !== false ? 'selected' : ''}>Active</option><option value="inactive" ${cat.is_active === false ? 'selected' : ''}>Inactive</option></select></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-fee-cat-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveEditFeeCategory(${categoryId})">Save</button>
                </div>
            </div>
        </div>
    `);
}

async function saveEditFeeCategory(categoryId) {
    const name = document.getElementById('edit-fc-name')?.value.trim();
    if (!name) { showToast('Category name required', 'warning'); return; }

    await update('fee_categories', categoryId, {
        name: name,
        fee_type: document.getElementById('edit-fc-type')?.value,
        description: document.getElementById('edit-fc-desc')?.value || null,
        reset_frequency: document.getElementById('edit-fc-freq')?.value,
        is_active: document.getElementById('edit-fc-status')?.value === 'active'
    });

    await refreshTable('fee_categories');
    closeModal('edit-fee-cat-modal');
    showToast('✅ Fee category updated', 'success');
    renderFeeStructure(document.getElementById('dynamic-content'));
}

function openEditFeeAmount(amountId, currentAmount) {
    showModal(`
        <div class="modal-overlay" id="edit-fee-amount-modal">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header"><h3>✏️ Edit Fee Amount</h3><button class="modal-close" onclick="closeModal('edit-fee-amount-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Amount (RWF)</label><input type="number" id="edit-fa-amount" value="${currentAmount}" min="0" step="1000"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-fee-amount-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveEditFeeAmount(${amountId})">Save</button>
                </div>
            </div>
        </div>
    `);
}

async function saveEditFeeAmount(amountId) {
    const amount = parseFloat(document.getElementById('edit-fa-amount')?.value);
    if (isNaN(amount) || amount < 0) { showToast('Valid amount required', 'warning'); return; }

    const existingAmount = state.feeAmounts.find(fa => fa.id === amountId);
    if (!existingAmount) { showToast('Fee amount record not found', 'error'); return; }

    const oldAmount = existingAmount.amount;
    const classId = existingAmount.class_id;
    const categoryId = existingAmount.fee_category_id;
    const yearId = existingAmount.academic_year_id;
    const cls = getClassById(classId);
    const category = state.feeCategories.find(c => c.id === categoryId);

    if (!await confirmDialog(
        `⚠️ Update ${category?.name} for ${cls?.name}?\n\nCurrent: ${fmtCurrency(oldAmount)}\nNew: ${fmtCurrency(amount)}\n\nThis will affect ALL active students in this class.`
    )) return;

    await update('fee_amounts', amountId, { amount, updated_at: new Date().toISOString() });

    const studentsInClass = state.students.filter(s => s.class_id === classId && s.status === 'Active');
    let updatedCount = 0;

    for (const student of studentsInClass) {
        const studentFee = state.studentFees.find(f =>
            f.student_id === student.id && f.fee_category_id === categoryId &&
            f.term_id === state.currentTerm?.id && !f.is_waived && !f.manually_deleted && !f.is_credit
        );

        if (studentFee) {
            await update('student_fees', studentFee.id, { amount, updated_at: new Date().toISOString() });
            updatedCount++;
        } else {
            await insert('student_fees', {
                student_id: student.id, fee_category_id: categoryId,
                term_id: state.currentTerm?.id, academic_year_id: yearId,
                amount: amount, paid_amount: 0, is_paid: false,
                is_waived: false, manually_deleted: false,
                is_template_based: true, due_date: state.currentTerm?.end_date || new Date(),
                created_at: new Date().toISOString()
            });
            updatedCount++;
        }
    }

    await update('fee_categories', categoryId, { amount, updated_at: new Date().toISOString() });
    await refreshTable('fee_amounts');
    await refreshTable('fee_categories');
    await refreshTable('student_fees');
    closeModal();

    showToast(`✅ Updated ${updatedCount} students in ${cls?.name}`, 'success');
    renderFeeStructure(document.getElementById('dynamic-content'));
}

async function deleteFeeCategory(categoryId, categoryName) {
    const affectedStudents = state.studentFees.filter(f => f.fee_category_id === categoryId && !f.is_waived);
    const totalAffected = affectedStudents.length;
    const totalAmount = affectedStudents.reduce((sum, f) => sum + (f.amount - (f.paid_amount || 0)), 0);

    if (!await confirmDialog(
        `⚠️ Delete fee category "${categoryName}"?\n\nAffects ${totalAffected} students.\nTotal: ${fmtCurrency(totalAmount)}\n\nPaid amounts become CREDIT.`
    )) return;

    for (const fee of affectedStudents) {
        const paidAmount = fee.paid_amount || 0;
        if (paidAmount > 0) {
            await insert('student_fees', {
                student_id: fee.student_id, fee_category_id: null,
                term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id,
                amount: 0, paid_amount: paidAmount, is_paid: false,
                is_waived: false, is_credit: true, credit_amount: paidAmount,
                notes: `Credit from deleted category: ${categoryName}`,
                created_at: new Date().toISOString()
            });
        }
        await update('student_fees', fee.id, { manually_deleted: true, is_waived: true, updated_at: new Date().toISOString() });
    }

    await update('fee_categories', categoryId, { is_active: false, deleted_at: new Date().toISOString() });
    await refreshTable('fee_categories');
    await refreshTable('student_fees');
    showToast(`✅ Category "${categoryName}" deactivated`, 'success');
    renderFeeStructure(document.getElementById('dynamic-content'));
}

async function exportFeeAmounts() {
    const yearId = parseInt(document.getElementById('fa-year')?.value);
    if (!yearId) { showToast('Please select an academic year first', 'warning'); return; }

    const classFilter = document.getElementById('fa-class-filter')?.value;
    const categoryFilter = document.getElementById('fa-category-filter')?.value;

    let amounts = state.feeAmounts.filter(f => f.academic_year_id === yearId);
    if (classFilter) amounts = amounts.filter(f => f.class_id == classFilter);
    if (categoryFilter) amounts = amounts.filter(f => f.fee_category_id == categoryFilter);

    if (amounts.length === 0) { showToast('No data to export', 'warning'); return; }

    const exportData = amounts.map(amount => {
        const cls = getClassById(amount.class_id);
        const cat = state.feeCategories.find(c => c.id === amount.fee_category_id);
        return {
            'Class': cls?.name || '—',
            'Fee Category': cat?.name || '—',
            'Amount (RWF)': amount.amount,
            'Reset Frequency': cat?.reset_frequency || 'one_time'
        };
    });

    exportToExcel(exportData, `Fee_Amounts_${new Date().toISOString().split('T')[0]}`);
    showToast(`✅ Exported ${exportData.length} fee amount records`, 'success');
}

async function removeFeeAmountFromClass(amountId, className, categoryName, currentAmount) {
    const amount = state.feeAmounts.find(fa => fa.id === amountId);
    if (!amount) return;

    const classId = amount.class_id;
    const categoryId = amount.fee_category_id;

    if (!await confirmDialog(
        `Remove ${categoryName} (${fmtCurrency(currentAmount)}) from ${className}?\n\nAlready paid amounts become CREDIT.`
    )) return;

    const studentsInClass = state.students.filter(s => s.class_id === classId && s.status === 'Active');

    for (const student of studentsInClass) {
        const studentFee = state.studentFees.find(f =>
            f.student_id === student.id && f.fee_category_id === categoryId &&
            f.term_id === state.currentTerm?.id && !f.is_waived && !f.manually_deleted && !f.is_credit
        );

        if (studentFee) {
            const paidAmount = studentFee.paid_amount || 0;
            if (paidAmount > 0) {
                await insert('student_fees', {
                    student_id: student.id, fee_category_id: null,
                    term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id,
                    amount: 0, paid_amount: paidAmount, is_paid: false,
                    is_waived: false, is_credit: true, credit_amount: paidAmount,
                    notes: `Credit from removed fee: ${categoryName}`,
                    created_at: new Date().toISOString()
                });
            }
            await update('student_fees', studentFee.id, { manually_deleted: true, is_waived: true, updated_at: new Date().toISOString() });
        }
    }

    await remove('fee_amounts', amountId);
    await refreshTable('fee_amounts');
    await refreshTable('student_fees');
    showToast(`✅ Removed ${categoryName} from ${className}`, 'success');
    refreshFeeAmounts();
}

export { refreshFeeAmounts as renderFeeAmounts };