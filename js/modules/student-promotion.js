// ============================================================
// STUDENT PROMOTION MODULE - Promote students to next class
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById, updateState } from '../core/state.js';
import { getCurrentUser, isAdmin } from '../core/auth.js';
import { showToast, confirmDialog } from '../ui/modals.js';
import { update, insert, getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { logActivity } from '../core/helpers.js';
import { PROMOTION_RULES, PROMOTION_MAP } from '../core/constants.js';

// Promotion data
let promotionData = [];

// Render Student Promotion page
export async function renderStudentPromotion(container) {
    if (!isAdmin()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    await ensureStateLoaded();

    const currentYear = (state.academicYears || []).find(y => y.is_active);
    promotionData = [];

    for (const rule of PROMOTION_RULES) {
        const fromClass = (state.classes || []).find(c => c.name === rule.from);
        if (fromClass) {
            const students = (state.students || []).filter(s => s.class_id === fromClass.id && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const toClass = rule.to === 'GRADUATED' ? null : (state.classes || []).find(c => c.name === rule.to);
            promotionData.push({ from_class: rule.from, from_id: fromClass.id, to_class: rule.to, to_id: toClass?.id, students: students });
        }
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <h3><span>🚀</span> Student Promotion Wizard</h3>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info"><strong>📅 Promotion Details:</strong> From: <strong>${currentYear?.name || 'Current Year'}</strong> → To: <strong>Next Academic Year</strong><br>Promotion Date: <strong>${new Date().toLocaleDateString()}</strong></div>
                <div id="promotion-classes-container">
                    ${promotionData.map(p => `
                        <div class="dash-card" style="margin-bottom:16px">
                            <div class="dash-card-header" style="cursor:pointer" onclick="togglePromotionClass('class-${p.from_id}')">
                                <span><strong>${esc(p.from_class)}</strong> → ${p.to_class === 'GRADUATED' ? '<span class="badge badge-warning">🎓 GRADUATED</span>' : esc(p.to_class)}</span>
                                <span>${p.students.length} students <span class="nav-section-arrow">▾</span></span>
                            </div>
                            <div id="class-${p.from_id}" class="promotion-class-content" style="display:none;padding:16px">
                                <div class="alert alert-warning" style="margin-bottom:12px">✅ Checked students will be promoted. Uncheck to keep in same class (repeat).</div>
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead>
                                            <tr><th><input type="checkbox" id="select-all-${p.from_id}" onchange="toggleSelectAll(${p.from_id})"> Select All</th><th>Student Name</th><th>Student Code</th><th>Current Class</th><th>Promoting To</th><th>Status</th></tr>
                                        </thead>
                                        <tbody>${p.students.map(s => `
                                            <tr><td><input type="checkbox" class="student-promo-${p.from_id}" data-student-id="${s.id}" data-from="${p.from_id}" data-to="${p.to_id || ''}" data-to-name="${p.to_class}"></td>
                                            <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                                            <td>${esc(s.student_code || '—')}</td>
                                            <td>${esc(p.from_class)}</td>
                                            <td>${p.to_class === 'GRADUATED' ? '🎓 Graduated' : esc(p.to_class)}</td>
                                            <td><span class="badge badge-success">Ready</span></td>
                                        </tr>`).join('')}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-group" style="margin-top:20px"><label>Promotion Batch Name</label><input type="text" id="promotion-batch-name-full" class="form-control" value="End of Year ${currentYear?.name || ''} Promotion"></div>
                <div class="btn-group"><button class="btn btn-outline" onclick="previewFullPromotion()">👁️ Preview Selected</button><button class="btn btn-warning" onclick="executeFullPromotion()">✅ Execute Promotion</button></div>
            </div>
        </div>
        <div id="promotion-history-full" class="dash-card" style="margin-top:20px">
            <div class="dash-card-header"><h3>📜 Promotion History</h3></div>
            <div class="dash-card-body"><div id="promotion-history-list-full">Loading...</div></div>
        </div>
    `;

    await loadFullPromotionHistory();
}

// Toggle promotion class visibility
window.togglePromotionClass = function (classId) {
    const el = document.getElementById(classId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// Toggle select all in promotion class
window.toggleSelectAll = function (classId) {
    const selectAll = document.getElementById(`select-all-${classId}`).checked;
    document.querySelectorAll(`.student-promo-${classId}`).forEach(cb => cb.checked = selectAll);
};

// Preview promotion
window.previewFullPromotion = function () {
    const selected = [];
    document.querySelectorAll('input[class^="student-promo-"]:checked').forEach(cb => {
        selected.push({
            student_id: parseInt(cb.dataset.studentId),
            from_class_id: parseInt(cb.dataset.from),
            to_class_id: cb.dataset.to ? parseInt(cb.dataset.to) : null,
            to_class_name: cb.dataset.toName
        });
    });

    if (selected.length === 0) { showToast('No students selected for promotion', 'error'); return; }

    const students = [];
    for (const s of selected) {
        const student = getStudentById(s.student_id);
        if (student) students.push({ ...s, name: `${student.first_name} ${student.last_name}`, current_class: getClassById(s.from_class_id)?.name });
    }

    showModal(`<div id="promotion-preview-full-modal" class="modal-overlay open"><div class="modal modal-lg"><div class="modal-header"><h3>👁️ Promotion Preview (${students.length} students)</h3><button class="modal-close" onclick="closeModal('promotion-preview-full-modal')">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Student Name</th><th>Current Class</th><th>Promoting To</th><th>Status</th></tr></thead><tbody>${students.map(s => `<tr><td>${esc(s.name)}</span><td>${esc(s.current_class)}</span><td>${s.to_class_name === 'GRADUATED' ? '🎓 Graduated' : esc(s.to_class_name)}</span><td><span class="badge badge-success">Ready</span></span>`).join('')}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('promotion-preview-full-modal')">Close</button></div></div></div>`);
};

// Execute promotion
window.executeFullPromotion = async function () {
    const selected = [];
    document.querySelectorAll('input[class^="student-promo-"]:checked').forEach(cb => {
        selected.push({
            student_id: parseInt(cb.dataset.studentId),
            from_class_id: parseInt(cb.dataset.from),
            to_class_id: cb.dataset.to ? parseInt(cb.dataset.to) : null,
            to_class_name: cb.dataset.toName
        });
    });

    if (selected.length === 0) { showToast('No students selected for promotion', 'error'); return; }
    if (!await confirmDialog(`Are you sure you want to promote ${selected.length} students?\n\nThis action can be rolled back within 24 hours.`)) return;

    const user = getCurrentUser();
    const batchName = document.getElementById('promotion-batch-name-full')?.value || 'End of Year Promotion';
    const promotionRecords = [];
    let promoted = 0, graduated = 0;

    for (const s of selected) {
        try {
            if (s.to_class_id) {
                await update('students', s.student_id, { class_id: s.to_class_id, updated_at: new Date().toISOString() });
                promoted++;
                promotionRecords.push({ student_id: s.student_id, from_class_id: s.from_class_id, to_class_id: s.to_class_id, promotion_date: new Date().toISOString(), batch_name: batchName });
            } else {
                await update('students', s.student_id, { status: 'Graduated', updated_at: new Date().toISOString() });
                graduated++;
                promotionRecords.push({ student_id: s.student_id, from_class_id: s.from_class_id, to_class_id: null, promotion_date: new Date().toISOString(), batch_name: batchName, graduated: true });
            }
        } catch (error) { console.error('Promotion error:', error); }
    }

    await insert('promotions', { batch_name: batchName, promotion_date: new Date().toISOString(), promoted_count: promoted, graduated_count: graduated, performed_by: user.id, details: JSON.stringify(promotionRecords) });
    await logActivity(user.id, user.role, `Executed promotion batch: ${batchName} (${promoted} promoted, ${graduated} graduated)`, 'promotion');
    showToast(`✅ Promotion complete! Promoted: ${promoted}, Graduated: ${graduated}`, 'success');
    closeModal('promotion-preview-full-modal');
    await refreshTable('students');
    await renderStudentPromotion(document.getElementById('dynamic-content'));
};

// Load promotion history
async function loadFullPromotionHistory() {
    let promotions = [];
    try { promotions = await getAll('promotions', { order: 'promotion_date.desc', limit: 20 }); } catch (e) { promotions = []; }
    const historyDiv = document.getElementById('promotion-history-list-full');
    if (!historyDiv) return;
    if (promotions.length === 0) { historyDiv.innerHTML = '<div class="alert alert-info">No promotion history found.</div>'; return; }
    historyDiv.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Batch Name</th><th>Promoted</th><th>Graduated</th><th>Performed By</th><th>Actions</th></tr></thead><tbody>${promotions.map(p => `<tr><td>${new Date(p.promotion_date).toLocaleDateString()}</span><td><strong>${esc(p.batch_name)}</strong></span><td>${p.promoted_count}</span><td>${p.graduated_count}</span><td>${(state.teachers || []).find(t => t.id === p.performed_by)?.name || 'Unknown'}</span><td>${!p.rolled_back ? `<button class="btn-sm btn-warning" onclick="rollbackFullPromotion(${p.id})">↩️ Rollback</button>` : '<span class="badge badge-neutral">Rolled back</span>'}</span>`).join('')}</tbody></table></div>`;
}

// Rollback promotion
window.rollbackFullPromotion = async function (promotionId) {
    if (!confirm('Rollback this promotion? Students will return to their previous classes. This action cannot be undone.')) return;
    let promotion;
    try { promotion = await getAll('promotions', { id: promotionId }); promotion = promotion[0]; } catch (e) { return; }
    if (!promotion) return;
    const details = JSON.parse(promotion.details);
    const user = getCurrentUser();
    for (const record of details) {
        await update('students', record.student_id, { class_id: record.from_class_id, status: 'Active', updated_at: new Date().toISOString() });
    }
    await update('promotions', promotionId, { rolled_back: true, rolled_back_by: user.id, rolled_back_at: new Date().toISOString() });
    await logActivity(user.id, user.role, `Rolled back promotion batch: ${promotion.batch_name}`, 'promotion', promotionId);
    showToast('✅ Promotion rolled back successfully', 'success');
    await loadFullPromotionHistory();
    await refreshTable('students');
};

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.students.length) await refreshTable('students');
    if (!state.academicYears.length) await refreshTable('academic_years');
}