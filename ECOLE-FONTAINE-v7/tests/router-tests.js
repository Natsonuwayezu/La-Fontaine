// tests/router-tests.js
// Router and navigation tests

export async function testRouterModule() {
    console.log('Running router tests...');

    const tests = [
        testRouteRegistration,
        testNavigation,
        testRouteParams,
        testHashChange,
        testProtectedRoutes
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

    console.log(`Router tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testRouteRegistration() {
    const routes = new Map();

    function registerRoute(path, handler) {
        routes.set(path, handler);
    }

    registerRoute('/dashboard', () => 'dashboard');
    registerRoute('/students', () => 'students');
    registerRoute('/marks', () => 'marks');

    if (!routes.has('/dashboard')) throw new Error('Route /dashboard not registered');
    if (!routes.has('/students')) throw new Error('Route /students not registered');
    if (!routes.has('/marks')) throw new Error('Route /marks not registered');
    if (routes.size !== 3) throw new Error(`Expected 3 routes, got ${routes.size}`);
}

async function testNavigation() {
    let currentRoute = null;

    function navigateTo(route) {
        currentRoute = route;
    }

    navigateTo('dashboard');
    if (currentRoute !== 'dashboard') throw new Error('Navigation to dashboard failed');

    navigateTo('students');
    if (currentRoute !== 'students') throw new Error('Navigation to students failed');
}

async function testRouteParams() {
    function parseRoute(route, pattern) {
        const routeParts = route.split('/');
        const patternParts = pattern.split('/');

        if (routeParts.length !== patternParts.length) return null;

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = routeParts[i];
            } else if (patternParts[i] !== routeParts[i]) {
                return null;
            }
        }
        return params;
    }

    const params = parseRoute('students/123/edit', 'students/:id/edit');
    if (!params) throw new Error('Route parsing failed');
    if (params.id !== '123') throw new Error(`Expected id=123, got ${params.id}`);
}

async function testHashChange() {
    let lastHash = '';

    window.addEventListener = (event, handler) => {
        if (event === 'hashchange') {
            window._testHashHandler = handler;
        }
    };

    function simulateHashChange(hash) {
        lastHash = hash;
        if (window._testHashHandler) {
            window._testHashHandler({ newURL: `http://test.com/#${hash}` });
        }
    }

    let navigatedTo = null;
    window.addEventListener('hashchange', (e) => {
        const hash = e.newURL.split('#')[1];
        navigatedTo = hash;
    });

    simulateHashChange('dashboard');
    if (navigatedTo !== 'dashboard') throw new Error('Hash change not detected');
}

async function testProtectedRoutes() {
    const user = { role: 'teacher' };
    const adminOnlyRoutes = ['settings', 'users', 'backup'];
    const teacherRoutes = ['dashboard', 'marks', 'students'];

    function canAccess(route, user) {
        if (adminOnlyRoutes.includes(route) && user.role !== 'admin') return false;
        return true;
    }

    for (const route of adminOnlyRoutes) {
        if (canAccess(route, user)) {
            throw new Error(`Teacher should not access admin route: ${route}`);
        }
    }

    for (const route of teacherRoutes) {
        if (!canAccess(route, user)) {
            throw new Error(`Teacher should access route: ${route}`);
        }
    }

    const adminUser = { role: 'admin' };
    for (const route of adminOnlyRoutes) {
        if (!canAccess(route, adminUser)) {
            throw new Error(`Admin should access route: ${route}`);
        }
    }
}