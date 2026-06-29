// ============================================================
// PERMISSIONS - Role-based access control
// ============================================================


// Permission definitions
const PERMISSIONS = {
    // Finance permissions
    VIEW_FEES: ['admin', 'accountant'],
    MANAGE_FEES: ['admin', 'accountant'],
    RECORD_PAYMENT: ['admin', 'accountant'],
    VIEW_FINANCIAL_REPORTS: ['admin', 'accountant'],

    // Academic permissions
    ENTER_MARKS: ['admin', 'teacher'],
    VIEW_MARKS: ['admin', 'teacher'],
    CREATE_ASSESSMENT: ['admin', 'teacher'],
    LOCK_ASSESSMENT: ['admin'],

    // Student management
    ENROLL_STUDENT: ['admin'],
    EDIT_STUDENT: ['admin'],
    DELETE_STUDENT: ['admin'],
    VIEW_STUDENT_FEES: ['admin', 'accountant'],
    VIEW_STUDENT_ACADEMICS: ['admin', 'teacher'],

    // Staff management
    MANAGE_TEACHERS: ['admin'],
    MANAGE_SUBJECTS: ['admin'],
    ASSIGN_TEACHER: ['admin'],

    // System
    MANAGE_SETTINGS: ['admin'],
    VIEW_LOGS: ['admin'],
    MANAGE_BACKUPS: ['admin'],
    VIEW_ANALYTICS: ['admin', 'teacher']
};

// Module to permission mapping
const MODULE_PERMISSIONS = {
    'fee-structure': ['admin', 'accountant'],
    'payment-history': ['admin', 'accountant'],
    'record-payment': ['admin', 'accountant'],
    'financial-reports': ['admin', 'accountant'],
    'overdue-payments': ['admin', 'accountant'],
    'fee-waivers': ['admin', 'accountant'],
    'receipts': ['admin', 'accountant'],
    'student-fees': ['admin', 'accountant'],

    'marks-entry': ['admin', 'teacher'],
    'marks-database': ['admin', 'teacher'],
    'class-register': ['admin', 'teacher'],
    'statistics': ['admin', 'teacher'],
    'report-cards': ['admin', 'teacher'],
    'assessments': ['admin', 'teacher'],
    'timetable': ['admin', 'teacher'],

    'student-list': ['admin', 'teacher', 'accountant'],
    'student-details': ['admin', 'teacher', 'accountant'],
    'sibling-linking': ['admin', 'accountant'],

    'teachers-list': ['admin', 'teacher'],
    'staff-timetable': ['admin', 'teacher'],

    'school-settings': ['admin'],
    'academic-calendar': ['admin'],
    'class-management': ['admin'],
    'grading-scale': ['admin'],
    'user-management': ['admin'],
    'backup-restore': ['admin'],
    'system-logs': ['admin'],
    'api-settings': ['admin'],
    'analytics': ['admin', 'teacher'],

    'notifications': ['admin', 'teacher', 'accountant'],
    'announcements': ['admin']
};

// Check if current user has a specific permission
function hasPermission(permission) {
    const userRole = getCurrentUser()?.role;
    if (!userRole) return false;

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;

    return allowedRoles.includes(userRole);
}

// Check if current user can access a module
function canAccessModule(moduleId) {
    const userRole = getCurrentUser()?.role;
    if (!userRole) return false;

    // Admin has access to everything
    if (userRole === 'admin') return true;

    const allowedRoles = MODULE_PERMISSIONS[moduleId];
    if (!allowedRoles) return false;

    return allowedRoles.includes(userRole);
}

// Check if current user can perform an action on a student
function canModifyStudent(studentId = null) {
    const userRole = getCurrentUser()?.role;
    if (userRole === 'admin') return true;
    if (userRole === 'accountant') return false;
    if (userRole === 'teacher') {
        // Teacher can only modify students in their assigned classes
        if (!studentId) return false;
        const student = state.students.find(s => s.id == studentId);
        if (!student) return false;
        // Check if teacher is assigned to this student's class
        const assignments = state.teacherAssignments || [];
        return assignments.some(a => a.class_id === student.class_id && a.teacher_id === getCurrentUser()?.id);
    }
    return false;
}

// Check if current user can view student fees
function canViewStudentFees() {
    const userRole = getCurrentUser()?.role;
    return userRole === 'admin' || userRole === 'accountant';
}

// Check if current user can view student academics
function canViewStudentAcademics() {
    const userRole = getCurrentUser()?.role;
    return userRole === 'admin' || userRole === 'teacher';
}

// Check if current user can edit student fees
function canEditStudentFees() {
    const userRole = getCurrentUser()?.role;
    return userRole === 'admin' || userRole === 'accountant';
}

// Get allowed student tabs based on role
function getAllowedStudentTabs() {
    const userRole = getCurrentUser()?.role;

    const allTabs = ['info', 'fees', 'academics', 'family', 'history'];

    if (userRole === 'admin') return allTabs;
    if (userRole === 'teacher') return ['info', 'academics', 'family'];
    if (userRole === 'accountant') return ['info', 'fees', 'family', 'history'];

    return ['info'];
}

