// ============================================================
// EXPORT ENGINE - Export data to Excel, CSV, PDF
// ============================================================


// Export data to Excel
function exportToExcelFile(data, filename, sheetName = 'Data') {
    if (!data || !data.length) {
        showToast('No data to export', 'warning');
        return false;
    }

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('✅ Export successful', 'success');
        return true;
    } catch (error) {
        logError('Excel export failed:', error, 'export-engine');
        showToast('Export failed', 'error');
        return false;
    }
}

// Export data to CSV
function exportToCSV(data, filename) {
    if (!data || !data.length) {
        showToast('No data to export', 'warning');
        return false;
    }

    try {
        const headers = Object.keys(data[0]);
        const csvRows = [];

        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                let value = row[header];
                if (value === null || value === undefined) value = '';
                if (typeof value === 'string') {
                    value = value.replace(/"/g, '""');
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        value = `"${value}"`;
                    }
                }
                return value;
            });
            csvRows.push(values.join(','));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        showToast('✅ Export successful', 'success');
        return true;
    } catch (error) {
        logError('CSV export failed:', error, 'export-engine');
        showToast('Export failed', 'error');
        return false;
    }
}

// Export table to Excel
function exportTableToExcel(tableElement, filename) {
    try {
        const ws = XLSX.utils.table_to_sheet(tableElement);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('✅ Table exported', 'success');
        return true;
    } catch (error) {
        logError('Table export failed:', error, 'export-engine');
        showToast('Export failed', 'error');
        return false;
    }
}

// Export marks to Excel with formatting
function exportMarksToExcel(students, marksData, assessmentName, filename) {
    const data = students.map(student => {
        const row = {
            'Student Code': student.student_code || '',
            'Student Name': `${student.first_name} ${student.last_name}`,
            'Class': getClassName(student.class_id)
        };

        for (const [key, value] of Object.entries(marksData[student.id] || {})) {
            row[key] = value;
        }

        return row;
    });

    return exportToExcelFile(data, filename || assessmentName || 'Marks_Export');
}

// Export fee structure to Excel
function exportFeeStructure(feeCategories, feeAmounts, classes, filename = 'Fee_Structure') {
    const data = [];

    for (const cls of classes) {
        const row = { Class: cls.name };
        for (const category of feeCategories) {
            const amount = feeAmounts.find(fa =>
                fa.fee_category_id === category.id && fa.class_id === cls.id
            );
            row[category.name] = amount?.amount || 0;
        }
        data.push(row);
    }

    return exportToExcelFile(data, filename);
}

// Export student balances to Excel
function exportStudentBalances(students, getBalanceFn, filename = 'Student_Balances') {
    const data = students.map(student => {
        const balance = getBalanceFn(student.id);
        return {
            'Student Code': student.student_code || '',
            'Student Name': `${student.first_name} ${student.last_name}`,
            'Class': getClassName(student.class_id),
            'Total Fees (RWF)': balance.total || 0,
            'Paid (RWF)': balance.paid || 0,
            'Balance (RWF)': balance.balance || 0,
            'Credit (RWF)': balance.credit || 0,
            'Collection Rate (%)': balance.pct?.toFixed(1) || 0
        };
    });

    return exportToExcelFile(data, filename);
}

// Export payments to Excel
function exportPayments(payments, filename = 'Payment_History') {
    const data = payments.map(payment => {
        const student = getStudentById(payment.student_id);
        return {
            'Receipt #': payment.receipt_number || '',
            'Date': payment.payment_date || payment.created_at,
            'Student': student ? `${student.first_name} ${student.last_name}` : '—',
            'Class': student ? getClassName(student.class_id) : '—',
            'Amount (RWF)': payment.amount,
            'Method': payment.payment_method || '—',
            'Reference': payment.reference || '',
            'Recorded By': payment.recorded_by || 'System'
        };
    });

    return exportToExcelFile(data, filename);
}

// Helper function
function getClassName(classId) {
    const cls = window.state?.classes?.find(c => c.id == classId);
    return cls?.name || 'Unknown';
}