// js/integrations/html2pdf.js
// html2pdf.js Integration - PDF generation utilities

let html2pdf = null;

function initHtml2Pdf() {
    if (typeof window.html2pdf !== 'undefined') {
        html2pdf = window.html2pdf;
        return true;
    }
    console.warn('html2pdf not loaded');
    return false;
}

function generatePDF(element, options = {}, filename = 'document.pdf') {
    if (!initHtml2Pdf()) {
        console.error('html2pdf not available');
        return Promise.reject('html2pdf not available');
    }

    const defaultOptions = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            letterRendering: true,
            useCORS: true,
            logging: false
        },
        jsPDF: {
            unit: 'in',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    const mergedOptions = { ...defaultOptions, ...options };
    mergedOptions.filename = filename;

    return html2pdf().set(mergedOptions).from(element).save();
}

function generatePDFFromHTML(html, options = {}, filename = 'document.pdf') {
    if (!initHtml2Pdf()) {
        return Promise.reject('html2pdf not available');
    }

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    return generatePDF(container, options, filename).finally(() => {
        document.body.removeChild(container);
    });
}

async function generateReportCardPDF(studentId, filename = null) {
    const reportCard = document.getElementById('report-card');
    if (!reportCard) {
        throw new Error('Report card not found');
    }

    const student = window.getStudentById?.(studentId);
    const defaultFilename = `Report_Card_${student?.first_name}_${student?.last_name}_${formatDate()}.pdf`;

    return generatePDF(reportCard, {
        margin: [0.5, 0.5, 0.5, 0.5],
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }, filename || defaultFilename);
}

async function generateReceiptPDF(receiptId, filename = null) {
    const receipt = document.getElementById(`receipt-${receiptId}`);
    if (!receipt) {
        throw new Error('Receipt not found');
    }

    const defaultFilename = `Receipt_${receiptId}_${formatDate()}.pdf`;

    return generatePDF(receipt, {
        margin: [0.3, 0.3, 0.3, 0.3],
        jsPDF: { unit: 'in', format: 'a6', orientation: 'portrait' }
    }, filename || defaultFilename);
}

async function generateFinancialReportPDF(data, filename = null) {
    const html = generateFinancialReportHTML(data);
    const defaultFilename = `Financial_Report_${formatDate()}.pdf`;

    return generatePDFFromHTML(html, {
        margin: [0.5, 0.5, 0.5, 0.5],
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    }, filename || defaultFilename);
}

async function generateClassRegisterPDF(classId, filename = null) {
    const registerTable = document.querySelector('#cr-table-container table');
    if (!registerTable) {
        throw new Error('Class register not found');
    }

    const className = window.getClassById?.(classId)?.name || 'Class';
    const defaultFilename = `Class_Register_${className}_${formatDate()}.pdf`;

    return generatePDF(registerTable, {
        margin: [0.3, 0.3, 0.3, 0.3],
        jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' }
    }, filename || defaultFilename);
}

function generateFinancialReportHTML(data) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Financial Report</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                .summary{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap}
                .summary-card{border:1px solid #ccc;padding:15px;border-radius:8px;min-width:150px}
                .summary-value{font-size:20px;font-weight:bold;color:#1a3a5c}
            </style>
        </head>
        <body>
            <h1>ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Financial Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${data}
        </body>
        </html>
    `;
}

function formatDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Export worker for background PDF generation
function createPDFWorker() {
    if (typeof Worker === 'undefined') {
        return null;
    }

    const workerBlob = new Blob([`
        self.addEventListener('message', function(e) {
            const { html, options } = e.data;
            // This would require html2pdf in the worker context
            // For now, return to main thread
            self.postMessage({ success: false, error: 'Worker PDF generation requires additional setup' });
        });
    `], { type: 'application/javascript' });

    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);

    return worker;
}