// ============================================================
// LOGGER - Application logging and debugging
// ============================================================

// Log levels
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Current log level (can be changed via settings)
let currentLogLevel = LOG_LEVELS.INFO;

// Log queue for batch sending
let logQueue = [];
let isSending = false;

// Enable/disable logging to console
let consoleEnabled = true;

// Enable/disable logging to server
let serverLoggingEnabled = false;

// Maximum log entries to keep in queue
const MAX_QUEUE_SIZE = 100;

// Set log level
export function setLogLevel(level) {
    currentLogLevel = level;
}

// Enable/disable console logging
export function setConsoleLogging(enabled) {
    consoleEnabled = enabled;
}

// Enable/disable server logging
export function setServerLogging(enabled) {
    serverLoggingEnabled = enabled;
}

// Internal log function
function log(level, message, data = null, module = 'app') {
    if (level < currentLogLevel) return;

    const logEntry = {
        timestamp: new Date().toISOString(),
        level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'INFO',
        module,
        message,
        data: data ? JSON.stringify(data) : null,
        url: window.location.href,
        userAgent: navigator.userAgent
    };

    // Log to console
    if (consoleEnabled) {
        const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${module}]`;
        if (level === LOG_LEVELS.ERROR) {
            console.error(prefix, message, data || '');
        } else if (level === LOG_LEVELS.WARN) {
            console.warn(prefix, message, data || '');
        } else {
            console.log(prefix, message, data || '');
        }
    }

    // Queue for server logging
    if (serverLoggingEnabled) {
        logQueue.push(logEntry);
        if (logQueue.length >= MAX_QUEUE_SIZE) {
            flushLogs();
        }
    }
}

// Flush logs to server
export async function flushLogs() {
    if (!serverLoggingEnabled || isSending || logQueue.length === 0) return;

    isSending = true;
    const logsToSend = [...logQueue];
    logQueue = [];

    try {
        await window.insert?.('system_logs', { logs: logsToSend, created_at: new Date().toISOString() });
    } catch (error) {
        console.warn('Failed to send logs to server:', error);
        // Re-add logs to queue (but limit to prevent infinite growth)
        logQueue = [...logsToSend, ...logQueue].slice(0, MAX_QUEUE_SIZE);
    } finally {
        isSending = false;
    }
}

// Debug log (level 0)
export function debug(message, data = null, module = 'app') {
    log(LOG_LEVELS.DEBUG, message, data, module);
}

// Info log (level 1)
export function info(message, data = null, module = 'app') {
    log(LOG_LEVELS.INFO, message, data, module);
}

// Warning log (level 2)
export function warn(message, data = null, module = 'app') {
    log(LOG_LEVELS.WARN, message, data, module);
}

// Error log (level 3)
export function error(message, data = null, module = 'app') {
    log(LOG_LEVELS.ERROR, message, data, module);
}

// Log API request
export function logApiRequest(endpoint, method, requestData = null, responseData = null, duration = null) {
    debug('API Request', {
        endpoint,
        method,
        requestData: requestData ? JSON.stringify(requestData).substring(0, 500) : null,
        responseData: responseData ? JSON.stringify(responseData).substring(0, 500) : null,
        duration
    }, 'api');
}

// Log user action
export function logUserAction(action, details = null, module = 'user') {
    info(`User action: ${action}`, details, module);
    // Also log to activity_logs table
    if (window.state?.currentUser) {
        window.logActivity?.(window.state.currentUser.id, window.state.currentUser.role, action, null, null, details);
    }
}

// Log performance metric
export function logPerformance(metric, value, unit = 'ms') {
    debug(`Performance: ${metric}`, { value, unit }, 'performance');
}

// Clear log queue
export function clearLogQueue() {
    logQueue = [];
}

// Get current log queue
export function getLogQueue() {
    return [...logQueue];
}

// Set up automatic log flushing on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (logQueue.length > 0) {
            // Use sendBeacon for reliable delivery during page unload
            const logsToSend = [...logQueue];
            const blob = new Blob([JSON.stringify({ logs: logsToSend })], { type: 'application/json' });
            navigator.sendBeacon('/api/logs', blob);
        }
    });

    // Flush logs every 30 seconds
    setInterval(() => {
        flushLogs();
    }, 30000);
}