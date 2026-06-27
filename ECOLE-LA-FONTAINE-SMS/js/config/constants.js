// js/config/constants.js
// Source lines: 9631–9708 of original monolith
// ============================================================



        // Default grading scale (used if no custom scale exists in DB)
        const DEFAULT_GRADES = [
            { grade: 'A+', min: 90, max: 100, desc: 'Excellent', color: '#10b981', sort_order: 1 },
            { grade: 'A', min: 80, max: 89, desc: 'Very Good', color: '#34d399', sort_order: 2 },
            { grade: 'B', min: 70, max: 79, desc: 'Good', color: '#60a5fa', sort_order: 3 },
            { grade: 'C', min: 60, max: 69, desc: 'Average', color: '#fbbf24', sort_order: 4 },
            { grade: 'D', min: 50, max: 59, desc: 'Below Average', color: '#f97316', sort_order: 5 },
            { grade: 'F', min: 0, max: 49, desc: 'Fail', color: '#ef4444', sort_order: 6 }
        ];

        // Student class promotion chain
        const PROMOTION_RULES = [
            { from: 'NURSERY 1', to: 'NURSERY 2' }, { from: 'NURSERY 2', to: 'NURSERY 3' },
            { from: 'NURSERY 3', to: 'PRIMARY 1' }, { from: 'PRIMARY 1', to: 'PRIMARY 2' },
            { from: 'PRIMARY 2', to: 'PRIMARY 3' }, { from: 'PRIMARY 3', to: 'PRIMARY 4' },
            { from: 'PRIMARY 4', to: 'PRIMARY 5' }, { from: 'PRIMARY 5', to: 'PRIMARY 6' },
            { from: 'PRIMARY 6', to: 'GRADUATED' }
        ];

        // Quick lookup map (class name → next class name)
        const PROMOTION_MAP = {
            'NURSERY 1': 'NURSERY 2', 'NURSERY 2': 'NURSERY 3', 'NURSERY 3': 'PRIMARY 1',
            'PRIMARY 1': 'PRIMARY 2', 'PRIMARY 2': 'PRIMARY 3', 'PRIMARY 3': 'PRIMARY 4',
            'PRIMARY 4': 'PRIMARY 5', 'PRIMARY 5': 'PRIMARY 6', 'PRIMARY 6': 'GRADUATED'
        };

        // Timetable schedule configuration
        const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const TIMETABLE_TIME_SLOTS = [
            '08:20-09:00', '09:00-09:40', '09:40-10:20',
            '10:20-10:40',  // ☕ Morning break
            '10:40-11:20', '11:20-12:00',
            '12:00-13:00',  // 🍽️ Lunch break
            '13:00-13:40', '13:40-14:20', '14:20-15:00',
            '15:00-15:20',  // ☕ Afternoon break
            '15:20-16:00', '16:00-16:40'
        ];

        // Assessment types accepted in the system
        const ASSESSMENT_TYPES = ['Quiz', 'Assignment', 'Mid-term', 'Exam', 'Final Exam'];

        // Payment methods accepted
        const PAYMENT_METHODS = ['Cash', 'Mobile-Money', 'Bank Transfer', 'Cheque'];

        // Student status options
        const STUDENT_STATUSES = ['Active', 'Inactive', 'Transferred', 'Graduated'];

        // User roles in the system
        const USER_ROLES = ['admin', 'accountant', 'teacher'];

        // Tables that may not exist in older DB versions — handle gracefully
        const OPTIONAL_TABLES = new Set([
            'promotions', 'student_archive', 'timetable_slots', 'holidays',
            'families', 'teacher_assignments', 'notifications', 'payment_allocations',
            'announcements', 'activity_logs', 'reminders', 'fee_templates',
            'payment_reversals', 'discounts', 'credit_balances'
        ]);

        // Error severity levels (used by logger)
        const ERROR_SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
        const ERROR_CATEGORIES = { NETWORK: 'network', DATABASE: 'database', AUTH: 'auth', VALIDATION: 'validation', RENDER: 'render', UNKNOWN: 'unknown' };

        // Timetable break slot helpers
        function isBreakSlot(ts) {
            return ts === '10:20-10:40' || ts === '12:00-13:00' || ts === '15:00-15:20';
        }
        function getBreakIcon(ts) {
            if (ts === '10:20-10:40') return '🍎';
            if (ts === '12:00-13:00') return '🍽️';
            if (ts === '15:00-15:20') return '☕';
            return '';
        }


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 2 — GLOBAL STATE MANAGEMENT
