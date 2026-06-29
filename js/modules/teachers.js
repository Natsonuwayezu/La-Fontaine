// js/modules/teachers.js
// Teachers Module - Complete teacher management system


async function renderTeachers(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isAdmin = user?.role === 'admin';
    const isTeacher = user?.role === 'teacher';

    // Teachers can only see their own profile, not the full list
    if (isTeacher) {
        const teacher = state.teachers.find(t => t.id === user.id);
        if (!teacher) {
            container.innerHTML = '<div class="alert alert-danger">Teacher not found</div>';
            return;
        }
        await renderTeacherProfile(container, teacher);
        return;
    }

    const teachers = state.teachers.filter(t => t.role === 'teacher');
    const accountants = state.teachers.filter(t => t.role === 'accountant');
    const admins = state.teachers.filter(t => t.role === 'admin');

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👥 Staff Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddTeacherModal()">➕ Add Staff</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportTeachers()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px">
                    <button class="tab-btn active" onclick="window.showTeacherTab('teachers', event)">👩‍🏫 Teachers (${teachers.length})</button>
                    <button class="tab-btn" onclick="window.showTeacherTab('accountants', event)">💰 Accountants (${accountants.length})</button>
                    <button class="tab-btn" onclick="window.showTeacherTab('admins', event)">👨‍💼 Admins (${admins.length})</button>
                </div>
                
                <div id="teachers-list-tab">
                    ${renderTeacherTable(teachers, 'teacher')}
                </div>
                <div id="accountants-list-tab" style="display:none">
                    ${renderTeacherTable(accountants, 'accountant')}
                </div>
                <div id="admins-list-tab" style="display:none">
                    ${renderTeacherTable(admins, 'admin')}
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Staff Statistics</span>
            </div>
            <div class="dash-card-body">
                <div id="teacher-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="stat-card">
                        <div class="stat-value">${teachers.length}</div>
                        <div class="stat-label">Teachers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${accountants.length}</div>
                        <div class="stat-label">Accountants</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${admins.length}</div>
                        <div class="stat-label">Admins</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teachers.filter(t => !t.is_active).length}</div>
                        <div class="stat-label">Inactive</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.showTeacherTab = showTeacherTab;
    window.openAddTeacherModal = openAddTeacherModal;
    window.exportTeachers = exportTeachers;
    window.editTeacher = editTeacher;
    window.deleteTeacher = deleteTeacher;
    window.toggleTeacherStatus = toggleTeacherStatus;
    window.resetTeacherPassword = resetTeacherPassword;
    window.viewTeacherDetails = viewTeacherDetails;
}

