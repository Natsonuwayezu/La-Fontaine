// js/ui/shell.js
// Source lines: 12707–13378 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 10.1 — Login Page Particles Animation
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Create animated floating particles in the login page background.
         * Pure CSS-animation driven; no canvas required.
         */
        function initParticles() {
            const container = document.getElementById('particles-bg');
            if (!container) return;

            for (let i = 0; i < 24; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                const size = 4 + Math.random() * 20;
                particle.style.cssText = `
                        width: ${size}px;
                        height: ${size}px;
                        left: ${Math.random() * 100}%;
                        animation-duration: ${8 + Math.random() * 15}s;
                        animation-delay: ${-Math.random() * 20}s;
                    `;
                container.appendChild(particle);
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 10.2 — Theme Management
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Retrieve the saved theme from localStorage.
         * Returns 'dark' or 'light'. Defaults to 'light'.
         */
        function getSavedTheme() {
            return localStorage.getItem('elf_theme') || 'light';
        }

        /**
         * Apply the saved theme (dark/light) from localStorage on page load.
         * Falls back to system preference via prefers-color-scheme.
         */
        function initTheme() {
            const savedTheme = getSavedTheme();
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = savedTheme || (prefersDark ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
            const icon = document.getElementById('dropdown-theme-icon');
            const text = document.getElementById('dropdown-theme-text');
            const btn = document.getElementById('theme-toggle-btn');
            if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
            if (text) text.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
            if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }


        /**
         * Toggle between dark and light mode and persist the preference.
         */
        function toggleTheme() {
            const cur = document.documentElement.getAttribute('data-theme') || 'light';
            const next = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('elf_theme', next);

            const themeIcon = document.getElementById('dropdown-theme-icon');
            const themeText = document.getElementById('dropdown-theme-text');
            if (themeIcon && themeText) {
                themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
                themeText.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
            }
            showToast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode', 'info', 1500);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 10.3 — Sidebar Navigation
        // ──────────────────────────────────────────────────────────────────────


        // ── Navigation Menu Configuration ─────────────────────────────────────
        // Defines which sections and items each role sees in the sidebar.
        // Keys are the module IDs passed to navigateTo().

        const NAV_CONFIG = {
            admin: [
                { section: 'Dashboard', items: [{ id: 'admin-dashboard', icon: '📊', label: 'Main Dashboard' }, { id: 'notifications', icon: '🔔', label: 'Notifications' }, { id: 'announcements', icon: '📢', label: 'Announcements' }] },
                { section: 'Academics', items: [{ id: 'marks-entry', icon: '✏️', label: 'Marks Entry' }, { id: 'marks-database', icon: '🗄️', label: 'Marks Database' }, { id: 'class-register', icon: '📋', label: 'Class Register' }, { id: 'statistics', icon: '📈', label: 'Statistics' }, { id: 'timetable', icon: '🕐', label: 'Timetable' }, { id: 'report-cards', icon: '📄', label: 'Report Cards' }, { id: 'assessments', icon: '📝', label: 'Assessments' }] },
                { section: 'Students', items: [{ id: 'student-list', icon: '📋', label: 'Student List' }, { id: 'enroll-student', icon: '➕', label: 'Enroll Student' }, { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }, { id: 'student-fees', icon: '💰', label: 'Student Fees' }, { id: 'sibling-linking', icon: '👨‍👩‍👧', label: 'Sibling Linking' }, { id: 'student-archive', icon: '📦', label: 'Student Archive' }, { id: 'bulk-import', icon: '📤', label: 'Bulk Import' }, { id: 'bulk-export', icon: '📥', label: 'Bulk Export' }, { id: 'student-promotion', icon: '🎓', label: 'Student Promotion' }] },
                { section: 'Finance', items: [{ id: 'fee-structure', icon: '🏷️', label: 'Fee Structure' }, { id: 'payment-history', icon: '📜', label: 'Payment History' }, { id: 'record-payment', icon: '💸', label: 'Record Payment' }, { id: 'financial-reports', icon: '📊', label: 'Financial Reports' }, { id: 'student-fee-status', icon: '📊', label: 'Fee Status List' }, { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' }, { id: 'fee-waivers', icon: '🎁', label: 'Fee Waivers' }, { id: 'receipts', icon: '🧾', label: 'Receipts' }] },
                { section: 'Staff', items: [{ id: 'teachers-list', icon: '📋', label: 'Teachers List' }, { id: 'subjects', icon: '📖', label: 'Subjects' }, { id: 'teacher-assignments', icon: '📌', label: 'Assignments' }, { id: 'teacher-performance', icon: '⭐', label: 'Teacher Performance' }] },
                { section: 'Settings', items: [{ id: 'school-settings', icon: '🏫', label: 'School Settings' }, { id: 'academic-calendar', icon: '📅', label: 'Academic Calendar' }, { id: 'class-management', icon: '🏛️', label: 'Class Management' }, { id: 'grading-scale', icon: '📊', label: 'Grading Scale' }, { id: 'user-management', icon: '👥', label: 'User Management' }, { id: 'backup-restore', icon: '💾', label: 'Backup & Restore' }, { id: 'system-logs', icon: '📋', label: 'System Logs' }, { id: 'analytics', icon: '📊', label: 'Analytics' }, { id: 'api-settings', icon: '🔌', label: 'API Settings' }] }
            ],
            accountant: [
                { section: 'Dashboard', items: [{ id: 'accountant-dashboard', icon: '📊', label: 'Main Dashboard' }, { id: 'notifications', icon: '🔔', label: 'Notifications' }] },
                { section: 'Students', items: [{ id: 'student-list', icon: '📋', label: 'Student List' }, { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }, { id: 'sibling-linking', icon: '👨‍👩‍👧', label: 'Sibling Linking' }] },
                { section: 'Finance', items: [{ id: 'fee-structure', icon: '🏷️', label: 'Fee Structure' }, { id: 'payment-history', icon: '📜', label: 'Payment History' }, { id: 'record-payment', icon: '💸', label: 'Record Payment' }, { id: 'financial-reports', icon: '📊', label: 'Financial Reports' }, { id: 'student-fee-status', icon: '📊', label: 'Fee Status List' }, { id: 'overdue-payments', icon: '⚠️', label: 'Overdue Payments' }, { id: 'fee-waivers', icon: '🎁', label: 'Fee Waivers' }, { id: 'receipts', icon: '🧾', label: 'Receipts' }] }
            ],
            teacher: [
                { section: 'Dashboard', items: [{ id: 'teacher-dashboard', icon: '📊', label: 'Main Dashboard' }, { id: 'notifications', icon: '🔔', label: 'Notifications' }] },
                { section: 'Academics', items: [{ id: 'marks-entry', icon: '✏️', label: 'Marks Entry' }, { id: 'marks-database', icon: '🗄️', label: 'Marks Database' }, { id: 'class-register', icon: '📋', label: 'Class Register' }, { id: 'statistics', icon: '📈', label: 'Statistics' }, { id: 'timetable', icon: '🕐', label: 'Timetable' }, { id: 'report-cards', icon: '📄', label: 'Report Cards' }, { id: 'assessments', icon: '📝', label: 'Assessments' }] },
                { section: 'Students', items: [{ id: 'student-list', icon: '📋', label: 'Student List' }, { id: 'student-details', icon: 'ℹ️', label: 'Student Details' }] }
            ]
        }

        /**
         * Build the sidebar navigation from NAV_CONFIG for the given role.
         * Deduplicates nav items within each section before rendering.
         */
        function buildSidebar(role) {
            currentRole = role;

            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;

            // Render the sidebar shell HTML first (only once)
            if (!document.getElementById('sidebar-nav')) {
                sidebar.innerHTML = `
                    <div class="sidebar-brand">
                        <div class="sidebar-logo">🏫</div>
                        <div class="sidebar-brand-text">
                            <div class="sidebar-brand-name">ECOLE LA FONTAINE</div>
                            <div class="sidebar-brand-sub" id="sidebar-school-subtitle">Portal</div>
                        </div>
                    </div>
                    <div class="sidebar-user">
                        <div class="sidebar-avatar" id="sidebar-avatar">👤</div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-username" id="sidebar-username">—</div>
                            <div class="sidebar-userrole" id="sidebar-userrole">—</div>
                        </div>
                    </div>
                    <nav class="sidebar-nav" id="sidebar-nav"></nav>
                    <div class="sidebar-footer">
                        <button class="btn btn-outline btn-sm sidebar-logout-btn" onclick="window.logout()">🚪 Logout</button>
                    </div>
                `;
            }

            // Build nav items filtered by role
            const config = NAV_CONFIG[role] || [];
            const filteredConfig = config.map(section => ({
                ...section,
                items: section.items.filter(item => {
                    if (role === 'teacher' && TEACHER_BLOCKED_MODULES.has(item.id)) return false;
                    if (role === 'accountant' && ACCOUNTANT_BLOCKED_MODULES.has(item.id)) return false;
                    return true;
                })
            })).filter(section => section.items.length > 0);

            const navContainer = document.getElementById('sidebar-nav');
            if (!navContainer) return;

            navContainer.innerHTML = filteredConfig.map(section => `
                <div class="nav-section" id="sec-${escapeHtml(section.section.replace(/\s/g, ''))}">
                    <div class="nav-section-title" onclick="window.toggleNavSection && window.toggleNavSection(this.parentElement)">
                        ${escapeHtml(section.section)} <span class="nav-section-arrow">▾</span>
                    </div>
                    <div class="nav-section-items">
                        ${section.items.map(item => `
                            <div class="nav-item" id="nav-${escapeHtml(item.id)}" onclick="window.navigateTo('${escapeHtml(item.id)}')">
                                <span class="nav-icon">${item.icon}</span>
                                <span>${escapeHtml(item.label)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            // Restore collapsed sections
            try {
                const savedCollapsed = localStorage.getItem('sidebar_collapsed_sections');
                if (savedCollapsed) {
                    JSON.parse(savedCollapsed).forEach(sectionId => {
                        const el = document.getElementById(sectionId);
                        if (el) el.classList.add('collapsed');
                    });
                }
            } catch (_) { }
        }


        /**
         * Returns the module id the user was last viewing (persisted by
         * setActiveNav()/navigateTo() via localStorage), or null if none.
         */
        function getLastModule() {
            return localStorage.getItem('elf_module') || null;
        }

        /**
         * Reset/prepare the topbar for a fresh session. The topbar markup is
         * static HTML (#app-page header.topbar), so this just ensures it's
         * visible and the page title is reset to a sensible default before
         * navigateTo() sets the real title for the first module.
         */
        function renderTopbar() {
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = 'Dashboard';
            const dot = document.getElementById('notif-dot');
            if (dot) dot.style.display = 'none';
        }

        /**
         * Populate the topbar's user-menu (avatar, name) and the user dropdown
         * (name, role) with the logged-in user's details.
         */
        function updateTopbarUser(user) {
            if (!user) return;
            const nameEl = document.getElementById('topbar-username');
            if (nameEl) nameEl.textContent = user.name || user.username || 'User';

            const avatarEl = document.getElementById('topbar-avatar');
            if (avatarEl) avatarEl.textContent = '👤';

            const dropdownName = document.getElementById('dropdown-username');
            if (dropdownName) dropdownName.textContent = user.name || user.username || 'User';

            const dropdownRole = document.getElementById('dropdown-userrole');
            if (dropdownRole) dropdownRole.textContent = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : '—';
        }

        /**
         * Populate the sidebar footer's user card (avatar, name, role).
         * Must be called AFTER buildSidebar(), since buildSidebar() is what
         * creates the #sidebar-avatar / #sidebar-username / #sidebar-userrole
         * elements in the sidebar's dynamically-built HTML.
         */
        function updateSidebarUser(user) {
            if (!user) return;
            const avatarEl = document.getElementById('sidebar-avatar');
            if (avatarEl) avatarEl.textContent = '👤';

            const nameEl = document.getElementById('sidebar-username');
            if (nameEl) nameEl.textContent = user.name || user.username || 'User';

            const roleEl = document.getElementById('sidebar-userrole');
            if (roleEl) roleEl.textContent = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : '—';
        }

        // ──────────────────────────────────────────────────────────────────────
        // Background Watchers — periodic checks started once per session by
        // bootApp(). Each stores its interval handle so it can be cleared on
        // logout if needed, and each is read-only / notification-only (no
        // destructive auto-actions, since those require explicit admin
        // confirmation via their respective modules).
        // ──────────────────────────────────────────────────────────────────────

        let _feeResetTimer = null, _autoArchiveTimer = null, _notifWatcherTimer = null, _autoBackupTimer = null;

        /**
         * Periodically checks whether any recurring fees (monthly/termly) need
         * to be reset/re-applied for the new period. Runs once on start, then
         * every hour. Admin-only — does nothing for teacher/accountant.
         */
        function startFeeResetWatcher() {
            if (_feeResetTimer) clearInterval(_feeResetTimer);
            const check = async () => {
                if (!isAdmin() || !state.currentUser) return;
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    const lastCheck = localStorage.getItem('elf_last_fee_reset_check');
                    if (lastCheck === today) return; // already checked today
                    localStorage.setItem('elf_last_fee_reset_check', today);
                    // Recurring-fee re-application is handled explicitly via the
                    // Fee Structure module; this watcher only flags it's due.
                    console.log('[FeeResetWatcher] Daily check complete for ' + today);
                } catch (e) { console.warn('[FeeResetWatcher] Check failed:', e); }
            };
            check();
            _feeResetTimer = setInterval(check, 60 * 60 * 1000); // hourly
        }

        /**
         * Periodically notifies the admin (via toast, once per day) if there
         * are students eligible for auto-archiving, without archiving them
         * automatically — actual archiving requires explicit confirmation via
         * runAutoArchive() in the Student Archive module.
         */
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
                    const eligible = (state.students || []).filter(s => s.status !== 'Active' && !s.is_deleted && s.updated_at && s.updated_at < cutoff);
                    if (eligible.length > 0) showToast(`📦 ${eligible.length} inactive student(s) eligible for archiving — see Student Archive`, 'info', 6000);
                } catch (e) { console.warn('[AutoArchiveWatcher] Check failed:', e); }
            };
            check();
            _autoArchiveTimer = setInterval(check, 6 * 60 * 60 * 1000); // every 6 hours
        }

        /**
         * Periodically refreshes the notification badge count from
         * state.notifications. The real-time push/poll logic lives in
         * initBackgroundService()/startRealtimePolling(); this is a lighter
         * fallback that keeps the badge in sync even if the service worker
         * path is unavailable (e.g. unsupported browser).
         */
        function startNotificationWatcher() {
            if (_notifWatcherTimer) clearInterval(_notifWatcherTimer);
            const check = () => {
                if (!state.currentUser) return;
                const unread = (state.notifications || []).filter(n => !n.is_read).length;
                updateNotificationBadgeCount(unread);
            };
            check();
            _notifWatcherTimer = setInterval(check, 60 * 1000); // every minute
        }

        /**
         * Periodically reminds the admin to take a backup if one hasn't been
         * taken recently (per APP_CONFIG.autoBackupInterval), using the
         * existing saveBackupWithRotation(isAuto=true) flow. Unlike a silent
         * background backup, this still triggers a real download — but only
         * for the admin, and only after the configured interval has elapsed.
         */
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
                } catch (e) { console.warn('[AutoBackupScheduler] Failed:', e); }
            };
            // Run the first check after a short delay so it doesn't compete with initial page load
            setTimeout(check, 30 * 1000);
            _autoBackupTimer = setInterval(check, 30 * 60 * 1000); // re-check every 30 min (actual backup gated by interval above)
        }

        /**
         * Lightweight safety-net for offline mark syncing. The primary sync
         * trigger is the 'online' event listener in initOfflineSupport(); this
         * adds a periodic fallback in case that event is missed (e.g. the tab
         * was already open when connectivity returned).
         */
        function initAutoSync() {
            setInterval(() => {
                if (navigator.onLine && state.currentUser && typeof syncOfflineMarks === 'function') {
                    syncOfflineMarks().catch(() => { });
                }
            }, 5 * 60 * 1000); // every 5 minutes
        }

        /**
         * Restore the sidebar's collapsed/expanded section state and ensure
         * the mobile sidebar starts closed. buildSidebar() already restores
         * collapsed sections on each call; this just guarantees a clean
         * mobile state at boot.
         */
        function initSidebar() {
            document.getElementById('sidebar')?.classList.remove('mobile-open');
        }

        /**
         * Ensure the user dropdown starts closed at boot. The actual
         * "click outside to close" behavior is wired once globally in the
         * DOMContentLoaded handler, so this only resets visual state.
         */
        function initUserDropdown() {
            document.getElementById('user-dropdown')?.classList.remove('open');
        }

        /**
         * Placeholder hook for a future command-palette (Cmd/Ctrl+K quick
         * navigation) feature. Not yet implemented — present so bootApp()
         * completes cleanly and so a future implementation has a clear home.
         */
        function initCommandPalette() {
            // Intentionally minimal: no command palette UI exists yet.
        }

        /**
         * Initialize the notifications bell badge from currently loaded
         * state.notifications (real-time updates are handled separately by
         * initBackgroundService()/startNotificationWatcher()).
         */
        function initNotifications() {
            const unread = (state.notifications || []).filter(n => !n.is_read).length;
            updateNotificationBadgeCount(unread);
        }

        /**
         * Install a global window.onerror / unhandledrejection handler so
         * unexpected runtime errors surface as a toast (instead of silently
         * failing) and are logged to the console with full detail for
         * debugging, rather than crashing the whole app silently.
         */
        function setupGlobalErrorHandlers() {
            if (window._elfErrorHandlersInstalled) return; // avoid double-binding
            window._elfErrorHandlersInstalled = true;

            window.addEventListener('error', (event) => {
                console.error('[Global Error]', event.error || event.message, event);
            });

            window.addEventListener('unhandledrejection', (event) => {
                console.error('[Unhandled Promise Rejection]', event.reason);
            });
        }


        /**
         * Collapse or expand a sidebar section.
         */
        function toggleNavSection(element) {
            if (!element) return;
            element.classList.toggle('collapsed');
            const collapsed = [];
            document.querySelectorAll('.nav-section.collapsed').forEach(s => collapsed.push(s.id));
            localStorage.setItem('sidebar_collapsed_sections', JSON.stringify(collapsed));
        }


        /**
         * Highlight the active nav item and scroll it into view.
         * Also saves the active module ID to localStorage for session restore.
         */
        function setActiveNav(id) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const el = document.getElementById(`nav-${id}`);
            if (el) {
                el.classList.add('active');
                // Auto-expand section containing this item
                const section = el.closest('.nav-section');
                if (section) section.classList.remove('collapsed');
                currentActiveId = id;
            }
            localStorage.setItem('elf_module', id);
        }


        /**
         * Return the display label for a module ID from NAV_CONFIG.
         */
        function findNavLabel(id, role) {
            const navConfig = {
                admin: [
                    { id: 'admin-dashboard', label: 'Dashboard' },
                    { id: 'marks-entry', label: 'Marks Entry' },
                    { id: 'marks-database', label: 'Marks Database' },
                    { id: 'marks-analysis', label: 'Marks Analysis' },
                    { id: 'class-register', label: 'Class Register' },
                    { id: 'annual-register', label: 'Annual Register' },
                    { id: 'assessments', label: 'Assessments' },
                    { id: 'report-cards', label: 'Report Cards' },
                    { id: 'rankings', label: 'Rankings' },
                    { id: 'statistics', label: 'Statistics' },
                    { id: 'transcripts', label: 'Transcripts' },
                    { id: 'student-list', label: 'Students' },
                    { id: 'enroll-student', label: 'Enroll Student' },
                    { id: 'student-fees', label: 'Student Fees' },
                    { id: 'student-statements', label: 'Student Statements' },
                    { id: 'student-archive', label: 'Student Archive' },
                    { id: 'bulk-import', label: 'Bulk Import' },
                    { id: 'bulk-export', label: 'Bulk Export' },
                    { id: 'sibling-linking', label: 'Sibling Linking' },
                    { id: 'family-management', label: 'Family Management' },
                    { id: 'student-promotion', label: 'Student Promotion' },
                    { id: 'fee-structure', label: 'Fee Structure' },
                    { id: 'fee-structures', label: 'Fee Structures' },
                    { id: 'fee-assignments', label: 'Fee Assignments' },
                    { id: 'fee-term-status', label: 'Fee Term Status' },
                    { id: 'family-fee-summary', label: 'Family Fee Summary' },
                    { id: 'payment-history', label: 'Payment History' },
                    { id: 'record-payment', label: 'Record Payment' },
                    { id: 'overdue-payments', label: 'Overdue Payments' },
                    { id: 'fee-waivers', label: 'Fee Waivers' },
                    { id: 'balances', label: 'Balances' },
                    { id: 'carry-forward', label: 'Carry Forward' },
                    { id: 'credit-balances', label: 'Credit Balances' },
                    { id: 'payment-reversals', label: 'Payment Reversals' },
                    { id: 'discounts', label: 'Discounts' },
                    { id: 'manual-adjustments', label: 'Manual Adjustments' },
                    { id: 'bulk-finance-actions', label: 'Bulk Finance Actions' },
                    { id: 'financial-reports', label: 'Financial Reports' },
                    { id: 'student-fee-status', label: 'Fee Status List' },
                    { id: 'finance-audit', label: 'Finance Audit' },
                    { id: 'receipts', label: 'Receipts' },
                    { id: 'receipt-printing', label: 'Receipt Printing' },
                    { id: 'finance-dashboard', label: 'Finance Dashboard' },
                    { id: 'teachers-list', label: 'Teachers' },
                    { id: 'subjects', label: 'Subjects' },
                    { id: 'teacher-assignments', label: 'Teacher Assignments' },
                    { id: 'teacher-performance', label: 'Teacher Performance' },
                    { id: 'staff-timetable', label: 'Staff Timetable' },
                    { id: 'teacher-timetable', label: 'Teacher Timetable' },
                    { id: 'class-timetable', label: 'Class Timetable' },
                    { id: 'timetable-conflicts', label: 'Timetable Conflicts' },
                    { id: 'timetable-import', label: 'Timetable Import' },
                    { id: 'attendance', label: 'Attendance' },
                    { id: 'attendance-reports', label: 'Attendance Reports' },
                    { id: 'attendance-summary', label: 'Attendance Summary' },
                    { id: 'attendance-analytics', label: 'Attendance Analytics' },
                    { id: 'announcements', label: 'Announcements' },
                    { id: 'notifications', label: 'Notifications' },
                    { id: 'notification-center', label: 'Notification Center' },
                    { id: 'reminders', label: 'Reminders' },
                    { id: 'school-settings', label: 'School Settings' },
                    { id: 'academic-calendar', label: 'Academic Calendar' },
                    { id: 'academic-years', label: 'Academic Years' },
                    { id: 'class-management', label: 'Class Management' },
                    { id: 'grading-scale', label: 'Grading Scale' },
                    { id: 'grading-settings', label: 'Grading Settings' },
                    { id: 'user-management', label: 'User Management' },
                    { id: 'backup-restore', label: 'Backup & Restore' },
                    { id: 'system-logs', label: 'System Logs' },
                    { id: 'system-health', label: 'System Health' },
                    { id: 'analytics', label: 'Analytics' },
                    { id: 'analytics-settings', label: 'Analytics Settings' },
                    { id: 'api-settings', label: 'API Settings' },
                    { id: 'settings', label: 'Settings' }
                ],
                accountant: [
                    { id: 'accountant-dashboard', label: 'Dashboard' },
                    { id: 'student-list', label: 'Students' },
                    { id: 'student-details', label: 'Student Details' },
                    { id: 'student-fees', label: 'Student Fees' },
                    { id: 'student-statements', label: 'Student Statements' },
                    { id: 'fee-structure', label: 'Fee Structure' },
                    { id: 'fee-structures', label: 'Fee Structures' },
                    { id: 'fee-assignments', label: 'Fee Assignments' },
                    { id: 'fee-term-status', label: 'Fee Term Status' },
                    { id: 'family-fee-summary', label: 'Family Fee Summary' },
                    { id: 'payment-history', label: 'Payment History' },
                    { id: 'record-payment', label: 'Record Payment' },
                    { id: 'overdue-payments', label: 'Overdue Payments' },
                    { id: 'fee-waivers', label: 'Fee Waivers' },
                    { id: 'balances', label: 'Balances' },
                    { id: 'carry-forward', label: 'Carry Forward' },
                    { id: 'credit-balances', label: 'Credit Balances' },
                    { id: 'payment-reversals', label: 'Payment Reversals' },
                    { id: 'discounts', label: 'Discounts' },
                    { id: 'manual-adjustments', label: 'Manual Adjustments' },
                    { id: 'bulk-finance-actions', label: 'Bulk Finance Actions' },
                    { id: 'financial-reports', label: 'Financial Reports' },
                    { id: 'student-fee-status', label: 'Fee Status List' },
                    { id: 'finance-audit', label: 'Finance Audit' },
                    { id: 'receipts', label: 'Receipts' },
                    { id: 'receipt-printing', label: 'Receipt Printing' },
                    { id: 'finance-dashboard', label: 'Finance Dashboard' },
                    { id: 'attendance', label: 'Attendance' },
                    { id: 'attendance-reports', label: 'Attendance Reports' },
                    { id: 'attendance-summary', label: 'Attendance Summary' },
                    { id: 'announcements', label: 'Announcements' },
                    { id: 'notifications', label: 'Notifications' }
                ],
                teacher: [
                    { id: 'teacher-dashboard', label: 'Dashboard' },
                    { id: 'marks-entry', label: 'Marks Entry' },
                    { id: 'marks-database', label: 'Marks Database' },
                    { id: 'class-register', label: 'Class Register' },
                    { id: 'assessments', label: 'Assessments' },
                    { id: 'report-cards', label: 'Report Cards' },
                    { id: 'rankings', label: 'Rankings' },
                    { id: 'statistics', label: 'Statistics' },
                    { id: 'student-list', label: 'Students' },
                    { id: 'student-details', label: 'Student Details' },
                    { id: 'teacher-timetable', label: 'My Timetable' },
                    { id: 'class-timetable', label: 'Class Timetable' },
                    { id: 'attendance', label: 'Attendance' },
                    { id: 'attendance-reports', label: 'Attendance Reports' },
                    { id: 'announcements', label: 'Announcements' },
                    { id: 'notifications', label: 'Notifications' }
                ]
            };

            const config = navConfig[role] || [];
            for (const item of config) {
                if (item.id === id) return item.label;
            }
            return id;
        }


        /**
         * Toggle the mobile sidebar open/closed.
         */
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;
            sidebar.classList.toggle('mobile-open');
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay && sidebar.classList.contains('mobile-open')) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                overlay.onclick = closeSidebarMobile;
                document.body.appendChild(overlay);
            } else if (overlay) {
                overlay.remove();
            }
        }

        /**
         * Close the sidebar on mobile.
         * Called after navigation AND when user taps outside the sidebar.
         * The sidebar-overlay click also calls this so tapping outside always collapses it.
         */
        function closeSidebarMobile() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('mobile-open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.remove();
        }
        window.closeSidebarMobile = closeSidebarMobile;


        /**
         * Toggle the user dropdown menu open/closed.
         */
        function toggleUserDropdown() {
            document.getElementById('user-dropdown')?.classList.toggle('open');
        }



        // ──────────────────────────────────────────────────────────────────────
        // 10.4 — Term Progress Bar
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Update the term progress bar in the topbar with current completion %,
         * days remaining, and the phase indicator badge.
         */
        function updateProgressBar() {
            const term = state.currentTerm;
            const { pct, daysLeft, text } = termProgress(term);
            document.getElementById('prog-fill').style.width = pct + '%';
            document.getElementById('prog-text').textContent = text;
            document.getElementById('prog-days').textContent = daysLeft;
            document.getElementById('prog-term-name').textContent = state.schoolSettings.current_term || 'Term 3';
            document.getElementById('prog-acad-year').textContent = state.currentAcadYear?.year_name || '2025-2026';

            const phase = getCurrentPhase(term);
            const phaseText = phase === 'pre_midterm' ? '📅 Pre' : '📅 Post';
            const phaseClass = phase === 'pre_midterm' ? 'phase-pre' : 'phase-post';
            const compactIndicator = document.getElementById('phase-indicator-compact');
            if (compactIndicator) {
                compactIndicator.textContent = phaseText;
                compactIndicator.className = `phase-badge-compact ${phaseClass}`;
            }
        }


        // Alias for backwards compatibility
        const updateTermProgressBar = updateProgressBar;



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 11 — TOAST NOTIFICATIONS & MODAL SYSTEM
