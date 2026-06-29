// ============================================================
// FORMS UI - Form handling and validation
// ============================================================


// Validate a form against rules
function validateForm(formElement, rules = {}) {
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

// Get form data as object
function getFormData(formElement) {
    const formData = new FormData(formElement);
    const data = {};

    for (const [key, value] of formData.entries()) {
        if (data[key] !== undefined) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }

    return data;
}

// Set form data from object
function setFormData(formElement, data) {
    for (const [key, value] of Object.entries(data)) {
        const input = formElement.querySelector(`[name="${key}"], #${key}`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = !!value;
            } else {
                input.value = value;
            }
        }
    }
}

// Reset form to default values
function resetForm(formElement) {
    formElement.reset();
    formElement.querySelectorAll('.is-invalid').forEach(el => {
        el.classList.remove('is-invalid');
        const parent = el.closest('.form-group');
        const errorEl = parent?.querySelector('.invalid-feedback');
        if (errorEl) errorEl.remove();
    });
}

// Disable form inputs
function disableForm(formElement, disabled = true) {
    const inputs = formElement.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
        input.disabled = disabled;
    });
}

// Auto-save form to localStorage
function autoSaveForm(formId, data) {
    localStorage.setItem(`form_autosave_${formId}`, JSON.stringify({
        data: data,
        timestamp: Date.now()
    }));
}

// Load auto-saved form data
function loadAutoSaveForm(formId) {
    const saved = localStorage.getItem(`form_autosave_${formId}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Date.now() - parsed.timestamp < 86400000) { // 24 hours
                return parsed.data;
            }
        } catch (e) { }
    }
    return null;
}

// Clear auto-saved form
function clearAutoSaveForm(formId) {
    localStorage.removeItem(`form_autosave_${formId}`);
}

// Toggle password visibility
function togglePasswordVisibility(inputElement, buttonElement) {
    if (inputElement.type === 'password') {
        inputElement.type = 'text';
        if (buttonElement) buttonElement.textContent = '🙈';
    } else {
        inputElement.type = 'password';
        if (buttonElement) buttonElement.textContent = '👁️';
    }
}

// Show form submission loading state
function setFormLoading(button, isLoading, originalText = null) {
    if (!button) return;

    if (isLoading) {
        button._originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-sm"></span> Saving...';
    } else {
        button.disabled = false;
        button.innerHTML = button._originalText || originalText || 'Save';
    }
}

// Expose functions globally
window.togglePasswordVisibility = togglePasswordVisibility;