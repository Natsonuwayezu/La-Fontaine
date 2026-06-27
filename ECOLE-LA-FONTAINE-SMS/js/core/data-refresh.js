// js/core/data-refresh.js
// Source lines: 11432–11717 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 7.1 — Lookup Helpers (read from state)
        // ──────────────────────────────────────────────────────────────────────


        // Fast in-memory lookups — use these instead of re-querying the DB
        const getClassById = id => state.classes.find(c => c.id == id) || null;
        const getSubjectById = id => state.subjects.find(s => s.id == id) || null;
        const getTermById = id => state.terms.find(t => t.id == id) || null;
        const getStudentById = id => state.students.find(s => s.id == id) || null;
        const getTeacherById = id => state.teachers.find(t => t.id == id) || null;
        const getFamilyById = id => (state.families || []).find(f => f.id == id) || null;

        /**
         * Returns the current term's start date (YYYY-MM-DD), or today's date
         * if no current term is set. Used as the default "from" date for
         * date-range pickers (e.g. Attendance Summary).
         */
        function getStartOfTerm() {
            return state.currentTerm?.start_date || new Date().toISOString().split('T')[0];
        }

        /**
         * Returns 'completed', 'current', or 'upcoming' for a term based on
         * its start/end dates relative to today. Used by the Academic Years
         * page to show a status badge per term.
         */
        function getTermStatus(term) {
            if (!term) return 'upcoming';
            if (term.id === state.currentTerm?.id) return 'current';
            const today = new Date().toISOString().slice(0, 10);
            if (term.end_date && term.end_date < today) return 'completed';
            if (term.start_date && term.start_date > today) return 'upcoming';
            return 'current';
        }

        /**
         * Returns a new array of students sorted alphabetically by last name
         * (then first name as a tiebreaker). Used wherever a class roster
         * needs a stable, predictable order (e.g. report card student
         * pickers, register exports).
         */
        function sortStudentsByLastName(students) {
            return [...(students || [])].sort((a, b) => {
                const lastCompare = (a.last_name || '').localeCompare(b.last_name || '');
                if (lastCompare !== 0) return lastCompare;
                return (a.first_name || '').localeCompare(b.first_name || '');
            });
        }

        // Current session helpers
        const getCurrentUser = () => state.currentUser;
        const getCurrentAcademicYear = () => state.currentAcadYear;
        const getCurrentTerm = () => state.currentTerm;
        const hasRole = role => state.currentUser?.role === role;
        const isAdmin = () => state.currentUser?.role === 'admin';
        const isTeacher = () => state.currentUser?.role === 'teacher';
        const isAccountant = () => state.currentUser?.role === 'accountant';
        // Accountants handle finance only, never attendance.
        const canRecordAttendance = () => isAdmin() || isTeacher();

        // Student display name helpers
        const studentFullName = s => `${s.first_name || ''} ${s.last_name || ''}`.trim();
        const studentSortName = s => `${s.last_name || ''} ${s.first_name || ''}`.trim();
        const sortStudentsAlpha = arr =>
            [...arr].sort((a, b) => studentSortName(a).localeCompare(studentSortName(b)));
        window.sortStudentsAlphabetically = sortStudentsAlpha;



        // ──────────────────────────────────────────────────────────────────────
        // 7.2 — Initial Data Load
        // ──────────────────────────────────────────────────────────────────────

        // Guards used by loadInitialData() to avoid duplicate concurrent loads.
        let isLoading = false;
        let loadPromise = null;

        // Set to true once bootApp() completes successfully; prevents bootApp
        // from running twice (e.g. if called again by a stray event handler).
        let isBooted = false;

        /**
         * Lightweight console logging helpers used by loadInitialData() and
         * error-handling code. These were called but never defined, which
         * caused loadInitialData() to throw a ReferenceError on its very
         * first line — meaning login could never complete and no data was
         * ever fetched, regardless of network connectivity.
         */
        function info(message, data, context) {
            console.log(`[${context || 'info'}] ${message}`, data !== undefined && data !== null ? data : '');
        }

        function logError(message, error, context) {
            console.error(`[${context || 'error'}] ${message}`, error || '');
        }

        function handleError(error, meta) {
            console.error('[handleError]', error, meta || '');
        }

        /**
         * Returns true if the core tables that loadInitialData() populates are
         * already in state (so a plain loadInitialData() call without
         * forceRefresh can skip re-fetching everything from Supabase).
         */
        function isStateLoaded() {
            return state.classes.length > 0 && state.students.length > 0 && state.academicYears.length > 0;
        }

        /**
         * Load all tables from Supabase into state in parallel on boot.
         * Called once by bootApp() after a successful login.
         * Uses Promise.all() for maximum parallelism (~600ms on good connection).
         */
        async function loadInitialData(forceRefresh = false) {
            if (isLoading && loadPromise) {
                return loadPromise;
            }

            if (!forceRefresh && isStateLoaded()) {
                return true;
            }

            isLoading = true;
            info('Loading initial data...', null, 'data-loader');

            loadPromise = (async () => {
                try {
                    const promises = {
                        academicYears: getAll('academic_years'),
                        classes: getAll('classes'),
                        subjects: getAll('subjects'),
                        settings: getSchoolSettings(),
                        terms: getAll('terms'),
                        students: getAll('students', { is_deleted: false }),
                        teachers: getAll('teachers'),
                        assessments: getAll('assessments'),
                        marks: getAll('marks', { order: 'id.asc', limit: 50000 }),
                        feeCategories: getAll('fee_categories'),
                        feeAmounts: getAll('fee_amounts'),
                        studentFees: getAll('student_fees'),
                        payments: getAll('payments'),
                        gradingScale: getAll('grading_scale')
                    };

                    // Optional tables (don't fail if missing)
                    const optionalPromises = {
                        families: getAll('families').catch(() => []),
                        activityLogs: getAll('activity_logs').catch(() => [])
                    };

                    const results = await Promise.all(Object.values(promises));
                    const optionalResults = await Promise.all(Object.values(optionalPromises));

                    const [
                        academicYears, classes, subjects, settings, terms, students, teachers,
                        assessments, marks, feeCategories, feeAmounts, studentFees, payments,
                        gradingScale
                    ] = results;

                    const [families, activityLogs] = optionalResults;

                    // Update state
                    updateState('academicYears', academicYears);
                    updateState('classes', classes.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)));
                    updateState('subjects', subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)));
                    updateState('schoolSettings', settings);
                    updateState('terms', terms);
                    updateState('students', students);
                    updateState('teachers', teachers);
                    updateState('assessments', assessments);
                    updateState('marks', marks);
                    updateState('feeCategories', feeCategories);
                    updateState('feeAmounts', feeAmounts);
                    updateState('studentFees', studentFees);
                    updateState('payments', payments);
                    updateState('families', families || []);
                    updateState('activityLogs', activityLogs || []);

                    // Map grading scale
                    if (gradingScale && gradingScale.length) {
                        updateState('gradingScale', gradingScale.map(g => ({
                            grade: g.grade,
                            min: g.min_percentage,
                            max: g.max_percentage,
                            desc: g.description,
                            bg: g.color || '#d1fae5',
                            color: '#065f46'
                        })));
                    } else {
                        updateState('gradingScale', DEFAULT_GRADES);
                    }

                    // Set current academic year and term
                    const currentAcadYear = academicYears.find(y => y.is_active) || academicYears[academicYears.length - 1];
                    updateState('currentAcadYear', currentAcadYear);

                    const currentTerm = terms.find(t => t.name === (settings.current_term || 'Term 3'));
                    updateState('currentTerm', currentTerm);

                    info('Initial data loaded successfully', {
                        students: students.length,
                        classes: classes.length,
                        marks: marks.length
                    }, 'data-loader');

                    return true;
                } catch (error) {
                    logError('Failed to load initial data', error, 'data-loader');
                    handleError(error, { operation: 'loadInitialData' });
                    showToast('Failed to load data. Please refresh the page.', 'error');
                    return false;
                } finally {
                    isLoading = false;
                    loadPromise = null;
                }
            })();

            return loadPromise;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 7.3 — Selective Table Refresh
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Reload a single table in state after a mutation (insert/update/delete).
         * More efficient than reloading all data via loadInitialData().
         * Example: after recording a payment, call refreshTable('payments').
         */
        async function refreshTable(table) {
            const map = {
                students: () => getAll('students', { is_deleted: false }).then(d => state.students = d),
                teachers: () => getAll('teachers').then(d => state.teachers = d),
                assessments: () => getAll('assessments').then(d => state.assessments = d),
                marks: () => getAll('marks').then(d => state.marks = d),
                classes: () => getAll('classes').then(d => state.classes = d),
                subjects: () => getAll('subjects').then(d => state.subjects = d),
                fee_categories: () => getAll('fee_categories').then(d => state.feeCategories = d),
                fee_amounts: () => getAll('fee_amounts').then(d => state.feeAmounts = d),
                student_fees: () => getAll('student_fees').then(d => state.studentFees = d),
                payments: () => getAll('payments').then(d => state.payments = d),
                discounts: () => getAll('discounts').then(d => state.discounts = d)
            };
            if (map[table]) await map[table]();
        }



        // ──────────────────────────────────────────────────────────────────────
        // 7.4 — Lazy State Loader
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Ensure the most commonly needed tables are loaded.
         * Modules call this at the top of their render function as a safety net.
         * Only loads tables that are currently empty.
         */
        async function ensureStateLoaded() {
            const promises = [];
            if (!state.classes.length) promises.push(getAll('classes').then(d => {
                state.classes = d.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
            }));
            if (!state.subjects.length) promises.push(getAll('subjects').then(d => {
                state.subjects = d.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
            }));
            if (!state.terms.length) promises.push(getAll('terms').then(d => { state.terms = d; }));
            if (!state.students.length) promises.push(getAll('students', { is_deleted: false }).then(d => { state.students = d; }));
            if (!state.teachers.length) promises.push(getAll('teachers').then(d => { state.teachers = d; }));
            if (!state.families.length) promises.push(getAll('families').then(d => { state.families = d || []; }).catch(() => { state.families = []; }));
            if (promises.length) await Promise.all(promises).catch(e => console.warn('[State]', e));
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 8 — AUTHENTICATION & SESSION MANAGEMENT
