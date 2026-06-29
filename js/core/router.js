// ============================================================
// ROUTER - Module navigation and dynamic content loading
// ============================================================


let currentModuleId = null;
// Module JS file is imported once then cached here
const importedModules = new Set();

// Map: route-id -> { file: relative path from /js/, fn: exported render function name }
const MODULE_MAP = {
    // Dashboards
    'admin-dashboard':        { file: 'modules/dashboard.js',            fn: 'renderAdminDashboard' },
    'accountant-dashboard':   { file: 'modules/dashboard.js',            fn: 'renderAccountantDashboard' },
    'teacher-dashboard':      { file: 'modules/dashboard.js',            fn: 'renderTeacherDashboard' },

    // Academics
    'marks-entry':            { file: 'modules/marks.js',                fn: 'renderMarksEntry' },
    'marks-database':         { file: 'modules/marks-database.js',       fn: 'renderMarksDatabase' },
    'class-register':         { file: 'modules/class-register.js',       fn: 'renderClassRegister' },
    'statistics':             { file: 'modules/statistics.js',           fn: 'renderStatistics' },
    'timetable':              { file: 'modules/timetable.js',            fn: 'renderTimetable' },
    'report-cards':           { file: 'modules/report-cards.js',         fn: 'renderReportCards' },
    'assessments':            { file: 'modules/assessments.js',          fn: 'renderAssessments' },
    'rankings':               { file: 'modules/rankings.js',             fn: 'renderRankings' },
    'annual-register':        { file: 'modules/annual-register.js',      fn: 'renderAnnualRegister' },
    'transcripts':            { file: 'modules/transcripts.js',          fn: 'renderTranscripts' },
    'marks-analysis':         { file: 'modules/marks-analysis.js',       fn: 'renderMarksAnalysis' },
    'grading-scale':          { file: 'modules/grading-system.js',       fn: 'renderGradingScale' },

    // Attendance
    'attendance':             { file: 'modules/attendance.js',           fn: 'renderAttendanceEntry' },
    'attendance-reports':     { file: 'modules/attendance-reports.js',   fn: 'renderAttendanceReports' },
    'attendance-summary':     { file: 'modules/attendance-summary.js',   fn: 'renderAttendanceSummary' },

    // Students
    'student-list':           { file: 'modules/students.js',             fn: 'renderStudentList' },
    'enroll-student':         { file: 'modules/student-registration.js', fn: 'renderEnrollStudent' },
    'student-details':        { file: 'modules/student-profile.js',      fn: 'renderStudentDetails' },
    'student-fees':           { file: 'modules/student-fees.js',         fn: 'renderStudentFees' },
    'sibling-linking':        { file: 'modules/sibling-linking.js',      fn: 'renderSiblingLinking' },
    'student-archive':        { file: 'modules/student-archive.js',      fn: 'renderStudentArchive' },
    'bulk-import':            { file: 'modules/bulk-student-actions.js', fn: 'renderBulkImport' },
    'bulk-export':            { file: 'modules/bulk-student-actions.js', fn: 'renderBulkExport' },
    'student-promotion':      { file: 'modules/student-promotion.js',    fn: 'renderStudentPromotion' },
    'family-management':      { file: 'modules/family-management.js',    fn: 'renderFamilyManagement' },

    // Finance
    'fee-structure':          { file: 'modules/finance.js',              fn: 'renderFeeStructure' },
    'fee-structures':         { file: 'modules/fee-structures.js',       fn: 'renderFeeStructures' },
    'payment-history':        { file: 'modules/payment-history.js',      fn: 'renderPaymentHistory' },
    'record-payment':         { file: 'modules/record-payment.js',       fn: 'renderRecordPayment' },
    'financial-reports':      { file: 'modules/finance-reports.js',      fn: 'renderFinanceReports' },
    'overdue-payments':       { file: 'modules/overdue-payments.js',     fn: 'renderOverduePayments' },
    'fee-waivers':            { file: 'modules/fee-waivers.js',          fn: 'renderFeeWaivers' },
    'receipts':               { file: 'modules/receipts.js',             fn: 'renderReceipts' },
    'balances':               { file: 'modules/balances.js',             fn: 'renderBalances' },
    'carry-forward':          { file: 'modules/carry-forward.js',        fn: 'renderCarryForward' },
    'discounts':              { file: 'modules/discounts.js',            fn: 'renderDiscounts' },
    'fee-assignments':        { file: 'modules/fee-assignments.js',      fn: 'renderFeeAssignments' },
    'fee-term-status':        { file: 'modules/fee-term-status.js',      fn: 'renderFeeTermStatus' },
    'family-fee-summary':     { file: 'modules/family-fee-summary.js',   fn: 'renderFamilyFeeSummary' },
    'finance-dashboard':      { file: 'modules/finance-dashboard.js',    fn: 'renderFinanceDashboard' },
    'finance-audit':          { file: 'modules/finance-audit.js',        fn: 'renderFinanceAudit' },
    'payment-reversals':      { file: 'modules/payment-reversals.js',    fn: 'renderPaymentReversals' },
    'credit-balances':        { file: 'modules/credit-balances.js',      fn: 'renderCreditBalances' },
    'manual-adjustments':     { file: 'modules/manual-adjustments.js',   fn: 'renderManualAdjustments' },
    'bulk-finance-actions':   { file: 'modules/bulk-finance-actions.js', fn: 'renderBulkFinanceActions' },
    'receipt-printing':       { file: 'modules/receipt-printing.js',     fn: 'renderReceiptPrinting' },
    // Utility/helper modules with render entry points
    'academic-reports':   { file: 'modules/academic-reports.js',   fn: 'renderAcademicReports' },
    'attendance-analytics': { file: 'modules/attendance-analytics.js', fn: 'renderAttendanceAnalytics' },
    'register-export':    { file: 'modules/register-export.js',    fn: 'renderRegisterExport' },
    'report-generator':   { file: 'modules/report-generator.js',   fn: 'renderReportGenerator' },
    'student-statements': { file: 'modules/student-statements.js', fn: 'renderStudentStatements' },

    // Staff
    'teachers-list':          { file: 'modules/teachers.js',             fn: 'renderTeachers' },
    'subjects':               { file: 'modules/subjects.js',             fn: 'renderSubjects' },
    'teacher-assignments':    { file: 'modules/teacher-assignments.js',  fn: 'renderTeacherAssignments' },
    'staff-timetable':        { file: 'modules/staff-timetable.js',      fn: 'renderStaffTimetable' },
    'teacher-performance':    { file: 'modules/teacher-performance.js',  fn: 'renderTeacherPerformance' },
    'teacher-timetable':      { file: 'modules/teacher-timetable.js',    fn: 'renderTeacherTimetable' },
    'class-timetable':        { file: 'modules/class-timetable.js',      fn: 'renderClassTimetable' },
    'timetable-generator':    { file: 'modules/timetable-generator.js',  fn: 'renderTimetableGenerator' },
    'timetable-conflicts':    { file: 'modules/timetable-conflicts.js',  fn: 'renderTimetableConflicts' },
    'timetable-import':       { file: 'modules/timetable-import.js',     fn: 'renderTimetableImport' },

    // Settings
    'school-settings':        { file: 'modules/school-settings.js',     fn: 'renderSchoolSettings' },
    'academic-calendar':      { file: 'modules/academic-calendar.js',   fn: 'renderAcademicCalendar' },
    'academic-years':         { file: 'modules/academic-years.js',      fn: 'renderAcademicYears' },
    'class-management':       { file: 'modules/class-management.js',    fn: 'renderClassManagement' },
    'grading-settings':       { file: 'modules/grading-settings.js',    fn: 'renderGradingSettings' },
    'user-management':        { file: 'modules/user-management.js',     fn: 'renderUserManagement' },
    'backup-restore':         { file: 'modules/backup-restore.js',      fn: 'renderBackupRestore' },
    'system-logs':            { file: 'modules/system-logs.js',         fn: 'renderSystemLogs' },
    'system-health':          { file: 'modules/system-health.js',       fn: 'renderSystemHealth' },
    'analytics':              { file: 'modules/analytics.js',           fn: 'renderAnalytics' },
    'analytics-settings':     { file: 'modules/analytics-settings.js', fn: 'renderAnalyticsSettings' },
    'api-settings':           { file: 'modules/api-settings.js',       fn: 'renderApiSettings' },
    'settings':               { file: 'modules/settings.js',           fn: 'renderSettings' },
    'users':                  { file: 'modules/users.js',              fn: 'renderUsers' },

    // Communication
    'notifications':          { file: 'modules/notifications.js',      fn: 'renderNotifications' },
    'announcements':          { file: 'modules/announcements.js',      fn: 'renderAnnouncements' },
    'notification-center':    { file: 'modules/notification-center.js',fn: 'renderNotificationCenter' },
    'reminders':              { file: 'modules/reminders.js',          fn: 'renderReminders' },

    // Assessment tools
    'assessment-export':      { file: 'modules/assessment-export.js',    fn: 'renderAssessmentExport' },
    'assessment-locking':     { file: 'modules/assessment-locking.js',   fn: 'renderAssessmentLocking' },
    'marks-import-export':    { file: 'modules/marks-import-export.js',  fn: 'renderMarksImportExport' },
    'ranking-engine':         { file: 'modules/ranking-engine.js',       fn: 'renderRankingEngine' },
};

