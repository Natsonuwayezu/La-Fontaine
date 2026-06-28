// tests/auth-tests.js
// Authentication tests

export async function testLogin() {
    console.log('Running authentication tests...');

    const tests = [
        testAdminLogin,
        testTeacherLogin,
        testAccountantLogin,
        testInvalidLogin,
        testSessionExpiry
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

    console.log(`Auth tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testAdminLogin() {
    // Mock login function
    const result = await mockLogin('admin', 'admin123');
    if (!result.success || result.user.role !== 'admin') {
        throw new Error('Admin login failed');
    }
}

async function testTeacherLogin() {
    const result = await mockLogin('teacher1', 'password123');
    if (!result.success || result.user.role !== 'teacher') {
        throw new Error('Teacher login failed');
    }
}

async function testAccountantLogin() {
    const result = await mockLogin('accountant1', 'password123');
    if (!result.success || result.user.role !== 'accountant') {
        throw new Error('Accountant login failed');
    }
}

async function testInvalidLogin() {
    const result = await mockLogin('invalid', 'wrong');
    if (result.success) {
        throw new Error('Invalid login should fail');
    }
}

async function testSessionExpiry() {
    // Test session storage and expiry
    const testUser = { id: 1, name: 'Test' };
    saveSession(testUser);

    const retrieved = checkAuth();
    if (!retrieved) {
        throw new Error('Session save/retrieve failed');
    }

    // Test expiry
    localStorage.setItem('elf_expiry', Date.now() - 1000);
    const expired = checkAuth();
    if (expired) {
        throw new Error('Expired session should be invalid');
    }
}

// Mock functions for testing
async function mockLogin(role, username, password) {
    if (role === 'admin' && password === 'admin123') {
        return { success: true, user: { id: 0, role: 'admin', name: 'Admin' } };
    }
    if ((role === 'teacher' || role === 'accountant') && password === 'password123') {
        return { success: true, user: { id: 1, role: role, name: 'Test User' } };
    }
    return { success: false, error: 'Invalid credentials' };
}

function saveSession(user) {
    localStorage.setItem('elf_user', JSON.stringify(user));
    localStorage.setItem('elf_expiry', Date.now() + 3600000);
}

function checkAuth() {
    const stored = localStorage.getItem('elf_user');
    const expiry = localStorage.getItem('elf_expiry');
    if (!stored || !expiry) return null;
    if (Date.now() > parseInt(expiry)) return null;
    return JSON.parse(stored);
}