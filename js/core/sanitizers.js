// ============================================================
// SANITIZERS - Input sanitization for security
// ============================================================

// Escape HTML special characters
export function sanitizeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Sanitize user input (remove HTML tags, trim)
export function sanitizeInput(value) {
    if (typeof value !== 'string') return value;
    return value.trim().replace(/[<>]/g, '');
}

// Sanitize numeric input
export function sanitizeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}

// Sanitize integer input
export function sanitizeInteger(value, defaultValue = 0) {
    const num = parseInt(value);
    return isNaN(num) ? defaultValue : num;
}

// Sanitize email
export function sanitizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

// Sanitize phone number (keep only digits and plus sign)
export function sanitizePhone(phone) {
    if (typeof phone !== 'string') return '';
    return phone.replace(/[^0-9+]/g, '');
}

// Sanitize date
export function sanitizeDate(date, defaultValue = null) {
    if (!date) return defaultValue;
    const d = new Date(date);
    return isNaN(d.getTime()) ? defaultValue : d.toISOString().split('T')[0];
}

// Sanitize object values recursively
export function sanitizeObject(obj, allowedKeys = null) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (allowedKeys && !allowedKeys.includes(key)) continue;

        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (typeof value === 'number') {
            sanitized[key] = isNaN(value) ? 0 : value;
        } else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// Sanitize form data before submission
export function sanitizeFormData(formData, schema) {
    const sanitized = {};
    for (const [field, rules] of Object.entries(schema)) {
        let value = formData[field];

        if (rules.type === 'string') {
            value = sanitizeInput(value);
            if (rules.maxLength && value.length > rules.maxLength) {
                value = value.substring(0, rules.maxLength);
            }
        } else if (rules.type === 'number') {
            value = sanitizeNumber(value, rules.default || 0);
        } else if (rules.type === 'integer') {
            value = sanitizeInteger(value, rules.default || 0);
        } else if (rules.type === 'email') {
            value = sanitizeEmail(value);
        } else if (rules.type === 'phone') {
            value = sanitizePhone(value);
        } else if (rules.type === 'date') {
            value = sanitizeDate(value, rules.default);
        }

        sanitized[field] = value;
    }
    return sanitized;
}

// Clean object by removing null/undefined values
export function cleanObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

// Truncate string to max length
export function truncate(str, maxLength, suffix = '...') {
    if (typeof str !== 'string') return str;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}

// Escape regex special characters
export function escapeRegex(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}