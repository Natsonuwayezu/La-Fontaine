// SECTION 59: PAYMENT REVERSALS
        // ================================================================

        async function renderPaymentReversals(container) {
            await ensureStateLoaded();
            const user = state.currentUser;
            if (user?.role !== 'admin' && user?.role !== 'accountant') { container.innerHTML = '<div class="alert alert-danger">Access denied. Admin or Accountant privileges required.</div>'; return; }
            const payments = [...state.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🔄 Payment Reversals & Refunds</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="window.exportReversalHistory()">📥 Export History</button></div></div>
            <div class="dash-card-body">
                <div class="alert alert-warning"><strong>⚠️ Warning:</strong> Reversing a payment will:<ul style="margin-top:8px; margin-left:20px"><li>Remove the payment from the student's account</li><li>Restore the original fee balances</li><li>Create a reversal record for audit purposes</li><li>This action CANNOT be undone</li></ul></div>
                <div class="filters-bar"><input type="text" id="rev-search" class="form-control flex-1" placeholder="🔍 Search by receipt #, student name..." oninput="window.filterReversalPayments()"><input type="date" id="rev-from" class="form-control" style="width:150px" onchange="window.filterReversalPayments()" title="From date"><input type="date" id="rev-to" class="form-control" style="width:150px" onchange="window.filterReversalPayments()" title="To date"><span class="result-count" id="reversal-count"></span></div>
                <div class="table-wrapper" id="reversal-payments-table"><div class="loading-container"><div class="spinner"></div><p>Loading payments...</p></div></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📜 Reversal History</span></div><div class="dash-card-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Receipt #</th><th>Student</th><th>Amount</th><th>Reason</th><th>Reversed By</th></tr></thead><tbody id="reversals-tbody"><tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr></tbody></table></div></div></div>
    `;
            window.filterReversalPayments = filterReversalPayments;
            window.exportReversalHistory = exportReversalHistory;
            window.reversePayment = reversePayment;
            window.viewReversalDetails = viewReversalDetails;
            await renderPaymentsList();
            await loadReversalHistory();
        }
        window.renderPaymentReversals = renderPaymentReversals;

        async function renderPaymentsList() {
            const container = document.getElementById('reversal-payments-table');
            if (!container) return;
            const payments = [...(state.payments || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
            if (!payments.length) { container.innerHTML = '<div class="alert alert-info">No payments recorded yet.</div>'; return; }
            container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th>Action</th></tr></thead>
            <tbody>
                ${payments.map(p => {
                const student = state.students.find(s => s.id === p.student_id);
                return `<tr>
                        <td><code>${esc(p.receipt_number || '—')}</code></td>
                        <td>${fmtDate(p.payment_date || p.created_at)}</td>
                        <td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td>
                        <td style="text-align:right;font-weight:600">${fmtCurrency(p.amount)}</td>
                        <td><span class="badge badge-info">${esc(p.payment_method || '—')}</span></td>
                        <td><button class="btn btn-sm btn-danger" onclick="window.reversePayment(${p.id})">↩️ Reverse</button></td>
                    </tr>`;
            }).join('')}
            </tbody>
        </table>
    `;
        }
        window.renderPaymentsList = renderPaymentsList;

        async function loadReversalHistory() {
            await filterReversalPayments();
        }
        window.loadReversalHistory = loadReversalHistory;

        async function filterReversalPayments() {
            const search = document.getElementById('rev-search')?.value.toLowerCase();
            const dateFrom = document.getElementById('rev-from')?.value;
            const dateTo = document.getElementById('rev-to')?.value;
            const container = document.getElementById('reversals-tbody');
            if (!container) return;
            let reversals = [];
            try {
                const r = await apiRequest('payment_reversals?order=created_at.desc&limit=500');
                reversals = r.success ? r.data : [];
            } catch (e) { }
            if (dateFrom) reversals = reversals.filter(r => (r.created_at || '') >= dateFrom);
            if (dateTo) reversals = reversals.filter(r => (r.created_at || '') <= dateTo);
            if (search) reversals = reversals.filter(r => {
                const s = state.students.find(x => x.id === r.student_id);
                return (r.original_receipt || '').toLowerCase().includes(search) || (s ? (s.first_name + ' ' + s.last_name).toLowerCase().includes(search) : false);
            });
            if (!reversals.length) { container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No reversals found.</td></tr>'; return; }
            container.innerHTML = reversals.map(rev => {
                const student = state.students.find(s => s.id === rev.student_id);
                return `<tr>
            <td>${fmtDate(rev.created_at)}</td>
            <td><code>${esc(rev.original_receipt || '—')}</code></td>
            <td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td>
            <td style="text-align:right;color:var(--danger)">${fmtCurrency(rev.amount || 0)}</td>
            <td>${esc(rev.reason || '—')}</td>
            <td>${esc(rev.reversed_by || '—')}</td>
        </tr>`;
            }).join('');
        }
        window.filterReversalPayments = filterReversalPayments;

        async function exportReversalHistory() {
            let reversals = [];
            try {
                const r = await apiRequest('payment_reversals?order=created_at.desc&limit=5000');
                reversals = r.success ? r.data : [];
            } catch (e) { }
            const rows = reversals.map(rev => {
                const student = state.students.find(s => s.id === rev.student_id);
                return { 'Date': fmtDate(rev.created_at), 'Receipt': rev.original_receipt || '—', 'Student': student ? student.first_name + ' ' + student.last_name : '—', 'Amount': rev.amount || 0, 'Reason': rev.reason || '', 'By': rev.reversed_by || '' };
            });
            exportToExcel(rows, 'Payment_Reversals_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Reversal history exported', 'success');
        }
        window.exportReversalHistory = exportReversalHistory;

        async function reversePayment(paymentId) {
            const p = (state.payments || []).find(x => x.id === paymentId);
            if (!p) { showToast('Payment not found', 'error'); return; }
            const reason = prompt('Reason for reversal:'); if (!reason) return;
            if (!await confirmDialog(`Reverse payment of ${fmtCurrency(p.amount)} (${p.receipt_number})? Cannot be undone.`)) return;
            const rr = await apiRequest('payment_reversals', 'POST', { student_id: p.student_id, payment_id: p.id, original_receipt: p.receipt_number, amount: p.amount, reason, reversed_by: state.currentUser?.username || state.currentUser?.name || '', created_at: new Date().toISOString() });
            if (!rr.success) { showToast('Failed to create reversal record: ' + rr.error, 'error'); return; }
            await apiRequest('payments?id=eq.' + paymentId, 'DELETE');
            await refreshTable('payments');
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Reversed payment ' + p.receipt_number + ' (' + fmtCurrency(p.amount) + ')', 'finance', paymentId);
            showToast('✅ Payment reversed — ' + p.receipt_number, 'success');
        }
        window.reversePayment = reversePayment;

        async function viewReversalDetails(reversalId) {
            let rev;
            try {
                const r = await apiRequest('payment_reversals?id=eq.' + reversalId);
                rev = r.success && r.data[0] ? r.data[0] : null;
            } catch (e) { }
            if (!rev) { showToast('Reversal not found', 'error'); return; }
            const student = state.students.find(s => s.id === rev.student_id);
            showModal(`<div class="modal-overlay" id="rev-detail-modal"><div class="modal modal-sm"><div class="modal-header"><h3>↩️ Reversal Details</h3><button class="modal-close" onclick="closeModal('rev-detail-modal')">✕</button></div><div class="modal-body"><table class="data-table"><tbody><tr><td><strong>Date</strong></td><td>${fmtDateTime(rev.created_at)}</td></tr><tr><td><strong>Original Receipt</strong></td><td><code>${esc(rev.original_receipt || '—')}</code></td></tr><tr><td><strong>Student</strong></td><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td></tr><tr><td><strong>Amount</strong></td><td>${fmtCurrency(rev.amount || 0)}</td></tr><tr><td><strong>Reason</strong></td><td>${esc(rev.reason || '—')}</td></tr><tr><td><strong>Reversed By</strong></td><td>${esc(rev.reversed_by || '—')}</td></tr></tbody></table></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('rev-detail-modal')">Close</button></div></div></div>`);
        }
        window.viewReversalDetails = viewReversalDetails;

        // ================================================================
