// ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 13.1 — PWA Support
        // ──────────────────────────────────────────────────────────────────────


        // Holds the deferred install prompt event until the user clicks Install
        let deferredPrompt = null;

        /**
         * Register the Service Worker (/sw.js).
         * Only runs on HTTPS or localhost — silently skips otherwise.
         * Shows a toast notification when a new version is available.
         */
        async function registerServiceWorker() {
            if (!('serviceWorker' in navigator)) {
                console.log('[PWA] Service Worker not supported in this browser.');
                return false;
            }
            const proto = window.location.protocol;
            const host = window.location.hostname;
            if (proto !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') {
                console.log('[PWA] Service Worker requires HTTPS (or localhost).');
                return false;
            }
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('[PWA] Service Worker registered:', registration.scope);
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('🔄 New version available — refresh to update', 'info', 8000);
                        }
                    });
                });
                return true;
            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
                return false;
            }
        }

        /**
         * Listen for the browser beforeinstallprompt event and show the
         * Install button in the topbar when it fires.
         */
        function initPWAInstall() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                const btn = document.getElementById('pwa-install-btn');
                if (btn) btn.style.display = 'inline-flex';
                console.log('[PWA] Installation prompt available');
            });
            window.addEventListener('appinstalled', () => {
                deferredPrompt = null;
                const btn = document.getElementById('pwa-install-btn');
                if (btn) btn.style.display = 'none';
                showToast('✅ App installed successfully!', 'success');
                console.log('[PWA] App installed');
            });
        }

        /**
         * Trigger the PWA install prompt when the user clicks the Install button.
         */
        async function installPWA() {
            if (!deferredPrompt) {
                showToast('App is already installed or cannot be installed in this browser.', 'info');
                return;
            }
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') showToast('✅ Installing ECOLE LA FONTAINE…', 'success');
            deferredPrompt = null;
            const btn = document.getElementById('pwa-install-btn');
            if (btn) btn.style.display = 'none';
        }

        /**
         * Dynamically generate and inject the PWA web manifest using
         * the school name and logo from school settings.
         */
        function generateManifest() {
            const settings = state.schoolSettings || {};
            const schoolName = settings.school_name || 'ECOLE LA FONTAINE';
            const logo = settings.school_logo || '';
            const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231a3a5c'/%3E%3Ctext x='50' y='70' font-size='60' text-anchor='middle' fill='white'%3E%F0%9F%8F%AB%3C/text%3E%3C/svg%3E";
            const iconSrc = (logo && (logo.startsWith('data:') || logo.startsWith('http'))) ? logo : fallback;
            const manifest = {
                name: schoolName,
                short_name: schoolName.substring(0, 12),
                description: settings.school_motto || 'School Management System',
                start_url: '/',
                display: 'standalone',
                theme_color: '#1a3a5c',
                background_color: '#0f172a',
                icons: [
                    { src: iconSrc, sizes: '192x192', type: 'image/png' },
                    { src: iconSrc, sizes: '512x512', type: 'image/png' }
                ]
            };
            const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            let link = document.querySelector('link[rel="manifest"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'manifest';
                document.head.appendChild(link);
            }
            link.href = url;
        }

        /**
         * Pre-cache the offline fallback page using the Cache API.
         * Non-fatal — silently skips if Cache API is unavailable.
         */
        async function cacheOfflinePage() {
            if (!('caches' in window)) return;
            try {
                const cache = await caches.open('ecole-cache-v1');
                await cache.add('/offline.html');
                console.log('[PWA] Offline page cached');
            } catch (err) {
                console.warn('[PWA] Could not cache offline page:', err.message);
            }
        }

        /**
         * Returns true if the app is running in standalone (installed PWA) mode.
         */
        function isStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;
        }


        /**
         * Full PWA initialisation — called once on DOMContentLoaded.
         * Registers service worker, sets up install prompt, generates manifest.
         */
        function initPWA() {
            registerServiceWorker();
            initPWAInstall();
            generateManifest();
            cacheOfflinePage();

            if (!isStandalone() && !localStorage.getItem('pwa_prompt_shown')) {
                setTimeout(() => {
                    const btn = document.getElementById('pwa-install-btn');
                    if (btn && btn.style.display !== 'none') {
                        showToast('📲 Install app for a better experience', 'info', 5000);
                        localStorage.setItem('pwa_prompt_shown', 'true');
                    }
                }, 3000);
            }
        }


        /**
         * Trigger the deferred PWA install prompt.
         */



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
