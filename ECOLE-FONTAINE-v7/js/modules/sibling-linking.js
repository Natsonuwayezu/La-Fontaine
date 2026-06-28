// ============================================================
// SIBLING LINKING MODULE - Family and sibling management
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isAccountant } from '../core/auth.js';
import { fmtCurrency, esc } from '../core/utils.js';
import { getFullStudentBalance } from '../core/helpers.js';;
import { update, insert, remove } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast, confirmDialog, showModal, closeModal } from '../ui/modals.js';

// Render Sibling Linking page
export async function renderSiblingLinking(container) {
    if (!isAdmin() && !isAccountant()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied.</div>';
        return;
    }

    await ensureStateLoaded();

    const families = state.families || [];
    const studentsWithFamily = (state.students || []).filter(s => s.family_id);
    const studentsWithoutFamily = (state.students || []).filter(s => !s.family_id && s.status === 'Active');

    // Auto-detect potential siblings
    const potentialSiblings = [];
    const guardianMap = new Map();
    studentsWithoutFamily.forEach(s => {
        const key = (s.guardian_name || '').toLowerCase();
        if (key && !guardianMap.has(key)) guardianMap.set(key, []);
        if (key) guardianMap.get(key).push(s);
    });
    guardianMap.forEach(group => { if (group.length > 1) potentialSiblings.push(group); });

    // Build families table
    let familiesHtml = '';
    if (families.length) {
        for (const f of families) {
            const familyStudents = (state.students || []).filter(s => s.family_id === f.id);
            familiesHtml += `<tr>
                <td><code>${esc(f.family_code)}</code></td>
                <td><strong>${esc(f.guardian_name || '—')}</strong></td>
                <td>${esc(f.guardian_phone || '—')}</td>
                <td>${familyStudents.length} student${familyStudents.length !== 1 ? 's' : ''}</td>
                <td>${fmtCurrency(f.discount_amount || 0)}</span>
                <td><button class="btn btn-sm btn-outline" onclick="openEditFamilyModalFull(${f.id})">✏️</button>
                    <button class="btn btn-sm btn-outline" onclick="showFamilyFeeSummary(${f.id})" title="Fee Summary">💰</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFamilyFull(${f.id},'${esc(f.family_code)}')">🗑️</button>
                </table>
            </tr>`;
        }
    } else {
        familiesHtml = '</td><td colspan="6" style="text-align:center">No families created</span></tr>';
    }

    // Build linked table
    let linkedHtml = '';
    if (studentsWithFamily.length) {
        for (const s of studentsWithFamily) {
            const family = families.find(f => f.id === s.family_id);
            const cls = getClassById(s.class_id);
            linkedHtml += `<tr>
                <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                <td>${esc(cls?.name || '—')}</td>
                <td><code>${esc(family?.family_code || '—')}</code></td>
                <td>${esc(family?.guardian_name || '—')}</td>
                <td>${fmtCurrency(family?.discount_amount || 0)}</span>
                <td><button class="btn btn-sm btn-warning" onclick="unlinkStudentFull(${s.id},'${esc(s.first_name)} ${esc(s.last_name)}')">🔗 Unlink</button></td>
            </tr>`;
        }
    } else {
        linkedHtml = '<tr><td colspan="6" style="text-align:center">No linked students</span></tr>';
    }

    // Build unlinked table
    let unlinkedHtml = '';
    if (studentsWithoutFamily.length) {
        for (const s of studentsWithoutFamily) {
            const cls = getClassById(s.class_id);
            unlinkedHtml += `<tr>
                <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                <td>${esc(cls?.name || '—')}</td>
                <td>${esc(s.guardian_name || '—')}</td>
                <td>${esc(s.guardian_phone || '—')}</td>
                <td><button class="btn btn-sm btn-primary" onclick="openLinkStudentModalFull(${s.id},'${esc(s.first_name)} ${esc(s.last_name)}')">🔗 Link to Family</button></td>
            </tr>`;
        }
    } else {
        unlinkedHtml = '<tr><td colspan="5" style="text-align:center">No unlinked students</span></tr>';
    }

    // Build auto-detect HTML
    let autoHtml = '';
    if (potentialSiblings.length) {
        for (const group of potentialSiblings) {
            const studentIds = group.map(s => s.id).join(',');
            const studentNames = group.map(s => `${esc(s.first_name)} ${esc(s.last_name)}`).join(', ');
            autoHtml += `<tr>
                <td><strong>${esc(group[0].guardian_name)}</strong></td>
                <td>${studentNames}</td>
                <td><button class="btn btn-sm btn-primary" onclick="autoCreateFamilyForGroup('${studentIds}')">🏠 Create Family & Link All</button></td>
            </tr>`;
        }
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">👨‍👩‍👧 Family & Sibling Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="openCreateFamilyModalFull()">➕ Create Family</button>
                    <button class="btn btn-sm btn-outline" onclick="autoDetectFamiliesByGuardian()">🔍 Auto-Detect</button>
                    <button class="btn btn-sm btn-outline" onclick="renderSiblingLinking(document.getElementById('dynamic-content'))">🔄 Refresh</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="tabs" style="display:flex;gap:2px;border-bottom:2px solid var(--border-light);margin-bottom:16px">
                    <button class="tab-btn active" onclick="showFamilyTabFull('families', event)">🏠 Families (${families.length})</button>
                    <button class="tab-btn" onclick="showFamilyTabFull('linked', event)">👥 Linked (${studentsWithFamily.length})</button>
                    <button class="tab-btn" onclick="showFamilyTabFull('unlinked', event)">📋 Unlinked (${studentsWithoutFamily.length})</button>
                    ${potentialSiblings.length > 0 ? `<button class="tab-btn" onclick="showFamilyTabFull('auto', event)">🔍 Auto-Detect (${potentialSiblings.length})</button>` : ''}
                </div>
                <div id="families-tab-full" class="tab-content active"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Family Code</th><th>Guardian Name</th><th>Phone</th><th>Students</th><th>Discount</th><th>Actions</th></td></thead><tbody>${familiesHtml}</tbody></table></div></div>
                <div id="linked-tab-full" class="tab-content" style="display:none"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Family Code</th><th>Guardian</th><th>Discount</th><th>Action</th></table></thead><tbody>${linkedHtml}</tbody></table></div></div>
                <div id="unlinked-tab-full" class="tab-content" style="display:none"><div class="filters-bar"><input type="text" id="unlinked-search-full" placeholder="🔍 Search students..." class="flex-1" oninput="filterUnlinkedStudentsFull()"></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Action</th></tr></thead><tbody id="unlinked-students-list-full">${unlinkedHtml}</tbody></table></div></div>
                ${potentialSiblings.length > 0 ? `<div id="auto-tab-full" class="tab-content" style="display:none"><div class="alert alert-info">Detected students with the same guardian name. Consider linking them as siblings.</div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Guardian</th><th>Students</th><th>Action</th></tr></thead><tbody>${autoHtml}</tbody></table></div></div>` : ''}
            </div>
        </div>
    `;
}

// Tab switching
window.showFamilyTabFull = function (tabName, event) {
    const tabs = ['families', 'linked', 'unlinked', 'auto'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-tab-full`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
};

// Filter unlinked students
window.filterUnlinkedStudentsFull = function () {
    const search = document.getElementById('unlinked-search-full')?.value.toLowerCase();
    const rows = document.querySelectorAll('#unlinked-students-list-full tr');
    rows.forEach(row => { const text = row.innerText.toLowerCase(); row.style.display = !search || text.includes(search) ? '' : 'none'; });
};

// Open create family modal
window.openCreateFamilyModalFull = function () {
    showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header"><h3>➕ Create Family</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Family Code *</label><input type="text" id="family-code-full" placeholder="e.g., FAM-001"></div><div class="form-group"><label>Guardian Name</label><input type="text" id="family-guardian-full"></div><div class="form-group"><label>Guardian Phone</label><input type="text" id="family-phone-full"></div><div class="form-group"><label>Guardian Email</label><input type="email" id="family-email-full"></div><div class="form-group full"><label>Address</label><textarea id="family-address-full" rows="2"></textarea></div><div class="form-group"><label>Discount Amount (RWF)</label><input type="number" id="family-discount-full" value="0" step="5000"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createFamilyFull()">Create Family</button></div></div></div>`);
};

// Create family
window.createFamilyFull = async function () {
    const code = document.getElementById('family-code-full')?.value.trim().toUpperCase();
    if (!code) { showToast('Family code required', 'warning'); return; }
    await insert('families', {
        family_code: code,
        guardian_name: document.getElementById('family-guardian-full')?.value,
        guardian_phone: document.getElementById('family-phone-full')?.value,
        guardian_email: document.getElementById('family-email-full')?.value,
        address: document.getElementById('family-address-full')?.value,
        discount_amount: parseFloat(document.getElementById('family-discount-full')?.value) || 0,
        created_at: new Date().toISOString()
    });
    await refreshTable('families');
    closeModal();
    showToast('✅ Family created', 'success');
    renderSiblingLinking(document.getElementById('dynamic-content'));
};

// Open link student modal
window.openLinkStudentModalFull = function (studentId, studentName) {
    const families = state.families || [];
    showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header"><h3>🔗 Link Student: ${esc(studentName)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="form-group"><label>Select Family</label><select id="link-family-id-full"><option value="">-- Select Family --</option>${families.map(f => `<option value="${f.id}">${esc(f.family_code)} - ${esc(f.guardian_name || 'No guardian')}</option>`).join('')}</select></div><div class="form-group"><label>Or Create New Family</label><input type="text" id="link-new-family-code-full" placeholder="New Family Code"><button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="createFamilyFromLinkFull()">➕ Create & Link</button></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="linkStudentToFamilyFull(${studentId})">Link Student</button></div></div></div>`);
};

