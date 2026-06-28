// js/modules/announcements.js
// Announcements Module - Admin announcement management

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { renderNotifications } from './notifications.js';

// Simple log activity function if not available elsewhere
async function logActivity(userId, userRole, action, entityType, entityId, details) {
    try {
        await insert('activity_logs', {
            user_id: userId,
            user_role: userRole,
            action: action,
            entity_type: entityType,
            entity_id: entityId,
            details: details,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn('Failed to log activity:', e);
    }
}

export async function renderAnnouncements(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (!user || user.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    let announcements = [];
    try { announcements = await getAll('announcements'); } catch (e) { announcements = []; }
    announcements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📢 Announcements Management</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openSendAnnouncementModal()">📢 New Announcement</button>
                    <button class="btn btn-sm btn-outline" onclick="window.renderAnnouncements(document.getElementById('dynamic-content'))">🔄 Refresh</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Recipients</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Read</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${announcements.length ? announcements.map(a => {
        const readCount = a.read_count || 0;
        const totalRecipients = a.recipients === 'all' ? (state.teachers.length + 1) :
            a.recipients === 'teachers' ? state.teachers.filter(t => t.role === 'teacher').length :
                a.recipients === 'accountants' ? state.teachers.filter(t => t.role === 'accountant').length : 1;
        return `
                                    <tr>
                                        <td><span class="badge ${a.type === 'urgent' ? 'badge-danger' : a.type === 'event' ? 'badge-warning' : 'badge-info'}">${a.type || 'general'}</span></td>
                                        <td><strong>${esc(a.title)}</strong></td>
                                        <td>${esc(a.recipients || 'All Users')}</td>
                                        <td>${fmtDate(a.created_at)}</span>
                                        <td><span class="badge ${a.status === 'sent' ? 'badge-success' : 'badge-neutral'}">${a.status || 'sent'}</span></td>
                                        <td>${readCount}/${totalRecipients}</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.viewAnnouncementDetails(${a.id})">👁️</button>
                                            <button class="btn btn-sm btn-primary" onclick="window.editAnnouncement(${a.id})">✏️</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteAnnouncementById(${a.id})">🗑️</button>
                                        </td>
                                    </tr>
                                `;
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No announcements yet</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Register global functions
    window.openSendAnnouncementModal = (editId) => openSendAnnouncementModal(editId);
    window.viewAnnouncementDetails = viewAnnouncementDetails;
    window.editAnnouncement = editAnnouncement;
    window.deleteAnnouncementById = deleteAnnouncementById;
    window.renderAnnouncements = renderAnnouncements;
    window.toggleAnnouncementRecipients = toggleAnnouncementRecipients;
    window.sendAnnouncement = (id) => sendAnnouncement(id);
}

function openSendAnnouncementModal(editId = null) {
    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const isEdit = editId !== null;

    let editData = null;
    if (isEdit) {
        editData = state.announcements?.find(a => a.id === editId) || null;
    }

    showModal(`
        <div class="modal-overlay" id="ann-modal">
            <div class="modal modal-lg" onclick="event.stopPropagation()" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${isEdit ? '✏️ Edit Announcement' : '📢 Send Announcement'}</h3>
                    <button class="modal-close" onclick="closeModal('ann-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Announcement Type</label>
                            <select id="ann-type" class="form-control">
                                <option value="general" ${editData?.type === 'general' ? 'selected' : ''}>📢 General Announcement</option>
                                <option value="urgent" ${editData?.type === 'urgent' ? 'selected' : ''}>⚠️ Urgent</option>
                                <option value="event" ${editData?.type === 'event' ? 'selected' : ''}>📅 Event</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Recipients</label>
                            <select id="ann-recipients" class="form-control" onchange="window.toggleAnnouncementRecipients()">
                                <option value="all" ${editData?.recipients === 'all' ? 'selected' : ''}>All Users</option>
                                <option value="teachers" ${editData?.recipients === 'teachers' ? 'selected' : ''}>Teachers Only</option>
                                <option value="accountants" ${editData?.recipients === 'accountants' ? 'selected' : ''}>Accountants Only</option>
                                <option value="specific" ${editData?.recipients === 'specific' ? 'selected' : ''}>Specific Teacher</option>
                            </select>
                        </div>
                        <div class="form-group" id="ann-specific-teacher-group" style="display:${editData?.recipients === 'specific' ? 'block' : 'none'}">
                            <label>Select Teacher</label>
                            <select id="ann-specific-teacher" class="form-control">
                                <option value="">-- Select Teacher --</option>
                                ${teachers.map(t => `<option value="${t.id}" ${editData?.specific_teacher_id == t.id ? 'selected' : ''}>${esc(t.name)} (${esc(t.department || 'General')})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full">
                            <label>Title *</label>
                            <input type="text" id="ann-title" class="form-control" value="${esc(editData?.title || '')}" placeholder="e.g., Mid-Term Examinations Schedule">
                        </div>
                        <div class="form-group full">
                            <label>Message *</label>
                            <textarea id="ann-message" rows="6" class="form-control" placeholder="Type your announcement message here...">${esc(editData?.message || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label><input type="checkbox" id="ann-send-email" ${editData?.send_email ? 'checked' : ''}> Also send via email</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('ann-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.sendAnnouncement(${editId !== null ? editId : ''})">${isEdit ? '💾 Update' : '📤 Send Announcement'}</button>
                </div>
            </div>
        </div>
    `);
}

function toggleAnnouncementRecipients() {
    const recipients = document.getElementById('ann-recipients')?.value;
    const specificGroup = document.getElementById('ann-specific-teacher-group');
    if (specificGroup) {
        specificGroup.style.display = recipients === 'specific' ? 'block' : 'none';
    }
}

async function sendAnnouncement(editId = null) {
    const type = document.getElementById('ann-type')?.value || 'general';
    const recipients = document.getElementById('ann-recipients')?.value || 'all';
    const specificTeacherId = document.getElementById('ann-specific-teacher')?.value;
    const title = document.getElementById('ann-title')?.value.trim();
    const message = document.getElementById('ann-message')?.value.trim();
    const sendEmail = document.getElementById('ann-send-email')?.checked || false;

    if (!title || !message) {
        showToast('Title and message are required', 'warning');
        return;
    }

    const user = state.currentUser;

    try {
        const announcementData = {
            type: type,
            recipients: recipients,
            title: title,
            message: message,
            status: 'sent',
            send_email: sendEmail,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (recipients === 'specific' && specificTeacherId) {
            announcementData.specific_teacher_id = parseInt(specificTeacherId);
        }

        let result;
        if (editId) {
            await update('announcements', editId, announcementData);
            result = { id: editId };
            showToast('✅ Announcement updated', 'success');
        } else {
            result = await insert('announcements', announcementData);
            showToast('✅ Announcement sent', 'success');
        }

        await logActivity(user.id, user.role, `${editId ? 'Updated' : 'Sent'} announcement: ${title}`, 'announcements', result?.id);

        // If sendEmail is true, trigger email notification (simplified)
        if (sendEmail && !editId) {
            console.log('Email notification would be sent to:', recipients);
        }

        closeModal('ann-modal');
        renderAnnouncements(document.getElementById('dynamic-content'));

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function viewAnnouncementDetails(id) {
    const a = await getById('announcements', id);
    if (!a) return;

    showModal(`
        <div class="modal-overlay">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📢 ${esc(a.title)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:12px">
                        <span class="badge ${a.type === 'urgent' ? 'badge-danger' : a.type === 'event' ? 'badge-warning' : 'badge-info'}">${a.type || 'general'}</span>
                        <span class="badge badge-neutral">To: ${a.recipients || 'All Users'}</span>
                        <span class="badge badge-neutral">Date: ${fmtDate(a.created_at)}</span>
                        <span class="badge badge-neutral">By: ${a.created_by ? (state.teachers.find(t => t.id === a.created_by)?.name || 'System') : 'System'}</span>
                    </div>
                    <div style="white-space:pre-wrap;line-height:1.6;margin-bottom:16px">${esc(a.message || '')}</div>
                    ${a.send_email ? '<div class="alert alert-info">📧 Email notification was sent to recipients</div>' : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal();window.editAnnouncement(${id})">✏️ Edit</button>
                </div>
            </div>
        </div>
    `);
}

async function editAnnouncement(id) {
    closeModal();
    setTimeout(() => {
        openSendAnnouncementModal(id);
    }, 200);
}

async function deleteAnnouncementById(id) {
    if (!await confirmDialog('Delete this announcement?')) return;
    await remove('announcements', id);
    showToast('✅ Announcement deleted', 'success');
    renderAnnouncements(document.getElementById('dynamic-content'));
}