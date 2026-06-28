// ============================================================
// STUDENTS MODULE - Student list, filtering, and management
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById, updateState } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher, isAccountant } from '../core/auth.js';
import { fmtCurrency, fmtDate, esc, sortStudentsAlphabetically } from '../core/utils.js';
import { getFullStudentBalance } from '../core/helpers.js';;
import { getAll, update, remove, insert } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast, confirmDialog } from '../ui/modals.js';
import { navigateTo } from '../core/router.js';
import { renderStudentDetails } from './student-profile.js';

// Pagination state
let _studPage = 1;
let _studFilter = '';
let _studClass = '';
let _studStatus = '';

// Render Student List page
export async function renderStudentList(container) {
    if (!container) return;

    await ensureStateLoaded();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👥 Students</span>
                ${isAdmin() ? `<div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="navigateTo('enroll-student')">➕ Enroll Student</button>
                    <button class="btn btn-sm btn-outline" onclick="navigateTo('bulk-import')">📤 Import Excel</button>
                    <button class="btn btn-sm btn-outline" onclick="exportStudentsData()">📥 Export</button>
                </div>` : ''}
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="sf-class" onchange="filterStudents()">
                        <option value="">All Classes</option>
                        ${(state.classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="sf-status" onchange="filterStudents()">
                        <option value="">All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                        <option>Transferred</option>
                        <option>Graduated</option>
                    </select>
                    <input type="text" class="flex-1" id="sf-search" placeholder="🔍 Search name or code..." oninput="filterStudents()">
                    <span class="result-count" id="sf-count"></span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Full Name</th>
                                <th>Class</th>
                                <th>Gender</th>
                                <th>Guardian</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="students-tbody"></tbody>
                    </table>
                </div>
                <div class="pagination" id="students-pagination"></div>
            </div>
        </div>
    `;

    filterStudents();
}

// Filter students function
export function filterStudents() {
    _studPage = 1;
    _studClass = document.getElementById('sf-class')?.value || '';
    _studStatus = document.getElementById('sf-status')?.value || '';
    _studFilter = document.getElementById('sf-search')?.value.toLowerCase() || '';
    renderStudentsTable();
}

// Render students table with pagination
export function renderStudentsTable() {
    let list = [...(state.students || [])];
    if (_studClass) list = list.filter(s => s.class_id == _studClass);
    if (_studStatus) list = list.filter(s => s.status === _studStatus);
    if (_studFilter) list = list.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(_studFilter) || (s.student_code || '').toLowerCase().includes(_studFilter));
    list = sortStudentsAlphabetically(list);

    const countSpan = document.getElementById('sf-count');
    if (countSpan) countSpan.textContent = `${list.length} student${list.length !== 1 ? 's' : ''}`;

    const perPage = 20;
    const total = Math.ceil(list.length / perPage);
    const page = list.slice((_studPage - 1) * perPage, _studPage * perPage);

    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;

    const canEdit = isAdmin();
    const canRecordPayment = isAdmin() || isAccountant();

    tbody.innerHTML = page.length ? page.map(s => {
        const cls = getClassById(s.class_id);
        return `
            <tr>
                <td><code>${esc(s.student_code || '—')}</code></td>
                <td><strong>${esc(s.first_name + ' ' + s.last_name)}</strong></td>
                <td>${esc(cls?.name || '—')}</td>
                <td>${esc(s.gender || '—')}</td>
                <td>${esc(s.guardian_name || '—')}</td>
                <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${esc(s.status)}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewStudentDetail(${s.id})" title="View">👁️</button>
                    ${canEdit ? `
                        <button class="btn btn-sm btn-outline" onclick="openEditStudentModal(${s.id})" title="Edit">✏️</button>
                        <button class="btn btn-sm btn-outline" onclick="openStudentFeeManagement(${s.id}, '${esc(s.first_name + ' ' + s.last_name)}')" title="Manage Fees">💰</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudentPrompt(${s.id},'${esc(s.first_name + ' ' + s.last_name)}')" title="Delete">🗑️</button>
                    ` : ''}
                    ${canRecordPayment ? `<button class="btn btn-sm btn-primary" onclick="localStorage.setItem('elf_pay_student','${s.id}');navigateTo('record-payment')" title="Quick Pay">💸</button>` : ''}
                </td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No students found</td></tr>`;

    // Pagination
    const pag = document.getElementById('students-pagination');
    if (pag) {
        pag.innerHTML = total > 1 ? Array.from({ length: total }, (_, i) => `<div class="page-btn${i + 1 === _studPage ? ' active' : ''}" onclick="_studPage=${i + 1};renderStudentsTable()">${i + 1}</div>`).join('') : '';
    }
}

// View student detail
export function viewStudentDetail(id) {
    localStorage.setItem('elf_view_student', id);
    navigateTo('student-details');
}

// Open edit student modal
export async function openEditStudentModal(id) {
    const s = getStudentById(id);
    if (!s) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3>✏️ Edit Student — ${esc(s.first_name + ' ' + s.last_name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div id="edit-stud-err" class="alert alert-danger" style="display:none"></div>
                    <div class="form-grid">
                        <div class="form-group"><label>First Name *</label><input type="text" id="es-first" value="${esc(s.first_name)}"></div>
                        <div class="form-group"><label>Last Name *</label><input type="text" id="es-last" value="${esc(s.last_name)}"></div>
                        <div class="form-group"><label>Class *</label>
                            <select id="es-class">${(state.classes || []).map(c => `<option value="${c.id}" ${c.id === s.class_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
                        </div>
                        <div class="form-group"><label>Gender</label>
                            <select id="es-gender"><option ${s.gender === 'Male' ? 'selected' : ''}>Male</option><option ${s.gender === 'Female' ? 'selected' : ''}>Female</option></select>
                        </div>
                        <div class="form-group"><label>Date of Birth</label><input type="date" id="es-dob" value="${s.date_of_birth || ''}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="es-status">${['Active', 'Inactive', 'Transferred', 'Graduated'].map(st => `<option ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select>
                        </div>
                        <div class="form-group"><label>Guardian Name</label><input type="text" id="es-guardian" value="${esc(s.guardian_name || '')}"></div>
                        <div class="form-group"><label>Guardian Phone</label><input type="tel" id="es-phone" value="${esc(s.guardian_phone || '')}"></div>
                        <div class="form-group full"><label>Notes</label><textarea id="es-notes">${esc(s.notes || '')}</textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitEditStudent(${id})">💾 Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

// Submit edit student
export async function submitEditStudent(id) {
    const get = el => document.getElementById(el)?.value.trim();

    const oldStudent = getStudentById(id);
    const oldClassId = oldStudent?.class_id;
    const newClassId = parseInt(get('es-class'));

    const data = {
        first_name: get('es-first'),
        last_name: get('es-last'),
        class_id: newClassId,
        gender: get('es-gender'),
        date_of_birth: get('es-dob') || null,
        status: get('es-status'),
        guardian_name: get('es-guardian'),
        guardian_phone: get('es-phone') || null,
        notes: get('es-notes') || null,
        updated_at: new Date().toISOString(),
    };

    const ok = await update('students', id, data);
    if (!ok) { showToast('Update failed', 'error'); return; }

    if (oldClassId != newClassId) {
        await applyFeesToNewStudent(id, newClassId);
        showToast(`⚠️ Student moved to new class. Applicable fees added.`, 'info');
    }

    await refreshTable('students');
    await refreshTable('student_fees');
    closeModal();
    filterStudents();
    showToast('✅ Student updated', 'success');
}

// Delete student (archive)
export async function deleteStudentPrompt(id, name) {
    if (!await confirmDialog(`Archive student "${name}"? They will be marked as deleted but data is preserved.`)) return;
    await update('students', id, { is_deleted: true, status: 'Inactive' });
    await refreshTable('students');
    filterStudents();
    showToast(`Student "${name}" archived`, 'info');
}

// Export students data
export function exportStudentsData() {
    const data = (state.students || []).map(s => ({
        'Code': s.student_code || '',
        'First Name': s.first_name,
        'Last Name': s.last_name,
        'Class': getClassById(s.class_id)?.name || '',
        'Gender': s.gender || '',
        'Status': s.status,
        'Guardian': s.guardian_name || '',
        'Guardian Phone': s.guardian_phone || '',
        'Enrolled': fmtDate(s.enrollment_date),
    }));
    exportToExcel(data, 'Students_Export');
}

// Apply fees to new student
async function applyFeesToNewStudent(studentId, classId) {
    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date();
    const activeCategories = (state.feeCategories || []).filter(c => c.is_active !== false);
    let appliedCount = 0;

    for (const category of activeCategories) {
        let amount = category.amount || 0;
        const classAmount = (state.feeAmounts || []).find(fa => fa.fee_category_id === category.id && fa.class_id == classId && fa.academic_year_id === yearId);
        if (classAmount) amount = classAmount.amount;
        if (amount <= 0) continue;

        const existingFee = (state.studentFees || []).find(f => f.student_id == studentId && f.fee_category_id === category.id && f.term_id === termId && !f.is_waived && !f.manually_deleted);
        if (existingFee) continue;

        await insert('student_fees', {
            student_id: studentId,
            fee_category_id: category.id,
            term_id: termId,
            academic_year_id: yearId,
            amount: amount,
            paid_amount: 0,
            is_paid: false,
            is_waived: false,
            manually_deleted: false,
            is_template_based: true,
            due_date: dueDate,
            created_at: new Date().toISOString()
        });
        appliedCount++;
    }
    return appliedCount;
}

// Open student fee management modal
export async function openStudentFeeManagement(studentId, studentName) {
    const student = getStudentById(studentId);
    if (!student) return;

    const studentFees = (state.studentFees || []).filter(f => f.student_id === studentId);
    const allFeeCategories = (state.feeCategories || []).filter(c => c.is_active !== false);
    const balance = getFullStudentBalance(studentId);

    showModal(`
        <div class="modal-overlay" id="student-fee-modal">
            <div class="modal modal-lg" onclick="event.stopPropagation()" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>💰 Fee Management: ${esc(studentName)}</h3>
                    <button class="modal-close" onclick="closeModal('student-fee-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px; margin-bottom:16px">
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; text-align:center">
                            <div><div style="font-size:11px; color:var(--text-muted)">Total Fees</div><div style="font-size:18px; font-weight:700">${fmtCurrency(balance.total)}</div></div>
                            <div><div style="font-size:11px; color:var(--text-muted)">Paid</div><div style="font-size:18px; font-weight:700; color:var(--success)">${fmtCurrency(balance.paid)}</div></div>
                            <div><div style="font-size:11px; color:var(--text-muted)">Balance</div><div style="font-size:18px; font-weight:700; ${balance.balance > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">${fmtCurrency(balance.balance)}</div></div>
                        </div>
                        ${balance.credit > 0 ? `<div style="text-align:center; margin-top:8px; padding:6px; background:var(--success-bg); border-radius:6px; color:var(--success); font-size:12px">⭐ Credit Available: ${fmtCurrency(balance.credit)}</div>` : ''}
                    </div>
                    <h4 style="margin-bottom:8px">📋 Current Fees</h4>
                    <div class="table-wrapper" style="margin-bottom:16px">
                        <table class="data-table" style="font-size:13px">
                            <thead><tr><th>Fee Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Remaining</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody id="student-fee-list">
                                ${studentFees.filter(f => !f.is_credit).map(fee => {
        const cat = (state.feeCategories || []).find(c => c.id === fee.fee_category_id);
        const remaining = fee.amount - (fee.paid_amount || 0);
        const isWaived = fee.is_waived;
        return `
                                        <tr>
                                            <td>${esc(cat?.name || 'Unknown Fee')}${isWaived ? ' <span class="badge badge-success">Waived</span>' : ''}</td>
                                            <td style="text-align:right">${fmtCurrency(fee.amount)}</td>
                                            <td style="text-align:right">${fmtCurrency(fee.paid_amount || 0)}</td>
                                            <td style="text-align:right; ${remaining > 0 ? 'color:var(--danger); font-weight:600' : ''}">${fmtCurrency(remaining)}</td>
                                            <td style="text-align:center">${isWaived ? '<span class="badge badge-success">✅ Waived</span>' : (remaining <= 0 ? '<span class="badge badge-success">✅ Paid</span>' : '<span class="badge badge-warning">🟡 Due</span>')}</td>
                                            <td style="text-align:center">
                                                ${!isWaived ? `<button class="btn btn-sm btn-outline" onclick="waiveStudentFee(${fee.id}, ${studentId}, ${fee.fee_category_id}, ${remaining}, '${esc(cat?.name)}')" style="margin-right:4px">🎁 Waive</button>` : ''}
                                                <button class="btn btn-sm btn-danger" onclick="removeStudentFee(${fee.id}, ${studentId}, ${fee.fee_category_id}, ${remaining}, '${esc(cat?.name)}')">🗑️ Remove</button>
                                            </td>
                                        </tr>
                                    `;
    }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px">No fees recorded for this student</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <h4 style="margin-bottom:8px">➕ Add New Fee (Individual)</h4>
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group"><label>Fee Category</label><select id="student-fee-category">${allFeeCategories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}</select></div>
                        <div class="form-group"><label>Amount (RWF)</label><input type="number" id="student-fee-amount" placeholder="Enter amount" min="0"></div>
                        <div class="form-group" style="align-self:end"><button class="btn btn-primary" onclick="addIndividualStudentFee(${studentId})">➕ Add Fee</button></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('student-fee-modal')">Close</button>
                    <button class="btn btn-success" onclick="location.reload()">🔄 Refresh</button>
                </div>
            </div>
        </div>
    `);
}

// Helper function for Excel export
function exportToExcel(data, filename) {
    if (!data?.length) { showToast('No data to export', 'warning'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.students.length) await refreshTable('students');
}

// Export functions to window
window.filterStudents = filterStudents;
window.renderStudentsTable = renderStudentsTable;
window.viewStudentDetail = viewStudentDetail;
window.openEditStudentModal = openEditStudentModal;
window.submitEditStudent = submitEditStudent;
window.deleteStudentPrompt = deleteStudentPrompt;
window.exportStudentsData = exportStudentsData;
window.openStudentFeeManagement = openStudentFeeManagement;