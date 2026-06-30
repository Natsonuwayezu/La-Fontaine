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
                const reg = await navigator.serviceWorker.register('/pwa/sw.js', { scope: '/' });
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
