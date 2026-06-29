// ============================================================
// BADGES UI - Badge components for status indicators
// ============================================================


// Create a status badge
function createBadge(text, type = 'neutral') {
    const badge = document.createElement('span');
    badge.className = `badge badge-${type}`;
    badge.textContent = text;
    return badge;
}

// Create grade badge
function createGradeBadge(percentage) {
    const gradeClass = getGradeClass(percentage);
    const grade = getGrade(percentage);
    const badge = document.createElement('span');
    badge.className = `badge ${gradeClass}`;
    badge.textContent = grade;
    return badge;
}

// Create payment status badge
function createPaymentStatusBadge(isPaid, isPartial = false, isOverdue = false) {
    let text = '', type = '';

    if (isPaid) {
        text = '✅ Paid';
        type = 'success';
    } else if (isPartial) {
        text = '🟡 Partial';
        type = 'warning';
    } else if (isOverdue) {
        text = '🔴 Overdue';
        type = 'danger';
    } else {
        text = '❌ Due';
        type = 'danger';
    }

    return createBadge(text, type);
}

// Create attendance status badge
function createAttendanceBadge(status) {
    const badges = {
        present: { text: '✅ Present', type: 'success' },
        absent: { text: '❌ Absent', type: 'danger' },
        late: { text: '⏰ Late', type: 'warning' },
        excused: { text: '📝 Excused', type: 'info' }
    };

    const config = badges[status] || badges.absent;
    return createBadge(config.text, config.type);
}

// Create assessment status badge
function createAssessmentStatusBadge(isLocked, isOverdue = false, daysLeft = null) {
    if (isLocked) {
        return createBadge('🔒 Locked', 'neutral');
    }
    if (isOverdue) {
        return createBadge('⚠️ Overdue', 'danger');
    }
    if (daysLeft === 0) {
        return createBadge('📅 Due Today', 'warning');
    }
    if (daysLeft === 1) {
        return createBadge('📅 Due Tomorrow', 'warning');
    }
    return createBadge('✏️ Open', 'success');
}

// Create role badge
function createRoleBadge(role) {
    const badges = {
        admin: { text: '👑 Admin', type: 'danger' },
        accountant: { text: '💰 Accountant', type: 'warning' },
        teacher: { text: '👩‍🏫 Teacher', type: 'info' }
    };

    const config = badges[role] || badges.teacher;
    return createBadge(config.text, config.type);
}

// Create active/inactive status badge
function createStatusBadge(isActive) {
    return createBadge(
        isActive ? '🟢 Active' : '⚪ Inactive',
        isActive ? 'success' : 'neutral'
    );
}

// Create fee waiver badge
function createWaiverBadge() {
    return createBadge('🎁 Waived', 'success');
}

// Create credit badge
function createCreditBadge(amount) {
    const badge = createBadge(`💰 Credit: ${formatCurrency(amount)}`, 'info');
    return badge;
}

// Format currency helper
function formatCurrency(amount) {
    return amount.toLocaleString() + ' RWF';
}

// Get grade helper
function getGrade(percentage) {
    if (percentage === null || percentage === undefined) return '—';
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}