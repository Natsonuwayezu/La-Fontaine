// ============================================================
// DATABASE - Advanced database operations and helpers
// ============================================================


// Refresh a specific table in state
async function refreshTable(table) {
    const map = {
        students: () => getAll('students', { is_deleted: false }).then(d => updateState('students', d)),
        teachers: () => getAll('teachers').then(d => updateState('teachers', d)),
        assessments: () => getAll('assessments').then(d => updateState('assessments', d)),
        marks: () => getAll('marks').then(d => updateState('marks', d)),
        classes: () => getAll('classes').then(d => updateState('classes', d)),
        subjects: () => getAll('subjects').then(d => updateState('subjects', d)),
        terms: () => getAll('terms').then(d => updateState('terms', d)),
        academic_years: () => getAll('academic_years').then(d => updateState('academicYears', d)),
        fee_categories: () => getAll('fee_categories').then(d => updateState('feeCategories', d)),
        fee_amounts: () => getAll('fee_amounts').then(d => updateState('feeAmounts', d)),
        student_fees: () => getAll('student_fees').then(d => updateState('studentFees', d)),
        payments: () => getAll('payments').then(d => updateState('payments', d)),
        families: () => getAll('families').then(d => updateState('families', d)),
        activity_logs: () => getAll('activity_logs').then(d => updateState('activityLogs', d))
    };

    if (map[table]) {
        await map[table]();
        return true;
    }
    return false;
}

// Load all initial data in parallel
async function loadInitialData() {
    const promises = [
        getAll('academic_years'),
        getAll('classes'),
        getAll('subjects'),
        getSchoolSettings(),
        getAll('terms'),
        getAll('students', { is_deleted: false }),
        getAll('teachers'),
        getAll('assessments'),
        getAll('marks', { order: 'id.asc', limit: 50000 }),
        getAll('fee_categories'),
        getAll('fee_amounts'),
        getAll('student_fees'),
        getAll('payments'),
        getAll('grading_scale'),
        getAll('families').catch(() => []),
        getAll('activity_logs').catch(() => [])
    ];

    const [
        academicYears, classes, subjects, settings, terms, students, teachers,
        assessments, marks, feeCategories, feeAmounts, studentFees, payments,
        gradingScale, families, activityLogs
    ] = await Promise.all(promises);

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

    // Apply school logo if exists
    if (settings.school_logo) {
        applySchoolLogo(settings.school_logo);
    }

    return true;
}

// Ensure state is loaded (lazy load if empty)
async function ensureStateLoaded() {
    const promises = [];
    if (!state.classes.length) promises.push(refreshTable('classes'));
    if (!state.subjects.length) promises.push(refreshTable('subjects'));
    if (!state.terms.length) promises.push(refreshTable('terms'));
    if (!state.students.length) promises.push(refreshTable('students'));
    if (!state.teachers.length) promises.push(refreshTable('teachers'));
    if (!state.families.length) promises.push(refreshTable('families').catch(() => { }));

    if (promises.length) await Promise.all(promises);
}

// Apply school logo to UI
function applySchoolLogo(logoData) {
    if (!logoData) return;
    const logoElements = document.querySelectorAll('.sidebar-logo, .report-logo, .receipt-logo');
    logoElements.forEach(el => {
        if (logoData.startsWith('data:image')) {
            el.innerHTML = `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;">`;
        } else if (logoData.startsWith('http')) {
            el.innerHTML = `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='🏫'">`;
        } else {
            el.innerHTML = logoData;
        }
    });
}

// Generate PWA assets from school settings
function generatePWAAssets() {
    const schoolName = state.schoolSettings?.school_name || 'ECOLE LA FONTAINE';
    const logo = state.schoolSettings?.school_logo || '';

    const manifest = {
        name: schoolName,
        short_name: schoolName.substring(0, 12),
        description: state.schoolSettings?.school_motto || 'School Management System',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1a3a5c',
        background_color: '#0f172a',
        icons: []
    };

    if (logo && (logo.startsWith('data:') || logo.startsWith('http'))) {
        manifest.icons.push({ src: logo, sizes: '192x192', type: 'image/png' });
        manifest.icons.push({ src: logo, sizes: '512x512', type: 'image/png' });
    } else {
        manifest.icons.push({ src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%231a3a5c"/%3E%3Ctext y=".9em" font-size="80" x="5"%3E🏫%3C/text%3E%3C/svg%3E', sizes: '192x192', type: 'image/svg+xml' });
    }

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;

    // Apple Touch Icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        document.head.appendChild(appleIcon);
    }
    appleIcon.href = logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%231a3a5c"/%3E%3Ctext y=".9em" font-size="80" x="5"%3E🏫%3C/text%3E%3C/svg%3E';

    // Favicon
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/x-icon';
        document.head.appendChild(favicon);
    }
    favicon.href = logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%231a3a5c"/%3E%3Ctext y=".9em" font-size="80" x="5"%3E🏫%3C/text%3E%3C/svg%3E';
}