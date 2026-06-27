// js/core/state.js
// Source lines: 9709–9809 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════

        // Module-level UI/process state used across multiple functions.
        // Declared here (rather than inline) because 'use strict' forbids
        // assigning to undeclared variables — each of these was previously
        // assigned without a let/const/var, throwing a ReferenceError on
        // first use and breaking the calling function entirely.
        let isSyncing = false;          // syncOfflineMarks() in-progress guard
        let currentRole = null;         // buildSidebar() — role the sidebar was built for
        let currentActiveId = null;     // setActiveNav() — currently highlighted nav item id
        let currentModuleId = null;     // navigateTo() — currently loaded module id
        let financeChart = null;        // Chart.js instance for the finance dashboard
        let promotionData = [];         // renderStudentPromotion() — pending promotion rows
        let cancelGeneration = false;    // batch report generation — cancel flag
        let isGenerating = false;        // batch report generation — in-progress flag

        /**
         * state — Single source of truth for the whole application.
         * All modules read from here; data is loaded once on bootApp().
         * Use refreshTable() to reload a specific table after mutations.
         */
        const state = {
            // ── User & Session ──────────────────────────────────────
            currentUser: null,        // { id, role, name, username }
            currentModule: null,       // active module ID string

            // ── Academic ─────────────────────────────────────────────
            classes: [],          // all class rows
            subjects: [],          // all subject rows
            terms: [],          // all term rows
            academicYears: [],          // all academic year rows
            currentTerm: null,        // active term object
            currentAcadYear: null,     // active academic year object
            currentPhase: null,        // 'pre_midterm' | 'post_midterm'

            // ── People ───────────────────────────────────────────────
            students: [],          // all non-deleted students
            teachers: [],          // all teachers (includes accountants)
            families: [],          // family groups for sibling linking

            // ── Marks & Assessments ──────────────────────────────────
            assessments: [],          // all assessments
            marks: [],          // all marks rows

            // ── Finance ──────────────────────────────────────────────
            feeCategories: [],          // fee category definitions
            feeAmounts: [],          // per-class fee amounts
            studentFees: [],          // fee assignments per student
            payments: [],          // payment records
            paymentAllocations: [],    // payment → fee allocations

            // ── System & Config ──────────────────────────────────────
            schoolSettings: {},        // key-value settings from DB
            gradingScale: [],          // custom grading scale rows
            activityLogs: [],          // recent activity log rows

            // ── Communication ────────────────────────────────────────
            announcements: [],
            notifications: [],
            reminders: [],

            // ── UI State ─────────────────────────────────────────────
            loading: false,
            offline: false,

            // ── Cache (avoids redundant recalculation) ───────────────
            cache: {
                studentBalances: new Map(),
                classStats: new Map(),
                ranks: new Map(),
                lastUpdate: Date.now()
            },

            // ── Subscribers (for reactive updates) ───────────────────
            subscribers: new Map()
        };

        // Invalidate the cache when data changes
        function invalidateCache(key) {
            if (key) state.cache[key]?.clear?.();
            else {
                state.cache.studentBalances.clear();
                state.cache.classStats.clear();
                state.cache.ranks.clear();
            }
            state.cache.lastUpdate = Date.now();
        }

        /**
         * Update a top-level key on the global `state` object and invalidate
         * any derived caches (student balances, class stats, ranks) since the
         * underlying data just changed. Used throughout loadInitialData().
         */
        function updateState(key, value) {
            state[key] = value;
            invalidateCache();
        }


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 3 — API & DATABASE (Supabase REST)
