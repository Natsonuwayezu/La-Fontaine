// ================================================================

        let _feeResetTimer = null,
            _autoArchiveTimer = null,
            _notifWatcherTimer = null,
            _autoBackupTimer = null;

        function startFeeResetWatcher() {
            if (_feeResetTimer) clearInterval(_feeResetTimer);
            const check = async () => {
                if (!isAdmin() || !state.currentUser) return;
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    const lastCheck = localStorage.getItem('elf_last_fee_reset_check');
                    if (lastCheck === today) return;
                    localStorage.setItem('elf_last_fee_reset_check', today);
                    console.log('[FeeResetWatcher] Daily check complete for ' + today);
                } catch (e) {
                    console.warn('[FeeResetWatcher] Check failed:', e);
                }
            };
            check();
            _feeResetTimer = setInterval(check, 60 * 60 * 1000);
        }

        function startAutoArchiveWatcher() {
            if (_autoArchiveTimer) clearInterval(_autoArchiveTimer);
            const check = async () => {
                if (!isAdmin() || !state.currentUser) return;
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    const lastCheck = localStorage.getItem('elf_last_archive_check');
                    if (lastCheck === today) return;
                    localStorage.setItem('elf_last_archive_check', today);
                    const days = parseInt(state.schoolSettings?.auto_archive_days) || 365;
                    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
                    const eligible = (state.students || []).filter(s => s.status !== 'Active' && !s.is_deleted && s.updated_at &&
                        s.updated_at < cutoff);
                    if (eligible.length > 0) showToast(
                        `📦 ${eligible.length} inactive student(s) eligible for archiving — see Student Archive`, 'info', 6000);
                } catch (e) {
                    console.warn('[AutoArchiveWatcher] Check failed:', e);
                }
            };
            check();
            _autoArchiveTimer = setInterval(check, 6 * 60 * 60 * 1000);
        }

        function startNotificationWatcher() {
            if (_notifWatcherTimer) clearInterval(_notifWatcherTimer);
            const check = () => {
                if (!state.currentUser) return;
                const unread = (state.notifications || []).filter(n => !n.is_read).length;
                updateNotificationBadgeCount(unread);
            };
            check();
            _notifWatcherTimer = setInterval(check, 60 * 1000);
        }

        function startAutoBackupScheduler() {
            if (_autoBackupTimer) clearInterval(_autoBackupTimer);
            const check = async () => {
                if (!isAdmin() || !state.currentUser) return;
                try {
                    const lastBackup = localStorage.getItem('elf_last_auto_backup');
                    const interval = APP_CONFIG.autoBackupInterval || (6 * 60 * 60 * 1000);
                    if (lastBackup && Date.now() - parseInt(lastBackup) < interval) return;
                    localStorage.setItem('elf_last_auto_backup', String(Date.now()));
                    if (typeof saveBackupWithRotation === 'function') await saveBackupWithRotation(true);
                } catch (e) {
                    console.warn('[AutoBackupScheduler] Failed:', e);
                }
            };
            setTimeout(check, 30 * 1000);
            _autoBackupTimer = setInterval(check, 30 * 60 * 1000);
        }

        function initAutoSync() {
            setInterval(() => {
                if (navigator.onLine && state.currentUser && typeof syncOfflineMarks === 'function') {
                    syncOfflineMarks().catch(() => { });
                }
            }, 5 * 60 * 1000);
        }

        function initSidebar() {
            document.getElementById('sidebar')?.classList.remove('mobile-open');
        }

        function initUserDropdown() {
            document.getElementById('user-dropdown')?.classList.remove('open');
        }

        function initCommandPalette() {
            /* Command palette placeholder */
        }

        function initNotifications() {
            const unread = (state.notifications || []).filter(n => !n.is_read).length;
            updateNotificationBadgeCount(unread);
        }

        function setupGlobalErrorHandlers() {
            if (window._elfErrorHandlersInstalled) return;
            window._elfErrorHandlersInstalled = true;
            window.addEventListener('error', (event) => {
                console.error('[Global Error]', event.error || event.message, event);
            });
            window.addEventListener('unhandledrejection', (event) => {
                console.error('[Unhandled Promise Rejection]', event.reason);
            });
        }

        // ────────────────────────────────────────────────────────────────
        // 43.1 - Background Service & Push Notifications
        // ────────────────────────────────────────────────────────────────
        async function initBackgroundService() {
            if (!('serviceWorker' in navigator)) {
                console.warn('[BG] Service workers not supported');
                return;
            }
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('[BG] SW registered:', reg.scope);
                navigator.serviceWorker.addEventListener('message', (event) => {
                    const { type, action } = event.data || {};
                    if (type === 'NOTIFICATION_CLICK' && action) navigateTo(action);
                });
                if (Notification.permission === 'default') await Notification.requestPermission();
                startRealtimePolling(reg);
            } catch (err) {
                console.error('[BG] SW registration failed:', err);
            }
        }

        function startRealtimePolling(swReg) {
            if (_pollingInterval) clearInterval(_pollingInterval);
            _pollingInterval = setInterval(async () => {
                if (state.currentUser) await checkForNewNotifications(swReg);
            }, 30000);
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible' && state.currentUser) await checkForNewNotifications(swReg);
            });
            window.addEventListener('online', async () => {
                if (state.currentUser) await checkForNewNotifications(swReg);
            });
        }

        async function checkForNewNotifications(swReg) {
            try {
                const since = new Date(_lastNotifCheck).toISOString();
                _lastNotifCheck = Date.now();
                const user = state.currentUser;
                if (!user) return;
                const result = await apiRequest(
                    'announcements?created_at=gt.' + encodeURIComponent(since) +
                    '&status=eq.published&order=created_at.desc&limit=20');
                if (!result.success || !result.data.length) return;
                for (const notif of result.data) {
                    if (!shouldShowNotificationForRole(notif, user.role)) continue;
                    state.notifications = state.notifications || [];
                    if (!state.notifications.find(n => n.id === notif.id)) state.notifications.unshift(notif);
                    if (Notification.permission === 'granted' && swReg) {
                        await swReg.showNotification(notif.title || 'ECOLE LA FONTAINE', {
                            body: notif.message || '',
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/badge-72x72.png',
                            tag: 'notif-' + notif.id,
                            data: { action: getNotifNavTarget(notif), type: notif.type },
                            vibrate: [200, 100, 200],
                            requireInteraction: notif.type === 'urgent'
                        });
                    }
                }
                updateNotificationBadgeCount((state.notifications || []).filter(n => !n.is_read).length);
            } catch (err) {
                console.warn('[BG] Notification check failed:', err);
            }
        }

        function shouldShowNotificationForRole(notif, role) {
            if (role === 'admin') return true;
            const recipients = notif.recipients || 'all';
            if (recipients === 'all') return true;
            if (recipients === 'teachers' && role === 'teacher') return true;
            if (recipients === 'accountants' && role === 'accountant') return true;
            const category = (notif.category || '').toLowerCase();
            const TEACHER_BLOCKED = ['finance', 'payment', 'fee', 'receipt', 'balance'];
            const ACCOUNTANT_BLOCKED = ['marks', 'academic', 'assessment', 'grades', 'register'];
            if (role === 'teacher' && TEACHER_BLOCKED.some(c => category.includes(c))) return false;
            if (role === 'accountant' && ACCOUNTANT_BLOCKED.some(c => category.includes(c))) return false;
            return true;
        }

        function getNotifNavTarget(notif) {
            const cat = (notif.category || '').toLowerCase();
            if (cat.includes('mark') || cat.includes('academic')) return 'marks';
            if (cat.includes('payment') || cat.includes('fee')) return 'record-payment';
            if (cat.includes('student')) return 'students';
            if (cat.includes('backup')) return 'backup-restore';
            if (cat.includes('setting')) return 'school-settings';
            return 'notifications';
        }

        async function notifyAction(action, details = {}, targetRoles = ['admin']) {
            const user = state.currentUser;
            if (!user) return;
            const categoryMap = {
                marks_import: 'academic',
                payment_recorded: 'payment',
                payment_reversed: 'payment',
                setting_updated: 'system',
                backup_created: 'system',
                student_enrolled: 'student',
                fee_waived: 'finance',
                fee_structure_changed: 'finance'
            };
            const iconMap = {
                marks_import: '📝',
                payment_recorded: '💰',
                payment_reversed: '↩️',
                setting_updated: '⚙️',
                backup_created: '💾',
                student_enrolled: '🎓',
                fee_waived: '🎁',
                fee_structure_changed: '🏷️'
            };
            try {
                await apiRequest('announcements', 'POST', {
                    title: (iconMap[action] || '🔔') + ' ' + action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    message: details.message || JSON.stringify(details),
                    type: 'info',
                    status: 'published',
                    recipients: targetRoles.includes('all') ? 'all' : targetRoles.length === 1 ? (targetRoles[0] === 'teachers' ?
                        'teachers' : targetRoles[0] === 'accountants' ? 'accountants' : 'all') : 'all',
                    category: categoryMap[action] || 'system',
                    created_by: user.id,
                    created_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('[notifyAction] Failed:', err);
            }
        }

        function showRoleNotification(message, type = 'info', roles = ['admin', 'accountant', 'teacher']) {
            const user = state.currentUser;
            if (!user) return;
            if (!roles.includes(user.role) && !roles.includes('all')) return;
            showToast(message, type, 5000);
        }

        // ────────────────────────────────────────────────────────────────
        // 43.2 - PWA Support
        // ────────────────────────────────────────────────────────────────
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

        function generateManifest() {
            const settings = state.schoolSettings || {};
            const schoolName = settings.school_name || 'ECOLE LA FONTAINE';
            const logo = settings.school_logo || '';
            const fallback =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231a3a5c'/%3E%3Ctext x='50' y='70' font-size='60' text-anchor='middle' fill='white'%3E%F0%9F%8F%AB%3C/text%3E%3C/svg%3E";
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

        function isStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

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

        // ────────────────────────────────────────────────────────────────
        // 43.3 - Boot Application
        // ────────────────────────────────────────────────────────────────
        async function bootApp(user) {
            if (isBooted) return;
            const loginPage = document.getElementById('login-page');
            const appPage = document.getElementById('app-page');
            if (loginPage) loginPage.style.display = 'none';
            if (appPage) appPage.style.display = 'block';
            document.body.className = `role-${user.role}`;
            renderTopbar();
            updateTopbarUser(user);
            buildSidebar(user.role);
            updateSidebarUser(user);
            const content = document.getElementById('dynamic-content');
            if (content) {
                content.innerHTML =
                    `<div class="loading-container"><div class="spinner"></div><p>Loading data from server…</p></div>`;
            }
            try {
                const fromCache = await loadStateFromCache(user);
                let loaded;
                if (fromCache) {
                    loaded = true;
                    loadInitialData(true).then(ok => { if (ok) saveStateToCache(user); }).catch(console.warn);
                } else {
                    loaded = await loadInitialData();
                    if (loaded) saveStateToCache(user).catch(console.warn);
                }
                if (!loaded) throw new Error('Data load returned false — check Supabase connection.');
                await autoWaiveExpiredFees();
                initBackgroundService().catch(console.warn);
                state.currentPhase = getCurrentPhase();
                updateProgressBar();
                const defaultModules = {
                    admin: 'admin-dashboard',
                    accountant: 'accountant-dashboard',
                    teacher: 'teacher-dashboard'
                };
                let lastModule = getLastModule();
                if (!lastModule || !document.getElementById(`nav-${lastModule}`)) {
                    lastModule = defaultModules[user.role] || 'admin-dashboard';
                }
                await navigateTo(lastModule);
                startSessionWatcher();
                startFeeResetWatcher();
                startAutoArchiveWatcher();
                startNotificationWatcher();
                startAutoBackupScheduler();
                initOfflineSupport();
                initAutoSync();
                initSidebar();
                initUserDropdown();
                initTheme();
                initPWA();
                initCommandPalette();
                initNotifications();
                setupGlobalErrorHandlers();
                isBooted = true;
                if (navigator.onLine) {
                    setTimeout(() => { window.syncOfflineMarks?.(); }, 3000);
                }
                console.log('✅ ECOLE LA FONTAINE v9.0 — App booted successfully');
            } catch (error) {
                console.error('[app] Boot failed:', error);
                if (content) {
                    content.innerHTML =
                        `<div class="alert alert-danger" style="margin:2rem"><strong>⚠️ Failed to load data from server.</strong><br>${error.message}<br><br><button class="btn btn-primary" onclick="location.reload()">🔄 Retry</button><button class="btn btn-outline" onclick="navigateTo('api-settings')">⚙️ API Settings</button></div>`;
                }
            }
        }

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

        // ────────────────────────────────────────────────────────────────
        // 43.4 - Particles Background
        // ────────────────────────────────────────────────────────────────
        function initParticles() {
            const container = document.getElementById('particles-bg');
            if (!container) return;
            for (let i = 0; i < 24; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                const size = 4 + Math.random() * 20;
                particle.style.cssText =
                    `width: ${size}px;height: ${size}px;left: ${Math.random() * 100}%;animation-duration: ${8 + Math.random() * 15}s;animation-delay: ${-Math.random() * 20}s;`;
                container.appendChild(particle);
            }
        }

        // ================================================================
        // SECTION 44: QR CODE SYSTEM
