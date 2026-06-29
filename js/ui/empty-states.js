// ============================================================
// EMPTY STATES UI - Empty state components for no data
// ============================================================

// Create empty state component
function createEmptyState(icon, title, message, action = null) {
    const container = document.createElement('div');
    container.className = 'empty-state';

    container.innerHTML = `
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${escapeHtml(title)}</div>
        <div class="empty-state-message">${escapeHtml(message)}</div>
        ${action ? `<div class="empty-state-action">${action}</div>` : ''}
    `;

    return container;
}

// Create compact empty state (smaller version)
function createCompactEmptyState(icon, message) {
    const container = document.createElement('div');
    container.className = 'empty-state empty-state-compact';

    container.innerHTML = `
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-message">${escapeHtml(message)}</div>
    `;

    return container;
}

// Create table empty state (for tables with no data)
function createTableEmptyState(message = 'No data available', colSpan = 1) {
    const tr = document.createElement('tr');
    tr.className = 'table-empty-state';
    tr.innerHTML = `
        <td colspan="${colSpan}" style="text-align: center; padding: 60px 20px;">
            <div class="empty-state-icon" style="font-size: 3rem; margin-bottom: 12px;">📭</div>
            <div style="color: var(--text-muted);">${escapeHtml(message)}</div>
        </td>
    `;
    return tr;
}

// Create search empty state
function createSearchEmptyState(searchTerm, onClear) {
    const container = document.createElement('div');
    container.className = 'empty-state';

    container.innerHTML = `
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No results found</div>
        <div class="empty-state-message">No matching results for "${escapeHtml(searchTerm)}"</div>
        <div class="empty-state-action">
            <button class="btn btn-outline btn-sm" id="clear-search-btn">Clear Search</button>
        </div>
    `;

    const clearBtn = container.querySelector('#clear-search-btn');
    if (clearBtn && onClear) {
        clearBtn.onclick = onClear;
    }

    return container;
}

// Create filter empty state
function createFilterEmptyState(onReset) {
    const container = document.createElement('div');
    container.className = 'filter-empty-state';

    container.innerHTML = `
        <div class="filter-empty-state-icon">🎯</div>
        <div class="filter-empty-state-title">No matching records</div>
        <div class="filter-empty-state-message">Try adjusting your filters</div>
        <div class="empty-state-action" style="margin-top: 12px;">
            <button class="btn btn-outline btn-sm" id="reset-filters-btn">Reset Filters</button>
        </div>
    `;

    const resetBtn = container.querySelector('#reset-filters-btn');
    if (resetBtn && onReset) {
        resetBtn.onclick = onReset;
    }

    return container;
}

// Create no notifications empty state
function createNoNotificationsEmptyState() {
    return createEmptyState(
        '🔔',
        'No Notifications',
        'You\'re all caught up! No new notifications at this time.'
    );
}

// Create no students empty state
function createNoStudentsEmptyState(onAddStudent) {
    const addButton = '<button class="btn btn-primary" id="add-student-btn">➕ Add Student</button>';
    const container = createEmptyState(
        '👥',
        'No Students Found',
        'There are no students matching your criteria.',
        addButton
    );

    const btn = container.querySelector('#add-student-btn');
    if (btn && onAddStudent) {
        btn.onclick = onAddStudent;
    }

    return container;
}

// Create no payments empty state
function createNoPaymentsEmptyState(onRecordPayment) {
    const addButton = '<button class="btn btn-primary" id="record-payment-btn">💰 Record Payment</button>';
    const container = createEmptyState(
        '💸',
        'No Payments Recorded',
        'No payments have been recorded yet.',
        addButton
    );

    const btn = container.querySelector('#record-payment-btn');
    if (btn && onRecordPayment) {
        btn.onclick = onRecordPayment;
    }

    return container;
}

// Create no assessments empty state
function createNoAssessmentsEmptyState(onCreateAssessment) {
    const addButton = '<button class="btn btn-primary" id="create-assessment-btn">➕ Create Assessment</button>';
    const container = createEmptyState(
        '📝',
        'No Assessments',
        'No assessments have been created for this term yet.',
        addButton
    );

    const btn = container.querySelector('#create-assessment-btn');
    if (btn && onCreateAssessment) {
        btn.onclick = onCreateAssessment;
    }

    return container;
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Fill container with empty state
function showEmptyState(container, icon, title, message, action = null) {
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(createEmptyState(icon, title, message, action));
}