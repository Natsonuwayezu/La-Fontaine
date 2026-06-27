// SECTION 57: DISCOUNTS
        // ================================================================

        async function renderDiscounts(container) {
            if (isTeacher()) { container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot manage discounts.</div>'; return; }
            await ensureStateLoaded();
            const families = state.families || [];
            const classes = state.classes.filter(c => c.is_active !== false);
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🎁 Discounts Management</span><div class="btn-group"><button class="btn btn-sm btn-primary" onclick="window.openAddDiscountRuleModal()">➕ Add Discount Rule</button><button class="btn btn-sm btn-outline" onclick="window.exportDiscountsData()">📥 Export</button></div></div>
            <div class="dash-card-body">
                <div id="family-discounts-tab"><div class="alert alert-info">Family discounts apply to all siblings in the same family group.</div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Family Code</th><th>Guardian Name</th><th>Students</th><th>Discount Amount</th><th>Actions</th></tr></thead><tbody>${families.map(f => { const studentCount = state.students.filter(s => s.family_id === f.id && s.status === 'Active').length; return `<tr><td><code>${esc(f.family_code)}</code></td><td><strong>${esc(f.guardian_name || '—')}</strong></td><td style="text-align:center">${studentCount}</td><td>${fmtCurrency(f.discount_amount || 0)}</td><td><button class="btn btn-sm btn-outline" onclick="window.editFamilyDiscount(${f.id})">✏️</button><button class="btn btn-sm btn-primary" onclick="window.applyFamilyDiscountToAll(${f.id})">💰 Apply</button></td></tr>`; }).join('') || '<tr><td colspan="5" style="text-align:center;padding:40px">No families found</td></tr>'}</tbody></table></div></div>
                <div id="bulk-discounts-tab" style="display:none;margin-top:20px"><div class="form-grid"><div class="form-group"><label>Select Class</label><select id="bulk-discount-class" class="form-control"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Discount Type</label><select id="bulk-discount-type" class="form-control"><option value="fixed">Fixed Amount (RWF)</option><option value="percentage">Percentage (%)</option></select></div><div class="form-group"><label>Discount Value</label><input type="number" id="bulk-discount-value" class="form-control" min="0" step="1000"></div><div class="form-group"><label>Apply to Fee Category</label><select id="bulk-discount-category" class="form-control"><option value="">All Categories</option>${state.feeCategories.filter(c => c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div><div class="btn-group"><button class="btn btn-warning" onclick="window.previewBulkDiscount()">👁️ Preview</button><button class="btn btn-primary" onclick="window.applyBulkDiscountToClass()">🎁 Apply Discount</button></div><div id="bulk-discount-preview" style="margin-top:16px; display:none"></div></div>
            </div>
        </div>
    `;
        }
        window.renderDiscounts = renderDiscounts;

        async function openAddDiscountRuleModal() {
            const categories = state.feeCategories || [];
            showModal(`<div class="modal-overlay" id="add-discount-modal"><div class="modal modal-sm"><div class="modal-header"><h3>💰 Add Discount Rule</h3><button class="modal-close" onclick="closeModal('add-discount-modal')">✕</button></div><div class="modal-body"><div class="form-group"><label>Discount Name</label><input id="disc-name" class="form-control" placeholder="e.g. Sibling Discount"></div><div class="form-group"><label>Applies To</label><select id="disc-category" class="form-control"><option value="">All Fees</option>${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Type</label><select id="disc-type" class="form-control"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount (RWF)</option></select></div><div class="form-group"><label>Value</label><input id="disc-value" type="number" class="form-control" placeholder="e.g. 10 for 10%"></div><div class="form-group"><label>Condition</label><select id="disc-condition" class="form-control"><option value="always">Always Apply</option><option value="sibling">Has Sibling Enrolled</option><option value="scholarship">Scholarship</option><option value="staff">Staff Child</option></select></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-discount-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveDiscountRule()">Save Rule</button></div></div></div>`);
            window._saveDiscountRule = async () => {
                const name = document.getElementById('disc-name')?.value.trim();
                const catId = document.getElementById('disc-category')?.value;
                const type = document.getElementById('disc-type')?.value;
                const value = parseFloat(document.getElementById('disc-value')?.value);
                const condition = document.getElementById('disc-condition')?.value;
                if (!name || isNaN(value)) { showToast('Name and value are required', 'warning'); return; }
                const r = await apiRequest('discounts', 'POST', { name, fee_category_id: catId || null, discount_type: type, discount_value: value, condition, is_active: true, created_at: new Date().toISOString() });
                if (r.success) { closeModal(); await refreshTable('discounts'); showToast('✅ Discount rule saved', 'success'); }
                else showToast('Failed to save: ' + r.error, 'error');
            };
        }
        window.openAddDiscountRuleModal = openAddDiscountRuleModal;

        function exportDiscountsData() {
            const discounts = state.discounts || [];
            exportToExcel(discounts.map(d => ({ 'Name': d.name, 'Type': d.discount_type, 'Value': d.discount_value, 'Condition': d.condition || '', 'Active': d.is_active ? 'Yes' : 'No' })), 'Discounts_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Discounts exported', 'success');
        }
        window.exportDiscountsData = exportDiscountsData;

        async function applyBulkDiscountToClass() {
            const classId = document.getElementById('bulk-discount-class')?.value;
            const catId = document.getElementById('bulk-discount-category')?.value;
            const type = document.getElementById('bulk-discount-type')?.value;
            const value = parseFloat(document.getElementById('bulk-discount-value')?.value);
            if (!classId || isNaN(value) || value <= 0) { showToast('Select class and enter a valid discount value', 'warning'); return; }
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            if (!students.length) { showToast('No active students in selected class', 'warning'); return; }
            if (!await confirmDialog(`Apply ${type === 'percentage' ? value + '%' : fmtCurrency(value)} discount to ${students.length} students?`)) return;
            let applied = 0;
            for (const student of students) {
                const fees = (state.studentFees || []).filter(f => f.student_id === student.id && (!catId || f.fee_category_id == catId) && !f.is_paid && !f.is_waived);
                for (const fee of fees) {
                    const discAmount = type === 'percentage' ? fee.amount * (value / 100) : Math.min(value, fee.amount);
                    await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { amount: Math.max(0, fee.amount - discAmount), updated_at: new Date().toISOString() });
                    applied++;
                }
            }
            await refreshTable('student_fees');
            showToast(`✅ Discount applied to ${applied} fee records`, 'success');
        }
        window.applyBulkDiscountToClass = applyBulkDiscountToClass;

        function previewBulkDiscount() {
            const classId = document.getElementById('bulk-discount-class')?.value;
            const type = document.getElementById('bulk-discount-type')?.value;
            const value = parseFloat(document.getElementById('bulk-discount-value')?.value);
            if (!classId || isNaN(value)) { showToast('Select class and enter a discount value first', 'warning'); return; }
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const totalFees = students.reduce((sum, s) => sum + (state.studentFees || []).filter(f => f.student_id === s.id && !f.is_paid && !f.is_waived).reduce((s2, f) => s2 + f.amount, 0), 0);
            const discTotal = type === 'percentage' ? totalFees * (value / 100) : students.length * value;
            showToast('Preview: ' + fmtCurrency(discTotal) + ' total discount for ' + students.length + ' students (' + fmtCurrency(totalFees) + ' total fees)', 'info', 6000);
        }
        window.previewBulkDiscount = previewBulkDiscount;

        // ================================================================
