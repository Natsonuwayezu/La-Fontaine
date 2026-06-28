// tests/ui-tests.js
// UI component tests

export async function testUIModule() {
    console.log('Running UI tests...');

    const tests = [
        testModalCreation,
        testToastNotifications,
        testFormValidation,
        testTableRendering,
        testThemeSwitching
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} passed`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} failed:`, error.message);
            failed++;
        }
    }

    console.log(`UI tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testModalCreation() {
    function createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${escapeHtml(title)}</h3>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline">Cancel</button>
                    <button class="btn btn-primary">Confirm</button>
                </div>
            </div>
        `;
        return modal;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    const modal = createModal('Test Title', '<p>Test Content</p>');

    if (!modal.classList.contains('modal-overlay')) throw new Error('Modal missing overlay class');

    const title = modal.querySelector('.modal-header h3');
    if (!title || title.textContent !== 'Test Title') throw new Error('Modal title incorrect');

    const closeBtn = modal.querySelector('.modal-close');
    if (!closeBtn) throw new Error('Modal missing close button');
}

async function testToastNotifications() {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 100);
        return toast;
    }

    const toast = showToast('Test message', 'success');

    if (!toastContainer.contains(toast)) throw new Error('Toast not added to container');
    if (!toast.classList.contains('toast-success')) throw new Error('Toast type incorrect');

    toast.remove();
    toastContainer.remove();
}

async function testFormValidation() {
    function validateForm(formData, rules) {
        const errors = {};
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];
            if (rule.required && !value) {
                errors[field] = `${field} is required`;
            }
            if (rule.minLength && value && value.length < rule.minLength) {
                errors[field] = `${field} must be at least ${rule.minLength} characters`;
            }
            if (rule.pattern && value && !rule.pattern.test(value)) {
                errors[field] = `${field} format is invalid`;
            }
        }
        return errors;
    }

    const formData = {
        name: 'John',
        email: 'invalid',
        password: '123'
    };

    const rules = {
        name: { required: true },
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        password: { required: true, minLength: 6 }
    };

    const errors = validateForm(formData, rules);

    if (errors.email !== 'email format is invalid') throw new Error('Email validation failed');
    if (errors.password !== 'password must be at least 6 characters') throw new Error('Password validation failed');
    if (errors.name) throw new Error('Name should be valid');
}

async function testTableRendering() {
    function renderTable(columns, data) {
        const table = document.createElement('table');
        table.className = 'data-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = row[col] || '—';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        return table;
    }

    const columns = ['Name', 'Age', 'City'];
    const data = [
        { Name: 'John', Age: 25, City: 'Kigali' },
        { Name: 'Jane', Age: 30, City: 'Rubavu' }
    ];

    const table = renderTable(columns, data);

    const headers = table.querySelectorAll('th');
    if (headers.length !== 3) throw new Error(`Expected 3 headers, got ${headers.length}`);

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length !== 2) throw new Error(`Expected 2 rows, got ${rows.length}`);
}

async function testThemeSwitching() {
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    setTheme('dark');
    if (getTheme() !== 'dark') throw new Error('Theme not set to dark');

    setTheme('light');
    if (getTheme() !== 'light') throw new Error('Theme not set to light');

    // Test localStorage persistence
    if (localStorage.getItem('theme') !== 'light') throw new Error('Theme not saved to localStorage');
}