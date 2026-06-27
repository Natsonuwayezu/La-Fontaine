// ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 11.1 — Toast Notifications
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Show a toast notification in the bottom-right corner.
         * @param {string} msg       - Message text
         * @param {string} type      - 'success' | 'error' | 'warning' | 'info'
         * @param {number} duration  - Auto-dismiss time in ms (default 3500)
         */
        function showToast(message, type = 'info', duration = 3500) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
                    <span class="toast-message">${esc(message)}</span>
                `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 11.2 — Modal System
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Render an HTML string as a modal overlay in #modals-container.
         * The overlay backdrop closes the modal on click.
         */
        function showModal(html) {
            const container = document.getElementById('modals-container');
            if (container) container.innerHTML = html;
        }


        /**
         * Close a specific modal by overlay ID, or close the topmost overlay.
         */
        function closeModal(modalId = null) {
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) modal.remove();
            } else {
                const container = document.getElementById('modals-container');
                if (container) container.innerHTML = '';
            }
        }


        /**
         * Show a confirm dialog and return a Promise<boolean>.
         * Usage: if (await confirmDialog('Delete this record?')) { ... }
         */
        function confirmDialog(message, title = 'Confirm') {
            return new Promise((resolve) => {
                const modalId = `confirm-modal-${Date.now()}`;
                const html = `
                    <div class="modal-overlay" id="${modalId}">
                        <div class="modal modal-sm">
                            <div class="modal-header">
                                <h3>⚠️ ${escapeHtml(title)}</h3>
                                <button class="modal-close" onclick="window.closeModal('${modalId}')">✕</button>
                            </div>
                            <div class="modal-body">
                                <p>${escapeHtml(message)}</p>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-outline" onclick="window.closeModal('${modalId}'); window._confirmResolve(false)">Cancel</button>
                                <button class="btn btn-danger" onclick="window.closeModal('${modalId}'); window._confirmResolve(true)">Confirm</button>
                            </div>
                        </div>
                    </div>
                `;

                showModal(html);
                window._confirmResolve = resolve;
            });
        }



        // ──────────────────────────────────────────────────────────────────────
        // 11.3 — Profile & Password Modals
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Show the current user's profile information modal.
         * Includes a link to change password and set up biometrics.
         */
        function showProfileModal() {
            const user = getCurrentUser();
            if (!user) return;
            const teacher = user.role !== 'admin'
                ? (state.teachers || []).find(t => t.id == user.id)
                : null;

            showModal(`
                <div class="modal-overlay">
                    <div class="modal modal-sm">
                        <div class="modal-header">
                            <h3>👤 My Profile</h3>
                            <button class="modal-close" onclick="window.closeModal()">✕</button>
                        </div>
                        <div class="modal-body">
                            <div style="text-align:center;margin-bottom:16px;font-size:4rem">
                                ${{ admin: '👨‍💼', accountant: '💰', teacher: '👩‍🏫' }[user.role] || '👤'}
                            </div>
                            <div class="form-grid">
                                <div class="form-group"><label>Full Name</label><input readonly value="${esc(user.name)}"></div>
                                <div class="form-group"><label>Username</label><input readonly value="${esc(user.username || '')}"></div>
                                <div class="form-group"><label>Role</label><input readonly value="${esc(user.role)}"></div>
                                <div class="form-group"><label>Email</label><input readonly value="${esc(teacher?.email || user.email || '—')}"></div>
                                ${teacher?.phone ? `<div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone)}"></div>` : ''}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline" onclick="window.closeModal()">Close</button>
                            <button class="btn btn-primary" onclick="window.closeModal();window.showChangePasswordModal&&window.showChangePasswordModal()">Change Password</button>
                        </div>
                    </div>
                </div>
            `);
            toggleUserDropdown();
        }


        /**
         * Show the change-password form modal.
         */
        function showChangePasswordModal() {
            showModal(`
                        <div class="modal-overlay"><div class="modal modal-sm">
                            <div class="modal-header"><h3>🔒 Change Password</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
                            <div class="modal-body">
                                <div class="alert alert-danger" id="pw-error" style="display:none"></div>
                                <div class="form-group"><label>Current Password</label><div class="pw-field"><input type="password" id="pw-current" placeholder="Current password"><button class="toggle-pw" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁️</button></div></div>
                                <div class="form-group"><label>New Password</label><div class="pw-field"><input type="password" id="pw-new" placeholder="New password (min 4 chars)"><button class="toggle-pw" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁️</button></div></div>
                                <div class="form-group"><label>Confirm New Password</label><div class="pw-field"><input type="password" id="pw-confirm" placeholder="Repeat new password"><button class="toggle-pw" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁️</button></div></div>
                            </div>
                            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="submitChangePassword()">Update Password</button></div>
                        </div></div>`);
        }


        /**
         * Validate and submit the change-password form.
         * Logs out the user after a successful change for security.
         */
        async function submitChangePassword() {
            const cur = document.getElementById('pw-current')?.value;
            const nw = document.getElementById('pw-new')?.value;
            const conf = document.getElementById('pw-confirm')?.value;
            const err = document.getElementById('pw-error');
            const showErr = msg => { err.textContent = msg; err.style.display = 'block'; };
            if (!cur || !nw || !conf) return showErr('All fields are required');
            if (nw !== conf) return showErr('New passwords do not match');
            if (nw.length < 4) return showErr('Password must be at least 4 characters');
            if (nw === cur) return showErr('New password must differ from current');
            const result = await changePassword(cur, nw);
            if (!result.ok) return showErr(result.error);
            showToast('Password updated! Logging out...', 'success');
            closeModal();
            setTimeout(logout, 1500);
        }


        /**
         * Navigate to the notification center module.
         */
        function showNotificationsModal() {
            // Navigate to the notification center module
            navigateTo('notification-center');
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 12 — MODULE ROUTER
