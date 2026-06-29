// ============================================================
// CONSTANTS - Role-Based Access & Module Definitions
// ============================================================

// Navigation Configuration for each role
const NAV_CONFIG = {
    admin: [
        {
            section: 'Dashboard', items: [
                { id: 'admin-dashboard', icon: '📊', label: 'Main Dashboard' },
                { id: 'notifications', icon: '🔔', label: 'Notifications' },
                { id: 'announcements', icon: '📢', label: 'Announcements' }
            ]
        },
        {
            section: 'Academics', items: [
                { id: 'marks-entry', icon: '✏️', label: 'Marks Entry' },
                { id: 'marks-database', icon: '🗄️', label: 'Marks Database' },
                { id: 'class-register', icon: '📋', label: 'Class Register' },
                { id: 'statistics', icon: '📈', label: 'Statistics' },
                { id: 'timetable', icon: '🕐', label: 'Timetable' },
                { id: 'report-cards', icon: '📄', label: 'Report Cards' },
                { id: 'assessments', icon: '📝', label: 'Assessments' },
                { id: 'rankings', icon: '🏆', label: 'Rankings' },
                { id: 'annual-register', icon: '📒', label: 'Annual Register' }
            ]
        },
        {
            section: 'Attendance', items: [
                { id: 'attendance', icon: '📋', label: 'Daily Attendance' },
                { id: 'attendance-reports', icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary', icon: '📈', label: 'Attendance Summary' }
            ]
        },
        {
            section: 'Students', items: [
                { id: 'student-list', icon: '📋', label: 'Student List' },
                { id: 'enroll-student', icon: '➕', label: 'Enroll Student' },
                { id: 'student-details', icon: 'ℹ️', label: 'Student Details' },
                { id: 'student-fees', icon: '💰', label: 'Student Fees' },
                { id: 'sibling-linking', icon: '👨‍👩‍👧', label: 'Sibling Linking' },
                { id: 'student-archive', icon: '📦', label: 'Student Archive' },
                { id: 'bulk-import', icon: '📤', label: 'Bulk Import' },
                { id: 'bulk-export', icon: '📥', label: 'Bulk Export' },
                { id: 'student-promotion', icon: '🎓', label: 'Student Promotion' }
            ]
        },
        {
            section: 'Finance', items: [
                { id: 'fee-structure', icon: '🏷️', label: 'Fee Structure' },
                { id: 'payment-history', icon: '📜', label: 'Payment History' },
                { id: 'record-payment', icon: '💸', label: 'Record Payment' },
                { id: 'financial-reports', icon: '📊', label: 'Financial Reports' },
                { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' },
                { id: 'fee-waivers', icon: '🎁', label: 'Fee Waivers' },
                { id: 'receipts', icon: '🧾', label: 'Receipts' },
                { id: 'fee-structures', icon: '🏗️', label: 'Fee Structures' },
                { id: 'receipt-printing', icon: '🖨️', label: 'Receipt Printing' },
                { id: 'carry-forward', icon: '🔄', label: 'Carry Forward' },
                { id: 'credit-balances', icon: '💳', label: 'Credit Balances' },
                { id: 'payment-reversals', icon: '↩️', label: 'Payment Reversals' },
                { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' },
                { id: 'discounts', icon: '🎁', label: 'Discounts' }
            ]
        },
        {
            section: 'Staff', items: [
                { id: 'teachers-list', icon: '📋', label: 'Teachers List' },
                { id: 'subjects', icon: '📖', label: 'Subjects' },
                { id: 'teacher-assignments', icon: '📌', label: 'Assignments' },
                { id: 'teacher-performance', icon: '⭐', label: 'Teacher Performance' }
            ]
        },
        {
            section: 'Settings', items: [
                { id: 'school-settings', icon: '🏫', label: 'School Settings' },
                { id: 'academic-calendar', icon: '📅', label: 'Academic Calendar' },
                { id: 'class-management', icon: '🏛️', label: 'Class Management' },
                { id: 'grading-scale', icon: '📊', label: 'Grading Scale' },
                { id: 'user-management', icon: '👥', label: 'User Management' },
                { id: 'backup-restore', icon: '💾', label: 'Backup & Restore' },
                { id: 'system-logs', icon: '📋', label: 'System Logs' },
                { id: 'analytics', icon: '📊', label: 'Analytics' },
                { id: 'api-settings', icon: '🔌', label: 'API Settings' },
                { id: 'academic-years', icon: '📆', label: 'Academic Years' },
                { id: 'settings', icon: '⚙️', label: 'System Settings' }
            ]
        }
    ],
    accountant: [
        {
            section: 'Attendance', items: [
                { id: 'attendance', icon: '📋', label: 'Daily Attendance' },
                { id: 'attendance-reports', icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary', icon: '📈', label: 'Attendance Summary' }
            ]
        },
        {
            section: 'Dashboard', items: [
                { id: 'accountant-dashboard', icon: '📊', label: 'Main Dashboard' },
                { id: 'notifications', icon: '🔔', label: 'Notifications' }
            ]
        },
        {
            section: 'Attendance', items: [
                { id: 'attendance', icon: '📋', label: 'Daily Attendance' },
                { id: 'attendance-reports', icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary', icon: '📈', label: 'Attendance Summary' }
            ]
        },
        {
            section: 'Students', items: [
                { id: 'student-list', icon: '📋', label: 'Student List' },
                { id: 'student-details', icon: 'ℹ️', label: 'Student Details' },
                { id: 'sibling-linking', icon: '👨‍👩‍👧', label: 'Sibling Linking' }
            ]
        },
        {
            section: 'Finance', items: [
                { id: 'fee-structure', icon: '🏷️', label: 'Fee Structure' },
                { id: 'payment-history', icon: '📜', label: 'Payment History' },
                { id: 'record-payment', icon: '💸', label: 'Record Payment' },
                { id: 'financial-reports', icon: '📊', label: 'Financial Reports' },
                { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' },
                { id: 'fee-waivers', icon: '🎁', label: 'Fee Waivers' },
                { id: 'receipts', icon: '🧾', label: 'Receipts' },
                { id: 'fee-structures', icon: '🏗️', label: 'Fee Structures' },
                { id: 'receipt-printing', icon: '🖨️', label: 'Receipt Printing' },
                { id: 'carry-forward', icon: '🔄', label: 'Carry Forward' },
                { id: 'credit-balances', icon: '💳', label: 'Credit Balances' }
            ]
        }
    ],
    teacher: [
        {
            section: 'Dashboard', items: [
                { id: 'teacher-dashboard', icon: '📊', label: 'Main Dashboard' },
                { id: 'notifications', icon: '🔔', label: 'Notifications' }
            ]
        },
        {
            section: 'Academics', items: [
                { id: 'marks-entry', icon: '✏️', label: 'Marks Entry' },
                { id: 'marks-database', icon: '🗄️', label: 'Marks Database' },
                { id: 'class-register', icon: '📋', label: 'Class Register' },
                { id: 'statistics', icon: '📈', label: 'Statistics' },
                { id: 'timetable', icon: '🕐', label: 'Timetable' },
                { id: 'report-cards', icon: '📄', label: 'Report Cards' },
                { id: 'assessments', icon: '📝', label: 'Assessments' },
                { id: 'rankings', icon: '🏆', label: 'Rankings' },
                { id: 'annual-register', icon: '📒', label: 'Annual Register' }
            ]
        },
        {
            section: 'Attendance', items: [
                { id: 'attendance', icon: '📋', label: 'Daily Attendance' },
                { id: 'attendance-reports', icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary', icon: '📈', label: 'Attendance Summary' }
            ]
        },
        {
            section: 'Students', items: [
                { id: 'student-list', icon: '📋', label: 'Student List' },
                { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }
            ]
        }
    ]
};

// Modules blocked for Teacher (Finance)
const TEACHER_BLOCKED_MODULES = new Set([
    'carry-forward', 'credit-balances', 'payment-reversals',
    'receipt-printing', 'fee-structure', 'payment-history', 'record-payment',
    'financial-reports', 'overdue-payments', 'fee-waivers', 'receipts',
    'student-fees', 'user-management', 'backup-restore', 'system-logs',
    'analytics', 'api-settings', 'enroll-student', 'bulk-import', 'bulk-export',
    'class-management', 'grading-scale', 'student-promotion', 'student-archive',
    'teacher-performance', 'teachers-list', 'subjects'
]);

// Modules blocked for Accountant (Academics & Staff Timetable)
const ACCOUNTANT_BLOCKED_MODULES = new Set([
    'marks-entry', 'marks-database', 'class-register', 'statistics',
    'timetable', 'report-cards', 'assessments',
    'enroll-student',
    'bulk-import', 'bulk-export', 'teacher-assignments', 'teacher-performance',
    'school-settings', 'academic-calendar', 'class-management', 'grading-scale',
    'user-management', 'backup-restore', 'system-logs', 'analytics',
    'student-archive', 'student-promotion', 'staff-timetable'
]);

// Keyboard Shortcuts
const KEYBOARD_SHORTCUTS = {
    '1': { module: 'admin-dashboard', label: 'Dashboard' },
    '2': { module: 'student-list', label: 'Students' },
    '3': { module: 'marks-entry', label: 'Marks Entry' },
    '4': { module: 'record-payment', label: 'Record Payment' },
    '5': { module: 'report-cards', label: 'Report Cards' },
    '6': { module: 'assessments', label: 'Assessments' },
    '7': { module: 'fee-structure', label: 'Fees' },
    '8': { module: 'timetable', label: 'Timetable' },
    '9': { module: 'statistics', label: 'Statistics' },
    '0': { module: 'school-settings', label: 'Settings' },
    's': { module: 'school-settings', label: 'Settings' },
    'n': { module: 'notifications', label: 'Notifications' },
    'l': { module: 'system-logs', label: 'Logs' },
    'b': { module: 'backup-restore', label: 'Backup' },
    '?': { action: 'showShortcutsHelp', label: 'Help' }
};

// Phase detection
const PHASE = {
    PRE_MIDTERM: 'pre_midterm',
    POST_MIDTERM: 'post_midterm'
};
// Re-exports from config.js for backward compatibility
