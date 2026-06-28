// ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 8.1 — Session Storage
        // ──────────────────────────────────────────────────────────────────────


        /** Check localStorage for a valid, non-expired session. Returns user object or null. */
        function checkAuth() {
            const stored = localStorage.getItem('elf_user');
            const expiry = localStorage.getItem('elf_expiry');
            if (!stored || !expiry) return null;
            if (Date.now() > parseInt(expiry)) {
                localStorage.removeItem('elf_user');
                localStorage.removeItem('elf_expiry');
                return null;
            }
            try { return JSON.parse(stored); } catch { return null; }
        }

        /** Persist user session for APP_CONFIG.sessionDuration milliseconds. */
        function saveSession(user) {
            localStorage.setItem('elf_user', JSON.stringify(user));
            localStorage.setItem('elf_expiry', String(Date.now() + APP_CONFIG.sessionDuration));
        }

        /** Remove all session data from localStorage. */
        function clearSession() {
            localStorage.removeItem('elf_user');
            localStorage.removeItem('elf_expiry');
        }

        /** Reset session expiry on any user activity (called by event listeners). */
        function resetSessionExpiry() {
            if (checkAuth()) localStorage.setItem('elf_expiry', String(Date.now() + APP_CONFIG.sessionDuration));
        }



        // ──────────────────────────────────────────────────────────────────────
        // 8.2 — Session Watcher & Idle Auto-Logout
        // ──────────────────────────────────────────────────────────────────────

        // Interval handle for the session-expiry watcher (set by startSessionWatcher,
        // cleared on logout).
        let _sessionTimer = null;

        /**
         * Start a 60-second interval that checks if the session has expired.
         * Also resets expiry on any click/keydown/mousemove.
         */
        function startSessionWatcher() {
            if (_sessionTimer) clearInterval(_sessionTimer);

            _sessionTimer = setInterval(() => {
                if (!checkAuth()) {
                    showToast('Session expired. Please login again.', 'warning');
                    logout();
                }
            }, 60000);

            // Reset expiry on user activity
            const events = ['click', 'keydown', 'mousemove', 'touchstart'];
            events.forEach(ev => {
                document.addEventListener(ev, () => {
                    if (state.currentUser) {
                        resetSessionExpiry();
                    }
                }, { passive: true });
            });
        }


        /**
         * Start the idle-inactivity watcher.
         * Shows a warning overlay at 25 minutes; auto-logs out at 30 minutes.
         * User can dismiss the warning by clicking 'Stay Logged In'.
         */
        function startIdleWatcher() {
            ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(e =>
                document.addEventListener(e, resetIdleTimer, { passive: true }));
            resetIdleTimer();
        }


        /** Called by the idle-warning overlay button to reset the inactivity clock. */
        function resetIdleTimer() {
            window._lastActivity = Date.now();
            const overlay = document.getElementById('idle-warning-overlay');
            if (overlay) overlay.classList.remove('visible');
            clearInterval(window._idleCountdownTimer);
        }
        window.resetIdleTimer = resetIdleTimer;



        // ──────────────────────────────────────────────────────────────────────
        // 8.3 — Login & Logout
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Validate credentials against Supabase.
         * Admin: checks admin_password in school_settings.
         * Teacher/Accountant: checks teachers table (role + username + password).
         * @returns {{ success, user?, error? }}
         */
        async function login(role, username, password) {
            if (role === 'admin') {
                const settings = await getSchoolSettings();
                const adminPw = settings.admin_password || 'admin123';
                if (password !== adminPw) {
                    return { success: false, error: 'Invalid password' };
                }
                const user = { id: 0, role: 'admin', name: 'Administrator', username: 'admin' };
                await logActivity(0, 'admin', 'User logged in');
                return { success: true, user };
            } else {
                const rows = await getAll('teachers', { username, role });
                const found = rows.find(r => r.username === username && r.password === password);
                if (!found) {
                    return { success: false, error: 'Invalid username or password' };
                }
                if (found.is_active === false) {
                    return { success: false, error: 'Account is inactive' };
                }
                await update('teachers', found.id, { last_login: new Date().toISOString() });
                const user = {
                    id: found.id,
                    role: found.role,
                    name: found.name,
                    username: found.username,
                    email: found.email
                };
                await logActivity(found.id, found.role, 'User logged in');
                return { success: true, user };
            }
        }


        /**
         * Clear the session, reset state, and show the login page.
         * Logs the logout action to activity_logs.
         */
        async function logout() {
            const u = state.currentUser;
            if (u) {
                await logActivity(u.id, u.role, 'User logged out').catch(() => { });
            }
            clearSession();

            // Clear the IndexedDB state cache so a different user logging in next
            // never sees this user's cached data, and this user's next login
            // always reloads fresh data.
            await clearStateCache().catch(() => { });

            // Reset in-memory state so stale data isn't briefly visible if a
            // different user logs in before the next loadInitialData() resolves.
            for (const key of CACHEABLE_STATE_KEYS) {
                if (Array.isArray(state[key])) state[key] = [];
                else if (key === 'schoolSettings') state[key] = {};
                else state[key] = null;
            }
            invalidateCache();

            state.currentUser = null;
            isBooted = false;
            if (_sessionTimer) {
                clearInterval(_sessionTimer);
                _sessionTimer = null;
            }

            // Hide app, show login
            const appPage = document.getElementById('app-page');
            const loginPage = document.getElementById('login-page');
            if (appPage) appPage.style.display = 'none';
            if (loginPage) {
                loginPage.style.display = 'flex';
                const cardWrap = document.getElementById('card-wrap');
                if (cardWrap) cardWrap.classList.remove('open');
                const passwordInput = document.getElementById('login-password');
                if (passwordInput) passwordInput.value = '';
            }

            showToast('Logged out successfully', 'info');
        }


        /**
         * Change the password for the currently logged-in user.
         * Admin: updates admin_password in school_settings.
         * Others: updates the password field in the teachers table.
         * @returns {{ ok, error? }}
         */
        async function changePassword(currentPw, newPw) {
            const user = state.currentUser;
            if (!user) return { ok: false, error: 'Not authenticated' };

            if (user.role === 'admin') {
                const settings = await getSchoolSettings();
                if (settings.admin_password !== currentPw) {
                    return { ok: false, error: 'Current password is incorrect' };
                }
                await updateSchoolSetting('admin_password', newPw);
            } else {
                const teacher = await getById('teachers', user.id);
                if (!teacher || teacher.password !== currentPw) {
                    return { ok: false, error: 'Current password is incorrect' };
                }
                await update('teachers', user.id, { password: newPw });
            }
            await logActivity(user.id, user.role, 'Changed password');
            return { ok: true };
        }



        // ──────────────────────────────────────────────────────────────────────
        // 8.4 — Login Page UI
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Animate the login card fold open and focus the password field.
         */
        function openLoginCard() {
            // Animate the login card open (flip the fold cover)
            const wrap = document.getElementById('card-wrap');
            if (wrap) {
                wrap.classList.add('open');
                setTimeout(() => {
                    const pw = document.getElementById('login-password');
                    if (pw) pw.focus();
                }, 700);
            }
        }


        /**
         * Show/hide the username field depending on the selected role.
         */
        function onRoleChange() {
            const role     = document.getElementById('login-role').value;
            const uField   = document.getElementById('username-field');
            const subtitle = document.getElementById('login-subtitle');
            const pwInput  = document.getElementById('login-password');

            // Admin: no username, password only
            if (uField)   uField.style.display = role === 'admin' ? 'none' : 'block';

            // Update subtitle per role
            const labels = {
                admin:      'Head Teacher Portal — UWAYO GANZA Eugene',
                teacher:    'Teacher Portal',
                accountant: 'Finance Portal'
            };
            if (subtitle) subtitle.textContent = labels[role] || 'School Management System';

            // Update password placeholder
            if (pwInput) pwInput.placeholder = role === 'admin' ? 'Administrator password' : 'Password';
        }


        /**
         * Toggle password field visibility (show/hide).
         */
        function toggleLoginPw() {
            const f = document.getElementById('login-password');
            f.type = f.type === 'password' ? 'text' : 'password';
        }


        /**
         * Handle the login form submission — validates, calls login(), calls bootApp().
         */
        async function doLogin() {
            const role = document.getElementById('login-role').value;
            const username = document.getElementById('login-username')?.value.trim();
            const password = document.getElementById('login-password').value.trim();
            const alertEl = document.getElementById('login-alert');
            const btn = document.getElementById('login-btn');

            alertEl.style.display = 'none';
            if (!password) { alertEl.textContent = 'Please enter a password'; alertEl.style.display = 'block'; return; }
            if (role !== 'admin' && !username) { alertEl.textContent = 'Please enter your username'; alertEl.style.display = 'block'; return; }

            btn.innerHTML = '<span class="spinner-sm"></span> Signing in...';
            btn.disabled = true;

            try {
                const result = await login(role, username, password);
                if (!result.success) {
                    alertEl.textContent = result.error;
                    alertEl.style.display = 'block';
                    return;
                }
                state.currentUser = result.user;
                saveSession(result.user);
                await bootApp(result.user);
            } catch (err) {
                alertEl.textContent = 'Login error: ' + err.message;
                alertEl.style.display = 'block';
            } finally {
                btn.innerHTML = 'Sign In →';
                btn.disabled = false;
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 8.5 — Biometric Login (WebAuthn)
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Register a platform authenticator credential (fingerprint / Face ID).
         * Stores credential ID and user info in localStorage for next login.
         */
        async function setupBiometricLogin() {
            // Check platform authenticator availability
            if (!window.PublicKeyCredential) {
                showToast('Biometric login is not supported in this browser', 'warning');
                return;
            }
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
            if (!available) {
                showToast('No biometric hardware found on this device', 'warning');
                return;
            }

            // If already registered, offer to remove
            if (localStorage.getItem('elf_biometric_cred')) {
                const remove = confirm('Biometric login is already set up. Remove it?');
                if (remove) {
                    localStorage.removeItem('elf_biometric_cred');
                    localStorage.removeItem('elf_biometric_user');
                    showToast('Biometric login removed', 'info');
                }
                return;
            }

            const username = document.getElementById('login-username')?.value?.trim()
                || state.currentUser?.username || '';
            if (!username) {
                showToast('Enter your username first, then set up biometrics', 'warning');
                return;
            }

            try {
                const enc = new TextEncoder();
                const credential = await navigator.credentials.create({
                    publicKey: {
                        challenge: crypto.getRandomValues(new Uint8Array(32)),
                        rp: { name: state.schoolSettings?.school_name || 'Ecole La Fontaine', id: location.hostname || 'localhost' },
                        user: { id: enc.encode(username + '_elf'), name: username, displayName: username },
                        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                        authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
                        timeout: 60000
                    }
                });
                const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
                localStorage.setItem('elf_biometric_cred', credId);
                localStorage.setItem('elf_biometric_user', JSON.stringify({
                    username,
                    password: document.getElementById('login-password')?.value || ''
                }));
                const wrap = document.getElementById('biometric-btn-wrap');
                if (wrap) wrap.style.display = 'block';
                showToast('✅ Biometric login set up! Use fingerprint/face next time.', 'success');
            } catch (err) {
                if (err.name !== 'NotAllowedError') showToast('Biometric setup failed: ' + err.message, 'error');
            }
        }


        /**
         * Authenticate with a stored WebAuthn credential.
         * On success, boots the app as if the user logged in with a password.
         */
        async function doBiometricLogin() {
            // WebAuthn biometric login
            const stored = localStorage.getItem('elf_biometric_cred');
            if (!stored) { showToast('No biometric credentials stored. Please set up first.', 'warning'); return; }
            try {
                const cred = JSON.parse(stored);
                const challenge = crypto.getRandomValues(new Uint8Array(32));
                await navigator.credentials.get({
                    publicKey: {
                        challenge,
                        allowCredentials: [{
                            type: 'public-key',
                            id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
                        }],
                        userVerification: 'required', timeout: 60000
                    }
                });
                const user = { id: cred.userId, role: cred.role, name: cred.name, username: cred.username };
                state.currentUser = user;
                saveSession(user);
                await bootApp(user);
            } catch (e) { showToast('Biometric login failed: ' + e.message, 'error'); }
        }


        /**
         * Show the biometric login button on the login page if credentials are stored.
         */
        async function initBiometricSupport() {
            if (!window.PublicKeyCredential) return;
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
            if (available) {
                const btn = document.getElementById('biometric-btn');
                const hint = document.getElementById('biometric-hint');
                if (btn) btn.style.display = 'block';
                if (hint) hint.style.display = 'block';
                // Also show wrap if credential stored
                const wrap = document.getElementById('biometric-btn-wrap');
                if (wrap && localStorage.getItem('elf_biometric')) wrap.style.display = 'block';
            }
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 9 — OFFLINE SUPPORT (IndexedDB)
