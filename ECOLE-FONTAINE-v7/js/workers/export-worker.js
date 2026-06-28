// js/workers/export-worker.js
// Export Worker - Handles large data exports in background thread

self.addEventListener('message', async function (e) {
    const { type, data, options, taskId } = e.data;

    try {
        let result;

        switch (type) {
            case 'export-excel':
                result = await exportToExcel(data, options);
                break;
            case 'export-csv':
                result = await exportToCSV(data, options);
                break;
            case 'export-pdf':
                result = await exportToPDF(data, options);
                break;
            case 'export-marks':
                result = await exportMarksData(data, options);
                break;
            case 'export-financial':
                result = await exportFinancialData(data, options);
                break;
            case 'export-student-list':
                result = await exportStudentList(data, options);
                break;
            default:
                throw new Error(`Unknown export type: ${type}`);
        }

        self.postMessage({
            success: true,
            result: result,
            taskId: taskId,
            type: type
        });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message,
            taskId: taskId,
            type: type
        });
    }
});

async function exportToExcel(data, options) {
    const { sheetName = 'Data', filename = 'export' } = options;

    // Simulate Excel generation (in real worker, would use SheetJS)
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    return {
        url: url,
        filename: `${filename}_${formatDate()}.csv`,
        size: blob.size
    };
}

async function exportToCSV(data, options) {
    const { filename = 'export' } = options;
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    return {
        url: url,
        filename: `${filename}_${formatDate()}.csv`,
        size: blob.size
    };
}

async function exportToPDF(data, options) {
    const { title = 'Report', orientation = 'portrait' } = options;

    const html = generateReportHTML(data, title, orientation);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    return {
        url: url,
        filename: `${title.replace(/\s/g, '_')}_${formatDate()}.html`,
        size: blob.size
    };
}

async function exportMarksData(data, options) {
    const { classId, termId, subjectId } = options;

    // Process marks data
    const processedData = data.map(mark => ({
        'Student Name': mark.student_name,
        'Student Code': mark.student_code,
        'Assessment': mark.assessment_name,
        'Score': mark.score,
        'Max Marks': mark.max_marks,
        'Percentage': ((mark.score / mark.max_marks) * 100).toFixed(1) + '%',
        'Grade': calculateGrade((mark.score / mark.max_marks) * 100),
        'Date': mark.date
    }));

    return exportToExcel(processedData, { filename: `Marks_Export_${classId}` });
}

async function exportFinancialData(data, options) {
    const { startDate, endDate, type = 'summary' } = options;

    let processedData;

    if (type === 'summary') {
        processedData = [{
            'Total Fees': data.total_fees,
            'Total Paid': data.total_paid,
            'Outstanding': data.total_fees - data.total_paid,
            'Collection Rate': ((data.total_paid / data.total_fees) * 100).toFixed(1) + '%',
            'Period Start': startDate,
            'Period End': endDate
        }];
    } else if (type === 'detailed') {
        processedData = data.payments.map(p => ({
            'Date': p.date,
            'Receipt #': p.receipt_number,
            'Student': p.student_name,
            'Amount': p.amount,
            'Method': p.payment_method,
            'Reference': p.reference || ''
        }));
    } else {
        processedData = data;
    }

    return exportToExcel(processedData, { filename: `Financial_Report_${formatDate()}` });
}

async function exportStudentList(data, options) {
    const { classId, status = 'all' } = options;

    let filteredData = data;
    if (classId) filteredData = filteredData.filter(s => s.class_id == classId);
    if (status !== 'all') filteredData = filteredData.filter(s => s.status === status);

    const processedData = filteredData.map(student => ({
        'Student Code': student.student_code,
        'First Name': student.first_name,
        'Last Name': student.last_name,
        'Class': student.class_name,
        'Gender': student.gender || '',
        'Guardian Name': student.guardian_name || '',
        'Guardian Phone': student.guardian_phone || '',
        'Status': student.status,
        'Enrollment Date': student.enrollment_date
    }));

    return exportToExcel(processedData, { filename: `Student_List_${formatDate()}` });
}

function convertToCSV(data) {
    if (!data || !data.length) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(header => formatCSVValue(obj[header])).join(','));

    return [headers.join(','), ...rows].join('\n');
}

function formatCSVValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function generateReportHTML(data, title, orientation) {
    const headers = data.length ? Object.keys(data[0]) : [];
    const rows = data.map(row => headers.map(h => row[h]).join('</td><td>'));

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(title)}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <table>
                <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map(row => `<tr><td>${row}</td></tr>`).join('')}</tbody>
            </table>
        </body>
        </html>
    `;
}

function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

function formatDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Report progress back to main thread
function reportProgress(current, total, message) {
    self.postMessage({
        type: 'progress',
        progress: Math.round((current / total) * 100),
        message: message
    });
}