// Check if a tab should be shown for a student
function canViewStudentTab(tabName) {
    const allowedTabs = getAllowedStudentTabs();
    return allowedTabs.includes(tabName);
}

// Get navigation items based on user role
function getNavigationConfig() {
    const userRole = getCurrentUser()?.role;
    if (!userRole) return [];

    const configs = {
        admin: [
            { section: 'Dashboard', items: [{ id: 'admin-dashboard', icon: '📊', label: 'Main Dashboard' }, { id: 'notifications', icon: '🔔', label: 'Notifications' }] },
            { section: 'Academics', items: [{ id: 'marks-entry', icon: '✏️', label: 'Marks Entry' }, { id: 'class-register', icon: '📋', label: 'Class Register' }, { id: 'statistics', icon: '📈', label: 'Statistics' }, { id: 'timetable', icon: '🕐', label: 'Timetable' }, { id: 'report-cards', icon: '📄', label: 'Report Cards' }, { id: 'assessments', icon: '📝', label: 'Assessments' }] },
            { section: 'Students', items: [{ id: 'student-list', icon: '📋', label: 'Student List' }, { id: 'enroll-student', icon: '➕', label: 'Enroll Student' }, { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }, { id: 'student-fees', icon: '💰', label: 'Student Fees' }, { id: 'sibling-linking', icon: '👨‍👩‍👧', label: 'Sibling Linking' }, { id: 'student-archive', icon: '📦', label: 'Student Archive' }, { id: 'bulk-import', icon: '📤', label: 'Bulk Import' }, { id: 'bulk-export', icon: '📥', label: 'Bulk Export' }, { id: 'student-promotion', icon: '🎓', label: 'Student Promotion' }] },
            { section: 'Finance', items: [{ id: 'fee-structure', icon: '🏷️', label: 'Fee Structure' }, { id: 'payment-history', icon: '📜', label: 'Payment History' }, { id: 'record-payment', icon: '💸', label: 'Record Payment' }, { id: 'financial-reports', icon: '📊', label: 'Financial Reports' }, { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' }, { id: 'fee-waivers', icon: '🎁', label: 'Fee Waivers' }, { id: 'receipts', icon: '🧾', label: 'Receipts' }] },
            { section: 'Staff', items: [{ id: 'teachers-list', icon: '📋', label: 'Teachers List' }, { id: 'subjects', icon: '📖', label: 'Subjects' }, { id: 'teacher-assignments', icon: '📌', label: 'Assignments' }, { id: 'teacher-performance', icon: '⭐', label: 'Teacher Performance' }] },
            { section: 'Settings', items: [{ id: 'school-settings', icon: '🏫', label: 'School Settings' }, { id: 'academic-calendar', icon: '📅', label: 'Academic Calendar' }, { id: 'class-management', icon: '🏛️', label: 'Class Management' }, { id: 'grading-scale', icon: '📊', label: 'Grading Scale' }, { id: 'user-management', icon: '👥', label: 'User Management' }, { id: 'backup-restore', icon: '💾', label: 'Backup & Restore' }, { id: 'system-logs', icon: '📋', label: 'System Logs' }, { id: 'analytics', icon: '📊', label: 'Analytics' }, { id: 'api-settings', icon: '🔌', label: 'API Settings' }] }
        ],
        accountant: [
            {
                section: 'Dashboard', items: [
                    { id: 'accountant-dashboard', icon: '📊', label: 'Main Dashboard' },
                    { id: 'notifications', icon: '🔔', label: 'Notifications' }
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
                    { id: 'bulk-export', icon: '📥', label: 'Bulk Export' }
                ]
            }
        ],
        teacher: [
            { section: 'Dashboard', items: [{ id: 'teacher-dashboard', icon: '📊', label: 'Main Dashboard' }, { id: 'notifications', icon: '🔔', label: 'Notifications' }] },
            { section: 'Academics', items: [{ id: 'marks-entry', icon: '✏️', label: 'Marks Entry' }, { id: 'class-register', icon: '📋', label: 'Class Register' }, { id: 'statistics', icon: '📈', label: 'Statistics' }, { id: 'timetable', icon: '🕐', label: 'Timetable' }, { id: 'report-cards', icon: '📄', label: 'Report Cards' }, { id: 'assessments', icon: '📝', label: 'Assessments' }] },
            { section: 'Students', items: [{ id: 'student-list', icon: '📋', label: 'Student List' }, { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }] }
        ]
    };

    return configs[userRole] || [];
}

// Guard function for modules (shows access denied)
function checkModuleAccess(moduleId) {
    if (!canAccessModule(moduleId)) {
        const container = document.getElementById('dynamic-content');
        if (container) {
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-body" style="text-align:center;padding:60px 20px">
                        <div style="font-size:3rem;margin-bottom:16px">🔒</div>
                        <h3 style="color:var(--text-muted)">Access Restricted</h3>
                        <p style="color:var(--text-muted)">You don't have permission to access this module.</p>
                    </div>
                </div>
            `;
        }
        return false;
    }
    return true;
}