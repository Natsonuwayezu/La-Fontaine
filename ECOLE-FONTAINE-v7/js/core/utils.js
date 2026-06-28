// ============================================================
// UTILITIES - Formatting, Export, Helpers
// ============================================================

// Number Formatting
export function fmt(n, d = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtCurrency(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US') + ' RWF';
}

export function fmtPct(n, d = 1) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(d) + '%';
}

// Date Formatting
export function fmtDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

export function formatDate(s) {
    return fmtDate(s);
}

export function fmtDateTime(s) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function fmtAgo(s) {
    if (!s) return '—';
    const secs = Math.floor((Date.now() - new Date(s)) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return fmtDate(s);
}

// HTML Escaping (XSS Prevention)
export function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return map[m];
    });
}

// Grade Calculation
export function getGrade(pct, scale = null) {
    if (pct === null || pct === undefined || isNaN(pct)) return '—';
    const gradingScale = scale || window.state?.gradingScale || [];
    for (const g of gradingScale) {
        const minVal = g.min_percentage !== undefined ? g.min_percentage : g.min;
        const maxVal = g.max_percentage !== undefined ? g.max_percentage : g.max;
        if (pct >= minVal && pct <= maxVal) return g.grade;
    }
    return 'F';
}

export function getGradeClass(pct) {
    const g = getGrade(pct);
    if (g === 'A+') return 'grade-Ap';
    return `grade-${g}`;
}

// Excel Export
export function exportToExcel(data, filename) {
    if (!data?.length) {
        showToast('No data to export', 'warning');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Blob Download
export function downloadBlob(content, filename, mime = 'application/octet-stream') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Phase Detection
export function getCurrentPhase(term = null) {
    const currentTerm = term || window.state?.currentTerm;
    if (!currentTerm?.midterm_date) return 'post_midterm';
    return new Date() < new Date(currentTerm.midterm_date) ? 'pre_midterm' : 'post_midterm';
}

// Term Progress
export function termProgress(term = null) {
    const currentTerm = term || window.state?.currentTerm;
    if (!currentTerm?.start_date || !currentTerm?.end_date) {
        return { pct: 0, daysLeft: 0, text: 'No term data' };
    }
    const start = new Date(currentTerm.start_date);
    const end = new Date(currentTerm.end_date);
    const now = new Date();

    if (now < start) {
        return { pct: 0, daysLeft: Math.ceil((end - start) / 86400000), text: 'Not started' };
    }
    if (now > end) {
        return { pct: 100, daysLeft: 0, text: 'Term ended' };
    }
    const pct = ((now - start) / (end - start)) * 100;
    const daysLeft = Math.ceil((end - now) / 86400000);
    return { pct: Math.round(pct), daysLeft, text: `${Math.round(pct)}% complete` };
}

// Student Name Formatting
export function getStudentFullName(student) {
    if (!student) return '—';
    return `${student.first_name || ''} ${student.last_name || ''}`.trim() || '—';
}

export function getStudentDisplayName(student, includeCode = false) {
    const name = getStudentFullName(student);
    if (includeCode && student.student_code) {
        return `${name} (${student.student_code})`;
    }
    return name;
}

// Sorting Functions
export function sortStudentsByLastName(students) {
    return [...students].sort((a, b) => {
        const aName = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase();
        const bName = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase();
        return aName.localeCompare(bName, 'fr-RW');
    });
}

export function sortStudentsByFirstName(students) {
    return [...students].sort((a, b) => {
        const aName = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        const bName = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
        return aName.localeCompare(bName, 'fr-RW');
    });
}

export function sortStudentsAlphabetically(students) {
    return [...students].sort((a, b) => {
        const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.first_name || '').localeCompare(b.first_name || '');
    });
}

// Debounce Function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Deep Clone
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Generate Unique ID
export function generateId(prefix = 'ID') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}export { fmtAgo as formatAgo };
export { confirmDialog } from '../ui/modals.js';
export { getFullStudentBalance } from './helpers.js';
export { rankStudents } from './helpers.js';
