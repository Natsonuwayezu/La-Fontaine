// ============================================================
// STUDENT ARCHIVE MODULE - Manage archived/deleted students
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin } from '../core/auth.js';
import { fmtDate, esc } from '../core/utils.js';
import { update, remove, insert } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast, confirmDialog } from '../ui/modals.js';

// Render Student Archive page
export async function renderStudentArchive(container) {
    if (!isAdmin()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    await ensureStateLoaded();

    const archived = (state.students || []).filter(s => s.is_deleted || s.status === 'Graduated' || s.status === 'Transferred');
    const inactiveStudents = (state.students || []).filter(s => s.status === 'Inactive' && !s.is_deleted);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const autoArchiveCandidates = inactiveStudents.filter(s => new Date(s.updated_at || s.created_at) < oneYearAgo);

    let archivedHtml = '';
    if (archived.length) {
        for (const s of archived) {
            const cls = getClassById(s.class_id);
            archivedHtml += `<tr>
                <td><strong>${esc(s.first_name + ' ' + s.last_name)}</strong></td>
                <td><span class="badge badge-neutral">${esc(s.status)}</span></td>
                <td>${esc(cls?.name || '—')}</td>
                <td>${fmtDate(s.updated_at || s.created_at)}</span>
                <td><button class="btn btn-sm btn-success" onclick="restoreStudentFull(${s.id})">♻️ Restore</button>
                    <button class="btn btn-sm btn-warning" onclick="window.openTransferModal(${s.id})">📤 Transfer</button>
                    <button class="btn btn-sm btn-danger" onclick="permanentlyDeleteStudent(${s.id})">🗑️ Permanently Delete</button>
                </td>
            </tr>`;
        }
    } else {
        archivedHtml = `<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">Archive is empty</span></tr>`;
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📦 Student Archive</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-warning" onclick="runAutoArchive()">🔄 Run Auto-Archive Now</button>
                </div>
            </div>
            <div class="dash-card-body">
                ${autoArchiveCandidates.length > 0 ? `<div class="alert alert-info">⚠️ ${autoArchiveCandidates.length} students have been inactive for over 1 year and are ready for archiving. <button class="btn btn-sm btn-primary" onclick="runAutoArchive()">Archive Now</button></div>` : ''}
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Name</th><th>Status</th><th>Class (Last)</th><th>Last Active</th><th>Action</th></tr></thead>
                        <tbody>${archivedHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Run auto-archive (archive inactive students older than 1 year)
window.runAutoArchive = async function () {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const candidates = (state.students || []).filter(s => s.status === 'Inactive' && !s.is_deleted && new Date(s.updated_at || s.created_at) < oneYearAgo);
    let archived = 0;
    for (const s of candidates) {
        await update('students', s.id, { is_deleted: true, archived_at: new Date().toISOString() });
        try {
            await insert('student_archive', {
                original_student_id: s.id, student_code: s.student_code,
                first_name: s.first_name, last_name: s.last_name,
                class_name: getClassById(s.class_id)?.name,
                archived_date: new Date().toISOString().split('T')[0],
                archived_reason: 'Auto-archived after 1 year of inactivity',
                original_data: JSON.stringify(s)
            });
        } catch (e) { }
        archived++;
    }
    await refreshTable('students');
    showToast(`✅ Auto-archived ${archived} inactive students`, 'success');
    renderStudentArchive(document.getElementById('dynamic-content'));
};

// Restore student from archive
window.restoreStudentFull = async function (id) {
    await update('students', id, { is_deleted: false, status: 'Active', updated_at: new Date().toISOString() });
    await refreshTable('students');
    showToast('✅ Student restored', 'success');
    renderStudentArchive(document.getElementById('dynamic-content'));
};

// Permanently delete student
window.permanentlyDeleteStudent = async function (id) {
    if (!await confirmDialog('⚠️ WARNING: This will permanently delete the student record. This action CANNOT be undone! Continue?')) return;
    await remove('students', id);
    await refreshTable('students');
    showToast('✅ Student permanently deleted', 'success');
    renderStudentArchive(document.getElementById('dynamic-content'));
};

// Ensure state is loaded
async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.students.length) await refreshTable('students');
}


// Transfer/Withdrawal workflow
window.openTransferModal = async function(studentId) {
    const { showModal, closeModal, showToast } = await import('../ui/modals.js');
    const { esc } = await import('../core/utils.js');
    const { getStudentById } = await import('../core/state.js');
    const s = getStudentById(studentId);
    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-sm">
                <div class="modal-header">
                    <h3>📤 Transfer / Withdrawal</h3>
                    <button class="modal-close" onclick="window.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom:12px">Student: <strong>${s ? esc(s.first_name + ' ' + s.last_name) : studentId}</strong></p>
                    <div class="form-group">
                        <label>Type *</label>
                        <select id="tx-type" class="form-control">
                            <option value="Transfer">Transfer to another school</option>
                            <option value="Withdrawal">Withdrawal (family request)</option>
                            <option value="Graduated">Graduated / Completed</option>
                            <option value="Expelled">Expelled</option>
                            <option value="Deceased">Deceased</option>
                        </select>
                    </div>
                    <div class="form-group" id="tx-dest-group">
                        <label>Destination School (if Transfer)</label>
                        <input type="text" id="tx-destination" class="form-control" placeholder="School name">
                    </div>
                    <div class="form-group">
                        <label>Exit Date *</label>
                        <input type="date" id="tx-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label>Reason / Notes</label>
                        <textarea id="tx-notes" class="form-control" rows="2" placeholder="Optional details"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Fee Reconciliation</label>
                        <select id="tx-fees" class="form-control">
                            <option value="waive_unpaid">Waive all unpaid fees</option>
                            <option value="keep">Keep unpaid fees as outstanding</option>
                            <option value="mark_settled">Mark all as settled</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-warning" onclick="window.processTransfer(${studentId})">📤 Process Transfer</button>
                </div>
            </div>
        </div>`);
    document.getElementById('tx-type').addEventListener('change', () => {
        document.getElementById('tx-dest-group').style.display =
            document.getElementById('tx-type').value === 'Transfer' ? 'block' : 'none';
    });
};

window.processTransfer = async function(studentId) {
    const { showToast, closeModal, confirmDialog } = await import('../ui/modals.js');
    const { update, insert } = await import('../core/supabase-client.js');
    const { refreshTable } = await import('../core/data-loader.js');
    const { state } = await import('../core/state.js');
    const type = document.getElementById('tx-type')?.value;
    const destination = document.getElementById('tx-destination')?.value || null;
    const exitDate = document.getElementById('tx-date')?.value;
    const notes = document.getElementById('tx-notes')?.value || null;
    const feeAction = document.getElementById('tx-fees')?.value;
    if (!exitDate) { showToast('Exit date is required', 'warning'); return; }
    if (!await confirmDialog('Process this transfer/withdrawal? This will archive the student.')) return;
    await update('students', studentId, {
        status: type, is_deleted: true, archived_at: exitDate,
        transfer_destination: destination, transfer_notes: notes,
        updated_at: new Date().toISOString()
    });
    const unpaid = (state.studentFees || []).filter(f => f.student_id === studentId && !f.is_paid && !f.is_waived);
    for (const fee of unpaid) {
        if (feeAction === 'waive_unpaid') {
            await update('student_fees', fee.id, { is_waived: true, waiver_reason: `${type} on ${exitDate}` });
        } else if (feeAction === 'mark_settled') {
            await update('student_fees', fee.id, { is_paid: true, paid_amount: fee.amount });
        }
    }
    try {
        await insert('student_archive', {
            original_student_id: studentId, archived_date: exitDate,
            archived_reason: `${type}${destination ? ' to ' + destination : ''}`,
            notes: notes, created_at: new Date().toISOString()
        });
    } catch(_e) {}
    await refreshTable('students'); await refreshTable('student_fees');
    closeModal();
    showToast(`✅ Student ${type.toLowerCase()} processed`, 'success');
    renderStudentArchive(document.getElementById('dynamic-content'));
};
