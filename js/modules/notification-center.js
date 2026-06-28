// js/modules/notification-center.js
// Notification Center Module - Centralized notification management

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, fmtDateTime, fmtAgo, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getTeacherById } from './student-fees.js';

let _allNotifications = [];
let _notificationFilters = {
    type: 'all',
    read: 'all',
    search: ''
};

export async function renderNotificationCenter(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isAdmin = user?.role === 'admin';

    await loadAllNotifications();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🔔 Notification Center</span>
                <div class="btn-group">
                    ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="window.createSystemNotification()">➕ Create Notification</button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.markAllRead()">✅ Mark All as Read</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportNotifications()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="notif-type-filter" class="form-control" style="width:130px" onchange="window.filterNotifications()">
                        <option value="all">All Types</option>
                        <option value="system">🔧 System</option>
                        <option value="announcement">📢 Announcement</option>
                        <option value="payment">💰 Payment</option>
                        <option value="reminder">⏰ Reminder</option>
                    </select>
                    <select id="notif-status-filter" class="form-control" style="width:130px" onchange="window.filterNotifications()">
                        <option value="all">All Status</option>
                        <option value="unread">Unread</option>
                        <option value="read">Read</option>
                    </select>
                    <input type="text" id="notif-search" class="form-control flex-1" placeholder="🔍 Search notifications..." oninput="window.filterNotifications()">
                    <span class="result-count" id="notif-count"></span>
                </div>
                
                <div id="notifications-list" class="notifications-container">
                    <div class="loading-container"><div class="spinner"></div><p>Loading notifications...</p></div>
                </div>
            </div>
        </div>
    `;

    window.filterNotifications = filterNotifications;
    window.markAllRead = markAllRead;
    window.exportNotifications = exportNotifications;
    window.createSystemNotification = createSystemNotification;
    window.markNotificationRead = markNotificationRead;
    window.deleteNotification = deleteNotification;

    await renderNotificationsList();
}

async function loadAllNotifications() {
    _allNotifications = [];

    // Load announcements from DB
    try {
        const announcements = await getAll('announcements', { order: 'created_at.desc', limit: 100 });
        for (const ann of announcements) {
            _allNotifications.push({
                id: `ann_${ann.id}`,
                type: 'announcement',
                title: ann.title,
                message: ann.message,
                createdAt: ann.created_at,
                isRead: ann.is_read || false,
                recipients: ann.recipients,
                sourceId: ann.id
            });
        }
    } catch (e) { }

    // Load system notifications from localStorage
    const stored = localStorage.getItem('system_notifications');
    if (stored) {
        const sysNotifs = JSON.parse(stored);
        for (const notif of sysNotifs) {
            if (!_allNotifications.find(n => n.id === notif.id)) {
                _allNotifications.push({
                    ...notif,
                    type: 'system',
                    createdAt: notif.createdAt || new Date().toISOString()
                });
            }
        }
    }

    // Load payment reminders
    const overdueFees = state.studentFees.filter(f => !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < new Date());
    for (const fee of overdueFees.slice(0, 20)) {
        const student = getStudentById(fee.student_id);
        if (student) {
            _allNotifications.push({
                id: `payment_reminder_${fee.id}`,
                type: 'payment',
                title: 'Overdue Payment',
                message: `${student.first_name} ${student.last_name} has an overdue payment of ${fmtCurrency(fee.amount - (fee.paid_amount || 0))}`,
                createdAt: fee.due_date,
                isRead: false,
                sourceId: fee.id
            });
        }
    }

    _allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function filterNotifications() {
    const typeFilter = document.getElementById('notif-type-filter')?.value;
    const statusFilter = document.getElementById('notif-status-filter')?.value;
    const search = document.getElementById('notif-search')?.value.toLowerCase();

    let filtered = [..._allNotifications];

    if (typeFilter !== 'all') filtered = filtered.filter(n => n.type === typeFilter);
    if (statusFilter === 'unread') filtered = filtered.filter(n => !n.isRead);
    if (statusFilter === 'read') filtered = filtered.filter(n => n.isRead);
    if (search) filtered = filtered.filter(n =>
        n.title?.toLowerCase().includes(search) ||
        n.message?.toLowerCase().includes(search)
    );

    renderNotificationsList(filtered);
}

function renderNotificationsList(notifications = null) {
    const container = document.getElementById('notifications-list');
    const list = notifications || _allNotifications;
    const countSpan = document.getElementById('notif-count');

    if (countSpan) countSpan.textContent = `${list.length} notification${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">✨ No notifications to display</div>';
        return;
    }

    container.innerHTML = list.map(notif => {
        const typeIcon = getTypeIcon(notif.type);
        const typeClass = getTypeClass(notif.type);
        const isUnread = !notif.isRead;

        return `
            <div class="notification-item" style="
                border-left: 4px solid ${typeClass === 'danger' ? 'var(--danger)' : typeClass === 'warning' ? 'var(--warning)' : 'var(--info)'};
                padding: 16px;
                margin-bottom: 12px;
                background: ${isUnread ? 'var(--info-bg)' : 'var(--bg-secondary)'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            " onclick="window.markNotificationRead('${notif.id}')">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px">
                    <div style="display:flex; align-items:center; gap:8px">
                        <span style="font-size:1.2rem">${typeIcon}</span>
                        <span style="font-weight:700; font-size:1rem">${esc(notif.title)}</span>
                        <span class="badge ${typeClass === 'danger' ? 'badge-danger' : typeClass === 'warning' ? 'badge-warning' : 'badge-info'}">${notif.type}</span>
                        ${isUnread ? '<span class="badge badge-info" style="background:#3b82f6">📌 New</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px">
                        <span style="font-size:11px; color:var(--text-muted)">${fmtAgo(notif.createdAt)}</span>
                        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.deleteNotification('${notif.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px; white-space:pre-wrap">
                    ${esc(notif.message)}
                </div>
                <div style="font-size:11px; color:var(--text-muted)">
                    ${notif.createdAt ? fmtDateTime(notif.createdAt) : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getTypeIcon(type) {
    switch (type) {
        case 'system': return '🔧';
        case 'announcement': return '📢';
        case 'payment': return '💰';
        case 'reminder': return '⏰';
        default: return '📬';
    }
}

function getTypeClass(type) {
    switch (type) {
        case 'system': return 'info';
        case 'announcement': return 'primary';
        case 'payment': return 'warning';
        case 'reminder': return 'info';
        default: return 'info';
    }
}

function markNotificationRead(notificationId) {
    const notif = _allNotifications.find(n => n.id === notificationId);
    if (notif && !notif.isRead) {
        notif.isRead = true;

        // Update in localStorage if system notification
        if (notif.type === 'system') {
            const stored = JSON.parse(localStorage.getItem('system_notifications') || '[]');
            const updated = stored.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n);
            localStorage.setItem('system_notifications', JSON.stringify(updated));
        }

        // Update announcement in DB
        if (notif.type === 'announcement' && notif.sourceId) {
            update('announcements', notif.sourceId, { is_read: true, read_at: new Date().toISOString() }).catch(() => { });
        }

        filterNotifications();
        updateNotificationBadge();
    }
}

function markAllRead() {
    for (const notif of _allNotifications) {
        if (!notif.isRead) {
            notif.isRead = true;
        }
    }

    // Update localStorage
    const systemNotifs = _allNotifications.filter(n => n.type === 'system').map(n => ({
        id: n.id, title: n.title, message: n.message, createdAt: n.createdAt, isRead: true
    }));
    localStorage.setItem('system_notifications', JSON.stringify(systemNotifs));

    filterNotifications();
    updateNotificationBadge();
    showToast('✅ All notifications marked as read', 'success');
}

function deleteNotification(notificationId) {
    if (!confirm('Delete this notification?')) return;

    const index = _allNotifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
        _allNotifications.splice(index, 1);

        // Remove from localStorage if system notification
        const stored = JSON.parse(localStorage.getItem('system_notifications') || '[]');
        const updated = stored.filter(n => n.id !== notificationId);
        localStorage.setItem('system_notifications', JSON.stringify(updated));

        filterNotifications();
        showToast('✅ Notification deleted', 'success');
    }
}

function createSystemNotification() {
    const user = state.currentUser;
    if (user?.role !== 'admin') {
        showToast('Only administrators can create system notifications', 'error');
        return;
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📢 Create System Notification</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Title *</label>
                            <input type="text" id="sys-notif-title" class="form-control" placeholder="Notification title">
                        </div>
                        <div class="form-group full">
                            <label>Message *</label>
                            <textarea id="sys-notif-message" class="form-control" rows="4" placeholder="Notification message content..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>Notification Type</label>
                            <select id="sys-notif-type" class="form-control">
                                <option value="system">🔧 System</option>
                                <option value="reminder">⏰ Reminder</option>
                                <option value="payment">💰 Payment Alert</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Expires After (days)</label>
                            <input type="number" id="sys-notif-expiry" class="form-control" value="30" min="1" max="365">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveSystemNotification()">Create Notification</button>
                </div>
            </div>
        </div>
    `);

    window.saveSystemNotification = () => {
        const title = document.getElementById('sys-notif-title')?.value.trim();
        const message = document.getElementById('sys-notif-message')?.value.trim();
        const type = document.getElementById('sys-notif-type')?.value;
        const expiryDays = parseInt(document.getElementById('sys-notif-expiry')?.value) || 30;

        if (!title || !message) {
            showToast('Title and message are required', 'warning');
            return;
        }

        const newNotif = {
            id: `sys_${Date.now()}`,
            type: type,
            title: title,
            message: message,
            createdAt: new Date().toISOString(),
            isRead: false,
            expiryAt: new Date(Date.now() + expiryDays * 86400000).toISOString()
        };

        const stored = JSON.parse(localStorage.getItem('system_notifications') || '[]');
        stored.unshift(newNotif);
        localStorage.setItem('system_notifications', JSON.stringify(stored.slice(0, 100)));

        _allNotifications.unshift(newNotif);
        closeModal();
        filterNotifications();
        showToast('✅ System notification created', 'success');
    };
}

function exportNotifications() {
    const data = _allNotifications.map(n => ({
        'Date': fmtDateTime(n.createdAt),
        'Type': n.type,
        'Title': n.title,
        'Message': n.message,
        'Status': n.isRead ? 'Read' : 'Unread'
    }));

    exportToExcel(data, `Notifications_Export_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Notifications exported', 'success');
}

function updateNotificationBadge() {
    const unreadCount = _allNotifications.filter(n => !n.isRead).length;
    const badgeDot = document.getElementById('notif-dot');
    if (badgeDot) {
        if (unreadCount > 0) {
            badgeDot.style.display = 'block';
            badgeDot.title = `${unreadCount} unread notifications`;
        } else {
            badgeDot.style.display = 'none';
        }
    }
}