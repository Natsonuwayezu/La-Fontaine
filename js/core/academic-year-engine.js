// ============================================================
// ACADEMIC YEAR ENGINE - Year and term management
// ============================================================


// Switch academic year
async function switchAcademicYear(yearId) {
    yearId = parseInt(yearId);
    const year = state.academicYears.find(y => y.id === yearId);
    if (!year) return;

    if (!await confirmDialog(`Switch to academic year "${year.name}"? The app will reload data.`)) {
        return;
    }

    updateState('currentAcadYear', year);
    await updateSchoolSetting('current_year', year.name);

    // Update current term based on new year
    const terms = await getAll('terms', { academic_year_id: yearId });
    const activeTerm = terms.find(t => t.is_active) || terms[0];
    if (activeTerm) {
        updateState('currentTerm', activeTerm);
        await updateSchoolSetting('current_term', activeTerm.name);
    }

    showToast(`✅ Switched to ${year.name}`, 'success');

    // Reload current module
    const currentModule = state.currentModule;
    if (currentModule && window[`render${currentModule}`]) {
        await window[`render${currentModule}`](document.getElementById('dynamic-content'));
    }
}

// Create academic year with auto-created 3 terms
async function createAcademicYearWithTerms(name, startDate = null, endDate = null, isActive = false) {
    if (!name) {
        showToast('Academic year name required', 'warning');
        return null;
    }

    const year = await insert('academic_years', {
        name: name,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive,
        created_at: new Date().toISOString()
    });

    if (!year) {
        showToast('Failed to create academic year', 'error');
        return null;
    }

    // If this year is active, deactivate others
    if (isActive) {
        for (const y of state.academicYears) {
            if (y.id !== year.id) {
                await update('academic_years', y.id, { is_active: false });
            }
        }
    }

    // Auto-create 3 terms with default dates
    const startDateObj = startDate ? new Date(startDate) : new Date();
    const termDefs = [
        { name: 'Term 1', offset_months: 0, duration_months: 3 },
        { name: 'Term 2', offset_months: 3, duration_months: 3 },
        { name: 'Term 3', offset_months: 6, duration_months: 3 }
    ];

    for (let i = 0; i < termDefs.length; i++) {
        const def = termDefs[i];
        const termStart = new Date(startDateObj);
        termStart.setMonth(termStart.getMonth() + def.offset_months);

        const termEnd = new Date(termStart);
        termEnd.setMonth(termEnd.getMonth() + def.duration_months - 1);

        const midterm = new Date(termStart);
        midterm.setMonth(midterm.getMonth() + Math.floor(def.duration_months / 2));

        await insert('terms', {
            name: def.name,
            academic_year_id: year.id,
            term_number: i + 1,
            start_date: termStart.toISOString().split('T')[0],
            end_date: termEnd.toISOString().split('T')[0],
            midterm_date: midterm.toISOString().split('T')[0],
            is_active: i === 0,
            created_at: new Date().toISOString()
        });
    }

    await refreshTable('academic_years');
    await refreshTable('terms');

    showToast(`✅ Academic year "${name}" created with 3 terms`, 'success');
    return year;
}

// Get current phase (Pre-Midterm or Post-Midterm)
function getCurrentPhase(term = null) {
    const currentTerm = term || state.currentTerm;
    if (!currentTerm?.midterm_date) return 'post_midterm';

    const today = new Date();
    const midtermDate = new Date(currentTerm.midterm_date);

    return today < midtermDate ? 'pre_midterm' : 'post_midterm';
}

// Calculate term progress percentage
function getTermProgress(term = null) {
    const currentTerm = term || state.currentTerm;
    if (!currentTerm?.start_date || !currentTerm?.end_date) {
        return { pct: 0, daysLeft: 0, text: 'No term data' };
    }

    const start = new Date(currentTerm.start_date);
    const end = new Date(currentTerm.end_date);
    const now = new Date();

    if (now < start) {
        const daysLeft = Math.ceil((end - start) / 86400000);
        return { pct: 0, daysLeft, text: 'Not started' };
    }

    if (now > end) {
        return { pct: 100, daysLeft: 0, text: 'Term ended' };
    }

    const total = end - start;
    const elapsed = now - start;
    const pct = (elapsed / total) * 100;
    const daysLeft = Math.ceil((end - now) / 86400000);

    return {
        pct: Math.round(pct),
        daysLeft,
        text: `${Math.round(pct)}% complete`
    };
}

// Auto-lock assessments when term ends
async function autoLockTermAssessments(termId) {
    const assessments = await getAll('assessments', { term_id: termId, is_locked: false });
    let locked = 0;

    for (const assessment of assessments) {
        await update('assessments', assessment.id, { is_locked: true });
        locked++;
    }

    if (locked > 0) {
        info(`Auto-locked ${locked} assessments for term ${termId}`, null, 'academic-year-engine');
        await refreshTable('assessments');
    }

    return locked;
}

// Get next class for promotion
function getNextClass(currentClassName) {
    const promotionMap = {
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
    return promotionMap[currentClassName] || null;
}

// Get all terms for current academic year
function getTermsForCurrentYear() {
    const yearId = state.currentAcadYear?.id;
    if (!yearId) return [];
    return state.terms.filter(t => t.academic_year_id === yearId);
}

// Get active term (current)
function getActiveTerm() {
    const today = new Date();
    const terms = getTermsForCurrentYear();
    return terms.find(t => {
        const start = new Date(t.start_date);
        const end = new Date(t.end_date);
        return today >= start && today <= end;
    }) || terms[0];
}

// Update term dates
async function updateTermDates(termId, startDate, endDate, midtermDate) {
    await update('terms', termId, {
        start_date: startDate,
        end_date: endDate,
        midterm_date: midtermDate,
        updated_at: new Date().toISOString()
    });
    await refreshTable('terms');
    showToast('✅ Term dates updated', 'success');
}

// Set current term
async function setCurrentTerm(termId) {
    const term = state.terms.find(t => t.id === termId);
    if (!term) return;

    await updateSchoolSetting('current_term', term.name);
    updateState('currentTerm', term);
    showToast(`✅ Current term set to ${term.name}`, 'success');

    // Reload current module
    const currentModule = state.currentModule;
    if (currentModule && window[`render${currentModule}`]) {
        await window[`render${currentModule}`](document.getElementById('dynamic-content'));
    }
}

// Check if term is current (in progress)
function isTermCurrent(term) {
    const today = new Date();
    const start = new Date(term.start_date);
    const end = new Date(term.end_date);
    return today >= start && today <= end;
}

// Get term status (upcoming, current, completed)
function getTermStatus(term) {
    const today = new Date();
    const start = term.start_date ? new Date(term.start_date) : null;
    const end = term.end_date ? new Date(term.end_date) : null;

    if (!start || !end) return 'upcoming';
    if (today > end) return 'completed';
    if (today >= start && today <= end) return 'current';
    return 'upcoming';
}
// Alias for backward compatibility
