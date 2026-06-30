// ══════════════════════════════════════════════════════════════════════════
// js/core/boot.js — Application boot sequence (bootApp, initApp)
// PWA registration (registerServiceWorker, initPWA, installPWA, etc.) now
// lives exclusively in js/core/pwa.js — removed here to avoid duplicate
// definitions that were silently overriding the correct /pwa/sw.js path.
// ══════════════════════════════════════════════════════════════════════════

        // ──────────────────────────────────────────────────────────────────────
        // 13.2 — bootApp
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Set up the full application shell after a successful login.
         * Steps:
         *   1. Hide login page, show app shell
         *   2. Apply role-based CSS tokens
         *   3. Update topbar and sidebar with user info
         *   4. Build sidebar navigation for this role
         *   5. Load all data from Supabase (loadInitialData)
         *   6. Update the term progress bar
         *   7. Apply school logo
         *   8. Navigate to the last visited module (or role dashboard)
         *   9. Start session watcher and background auto-tasks
         */
        async function bootApp(user) {
            if (isBooted) return;

            // Swap login → app
            const loginPage = document.getElementById('login-page');
            const appPage = document.getElementById('app-page');
            if (loginPage) loginPage.style.display = 'none';
            if (appPage) appPage.style.display = 'block';

            document.body.className = `role-${user.role}`;

            // Render shell UI immediately so it feels instant
            renderTopbar();
            updateTopbarUser(user);
            buildSidebar(user.role);
            updateSidebarUser(user);

            // Show data-loading spinner inside content area
            const content = document.getElementById('dynamic-content');
            if (content) {
                content.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading data from server…</p></div>`;
            }

            try {
                // ── 1. Load data — cache-first for speed ────────────
                // Try the per-user IndexedDB cache first so returning users see
                // their dashboard almost instantly. If found, we still refresh
                // from Supabase afterwards (in the background) to pick up any
                // changes made since the cache was written.
                const fromCache = await loadStateFromCache(user);
                let loaded;
                if (fromCache) {
                    loaded = true;
                    // Refresh in the background; don't block the UI on it.
                    loadInitialData(true).then(ok => { if (ok) saveStateToCache(user); }).catch(console.warn);
                } else {
                    loaded = await loadInitialData();
                    if (loaded) saveStateToCache(user).catch(console.warn);
                }
                if (!loaded) throw new Error('Data load returned false — check Supabase connection.');
                await autoWaiveExpiredFees();
                initBackgroundService().catch(console.warn);

                // ── 2. Academic phase ───────────────────────────────
                state.currentPhase = getCurrentPhase();
                updateProgressBar();

                // ── 3. Determine which module to open ──────────────
                const defaultModules = {
                    admin: 'admin-dashboard',
                    accountant: 'accountant-dashboard',
                    teacher: 'teacher-dashboard'
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



        // ──────────────────────────────────────────────────────────────────────
        // 13.3 — initApp
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Called on DOMContentLoaded.
         * Checks for a stored session and restores it, or shows the login page.
         */
        async function initApp() {
            const storedUser = checkAuth();
            if (storedUser) {
                state.currentUser = storedUser;
                await bootApp(storedUser);
            } else {
                document.getElementById('login-page').style.display = 'flex';
                document.getElementById('app-page').style.display = 'none';
                document.getElementById('card-wrap')?.classList.remove('open');
                document.getElementById('login-password').value = '';
            }
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 20 — DASHBOARD MODULES
