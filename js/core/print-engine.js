// ============================================================
// PRINT ENGINE - Print-friendly page generation
// ============================================================


// Print specific element
function printElement(element, title = 'Print') {
    if (!element) {
        showToast('Nothing to print', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Please allow popups to print', 'warning');
        return;
    }

    const originalTitle = document.title;
    document.title = title;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta charset="UTF-8">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    padding: 20px;
                    background: white;
                    color: black;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background: #f5f5f5;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .print-footer {
                    text-align: center;
                    margin-top: 30px;
                    font-size: 10px;
                    color: #666;
                }
            </style>
            ${Array.from(document.querySelectorAll('style')).map(style => style.outerHTML).join('')}
        </head>
        <body>
            <div class="print-header">
                <h1>${title}</h1>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
            ${element.outerHTML}
            <div class="print-footer">
                ECOLE LA FONTAINE — Official Document
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 1000);
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
    document.title = originalTitle;
}

// Print receipt
function printReceipt(receiptData, schoolInfo) {
    const receiptHtml = `
        <div class="receipt-print">
            <div style="text-align:center; margin-bottom:16px;">
                <h2>${schoolInfo.school_name || 'ECOLE LA FONTAINE'}</h2>
                <p>${schoolInfo.school_location || 'Rubavu, Rwanda'}</p>
                <p>Tel: ${schoolInfo.school_phone || '+250788534320'}</p>
                <hr>
                <h3>OFFICIAL PAYMENT RECEIPT</h3>
            </div>
            <div style="margin-bottom:16px;">
                <p><strong>Receipt No:</strong> ${receiptData.receipt_number}</p>
                <p><strong>Date:</strong> ${receiptData.date}</p>
                <p><strong>Student:</strong> ${receiptData.student_name}</p>
                <p><strong>Class:</strong> ${receiptData.class_name}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
                <thead>
                    <tr style="border-bottom:1px solid #ddd;">
                        <th style="text-align:left">Description</th>
                        <th style="text-align:right">Amount (RWF)</th>
                    </tr>
                </thead>
                <tbody>
                    ${receiptData.items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td style="text-align:right">${item.amount.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr style="border-top:2px solid #000;">
                        <td><strong>TOTAL</strong></td>
                        <td style="text-align:right"><strong>${receiptData.total.toLocaleString()} RWF</strong></td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top:30px; display:flex; justify-content:space-between;">
                <div style="text-align:center;">
                    <div style="border-top:1px solid #000; width:150px; padding-top:4px;">Parent Signature</div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:1px solid #000; width:150px; padding-top:4px;">Cashier Signature</div>
                </div>
            </div>
            <div style="text-align:center; margin-top:30px; font-size:10px; color:#666;">
                Thank you for your payment
            </div>
        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        showToast('Please allow popups to print', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt ${receiptData.receipt_number}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    width: 350px;
                    margin: 0 auto;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
                table { width: 100%; }
                th, td { padding: 6px 0; }
            </style>
        </head>
        <body>
            ${receiptHtml}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 1000);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Print report card
function printReportCard(reportCardHtml, studentName) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Please allow popups to print', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Report Card - ${studentName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'DM Sans', Arial, sans-serif;
                    padding: 20px;
                    background: white;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${reportCardHtml}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Print statement (fee statement for student)
function printStatement(student, fees, payments, balance) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Please allow popups to print', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Fee Statement - ${student.first_name} ${student.last_name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h1 { text-align: center; color: #1a3a5c; }
                .header { text-align: center; margin-bottom: 30px; }
                .info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background: #1a3a5c; color: white; }
                .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; padding: 10px; background: #d1fae5; border-radius: 8px; }
                .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏫 ECOLE LA FONTAINE</h1>
                <h3>FEE STATEMENT</h3>
            </div>
            <div class="info">
                <div><strong>Student:</strong> ${student.first_name} ${student.last_name}</div>
                <div><strong>Code:</strong> ${student.student_code || '—'}</div>
                <div><strong>Class:</strong> ${getClassName(student.class_id)}</div>
            </div>
            <div class="info">
                <div><strong>Total Fees:</strong> ${balance.total.toLocaleString()} RWF</div>
                <div><strong>Total Paid:</strong> ${balance.paid.toLocaleString()} RWF</div>
                <div><strong>Balance:</strong> ${balance.balance.toLocaleString()} RWF</div>
            </div>
            <h3>Fee Breakdown</h3>
            <table>
                <thead><tr><th>Category</th><th>Amount</th><th>Paid</th><th>Remaining</th></tr></thead>
                <tbody>
                    ${fees.map(f => {
        const cat = window.state?.feeCategories?.find(c => c.id === f.fee_category_id);
        return `<tr>
                            <td>${cat?.name || 'Unknown'}</td>
                            <td>${f.amount.toLocaleString()} RWF</td>
                            <td>${(f.paid_amount || 0).toLocaleString()} RWF</td>
                            <td>${(f.amount - (f.paid_amount || 0)).toLocaleString()} RWF</td>
                        </tr>`;
    }).join('')}
                </tbody>
            </table>
            <h3>Payment History</h3>
            <table>
                <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt #</th></tr></thead>
                <tbody>
                    ${payments.map(p => `<tr>
                        <td>${p.payment_date || p.created_at?.split('T')[0]}</td>
                        <td>${p.amount.toLocaleString()} RWF</td>
                        <td>${p.payment_method || '—'}</td>
                        <td>${p.receipt_number || '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div class="total">Outstanding Balance: ${balance.balance.toLocaleString()} RWF</div>
            <div class="footer">Generated on ${new Date().toLocaleString()} | ECOLE LA FONTAINE School Management System</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Helper function
function getClassName(classId) {
    const cls = window.state?.classes?.find(c => c.id == classId);
    return cls?.name || 'Unknown';
}