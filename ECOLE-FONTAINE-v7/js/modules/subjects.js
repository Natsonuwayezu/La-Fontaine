// js/modules/subjects.js
// Subjects Management Module - Manage subjects for Nursery and Primary levels

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';

export async function renderSubjects(container) {
    await ensureStateLoaded();

    const nurserySubjects = state.subjects.filter(s => s.level === 'Nursery');
    const primarySubjects = state.subjects.filter(s => s.level === 'Primary');

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📖 Subjects</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddSubjectModal()">➕ Add Subject</button>
                    <button class="btn btn-sm btn-success" onclick="window.saveAllSubjects()">💾 Save All</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="tabs">
                    <button class="tab-btn active" onclick="window.showSubjectTab('nursery', event)">🎒 Nursery</button>
                    <button class="tab-btn" onclick="window.showSubjectTab('primary', event)">📚 Primary</button>
                </div>
                <div id="nursery-subjects">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>#</th><th>Subject Name</th><th>Code</th><th>MG Max</th><th>EX Max</th><th>Post-Mid Only</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                ${nurserySubjects.map((s, i) => `
                                    <tr>
                                        <td>${i + 1}</span>
                                        <td><input type="text" id="subj-name-${s.id}" value="${esc(s.name)}" style="width:100%"></span>
                                        <td><code>${esc(s.code)}</code></span>
                                        <td><input type="number" id="subj-mg-${s.id}" value="${s.mg_max}" style="width:60px"></span>
                                        <td><input type="number" id="subj-ex-${s.id}" value="${s.ex_max}" style="width:60px"></span>
                                        <td><input type="checkbox" id="subj-midonly-${s.id}" ${s.appears_only_post_midterm ? 'checked' : ''}></span>
                                        <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">${s.is_active ? 'Active' : 'Hidden'}</span></span>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.toggleSubjectStatus(${s.id},${s.is_active})">${s.is_active ? 'Hide' : 'Show'}</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteSubject(${s.id},'${esc(s.name)}')">🗑️</button>
                                         </span>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="primary-subjects" style="display:none">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>#</th><th>Subject Name</th><th>Code</th><th>MG Max</th><th>EX Max</th><th>Post-Mid Only</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                ${primarySubjects.map((s, i) => `
                                    <tr>
                                        <td>${i + 1}</span>
                                        <td><input type="text" id="subj-name-${s.id}" value="${esc(s.name)}" style="width:100%"></span>
                                        <td><code>${esc(s.code)}</code></span>
                                        <td><input type="number" id="subj-mg-${s.id}" value="${s.mg_max}" style="width:60px"></span>
                                        <td><input type="number" id="subj-ex-${s.id}" value="${s.ex_max}" style="width:60px"></span>
                                        <td><input type="checkbox" id="subj-midonly-${s.id}" ${s.appears_only_post_midterm ? 'checked' : ''}></span>
                                        <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">${s.is_active ? 'Active' : 'Hidden'}</span></span>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.toggleSubjectStatus(${s.id},${s.is_active})">${s.is_active ? 'Hide' : 'Show'}</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteSubject(${s.id},'${esc(s.name)}')">🗑️</button>
                                         </span>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.showSubjectTab = showSubjectTab;
    window.openAddSubjectModal = openAddSubjectModal;
    window.saveAllSubjects = saveAllSubjects;
    window.toggleSubjectStatus = toggleSubjectStatus;
    window.deleteSubject = deleteSubject;
    window.createSubject = createSubject;
}

function showSubjectTab(tab, event) {
    document.getElementById('nursery-subjects').style.display = tab === 'nursery' ? 'block' : 'none';
    document.getElementById('primary-subjects').style.display = tab === 'primary' ? 'block' : 'none';
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

function openAddSubjectModal() {
    showModal(`
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>➕ Add Subject</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Level</label><select id="new-subj-level"><option>Nursery</option><option>Primary</option></select></div>
                        <div class="form-group"><label>Subject Name</label><input type="text" id="new-subj-name"></div>
                        <div class="form-group"><label>Code</label><input type="text" id="new-subj-code"></div>
                        <div class="form-group"><label>MG Max</label><input type="number" id="new-subj-mg" value="50"></div>
                        <div class="form-group"><label>EX Max</label><input type="number" id="new-subj-ex" value="50"></div>
                        <div class="form-group"><label><input type="checkbox" id="new-subj-midonly"> Post-Midterm Only</label></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createSubject()">Create</button>
                </div>
            </div>
        </div>
    `);
}

async function createSubject() {
    const data = {
        level: document.getElementById('new-subj-level')?.value,
        name: document.getElementById('new-subj-name')?.value.trim(),
        code: document.getElementById('new-subj-code')?.value.trim().toUpperCase(),
        mg_max: parseInt(document.getElementById('new-subj-mg')?.value) || 50,
        ex_max: parseInt(document.getElementById('new-subj-ex')?.value) || 50,
        appears_only_post_midterm: document.getElementById('new-subj-midonly')?.checked || false,
        is_active: true,
        sort_order: state.subjects.length + 1
    };

    if (!data.name || !data.code) {
        showToast('Name and code required', 'warning');
        return;
    }

    await insert('subjects', data);
    await refreshTable('subjects');
    closeModal();
    showToast('✅ Subject created', 'success');
    renderSubjects(document.getElementById('dynamic-content'));
}

async function saveAllSubjects() {
    for (const s of state.subjects) {
        const name = document.getElementById(`subj-name-${s.id}`)?.value;
        const mg = parseInt(document.getElementById(`subj-mg-${s.id}`)?.value);
        const ex = parseInt(document.getElementById(`subj-ex-${s.id}`)?.value);
        const midonly = document.getElementById(`subj-midonly-${s.id}`)?.checked;

        if (name && name !== s.name) await update('subjects', s.id, { name });
        if (mg && mg !== s.mg_max) await update('subjects', s.id, { mg_max: mg });
        if (ex && ex !== s.ex_max) await update('subjects', s.id, { ex_max: ex });
        if (midonly !== s.appears_only_post_midterm) await update('subjects', s.id, { appears_only_post_midterm: midonly });
    }
    await refreshTable('subjects');
    showToast('✅ Subjects saved', 'success');
    renderSubjects(document.getElementById('dynamic-content'));
}

async function toggleSubjectStatus(id, isActive) {
    await update('subjects', id, { is_active: !isActive });
    await refreshTable('subjects');
    renderSubjects(document.getElementById('dynamic-content'));
}

async function deleteSubject(id, name) {
    if (!await confirmDialog(`Delete subject "${name}"?`)) return;
    await remove('subjects', id);
    await refreshTable('subjects');
    renderSubjects(document.getElementById('dynamic-content'));
}