function renderTeacherTable(teachers, role) {
    if (teachers.length === 0) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">No staff members found</div>';
    }

    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Avatar</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Username</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${teachers.map(t => `
                        <tr>
                            <td><div class="user-avatar" style="width:32px;height:32px;background:var(--role-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">
                                ${role === 'admin' ? '👨‍💼' : (role === 'accountant' ? '💰' : '👩‍🏫')}
                            </div></span>
                            <td><strong>${esc(t.name)}</strong></span>
                            <td>${esc(t.email || '—')}</span>
                            <td><code>${esc(t.username)}</code></span>
                            <td>${esc(t.department || 'General')}</span>
                            <td><span class="badge ${t.is_active ? 'badge-success' : 'badge-danger'}">${t.is_active ? 'Active' : 'Inactive'}</span></span>
                            <td>${t.last_login ? fmtDate(t.last_login) : 'Never'}</span>
                            <td>
                                <div class="btn-group" style="gap:4px">
                                    <button class="btn btn-sm btn-outline" onclick="window.viewTeacherDetails(${t.id})">👁️</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.editTeacher(${t.id})">✏️</button>
                                    <button class="btn btn-sm btn-warning" onclick="window.resetTeacherPassword(${t.id})">🔒</button>
                                    <button class="btn btn-sm ${t.is_active ? 'btn-danger' : 'btn-success'}" onclick="window.toggleTeacherStatus(${t.id}, ${t.is_active})">${t.is_active ? 'Deactivate' : 'Activate'}</button>
                                    <button class="btn btn-sm btn-danger" onclick="window.deleteTeacher(${t.id}, '${esc(t.name)}')">🗑️</button>
                                </div>
                            </span>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showTeacherTab(tabName, event) {
    const tabs = ['teachers', 'accountants', 'admins'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-list-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

function openAddTeacherModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Add Staff Member</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Full Name *</label><input type="text" id="new-teacher-name" class="form-control"></div>
                        <div class="form-group"><label>Email *</label><input type="email" id="new-teacher-email" class="form-control"></div>
                        <div class="form-group"><label>Username *</label><input type="text" id="new-teacher-username" class="form-control"></div>
                        <div class="form-group"><label>Password *</label><input type="password" id="new-teacher-password" class="form-control"></div>
                        <div class="form-group"><label>Role *</label><select id="new-teacher-role" class="form-control"><option value="teacher">Teacher</option><option value="accountant">Accountant</option><option value="admin">Admin</option></select></div>
                        <div class="form-group"><label>Phone</label><input type="text" id="new-teacher-phone" class="form-control"></div>
                        <div class="form-group"><label>Department</label><input type="text" id="new-teacher-dept" class="form-control" placeholder="e.g., Mathematics, Science"></div>
                        <div class="form-group full"><label>Qualification</label><input type="text" id="new-teacher-qualification" class="form-control" placeholder="e.g., B.Ed, MSc"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createTeacher()">Create</button>
                </div>
            </div>
        </div>
    `);

    window.createTeacher = createTeacher;
}

async function createTeacher() {
    const name = document.getElementById('new-teacher-name')?.value.trim();
    const email = document.getElementById('new-teacher-email')?.value.trim();
    const username = document.getElementById('new-teacher-username')?.value.trim();
    const password = document.getElementById('new-teacher-password')?.value;
    const role = document.getElementById('new-teacher-role')?.value;
    const phone = document.getElementById('new-teacher-phone')?.value;
    const department = document.getElementById('new-teacher-dept')?.value;
    const qualification = document.getElementById('new-teacher-qualification')?.value;

    if (!name || !email || !username || !password) {
        showToast('Name, email, username, and password are required', 'warning');
        return;
    }

    // Check if username exists
    const existing = state.teachers.find(t => t.username === username);
    if (existing) {
        showToast('Username already exists', 'warning');
        return;
    }

    await insert('teachers', {
        name, email, username, password, role,
        phone: phone || null, department: department || null,
        qualification: qualification || null,
        is_active: true, created_at: new Date().toISOString()
    });

    await refreshTable('teachers');
    closeModal();
    showToast('✅ Staff member created successfully', 'success');
    renderTeachers(document.getElementById('dynamic-content'));
}

