// js/modules/user-management.js
// User Management Module - Manage system users and permissions


async function renderUserManagement(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const users = state.teachers || [];
    const roles = ['teacher', 'accountant', 'admin'];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👥 User Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddUserModal()">➕ Create User</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportUsers()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="user-role-filter" class="form-control" style="width:150px" onchange="window.filterUsers()">
                        <option value="">All Roles</option>
                        ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
                    <select id="user-status-filter" class="form-control" style="width:130px" onchange="window.filterUsers()">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <input type="text" id="user-search" class="form-control flex-1" placeholder="🔍 Search users..." oninput="window.filterUsers()">
                    <span class="result-count" id="user-count"></span>
                </div>
                
                <div class="table-wrapper" id="users-table-container">
                    <div class="loading-container"><div class="spinner"></div><p>Loading users...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 User Statistics</span>
            </div>
            <div class="dash-card-body">
                <div id="user-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">🔐 User Activity Log</span>
                <button class="btn btn-sm btn-outline" onclick="window.refreshActivityLog()">🔄 Refresh</button>
            </div>
            <div class="dash-card-body">
                <div id="user-activity-log" class="table-wrapper" style="max-height:300px; overflow-y:auto">
                    <div class="loading-container"><div class="spinner"></div><p>Loading activity...</p></div>
                </div>
            </div>
        </div>
    `;

    window.openAddUserModal = openAddUserModal;
    window.exportUsers = exportUsers;
    window.filterUsers = filterUsers;
    window.editUser = editUser;
    window.toggleUserStatus = toggleUserStatus;
    window.resetUserPassword = resetUserPassword;
    window.deleteUser = deleteUser;
    window.refreshActivityLog = refreshActivityLog;

    window._allUsers = users;
    await filterUsers();
    await renderUserStats();
    await renderActivityLog();
}

function filterUsers() {
    const roleFilter = document.getElementById('user-role-filter')?.value;
    const statusFilter = document.getElementById('user-status-filter')?.value;
    const search = document.getElementById('user-search')?.value.toLowerCase();
    const container = document.getElementById('users-table-container');

    let filtered = window._allUsers || [];

    if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter === 'active') filtered = filtered.filter(u => u.is_active === true);
    if (statusFilter === 'inactive') filtered = filtered.filter(u => u.is_active === false);
    if (search) filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search)
    );

    const countSpan = document.getElementById('user-count');
    if (countSpan) countSpan.textContent = `${filtered.length} user${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No users found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Avatar</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(u => `
                    <tr>
                        <td><div class="user-avatar" style="width:32px;height:32px;background:var(--role-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">
                            ${u.role === 'admin' ? '👨‍💼' : (u.role === 'accountant' ? '💰' : '👩‍🏫')}
                        </div></span>
                        <td><strong>${esc(u.name)}</strong></span>
                        <td>${esc(u.email || '—')}</span>
                        <td><code>${esc(u.username)}</code></span>
                        <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : (u.role === 'accountant' ? 'badge-warning' : 'badge-info')}">${u.role}</span></span>
                        <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></span>
                        <td>${u.last_login ? fmtDate(u.last_login) : 'Never'}</span>
                        <td>
                            <div class="btn-group" style="gap:4px">
                                <button class="btn btn-sm btn-outline" onclick="window.editUser(${u.id})">✏️</button>
                                <button class="btn btn-sm btn-warning" onclick="window.resetUserPassword(${u.id})">🔒</button>
                                <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="window.toggleUserStatus(${u.id}, ${u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteUser(${u.id}, '${esc(u.name)}')">🗑️</button>
                            </div>
                        </span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderUserStats() {
    const container = document.getElementById('user-stats');
    if (!container) return;

    const users = window._allUsers || [];
    const activeUsers = users.filter(u => u.is_active).length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const accountantCount = users.filter(u => u.role === 'accountant').length;
    const teacherCount = users.filter(u => u.role === 'teacher').length;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${users.length}</div>
            <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${activeUsers}</div>
            <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">👨‍💼</div>
            <div class="stat-value">${adminCount}</div>
            <div class="stat-label">Admins</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">👩‍🏫</div>
            <div class="stat-value">${teacherCount}</div>
            <div class="stat-label">Teachers</div>
        </div>
    `;
}

function openAddUserModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Create New User</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Full Name *</label><input type="text" id="new-user-name" class="form-control"></div>
                        <div class="form-group"><label>Email *</label><input type="email" id="new-user-email" class="form-control"></div>
                        <div class="form-group"><label>Username *</label><input type="text" id="new-user-username" class="form-control"></div>
                        <div class="form-group"><label>Password *</label><input type="password" id="new-user-password" class="form-control"></div>
                        <div class="form-group"><label>Role *</label><select id="new-user-role" class="form-control"><option value="teacher">Teacher</option><option value="accountant">Accountant</option><option value="admin">Admin</option></select></div>
                        <div class="form-group"><label>Phone</label><input type="text" id="new-user-phone" class="form-control"></div>
                        <div class="form-group full"><label>Department</label><input type="text" id="new-user-dept" class="form-control"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createUser()">Create User</button>
                </div>
            </div>
        </div>
    `);

    window.createUser = createUser;
}

async function createUser() {
    const name = document.getElementById('new-user-name')?.value.trim();
    const email = document.getElementById('new-user-email')?.value.trim();
    const username = document.getElementById('new-user-username')?.value.trim();
    const password = document.getElementById('new-user-password')?.value;
    const role = document.getElementById('new-user-role')?.value;
    const phone = document.getElementById('new-user-phone')?.value;
    const department = document.getElementById('new-user-dept')?.value;

    if (!name || !email || !username || !password) {
        showToast('Name, email, username, and password are required', 'warning');
        return;
    }

    // Check if username exists
    if (window._allUsers.some(u => u.username === username)) {
        showToast('Username already exists', 'warning');
        return;
    }

    await insert('teachers', {
        name, email, username, password, role,
        phone: phone || null, department: department || null,
        is_active: true, created_at: new Date().toISOString()
    });

    await refreshTable('teachers');
    closeModal();
    showToast('✅ User created successfully', 'success');
    renderUserManagement(document.getElementById('dynamic-content'));
}

async function editUser(userId) {
    const user = window._allUsers.find(u => u.id === userId);
    if (!user) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Edit User - ${esc(user.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Full Name</label><input type="text" id="edit-user-name" value="${esc(user.name)}" class="form-control"></div>
                        <div class="form-group"><label>Email</label><input type="email" id="edit-user-email" value="${esc(user.email)}" class="form-control"></div>
                        <div class="form-group"><label>Username</label><input type="text" id="edit-user-username" value="${esc(user.username)}" class="form-control"></div>
                        <div class="form-group"><label>Role</label><select id="edit-user-role" class="form-control"><option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Teacher</option><option value="accountant" ${user.role === 'accountant' ? 'selected' : ''}>Accountant</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
                        <div class="form-group"><label>Phone</label><input type="text" id="edit-user-phone" value="${esc(user.phone || '')}" class="form-control"></div>
                        <div class="form-group full"><label>Department</label><input type="text" id="edit-user-dept" value="${esc(user.department || '')}" class="form-control"></div>
                        <div class="form-group full"><label>New Password (optional)</label><input type="password" id="edit-user-password" class="form-control" placeholder="Leave blank to keep current"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateUser(${userId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);

    window.updateUser = async (userId) => {
        const data = {
            name: document.getElementById('edit-user-name')?.value,
            email: document.getElementById('edit-user-email')?.value,
            username: document.getElementById('edit-user-username')?.value,
            role: document.getElementById('edit-user-role')?.value,
            phone: document.getElementById('edit-user-phone')?.value || null,
            department: document.getElementById('edit-user-dept')?.value || null,
            updated_at: new Date().toISOString()
        };

        const newPassword = document.getElementById('edit-user-password')?.value;
        if (newPassword && newPassword.length >= 4) {
            data.password = newPassword;
        }

        await update('teachers', userId, data);
        await refreshTable('teachers');
        closeModal();
        showToast('✅ User updated', 'success');
        renderUserManagement(document.getElementById('dynamic-content'));
    };
}

async function toggleUserStatus(userId, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    if (!await confirmDialog(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;

    await update('teachers', userId, { is_active: !isActive });
    await refreshTable('teachers');
    showToast(`✅ User ${action}d`, 'success');
    renderUserManagement(document.getElementById('dynamic-content'));
}

async function resetUserPassword(userId) {
    const newPassword = prompt('Enter new password (minimum 4 characters):');
    if (!newPassword || newPassword.length < 4) {
        showToast('Password must be at least 4 characters', 'warning');
        return;
    }

    await update('teachers', userId, { password: newPassword });
    showToast('✅ Password reset successfully', 'success');
}

async function deleteUser(userId, userName) {
    if (userId === state.currentUser?.id) {
        showToast('You cannot delete your own account', 'error');
        return;
    }

    if (!await confirmDialog(`Delete user "${userName}"? This action cannot be undone.`)) return;

    await remove('teachers', userId);
    await refreshTable('teachers');
    showToast(`✅ User "${userName}" deleted`, 'success');
    renderUserManagement(document.getElementById('dynamic-content'));
}

function exportUsers() {
    const data = (window._allUsers || []).map(u => ({
        'Name': u.name,
        'Email': u.email || '',
        'Username': u.username,
        'Role': u.role,
        'Status': u.is_active ? 'Active' : 'Inactive',
        'Phone': u.phone || '',
        'Department': u.department || '',
        'Last Login': u.last_login ? fmtDate(u.last_login) : 'Never'
    }));

    exportToExcel(data, `Users_Export_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Users exported', 'success');
}

async function refreshActivityLog() {
    await renderActivityLog();
}

async function renderActivityLog() {
    const container = document.getElementById('user-activity-log');
    if (!container) return;

    const logs = state.activityLogs?.slice(0, 50) || [];

    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No activity logs found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Date & Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${fmtDateTime(log.created_at)}</span>
                        <td>${esc(log.user_role || 'System')}</span>
                        <td><span class="badge ${log.user_role === 'admin' ? 'badge-danger' : log.user_role === 'accountant' ? 'badge-warning' : 'badge-info'}">${log.user_role || 'System'}</span></span>
                        <td>${esc(log.action)}</span>
                        <td>${log.details ? (typeof log.details === 'string' ? esc(log.details.substring(0, 50)) : esc(JSON.stringify(log.details).substring(0, 50))) : '—'}</span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}