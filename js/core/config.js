// ============================================================
// CONFIGURATION - Supabase Settings & App Constants
// ============================================================

// Supabase Configuration (can be overridden via API Settings)
const SUPABASE_URL_DEFAULT = localStorage.getItem('sb_url') || 'https://hejdppzparottbcnycjo.supabase.co';
const SUPABASE_KEY_DEFAULT = localStorage.getItem('sb_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlamRwcHpwYXJvdHRiY255Y2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Nzg3OTMsImV4cCI6MjA5NDQ1NDc5M30.vi7Xa3eF9D9OTCkDZUYn6ScsyuQPwb0eN9nNazPpFcc';

let SUPABASE_URL = SUPABASE_URL_DEFAULT;
let SUPABASE_KEY = SUPABASE_KEY_DEFAULT;

// App Configuration
const APP_CONFIG = {
    name: 'ECOLE LA FONTAINE',
    version: '6.0',
    sessionDuration: 60 * 60 * 1000, // 1 hour
    autoBackupInterval: 6 * 60 * 60 * 1000, // 6 hours
    autoArchiveDays: 365,
    itemsPerPage: 20,
    maxRecentActivities: 10
};

// File Upload Limits
const UPLOAD_LIMITS = {
    maxLogoSize: 2 * 1024 * 1024, // 2MB
    maxBulkImportRows: 500,
    allowedImageTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    allowedExcelTypes: ['.xlsx', '.xls', '.csv']
};

// Date Formats
const DATE_FORMATS = {
    display: 'DD/MM/YYYY',
    api: 'YYYY-MM-DD',
    report: 'DD MMM YYYY',
    receipt: 'DD/MM/YYYY',
    iso: 'YYYY-MM-DDTHH:mm:ss.sssZ'
};

// Currency Settings
const CURRENCY = {
    code: 'RWF',
    symbol: 'RWF',
    locale: 'en-RW',
    decimalPlaces: 0
};

// Default Grading Scale (loaded if no custom scale in DB)
const DEFAULT_GRADES = [
    { grade: 'A+', min: 90, max: 100, desc: 'Excellent', color: '#10b981' },
    { grade: 'A', min: 80, max: 89, desc: 'Very Good', color: '#34d399' },
    { grade: 'B', min: 70, max: 79, desc: 'Good', color: '#60a5fa' },
    { grade: 'C', min: 60, max: 69, desc: 'Average', color: '#fbbf24' },
    { grade: 'D', min: 50, max: 59, desc: 'Below Average', color: '#f97316' },
    { grade: 'F', min: 0, max: 49, desc: 'Fail', color: '#ef4444' }
];

// Promotion Rules (from class to next class)
const PROMOTION_MAP = {
    'NURSERY 1': 'NURSERY 2',
    'NURSERY 2': 'NURSERY 3',
    'NURSERY 3': 'PRIMARY 1',
    'PRIMARY 1': 'PRIMARY 2',
    'PRIMARY 2': 'PRIMARY 3',
    'PRIMARY 3': 'PRIMARY 4',
    'PRIMARY 4': 'PRIMARY 5',
    'PRIMARY 5': 'PRIMARY 6',
    'PRIMARY 6': 'GRADUATED'
};

const PROMOTION_RULES = [
    { from: 'NURSERY 1', to: 'NURSERY 2' },
    { from: 'NURSERY 2', to: 'NURSERY 3' },
    { from: 'NURSERY 3', to: 'PRIMARY 1' },
    { from: 'PRIMARY 1', to: 'PRIMARY 2' },
    { from: 'PRIMARY 2', to: 'PRIMARY 3' },
    { from: 'PRIMARY 3', to: 'PRIMARY 4' },
    { from: 'PRIMARY 4', to: 'PRIMARY 5' },
    { from: 'PRIMARY 5', to: 'PRIMARY 6' },
    { from: 'PRIMARY 6', to: 'GRADUATED' }
];

// Timetable Configuration
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_TIME_SLOTS = [
    '08:20-09:00', '09:00-09:40', '09:40-10:20', '10:20-10:40',
    '10:40-11:20', '11:20-12:00', '12:00-13:00', '13:00-13:40',
    '13:40-14:20', '14:20-15:00', '15:00-15:20', '15:20-16:00', '16:00-16:40'
];

function isBreakSlot(ts) {
    return ts === '10:20-10:40' || ts === '12:00-13:00' || ts === '15:00-15:20';
}

function getBreakIcon(ts) {
    if (ts === '10:20-10:40') return '🍎';
    if (ts === '12:00-13:00') return '🍽️';
    if (ts === '15:00-15:20') return '☕';
    return '';
}

// Notification Types
const NOTIFICATION_TYPES = {
    NEW: 'new',
    UNREAD: 'unread',
    READ: 'read',
    OVERDUE: 'overdue',
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error'
};

// Payment Methods
const PAYMENT_METHODS = ['Cash', 'Mobile-Money', 'Bank Transfer', 'Cheque'];

// Assessment Types
const ASSESSMENT_TYPES = ['Quiz', 'Assignment', 'Mid-term', 'Exam', 'Final Exam'];

// Fee Reset Frequencies
const FEE_RESET_FREQUENCIES = ['one_time', 'termly', 'monthly', 'annual'];

// Student Statuses
const STUDENT_STATUSES = ['Active', 'Inactive', 'Transferred', 'Graduated'];

// Gender Options
const GENDERS = ['Male', 'Female', 'Other'];

// Teacher Roles
const USER_ROLES = ['admin', 'accountant', 'teacher'];

// Tables that may be optional (graceful handling)
const OPTIONAL_TABLES = new Set([
    'promotions', 'student_archive', 'timetable_slots', 'holidays',
    'families', 'teacher_assignments', 'notifications', 'payment_allocations',
    'announcements', 'activity_logs'
]);