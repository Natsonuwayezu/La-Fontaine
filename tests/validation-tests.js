// tests/validation-tests.js
// Form validation tests

export async function testValidation() {
    console.log('Running validation tests...');

    const tests = [
        testEmailValidation,
        testPhoneValidation,
        testDateValidation,
        testRequiredFields,
        testNumericValidation
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

    console.log(`Validation tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[+]?[\d\s-]{8,}$/;
    return re.test(phone);
}

function validateDate(date) {
    if (!date) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
}

async function testEmailValidation() {
    const validEmails = ['test@example.com', 'user@domain.co.rw'];
    const invalidEmails = ['invalid', 'test@', '@example.com'];

    for (const email of validEmails) {
        if (!validateEmail(email)) {
            throw new Error(`Valid email marked as invalid: ${email}`);
        }
    }

    for (const email of invalidEmails) {
        if (validateEmail(email)) {
            throw new Error(`Invalid email marked as valid: ${email}`);
        }
    }
}

async function testPhoneValidation() {
    const validPhones = ['+250788123456', '0788123456', '250788123456'];
    const invalidPhones = ['123', 'abc', ''];

    for (const phone of validPhones) {
        if (!validatePhone(phone)) {
            throw new Error(`Valid phone marked as invalid: ${phone}`);
        }
    }

    for (const phone of invalidPhones) {
        if (validatePhone(phone)) {
            throw new Error(`Invalid phone marked as valid: ${phone}`);
        }
    }
}

async function testDateValidation() {
    const validDates = ['2026-01-15', '2026-12-31', new Date().toISOString().split('T')[0]];
    const invalidDates = ['2026-13-01', '2026-01-32', 'invalid', ''];

    for (const date of validDates) {
        if (!validateDate(date)) {
            throw new Error(`Valid date marked as invalid: ${date}`);
        }
    }

    for (const date of invalidDates) {
        if (validateDate(date)) {
            throw new Error(`Invalid date marked as valid: ${date}`);
        }
    }
}

async function testRequiredFields() {
    const formData = { name: 'John', email: 'john@example.com' };
    const required = ['name', 'email'];

    for (const field of required) {
        if (!formData[field]) {
            throw new Error(`Required field missing: ${field}`);
        }
    }

    // Test with missing field
    const incompleteData = { name: 'John' };
    for (const field of required) {
        if (!incompleteData[field]) {
            // Expected to fail - this is correct
            continue;
        }
        throw new Error(`Missing field should have been caught: ${field}`);
    }
}

async function testNumericValidation() {
    function validateNumeric(value, min, max) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (min !== undefined && num < min) return false;
        if (max !== undefined && num > max) return false;
        return true;
    }

    const testCases = [
        { value: 50, min: 0, max: 100, expected: true },
        { value: -10, min: 0, max: 100, expected: false },
        { value: 150, min: 0, max: 100, expected: false },
        { value: 'abc', min: 0, max: 100, expected: false },
        { value: '50', min: 0, max: 100, expected: true }
    ];

    for (const tc of testCases) {
        const result = validateNumeric(tc.value, tc.min, tc.max);
        if (result !== tc.expected) {
            throw new Error(`Numeric validation failed: ${tc.value} -> ${result}, expected ${tc.expected}`);
        }
    }
}