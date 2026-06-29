// js/modules/fee-structures.js
// Fee Structures Module - Manage fee categories and amount templates


async function renderFeeStructures(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isTeacher = user?.role === 'teacher';

    if (isTeacher) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage fee structures.</div>';
        return;
    }

    const categories = state.feeCategories.filter(c => c.is_active !== false);
    const classes = state.classes.filter(c => c.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🏷️ Fee Structures</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddFeeCategoryModal()">➕ Add Category</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportFeeStructures()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showStructureTab('categories', event)">📋 Fee Categories</button>
                    <button class="tab-btn" onclick="window.showStructureTab('templates', event)">📄 Fee Templates</button>
                    <button class="tab-btn" onclick="window.showStructureTab('class-overrides', event)">🏛️ Class Overrides</button>
                </div>
                
                <div id="categories-tab">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Category Name</th>
                                    <th>Type</th>
                                    <th>Default Amount</th>
                                    <th>Reset Frequency</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${categories.length ? categories.map(cat => `
                                    <tr>
                                        <td><strong>${esc(cat.name)}</strong></td>
                                        <td>${esc(cat.fee_type || '—')}</span>
                                        <td>${fmtCurrency(cat.amount || 0)}</span>
                                        <td><span class="badge badge-info">${cat.reset_frequency || 'one_time'}</span></td>
                                        <td><span class="badge ${cat.is_active !== false ? 'badge-success' : 'badge-danger'}">${cat.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.editFeeCategory(${cat.id})">✏️</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteFeeCategory(${cat.id}, '${esc(cat.name)}')">🗑️</button>
                                            <button class="btn btn-sm btn-primary" onclick="window.copyFeeCategory(${cat.id})">📋 Copy</button>
                                         </span>
                                    </tr>
                                `).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No fee categories found</span>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div id="templates-tab" style="display:none">
                    <div class="alert alert-info">Fee templates allow you to quickly apply predefined fee sets to classes.</div>
                    <div class="btn-group" style="margin-bottom:16px">
                        <button class="btn btn-sm btn-primary" onclick="window.openAddTemplateModal()">➕ Create Template</button>
                    </div>
                    <div id="templates-list" class="table-wrapper">
                        <div class="loading-container"><div class="spinner"></div><p>Loading templates...</p></div>
                    </div>
                </div>
                
                <div id="class-overrides-tab" style="display:none">
                    <div class="alert alert-info">Override default fee amounts for specific classes.</div>
                    <div class="filters-bar">
                        <select id="override-class-filter" class="form-control" style="width:200px" onchange="window.loadClassOverrides()">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="window.openAddOverrideModal()">➕ Add Override</button>
                    </div>
                    <div id="class-overrides-list" class="table-wrapper" style="margin-top:16px">
                        <div class="loading-container"><div class="spinner"></div><p>Loading overrides...</p></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.showStructureTab = showStructureTab;
    window.openAddFeeCategoryModal = openAddFeeCategoryModal;
    window.editFeeCategory = editFeeCategory;
    window.deleteFeeCategory = deleteFeeCategory;
    window.copyFeeCategory = copyFeeCategory;
    window.exportFeeStructures = exportFeeStructures;
    window.openAddTemplateModal = openAddTemplateModal;
    window.loadClassOverrides = loadClassOverrides;
    window.openAddOverrideModal = openAddOverrideModal;
    window.createFeeCategory = createFeeCategory;
    window.updateFeeCategory = updateFeeCategory;
    window.saveFeeTemplate = saveFeeTemplate;
    window.updateOverrideDefaultAmount = updateOverrideDefaultAmount;
    window.createOverride = createOverride;
    window.editOverride = editOverride;
    window.deleteOverride = deleteOverride;
    window.viewTemplate = viewTemplate;
    window.applyTemplate = applyTemplate;
    window.deleteTemplate = deleteTemplate;

    await loadTemplates();
    await loadClassOverrides();
}

function showStructureTab(tabName, event) {
    const tabs = ['categories', 'templates', 'class-overrides'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

function openAddFeeCategoryModal() {
    showModal(`
        <div class="modal-overlay" id="add-category-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 550px;">
                <div class="modal-header">
                    <h3>➕ Add Fee Category</h3>
                    <button class="modal-close" onclick="closeModal('add-category-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Category Name *</label>
                            <input type="text" id="new-cat-name" class="form-control" placeholder="e.g., Tuition Fees">
                        </div>
                        <div class="form-group">
                            <label>Fee Type</label>
                            <select id="new-cat-type" class="form-control">
                                <option value="Tuition">Tuition</option>
                                <option value="Activity">Activity</option>
                                <option value="Transport">Transport</option>
                                <option value="Meals">Meals</option>
                                <option value="Uniform">Uniform</option>
                                <option value="Supplies">Supplies</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Default Amount (RWF)</label>
                            <input type="number" id="new-cat-amount" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Reset Frequency</label>
                            <select id="new-cat-frequency" class="form-control">
                                <option value="one_time">One-time</option>
                                <option value="termly">Termly</option>
                                <option value="monthly">Monthly</option>
                                <option value="annual">Annual</option>
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Description</label>
                            <textarea id="new-cat-desc" class="form-control" rows="2" placeholder="Optional description"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('add-category-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createFeeCategory()">Create Category</button>
                </div>
            </div>
        </div>
    `);
}

async function createFeeCategory() {
    const name = document.getElementById('new-cat-name')?.value.trim();
    const type = document.getElementById('new-cat-type')?.value;
    const amount = parseFloat(document.getElementById('new-cat-amount')?.value) || 0;
    const frequency = document.getElementById('new-cat-frequency')?.value;
    const description = document.getElementById('new-cat-desc')?.value;

    if (!name) {
        showToast('Category name is required', 'warning');
        return;
    }

    await insert('fee_categories', {
        name: name,
        fee_type: type,
        amount: amount,
        reset_frequency: frequency,
        description: description,
        is_active: true,
        created_at: new Date().toISOString()
    });

    await refreshTable('fee_categories');
    closeModal('add-category-modal');
    showToast('✅ Fee category created', 'success');
    renderFeeStructures(document.getElementById('dynamic-content'));
}

async function editFeeCategory(categoryId) {
    const cat = state.feeCategories.find(c => c.id === categoryId);
    if (!cat) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 550px;">
                <div class="modal-header">
                    <h3>✏️ Edit Fee Category</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Category Name</label>
                            <input type="text" id="edit-cat-name" value="${esc(cat.name)}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Fee Type</label>
                            <select id="edit-cat-type" class="form-control">
                                <option value="Tuition" ${cat.fee_type === 'Tuition' ? 'selected' : ''}>Tuition</option>
                                <option value="Activity" ${cat.fee_type === 'Activity' ? 'selected' : ''}>Activity</option>
                                <option value="Transport" ${cat.fee_type === 'Transport' ? 'selected' : ''}>Transport</option>
                                <option value="Meals" ${cat.fee_type === 'Meals' ? 'selected' : ''}>Meals</option>
                                <option value="Uniform" ${cat.fee_type === 'Uniform' ? 'selected' : ''}>Uniform</option>
                                <option value="Supplies" ${cat.fee_type === 'Supplies' ? 'selected' : ''}>Supplies</option>
                                <option value="Other" ${cat.fee_type === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Default Amount (RWF)</label>
                            <input type="number" id="edit-cat-amount" value="${cat.amount || 0}" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Reset Frequency</label>
                            <select id="edit-cat-frequency" class="form-control">
                                <option value="one_time" ${cat.reset_frequency === 'one_time' ? 'selected' : ''}>One-time</option>
                                <option value="termly" ${cat.reset_frequency === 'termly' ? 'selected' : ''}>Termly</option>
                                <option value="monthly" ${cat.reset_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                                <option value="annual" ${cat.reset_frequency === 'annual' ? 'selected' : ''}>Annual</option>
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Description</label>
                            <textarea id="edit-cat-desc" class="form-control" rows="2">${esc(cat.description || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="edit-cat-status" class="form-control">
                                <option value="active" ${cat.is_active !== false ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${cat.is_active === false ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateFeeCategory(${categoryId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function updateFeeCategory(categoryId) {
    const name = document.getElementById('edit-cat-name')?.value.trim();
    const type = document.getElementById('edit-cat-type')?.value;
    const amount = parseFloat(document.getElementById('edit-cat-amount')?.value) || 0;
    const frequency = document.getElementById('edit-cat-frequency')?.value;
    const description = document.getElementById('edit-cat-desc')?.value;
    const status = document.getElementById('edit-cat-status')?.value === 'active';

    if (!name) {
        showToast('Category name is required', 'warning');
        return;
    }

    await update('fee_categories', categoryId, {
        name: name,
        fee_type: type,
        amount: amount,
        reset_frequency: frequency,
        description: description,
        is_active: status,
        updated_at: new Date().toISOString()
    });

    await refreshTable('fee_categories');
    closeModal();
    showToast('✅ Fee category updated', 'success');
    renderFeeStructures(document.getElementById('dynamic-content'));
}

async function deleteFeeCategory(categoryId, categoryName) {
    const usageCount = state.studentFees.filter(f => f.fee_category_id === categoryId).length;
    let warningMsg = `Delete fee category "${categoryName}"? `;
    if (usageCount > 0) {
        warningMsg += `\n\n⚠️ This category is used in ${usageCount} fee assignment(s). Deleting will remove these assignments.`;
    }

    if (!await confirmDialog(warningMsg)) return;

    // Remove all fee assignments for this category
    const assignments = state.studentFees.filter(f => f.fee_category_id === categoryId);
    for (const assignment of assignments) {
        await remove('student_fees', assignment.id);
    }

    await remove('fee_categories', categoryId);
    await refreshTable('fee_categories');
    await refreshTable('student_fees');
    showToast(`✅ Fee category "${categoryName}" deleted`, 'success');
    renderFeeStructures(document.getElementById('dynamic-content'));
}

async function copyFeeCategory(categoryId) {
    const original = state.feeCategories.find(c => c.id === categoryId);
    if (!original) return;

    const newName = `${original.name} (Copy)`;

    await insert('fee_categories', {
        name: newName,
        fee_type: original.fee_type,
        amount: original.amount,
        reset_frequency: original.reset_frequency,
        description: original.description,
        is_active: true,
        created_at: new Date().toISOString()
    });

    await refreshTable('fee_categories');
    showToast(`✅ Copied "${original.name}" to "${newName}"`, 'success');
    renderFeeStructures(document.getElementById('dynamic-content'));
}

async function loadTemplates() {
    const container = document.getElementById('templates-list');
    if (!container) return;

    let templates = [];
    try {
        templates = await getAll('fee_templates');
    } catch (e) {
        templates = [];
    }

    if (templates.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No fee templates found. Create one to quickly apply fee sets to classes.</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Template Name</th><th>Description</th><th>Fees Included</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${templates.map(t => `
                    <tr>
                        <td><strong>${esc(t.name)}</strong></td>
                        <td>${esc(t.description || '—')}</span>
                        <td>${t.fees_count || 0} fees</span>
                        <td>${fmtDate(t.created_at)}</span>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="window.viewTemplate(${t.id})">👁️</button>
                            <button class="btn btn-sm btn-primary" onclick="window.applyTemplate(${t.id})">📋 Apply</button>
                            <button class="btn btn-sm btn-danger" onclick="window.deleteTemplate(${t.id})">🗑️</button>
                         </span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openAddTemplateModal() {
    const categories = state.feeCategories.filter(c => c.is_active !== false);

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>📄 Create Fee Template</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Template Name *</label>
                            <input type="text" id="template-name" class="form-control" placeholder="e.g., Standard Fee Package">
                        </div>
                        <div class="form-group full">
                            <label>Description</label>
                            <textarea id="template-desc" class="form-control" rows="2" placeholder="Optional description"></textarea>
                        </div>
                        <div class="form-group full">
                            <label>Select Fees to Include</label>
                            <div style="border:1px solid var(--border-light); border-radius:8px; padding:12px; max-height:200px; overflow-y:auto">
                                ${categories.map(cat => `
                                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer">
                                        <input type="checkbox" class="template-fee-cb" value="${cat.id}" data-amount="${cat.amount || 0}">
                                        <span><strong>${esc(cat.name)}</strong> - ${fmtCurrency(cat.amount || 0)}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveFeeTemplate()">Save Template</button>
                </div>
            </div>
        </div>
    `);
}

async function saveFeeTemplate() {
    const name = document.getElementById('template-name')?.value.trim();
    const description = document.getElementById('template-desc')?.value;
    const selectedFees = [...document.querySelectorAll('.template-fee-cb:checked')].map(cb => ({
        id: parseInt(cb.value),
        amount: parseFloat(cb.dataset.amount)
    }));

    if (!name) {
        showToast('Template name is required', 'warning');
        return;
    }

    if (selectedFees.length === 0) {
        showToast('Please select at least one fee to include', 'warning');
        return;
    }

    await insert('fee_templates', {
        name: name,
        description: description,
        fees: JSON.stringify(selectedFees),
        fees_count: selectedFees.length,
        created_at: new Date().toISOString()
    });

    closeModal();
    showToast('✅ Fee template created', 'success');
    await loadTemplates();
}

async function viewTemplate(templateId) {
    // Placeholder for view template functionality
    showToast('View template details - coming soon', 'info');
}

async function applyTemplate(templateId) {
    // Placeholder for apply template functionality
    showToast('Apply template to class - coming soon', 'info');
}

async function deleteTemplate(templateId) {
    if (!await confirmDialog('Delete this fee template?')) return;
    await remove('fee_templates', templateId);
    showToast('✅ Fee template deleted', 'success');
    await loadTemplates();
}

async function loadClassOverrides() {
    const classFilter = document.getElementById('override-class-filter')?.value;
    const container = document.getElementById('class-overrides-list');
    if (!container) return;

    let overrides = [...state.feeAmounts];
    if (classFilter) overrides = overrides.filter(o => o.class_id == classFilter);

    if (overrides.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No class overrides found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Class</th>
                    <th>Fee Category</th>
                    <th>Default Amount</th>
                    <th>Override Amount</th>
                    <th>Difference</th>
                    <th>Academic Year</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${overrides.map(override => {
        const cls = getClassById(override.class_id);
        const category = state.feeCategories.find(c => c.id === override.fee_category_id);
        const difference = override.amount - (category?.amount || 0);
        const diffClass = difference > 0 ? 'text-danger' : (difference < 0 ? 'text-success' : '');

        return `
                        <tr>
                            <td>${esc(cls?.name || '—')}</td>
                            <td>${esc(category?.name || '—')}</td>
                            <td>${fmtCurrency(category?.amount || 0)}</span>
                            <td><strong>${fmtCurrency(override.amount)}</strong></td>
                            <td class="${diffClass}">${difference > 0 ? '+' : ''}${fmtCurrency(difference)}</span>
                            <td>${state.academicYears.find(y => y.id === override.academic_year_id)?.name || '—'}</span>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="window.editOverride(${override.id})">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteOverride(${override.id})">🗑️</button>
                             </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function openAddOverrideModal() {
    const classes = state.classes.filter(c => c.is_active !== false);
    const categories = state.feeCategories.filter(c => c.is_active !== false);
    const years = state.academicYears;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Add Class Override</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Class</label>
                            <select id="override-class" class="form-control">
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Fee Category</label>
                            <select id="override-category" class="form-control" onchange="window.updateOverrideDefaultAmount()">
                                ${categories.map(c => `<option value="${c.id}" data-amount="${c.amount || 0}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Override Amount (RWF)</label>
                            <input type="number" id="override-amount" class="form-control" min="0" step="1000">
                        </div>
                        <div class="form-group">
                            <label>Academic Year</label>
                            <select id="override-year" class="form-control">
                                ${years.map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createOverride()">Create Override</button>
                </div>
            </div>
        </div>
    `);
}

function updateOverrideDefaultAmount() {
    const select = document.getElementById('override-category');
    const selected = select.options[select.selectedIndex];
    const defaultAmount = selected?.dataset.amount || 0;
    const amountInput = document.getElementById('override-amount');
    if (amountInput && !amountInput.value) {
        amountInput.placeholder = `Default: ${fmtCurrency(defaultAmount)}`;
    }
}

async function createOverride() {
    const classId = document.getElementById('override-class')?.value;
    const categoryId = document.getElementById('override-category')?.value;
    const amount = parseFloat(document.getElementById('override-amount')?.value);
    const yearId = document.getElementById('override-year')?.value;

    if (!classId || !categoryId) {
        showToast('Please select class and fee category', 'warning');
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }

    const existing = state.feeAmounts.find(fa =>
        fa.class_id == classId && fa.fee_category_id == categoryId && fa.academic_year_id == yearId
    );

    if (existing) {
        if (!await confirmDialog('An override already exists for this class, category, and year. Update it?')) return;
        await update('fee_amounts', existing.id, { amount: amount, updated_at: new Date().toISOString() });
    } else {
        await insert('fee_amounts', {
            class_id: parseInt(classId),
            fee_category_id: parseInt(categoryId),
            academic_year_id: parseInt(yearId),
            amount: amount,
            created_at: new Date().toISOString()
        });
    }

    await refreshTable('fee_amounts');
    closeModal();
    showToast('✅ Class override created/updated', 'success');
    await loadClassOverrides();
}

async function editOverride(overrideId) {
    const override = state.feeAmounts.find(f => f.id === overrideId);
    if (!override) return;

    // Reuse the add modal with pre-filled values
    openAddOverrideModal();
    setTimeout(() => {
        document.getElementById('override-class').value = override.class_id;
        document.getElementById('override-category').value = override.fee_category_id;
        document.getElementById('override-amount').value = override.amount;
        document.getElementById('override-year').value = override.academic_year_id;
    }, 100);
}

async function deleteOverride(overrideId) {
    if (!await confirmDialog('Delete this class override?')) return;
    await remove('fee_amounts', overrideId);
    await refreshTable('fee_amounts');
    showToast('✅ Class override deleted', 'success');
    await loadClassOverrides();
}

function exportFeeStructures() {
    const data = state.feeCategories.map(cat => ({
        'Category Name': cat.name,
        'Type': cat.fee_type || '',
        'Default Amount (RWF)': cat.amount || 0,
        'Reset Frequency': cat.reset_frequency || 'one_time',
        'Description': cat.description || '',
        'Status': cat.is_active !== false ? 'Active' : 'Inactive',
        'Created': fmtDate(cat.created_at)
    }));

    exportToExcel(data, `Fee_Structures_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Fee structures exported', 'success');
}