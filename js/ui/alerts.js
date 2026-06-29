// ============================================================
// ALERTS UI - Alert banner system
// ============================================================


// Alert types
const ALERT_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Create an alert banner
function createAlert(message, type = ALERT_TYPES.INFO, dismissible = true) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    let closeButton = '';
    if (dismissible) {
        closeButton = '<button class="alert-close" onclick="this.parentElement.remove()">✕</button>';
    }

    alert.innerHTML = `
        <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
        <div class="alert-content">${escapeHtml(message)}</div>
        ${closeButton}
    `;

    return alert;
}

// Show a temporary alert that auto-dismisses
function showAlert(message, type = ALERT_TYPES.INFO, duration = 5000) {
    const alert = createAlert(message, type, true);
    const container = document.getElementById('dynamic-content');
    if (!container) return;

    // Insert at top of content
    container.insertBefore(alert, container.firstChild);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                if (alert.parentNode) alert.remove();
            }, 300);
        }
    }, duration);

    return alert;
}

// Show success alert
function showSuccessAlert(message, duration = 5000) {
    return showAlert(message, ALERT_TYPES.SUCCESS, duration);
}

// Show error alert
function showErrorAlert(message, duration = 5000) {
    return showAlert(message, ALERT_TYPES.ERROR, duration);
}

// Show warning alert
function showWarningAlert(message, duration = 5000) {
    return showAlert(message, ALERT_TYPES.WARNING, duration);
}

// Show info alert
function showInfoAlert(message, duration = 5000) {
    return showAlert(message, ALERT_TYPES.INFO, duration);
}

// Clear all alerts
function clearAlerts() {
    const container = document.getElementById('dynamic-content');
    if (container) {
        const alerts = container.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
    }
}

// Show validation summary alert
function showValidationAlert(errors) {
    if (!errors || errors.length === 0) return;

    const errorCount = errors.length;
    const firstErrors = errors.slice(0, 3).map(e => e.message).join(', ');
    const message = errorCount > 3
        ? `${firstErrors} and ${errorCount - 3} more error(s)`
        : firstErrors;

    showErrorAlert(`❌ ${message}`);
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

// Expose globally
window.showAlert = showAlert;
window.showSuccessAlert = showSuccessAlert;
window.showErrorAlert = showErrorAlert;
window.showWarningAlert = showWarningAlert;
window.showInfoAlert = showInfoAlert;