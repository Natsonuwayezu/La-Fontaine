// ============================================================
// DATA LOADER - Loading and refreshing application data
// ============================================================


// Track loading state
let isLoading = false;
let loadPromise = null;

// Add this to data-loader.js
async function ensureStateLoaded() {
    if (isStateLoaded()) return true;
    return await loadInitialData();
}

// Check if state is already loaded
function isStateLoaded() {
    return state.students.length > 0 && state.classes.length > 0;
}

// Load all initial data in parallel with error handling
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

// Refresh a specific table
async function refreshTable(tableName) {
    try {
        info(`Refreshing table: ${tableName}`, null, 'data-loader');

        const data = await getAll(tableName);
        updateState(tableName, data);

        return true;
    } catch (error) {
        logError(`Failed to refresh table: ${tableName}`, error, 'data-loader');
        handleError(error, { operation: 'refreshTable', table: tableName });
        return false;
    }
}

// Refresh multiple tables
async function refreshTables(tableNames) {
    const results = await Promise.all(tableNames.map(name => refreshTable(name)));
    return results.every(r => r === true);
}

// Reload entire state
async function reloadAllData() {
    showToast('Refreshing data...', 'info');
    await loadInitialData(true);
    showToast('Data refreshed', 'success');

    // Refresh current module view if reload function exists
    const currentModule = state.currentModule;
    if (currentModule && window[`render${currentModule}`]) {
        await window[`render${currentModule}`](document.getElementById('dynamic-content'));
    }
}

// Load data with progress callback
async function loadDataWithProgress(tables, onProgress) {
    const total = tables.length;
    let completed = 0;

    const results = {};

    for (const table of tables) {
        try {
            const data = await getAll(table);
            results[table] = data;
            updateState(table, data);
        } catch (error) {
            results[table] = [];
            logError(`Failed to load ${table}`, error, 'data-loader');
        }

        completed++;
        if (onProgress) {
            onProgress(completed, total, table);
        }
    }

    return results;
}

// Check if a table has data
async function hasTableData(tableName) {
    if (state[tableName]?.length > 0) return true;

    try {
        const data = await getAll(tableName);
        return data.length > 0;
    } catch {
        return false;
    }
}

// Preload data for a specific module
async function preloadModuleData(moduleName) {
    const moduleTables = {
        'finance': ['fee_categories', 'fee_amounts', 'student_fees', 'payments'],
        'students': ['students', 'classes', 'families'],
        'marks': ['assessments', 'marks', 'students', 'classes', 'subjects'],
        'dashboard': ['students', 'payments', 'assessments', 'marks']
    };

    const tables = moduleTables[moduleName] || [];
    if (tables.length === 0) return;

    for (const table of tables) {
        if (state[table]?.length === 0) {
            await refreshTable(table);
        }
    }
}