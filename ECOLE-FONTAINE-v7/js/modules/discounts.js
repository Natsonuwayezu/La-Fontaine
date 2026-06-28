// js/modules/discounts.js
// Discounts Module - Manage family discounts, sibling discounts, and fee reductions

import { state } from '../core/state.js';
import { getAll, insert, update, remove, updateSchoolSetting } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById, getFullStudentBalance } from './student-fees.js';

export async function renderDiscounts(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role === 'teacher') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage discounts.</div>';
        return;
    }

    const families = state.families || [];
    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🎁 Discounts & Family Discounts</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddDiscountModal()">➕ Add Discount Rule</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportDiscounts()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showDiscountTab('family', event)">🏠 Family Discounts</button>
                    <button class="tab-btn" onclick="window.showDiscountTab('sibling', event)">👨‍👩‍👧 Sibling Discounts</button>
                    <button class="tab-btn" onclick="window.showDiscountTab('bulk', event)">📦 Bulk Discount Rules</button>
                </div>
                
                <div id="family-discounts-tab">
                    <div class="alert alert-info">Family discounts apply to all siblings in the same family group.</div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Family Code</th>
                                    <th>Guardian Name</th>
                                    <th>Students</th>
                                    <th>Discount Amount</th>
                                    <th>Discount Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${families.length ? families.map(f => {
        const studentCount = state.students.filter(s => s.family_id === f.id && s.status === 'Active').length;
        return `
                                        <tr>
                                            <td><code>${esc(f.family_code)}</code></td>
                                            <td><strong>${esc(f.guardian_name || '—')}</strong></td>
                                            <td style="text-align:center">${studentCount}</span>
                                            <td>${fmtCurrency(f.discount_amount || 0)}</span>
                                            <td><span class="badge badge-info">${f.discount_type || 'Fixed'}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-outline" onclick="window.editFamilyDiscount(${f.id})">✏️ Edit</button>
                                                <button class="btn btn-sm btn-primary" onclick="window.applyFamilyDiscount(${f.id})">💰 Apply</button>
                                             </span>
                                        </tr>
                                    `;
    }).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No families found</span>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div id="sibling-discounts-tab" style="display:none">
                    <div class="alert alert-info">Sibling discount rules automatically apply when multiple students share the same guardian.</div>
                    <div class="form-grid" style="margin-bottom:20px">
                        <div class="form-group">
                            <label>Enable Sibling Discount</label>
                            <select id="sibling-discount-enabled" class="form-control" onchange="window.saveSiblingDiscountSetting()">
                                <option value="true" ${state.schoolSettings.sibling_discount_enabled === 'true' ? 'selected' : ''}>Enabled</option>
                                <option value="false" ${state.schoolSettings.sibling_discount_enabled !== 'true' ? 'selected' : ''}>Disabled</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discount per Additional Sibling</label>
                            <div style="display:flex; gap:8px">
                                <input type="number" id="sibling-discount-amount" value="${state.schoolSettings.sibling_discount_amount || 5000}" class="form-control" style="width:150px">
                                <select id="sibling-discount-type" class="form-control" style="width:100px">
                                    <option value="fixed" ${state.schoolSettings.sibling_discount_type === 'fixed' ? 'selected' : ''}>RWF</option>
                                    <option value="percentage" ${state.schoolSettings.sibling_discount_type === 'percentage' ? 'selected' : ''}>%</option>
                                </select>
                                <button class="btn btn-primary" onclick="window.saveSiblingDiscountSetting()">💾 Save</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="table-wrapper">
                        <h4>Detected Sibling Groups</h4>
                        <div id="sibling-groups-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading sibling groups...</p></div>
                        </div>
                    </div>
                </div>
                
                <div id="bulk-discounts-tab" style="display:none">
                    <div class="alert alert-info">Apply bulk discounts to entire classes or grade levels.</div>
                    <div class="form-grid" style="margin-bottom:20px">
                        <div class="form-group">
                            <label>Select Class</label>
                            <select id="bulk-discount-class" class="form-control">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discount Type</label>
                            <select id="bulk-discount-type" class="form-control">
                                <option value="fixed">Fixed Amount (RWF)</option>
                                <option value="percentage">Percentage (%)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discount Value</label>
                            <input type="number" id="bulk-discount-value" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Apply to Fee Category</label>
                            <select id="bulk-discount-category" class="form-control">
                                <option value="">All Categories</option>
                                ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-warning" onclick="window.previewBulkDiscount()">👁️ Preview</button>
                        <button class="btn btn-primary" onclick="window.applyBulkDiscount()">🎁 Apply Discount</button>
                    </div>
                    <div id="bulk-discount-preview" style="margin-top:16px;display:none"></div>
                </div>
            </div>
        </div>
    `;

    window.showDiscountTab = showDiscountTab;
    window.editFamilyDiscount = editFamilyDiscount;
    window.applyFamilyDiscount = applyFamilyDiscount;
    window.saveSiblingDiscountSetting = saveSiblingDiscountSetting;
    window.previewBulkDiscount = previewBulkDiscount;
    window.applyBulkDiscount = applyBulkDiscount;
    window.openAddDiscountModal = openAddDiscountModal;
    window.exportDiscounts = exportDiscounts;
    window.updateFamilyDiscount = updateFamilyDiscount;
    window.applySiblingDiscountToGroup = applySiblingDiscountToGroup;
    window.createFamilyFromSiblings = createFamilyFromSiblings;

    await loadSiblingGroups();
}

function showDiscountTab(tabName, event) {
    const tabs = ['family', 'sibling', 'bulk'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-discounts-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

async function editFamilyDiscount(familyId) {
    const family = state.families.find(f => f.id === familyId);
    if (!family) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>✏️ Edit Family Discount - ${esc(family.family_code)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Family Code</label>
                            <input type="text" readonly value="${esc(family.family_code)}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Discount Type</label>
                            <select id="edit-discount-type" class="form-control">
                                <option value="fixed" ${family.discount_type === 'fixed' ? 'selected' : ''}>Fixed Amount (RWF)</option>
                                <option value="percentage" ${family.discount_type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discount Amount</label>
                            <input type="number" id="edit-discount-amount" value="${family.discount_amount || 0}" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group full">
                            <label>Apply to Fee Category (Optional)</label>
                            <select id="edit-discount-category" class="form-control">
                                <option value="">All Fee Categories</option>
                                ${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}" ${family.discount_category_id == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Notes</label>
                            <textarea id="edit-discount-notes" class="form-control" rows="2">${esc(family.discount_notes || '')}</textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateFamilyDiscount(${familyId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function updateFamilyDiscount(familyId) {
    const discountType = document.getElementById('edit-discount-type')?.value;
    const discountAmount = parseFloat(document.getElementById('edit-discount-amount')?.value) || 0;
    const discountCategory = document.getElementById('edit-discount-category')?.value;
    const notes = document.getElementById('edit-discount-notes')?.value;

    await update('families', familyId, {
        discount_type: discountType,
        discount_amount: discountAmount,
        discount_category_id: discountCategory || null,
        discount_notes: notes,
        updated_at: new Date().toISOString()
    });

    await refreshTable('families');
    closeModal();
    showToast('✅ Family discount updated', 'success');
    renderDiscounts(document.getElementById('dynamic-content'));
}

async function applyFamilyDiscount(familyId) {
    const family = state.families.find(f => f.id === familyId);
    if (!family || !family.discount_amount) {
        showToast('No discount configured for this family', 'warning');
        return;
    }

    const students = state.students.filter(s => s.family_id === familyId && s.status === 'Active');
    if (students.length === 0) {
        showToast('No active students in this family', 'warning');
        return;
    }

    if (!await confirmDialog(`Apply ${fmtCurrency(family.discount_amount)} discount to ${students.length} student(s) in family ${family.family_code}?`)) return;

    let applied = 0;
    for (const student of students) {
        // Create a discount fee record
        await insert('student_fees', {
            student_id: student.id,
            fee_category_id: family.discount_category_id || null,
            term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id,
            amount: -family.discount_amount,
            paid_amount: family.discount_amount,
            is_paid: true,
            is_waived: false,
            is_discount: true,
            discount_reason: `Family discount - ${family.family_code}`,
            notes: family.discount_notes || '',
            created_at: new Date().toISOString()
        });
        applied++;
    }

    await refreshTable('student_fees');
    showToast(`✅ Applied discount to ${applied} student(s)`, 'success');
}

async function saveSiblingDiscountSetting() {
    const enabled = document.getElementById('sibling-discount-enabled')?.value === 'true';
    const amount = parseFloat(document.getElementById('sibling-discount-amount')?.value) || 0;
    const type = document.getElementById('sibling-discount-type')?.value;

    await updateSchoolSetting('sibling_discount_enabled', String(enabled));
    await updateSchoolSetting('sibling_discount_amount', String(amount));
    await updateSchoolSetting('sibling_discount_type', type);

    showToast('✅ Sibling discount settings saved', 'success');
    await loadSiblingGroups();
}

async function loadSiblingGroups() {
    const container = document.getElementById('sibling-groups-container');
    if (!container) return;

    // Group students by guardian name/phone
    const groups = new Map();
    const activeStudents = state.students.filter(s => s.status === 'Active');

    for (const student of activeStudents) {
        const key = (student.guardian_name || '').toLowerCase().trim() + '|' + (student.guardian_phone || '').trim();
        if (key !== '|') {
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(student);
        }
    }

    const siblingGroups = Array.from(groups.values()).filter(g => g.length > 1);
    const discountEnabled = state.schoolSettings.sibling_discount_enabled === 'true';
    const discountAmount = parseFloat(state.schoolSettings.sibling_discount_amount || 0);
    const discountType = state.schoolSettings.sibling_discount_type || 'fixed';

    if (siblingGroups.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No sibling groups detected</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Guardian Name</th>
                    <th>Phone</th>
                    <th>Siblings</th>
                    <th>Potential Discount</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${siblingGroups.map(group => {
        const guardianName = group[0].guardian_name || 'Unknown';
        const guardianPhone = group[0].guardian_phone || '—';
        const discount = discountType === 'percentage' ? `${discountAmount}%` : fmtCurrency(discountAmount);

        return `
                        <tr>
                            <td><strong>${esc(guardianName)}</strong></td>
                            <td>${esc(guardianPhone)}</span>
                            <td>
                                ${group.map(s => `<div>${esc(s.first_name)} ${esc(s.last_name)} (${esc(getClassById(s.class_id)?.name || '?')})</div>`).join('')}
                             </span>
                            <td>${discountEnabled ? discount : 'Disabled'}</span>
                            <td>
                                ${discountEnabled ? `<button class="btn btn-sm btn-primary" onclick="window.applySiblingDiscountToGroup('${group.map(s => s.id).join(',')}')">🎁 Apply Discount</button>` : ''}
                                <button class="btn btn-sm btn-outline" onclick="window.createFamilyFromSiblings('${group.map(s => s.id).join(',')}')">🏠 Create Family</button>
                             </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function applySiblingDiscountToGroup(studentIdsStr) {
    const studentIds = studentIdsStr.split(',').map(Number);
    const discountAmount = parseFloat(state.schoolSettings.sibling_discount_amount || 0);

    if (discountAmount <= 0) {
        showToast('Sibling discount amount not configured', 'warning');
        return;
    }

    if (!await confirmDialog(`Apply ${fmtCurrency(discountAmount)} discount to ${studentIds.length} siblings?`)) return;

    for (const studentId of studentIds) {
        await insert('student_fees', {
            student_id: studentId,
            fee_category_id: null,
            term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id,
            amount: -discountAmount,
            paid_amount: discountAmount,
            is_paid: true,
            is_waived: false,
            is_discount: true,
            discount_reason: 'Sibling discount',
            created_at: new Date().toISOString()
        });
    }

    await refreshTable('student_fees');
    showToast(`✅ Applied sibling discount to ${studentIds.length} student(s)`, 'success');
}

async function createFamilyFromSiblings(studentIdsStr) {
    const studentIds = studentIdsStr.split(',').map(Number);
    const students = studentIds.map(id => getStudentById(id)).filter(Boolean);

    if (students.length < 2) return;

    const guardianName = students[0].guardian_name || 'Family';
    const guardianPhone = students[0].guardian_phone || '';
    const familyCode = `FAM-${Date.now().toString().slice(-6)}`;

    const newFamily = await insert('families', {
        family_code: familyCode,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        discount_amount: 0,
        created_at: new Date().toISOString()
    });

    if (newFamily) {
        for (const s of students) {
            await update('students', s.id, { family_id: newFamily.id });
        }
        await refreshTable('families');
        await refreshTable('students');
        showToast(`✅ Created family ${familyCode} with ${students.length} siblings`, 'success');
        renderDiscounts(document.getElementById('dynamic-content'));
    }
}

async function previewBulkDiscount() {
    const classId = document.getElementById('bulk-discount-class')?.value;
    const discountValue = parseFloat(document.getElementById('bulk-discount-value')?.value);
    const previewDiv = document.getElementById('bulk-discount-preview');

    if (isNaN(discountValue) || discountValue <= 0) {
        previewDiv.style.display = 'none';
        return;
    }

    let students = state.students.filter(s => s.status === 'Active');
    if (classId) students = students.filter(s => s.class_id == classId);

    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Preview:</strong> Will apply discount to ${students.length} student(s)
        </div>
    `;
}

async function applyBulkDiscount() {
    const classId = document.getElementById('bulk-discount-class')?.value;
    const discountType = document.getElementById('bulk-discount-type')?.value;
    const discountValue = parseFloat(document.getElementById('bulk-discount-value')?.value);
    const categoryId = document.getElementById('bulk-discount-category')?.value;

    if (isNaN(discountValue) || discountValue <= 0) {
        showToast('Please enter a valid discount value', 'warning');
        return;
    }

    let students = state.students.filter(s => s.status === 'Active');
    if (classId) students = students.filter(s => s.class_id == classId);

    if (students.length === 0) {
        showToast('No students found for selected class', 'warning');
        return;
    }

    if (!await confirmDialog(`Apply ${discountType === 'percentage' ? discountValue + '%' : fmtCurrency(discountValue)} discount to ${students.length} student(s)?`)) return;

    let applied = 0;
    for (const student of students) {
        await insert('student_fees', {
            student_id: student.id,
            fee_category_id: categoryId || null,
            term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id,
            amount: -discountValue,
            paid_amount: discountValue,
            is_paid: true,
            is_waived: false,
            is_discount: true,
            discount_type: discountType,
            discount_reason: 'Bulk discount applied',
            created_at: new Date().toISOString()
        });
        applied++;
    }

    await refreshTable('student_fees');
    showToast(`✅ Applied discount to ${applied} student(s)`, 'success');
}

function openAddDiscountModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>➕ Add Discount Rule</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Rule Name</label>
                            <input type="text" id="discount-rule-name" class="form-control" placeholder="e.g., Early Bird Discount">
                        </div>
                        <div class="form-group">
                            <label>Discount Type</label>
                            <select id="discount-rule-type" class="form-control">
                                <option value="fixed">Fixed Amount (RWF)</option>
                                <option value="percentage">Percentage (%)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discount Value</label>
                            <input type="number" id="discount-rule-value" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Apply To</label>
                            <select id="discount-rule-target" class="form-control">
                                <option value="all">All Students</option>
                                <option value="class">Specific Class</option>
                                <option value="family">Family</option>
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Valid Until</label>
                            <input type="date" id="discount-rule-valid-until" class="form-control">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveDiscountRule()">Save Rule</button>
                </div>
            </div>
        </div>
    `);
}

