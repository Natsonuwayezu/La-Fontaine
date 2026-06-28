// ============================================================
// VALIDATORS - Form validation engine
// ============================================================

import { showToast } from './helpers.js';

// Validation rules
export const validators = {
    required: (value) => value && String(value).trim().length > 0,
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
    phone: (value) => /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(String(value)),
    number: (value) => !isNaN(parseFloat(value)) && isFinite(value),
    integer: (value) => Number.isInteger(parseFloat(value)),
    min: (value, min) => parseFloat(value) >= min,
    max: (value, max) => parseFloat(value) <= max,
    minLength: (value, len) => String(value).length >= len,
    maxLength: (value, len) => String(value).length <= len,
    matches: (value, fieldId) => value === document.getElementById(fieldId)?.value,
    date: (value) => !isNaN(Date.parse(value)),
    url: (value) => /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(String(value)),
    numericPositive: (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0,
    between: (value, min, max) => parseFloat(value) >= min && parseFloat(value) <= max
};

// Get error message for a validation rule
export function getErrorMessage(rule, fieldName, args) {
    const fieldLabel = fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const messages = {
        required: `${fieldLabel} is required`,
        email: `Please enter a valid email address`,
        phone: `Please enter a valid phone number`,
        number: `${fieldLabel} must be a number`,
        integer: `${fieldLabel} must be a whole number`,
        min: `${fieldLabel} must be at least ${args[0]}`,
        max: `${fieldLabel} must be at most ${args[0]}`,
        minLength: `${fieldLabel} must be at least ${args[0]} characters`,
        maxLength: `${fieldLabel} must be at most ${args[0]} characters`,
        matches: `${fieldLabel} does not match`,
        date: `Please enter a valid date`,
        url: `Please enter a valid URL`,
        numericPositive: `${fieldLabel} must be greater than 0`,
        between: `${fieldLabel} must be between ${args[0]} and ${args[1]}`
    };
    return messages[rule] || `Invalid ${fieldLabel}`;
}

// Validate a form element against rules
export function validateForm(formElement, rules = {}) {
    const errors = [];
    const inputs = formElement.querySelectorAll('input, select, textarea');

    for (const input of inputs) {
        const name = input.name || input.id;
        if (!name) continue;

        const fieldRules = rules[name] || [];
        const value = input.type === 'checkbox' ? input.checked : input.value;

        for (const rule of fieldRules) {
            let [ruleName, ...args] = rule.split(':');
            const validator = validators[ruleName];

            if (validator && !validator(value, ...args)) {
                errors.push({
                    field: name,
                    message: getErrorMessage(ruleName, name, args),
                    element: input
                });
            }
        }
    }

    // Remove existing error indicators
    formElement.querySelectorAll('.is-invalid').forEach(el => {
        el.classList.remove('is-invalid');
        const parent = el.closest('.form-group');
        const errorEl = parent?.querySelector('.invalid-feedback');
        if (errorEl) errorEl.remove();
    });

    // Add error indicators
    for (const error of errors) {
        error.element.classList.add('is-invalid');
        const parent = error.element.closest('.form-group');
        if (parent && !parent.querySelector('.invalid-feedback')) {
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.style.cssText = 'color: var(--danger); font-size: 0.75rem; margin-top: 4px;';
            feedback.textContent = error.message;
            parent.appendChild(feedback);
        }
    }

    // Scroll to first error
    if (errors.length > 0) {
        errors[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errors[0].element.focus();
        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}

// Validate a single value against a rule
export function validateValue(value, rule, ...args) {
    const validator = validators[rule];
    return validator ? validator(value, ...args) : true;
}

// Check if email is valid
export function isValidEmail(email) {
    return validators.email(email);
}

// Check if phone number is valid
export function isValidPhone(phone) {
    return validators.phone(phone);
}

// Check if number is positive
export function isPositiveNumber(value) {
    return validators.numericPositive(value);
}

// Check if date is valid
export function isValidDate(date) {
    return validators.date(date);
}

// Show validation summary toast
export function showValidationSummary(errors) {
    if (errors.length === 0) return;

    const errorCount = errors.length;
    const firstErrors = errors.slice(0, 3).map(e => e.message).join(', ');
    const message = errorCount > 3
        ? `${firstErrors} and ${errorCount - 3} more error(s)`
        : firstErrors;

    showToast(`❌ ${message}`, 'error', 5000);
}