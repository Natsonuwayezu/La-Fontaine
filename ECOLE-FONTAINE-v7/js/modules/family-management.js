// ============================================================
// FAMILY MANAGEMENT MODULE - Family CRUD operations
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isAccountant, isTeacher } from '../core/auth.js';
import { fmtCurrency, esc } from '../core/utils.js';
import { getFullStudentBalance } from '../core/helpers.js';;
import { update, insert, remove, getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast, confirmDialog, showModal, closeModal } from '../ui/modals.js';
import { logActivity } from '../core/helpers.js';

// Open edit family modal (from student details)
export async function openEditFamilyModal(familyId) {
    if (isTeacher()) {
        showToast('Access denied. Teachers cannot edit family information.', 'warning');
        return;
    }

    if (!familyId) {
        showToast('No family linked to this student', 'warning');
        return;
    }

    const family = (state.families || []).find(f => f.id === familyId);
    if (!family) {
        showToast('Family not found', 'error');
        return;
    }

    showModal(`
        <div class="modal-overlay" id="edit-family-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>✏️ Edit Family: ${esc(family.family_code)}</h3>
                    <button class="modal-close" onclick="closeModal('edit-family-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Family Code</label><input type="text" id="edit-family-code" value="${esc(family.family_code)}" readonly style="background:var(--bg-tertiary)"></div>
                        <div class="form-group"><label>Guardian Name</label><input type="text" id="edit-family-guardian" value="${esc(family.guardian_name || '')}"></div>
                        <div class="form-group"><label>Guardian Phone</label><input type="text" id="edit-family-phone" value="${esc(family.guardian_phone || '')}"></div>
                        <div class="form-group"><label>Guardian Email</label><input type="email" id="edit-family-email" value="${esc(family.guardian_email || '')}"></div>
                        <div class="form-group full"><label>Address</label><textarea id="edit-family-address" rows="2">${esc(family.address || '')}</textarea></div>
                        <div class="form-group"><label>Discount Amount (RWF)</label><input type="number" id="edit-family-discount" value="${family.discount_amount || 0}" step="5000"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-family-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="updateFamilyFromModal(${familyId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

// Update family from modal
export async function updateFamilyFromModal(familyId) {
    if (isTeacher()) {
        showToast('Access denied. Teachers cannot update family information.', 'warning');
        closeModal('edit-family-modal');
        return;
    }

    const guardian_name = document.getElementById('edit-family-guardian')?.value;
    const guardian_phone = document.getElementById('edit-family-phone')?.value;
    const guardian_email = document.getElementById('edit-family-email')?.value;
    const address = document.getElementById('edit-family-address')?.value;
    const discount_amount = parseFloat(document.getElementById('edit-family-discount')?.value) || 0;

    await update('families', familyId, {
        guardian_name, guardian_phone, guardian_email, address, discount_amount,
        updated_at: new Date().toISOString()
    });

    await refreshTable('families');
    closeModal('edit-family-modal');
    showToast('✅ Family updated successfully', 'success');

    // Refresh the current student details view
    if (window._currentStudentId) {
        await window.loadStudentTabContent?.(window._activeStudentTab, window._currentStudentId);
    }
}

// Open link student modal (from student details)
export async function openLinkStudentModal(studentId, studentName) {
    if (isTeacher()) {
        showToast('Access denied. Teachers cannot link students to families.', 'warning');
        return;
    }

    const families = state.families || [];

    showModal(`
        <div class="modal-overlay" id="link-student-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>🔗 Link Student: ${esc(studentName)}</h3>
                    <button class="modal-close" onclick="closeModal('link-student-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Select Family</label>
                        <select id="link-family-select" class="form-control">
                            <option value="">-- Select Family --</option>
                            ${families.map(f => `<option value="${f.id}">${esc(f.family_code)} - ${esc(f.guardian_name || 'No guardian')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-top:16px">
                        <label>Or Create New Family</label>
                        <div class="form-grid" style="grid-template-columns:1fr auto">
                            <input type="text" id="new-family-code" placeholder="New Family Code" class="form-control">
                            <button class="btn btn-sm btn-primary" onclick="createFamilyAndLink(${studentId})">➕ Create & Link</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('link-student-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="linkStudentToExistingFamily(${studentId})">Link to Selected Family</button>
                </div>
            </div>
        </div>
    `);
}

// Link student to existing family
export async function linkStudentToExistingFamily(studentId) {
    if (isTeacher()) {
        showToast('Access denied. Teachers cannot link students to families.', 'warning');
        closeModal('link-student-modal');
        return;
    }

    const familyId = document.getElementById('link-family-select')?.value;
    if (!familyId) {
        showToast('Please select a family', 'warning');
        return;
    }

    await update('students', studentId, { family_id: parseInt(familyId) });
    await refreshTable('students');
    closeModal('link-student-modal');
    showToast('✅ Student linked to family', 'success');

    if (studentId === window._currentStudentId) {
        await window.loadStudentTabContent?.(window._activeStudentTab, studentId);
    }
}

// Create family and link student
export async function createFamilyAndLink(studentId) {
    if (isTeacher()) {
        showToast('Access denied. Teachers cannot create families.', 'warning');
        closeModal('link-student-modal');
        return;
    }

    const familyCode = document.getElementById('new-family-code')?.value.trim().toUpperCase();
    if (!familyCode) {
        showToast('Please enter a family code', 'warning');
        return;
    }

    const newFamily = await insert('families', {
        family_code: familyCode,
        created_at: new Date().toISOString()
    });

    if (newFamily && newFamily.id) {
        await update('students', studentId, { family_id: newFamily.id });
        await refreshTable('families');
        await refreshTable('students');
        closeModal('link-student-modal');
        showToast(`✅ Created family ${familyCode} and linked student`, 'success');

        if (studentId === window._currentStudentId) {
            await window.loadStudentTabContent?.(window._activeStudentTab, studentId);
        }
    } else {
        showToast('Failed to create family', 'error');
    }
}

// Get family discount for a student
export function getFamilyDiscount(studentId) {
    const student = getStudentById(studentId);
    if (!student || !student.family_id) return 0;

    const family = (state.families || []).find(f => f.id === student.family_id);
    return family?.discount_amount || 0;
}

// Apply family discount to a fee amount
export function applyFamilyDiscount(amount, studentId) {
    const discount = getFamilyDiscount(studentId);
    return Math.max(0, amount - discount);
}

// Get all students in the same family
export function getFamilyMembers(studentId) {
    const student = getStudentById(studentId);
    if (!student || !student.family_id) return [];

    return (state.students || []).filter(s => s.family_id === student.family_id && s.id !== studentId);
}

// Get family fee summary (total for all siblings)
export function getFamilyFeeSummary(familyId) {
    const members = (state.students || []).filter(s => s.family_id === familyId && s.status === 'Active');
    let totalFees = 0, totalPaid = 0, totalBalance = 0;

    for (const member of members) {
        const balance = getFullStudentBalance(member.id);
        totalFees += balance.total;
        totalPaid += balance.paid;
        totalBalance += balance.balance;
    }

    return { totalFees, totalPaid, totalBalance, memberCount: members.length };
}

// Export family list to Excel
export function exportFamiliesToExcel() {
    const families = state.families || [];
    const data = families.map(family => {
        const members = (state.students || []).filter(s => s.family_id === family.id);
        const summary = getFamilyFeeSummary(family.id);
        return {
            'Family Code': family.family_code,
            'Guardian Name': family.guardian_name || '',
            'Guardian Phone': family.guardian_phone || '',
            'Number of Students': members.length,
            'Total Fees (RWF)': summary.totalFees,
            'Total Paid (RWF)': summary.totalPaid,
            'Total Balance (RWF)': summary.totalBalance,
            'Discount Amount (RWF)': family.discount_amount || 0
        };
    });

    exportToExcel(data, 'Families_Export');
}

// Helper function
function exportToExcel(data, filename) {
    if (!data?.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export functions to window
window.openEditFamilyModal = openEditFamilyModal;
window.updateFamilyFromModal = updateFamilyFromModal;
window.openLinkStudentModal = openLinkStudentModal;
window.linkStudentToExistingFamily = linkStudentToExistingFamily;
window.createFamilyAndLink = createFamilyAndLink;
// ── Page render entry point ─────────────────────────────────
export async function renderFamilyManagement(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><h2>👨‍👩‍👧 Family Management</h2></div>
            <div class="dash-card-body">
                <p class="text-muted">This module provides utility functions used by other modules. 
                Select a specific action from the relevant section.</p>
            </div>
        </div>
    `;
}
