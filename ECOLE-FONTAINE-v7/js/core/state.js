// ============================================================
// GLOBAL STATE - Single source of truth for all app data
// ============================================================

export const state = {
    // User & Session
    currentUser: null,

    // Academic Data
    classes: [],
    subjects: [],
    terms: [],
    academicYears: [],
    currentTerm: null,
    currentAcadYear: null,
    currentPhase: null,

    // People
    students: [],
    teachers: [],
    families: [],

    // Marks & Assessments
    assessments: [],
    marks: [],

    // Finance
    feeCategories: [],
    feeAmounts: [],
    studentFees: [],
    payments: [],

    // System
    schoolSettings: {},
    gradingScale: [],
    activityLogs: [],

    // Communication
    announcements: [],
    notifications: [],

    // UI State
    currentModule: null,
    loading: false,
    offline: false,

    // Cache for expensive operations
    cache: {
        studentBalances: new Map(),
        classStats: new Map(),
        ranks: new Map(),
        lastUpdate: Date.now()
    },

    // Subscribers for reactive updates
    subscribers: new Map()
};

// Helper functions to access state safely
export function getClassById(id) {
    return state.classes.find(c => c.id == id);
}

export function getSubjectById(id) {
    return state.subjects.find(s => s.id == id);
}

export function getTermById(id) {
    return state.terms.find(t => t.id == id);
}

export function getStudentById(id) {
    return state.students.find(s => s.id == id);
}

export function getTeacherById(id) {
    return state.teachers.find(t => t.id == id);
}

export function getCurrentUser() {
    return state.currentUser;
}

export function getCurrentAcademicYear() {
    return state.currentAcadYear;
}

export function getCurrentTerm() {
    return state.currentTerm;
}

export function getCurrentPhase() {
    return state.currentPhase;
}

// Role checks
export function isAdmin() {
    return state.currentUser?.role === 'admin';
}

export function isTeacher() {
    return state.currentUser?.role === 'teacher';
}

export function isAccountant() {
    return state.currentUser?.role === 'accountant';
}

// Subscribe to state changes
export function subscribe(key, callback) {
    if (!state.subscribers.has(key)) {
        state.subscribers.set(key, []);
    }
    state.subscribers.get(key).push(callback);
}

// Notify subscribers of changes
export function notify(key, newValue) {
    if (state.subscribers.has(key)) {
        state.subscribers.get(key).forEach(cb => cb(newValue));
    }
}

// Update state with automatic cache invalidation
export async function updateState(table, newData) {
    state[table] = newData;
    state.cache.lastUpdate = Date.now();

    // Invalidate related caches
    if (table === 'students' || table === 'studentFees' || table === 'payments') {
        state.cache.studentBalances.clear();
    }
    if (table === 'classes' || table === 'assessments' || table === 'marks') {
        state.cache.classStats.clear();
        state.cache.ranks.clear();
    }

    notify(table, newData);
}