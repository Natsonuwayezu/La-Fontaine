// js/modules/class-management.js
// Class Management Module - Manage classes, sections, capacities, and promotion

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtCurrency, fmtDate, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getClassById } from '../core/state.js';;

const PROMOTION_RULES = [
    { from: 'NURSERY 1', to: 'NURSERY 2' },
    { from: 'NURSERY 2', to: 'NURSERY 3' },
    { from: 'NURSERY 3', to: 'PRIMARY 1' },
    { from: 'PRIMARY 1', to: 'PRIMARY 2' },
    { from: 'PRIMARY 2', to: 'PRIMARY 3' },
    { from: 'PRIMARY 3', to: 'PRIMARY 4' },
    { from: 'PRIMARY 4', to: 'PRIMARY 5' },
    { from: 'PRIMARY 5', to: 'PRIMARY 6' },
    { from: 'PRIMARY 6', to: 'GRADUATED' }
];

export async function renderClassManagement(container) {
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
                                         </span>
                                        <td><strong>${esc(c.name)}</strong></td>
                                        <td>${esc(c.code)}</span>
                                        <td><span class="badge ${c.level === 'Nursery' ? 'badge-info' : 'badge-primary'}">${c.level || '—'}</span></td>
                                        <td style="text-align:center">${studentCount}</span>
                                        <td style="text-align:center"><input type="number" id="cap-${c.id}" value="${capacity}" style="width:70px" class="form-control" onchange="window.updateClassCapacity(${c.id})"></span>
                                        <td style="text-align:center"><span class="badge ${utilizationClass}">${utilization.toFixed(0)}%</span></span>
                                        <td style="text-align:center"><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Active' : 'Inactive'}</span></span>
                                        <td style="text-align:center">
                                            <div class="btn-group" style="gap:4px">
                                                <button class="btn btn-sm btn-outline" onclick="window.editClass(${c.id})">✏️</button>
                                                <button class="btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-success'}" onclick="window.toggleClassActive(${c.id}, ${c.is_active})">${c.is_active ? 'Deactivate' : 'Activate'}</button>
                                                <button class="btn btn-sm btn-outline" onclick="window.viewClassStudents(${c.id})">👥</button>
                                            </div>
                                         </span>
                                    </tr>
                                `;
    }).join('') || '<tr><td colspan="9" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No classes found</span>'}
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

async function renderClassStats() {
    const container = document.getElementById('class-stats-container');
    if (!container) return;

    const totalStudents = state.students.filter(s => s.status === 'Active').length;
    const totalClasses = state.classes.filter(c => c.is_active !== false).length;
    const totalCapacity = state.classes.reduce((sum, c) => sum + (c.capacity || 40), 0);
    const avgUtilization = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;
    const fullClasses = state.classes.filter(c => {
        const count = state.students.filter(s => s.class_id === c.id && s.status === 'Active').length;
        return count >= (c.capacity || 40);
    }).length;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${totalStudents}</div>
            <div class="stat-label">Total Active Students</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🏛️</div>
            <div class="stat-value">${totalClasses}</div>
            <div class="stat-label">Active Classes</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${avgUtilization.toFixed(0)}%</div>
            <div class="stat-label">Overall Utilization</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-value">${fullClasses}</div>
            <div class="stat-label">Full Classes</div>
        </div>
    `;
}

function openAddClassModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>➕ Add Class</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Class Name *</label><input type="text" id="new-class-name" placeholder="e.g., PRIMARY 4 A" class="form-control"></div>
                        <div class="form-group"><label>Class Code *</label><input type="text" id="new-class-code" placeholder="e.g., P4A" class="form-control"></div>
                        <div class="form-group"><label>Level</label><select id="new-class-level" class="form-control"><option>Nursery</option><option>Primary</option></select></div>
                        <div class="form-group"><label>Capacity</label><input type="number" id="new-class-capacity" value="40" class="form-control"></div>
                        <div class="form-group"><label>Sort Order</label><input type="number" id="new-class-order" value="${state.classes.length + 1}" class="form-control"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createNewClass()">Create</button>
                </div>
            </div>
        </div>
    `);
}

async function createNewClass() {
    const data = {
        name: document.getElementById('new-class-name')?.value.trim().toUpperCase(),
        code: document.getElementById('new-class-code')?.value.trim().toUpperCase(),
        level: document.getElementById('new-class-level')?.value,
        capacity: parseInt(document.getElementById('new-class-capacity')?.value) || 40,
        sort_order: parseInt(document.getElementById('new-class-order')?.value) || state.classes.length + 1,
        is_active: true,
        created_at: new Date().toISOString()
    };

    if (!data.name || !data.code) {
        showToast('Name and code required', 'warning');
        return;
    }

    await insert('classes', data);
    await refreshTable('classes');
    closeModal();
    showToast('✅ Class created', 'success');
    renderClassManagement(document.getElementById('dynamic-content'));
}

async function editClass(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>✏️ Edit Class: ${esc(cls.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Class Name</label><input type="text" id="edit-class-name" value="${esc(cls.name)}" class="form-control"></div>
                        <div class="form-group"><label>Class Code</label><input type="text" id="edit-class-code" value="${esc(cls.code || '')}" class="form-control"></div>
                        <div class="form-group"><label>Level</label><select id="edit-class-level" class="form-control"><option value="Nursery" ${cls.level === 'Nursery' ? 'selected' : ''}>Nursery</option><option value="Primary" ${cls.level === 'Primary' ? 'selected' : ''}>Primary</option></select></div>
                        <div class="form-group"><label>Capacity</label><input type="number" id="edit-class-capacity" value="${cls.capacity || 40}" class="form-control"></div>
                        <div class="form-group"><label>Sort Order</label><input type="number" id="edit-class-order" value="${cls.sort_order || 0}" class="form-control"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateClass(${classId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function updateClass(classId) {
    const data = {
        name: document.getElementById('edit-class-name')?.value.trim().toUpperCase(),
        code: document.getElementById('edit-class-code')?.value.trim().toUpperCase(),
        level: document.getElementById('edit-class-level')?.value,
        capacity: parseInt(document.getElementById('edit-class-capacity')?.value) || 40,
        sort_order: parseInt(document.getElementById('edit-class-order')?.value) || 0
    };

    if (!data.name || !data.code) {
        showToast('Name and code required', 'warning');
        return;
    }

    await update('classes', classId, data);
    await refreshTable('classes');
    closeModal();
    showToast('✅ Class updated', 'success');
    renderClassManagement(document.getElementById('dynamic-content'));
}

async function toggleClassActive(classId, isActive) {
    await update('classes', classId, { is_active: !isActive });
    await refreshTable('classes');
    showToast(`Class ${isActive ? 'deactivated' : 'activated'}`, 'success');
    renderClassManagement(document.getElementById('dynamic-content'));
}

async function updateClassCapacity(classId) {
    const cap = parseInt(document.getElementById(`cap-${classId}`)?.value);
    if (isNaN(cap)) return;
    await update('classes', classId, { capacity: cap });
    showToast('✅ Capacity updated', 'success');
    renderClassStats();
}

async function moveClassUp(classId) {
    const classes = [...state.classes].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    const index = classes.findIndex(c => c.id === classId);
    if (index <= 0) return;

    const current = classes[index];
    const previous = classes[index - 1];

    await update('classes', current.id, { sort_order: previous.sort_order });
    await update('classes', previous.id, { sort_order: current.sort_order });
    await refreshTable('classes');
    renderClassManagement(document.getElementById('dynamic-content'));
}

async function moveClassDown(classId) {
    const classes = [...state.classes].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    const index = classes.findIndex(c => c.id === classId);
    if (index >= classes.length - 1) return;

    const current = classes[index];
    const next = classes[index + 1];

    await update('classes', current.id, { sort_order: next.sort_order });
    await update('classes', next.id, { sort_order: current.sort_order });
    await refreshTable('classes');
    renderClassManagement(document.getElementById('dynamic-content'));
}

function openPromoteStudentsModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3>🚀 Promote Students</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <strong>Promotion Rules:</strong> Students will be promoted according to the defined progression:
                        <ul style="margin-top:8px;margin-left:20px">
                            ${PROMOTION_RULES.map(rule => `<li>${rule.from} → ${rule.to}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>From Class</th><th>To Class</th><th>Students</th><th>Select</th></tr>
                            </thead>
                            <tbody>
                                ${PROMOTION_RULES.map(rule => {
        const fromClass = state.classes.find(c => c.name === rule.from);
        const students = fromClass ? state.students.filter(s => s.class_id === fromClass.id && s.status === 'Active') : [];
        return `
                                        <tr>
                                            <td>${rule.from}</span>
                                            <td>${rule.to}</span>
                                            <td style="text-align:center">${students.length}</span>
                                            <td style="text-align:center">
                                                <input type="checkbox" class="promote-class-cb" data-from="${fromClass?.id}" data-to="${rule.to}" ${students.length ? 'checked' : 'disabled'}>
                                            </span>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="form-group" style="margin-top:16px">
                        <label>Promotion Batch Name</label>
                        <input type="text" id="promotion-batch-name" class="form-control" value="End of Year Promotion ${new Date().getFullYear()}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-warning" onclick="window.executePromotion()">✅ Promote Selected</button>
                </div>
            </div>
        </div>
    `);

    window.executePromotion = executePromotion;
}

async function executePromotion() {
    const selected = [];
    document.querySelectorAll('.promote-class-cb:checked').forEach(cb => {
        selected.push({
            fromId: parseInt(cb.dataset.from),
            toName: cb.dataset.to
        });
    });

    if (selected.length === 0) {
        showToast('No classes selected for promotion', 'warning');
        return;
    }

    if (!await confirmDialog(`Promote students from ${selected.length} class${selected.length !== 1 ? 'es' : ''}?`)) return;

    const batchName = document.getElementById('promotion-batch-name')?.value || 'End of Year Promotion';
    let promoted = 0;
    let graduated = 0;

    for (const s of selected) {
        const students = state.students.filter(st => st.class_id === s.fromId && st.status === 'Active');
        for (const st of students) {
            if (s.toName === 'GRADUATED') {
                await update('students', st.id, { status: 'Graduated', class_id: null, updated_at: new Date().toISOString() });
                graduated++;
            } else {
                const toClass = state.classes.find(c => c.name === s.toName);
                if (toClass) {
                    await update('students', st.id, { class_id: toClass.id, updated_at: new Date().toISOString() });
                    promoted++;
                }
            }
        }
    }

    // Log promotion
    await insert('activity_logs', {
        user_id: state.currentUser?.id,
        user_role: state.currentUser?.role,
        action: `Promotion batch: ${batchName}`,
        entity_type: 'promotion',
        details: JSON.stringify({ batchName, promoted, graduated }),
        created_at: new Date().toISOString()
    });

    await refreshTable('students');
    closeModal();
    showToast(`✅ Promoted ${promoted} students, ${graduated} graduated`, 'success');
    renderClassManagement(document.getElementById('dynamic-content'));
}

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
}

function viewClassStudents(classId) {
    const cls = getClassById(classId);
    const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');

    if (students.length === 0) {
        showToast(`No active students in ${cls?.name}`, 'info');
        return;
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg">
                <div class="modal-header">
                    <h3>👥 Students in ${esc(cls?.name)} (${students.length})</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>Student Code</th><th>Name</th><th>Gender</th><th>Guardian</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${students.map(s => `
                                    <tr>
                                        <td><code>${esc(s.student_code || '—')}</code></td>
                                        <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                                        <td>${esc(s.gender || '—')}</span>
                                        <td>${esc(s.guardian_name || '—')}</span>
                                        <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span></span>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal(); window.navigateToWithData('student-list', { class_id: ${classId} })">📋 View All</button>
                </div>
            </div>
        </div>
    `);
}