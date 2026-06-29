// js/modules/receipt-printing.js
// Receipt Printing Module - Print and manage payment receipts


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
                    <input type="text" id="receipt-search" class="form-control flex-1" placeholder="🔍 Search by receipt #, student name, date..." oninput="window.filterReceipts()">
                    <select id="receipt-method-filter" class="form-control" style="width:150px" onchange="window.filterReceipts()">
                        <option value="">All Methods</option>
                        <option value="Cash">Cash</option>
                        <option value="Mobile-Money">Mobile-Money</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                    <span class="result-count" id="receipt-count"></span>
                </div>
                
                <div class="table-wrapper" id="receipts-list">
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

async function renderReceiptsList() {
    let payments = [...state.payments];
    payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    window._allReceipts = payments;
    filterReceipts();
}

function filterReceipts() {
    const search = document.getElementById('receipt-search')?.value.toLowerCase();
    const methodFilter = document.getElementById('receipt-method-filter')?.value;
    const container = document.getElementById('receipts-list');

    let filtered = window._allReceipts || [];

    if (search) {
        filtered = filtered.filter(p => {
            const st = getStudentById(p.student_id);
            return (p.receipt_number || '').toLowerCase().includes(search) ||
                (st?.first_name?.toLowerCase() || '').includes(search) ||
                (st?.last_name?.toLowerCase() || '').includes(search) ||
                (p.payment_date || '').includes(search);
        });
    }
    if (methodFilter) filtered = filtered.filter(p => p.payment_method === methodFilter);

    const countSpan = document.getElementById('receipt-count');
    if (countSpan) countSpan.textContent = `${filtered.length} receipt${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No receipts found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th style="text-align:right">Amount</th>
                    <th>Method</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(p => {
        const st = getStudentById(p.student_id);
        const cls = st ? getClassById(st.class_id) : null;
        return `
                        <tr>
                            <td><code><strong>${esc(p.receipt_number || '—')}</strong></code></span>
                            <td>${fmtDate(p.payment_date || p.created_at)}</span>
                            <td><strong>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</strong></span>
                            <td>${esc(cls?.name || '—')}</span>
                            <td style="text-align:right; font-weight:700">${fmtCurrency(p.amount)}</span>
                            <td>${esc(p.payment_method || '—')}</span>
                            <td style="text-align:center">
                                <div class="btn-group" style="gap:4px; justify-content:center">
                                    <button class="btn btn-sm btn-primary" onclick="window.printReceipt(${p.id})">🖨️ Print</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.printReceipt(${p.id}, true)">📄 PDF</button>
                                </div>
                            </span>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

async function printReceipt(paymentId, asPdf = false) {
    const payment = state.payments.find(p => p.id == paymentId) ||
        (await getAll('payments').catch(() => [])).find(p => p.id == paymentId);
    if (!payment) { showToast('Payment not found', 'error'); return; }

    const st = getStudentById(payment.student_id);
    const cls = st ? getClassById(st.class_id) : null;
    const school = state.schoolSettings || {};
    const logo = school.school_logo || '';
    const includeLogo = localStorage.getItem('receipt_include_logo') !== 'no';
    const includeSignatures = localStorage.getItem('receipt_include_signatures') !== 'no';
    const format = localStorage.getItem('receipt_format') || 'standard';

    let logoHtml = '';
    if (includeLogo && logo && (logo.startsWith('data:') || logo.startsWith('http'))) {
        logoHtml = `<img src="${logo}" style="width:50px;height:50px;object-fit:contain;border-radius:8px" onerror="this.style.display='none'">`;
    }

    // Get payment allocations
    let allocations = [];
    try { allocations = await getAll('payment_allocations', { payment_id: paymentId }); } catch (e) { }

    let feeRows = '';
    if (allocations.length > 0) {
        feeRows = allocations.map(a => {
            const fee = state.studentFees.find(f => f.id === a.student_fee_id);
            const cat = fee ? state.feeCategories.find(c => c.id === fee.fee_category_id) : null;
            return `
                <tr>
                    <td style="padding:4px 0">${esc(cat?.name || 'Fee Payment')}</span>
                    <td class="tr">${fmtCurrency(a.amount)}</span>
                </tr>
            `;
        }).join('');
    } else {
        feeRows = `
            <tr>
                <td style="padding:4px 0">Payment Received</span>
                <td class="tr">${fmtCurrency(payment.amount)}</span>
            </tr>
        `;
    }

    const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Receipt ${payment.receipt_number}</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box}
                body{background:#e2e8f0;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:'Courier New',Monaco,monospace}
                .receipt{width:350px;background:#fff;border:1px solid #ccc;border-radius:8px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,.1);font-size:10px;line-height:1.4}
                .header{text-align:center;margin-bottom:12px}
                .school-name{font-size:14px;font-weight:800;text-transform:uppercase}
                .receipt-title{font-size:10px;font-weight:700;letter-spacing:1px;margin:4px 0}
                .receipt-num{font-size:9px;background:#f0f4f8;display:inline-block;padding:2px 10px;border-radius:4px;margin:6px 0}
                .divider{border-top:1px dashed #999;margin:8px 0}
                .row{display:flex;justify-content:space-between;margin:4px 0}
                .label{font-weight:700;color:#555}
                .fee-table{width:100%;border-collapse:collapse;margin:8px 0}
                .fee-table td{padding:2px 0}
                .tr{text-align:right}
                .total{font-size:12px;font-weight:800;color:#065f46;margin-top:8px;padding-top:6px;border-top:2px solid #000}
                .signatures{display:flex;justify-content:space-between;margin-top:16px;padding-top:8px}
                .sign-line{text-align:center;width:45%}
                .sign-line .line{border-top:1px solid #000;margin-top:20px;padding-top:4px;font-size:7px}
                .footer{text-align:center;font-size:7px;color:#888;margin-top:12px;padding-top:8px;border-top:1px solid #ddd}
                .print-btn{margin-top:16px;background:#1a3a5c;color:#fff;border:none;padding:8px 20px;border-radius:30px;font-size:12px;cursor:pointer}
                @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border:1px solid #000;width:100%}.print-btn{display:none}@page{size:A6;margin:8mm}}
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    ${includeLogo && logoHtml ? `<div>${logoHtml}</div>` : ''}
                    <div class="school-name">${esc(school.school_name || 'ECOLE LA FONTAINE')}</div>
                    <div>${esc(school.school_location || 'Rubavu, Rwanda')}</div>
                    <div class="receipt-title">OFFICIAL PAYMENT RECEIPT</div>
                    <div class="receipt-num">${esc(payment.receipt_number || 'RCP-' + payment.id)}</div>
                </div>
                <div class="divider"></div>
                <div class="row"><span class="label">Date:</span><span>${fmtDate(payment.payment_date || payment.created_at)}</span></div>
                <div class="row"><span class="label">Student:</span><span><strong>${st ? esc(st.first_name + ' ' + st.last_name) : '—'}</strong></span></div>
                <div class="row"><span class="label">Student Code:</span><span>${esc(st?.student_code || '—')}</span></div>
                <div class="row"><span class="label">Class:</span><span>${esc(cls?.name || '—')}</span></div>
                ${st?.guardian_name ? `<div class="row"><span class="label">Guardian:</span><span>${esc(st.guardian_name)}</span></div>` : ''}
                <div class="divider"></div>
                <div class="row"><span class="label">Payment Method:</span><span>${esc(payment.payment_method || '—')}</span></div>
                ${payment.reference ? `<div class="row"><span class="label">Reference:</span><span>${esc(payment.reference)}</span></div>` : ''}
                <div class="row"><span class="label">Recorded By:</span><span>${esc(state.teachers.find(t => t.id === payment.recorded_by)?.name || 'Cashier')}</span></div>
                <div class="divider"></div>
                <table class="fee-table">
                    <thead><tr><th>Description</th><th class="tr">Amount</th></tr></thead>
                    <tbody>${feeRows}</tbody>
                    <tfoot><tr><td class="tr"><strong>TOTAL PAID:</strong></td><td class="tr"><strong>${fmtCurrency(payment.amount)}</strong></td></tr></tfoot>
                </table>
                ${includeSignatures ? `
                    <div class="signatures">
                        <div class="sign-line"><div class="line">Parent/Guardian</div></div>
                        <div class="sign-line"><div class="line">Cashier</div></div>
                    </div>
                ` : ''}
                <div class="footer">
                    ${esc(school.report_footer_line1 || 'Thank you for your payment')}<br>
                    Generated: ${fmtDateTime(new Date().toISOString())}
                </div>
            </div>
            <button class="print-btn" onclick="window.print()">🖨️ Print Receipt</button>
            <script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
        </body>
        </html>
    `;

    if (asPdf && typeof html2pdf !== 'undefined') {
        const element = document.createElement('div');
        element.innerHTML = receiptHtml;
        html2pdf().set({
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `Receipt_${payment.receipt_number}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: [80, 148], orientation: 'portrait' }
        }).from(element).save();
    } else {
        const win = window.open('', '_blank', 'width=450,height=600,scrollbars=yes');
        if (!win) { showToast('Pop-up blocked — please allow pop-ups', 'warning'); return; }
        win.document.write(receiptHtml);
        win.document.close();
    }
}

function bulkPrintReceipts() {
    const selected = [];
    const checkboxes = document.querySelectorAll('#receipts-list input[type="checkbox"]:checked');
    checkboxes.forEach(cb => selected.push(parseInt(cb.value)));

    if (selected.length === 0) {
        showToast('Select at least one receipt to print', 'warning');
        return;
    }

    if (selected.length > 10) {
        if (!confirm(`Print ${selected.length} receipts? This may take a moment.`)) return;
    }

    // Print sequentially with delay
    let index = 0;
    function printNext() {
        if (index >= selected.length) {
            showToast(`Printed ${selected.length} receipts`, 'success');
            return;
        }
        printReceipt(selected[index]);
        index++;
        setTimeout(printNext, 1000);
    }
    printNext();
}

function exportReceiptsList() {
    const receipts = window._allReceipts || [];
    const data = receipts.map(p => {
        const st = getStudentById(p.student_id);
        return {
            'Receipt #': p.receipt_number || '',
            'Date': fmtDate(p.payment_date || p.created_at),
            'Student': st ? `${st.first_name} ${st.last_name}` : '—',
            'Student Code': st?.student_code || '',
            'Class': getClassById(st?.class_id)?.name || '',
            'Amount (RWF)': p.amount,
            'Method': p.payment_method || '',
            'Reference': p.reference || '',
            'Recorded By': state.teachers.find(t => t.id === p.recorded_by)?.name || 'System'
        };
    });

    exportToExcel(data, `Receipts_List_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Receipts list exported', 'success');
}

function saveReceiptSetting() {
    const format = document.getElementById('receipt-format')?.value;
    const includeLogo = document.getElementById('receipt-logo')?.value;
    const includeSignatures = document.getElementById('receipt-signatures')?.value;
    const autoPrint = document.getElementById('receipt-auto-print')?.value;

    localStorage.setItem('receipt_format', format);
    localStorage.setItem('receipt_include_logo', includeLogo);
    localStorage.setItem('receipt_include_signatures', includeSignatures);
    localStorage.setItem('receipt_auto_print', autoPrint);

    showToast('✅ Receipt settings saved', 'success');
}

function previewReceiptSettings() {
    // Create a preview receipt with current settings
    const school = state.schoolSettings || {};
    const includeLogo = localStorage.getItem('receipt_include_logo') !== 'no';
    const includeSignatures = localStorage.getItem('receipt_include_signatures') !== 'no';
    const logo = school.school_logo || '';

    let logoHtml = '';
    if (includeLogo && logo && (logo.startsWith('data:') || logo.startsWith('http'))) {
        logoHtml = `<img src="${logo}" style="width:40px;height:40px;object-fit:contain">`;
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>📄 Receipt Preview</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body" style="background:#fff; color:#000; font-family:monospace">
                    <div style="text-align:center">
                        ${includeLogo && logoHtml ? `<div>${logoHtml}</div>` : ''}
                        <div style="font-weight:800">${esc(school.school_name || 'ECOLE LA FONTAINE')}</div>
                        <div style="font-size:10px">OFFICIAL RECEIPT</div>
                        <div style="font-size:9px; background:#f0f0f0; display:inline-block; padding:2px 8px; margin:6px">#PREVIEW-001</div>
                    </div>
                    <div style="border-top:1px dashed #999; margin:8px 0"></div>
                    <div><strong>Student:</strong> John Doe</div>
                    <div><strong>Amount:</strong> 50,000 RWF</div>
                    <div><strong>Method:</strong> Cash</div>
                    ${includeSignatures ? `
                        <div style="display:flex; justify-content:space-between; margin-top:16px">
                            <div style="text-align:center; width:45%"><div style="border-top:1px solid #000; margin-top:20px; padding-top:4px">Parent/Guardian</div></div>
                            <div style="text-align:center; width:45%"><div style="border-top:1px solid #000; margin-top:20px; padding-top:4px">Cashier</div></div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}