async function editTeacher(teacherId) {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Edit Staff - ${esc(teacher.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full"><label>Full Name</label><input type="text" id="edit-teacher-name" value="${esc(teacher.name)}" class="form-control"></div>
                        <div class="form-group"><label>Email</label><input type="email" id="edit-teacher-email" value="${esc(teacher.email)}" class="form-control"></div>
                        <div class="form-group"><label>Username</label><input type="text" id="edit-teacher-username" value="${esc(teacher.username)}" class="form-control"></div>
                        <div class="form-group"><label>Role</label><select id="edit-teacher-role" class="form-control"><option value="teacher" ${teacher.role === 'teacher' ? 'selected' : ''}>Teacher</option><option value="accountant" ${teacher.role === 'accountant' ? 'selected' : ''}>Accountant</option><option value="admin" ${teacher.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
                        <div class="form-group"><label>Phone</label><input type="text" id="edit-teacher-phone" value="${esc(teacher.phone || '')}" class="form-control"></div>
                        <div class="form-group"><label>Department</label><input type="text" id="edit-teacher-dept" value="${esc(teacher.department || '')}" class="form-control"></div>
                        <div class="form-group"><label>Qualification</label><input type="text" id="edit-teacher-qualification" value="${esc(teacher.qualification || '')}" class="form-control"></div>
                        <div class="form-group full"><label>New Password (optional)</label><input type="password" id="edit-teacher-password" class="form-control" placeholder="Leave blank to keep current"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateTeacher(${teacherId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);

    window.updateTeacher = async (teacherId) => {
        const data = {
            name: document.getElementById('edit-teacher-name')?.value,
            email: document.getElementById('edit-teacher-email')?.value,
            username: document.getElementById('edit-teacher-username')?.value,
            role: document.getElementById('edit-teacher-role')?.value,
            phone: document.getElementById('edit-teacher-phone')?.value || null,
            department: document.getElementById('edit-teacher-dept')?.value || null,
            qualification: document.getElementById('edit-teacher-qualification')?.value || null,
            updated_at: new Date().toISOString()
        };

        const newPassword = document.getElementById('edit-teacher-password')?.value;
        if (newPassword && newPassword.length >= 4) {
            data.password = newPassword;
        }

        await update('teachers', teacherId, data);
        await refreshTable('teachers');
        closeModal();
        showToast('✅ Staff member updated', 'success');
        renderTeachers(document.getElementById('dynamic-content'));
    };
}

async function deleteTeacher(teacherId, teacherName) {
    if (teacherId === state.currentUser?.id) {
        showToast('You cannot delete your own account', 'error');
        return;
    }

    if (!await confirmDialog(`Delete staff member "${teacherName}"? This action cannot be undone.`)) return;

    await remove('teachers', teacherId);
    await refreshTable('teachers');
    showToast(`✅ "${teacherName}" deleted`, 'success');
    renderTeachers(document.getElementById('dynamic-content'));
}

async function toggleTeacherStatus(teacherId, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    if (teacherId === state.currentUser?.id && action === 'deactivate') {
        showToast('You cannot deactivate your own account', 'error');
        return;
    }

    if (!await confirmDialog(`${action.charAt(0).toUpperCase() + action.slice(1)} this staff member?`)) return;

    await update('teachers', teacherId, { is_active: !isActive });
    await refreshTable('teachers');
    showToast(`✅ Staff member ${action}d`, 'success');
    renderTeachers(document.getElementById('dynamic-content'));
}

async function resetTeacherPassword(teacherId) {
    const newPassword = prompt('Enter new password (minimum 4 characters):');
    if (!newPassword || newPassword.length < 4) {
        showToast('Password must be at least 4 characters', 'warning');
        return;
    }

    await update('teachers', teacherId, { password: newPassword });
    showToast('✅ Password reset successfully', 'success');
}

async function viewTeacherDetails(teacherId) {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    // Get assignments for this teacher
    let assignments = [];
    try {
        assignments = await getAll('teacher_assignments', { teacher_id: teacherId });
    } catch (e) { }

    const classNames = [...new Set(assignments.map(a => getClassById(a.class_id)?.name).filter(Boolean))];
    const subjectNames = [...new Set(assignments.map(a => getSubjectById(a.subject_id)?.name).filter(Boolean))];

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>👩‍🏫 Staff Details - ${esc(teacher.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Name</label><input readonly value="${esc(teacher.name)}" class="form-control"></div>
                        <div class="form-group"><label>Email</label><input readonly value="${esc(teacher.email || '—')}" class="form-control"></div>
                        <div class="form-group"><label>Username</label><input readonly value="${esc(teacher.username)}" class="form-control"></div>
                        <div class="form-group"><label>Role</label><input readonly value="${teacher.role}" class="form-control"></div>
                        <div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone || '—')}" class="form-control"></div>
                        <div class="form-group"><label>Department</label><input readonly value="${esc(teacher.department || '—')}" class="form-control"></div>
                        <div class="form-group"><label>Qualification</label><input readonly value="${esc(teacher.qualification || '—')}" class="form-control"></div>
                        <div class="form-group"><label>Status</label><input readonly value="${teacher.is_active ? 'Active' : 'Inactive'}" class="form-control"></div>
                        <div class="form-group"><label>Last Login</label><input readonly value="${teacher.last_login ? fmtDate(teacher.last_login) : 'Never'}" class="form-control"></div>
                    </div>
                    
                    <h4 style="margin-top:16px">📋 Assigned Classes</h4>
                    <div class="form-group">
                        <textarea readonly class="form-control" rows="3">${classNames.join(', ') || 'No assignments'}</textarea>
                    </div>
                    
                    <h4>📖 Assigned Subjects</h4>
                    <div class="form-group">
                        <textarea readonly class="form-control" rows="3">${subjectNames.join(', ') || 'No assignments'}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal(); window.editTeacher(${teacherId})">✏️ Edit</button>
                </div>
            </div>
        </div>
    `);
}

async function exportTeachers() {
    const teachers = state.teachers || [];
    const data = teachers.map(t => ({
        'Name': t.name,
        'Email': t.email || '',
        'Username': t.username,
        'Role': t.role,
        'Status': t.is_active ? 'Active' : 'Inactive',
        'Phone': t.phone || '',
        'Department': t.department || '',
        'Qualification': t.qualification || '',
        'Last Login': t.last_login ? fmtDate(t.last_login) : 'Never',
        'Created': fmtDate(t.created_at)
    }));

    exportToExcel(data, `Staff_Export_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Staff list exported', 'success');
}

async function renderTeacherProfile(container, teacher) {
    // Get assignments for this teacher
    let assignments = [];
    try {
        assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
    } catch (e) { }

    const classNames = [...new Set(assignments.map(a => getClassById(a.class_id)?.name).filter(Boolean))];
    const subjectNames = [...new Set(assignments.map(a => getSubjectById(a.subject_id)?.name).filter(Boolean))];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👩‍🏫 My Profile</span>
                <button class="btn btn-sm btn-primary" onclick="window.editTeacherProfile()">✏️ Edit</button>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group"><label>Full Name</label><input readonly value="${esc(teacher.name)}" class="form-control"></div>
                    <div class="form-group"><label>Email</label><input readonly value="${esc(teacher.email || '—')}" class="form-control"></div>
                    <div class="form-group"><label>Username</label><input readonly value="${esc(teacher.username)}" class="form-control"></div>
                    <div class="form-group"><label>Role</label><input readonly value="${teacher.role}" class="form-control"></div>
                    <div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone || '—')}" class="form-control"></div>
                    <div class="form-group"><label>Department</label><input readonly value="${esc(teacher.department || '—')}" class="form-control"></div>
                    <div class="form-group"><label>Qualification</label><input readonly value="${esc(teacher.qualification || '—')}" class="form-control"></div>
                </div>
                
                <h4 style="margin-top:20px">📋 My Assigned Classes</h4>
                <div class="form-group">
                    <textarea readonly class="form-control" rows="3">${classNames.join(', ') || 'No assignments'}</textarea>
                </div>
                
                <h4>📖 My Subjects</h4>
                <div class="form-group">
                    <textarea readonly class="form-control" rows="3">${subjectNames.join(', ') || 'No subjects'}</textarea>
                </div>
                
                <div class="btn-group" style="margin-top:20px">
                    <button class="btn btn-outline" onclick="window.showChangePasswordModal()">🔒 Change Password</button>
                    <button class="btn btn-outline" onclick="window.setupBiometricLogin()">🔑 Setup Biometric Login</button>
                </div>
            </div>
        </div>
    `;

    window.editTeacherProfile = () => editTeacher(teacher.id);
}