// js/workers/search-worker.js
// Search Worker - Performs searches in background for better performance

self.addEventListener('message', function (e) {
    const { query, data, searchFields, options, taskId } = e.data;

    try {
        const results = performSearch(query, data, searchFields, options);

        self.postMessage({
            success: true,
            results: results,
            taskId: taskId,
            totalResults: results.length,
            searchTime: Date.now()
        });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message,
            taskId: taskId
        });
    }
});

function performSearch(query, data, searchFields, options = {}) {
    if (!query || query.length < (options.minLength || 2)) {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const { caseSensitive = false, fuzzy = false, limit = 100 } = options;

    let results = [];

    for (const item of data) {
        let relevance = 0;
        let matchedFields = [];

        for (const field of searchFields) {
            const fieldValue = getNestedValue(item, field);
            if (!fieldValue) continue;

            const valueStr = caseSensitive ? String(fieldValue) : String(fieldValue).toLowerCase();

            if (fuzzy) {
                // Fuzzy search - check if contains
                if (valueStr.includes(searchTerm)) {
                    const score = calculateRelevance(searchTerm, valueStr);
                    relevance += score;
                    matchedFields.push(field);
                }
            } else {
                // Exact match or starts with
                if (valueStr === searchTerm) {
                    relevance += 100;
                    matchedFields.push(field);
                } else if (valueStr.startsWith(searchTerm)) {
                    relevance += 50;
                    matchedFields.push(field);
                } else if (valueStr.includes(searchTerm)) {
                    relevance += 25;
                    matchedFields.push(field);
                }
            }
        }

        if (relevance > 0) {
            results.push({
                ...item,
                _relevance: relevance,
                _matchedFields: matchedFields
            });
        }

        if (results.length >= limit) break;
    }

    // Sort by relevance (highest first)
    results.sort((a, b) => b._relevance - a._relevance);

    return results;
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : null;
    }, obj);
}

function calculateRelevance(searchTerm, text) {
    if (!text) return 0;

    const termLen = searchTerm.length;
    const textLen = text.length;

    // Exact match
    if (text === searchTerm) return 100;

    // Starts with
    if (text.startsWith(searchTerm)) return 80;

    // Contains
    let score = 50;

    // Bonus for shorter texts (more relevant)
    score += Math.max(0, 30 - (textLen / 5));

    // Bonus for word boundaries
    const words = text.split(/\s+/);
    if (words.some(w => w === searchTerm)) score += 20;
    if (words.some(w => w.startsWith(searchTerm))) score += 10;

    return Math.min(100, score);
}

// Index building for faster searches
let searchIndex = new Map();

function buildSearchIndex(data, fields) {
    searchIndex.clear();

    for (const item of data) {
        const key = item.id || item.student_id || item.teacher_id || item.assessment_id;
        if (!key) continue;

        const searchableText = fields.map(field => {
            const value = getNestedValue(item, field);
            return value ? String(value).toLowerCase() : '';
        }).join(' ');

        searchIndex.set(key, searchableText);
    }

    return searchIndex.size;
}

function searchWithIndex(query, options = {}) {
    if (!query || searchIndex.size === 0) return [];

    const searchTerm = query.toLowerCase();
    const results = [];

    for (const [key, indexedText] of searchIndex.entries()) {
        if (indexedText.includes(searchTerm)) {
            results.push({ id: key, score: calculateRelevance(searchTerm, indexedText) });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.limit || 100);
}

// Specialized search functions
function searchStudents(students, query, options = {}) {
    const searchFields = ['first_name', 'last_name', 'student_code', 'guardian_name', 'guardian_phone'];
    return performSearch(query, students, searchFields, options);
}

function searchTeachers(teachers, query, options = {}) {
    const searchFields = ['name', 'email', 'username', 'department', 'phone'];
    return performSearch(query, teachers, searchFields, options);
}

function searchAssessments(assessments, query, options = {}) {
    const searchFields = ['assessment_name', 'assessment_type', 'class_name', 'subject_name'];
    return performSearch(query, assessments, searchFields, options);
}

function searchPayments(payments, query, options = {}) {
    const searchFields = ['receipt_number', 'student_name', 'payment_method', 'reference'];
    return performSearch(query, payments, searchFields, options);
}

// Auto-complete suggestions
function getSuggestions(data, field, prefix, limit = 5) {
    if (!prefix || prefix.length < 2) return [];

    const suggestions = new Set();
    const searchTerm = prefix.toLowerCase();

    for (const item of data) {
        const value = getNestedValue(item, field);
        if (value && String(value).toLowerCase().startsWith(searchTerm)) {
            suggestions.add(String(value));
        }
        if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions);
}

// Highlight search terms in text
function highlightText(text, query, highlightClass = 'search-highlight') {
    if (!query || !text) return text;

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return String(text).replace(regex, `<mark class="${highlightClass}">$1</mark>`);
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Batch search multiple data sources
function multiSourceSearch(queries, options = {}) {
    const results = {};

    for (const [sourceName, { data, fields, query }] of Object.entries(queries)) {
        if (query && data) {
            results[sourceName] = performSearch(query, data, fields, options);
        }
    }

    return results;
}