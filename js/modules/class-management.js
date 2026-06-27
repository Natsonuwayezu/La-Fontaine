// SECTION 62: CLASS MANAGEMENT
        // ================================================================

        async function renderClassManagement(container) {
            await ensureStateLoaded();
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const classes = [...state.classes].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🏛️ Class Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddClassModal()">➕ Add Class</button>
                    <button class="btn btn-sm btn-warning" onclick="window.openPromoteStudentsModal()">🚀 Promote Students</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportClassesData()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Class</th>
                                <th>Code</th>
                                <th>Level</th>
                                <th>Students</th>
                                <th>Capacity</th>
                                <th>Utilization</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classes.map((c, idx) => {
                const studentCount = state.students.filter(s => s.class_id === c.id && s.status === 'Active').length;
                const capacity = c.capacity || 40;
                const utilization = capacity > 0 ? (studentCount / capacity) * 100 : 0;
                const utilizationClass = utilization >= 90 ? 'badge-danger' : (utilization >= 75 ? 'badge-warning' : 'badge-success');

                return `
                                    <tr>
                                        <td style="text-align:center">
                                            <button class="btn btn-sm btn-outline" onclick="window.moveClassUp(${c.id})" title="Move Up">▲</button>
                                            ${c.sort_order || idx + 1}
                                            <button class="btn btn-sm btn-outline" onclick="window.moveClassDown(${c.id})" title="Move Down">▼</button>
                                        </td>
                                        <td><strong>${esc(c.name)}</strong></td>
                                        <td>${esc(c.code)}</td>
                                        <td><span class="badge ${c.level === 'Nursery' ? 'badge-info' : 'badge-primary'}">${c.level || '—'}</span></td>
                                        <td style="text-align:center">${studentCount}</td>
                                        <td style="text-align:center"><input type="number" id="cap-${c.id}" value="${capacity}" style="width:70px" class="form-control" onchange="window.updateClassCapacity(${c.id})"></td>
                                        <td style="text-align:center"><span class="badge ${utilizationClass}">${utilization.toFixed(0)}%</span></td>
                                        <td style="text-align:center"><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                                        <td style="text-align:center">
                                            <div class="btn-group" style="gap:4px">
                                                <button class="btn btn-sm btn-outline" onclick="window.editClass(${c.id})">✏️</button>
                                                <button class="btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-success'}" onclick="window.toggleClassActive(${c.id}, ${c.is_active})">${c.is_active ? 'Deactivate' : 'Activate'}</button>
                                                <button class="btn btn-sm btn-outline" onclick="window.viewClassStudents(${c.id})">👥</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
            }).join('') || '<tr><td colspan="9" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No classes found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Class Statistics</span>
            </div>
            <div class="dash-card-body">
                <div id="class-stats-container" class="stats-grid">
                    <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                </div>
            </div>
        </div>
    `;

            window.openAddClassModal = openAddClassModal;
            window.editClass = editClass;
            window.updateClass = updateClass;
            window.toggleClassActive = toggleClassActive;
            window.updateClassCapacity = updateClassCapacity;
            window.moveClassUp = moveClassUp;
            window.moveClassDown = moveClassDown;
            window.openPromoteStudentsModal = openPromoteStudentsModal;
            window.exportClassesData = exportClassesData;
            window.viewClassStudents = viewClassStudents;

            await renderClassStats();
        }
        window.renderClassManagement = renderClassManagement;

        async function renderClassStats() {
            const container = document.getElementById('class-stats-container');
            if (!container) return;

            const classes = state.classes || [];
            const activeClasses = classes.filter(c => c.is_active);
            const totalStudents = state.students.filter(s => s.status === 'Active').length;
            const totalCapacity = activeClasses.reduce((sum, c) => sum + (c.capacity || 40), 0);
            const avgUtilization = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;
            const nurseryCount = activeClasses.filter(c => c.level === 'Nursery').length;
            const primaryCount = activeClasses.filter(c => c.level !== 'Nursery').length;

            container.innerHTML = `
        <div class="stat-card"><div class="stat-value">${activeClasses.length}</div><div class="stat-label">🏛️ Active Classes</div></div>
        <div class="stat-card"><div class="stat-value">${totalStudents}</div><div class="stat-label">👥 Total Students</div></div>
        <div class="stat-card"><div class="stat-value">${avgUtilization.toFixed(0)}%</div><div class="stat-label">📊 Avg. Utilization</div></div>
        <div class="stat-card"><div class="stat-value">${nurseryCount} / ${primaryCount}</div><div class="stat-label">🎒 Nursery / Primary</div></div>
    `;
        }
        window.renderClassStats = renderClassStats;

        function openAddClassModal() {
            showModal(`<div class="modal-overlay" id="add-class-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Class</h3><button class="modal-close" onclick="closeModal('add-class-modal')">✕</button></div>
        <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Class Name *</label><input id="nc-name" class="form-control" placeholder="e.g. PRIMARY 1"></div>
            <div class="form-group"><label>Level *</label><select id="nc-level" class="form-control"><option value="Primary">Primary</option><option value="Nursery">Nursery</option></select></div>
            <div class="form-group"><label>Section</label><input id="nc-section" class="form-control" placeholder="e.g. A"></div>
            <div class="form-group"><label>Capacity</label><input type="number" id="nc-cap" class="form-control" value="30" min="1"></div>
            <div class="form-group"><label>Sort Order</label><input type="number" id="nc-order" class="form-control" value="${(state.classes || []).length + 1}" min="1"></div>
        </div></div>
        <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-class-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewClass()">💾 Save</button></div></div></div>`);
            window._saveNewClass = async () => {
                const name = document.getElementById('nc-name')?.value.trim();
                if (!name) { showToast('Class name required', 'warning'); return; }
                const r = await apiRequest('classes', 'POST', {
                    name,
                    level: document.getElementById('nc-level')?.value,
                    section: document.getElementById('nc-section')?.value.trim() || null,
                    capacity: parseInt(document.getElementById('nc-cap')?.value || 30),
                    sort_order: parseInt(document.getElementById('nc-order')?.value || 1),
                    is_active: true,
                    created_at: new Date().toISOString()
                });
                if (r.success) { closeModal('add-class-modal'); await refreshTable('classes'); showToast('✅ Class added', 'success'); navigateTo('class-management'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }
        window.openAddClassModal = openAddClassModal;

        function editClass(classId) {
            const cls = state.classes.find(c => c.id === classId);
            if (!cls) { showToast('Class not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-class-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Class — ${esc(cls.name)}</h3><button class="modal-close" onclick="closeModal('edit-class-modal')">✕</button></div>
        <div class="modal-body"><div class="form-grid">
            <div class="form-group"><label>Class Name *</label><input id="ec-name" class="form-control" value="${esc(cls.name || '')}"></div>
            <div class="form-group"><label>Level</label><select id="ec-level" class="form-control"><option value="Primary"${cls.level === 'Primary' ? ' selected' : ''}>Primary</option><option value="Nursery"${cls.level === 'Nursery' ? ' selected' : ''}>Nursery</option></select></div>
            <div class="form-group"><label>Section</label><input id="ec-section" class="form-control" value="${esc(cls.section || '')}"></div>
            <div class="form-group"><label>Capacity</label><input type="number" id="ec-cap" class="form-control" value="${cls.capacity || 30}"></div>
            <div class="form-group"><label>Sort Order</label><input type="number" id="ec-order" class="form-control" value="${cls.sort_order || 1}"></div>
            <div class="form-group"><label>Status</label><select id="ec-active" class="form-control"><option value="true"${cls.is_active !== false ? ' selected' : ''}>Active</option><option value="false"${cls.is_active === false ? ' selected' : ''}>Inactive</option></select></div>
        </div></div>
        <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-class-modal')">Cancel</button><button class="btn btn-primary" onclick="window.updateClass(${classId})">💾 Save</button></div></div></div>`);
        }
        window.editClass = editClass;

        async function updateClass(classId) {
            const name = document.getElementById('ec-name')?.value.trim();
            if (!name) { showToast('Class name required', 'warning'); return; }
            const payload = {
                name,
                level: document.getElementById('ec-level')?.value,
                section: document.getElementById('ec-section')?.value.trim() || null,
                capacity: parseInt(document.getElementById('ec-cap')?.value || 30),
                sort_order: parseInt(document.getElementById('ec-order')?.value || 1),
                is_active: document.getElementById('ec-active')?.value === 'true',
                updated_at: new Date().toISOString()
            };
            const r = await apiRequest('classes?id=eq.' + classId, 'PATCH', payload);
            if (r.success) {
                const idx = state.classes.findIndex(c => c.id === classId);
                if (idx !== -1) state.classes[idx] = { ...state.classes[idx], ...payload };
                closeModal('edit-class-modal');
                showToast('✅ Class updated', 'success');
                navigateTo('class-management');
            } else showToast('Failed: ' + r.error, 'error');
        }
        window.updateClass = updateClass;

        async function toggleClassActive(classId, isActive) {
            await update('classes', classId, { is_active: !isActive });
            await refreshTable('classes');
            renderClassManagement(document.getElementById('dynamic-content'));
        }
        window.toggleClassActive = toggleClassActive;

        async function updateClassCapacity(classId) {
            const cap = parseInt(document.getElementById(`cap-${classId}`)?.value);
            await update('classes', classId, { capacity: cap });
            showToast('✅ Capacity updated', 'success');
        }
        window.updateClassCapacity = updateClassCapacity;

        async function moveClassUp(classId) {
            const idx = state.classes.findIndex(c => c.id === classId);
            if (idx <= 0) return;
            const cls = state.classes[idx];
            const prev = state.classes[idx - 1];
            const t = cls.sort_order;
            await apiRequest('classes?id=eq.' + cls.id, 'PATCH', { sort_order: prev.sort_order });
            await apiRequest('classes?id=eq.' + prev.id, 'PATCH', { sort_order: t });
            cls.sort_order = prev.sort_order;
            prev.sort_order = t;
            state.classes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            showToast('✅ Class moved up', 'success');
            navigateTo('class-management');
        }
        window.moveClassUp = moveClassUp;

        async function moveClassDown(classId) {
            const idx = state.classes.findIndex(c => c.id === classId);
            if (idx < 0 || idx >= state.classes.length - 1) return;
            const cls = state.classes[idx];
            const next = state.classes[idx + 1];
            const t = cls.sort_order;
            await apiRequest('classes?id=eq.' + cls.id, 'PATCH', { sort_order: next.sort_order });
            await apiRequest('classes?id=eq.' + next.id, 'PATCH', { sort_order: t });
            cls.sort_order = next.sort_order;
            next.sort_order = t;
            state.classes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            showToast('✅ Class moved down', 'success');
            navigateTo('class-management');
        }
        window.moveClassDown = moveClassDown;

        function exportClassesData() {
            const data = state.classes.map(c => ({
                'Class': c.name,
                'Code': c.code,
                'Level': c.level,
                'Capacity': c.capacity || 40,
                'Students': state.students.filter(s => s.class_id === c.id && s.status === 'Active').length,
                'Utilization %': c.capacity ? ((state.students.filter(s => s.class_id === c.id && s.status === 'Active').length / c.capacity) * 100).toFixed(1) : 0,
                'Status': c.is_active ? 'Active' : 'Inactive',
                'Sort Order': c.sort_order || 0
            }));
            exportToExcel(data, 'Classes_Export');
            showToast('✅ Classes exported', 'success');
        }
        window.exportClassesData = exportClassesData;

        function viewClassStudents(classId) {
            const cls = getClassById(classId);
            const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
            if (!students.length) { showToast(`No active students in ${cls?.name}`, 'info'); return; }
            showModal(`<div class="modal-overlay"><div class="modal modal-lg"><div class="modal-header"><h3>👥 Students in ${esc(cls?.name)} (${students.length})</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Code</th><th>Name</th><th>Gender</th><th>Guardian</th><th>Status</th></tr></thead><tbody>${students.map(s => `<tr><td><code>${esc(s.student_code || '—')}</code></td><td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td><td>${esc(s.gender || '—')}</td><td>${esc(s.guardian_name || '—')}</td><td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span></td></tr>`).join('')}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="closeModal(); window.navigateToWithData('student-list', { class_id: ${classId} })">📋 View All</button></div></div></div>`);
        }
        window.viewClassStudents = viewClassStudents;

        // ================================================================