// Link student to family
window.linkStudentToFamilyFull = async function (studentId) {
    const familyId = document.getElementById('link-family-id-full')?.value;
    if (!familyId) { showToast('Select a family', 'warning'); return; }
    await update('students', studentId, { family_id: parseInt(familyId) });
    await refreshTable('students');
    closeModal();
    showToast('✅ Student linked', 'success');
    renderSiblingLinking(document.getElementById('dynamic-content'));
};

// Create family from link
window.createFamilyFromLinkFull = async function () {
    const code = document.getElementById('link-new-family-code-full')?.value.trim().toUpperCase();
    if (!code) { showToast('Family code required', 'warning'); return; }
    const newFamily = await insert('families', { family_code: code, created_at: new Date().toISOString() });
    if (newFamily) {
        const select = document.getElementById('link-family-id-full');
        select.innerHTML += `<option value="${newFamily.id}" selected>${esc(code)} - New Family</option>`;
        showToast('✅ Family created', 'success');
    }
};

// Open edit family modal
window.openEditFamilyModalFull = async function (familyId) {
    const f = await getById('families', familyId);
    if (!f) return;
    showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header"><h3>✏️ Edit Family: ${esc(f.family_code)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Guardian Name</label><input type="text" id="edit-family-guardian-full" value="${esc(f.guardian_name || '')}"></div><div class="form-group"><label>Guardian Phone</label><input type="text" id="edit-family-phone-full" value="${esc(f.guardian_phone || '')}"></div><div class="form-group"><label>Guardian Email</label><input type="email" id="edit-family-email-full" value="${esc(f.guardian_email || '')}"></div><div class="form-group full"><label>Address</label><textarea id="edit-family-address-full" rows="2">${esc(f.address || '')}</textarea></div><div class="form-group"><label>Discount Amount (RWF)</label><input type="number" id="edit-family-discount-full" value="${f.discount_amount || 0}" step="5000"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="updateFamilyFull(${familyId})">Save</button></div></div></div>`);
};

