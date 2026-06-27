// js/config/role-permissions.js
// Source lines: 9549–9582 of original monolith
// ============================================================

        const TEACHER_BLOCKED_MODULES = new Set([
            'fee-structure','payment-history','record-payment','financial-reports',
            'overdue-payments','fee-waivers','receipts','carry-forward',
            'student-fee-status','finance-audit','manual-adjustments',
            'bulk-finance-actions','fee-assignments','fee-term-status',
            'credit-balances','discounts','family-fee-summary','balances',
            'finance-dashboard','receipt-printing'
        ]);

        // Modules blocked for accountants (academic access denied)
        const ACCOUNTANT_BLOCKED_MODULES = new Set([
            'marks-entry','marks-database','class-register','annual-register',
            'assessments','report-cards','rankings','statistics','timetable',
            'teacher-timetable','class-timetable','assessment-locking',
            'marks-analysis','marks-import-export','assessment-export',
            'register-export','report-generator','ranking-engine',
            'academic-reports','transcript','teacher-assignments',
            'teacher-performance','teachers-list','subjects',
            'student-promotion','student-archive','bulk-import','bulk-export',
            'enroll-student'
        ]);



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 1 — CONFIGURATION & CONSTANTS
        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 1.1 — Supabase Credentials (overridable from API Settings page)
        // ──────────────────────────────────────────────────────────────────────

