// js/integrations/print.js
// Print Integration - Optimized printing for reports, receipts, and cards

function initPrintIntegration() {
    addPrintStyles();
    setupPrintEventHandlers();
}

function addPrintStyles() {
    const style = document.createElement('style');
    style.id = 'print-optimization-styles';
    style.textContent = `
        @media print {
            /* Hide non-printable elements */
            .no-print, .btn, .btn-group, .topbar, .sidebar, .modal-overlay,
            .filters-bar, .pagination, .notif-bell, .user-menu, #pwa-install-btn,
            #back-to-top, .menu-toggle, .quick-actions, .dash-card-header .btn-group,
            .tab-btn, .filters-bar, .term-progress-bar {
                display: none !important;
            }
            
            /* Show printable content */
            .dash-card, .report-card, .receipt, .table-wrapper, .main-content {
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
            }
            
            /* Ensure proper page breaks */
            .report-card, .receipt {
                page-break-after: always;
                page-break-inside: avoid;
            }
            
            /* Table styling for print */
            table {
                width: 100%;
                border-collapse: collapse;
                page-break-inside: avoid;
            }
            
            th, td {
                border: 1px solid #999 !important;
                padding: 6px 8px !important;
            }
            
            th {
                background: #1a3a5c !important;
                color: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            /* Badge styling for print */
            .badge {
                border: 1px solid #999 !important;
                background: #f5f5f5 !important;
                color: #000 !important;
                padding: 2px 8px !important;
                border-radius: 12px !important;
            }
            
            /* Layout adjustments */
            .main-content {
                margin-left: 0 !important;
                width: 100% !important;
            }
            
            body {
                background: white !important;
                padding: 0.5in !important;
            }
            
            /* Logo and header */
            .print-header {
                display: flex !important;
                margin-bottom: 20px !important;
            }
            
            /* Page margins */
            @page {
                margin: 1cm;
                size: A4;
            }
            
            /* Avoid orphans and widows */
            p, h1, h2, h3, h4, table {
                orphans: 3;
                widows: 3;
            }
        }
    `;
    document.head.appendChild(style);
}

function setupPrintEventHandlers() {
    window.addEventListener('beforeprint', function () {
        document.body.classList.add('printing');

        // Expand all accordions/collapsible sections for printing
        document.querySelectorAll('.nav-section.collapsed').forEach(section => {
            section.classList.remove('collapsed');
        });

        // Show all hidden content that should be printed
        document.querySelectorAll('[data-print-show]').forEach(el => {
            el.style.display = 'block';
        });
    });

    window.addEventListener('afterprint', function () {
        document.body.classList.remove('printing');

        // Restore collapsed sections
        document.querySelectorAll('.nav-section').forEach(section => {
            if (section.dataset.wasCollapsed === 'true') {
                section.classList.add('collapsed');
            }
        });

        // Hide print-only elements
        document.querySelectorAll('[data-print-show]').forEach(el => {
            if (el.dataset.originalDisplay) {
                el.style.display = el.dataset.originalDisplay;
            }
        });
    });
}

function printElement(element, title = 'Print') {
    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (!printWindow) {
        alert('Please allow pop-ups to print');
        return;
    }

    const content = element.cloneNode(true);

    // Remove buttons and interactive elements from clone
    content.querySelectorAll('.btn, button, .no-print, .filters-bar, .pagination').forEach(el => el.remove());

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(title)} - ECOLE LA FONTAINE</title>
            <meta charset="UTF-8">
            <style>
                ${getPrintStyles()}
                ${getAdditionalStyles()}
            </style>
        </head>
        <body>
            <div class="print-header">
                ${getSchoolHeaderHtml()}
            </div>
            ${content.outerHTML}
            <div class="print-footer">
                <p>Generated on ${new Date().toLocaleString()} | ECOLE LA FONTAINE School Management System</p>
            </div>
            <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };</script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

function printReportCard(studentId) {
    const reportCard = document.getElementById('report-card');
    if (!reportCard) {
        console.error('Report card not found');
        return;
    }

    const student = window.getStudentById?.(studentId);
    const title = `Report Card - ${student?.first_name} ${student?.last_name}`;
    printElement(reportCard, title);
}

function printReceipt(receiptId) {
    const receipt = document.getElementById(`receipt-${receiptId}`) || document.querySelector('.receipt');
    if (!receipt) {
        console.error('Receipt not found');
        return;
    }

    printElement(receipt, `Receipt_${receiptId}`);
}

function printTable(tableElement, title = 'Report') {
    printElement(tableElement, title);
}

function printClassRegister(classId) {
    const table = document.querySelector('#cr-table-container table');
    if (!table) {
        console.error('Class register not found');
        return;
    }

    const className = window.getClassById?.(classId)?.name || 'Class';
    printElement(table, `Class_Register_${className}`);
}

function getPrintStyles() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            padding: 20px;
            font-size: 11pt;
            line-height: 1.4;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #999;
            padding: 6px 8px;
            text-align: left;
        }
        th {
            background: #1a3a5c;
            color: white;
        }
        .print-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #1a3a5c;
        }
        .print-footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            font-size: 9pt;
            color: #666;
            border-top: 1px solid #ccc;
        }
        @page {
            margin: 1.5cm;
        }
    `;
}

function getAdditionalStyles() {
    // Additional page-specific styles can be added here
    return `
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
    `;
}

function getSchoolHeaderHtml() {
    const school = window.state?.schoolSettings || {};
    const logo = school.school_logo || '';
    const logoHtml = logo && (logo.startsWith('data:') || logo.startsWith('http'))
        ? `<img src="${logo}" style="height: 50px; width: auto;">`
        : `<span style="font-size: 40px;">${logo || '🏫'}</span>`;

    return `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>${logoHtml}</div>
            <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: bold;">${escapeHtml(school.school_name || 'ECOLE LA FONTAINE')}</div>
                <div style="font-size: 10px;">${escapeHtml(school.school_motto || '')}</div>
            </div>
            <div></div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Auto-initialize
initPrintIntegration();