// Update family
window.updateFamilyFull = async function (familyId) {
    await update('families', familyId, {
        guardian_name: document.getElementById('edit-family-guardian-full')?.value,
        guardian_phone: document.getElementById('edit-family-phone-full')?.value,
        guardian_email: document.getElementById('edit-family-email-full')?.value,
        address: document.getElementById('edit-family-address-full')?.value,
        discount_amount: parseFloat(document.getElementById('edit-family-discount-full')?.value) || 0
    });
    await refreshTable('families');
    closeModal();
    showToast('✅ Family updated', 'success');
    renderSiblingLinking(document.getElementById('dynamic-content'));
};

// Unlink student
window.unlinkStudentFull = async function (studentId, studentName) {
    if (!await confirmDialog(`Remove ${studentName} from family?`)) return;
    await update('students', studentId, { family_id: null });
    await refreshTable('students');
    showToast('✅ Student unlinked', 'success');
    renderSiblingLinking(document.getElementById('dynamic-content'));
};

// Delete family
window.deleteFamilyFull = async function (familyId, familyCode) {
    const linked = (state.students || []).filter(s => s.family_id === familyId).length;
    const msg = linked ? `Family "${familyCode}" has ${linked} linked students. Deleting will unlink them. Continue?` : `Delete family "${familyCode}"?`;
    if (!await confirmDialog(msg)) return;
    await updateWhere('students', `family_id=eq.${familyId}`, { family_id: null });
    await remove('families', familyId);
    await refreshTable('families');
    await refreshTable('students');
    showToast('✅ Family deleted', 'success');
    renderSiblingLinking(document.getElementById('dynamic-content'));
};