window.saveDiscountRule = async () => {
    const name = document.getElementById('discount-rule-name')?.value.trim();
    const type = document.getElementById('discount-rule-type')?.value;
    const value = parseFloat(document.getElementById('discount-rule-value')?.value);
    const target = document.getElementById('discount-rule-target')?.value;
    const validUntil = document.getElementById('discount-rule-valid-until')?.value;

    if (!name || isNaN(value) || value <= 0) {
        showToast('Please fill all required fields', 'warning');
        return;
    }

    await insert('discount_rules', {
        name: name,
        discount_type: type,
        discount_value: value,
        target_type: target,
        valid_until: validUntil || null,
        is_active: true,
        created_at: new Date().toISOString()
    });

    closeModal();
    showToast('✅ Discount rule created', 'success');
};

function exportDiscounts() {
    const families = state.families || [];
    const data = families.map(f => ({
        'Family Code': f.family_code,
        'Guardian Name': f.guardian_name || '',
        'Students': state.students.filter(s => s.family_id === f.id && s.status === 'Active').length,
        'Discount Amount (RWF)': f.discount_amount || 0,
        'Discount Type': f.discount_type || 'Fixed',
        'Notes': f.discount_notes || ''
    }));

    exportToExcel(data, `Discounts_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Discounts exported', 'success');
}