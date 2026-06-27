// js/modules/payments.js
// Source lines: 18468–19253 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * Record a student payment: select student, select fees to pay,
         * enter amount and method. Generates receipt. Supports partial payments.
         */
        async function renderRecordPayment(el) {
            await ensureStateLoaded();

            // Get pre-selected student from localStorage
            const preselId = localStorage.getItem('elf_pay_student');
            localStorage.removeItem('elf_pay_student');

            const activeStudents = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));

            // Global state for this module
            let selectedFees = new Map();
            let currentStudentId = preselId ? parseInt(preselId) : null;

            // Helper functions (defined first)

            function getSelectedTotal() {
                let total = 0;
                for (const [feeId, selected] of selectedFees.entries()) {
                    if (selected) {
                        const fee = state.studentFees.find(f => f.id === feeId);
                        if (fee) total += (fee.amount - (fee.paid_amount || 0));
                    }
                }
                return total;
            }

            function updateReceiptPreview() {
                const student = state.students.find(s => s.id == currentStudentId);
                const cls = student ? getClassById(student.class_id) : null;
                const amount = parseFloat(document.getElementById('pay-amount')?.value) || 0;
                const method = document.getElementById('pay-method')?.value || '—';
                const previewDiv = document.getElementById('receipt-preview-content');
                if (!previewDiv || !student) return;
                const receiptNum = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
                previewDiv.innerHTML = `<div style="background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:8px;padding:12px;font-size:12px">
                    <div style="text-align:center;margin-bottom:8px"><strong>ECOLE LA FONTAINE</strong><br><small>OFFICIAL PAYMENT RECEIPT</small></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">
                        <span style="color:var(--text-muted)">Receipt #:</span><span><strong>${receiptNum}</strong></span>
                        <span style="color:var(--text-muted)">Date:</span><span>${new Date().toLocaleDateString()}</span>
                        <span style="color:var(--text-muted)">Student:</span><span>${esc(student.first_name)} ${esc(student.last_name)}</span>
                        <span style="color:var(--text-muted)">Class:</span><span>${esc(cls?.name || '—')}</span>
                        <span style="color:var(--text-muted)">Amount:</span><span><strong>${fmtCurrency(amount)}</strong></span>
                        <span style="color:var(--text-muted)">Method:</span><span>${method}</span>
                    </div>
                    ${amount > 0 ? `<div style="text-align:center;margin-top:8px;padding:8px;background:var(--success-bg);border-radius:6px;color:var(--success);font-weight:600">✅ Amount: ${fmtCurrency(amount)}</div>` : ''}
                </div>`;
            }

            function renderFeeTable() {
                if (!currentStudentId) return;
                const { fees, totalCredit } = calculateStudentTotals(currentStudentId);
                const tbody = document.getElementById('record-fee-tbody');
                if (!tbody) return;
                if (fees.length === 0 && totalCredit === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px">No pending fees for this student</td></tr>`;
                    return;
                }
                tbody.innerHTML = fees.map(fee => {
                    const cat = state.feeCategories.find(c => c.id === fee.fee_category_id);
                    const paid = fee.paid_amount || 0;
                    const remaining = fee.amount - paid;
                    const isSelected = selectedFees.get(fee.id) || false;
                    return `<tr>
                        <td style="padding:10px 8px"><strong>${esc(cat?.name || 'Unknown')}</strong></td>
                        <td style="padding:10px 8px;text-align:right">${fmtCurrency(fee.amount)}</td>
                        <td style="padding:10px 8px;text-align:right">${fmtCurrency(paid)}</td>
                        <td style="padding:10px 8px;text-align:right;font-weight:600">${fmtCurrency(remaining)}</td>
                        <td style="padding:10px 8px;text-align:center">
                            <input type="checkbox" data-fee-id="${fee.id}" ${isSelected ? 'checked' : ''} onchange="window.toggleFeeSelection(${fee.id})">
                        </td>
                    </tr>`;
                }).join('');

                const totalRow = document.getElementById('record-fee-total');
                if (totalRow) {
                    totalRow.innerHTML = `<td colspan="3" style="padding:10px 8px;font-weight:700">TOTAL SELECTED</td>
                        <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--role-primary)">${fmtCurrency(getSelectedTotal())}</td>
                        <td style="padding:10px 8px"></td>`;
                }
                const amountInput = document.getElementById('pay-amount');
                if (amountInput) amountInput.max = getSelectedTotal();
            }

            // Register global functions BEFORE HTML is rendered
            window.onStudentChangeForPayment = function () {
                const studentId = document.getElementById('pay-student')?.value;
                if (!studentId) {
                    document.getElementById('record-fee-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">Select a student to view fees</td></tr>';
                    document.getElementById('pay-student-class').value = '';
                    return;
                }
                currentStudentId = parseInt(studentId);
                selectedFees.clear();
                const student = state.students.find(s => s.id == currentStudentId);
                const cls = student ? getClassById(student.class_id) : null;
                document.getElementById('pay-student-class').value = cls?.name || '—';
                renderFeeTable();
                updateReceiptPreview();
            };

            window.toggleFeeSelection = function (feeId) {
                const current = selectedFees.get(feeId) || false;
                if (current) selectedFees.delete(feeId);
                else selectedFees.set(feeId, true);
                renderFeeTable();
                updateReceiptPreview();
            };

            window.selectAllFees = function () {
                const { fees } = calculateStudentTotals(currentStudentId);
                for (const fee of fees) selectedFees.set(fee.id, true);
                renderFeeTable();
                updateReceiptPreview();
            };

            window.updateReceiptPreviewFromPayment = function () { updateReceiptPreview(); };

            window.resetPaymentForm = function () {
                document.getElementById('pay-amount').value = '';
                document.getElementById('pay-ref').value = '';
                document.getElementById('pay-notes').value = '';
                selectedFees.clear();
                if (currentStudentId) renderFeeTable();
                showToast('Form cleared', 'info', 1500);
            };

            window.submitRecordPayment = async function () { await processPayment(false); };
            window.submitAndPrintPayment = async function () { await processPayment(true); };

            async function processPayment(printAfter = false) {
                if (!currentStudentId) { showToast('Please select a student', 'warning'); return; }
                const amount = parseFloat(document.getElementById('pay-amount')?.value);
                const date = document.getElementById('pay-date')?.value;
                const method = document.getElementById('pay-method')?.value;
                const ref = document.getElementById('pay-ref')?.value || null;
                const notes = document.getElementById('pay-notes')?.value || null;
                if (!date) { showToast('Please select a payment date', 'warning'); return; }
                if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'warning'); return; }

                const selectedFeeIds = [];
                for (const [feeId, selected] of selectedFees.entries()) if (selected) selectedFeeIds.push(feeId);
                if (selectedFeeIds.length === 0) { showToast('Please select at least one fee to pay', 'warning'); return; }

                const student = state.students.find(s => s.id == currentStudentId);
                const receiptNum = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(state.payments.length + 1).padStart(4, '0')}`;

                const payment = await insert('payments', {
                    student_id: currentStudentId, amount: amount, payment_date: date,
                    payment_method: method, receipt_number: receiptNum, reference: ref, notes: notes,
                    recorded_by: state.currentUser?.id || null, created_at: new Date().toISOString()
                });
                if (!payment) { showToast('Failed to record payment', 'error'); return; }

                let remainingAmount = amount;
                const sortedFees = selectedFeeIds.map(id => state.studentFees.find(f => f.id === id)).filter(f => f)
                    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

                for (const fee of sortedFees) {
                    if (remainingAmount <= 0) break;
                    const feeRemaining = fee.amount - (fee.paid_amount || 0);
                    const allocation = Math.min(remainingAmount, feeRemaining);
                    if (allocation > 0) {
                        await update('student_fees', fee.id, {
                            paid_amount: (fee.paid_amount || 0) + allocation,
                            is_paid: (fee.paid_amount || 0) + allocation >= fee.amount,
                            updated_at: new Date().toISOString()
                        });
                        remainingAmount -= allocation;
                    }
                }

                if (remainingAmount > 0) {
                    await insert('student_fees', {
                        student_id: currentStudentId, fee_category_id: null, term_id: state.currentTerm?.id,
                        academic_year_id: state.currentAcadYear?.id, amount: 0, paid_amount: remainingAmount,
                        is_paid: false, is_waived: false, is_credit: true, credit_amount: remainingAmount,
                        notes: `Overpayment credit from receipt ${receiptNum}`, created_at: new Date().toISOString()
                    });
                    showToast(`⚠️ ${fmtCurrency(remainingAmount)} credit created`, 'warning');
                }

                await refreshTable('payments');
                await refreshTable('student_fees');
                showToast(`✅ Payment of ${fmtCurrency(amount)} recorded (${receiptNum})`, 'success');

                if (printAfter) {
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:Arial;padding:20px;max-width:600px;margin:0 auto}.receipt{border:1px solid #ccc;padding:20px;border-radius:8px}.row{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:20px;font-weight:bold;text-align:center;margin:15px 0;padding:10px;background:#d1fae5;border-radius:8px}</style></head><body>
                    <div class="receipt"><h2 style="text-align:center">🏫 ECOLE LA FONTAINE</h2><p style="text-align:center">OFFICIAL PAYMENT RECEIPT</p><hr>
                    <div class="row"><span>Receipt #:</span><strong>${receiptNum}</strong></div>
                    <div class="row"><span>Date:</span><strong>${date}</strong></div>
                    <div class="row"><span>Student:</span><strong>${student?.first_name} ${student?.last_name}</strong></div>
                    <div class="row"><span>Amount:</span><strong>${fmtCurrency(amount)}</strong></div>
                    <div class="row"><span>Method:</span><strong>${method}</strong></div>
                    ${ref ? `<div class="row"><span>Reference:</span><strong>${ref}</strong></div>` : ''}
                    <div class="total">${fmtCurrency(amount)}</div>
                    <p style="text-align:center;font-size:11px;color:#666">Thank you for your payment</p></div>
                    <script>window.print();setTimeout(function(){window.close();},500);<\/script></body></html>`);
                    printWindow.document.close();
                }
                resetPaymentForm();
            }

            // RENDER HTML
            el.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><span class="dash-card-title">💸 RECORD PAYMENT</span>
                        <button class="modal-close" style="position:static" onclick="navigateTo('payment-history')">✕</button>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid" style="margin-bottom:20px">
                            <div class="form-group"><label>Student *</label>
                                <select id="pay-student" onchange="window.onStudentChangeForPayment()">
                                    <option value="">— Select student —</option>
                                    ${activeStudents.map(s => `<option value="${s.id}" ${s.id == preselId ? 'selected' : ''}>${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || 'STU')}) - ${esc(getClassById(s.class_id)?.name || '?')}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group"><label>Class</label><input type="text" id="pay-student-class" readonly style="background:var(--bg-tertiary)"></div>
                        </div>

                        <div style="margin-bottom:20px">
                            <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                                <strong>📋 FEE CATEGORIES</strong>
                                <button class="btn btn-sm btn-outline" onclick="window.selectAllFees()">✓ Select All</button>
                            </div>
                            <div class="table-wrapper"><table class="data-table" style="width:100%">
                                <thead><tr><th>Fee Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Remaining</th><th style="text-align:center">Select</th></tr></thead>
                                <tbody id="record-fee-tbody"><tr><td colspan="5" style="text-align:center;padding:40px">Select a student to view fees</td></tr></tbody>
                                <tfoot id="record-fee-total"><tr><td colspan="3"><strong>TOTAL SELECTED</strong></td><td style="text-align:right"><strong>0 RWF</strong></td><td></td></tr></tfoot>
                            </table></div>
                        </div>

                        <div style="margin-bottom:20px">
                            <strong>💳 PAYMENT DETAILS</strong>
                            <div class="form-grid">
                                <div class="form-group"><label>Amount Paid *</label><input type="number" id="pay-amount" min="0" step="1000" placeholder="Enter amount" oninput="window.updateReceiptPreviewFromPayment()"></div>
                                <div class="form-group"><label>Payment Date *</label><input type="date" id="pay-date" value="${new Date().toISOString().split('T')[0]}"></div>
                                <div class="form-group"><label>Payment Method</label><select id="pay-method" onchange="window.updateReceiptPreviewFromPayment()"><option>Cash</option><option>Mobile-Money</option><option>Bank Transfer</option><option>Cheque</option></select></div>
                                <div class="form-group"><label>Reference</label><input type="text" id="pay-ref" placeholder="Optional"></div>
                                <div class="form-group full"><label>Notes</label><textarea id="pay-notes" rows="2" placeholder="Optional"></textarea></div>
                            </div>
                        </div>

                        <div style="margin-bottom:20px">
                            <strong>🧾 RECEIPT PREVIEW</strong>
                            <div id="receipt-preview-content"><div style="text-align:center;padding:20px;color:var(--text-muted)">Select a student and enter amount</div></div>
                        </div>

                        <div class="btn-group" style="justify-content:flex-end">
                            <button class="btn btn-outline" onclick="window.resetPaymentForm()">🗑️ Clear</button>
                            <button class="btn btn-success" onclick="window.submitRecordPayment()">✅ Record Payment</button>
                            <button class="btn btn-primary" onclick="window.submitAndPrintPayment()">📄 Record & Print</button>
                        </div>
                    </div>
                </div>
            `;

            if (preselId) setTimeout(() => { if (window.onStudentChangeForPayment) window.onStudentChangeForPayment(); }, 100);
        }


        /**
         * All payment records with filters: student, class, date range, method.
         * Totals and export to Excel.
         */
        async function renderPaymentHistory(container) {
            await ensureStateLoaded();

            const sorted = [...(state.payments || [])].sort((a, b) =>
                new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at)
            );

            const regularPayments = sorted.filter(p => !p.is_credit_payment && !p.is_credit_addition);
            const creditPayments = sorted.filter(p => p.is_credit_payment === true);
            const creditAdditions = sorted.filter(p => p.is_credit_addition === true);

            const totalRegular = regularPayments.reduce((a, p) => a + p.amount, 0);
            const totalCreditUsed = creditPayments.reduce((a, p) => a + p.amount, 0);
            const totalCreditAdded = creditAdditions.reduce((a, p) => a + p.amount, 0);

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">📜 Payment History</span>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline" onclick="window.exportFullPaymentHistory()">📥 Export</button>
                                </div>
                            </div>
                            <div class="dash-card-body">
                                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
                                    <div class="stat-card" style="padding:12px"><div class="stat-value">${fmtCurrency(totalRegular)}</div><div class="stat-label">Cash Payments</div></div>
                                    <div class="stat-card" style="padding:12px;background:var(--info-bg)"><div class="stat-value">${fmtCurrency(totalCreditUsed)}</div><div class="stat-label">💰 Credit Used</div></div>
                                    <div class="stat-card" style="padding:12px;background:var(--success-bg)"><div class="stat-value">${fmtCurrency(totalCreditAdded)}</div><div class="stat-label">⭐ Credit Added</div></div>
                                    <div class="stat-card" style="padding:12px"><div class="stat-value">${fmtCurrency(totalRegular + totalCreditUsed)}</div><div class="stat-label">Total Collection</div></div>
                                </div>
                                <div class="filters-bar">
                                    <input type="text" class="flex-1" id="ph-search" placeholder="🔍 Search student or receipt..." oninput="window.filterPaymentHistoryTable()">
                                    <span class="result-count">${sorted.length} transactions — Total: ${fmtCurrency(sorted.reduce((a, p) => a + p.amount, 0))}</span>
                                </div>
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead><tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Class</th><th>Amount</th><th>Method</th><th>Type</th><th>Action</th></tr></thead>
                                        <tbody id="ph-tbody">
                                            ${sorted.map(p => {
                const st = getStudentById(p.student_id);
                let typeBadge = '', typeText = '';
                if (p.is_credit_payment === true) { typeBadge = 'badge-info'; typeText = '💰 Credit Used'; }
                else if (p.is_credit_addition === true) { typeBadge = 'badge-success'; typeText = '⭐ Credit Added'; }
                else { typeBadge = 'badge-primary'; typeText = '💵 Cash Payment'; }
                return `
                                                    <tr>
                                                        <td><code>${esc(p.receipt_number || '—')}</code></span>
                                                        <td>${fmtDate(p.payment_date || p.created_at)}</span>
                                                        <td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</span>
                                                        <td>${esc(getClassById(st?.class_id)?.name || '—')}</span>
                                                        <td><strong>${fmtCurrency(p.amount)}</strong></span>
                                                        <td>${esc(p.payment_method || '—')}</span>
                                                        <td><span class="badge ${typeBadge}">${typeText}</span></span>
                                                        <td><button class="btn btn-sm btn-outline" onclick="window.printReceiptById(${p.id})">🧾 Receipt</button></span>
                                                    </tr>
                                                `;
            }).join('') || '<tr><td colspan="8" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No payments recorded</span>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;

            window.filterPaymentHistoryTable = filterPaymentHistoryTable;
            window.exportFullPaymentHistory = exportFullPaymentHistory;
        }


        /**
         * Print or re-print a payment receipt. Thermal-style format with
         * school logo, fee breakdown, and four signature slots.
         */
        async function renderReceiptPrinting(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const isTeacher = user?.role === 'teacher';

            if (isTeacher) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot print receipts.</div>';
                return;
            }

            const payments = [...state.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🧾 Receipt Printing</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.bulkPrintReceipts()">📄 Bulk Print</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportReceiptsList()">📥 Export List</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <input type="text" id="rec-search" class="form-control flex-1" placeholder="🔍 Search by receipt #, student name..." oninput="window.filterReceipts()">
                            <input type="date" id="rec-from" class="form-control" style="width:150px" onchange="window.filterReceipts()" title="From date">
                            <input type="date" id="rec-to" class="form-control" style="width:150px" onchange="window.filterReceipts()" title="To date">
                            <select id="receipt-method-filter" class="form-control" style="width:150px" onchange="window.filterReceipts()">
                                <option value="">All Methods</option>
                                <option value="Cash">Cash</option>
                                <option value="Mobile-Money">Mobile-Money</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                            <span class="result-count" id="receipt-count"></span>
                        </div>

                        <div class="table-wrapper" id="receipts-list-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading receipts...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Receipt Settings</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Default Receipt Format</label>
                                <select id="receipt-format" class="form-control" onchange="window.saveReceiptSetting()">
                                    <option value="standard" ${localStorage.getItem('receipt_format') === 'standard' || !localStorage.getItem('receipt_format') ? 'selected' : ''}>Standard</option>
                                    <option value="compact" ${localStorage.getItem('receipt_format') === 'compact' ? 'selected' : ''}>Compact</option>
                                    <option value="detailed" ${localStorage.getItem('receipt_format') === 'detailed' ? 'selected' : ''}>Detailed</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Include School Logo</label>
                                <select id="receipt-logo" class="form-control" onchange="window.saveReceiptSetting()">
                                    <option value="yes" ${localStorage.getItem('receipt_include_logo') !== 'no' ? 'selected' : ''}>Yes</option>
                                    <option value="no" ${localStorage.getItem('receipt_include_logo') === 'no' ? 'selected' : ''}>No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Include Signatures</label>
                                <select id="receipt-signatures" class="form-control" onchange="window.saveReceiptSetting()">
                                    <option value="yes" ${localStorage.getItem('receipt_include_signatures') !== 'no' ? 'selected' : ''}>Yes</option>
                                    <option value="no" ${localStorage.getItem('receipt_include_signatures') === 'no' ? 'selected' : ''}>No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Auto-print after payment</label>
                                <select id="receipt-auto-print" class="form-control" onchange="window.saveReceiptSetting()">
                                    <option value="yes" ${localStorage.getItem('receipt_auto_print') === 'yes' ? 'selected' : ''}>Yes</option>
                                    <option value="no" ${localStorage.getItem('receipt_auto_print') !== 'yes' ? 'selected' : ''}>No</option>
                                </select>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="window.previewReceiptSettings()">👁️ Preview Settings</button>
                    </div>
                </div>
            `;

            window.filterReceipts = filterReceipts;
            window.bulkPrintReceipts = bulkPrintReceipts;
            window.exportReceiptsList = exportReceiptsList;
            window.printReceipt = printReceipt;
            window.saveReceiptSetting = saveReceiptSetting;
            window.previewReceiptSettings = previewReceiptSettings;

            await renderReceiptsList();
        }


        /**
         * Browse and search all receipts. Click to view/print.
         */
        async function renderReceipts(container) {
            await ensureStateLoaded();

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">🧾 Receipts</span>
                            </div>
                            <div class="dash-card-body">
                                <div class="alert alert-info">Select a payment to view and print its receipt.</div>
                                <div class="form-group" style="max-width:400px">
                                    <label>Search Payment / Receipt #</label>
                                    <input type="text" id="rc-search-full" placeholder="Receipt # or student name..." oninput="window.renderFullReceiptsList()">
                                </div>
                                <div id="receipts-list-full" class="table-wrapper" style="margin-top:var(--md)"></div>
                            </div>
                        </div>
                    `;

            window.renderFullReceiptsList = renderFullReceiptsList;
            window.printReceipt = printReceipt;

            renderFullReceiptsList();
        }


        /**
         * Reverse/void a payment. Requires admin confirmation.
         * Restores the fee balance and logs the reversal.
         */
        async function renderPaymentReversals(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin' && user?.role !== 'accountant') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin or Accountant privileges required.</div>';
                return;
            }

            const payments = [...state.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔄 Payment Reversals & Refunds</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportReversalHistory()">📥 Export History</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-warning">
                            <strong>⚠️ Warning:</strong> Reversing a payment will:
                            <ul style="margin-top:8px; margin-left:20px">
                                <li>Remove the payment from the student's account</li>
                                <li>Restore the original fee balances</li>
                                <li>Create a reversal record for audit purposes</li>
                                <li>This action CANNOT be undone</li>
                            </ul>
                        </div>

                        <div class="filters-bar">
                            <input type="text" id="rev-search" class="form-control flex-1" placeholder="🔍 Search by receipt #, student name..." oninput="window.filterReversalPayments()">
                            <input type="date" id="rev-from" class="form-control" style="width:150px" onchange="window.filterReversalPayments()" title="From date">
                            <input type="date" id="rev-to" class="form-control" style="width:150px" onchange="window.filterReversalPayments()" title="To date">
                            <span class="result-count" id="reversal-count"></span>
                        </div>

                        <div class="table-wrapper" id="reversal-payments-table">
                            <div class="loading-container"><div class="spinner"></div><p>Loading payments...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📜 Reversal History</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Date</th><th>Receipt #</th><th>Student</th><th>Amount</th><th>Reason</th><th>Reversed By</th></tr></thead>
                                <tbody id="reversals-tbody">
                                    <tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            window.filterReversalPayments = filterReversalPayments;
            window.exportReversalHistory = exportReversalHistory;
            window.reversePayment = reversePayment;
            window.viewReversalDetails = viewReversalDetails;

            await renderPaymentsList();
            await loadReversalHistory();
        }

        /**
         * Renders recent payments (most recent 100) into #reversal-payments-table
         * with a "Reverse" button per row, so an admin/accountant can find and
         * reverse a specific payment.
         */
        async function renderPaymentsList() {
            const container = document.getElementById('reversal-payments-table');
            if (!container) return;
            const payments = [...(state.payments || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
            if (!payments.length) {
                container.innerHTML = '<div class="alert alert-info">No payments recorded yet.</div>';
                return;
            }
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

        /**
         * Initial (unfiltered) load of the reversal history table — delegates
         * to filterReversalPayments() since the search/date inputs start
         * empty, which already produces the full unfiltered list.
         */
        async function loadReversalHistory() {
            await filterReversalPayments();
        }


        /**
         * List all students with outstanding balances older than current term.
         * Send reminders and export overdue list.
         */
        async function renderOverduePayments(container) {
            await ensureStateLoaded();

            const overdueList = [];
            for (const student of (state.students || []).filter(s => s.status === 'Active')) {
                const fees = (state.studentFees || []).filter(f => f.student_id === student.id && !f.is_paid && !f.is_waived);
                const oldest = fees.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))[0];
                if (oldest?.due_date) {
                    const days = Math.ceil((Date.now() - new Date(oldest.due_date)) / 86400000);
                    if (days >= 7) {
                        const balance = await getFullStudentBalance(student.id);
                        overdueList.push({ student, balance, days, cls: getClassById(student.class_id), oldestFee: oldest });
                    }
                }
            }
            overdueList.sort((a, b) => b.days - a.days);

            const critical = overdueList.filter(o => o.days >= 30);
            const warning = overdueList.filter(o => o.days >= 15 && o.days < 30);
            const mild = overdueList.filter(o => o.days >= 7 && o.days < 15);

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="btn-group" style="margin-bottom:16px; padding:0 16px; padding-top:16px">
                                <button class="btn btn-primary" onclick="window.openBulkPaymentModal()">💰 Bulk Record Payments</button>
                                <button class="btn btn-outline" onclick="window.exportBulkPaymentTemplate()">📥 Download Template</button>
                            </div>
                            <div class="dash-card-header">
                                <span class="dash-card-title">⚠️ Overdue Payments</span>
                                <span class="result-count">${overdueList.length} students with overdue fees (7+ days)</span>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                ${critical.length > 0 ? `
                                    <div style="background:var(--danger-bg);padding:12px 16px;"><strong>🔴 CRITICAL (${critical.length} students - 30+ days)</strong></div>
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></tr></thead>
                                            <tbody>
                                                ${critical.map(({ student, balance, days, cls, oldestFee }) => `
                                                    <tr>
                                                        <td><strong>${esc(student.first_name + ' ' + student.last_name)}</strong></td>
                                                        <td>${esc(cls?.name || '—')}</td>
                                                        <td>${fmtCurrency(balance.balance)}</span></td>
                                                        <td><span class="overdue-critical">${days} days 🔴</span></td>
                                                        <td>${fmtDate(oldestFee.due_date)}</span></td>
                                                        <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${student.id})">💰 Pay Now</button></span>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                                ${warning.length > 0 ? `
                                    <div style="background:var(--warning-bg);padding:12px 16px;margin-top:16px;"><strong>🟠 WARNING (${warning.length} students - 15-29 days)</strong></div>
                                    <div class="table-wrapper">
                                        <table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></tr></thead>
                                        <tbody>${warning.map(({ student, balance, days, cls, oldestFee }) => `
                                            <tr>
                                                <td><strong>${esc(student.first_name + ' ' + student.last_name)}</strong></td>
                                                <td>${esc(cls?.name || '—')}</td>
                                                <td>${fmtCurrency(balance.balance)}</span></td>
                                                <td><span class="overdue-warning">${days} days 🟠</span></td>
                                                <td>${fmtDate(oldestFee.due_date)}</span></td>
                                                <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${student.id})">💰 Pay Now</button></span>
                                            </tr>`).join('')}
                                        </tbody></table></div>
                                ` : ''}
                                ${mild.length > 0 ? `
                                    <div style="background:var(--info-bg);padding:12px 16px;margin-top:16px;"><strong>🟡 MILD (${mild.length} students - 7-14 days)</strong></div>
                                    <div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Balance</th><th>Days Overdue</th><th>Due Date</th><th>Action</th></td></thead>
                                    <tbody>${mild.map(({ student, balance, days, cls, oldestFee }) => `
                                        <tr>
                                            <td><strong>${esc(student.first_name + ' ' + student.last_name)}</strong></td>
                                            <td>${esc(cls?.name || '—')}</td>
                                            <td>${fmtCurrency(balance.balance)}</span></td>
                                            <td><span class="overdue-mild">${days} days 🟡</span></td>
                                            <td>${fmtDate(oldestFee.due_date)}</span></td>
                                            <td><button class="btn btn-sm btn-primary" onclick="window.openRecordPaymentForStudent(${student.id})">💰 Pay Now</button></span>
                                        </tr>`).join('')}
                                    </tbody></table></div>
                                ` : ''}
                                ${overdueList.length === 0 ? `<div class="alert alert-success" style="margin:16px">🎉 No overdue payments! All fees are up to date.</div>` : ''}
                            </div>
                        </div>
                    `;

            window.openBulkPaymentModal = openBulkPaymentModal;
            window.openRecordPaymentForStudent = openRecordPaymentForStudent;
            window.exportBulkPaymentTemplate = exportBulkPaymentTemplate;
        }


        /**
         * Admin tool to manually adjust a student's fee balance.
         * Fully logged to the activity log.
         */
        async function renderManualAdjustments(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Teachers cannot make manual adjustments.</div>';
                return;
            }

            const students = state.students.filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const categories = state.feeCategories.filter(c => c.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">⚙️ Manual Balance Adjustments</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-warning">
                            <strong>⚠️ Warning:</strong> Manual adjustments directly modify student balances. 
                            All changes are logged for audit purposes.
                        </div>

                        <div class="form-grid">
                            <div class="form-group full">
                                <label>Select Student</label>
                                <select id="adj-student" class="form-control" onchange="window.loadStudentBalanceInfo()">
                                    <option value="">-- Select Student --</option>
                                    ${students.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div id="student-balance-info" style="display:none; margin:16px 0; padding:12px; background:var(--bg-tertiary); border-radius:8px"></div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>Adjustment Type</label>
                                <select id="adj-type" class="form-control" onchange="window.toggleAdjustmentFields()">
                                    <option value="add_fee">➕ Add Fee (Increase Balance)</option>
                                    <option value="add_payment">💰 Add Payment (Decrease Balance)</option>
                                    <option value="add_credit">⭐ Add Credit (Overpayment/Refund)</option>
                                    <option value="waive_fee">🎁 Waive Fee (Remove from Balance)</option>
                                    <option value="adjust_balance">📊 Direct Balance Adjustment</option>
                                </select>
                            </div>
                            <div class="form-group" id="adj-fee-category-group" style="display:none">
                                <label>Fee Category</label>
                                <select id="adj-fee-category" class="form-control">
                                    <option value="">-- Select Fee Category --</option>
                                    ${categories.map(c => `<option value="${c.id}">${esc(c.name)} (${fmtCurrency(c.amount || 0)} default)</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" id="adj-term-group" style="display:none">
                                <label>Term</label>
                                <select id="adj-term" class="form-control">
                                    ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Amount (RWF)</label>
                                <input type="number" id="adj-amount" class="form-control" min="0" step="1000" placeholder="Enter amount">
                            </div>
                            <div class="form-group full" id="adj-reason-group">
                                <label>Reason / Notes *</label>
                                <textarea id="adj-reason" class="form-control" rows="2" placeholder="Provide reason for this adjustment..."></textarea>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:20px">
                            <button class="btn btn-danger" onclick="window.submitManualAdjustment()">⚠️ Apply Adjustment</button>
                            <button class="btn btn-outline" onclick="window.resetAdjustmentForm()">🗑️ Clear Form</button>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📜 Recent Adjustments</span>
                        <button class="btn btn-sm btn-outline" onclick="window.loadAdjustmentHistory()">🔄 Refresh</button>
                    </div>
                    <div class="dash-card-body">
                        <div id="adjustment-history" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Loading adjustment history...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.loadStudentBalanceInfo = loadStudentBalanceInfo;
            window.toggleAdjustmentFields = toggleAdjustmentFields;
            window.submitManualAdjustment = submitManualAdjustment;
            window.resetAdjustmentForm = resetAdjustmentForm;
            window.loadAdjustmentHistory = loadAdjustmentHistory;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 41 — FINANCE: FEE STRUCTURE & ASSIGNMENTS
