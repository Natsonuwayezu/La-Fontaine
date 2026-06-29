// js/integrations/xlsx.js
// SheetJS (XLSX) Integration - Excel export/import utilities

let XLSX = null;

function initXLSX() {
    if (typeof window.XLSX !== 'undefined') {
        XLSX = window.XLSX;
        return true;
    }
    console.warn('SheetJS not loaded');
    return false;
}

function exportToExcel(data, filename, sheetName = 'Data') {
    if (!initXLSX()) {
        console.error('XLSX not available');
        return false;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
    return true;
}

function exportTableToExcel(tableElement, filename, sheetName = 'Data') {
    if (!initXLSX()) return false;

    const ws = XLSX.utils.table_to_sheet(tableElement);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
    return true;
}

function exportToCSV(data, filename) {
    if (!initXLSX()) return false;

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadBlob(csv, `${filename}_${formatDate()}.csv`, 'text/csv');
    return true;
}

async function importFromExcel(file) {
    return new Promise((resolve, reject) => {
        if (!initXLSX()) {
            reject('XLSX not available');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function createTemplate(data, filename, sheetName = 'Template') {
    if (!initXLSX()) return false;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_Template.xlsx`);
    return true;
}

function exportMultiSheet(dataMap, filename) {
    if (!initXLSX()) return false;

    const wb = XLSX.utils.book_new();

    for (const [sheetName, data] of Object.entries(dataMap)) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    }

    XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
    return true;
}

function exportArrayToExcel(data, filename, sheetName = 'Data') {
    if (!initXLSX()) return false;

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
    return true;
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXLSX);
} else {
    initXLSX();
}