// ================================================================

        async function renderReceipts(container) {
            await ensureStateLoaded();
            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🧾 Receipts</span></div>
            <div class="dash-card-body">
                <div class="alert alert-info">Select a payment to view and print its receipt.</div>
                <div class="form-group" style="max-width:400px"><label>Search Payment / Receipt #</label><input type="text" id="rc-search-full" placeholder="Receipt # or student name..." oninput="window.renderFullReceiptsList()"></div>
                <div id="receipts-list-full" class="table-wrapper" style="margin-top:var(--md)"></div>
            </div>
        </div>
    `;
            window.renderFullReceiptsList = renderFullReceiptsList;
            window.printReceipt = printReceipt;
            renderFullReceiptsList();
        }
        window.renderReceipts = renderReceipts;

        function renderFullReceiptsList(payments) {
            const container = document.getElementById('receipts-list-full');
            if (!container) return;
            payments = payments || state.payments || [];
            const q = document.getElementById('rc-search-full')?.value.toLowerCase() || '';
            const filtered = payments.filter(p => {
                const st = getStudentById(p.student_id);
                return (p.receipt_number || '').toLowerCase().includes(q) || (st ? `${st.first_name} ${st.last_name}`.toLowerCase() : '').includes(q);
            }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
            container.innerHTML = `<table class="data-table"><thead><tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>
        ${filtered.map(p => { const st = getStudentById(p.student_id); return `<tr><td><code>${esc(p.receipt_number || '—')}</code></td><td>${fmtDate(p.payment_date || p.created_at)}</td><td>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</td><td>${fmtCurrency(p.amount)}</td><td>${esc(p.payment_method || '—')}</td><td><button class="btn btn-sm btn-primary" onclick="window.printReceipt(${p.id})">🖨️ Print</button></td></tr>`; }).join('') || `<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No receipts found</td></tr>`}</tbody></table>`;
        }
        window.renderFullReceiptsList = renderFullReceiptsList;

        async function printReceipt(paymentId) {
            const payment = state.payments.find(p => p.id == paymentId);
            if (!payment) { showToast('Payment not found', 'error'); return; }
            const st = getStudentById(payment.student_id);
            const cls = st ? getClassById(st.class_id) : null;
            const school = state.schoolSettings || {};
            const logo = school.school_logo || '🏫';
            const logoHtml = logo.startsWith('data:image') || logo.startsWith('http') ? `<img src="${logo}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">` : `<span style="font-size:40px;">${logo}</span>`;

            const html = `<html><head><style>
        body{font-family:'Inter',Arial,sans-serif;max-width:600px;margin:20px auto;padding:20px;border:2px solid #1a3a5c;border-radius:12px;background:#fff}
        .header{text-align:center;border-bottom:2px solid #1a3a5c;padding-bottom:16px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:16px}
        .school-name{font-size:24px;font-weight:800;color:#1a3a5c}
        .receipt-title{font-size:14px;color:#666;margin-top:4px}
        .receipt-num{font-size:13px;background:#1a3a5c;color:#fff;padding:4px 16px;border-radius:999px;display:inline-block;margin-top:6px}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #ddd;font-size:14px}
        .label{color:#666;font-weight:500}.value{font-weight:600;color:#1a3a5c}
        .total{font-size:22px;font-weight:800;text-align:center;margin:20px 0;padding:16px;background:#d1fae5;border-radius:12px;color:#065f46}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:20px;padding-top:16px;border-top:1px solid #ddd}
        .signatures{display:flex;justify-content:space-between;margin-top:24px;padding-top:16px}
        .sign-line{text-align:center;width:30%}.sign-line div{width:100%;border-top:1px solid #000;margin-top:24px;padding-top:4px;font-size:10px;color:#666}
        @media print{body{margin:0;padding:15px;border:none}}
    </style></head><body>
        <div class="header"><div>${logoHtml}</div><div><div class="school-name">${esc(school.school_name || 'ECOLE LA FONTAINE')}</div><div class="receipt-title">OFFICIAL PAYMENT RECEIPT</div><div class="receipt-num">${esc(payment.receipt_number || 'RCP-' + payment.id)}</div></div></div>
        <div class="row"><span class="label">Date</span><span class="value">${fmtDate(payment.payment_date || payment.created_at)}</span></div>
        <div class="row"><span class="label">Student</span><span class="value">${st ? esc(st.first_name + ' ' + st.last_name) : '—'} (${esc(st?.student_code || '—')})</span></div>
        <div class="row"><span class="label">Class</span><span class="value">${esc(cls?.name || '—')}</span></div>
        <div class="row"><span class="label">Payment Method</span><span class="value">${esc(payment.payment_method || '—')}</span></div>
        ${payment.reference ? `<div class="row"><span class="label">Reference</span><span class="value">${esc(payment.reference)}</span></div>` : ''}
        <div class="total">Amount Paid: ${fmtCurrency(payment.amount)}</div>
        ${payment.notes ? `<p style="font-size:12px;color:#666;margin:12px 0"><strong>Notes:</strong> ${esc(payment.notes)}</p>` : ''}
        <div class="signatures"><div class="sign-line"><div>Student/Parent Signature</div></div><div class="sign-line"><div>Cashier Signature</div></div><div class="sign-line"><div>School Stamp</div></div></div>
        <div class="footer">This is an official receipt from ${esc(school.school_name || 'ECOLE LA FONTAINE')}<br>Generated on ${fmtDateTime(new Date().toISOString())}</div>
    </body></html>`;
            const win = window.open('', '_blank', 'width=700,height=600');
            win.document.write(html);
            win.document.close();
            win.print();
        }
        window.printReceipt = printReceipt;

        // ================================================================
