// ============================================================
// SEARCH ENGINE - Universal search across all modules
// ============================================================


// Search indexes
let searchIndex = {
    students: [],
    teachers: [],
    classes: [],
    payments: [],
    assessments: []
};

// Build search index from state data
function buildSearchIndex() {
    // Index students
    searchIndex.students = (state.students || []).map(s => ({
        id: s.id,
        type: 'student',
        title: `${s.first_name} ${s.last_name}`,
        subtitle: `Student Code: ${s.student_code || 'N/A'} | Class: ${getClassName(s.class_id)}`,
        url: `student-details?view_student=${s.id}`,
        icon: '👤',
        keywords: [
            s.first_name, s.last_name, s.student_code,
            getClassName(s.class_id), s.guardian_name
        ].filter(Boolean).map(k => k.toLowerCase())
    }));

    // Index teachers
    searchIndex.teachers = (state.teachers || []).map(t => ({
        id: t.id,
        type: 'teacher',
        title: t.name,
        subtitle: `Department: ${t.department || 'General'} | Role: ${t.role}`,
        url: `teachers-list?view=${t.id}`,
        icon: '👩‍🏫',
        keywords: [t.name, t.email, t.username, t.department].filter(Boolean).map(k => k.toLowerCase())
    }));

    // Index classes
    searchIndex.classes = (state.classes || []).map(c => ({
        id: c.id,
        type: 'class',
        title: c.name,
        subtitle: `Code: ${c.code} | Students: ${getStudentCount(c.id)}`,
        url: `class-register?class=${c.id}`,
        icon: '🏛️',
        keywords: [c.name, c.code, c.level].filter(Boolean).map(k => k.toLowerCase())
    }));

    // Index payments (for accountant/admin)
    searchIndex.payments = (state.payments || []).slice(0, 500).map(p => {
        const student = getStudentById(p.student_id);
        return {
            id: p.id,
            type: 'payment',
            title: `Receipt: ${p.receipt_number || 'N/A'}`,
            subtitle: `Student: ${student?.first_name} ${student?.last_name} | Amount: ${p.amount.toLocaleString()} RWF`,
            url: `payment-history?receipt=${p.receipt_number}`,
            icon: '💰',
            keywords: [
                p.receipt_number, student?.first_name, student?.last_name,
                p.payment_method, p.amount.toString()
            ].filter(Boolean).map(k => k.toLowerCase())
        };
    });

    // Index assessments
    searchIndex.assessments = (state.assessments || []).map(a => ({
        id: a.id,
        type: 'assessment',
        title: a.assessment_name,
        subtitle: `Class: ${getClassName(a.class_id)} | Subject: ${getSubjectName(a.subject_id)} | Type: ${a.assessment_type}`,
        url: `marks-entry?assessment=${a.id}`,
        icon: '📝',
        keywords: [
            a.assessment_name, a.assessment_type,
            getClassName(a.class_id), getSubjectName(a.subject_id)
        ].filter(Boolean).map(k => k.toLowerCase())
    }));
}

// Helper functions for search
function getClassName(classId) {
    const cls = state.classes.find(c => c.id == classId);
    return cls?.name || 'Unknown';
}

function getSubjectName(subjectId) {
    const sub = state.subjects.find(s => s.id == subjectId);
    return sub?.name || 'Unknown';
}

function getStudentCount(classId) {
    return (state.students || []).filter(s => s.class_id == classId && s.status === 'Active').length;
}

// Search across all indexes
function search(query, options = {}) {
    const { limit = 20, types = ['student', 'teacher', 'class', 'payment', 'assessment'] } = options;

    if (!query || query.trim().length < 2) {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    for (const type of types) {
        const items = searchIndex[`${type}s`] || [];
        for (const item of items) {
            const matches = item.keywords.some(keyword => keyword.includes(searchTerm)) ||
                item.title.toLowerCase().includes(searchTerm) ||
                item.subtitle.toLowerCase().includes(searchTerm);

            if (matches) {
                results.push({
                    ...item,
                    relevance: calculateRelevance(item, searchTerm)
                });
            }
        }
    }

    // Sort by relevance and limit
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
}

// Calculate relevance score for sorting
function calculateRelevance(item, searchTerm) {
    let score = 0;

    // Title match (highest weight)
    if (item.title.toLowerCase() === searchTerm) score += 100;
    else if (item.title.toLowerCase().startsWith(searchTerm)) score += 50;
    else if (item.title.toLowerCase().includes(searchTerm)) score += 30;

    // Subtitle match
    if (item.subtitle.toLowerCase().includes(searchTerm)) score += 10;

    // Exact keyword match
    if (item.keywords.some(k => k === searchTerm)) score += 20;

    return score;
}

// Quick search for command palette (Ctrl+K)
function quickSearch(query) {
    return search(query, { limit: 10 });
}

// Search students specifically
function searchStudents(query, filters = {}) {
    let results = search(query, { types: ['student'], limit: 100 });

    if (filters.classId) {
        results = results.filter(r => {
            const student = state.students.find(s => s.id == r.id);
            return student?.class_id == filters.classId;
        });
    }

    if (filters.status) {
        results = results.filter(r => {
            const student = state.students.find(s => s.id == r.id);
            return student?.status === filters.status;
        });
    }

    return results;
}

// Search payments specifically
function searchPayments(query) {
    return search(query, { types: ['payment'], limit: 50 });
}

// Rebuild index when state changes
function refreshSearchIndex() {
    buildSearchIndex();
}

// Initial build
if (typeof window !== 'undefined') {
    // Debounced rebuild on state changes
    let rebuildTimeout;
    const debouncedRebuild = () => {
        clearTimeout(rebuildTimeout);
        rebuildTimeout = setTimeout(() => {
            buildSearchIndex();
        }, 1000);
    };

    // Listen for state updates
    document.addEventListener('stateUpdated', debouncedRebuild);
}