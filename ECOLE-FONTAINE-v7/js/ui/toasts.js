// ============================================================
// TOASTS UI - Toast notification system
// ============================================================

// Toast manager class
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.defaultDuration = 3500;
        this.init();
    }

    init() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const toast = document.createElement('div');
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${this.escapeHtml(message)}</span>`;

        this.container.appendChild(toast);
        this.toasts.push(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                toast.remove();
                const index = this.toasts.indexOf(toast);
                if (index > -1) this.toasts.splice(index, 1);
            }, 300);
        }, duration);

        return toast;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    clearAll() {
        this.toasts.forEach(toast => toast.remove());
        this.toasts = [];
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
}

// Singleton instance
const toastManager = new ToastManager();

// Export functions
export function showToast(message, type = 'info', duration = 3500) {
    return toastManager.show(message, type, duration);
}

export function showSuccess(message, duration = 3500) {
    return toastManager.success(message, duration);
}

export function showError(message, duration = 3500) {
    return toastManager.error(message, duration);
}

export function showWarning(message, duration = 3500) {
    return toastManager.warning(message, duration);
}

export function showInfo(message, duration = 3500) {
    return toastManager.info(message, duration);
}

export function clearAllToasts() {
    toastManager.clearAll();
}

// Auto-hide toasts after navigation
export function initToasts() {
    // Clear toasts on page navigation
    const originalNavigateTo = window.navigateTo;
    if (originalNavigateTo) {
        window.navigateTo = function (...args) {
            clearAllToasts();
            return originalNavigateTo.apply(this, args);
        };
    }
}