function initRouter(defaultModule = 'admin-dashboard') {
    const savedModule = localStorage.getItem('elf_module') || defaultModule;
    navigateTo(savedModule);
}

async function navigateTo(moduleId) {
    const role = getCurrentUser()?.role;

    if (role === 'teacher' && TEACHER_BLOCKED_MODULES.has(moduleId)) {
        showAccessDenied('Finance modules are not available for Teacher accounts.');
        return;
    }
    if (role === 'accountant' && ACCOUNTANT_BLOCKED_MODULES.has(moduleId)) {
        showAccessDenied('Academic modules are not available for Accountant accounts.');
        return;
    }

    setActiveNav(moduleId);
    const label = findNavLabel(moduleId, role);
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = label || moduleId;

    currentModuleId = moduleId;
    state.currentModule = moduleId;
    localStorage.setItem('elf_module', moduleId);

    closeSidebarMobile();

    await loadModule(moduleId);
}

async function loadModule(moduleId) {
    const container = document.getElementById('dynamic-content');
    if (!container) return;

    container.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>`;

    try {
        const entry = MODULE_MAP[moduleId];

        if (!entry) {
            container.innerHTML = `<div class="alert alert-warning">Module "<strong>${escapeHtml(moduleId)}</strong>" is not yet implemented.</div>`;
            return;
        }

        // Dynamically import the module file (browser caches after first load)
        const mod = await import(`/js/${entry.file}`);

        const renderFn = mod[entry.fn];
        if (typeof renderFn !== 'function') {
            container.innerHTML = `<div class="alert alert-warning">Render function <code>${escapeHtml(entry.fn)}</code> not found in <code>${escapeHtml(entry.file)}</code>.</div>`;
            return;
        }

        await renderFn(container);
        updateProgressBar();

    } catch (err) {
        logError(`Error loading module ${moduleId}:`, err, 'router');
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error loading module "${escapeHtml(moduleId)}":</strong><br>
                ${escapeHtml(err.message)}
                <br><br>
                <button class="btn btn-sm btn-outline" onclick="window.navigateTo('${escapeHtml(moduleId)}')">🔄 Retry</button>
            </div>`;
    }
}

