// ============================================================
// STUDENT REGISTRATION MODULE - Enroll new students
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin } from '../core/auth.js';
import { fmtCurrency, esc } from '../core/utils.js';
import { getFullStudentBalance } from '../core/helpers.js';;
import { insert, update, getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast, confirmDialog } from '../ui/modals.js';
import { navigateTo } from '../core/router.js';
import { logActivity } from '../core/helpers.js';

// Render Enroll Student page
export async function renderEnrollStudent(container) {
    if (!isAdmin()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    await ensureStateLoaded();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">➕ Enroll New Student</span>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('student-list')">← Back</button>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info">Fill in the student information below. Fields marked * are required.</div>
                <div id="enroll-error" class="alert alert-danger" style="display:none"></div>
                
                <div class="form-grid">
                    <div class="form-group"><label>First Name *</label><input type="text" id="en-first" placeholder="First name"></div>
                    <div class="form-group"><label>Last Name *</label><input type="text" id="en-last" placeholder="Last name"></div>
                    <div class="form-group"><label>Class *</label>
                        <select id="en-class" onchange="previewFeesWithCheckboxes()">
                            <option value="">— Select class —</option>
                            ${(state.classes || []).filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Gender</label>
                        <select id="en-gender"><option value="">— Select —</option><option>Male</option><option>Female</option></select>
                    </div>
                    <div class="form-group"><label>Date of Birth</label><input type="date" id="en-dob"></div>
                    <div class="form-group"><label>Nationality</label><input type="text" id="en-nationality" placeholder="e.g. Rwandan"></div>
                    <div class="form-group"><label>Guardian Name *</label><input type="text" id="en-guardian" placeholder="Parent/guardian full name"></div>
                    <div class="form-group"><label>Guardian Phone</label><input type="tel" id="en-phone" placeholder="+250 7xx xxx xxx"></div>
                    <div class="form-group"><label>Guardian Email</label><input type="email" id="en-email" placeholder="guardian@email.com"></div>
                    <div class="form-group"><label>Enrollment Date</label><input type="date" id="en-date" value="${new Date().toISOString().split('T')[0]}"></div>
                    <div class="form-group full"><label>Notes</label><textarea id="en-notes" rows="2" placeholder="Optional notes..."></textarea></div>
                </div>
                
                <!-- Fee Checkbox Selection Section -->
                <div id="fee-selection-section" style="display: none; margin-top: 20px; border: 1px solid var(--border-medium); border-radius: var(--r-lg); overflow: hidden;">
                    <div style="background: var(--bg-tertiary); padding: 12px 16px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;">
                        <strong>💰 Select Fees to Apply on Enrollment</strong>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: .82rem; cursor: pointer;">
                            <input type="checkbox" id="enroll-select-all" onchange="toggleAllEnrollmentFees()" checked> Select All
                        </label>
                    </div>
                    <div id="fee-checkbox-list" style="padding: 0 16px;"></div>
                    <div id="fee-selection-total" style="padding: 10px 16px; font-weight: 700; background: var(--bg-tertiary); border-top: 1px solid var(--border-light);">Total: 0 RWF</div>
                    <div style="padding: 8px 16px 12px; font-size: .78rem; color: var(--text-muted);">✅ Only checked fees will be applied. Uncheck any you don't want to apply now.</div>
                </div>
                
                <div class="btn-group" style="margin-top: var(--lg);">
                    <button class="btn btn-success" onclick="submitEnrollWithFeeSelection()">✅ Enroll Student</button>
                    <button class="btn btn-outline" onclick="navigateTo('student-list')">Cancel</button>
                </div>
            </div>
        </div>
    `;
}

// Preview fees with checkboxes when class is selected
window.previewFeesWithCheckboxes = function () {
    const classId = document.getElementById('en-class')?.value;
    const section = document.getElementById('fee-selection-section');
    const listEl = document.getElementById('fee-checkbox-list');
    const totalEl = document.getElementById('fee-selection-total');

    if (!classId) {
        section.style.display = 'none';
        return;
    }

    const activeCategories = (state.feeCategories || []).filter(c => c.is_active !== false);
    const fees = [];

    for (const cat of activeCategories) {
        let amount = cat.amount || 0;
        const override = (state.feeAmounts || []).find(fa => fa.fee_category_id === cat.id && fa.class_id == classId && fa.academic_year_id === state.currentAcadYear?.id);
        if (override) amount = override.amount;
        if (amount > 0) {
            fees.push({ id: cat.id, name: cat.name, amount });
        }
    }

    if (fees.length === 0) {
        section.style.display = 'none';
        return;
    }

    listEl.innerHTML = fees.map(f => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
            <input type="checkbox" class="enroll-fee-checkbox" value="${f.id}" data-amount="${f.amount}" checked onchange="updateEnrollmentFeeTotal()" style="width: 16px; height: 16px; flex-shrink: 0;">
            <span style="flex: 1;">${esc(f.name)}</span>
            <span style="font-weight: 600; color: var(--role-secondary);">${fmtCurrency(f.amount)}</span>
        </div>
    `).join('');

    document.getElementById('enroll-select-all').checked = true;
    updateEnrollmentFeeTotal();
    section.style.display = 'block';
};

// Toggle all enrollment fees
window.toggleAllEnrollmentFees = function () {
    const selectAll = document.getElementById('enroll-select-all');
    const checkboxes = document.querySelectorAll('.enroll-fee-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateEnrollmentFeeTotal();
};

// Update enrollment fee total
window.updateEnrollmentFeeTotal = function () {
    const checked = [...document.querySelectorAll('.enroll-fee-checkbox:checked')];
    const total = checked.reduce((s, cb) => s + parseFloat(cb.dataset.amount || 0), 0);
    const totalEl = document.getElementById('fee-selection-total');
    if (totalEl) {
        totalEl.innerHTML = `<div style="display: flex; justify-content: space-between;"><span>TOTAL TO APPLY (${checked.length} fee${checked.length !== 1 ? 's' : ''})</span><span style="color: var(--role-secondary);">${fmtCurrency(total)}</span></div>`;
    }
};

// Submit enrollment with fee selection
window.submitEnrollWithFeeSelection = async function () {
    const get = id => document.getElementById(id)?.value.trim();
    const first = get('en-first');
    const last = get('en-last');
    const classId = get('en-class');
    const guardian = get('en-guardian');
    const errDiv = document.getElementById('enroll-error');

    const showErr = m => { errDiv.textContent = m; errDiv.style.display = 'block'; errDiv.scrollIntoView({ behavior: 'smooth' }); };
    errDiv.style.display = 'none';

    if (!first || !last) return showErr('First name and last name are required');
    if (!classId) return showErr('Please select a class');
    if (!guardian) return showErr('Guardian name is required');

    const cls = getClassById(classId);
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = (cls?.name || 'ST').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'STD';

    // Generate unique student code
    const existingCount = (state.students || []).filter(s => s.class_id == classId).length;
    let seq = String(existingCount + 1).padStart(3, '0');
    let code = `${prefix}${year}${seq}`;
    let counter = 1;
    while ((state.students || []).some(s => s.student_code === code)) {
        seq = String(existingCount + 1 + counter).padStart(3, '0');
        code = `${prefix}${year}${seq}`;
        counter++;
        if (counter > 100) break;
    }

    const studentData = {
        student_code: code,
        first_name: first,
        last_name: last,
        class_id: parseInt(classId),
        gender: get('en-gender') || null,
        date_of_birth: get('en-dob') || null,
        nationality: get('en-nationality') || null,
        guardian_name: guardian,
        guardian_phone: get('en-phone') || null,
        guardian_email: get('en-email') || null,
        enrollment_date: get('en-date') || new Date().toISOString().split('T')[0],
        notes: get('en-notes') || null,
        status: 'Active',
        is_deleted: false,
        created_at: new Date().toISOString()
    };

    let result;
    try {
        result = await insert('students', studentData);
    } catch (error) {
        if (error.message && error.message.includes('duplicate key')) {
            const finalCode = `${prefix}${year}${String(Date.now()).slice(-4)}`;
            studentData.student_code = finalCode;
            result = await insert('students', studentData);
        } else {
            showErr('Failed to enroll student: ' + error.message);
            return;
        }
    }

    if (!result) { showErr('Failed to enroll student. Please try again.'); return; }

    const newStudentId = result.id;

    // Apply only selected fees
    const selectedCategories = [...document.querySelectorAll('.enroll-fee-checkbox:checked')].map(cb => parseInt(cb.value));
    if (selectedCategories.length > 0) {
        await applySelectedFeesToNewStudent(newStudentId, parseInt(classId), selectedCategories);
    }

    await refreshTable('students');
    await refreshTable('student_fees');
    await logActivity(getCurrentUser()?.id, getCurrentUser()?.role, `Enrolled student: ${first} ${last} with selected fees`, 'students', result.id);

    showToast(`✅ ${first} ${last} enrolled successfully (${code})`, 'success');
    navigateTo('student-list');
};

// Apply selected fees to new student
async function applySelectedFeesToNewStudent(studentId, classId, selectedCategoryIds) {
    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date().toISOString().split('T')[0];
    let appliedCount = 0;

    for (const categoryId of selectedCategoryIds) {
        const category = (state.feeCategories || []).find(c => c.id === categoryId);
        if (!category) continue;

        let amount = category.amount || 0;
        const classAmount = (state.feeAmounts || []).find(fa => fa.fee_category_id === categoryId && fa.class_id == classId && fa.academic_year_id === yearId);
        if (classAmount) amount = classAmount.amount;
        if (amount <= 0) continue;

        const existing = (state.studentFees || []).find(f => f.student_id == studentId && f.fee_category_id === categoryId && f.term_id === termId && !f.is_waived && !f.manually_deleted);
        if (existing) continue;

        await insert('student_fees', {
            student_id: studentId, fee_category_id: categoryId, term_id: termId,
            academic_year_id: yearId, amount, paid_amount: 0, is_paid: false,
            is_waived: false, manually_deleted: false, due_date: dueDate,
            created_at: new Date().toISOString()
        });
        appliedCount++;
    }
    return appliedCount;
}

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.feeCategories.length) await refreshTable('fee_categories');
    if (!state.feeAmounts.length) await refreshTable('fee_amounts');
}