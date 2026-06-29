// ============================================================
// APP - Main application initialization and boot sequence
// ============================================================


let isBooted = false;

// ─────────────────────────────────────────────
// Boot application after a successful login
// ─────────────────────────────────────────────
async function bootApp(user) {
    if (isBooted) return;

    // Swap login → app
    const loginPage = document.getElementById('login-page');
    const appPage   = document.getElementById('app-page');
    if (loginPage) loginPage.style.display = 'none';
    if (appPage)   appPage.style.display   = 'block';

    document.body.className = `role-${user.role}`;

    // Render shell UI immediately so it feels instant
    renderTopbar();
    updateTopbarUser(user);
    updateSidebarUser(user);
    buildSidebar(user.role);

    // Show data-loading spinner inside content area
    const content = document.getElementById('dynamic-content');
    if (content) {
        content.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading data from server…</p></div>`;
    }

    try {
        // ── 1. Fetch all Supabase data ──────────────────────
        const loaded = await loadInitialData();
        if (!loaded) throw new Error('Data load returned false — check Supabase connection.');

        // ── 2. Academic phase ───────────────────────────────
        state.currentPhase = getCurrentPhase();
        updateProgressBar();

        // ── 3. Determine which module to open ──────────────
        const defaultModules = {
            admin:      'admin-dashboard',
            accountant: 'accountant-dashboard',
            teacher:    'teacher-dashboard'
        };
        let lastModule = getLastModule();
        // Fall back to role dashboard if saved module nav item doesn't exist
        if (!lastModule || !document.getElementById(`nav-${lastModule}`)) {
            lastModule = defaultModules[user.role] || 'admin-dashboard';
        }

        // ── 4. Navigate to first module ─────────────────────
        await navigateTo(lastModule);

        // ── 5. Background services ──────────────────────────
        startSessionWatcher();
        startFeeResetWatcher();
        startAutoArchiveWatcher();
        startNotificationWatcher();
        startAutoBackupScheduler();

        // ── 6. Offline / sync ───────────────────────────────
        initOfflineSupport();
        initAutoSync();

        // ── 7. UI polish ────────────────────────────────────
        initSidebar();
        initUserDropdown();
        initTheme();
        initPWA();
        initCommandPalette();
        initNotifications();
        setupGlobalErrorHandlers();

        isBooted = true;

        // Flush any offline marks that were saved while disconnected
        if (navigator.onLine) {
            setTimeout(() => { window.syncOfflineMarks?.(); }, 3000);
        }

        console.log('✅ ECOLE LA FONTAINE v6.0 — App booted successfully');

    } catch (error) {
        console.error('[app] Boot failed:', error);
        if (content) {
            content.innerHTML = `
                <div class="alert alert-danger" style="margin:2rem">
                    <strong>⚠️ Failed to load data from server.</strong><br>
                    ${error.message}<br><br>
                    <button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button>
                    <button class="btn btn-outline" onclick="navigateTo('api-settings')">⚙️ API Settings</button>
                </div>`;
        }
    }
}

// ─────────────────────────────────────────────
// App init — check for persisted session
// ─────────────────────────────────────────────
async function initApp() {
    const storedUser = getStoredSession();

    if (storedUser) {
        state.currentUser = storedUser;
        await bootApp(storedUser);
    } else {
        // Show login, hide app
        const loginPage = document.getElementById('login-page');
        const appPage   = document.getElementById('app-page');
        if (loginPage) loginPage.style.display = 'flex';
        if (appPage)   appPage.style.display   = 'none';
        document.getElementById('card-wrap')?.classList.remove('open');
        const pw = document.getElementById('login-password');
        if (pw) pw.value = '';
    }
}

// ─────────────────────────────────────────────
// Global functions wired to login-page HTML
// ─────────────────────────────────────────────
window.doLogin = async function () {
    const role     = document.getElementById('login-role')?.value;
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value?.trim();
    const alertEl  = document.getElementById('login-alert');
    const btn      = document.getElementById('login-btn');

    if (alertEl) alertEl.style.display = 'none';

    if (!password) {
        if (alertEl) { alertEl.textContent = 'Please enter a password'; alertEl.style.display = 'block'; }
        return;
    }
    if (role !== 'admin' && !username) {
        if (alertEl) { alertEl.textContent = 'Please enter your username'; alertEl.style.display = 'block'; }
        return;
    }

    if (btn) { btn.innerHTML = '<span class="spinner-sm"></span> Signing in…'; btn.disabled = true; }

    try {
        const result = await login(role, username, password);
        if (!result.success) {
            if (alertEl) { alertEl.textContent = result.error; alertEl.style.display = 'block'; }
            return;
        }
        state.currentUser = result.user;
        saveSession(result.user);
        await bootApp(result.user);
    } catch (err) {
        if (alertEl) { alertEl.textContent = 'Login error: ' + err.message; alertEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.innerHTML = 'Sign In →'; btn.disabled = false; }
    }
};

window.logout = async function () {
    await logout();
    isBooted = false;
    state.currentUser = null;

    const loginPage = document.getElementById('login-page');
    const appPage   = document.getElementById('app-page');
    if (loginPage) loginPage.style.display = 'flex';
    if (appPage)   appPage.style.display   = 'none';
    document.getElementById('card-wrap')?.classList.remove('open');
    const pw = document.getElementById('login-password');
    if (pw) pw.value = '';

    showToast('Logged out successfully', 'success');
};

window.openLoginCard = function () {
    document.getElementById('card-wrap')?.classList.add('open');
    setTimeout(() => document.getElementById('login-password')?.focus(), 700);
};

window.onRoleChange = function () {
    const role = document.getElementById('login-role')?.value;
    const usernameField = document.getElementById('username-field');
    if (usernameField) usernameField.style.display = role === 'admin' ? 'none' : 'block';
};

window.toggleLoginPw = function () {
    const input = document.getElementById('login-password');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
};
