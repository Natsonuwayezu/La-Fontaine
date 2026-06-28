// ============================================================
// ERROR HANDLER - Global error handling and recovery
// ============================================================

import { error as logError, warn as logWarn } from './logger.js';
import { showToast } from './helpers.js';

// Error severity levels
export const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Error categories
export const ERROR_CATEGORIES = {
    NETWORK: 'network',
    DATABASE: 'database',
    AUTH: 'auth',
    VALIDATION: 'validation',
    RENDER: 'render',
    UNKNOWN: 'unknown'
};

// Store recent errors for debugging
const recentErrors = [];
const MAX_RECENT_ERRORS = 20;

// Add error to recent list
function addToRecentErrors(error) {
    recentErrors.unshift(error);
    if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.pop();
    }
}

// Get recent errors
export function getRecentErrors() {
    return [...recentErrors];
}

// Clear recent errors
export function clearRecentErrors() {
    recentErrors.length = 0;
}

// Determine error category
export function getErrorCategory(error) {
    if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('offline')) {
        return ERROR_CATEGORIES.NETWORK;
    }
    if (error.message?.includes('auth') || error.message?.includes('login') || error.message?.includes('permission')) {
        return ERROR_CATEGORIES.AUTH;
    }
    if (error.message?.includes('database') || error.message?.includes('supabase') || error.message?.includes('query')) {
        return ERROR_CATEGORIES.DATABASE;
    }
    if (error.message?.includes('validation') || error.message?.includes('required')) {
        return ERROR_CATEGORIES.VALIDATION;
    }
    if (error.message?.includes('render') || error.message?.includes('DOM')) {
        return ERROR_CATEGORIES.RENDER;
    }
    return ERROR_CATEGORIES.UNKNOWN;
}

// Determine error severity
export function getErrorSeverity(error, category) {
    if (category === ERROR_CATEGORIES.CRITICAL) return ERROR_SEVERITY.CRITICAL;
    if (error.message?.includes('fatal') || error.stack?.includes('fatal')) return ERROR_SEVERITY.CRITICAL;
    if (category === ERROR_CATEGORIES.AUTH) return ERROR_SEVERITY.HIGH;
    if (category === ERROR_CATEGORIES.DATABASE) return ERROR_SEVERITY.HIGH;
    if (category === ERROR_CATEGORIES.NETWORK) return ERROR_SEVERITY.MEDIUM;
    return ERROR_SEVERITY.LOW;
}

// Show user-friendly error message
export function showUserError(error, category) {
    let userMessage = 'An error occurred. Please try again.';

    switch (category) {
        case ERROR_CATEGORIES.NETWORK:
            userMessage = 'Network connection issue. Please check your internet and try again.';
            break;
        case ERROR_CATEGORIES.DATABASE:
            userMessage = 'Database error. Please refresh the page and try again.';
            break;
        case ERROR_CATEGORIES.AUTH:
            userMessage = 'Authentication error. Please log in again.';
            break;
        case ERROR_CATEGORIES.VALIDATION:
            userMessage = error.message || 'Please check your input and try again.';
            break;
    }

    showToast(userMessage, 'error', 5000);
}

// Global error handler
export function handleError(error, context = null) {
    const category = getErrorCategory(error);
    const severity = getErrorSeverity(error, category);

    const errorInfo = {
        timestamp: new Date().toISOString(),
        message: error.message || String(error),
        stack: error.stack,
        category,
        severity,
        context,
        url: window.location.href,
        userAgent: navigator.userAgent
    };

    // Log to console and server
    logError(`[${category}] ${error.message}`, { stack: error.stack, context }, 'error-handler');

    // Store recent error
    addToRecentErrors(errorInfo);

    // Show user-friendly message (don't show for every error, only meaningful ones)
    if (severity !== ERROR_SEVERITY.LOW && !error.suppressToast) {
        showUserError(error, category);
    }

    // Handle critical errors (reload or redirect)
    if (severity === ERROR_SEVERITY.CRITICAL) {
        if (confirm('A critical error occurred. Reload the page to continue?')) {
            window.location.reload();
        }
    }

    return errorInfo;
}

// Promise rejection handler
export function handlePromiseRejection(event) {
    const error = event.reason;
    handleError(error, { type: 'unhandled_rejection' });
}

// Global error event handler
export function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        handleError(event.error || new Error(event.message), { type: 'global_error', filename: event.filename, lineno: event.lineno });
    });

    window.addEventListener('unhandledrejection', handlePromiseRejection);

    // Handle offline/online events
    window.addEventListener('offline', () => {
        logWarn('Application went offline', null, 'network');
        showToast('You are offline. Some features may be unavailable.', 'warning', 3000);
    });

    window.addEventListener('online', () => {
        logWarn('Application came back online', null, 'network');
        showToast('Connection restored. Syncing data...', 'success', 3000);
    });
}

// Safe function wrapper (catches and handles errors automatically)
export function safe(fn, fallbackValue = null, context = null) {
    return function (...args) {
        try {
            return fn(...args);
        } catch (error) {
            handleError(error, context);
            return fallbackValue;
        }
    };
}

// Safe async function wrapper
export function safeAsync(fn, fallbackValue = null, context = null) {
    return async function (...args) {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context);
            return fallbackValue;
        }
    };
}

// Safe DOM element access
export function safeGetElement(id, fallback = null) {
    try {
        return document.getElementById(id) || fallback;
    } catch (error) {
        handleError(error, { operation: 'getElement', id });
        return fallback;
    }
}

// Safe JSON parse
export function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch (error) {
        handleError(error, { operation: 'jsonParse', strLength: str?.length });
        return fallback;
    }
}