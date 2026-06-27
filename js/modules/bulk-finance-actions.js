// SECTION 58: BULK FINANCE ACTIONS
        // ================================================================

        async function renderBulkFinanceActions(container) {
            await ensureStateLoaded();
            const user = state.currentUser;
            if (user?.role === 'teacher') { container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot access financial functions.</div>'; return; }
            const classes = state.classes.filter(c => c.is_active !== false);
            const categories = state.feeCategories.filter(c => c.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">💰 Bulk Finance Actions</span></div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showBulkTab('payments', event)">💸 Bulk Payments</button>
                    <button class="tab-btn" onclick="window.showBulkTab('fees', event)">🏷️ Bulk Apply Fees</button>
                    <button class="tab-btn" onclick="window.showBulkTab('adjustments', event)">⚙️ Bulk Adjustments</button>
                    <button class="tab-btn" onclick="window.showBulkTab('waivers', event)">🎁 Bulk Waivers</button>
                </div>
                <div id="bulk-payments-tab"><div class="alert alert-info">Record payments for multiple students at once. Upload Excel or enter manually.</div><div class="form-grid" style="margin-bottom:16px"><div class="form-group"><label>Select Class</label><select id="bulk-pay-class" class="form-control" onchange="window.loadBulkPayStudents()"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Payment Date</label><input type="date" id="bulk-pay-date" class="form-control" value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>Payment Method</label><select id="bulk-pay-method" class="form-control"><option value="Cash">💵 Cash</option><option value="Mobile-Money">📱 Mobile-Money</option><option value="Bank Transfer">🏦 Bank Transfer</option><option value="Cheque">📄 Cheque</option></select></div></div><div class="btn-group" style="margin-bottom:16px"><button class="btn btn-sm btn-outline" onclick="window.downloadBulkPaymentTemplate()">📥 Download Template</button><button class="btn btn-sm btn-outline" onclick="window.importBulkPaymentExcel()">📤 Import from Excel</button><button class="btn btn-sm btn-primary" onclick="window.selectAllBulkPay(true)">✓ Select All</button><button class="btn btn-sm btn-outline" onclick="window.selectAllBulkPay(false)">✗ Deselect All</button></div><div id="bulk-pay-students-list" style="max-height:500px;overflow-y:auto"><div class="loading-container"><div class="spinner"></div><p>Select a class to load students</p></div></div><div class="btn-group" style="margin-top:16px"><button class="btn btn-success" onclick="window.processBulkPayments()">💰 Process Bulk Payments</button></div></div>
                <div id="bulk-fees-tab" style="display:none"><div class="alert alert-info">Apply a fee to multiple students at once.</div><div class="form-grid" style="margin-bottom:16px"><div class="form-group"><label>Select Class</label><select id="bulk-fee-class" class="form-control"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Fee Category</label><select id="bulk-fee-category" class="form-control"><option value="">-- Select Fee --</option>${categories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}</select></div><div class="form-group"><label>Amount Override (RWF)</label><input type="number" id="bulk-fee-amount" class="form-control" placeholder="Leave empty for default" min="0"></div><div class="form-group"><label>Due Date</label><input type="date" id="bulk-fee-due" class="form-control"></div><div class="form-group"><label>Term</label><select id="bulk-fee-term" class="form-control">${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div></div><div class="btn-group"><button class="btn btn-warning" onclick="window.applyBulkFeeToClass()">🏷️ Apply Fee to Class</button><button class="btn btn-outline" onclick="window.previewBulkFee()">👁️ Preview</button></div><div id="bulk-fee-preview" style="margin-top:16px;display:none"></div></div>
                <div id="bulk-adjustments-tab" style="display:none"><div class="alert alert-warning">⚠️ Bulk adjustments will modify student balances. Use with caution.</div><div class="form-grid" style="margin-bottom:16px"><div class="form-group"><label>Select Class</label><select id="bulk-adj-class" class="form-control"><option value="">-- Select Class --</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Adjustment Type</label><select id="bulk-adj-type" class="form-control"><option value="add_fee">➕ Add Fee (Increase Balance)</option><option value="add_payment">💰 Add Payment (Decrease Balance)</option><option value="add_credit">⭐ Add Credit</option><option value="waive_fee">🎁 Waive Fee</option></select></div><div class="form-group"><label>Amount (RWF)</label><input type="number" id="bulk-adj-amount" class="form-control" min="0" step="1000"></div><div class="form-group full"><label>Reason</label><input type="text" id="bulk-adj-reason" class="form-control" placeholder="Reason for bulk adjustment"></div></div><div class="btn-group"><button class="btn btn-warning" onclick="window.previewBulkAdjustment()">👁️ Preview</button><button class="btn btn-danger" onclick="window.executeBulkAdjustment()">⚙️ Apply Adjustment</button></div><div id="bulk-adj-preview" style="margin-top:16px;display:none"></div></div>
                <div id="bulk-waivers-tab" style="display:none"><div class="alert alert-info">Apply fee waivers to multiple students.</div><div class="form-grid" style="margin-bottom:16px"><div class="form-group"><label>Select Class</label><select id="bulk-waive-class" class="form-control">${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Fee Category</label><select id="bulk-waive-category" class="form-control">${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>Waiver Amount (RWF)</label><input type="number" id="bulk-waive-amount" class="form-control" min="0" step="1000"></div><div class="form-group full"><label>Reason</label><input type="text" id="bulk-waive-reason" class="form-control" placeholder="e.g., Sibling discount, Scholarship"></div></div><div class="btn-group"><button class="btn btn-warning" onclick="window.previewBulkWaiver()">👁️ Preview</button><button class="btn btn-success" onclick="window.applyBulkWaiver()">🎁 Apply Waivers</button></div><div id="bulk-waive-preview" style="margin-top:16px;display:none"></div></div>
            </div>
        </div>
    `;
            window.showBulkTab = showBulkTab;
            window.loadBulkPayStudents = loadBulkPayStudents;
            window.downloadBulkPaymentTemplate = downloadBulkPaymentTemplate;
            window.importBulkPaymentExcel = importBulkPaymentExcel;
            window.selectAllBulkPay = selectAllBulkPay;
            window.processBulkPayments = processBulkPayments;
            window.applyBulkFeeToClass = applyBulkFeeToClass;
            window.previewBulkFee = previewBulkFee;
            window.previewBulkAdjustment = previewBulkAdjustment;
            window.executeBulkAdjustment = executeBulkAdjustment;
            window.previewBulkWaiver = previewBulkWaiver;
            window.applyBulkWaiver = applyBulkWaiver;
        }
        window.renderBulkFinanceActions = renderBulkFinanceActions;

        function showBulkTab(tab, event) {
            ['payments', 'fees', 'adjustments', 'waivers'].forEach(t => { const p = document.getElementById('bulk-tab-' + t); if (p) p.style.display = t === tab ? '' : 'none'; });
            document.querySelectorAll('.bfa-tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }
        window.showBulkTab = showBulkTab;

        async function loadBulkPayStudents() {
            const classId = document.getElementById('bulk-pay-class')?.value;
            const container = document.getElementById('bulk-pay-students-list');
            if (!container) return;
            if (!classId) { container.innerHTML = '<p style="color:var(--text-muted)">Select a class first.</p>'; return; }
            await ensureStateLoaded();
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active').sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
            if (!students.length) { container.innerHTML = '<div class="alert alert-warning">No active students in this class.</div>'; return; }
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th><input type="checkbox" onclick="window.selectAllBulkPay(this.checked)" title="Select All"></th><th>Student</th><th>Balance (RWF)</th><th>Amount to Pay</th></tr></thead><tbody>${students.map(s => { const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { balance: 0 }; return `<tr><td><input type="checkbox" class="bulk-pay-check" data-student-id="${s.id}"></td><td>${esc(s.first_name + ' ' + s.last_name)}</td><td style="text-align:right;color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(bal.balance || 0)}</td><td><input type="number" id="bpa-${s.id}" value="${bal.balance > 0 ? bal.balance : 0}" min="0" style="width:120px" class="form-control"></td></tr>`; }).join('')}</tbody></table></div>`;
        }
        window.loadBulkPayStudents = loadBulkPayStudents;

        function selectAllBulkPay(checked) { document.querySelectorAll('.bulk-pay-check').forEach(cb => { cb.checked = checked; }); }
        window.selectAllBulkPay = selectAllBulkPay;

        function downloadBulkPaymentTemplate() {
            exportToExcel([{ student_code: 'ELF-0001', amount: 150000, payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0], notes: '' }], 'Bulk_Payment_Template');
            showToast('✅ Template downloaded', 'success');
        }
        window.downloadBulkPaymentTemplate = downloadBulkPaymentTemplate;

        async function importBulkPaymentExcel() {
            const fileInput = document.getElementById('bulk-pay-file'); if (!fileInput?.files[0]) { showToast('Select a file first', 'warning'); return; }
            try {
                const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => { const wb = XLSX.read(e.target.result, { type: 'binary' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); }; reader.onerror = reject; reader.readAsBinaryString(fileInput.files[0]); });
                window._bulkPayImportData = data; showToast('📋 ' + data.length + ' rows loaded — click Process to apply', 'info', 4000);
            } catch (e) { showToast('Failed to read file: ' + e.message, 'error'); }
        }
        window.importBulkPaymentExcel = importBulkPaymentExcel;

        async function processBulkPayments() {
            const checks = document.querySelectorAll('.bulk-pay-check:checked');
            const method = document.getElementById('bfp-method')?.value || 'Cash';
            const date = document.getElementById('bfp-date')?.value || new Date().toISOString().split('T')[0];
            if (!checks.length) { showToast('Select at least one student', 'warning'); return; }
            if (!await confirmDialog(`Process payments for ${checks.length} students?`)) return;
            showToast('⏳ Processing…', 'info', 3000);
            let ok = 0; let receiptNum = (state.payments?.length || 0) + 1;
            for (const cb of checks) {
                const studentId = parseInt(cb.dataset.studentId);
                const amount = parseFloat(document.getElementById('bpa-' + studentId)?.value || 0);
                if (!amount || amount <= 0) continue;
                const receipt = 'RCP-' + String(receiptNum++).padStart(4, '0');
                const r = await apiRequest('payments', 'POST', { student_id: studentId, amount, payment_method: method, payment_date: date, receipt_number: receipt, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, recorded_by: state.currentUser?.username || '', notes: 'Bulk payment', created_at: new Date().toISOString() });
                if (r.success) ok++;
            }
            await refreshTable('payments'); showToast(`✅ ${ok} payments recorded`, 'success');
        }
        window.processBulkPayments = processBulkPayments;

        async function applyBulkFeeToClass() {
            await ensureStateLoaded();
            const classId = document.getElementById('bff-class')?.value;
            const categoryId = document.getElementById('bff-category')?.value;
            const amount = parseFloat(document.getElementById('bff-amount')?.value || 0);
            if (!classId || !categoryId || !amount) { showToast('Class, fee category, and amount required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!students.length) { showToast('No active students in this class', 'warning'); return; }
            if (!await confirmDialog(`Apply ${fmtCurrency(amount)} fee to ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) {
                const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: parseInt(categoryId), term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount, paid_amount: 0, is_paid: false, is_waived: false, due_date: state.currentTerm?.end_date || null, created_at: new Date().toISOString() });
                if (r.success) ok++;
            }
            await refreshTable('student_fees'); showToast('✅ Fee applied to ' + ok + ' students', 'success');
        }
        window.applyBulkFeeToClass = applyBulkFeeToClass;

        function previewBulkFee() {
            const classId = document.getElementById('bff-class')?.value;
            const categoryId = document.getElementById('bff-category')?.value;
            const amount = parseFloat(document.getElementById('bff-amount')?.value || 0);
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const cat = state.feeCategories.find(f => String(f.id) === String(categoryId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: ${fmtCurrency(amount)} × ${count} students in ${cls?.name || '—'} (${cat?.name || '—'}) = ${fmtCurrency(amount * count)} total`, 'info', 5000);
        }
        window.previewBulkFee = previewBulkFee;

        function previewBulkAdjustment() {
            const classId = document.getElementById('badj-class')?.value;
            const amount = parseFloat(document.getElementById('badj-amount')?.value || 0);
            const type = document.getElementById('badj-type')?.value || 'credit';
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: ${type} of ${fmtCurrency(amount)} for ${count} students in ${cls?.name || '—'}`, 'info', 4000);
        }
        window.previewBulkAdjustment = previewBulkAdjustment;

        async function executeBulkAdjustment() {
            const classId = document.getElementById('badj-class')?.value;
            const amount = parseFloat(document.getElementById('badj-amount')?.value || 0);
            const type = document.getElementById('badj-type')?.value || 'credit';
            const reason = document.getElementById('badj-reason')?.value?.trim() || 'Bulk adjustment';
            if (!classId || !amount) { showToast('Class and amount required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!students.length) { showToast('No students found', 'warning'); return; }
            if (!await confirmDialog(`Apply ${type} of ${fmtCurrency(amount)} to ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) {
                const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: null, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount: type === 'credit' ? -amount : amount, paid_amount: 0, is_paid: false, is_waived: false, notes: reason, created_at: new Date().toISOString() });
                if (r.success) ok++;
            }
            await refreshTable('student_fees'); showToast('✅ Adjustment applied to ' + ok + ' students', 'success');
        }
        window.executeBulkAdjustment = executeBulkAdjustment;

        function previewBulkWaiver() {
            const classId = document.getElementById('bwv-class')?.value;
            const categoryId = document.getElementById('bwv-category')?.value;
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const cat = state.feeCategories.find(f => String(f.id) === String(categoryId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: waive "${cat?.name || 'selected fee'}" for ${count} students in ${cls?.name || '—'}`, 'info', 4000);
        }
        window.previewBulkWaiver = previewBulkWaiver;

        async function applyBulkWaiver() {
            const classId = document.getElementById('bwv-class')?.value;
            const categoryId = document.getElementById('bwv-category')?.value;
            const reason = document.getElementById('bwv-reason')?.value?.trim() || 'Bulk waiver';
            if (!classId || !categoryId) { showToast('Class and fee category required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!await confirmDialog(`Waive fee for ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) {
                const fees = (state.studentFees || []).filter(f => f.student_id === s.id && String(f.fee_category_id) === String(categoryId) && !f.is_waived);
                for (const fee of fees) {
                    const r = await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, notes: reason, updated_at: new Date().toISOString() });
                    if (r.success) ok++;
                }
            }
            await refreshTable('student_fees'); showToast('✅ Waived ' + ok + ' fee record(s)', 'success');
        }
        window.applyBulkWaiver = applyBulkWaiver;

        // ================================================================