// Auto-create family for group
window.autoCreateFamilyForGroup = async function (studentIdsStr) {
    const studentIds = studentIdsStr.split(',').map(id => parseInt(id));
    const students = studentIds.map(id => getStudentById(id)).filter(s => s);
    if (students.length === 0) return;
    const guardianName = students[0]?.guardian_name || 'Family';
    const guardianPhone = students[0]?.guardian_phone || '';
    const familyCode = `FAM-${Date.now().toString().slice(-6)}`;
    const newFamily = await insert('families', { family_code: familyCode, guardian_name: guardianName, guardian_phone: guardianPhone, created_at: new Date().toISOString() });
    if (newFamily) {
        for (const s of students) await update('students', s.id, { family_id: newFamily.id });
        await refreshTable('students');
        await refreshTable('families');
        showToast(`✅ Created family ${familyCode} and linked ${students.length} students`, 'success');
        renderSiblingLinking(document.getElementById('dynamic-content'));
    }
};

// Auto-detect families by guardian
window.autoDetectFamiliesByGuardian = async function () {
    const students = (state.students || []).filter(s => s.status === 'Active' && !s.family_id && s.guardian_name);
    const groups = {};
    students.forEach(s => {
        const key = s.guardian_name.trim().toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    const potentialGroups = Object.values(groups).filter(g => g.length > 1);
    if (!potentialGroups.length) { showToast('No sibling groups detected', 'info'); return; }
    showModal(`<div class="modal-overlay" id="auto-detect-modal"><div class="modal modal-lg"><div class="modal-header"><h3>🤖 Auto-Detect Families</h3><button class="modal-close" onclick="closeModal('auto-detect-modal')">✕</button></div><div class="modal-body"><div class="alert alert-info">Found <strong>${potentialGroups.length}</strong> potential family group${potentialGroups.length !== 1 ? 's' : ''} based on guardian name.</div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Guardian</th><th>Students</th><th>Action</th></tr></thead><tbody>${potentialGroups.map((group, i) => `<tr><td><strong>${esc(group[0].guardian_name)}</strong><br><small>${esc(group[0].guardian_phone || '')}</small></td><td>${group.map(s => `<span class="badge badge-neutral">${esc(s.first_name)} ${esc(s.last_name)} (${getClassById(s.class_id)?.name || ''})</span>`).join(' ')}</span><td><button class="btn btn-sm btn-primary" onclick="autoCreateFamilyForGroupById([${group.map(s => s.id).join(',')}],'${esc(group[0].guardian_name).replace(/'/g, "\\'")}')">🏠 Create Family</button></span>`).join('')}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('auto-detect-modal')">Close</button><button class="btn btn-success" onclick="autoLinkAllSiblingGroups()">🤖 Auto-Link All</button></div></div></div>`);
};

// Auto-create family for group by ID
window.autoCreateFamilyForGroupById = async function (studentIds, guardianName) {
    const code = 'FAM-' + Date.now().toString().slice(-6);
    const first = getStudentById(studentIds[0]);
    const newFamily = await insert('families', { family_code: code, guardian_name: guardianName, guardian_phone: first?.guardian_phone || null, created_at: new Date().toISOString() });
    if (!newFamily) { showToast('Failed to create family', 'error'); return; }
    let linked = 0;
    for (const sid of studentIds) { await update('students', sid, { family_id: newFamily.id }); linked++; }
    await refreshTable('families'); await refreshTable('students');
    showToast(`✅ Family "${code}" created with ${linked} students`, 'success');
    const el = document.getElementById('dynamic-content');
    if (el && el.innerHTML.includes('sibling-linking')) renderSiblingLinking(el);
};

// Auto-link all sibling groups
window.autoLinkAllSiblingGroups = async function () {
    const students = (state.students || []).filter(s => s.status === 'Active' && !s.family_id && s.guardian_name);
    const groups = {};
    students.forEach(s => {
        const key = s.guardian_name.trim().toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    const siblingGroups = Object.values(groups).filter(g => g.length > 1);
    if (!siblingGroups.length) { showToast('No sibling groups to auto-link', 'info'); return; }
    if (!await confirmDialog(`Auto-link ${siblingGroups.length} sibling group${siblingGroups.length !== 1 ? 's' : ''}? This will create families for each group.`)) return;
    let created = 0;
    for (const group of siblingGroups) {
        await autoCreateFamilyForGroupById(group.map(s => s.id), group[0].guardian_name);
        created++;
    }
    showToast(`✅ Auto-linked ${created} sibling group${created !== 1 ? 's' : ''}`, 'success');
};

// Show family fee summary
window.showFamilyFeeSummary = async function (familyId) {
    const family = (state.families || []).find(f => f.id === familyId);
    if (!family) return;
    const members = (state.students || []).filter(s => s.family_id === familyId && s.status === 'Active');
    let grandTotal = 0, grandPaid = 0;
    const rows = members.map(s => {
        const bal = getFullStudentBalance(s.id);
        const total = bal?.total || 0, paid = bal?.paid || 0, balance = bal?.balance || 0;
        grandTotal += total; grandPaid += paid;
        return `<tr><td><strong>${esc(s.last_name + ' ' + s.first_name)}</strong><br><small>${esc(getClassById(s.class_id)?.name || '')}</small></td><td class="text-right">${fmtCurrency(total)}</span><td class="text-right">${fmtCurrency(paid)}</span><td class="text-right" style="color:${balance > 0 ? '#ef4444' : '#22c55e'}">${fmtCurrency(balance)}</span><td class="text-center"><span class="badge ${balance === 0 ? 'badge-success' : paid > 0 ? 'badge-warning' : 'badge-danger'}">${balance === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'}</span></span></tr>`;
    }).join('');
    showModal(`<div class="modal-overlay"><div class="modal modal-lg" style="max-width:620px"><div class="modal-header"><h3>👨‍👩‍👧 Family Fee Summary — ${esc(family.family_code)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Expected</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center">No active members</span>'}</tbody><tfoot><tr style="font-weight:700;background:var(--bg-tertiary)"><td>FAMILY TOTAL</span><td class="text-right">${fmtCurrency(grandTotal)}</span><td class="text-right">${fmtCurrency(grandPaid)}</span><td class="text-right" style="color:${grandTotal - grandPaid > 0 ? '#ef4444' : '#22c55e'}">${fmtCurrency(grandTotal - grandPaid)}</span><td class="text-center"><span class="badge ${grandTotal === grandPaid ? 'badge-success' : 'badge-warning'}">${grandTotal === grandPaid ? 'All Paid' : 'Outstanding'}</span></span></tr></tfoot></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="exportFamilyFeesExcel(${familyId})">📥 Export Excel</button><button class="btn btn-outline" onclick="closeModal()">Close</button></div></div></div>`);
};

// Export family fees to Excel
window.exportFamilyFeesExcel = function (familyId) {
    const family = (state.families || []).find(f => f.id === familyId);
    if (!family) return;
    const members = (state.students || []).filter(s => s.family_id === familyId && s.status === 'Active');
    const rows = members.map(s => {
        const bal = getFullStudentBalance(s.id);
        return { 'Student': s.last_name + ' ' + s.first_name, 'Class': getClassById(s.class_id)?.name || '', 'Expected (RWF)': bal?.total || 0, 'Paid (RWF)': bal?.paid || 0, 'Balance (RWF)': bal?.balance || 0, 'Status': (bal?.balance || 0) === 0 ? 'Paid' : (bal?.paid || 0) > 0 ? 'Partial' : 'Unpaid' };
    });
    exportToExcel(rows, `Family_Fees_${family.family_code}`);
};

// Helper functions
async function getById(table, id) {
    const result = await getAll(table, { id: id });
    return result[0] || null;
}

async function updateWhere(table, filter, data) {
    const r = await apiRequest(`${table}?${filter}`, 'PATCH', data);
    return r.success;
}

async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.students.length) await refreshTable('students');
    if (!state.families.length) await refreshTable('families');
}

function exportToExcel(data, filename) {
    if (!data?.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}