// SECTION 56: CARRY FORWARD
        // ================================================================

        async function renderCarryForward(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') { container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>'; return; }
            await ensureStateLoaded();
            const currentYear = state.currentAcadYear;
            const classes = state.classes.filter(c => c.is_active !== false);
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🔄 Carry Forward Unpaid Fees</span></div>
            <div class="dash-card-body">
                <div class="alert alert-warning"><strong>⚠️ Important:</strong> This will transfer unpaid fees from the current academic year to the next academic year. Paid fees will NOT be carried forward.</div>
                <div class="form-grid" style="margin-bottom:20px">
                    <div class="form-group"><label>From Academic Year</label><input type="text" readonly value="${esc(currentYear?.name || 'Current Year')}" class="form-control"></div>
                    <div class="form-group"><label>To Academic Year</label><select id="carry-target-year" class="form-control"><option value="">-- Select Target Year --</option>${state.academicYears.filter(y => y.id !== currentYear?.id).map(y => `<option value="${y.id}">${esc(y.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Filter by Class</label><select id="carry-class-filter" class="form-control"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Minimum Balance to Carry</label><input type="number" id="carry-min-balance" value="0" min="0" step="1000" class="form-control"></div>
                </div>
                <div class="btn-group" style="margin-bottom:20px"><button class="btn btn-outline" onclick="previewCarryForward()">👁️ Preview</button><button class="btn btn-warning" onclick="executeCarryForward()">🔄 Execute Carry Forward</button><button class="btn btn-outline" onclick="exportCarryPreview()">📥 Export Preview</button></div>
                <div id="carry-preview-container" style="display:none"><h4>📋 Preview: Fees to be Carried Forward</h4><div id="carry-preview-table" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading preview...</p></div></div></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📜 Carry Forward History</span><button class="btn btn-sm btn-outline" onclick="loadCarryHistory()">🔄 Refresh</button></div><div class="dash-card-body"><div id="carry-history-container" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading history...</p></div></div></div></div>
    `;
        }
        window.renderCarryForward = renderCarryForward;

        async function previewCarryForward() {
            const fromTerm = document.getElementById('carry-from-term')?.value;
            const toTerm = document.getElementById('carry-to-term')?.value;
            if (!fromTerm || !toTerm || fromTerm === toTerm) { showToast('Select different from/to terms', 'warning'); return; }
            const fromFees = (state.studentFees || []).filter(f => f.term_id == fromTerm && !f.is_waived && !f.is_credit && !f.manually_deleted);
            const preview = fromFees.map(f => {
                const s = getStudentById(f.student_id);
                const balance = Math.max(0, (f.amount || 0) - (f.paid_amount || 0));
                return balance > 0 ? { student: s, fee: f, balance } : null;
            }).filter(Boolean);
            window._carryPreviewData = preview;
            const tbody = document.getElementById('carry-preview-tbody');
            if (!tbody) return;
            tbody.innerHTML = preview.length ? preview.map(p => `<tr><td>${esc(p.student ? `${p.student.first_name} ${p.student.last_name}` : '—')}</td><td>${esc(getClassById(p.student?.class_id)?.name || '—')}</td><td>${fmtCurrency(p.fee.amount)}</td><td>${fmtCurrency(p.fee.paid_amount || 0)}</td><td>${fmtCurrency(p.balance)}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center">No outstanding balances to carry forward</td></tr>';
            document.getElementById('carry-preview-section')?.style?.setProperty('display', 'block');
        }
        window.previewCarryForward = previewCarryForward;

        async function executeCarryForward() {
            const preview = window._carryPreviewData || [];
            const toTerm = document.getElementById('carry-to-term')?.value;
            if (!preview.length || !toTerm) { showToast('Run preview first', 'warning'); return; }
            if (!await confirmDialog(`Carry forward ${preview.length} unpaid balances to the selected term?`)) return;
            let done = 0;
            for (const p of preview) {
                await insert('student_fees', {
                    student_id: p.student?.id,
                    fee_category_id: p.fee.fee_category_id,
                    term_id: parseInt(toTerm),
                    academic_year_id: state.currentAcadYear?.id,
                    amount: p.balance,
                    paid_amount: 0,
                    is_paid: false,
                    is_waived: false,
                    notes: `Carried forward from term ${p.fee.term_id}`,
                    created_at: new Date().toISOString()
                });
                done++;
            }
            await refreshTable('student_fees');
            window._carryPreviewData = [];
            showToast(`✅ Carried forward ${done} balances`, 'success');
            renderCarryForward(document.getElementById('dynamic-content'));
        }
        window.executeCarryForward = executeCarryForward;

        function exportCarryPreview() {
            const preview = window._carryPreviewData || [];
            if (!preview.length) { showToast('Run preview first', 'warning'); return; }
            const data = preview.map(p => ({ 'Student': p.student ? `${p.student.first_name} ${p.student.last_name}` : '—', 'Class': getClassById(p.student?.class_id)?.name || '—', 'Total Fee': p.fee.amount, 'Paid': p.fee.paid_amount || 0, 'Balance': p.balance }));
            exportToExcel(data, 'Carry_Forward_Preview');
        }
        window.exportCarryPreview = exportCarryPreview;

        // ================================================================