function findNavLabel(id, role) {
    const config = NAV_CONFIG[role] || [];
    for (const section of config) {
        const item = section.items?.find(i => i.id === id);
        if (item) return item.label;
    }
    return id;
}

function showAccessDenied(message) {
    const container = document.getElementById('dynamic-content');
    if (container) {
        container.innerHTML = `
            <div class="dash-card">
                <div class="dash-card-body" style="text-align:center;padding:60px 20px">
                    <div style="font-size:3rem;margin-bottom:16px">🔒</div>
                    <h3 style="color:var(--text-muted)">Access Restricted</h3>
                    <p style="color:var(--text-muted)">${escapeHtml(message)}</p>
                </div>
            </div>`;
    }
}

function navigateToWithData(moduleId, data) {
    if (data) {
        Object.entries(data).forEach(([key, value]) => {
            if (value != null) localStorage.setItem(`elf_nav_${key}`, String(value));
        });
    }
    navigateTo(moduleId);
}

function getNavData(key) {
    const value = localStorage.getItem(`elf_nav_${key}`);
    localStorage.removeItem(`elf_nav_${key}`);
    return value;
}

function clearModuleCache() {
    importedModules.clear();
}

function getCurrentModule() {
    return currentModuleId;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
    ));
}

// Global exposure for onclick handlers in module HTML
window.navigateTo = navigateTo;
window.navigateToWithData = navigateToWithData;
window.getNavData = getNavData;
