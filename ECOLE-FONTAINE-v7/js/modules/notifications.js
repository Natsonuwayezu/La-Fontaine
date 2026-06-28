// js/modules/notifications.js
// Notifications Module - System notifications and announcements

import { state } from '../core/state.js';
import { getAll, update, insert } from '../core/supabase-client.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtDate, fmtAgo, esc } from '../core/utils.js';
import { navigateTo } from '../core/router.js';
import { updateNotificationBadgeCount } from '../ui/notifications-ui.js';

let _unreadNotifications = [];
let _notificationCount = 0;

export async function renderNotifications(container) {
    await ensureStateLoaded();
    const user = state.currentUser;

    let announcements = [];
    try { announcements = await getAll('announcements'); } catch (e) { announcements = []; }
    announcements = announcements.filter(a => a.status !== 'draft');
    announcements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const unreadSystem = _unreadNotifications.filter(n => !n.read);
    const readSystem = _unreadNotifications.filter(n => n.read);
    const unreadCount = unreadSystem.length;

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🔔 Notifications <span class="badge badge-danger" style="font-size:12px">${unreadCount}</span></span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.markAllNotificationsAsRead()">✅ Mark All as Read</button>
                    <button class="btn btn-sm btn-danger" onclick="window.clearAllNotifications()">🗑️ Clear All</button>
                </div>
            </div>
            <div class="dash-card-body">
                ${unreadSystem.length > 0 ? `
                    <h4 style="margin-bottom:12px;">🔴 Unread (${unreadSystem.length})</h4>
                    ${unreadSystem.map(renderNotificationItem).join('')}
                ` : ''}
                ${readSystem.length > 0 ? `
                    <h4 style="margin-top:24px;margin-bottom:12px;">✅ Read</h4>
                    ${readSystem.map(renderNotificationItem).join('')}
                ` : ''}
                <h4 style="margin-top:${unreadSystem.length > 0 || readSystem.length > 0 ? '24px' : '0'};margin-bottom:12px;">📢 Announcements</h4>
                ${announcements.length ? announcements.map(renderAnnouncementItem).join('') : '<div class="alert alert-info">No announcements at this time.</div>'}
                ${unreadSystem.length === 0 && readSystem.length === 0 && announcements.length === 0 ?
            '<div class="alert alert-info">No notifications at this time.</div>' : ''}
            </div>
        </div>
    `;

    window.markAllNotificationsAsRead = markAllNotificationsAsRead;
    window.clearAllNotifications = clearAllNotifications;
    window.markNotificationAsRead = markNotificationAsRead;
}

function renderNotificationItem(notif) {
    const borderColor = notif.type === 'critical' ? 'var(--danger)' :
        notif.type === 'urgent' ? 'var(--danger)' :
            notif.type === 'warning' ? 'var(--warning)' :
                notif.type === 'reminder' ? 'var(--info)' : 'var(--success)';
    const bgColor = notif.read ? 'var(--bg-secondary)' : 'var(--info-bg)';

    return `
        <div style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:12px;background:${bgColor};border-radius:0 var(--r-md) var(--r-md) 0;box-shadow:var(--shadow-sm);cursor:pointer" onclick="window.markNotificationAsRead('${notif.id}'); if('${notif.action}') window.navigateTo('${notif.action}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span style="font-weight:700;font-size:14px">${notif.icon} ${esc(notif.title)}</span>
                <span style="font-size:11px;color:var(--text-muted)">${fmtAgo(notif.time)}</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${esc(notif.message)}</div>
            <div style="display:flex;gap:8px">
                <span class="badge ${notif.type === 'critical' ? 'badge-danger' : notif.type === 'warning' ? 'badge-warning' : 'badge-info'}">${notif.type || 'System'}</span>
                ${!notif.read ? '<span class="badge badge-info" style="background:#3b82f6;color:#fff;">📌 Unread</span>' : ''}
            </div>
        </div>
    `;
}

function renderAnnouncementItem(ann) {
    const typeIcon = ann.type === 'urgent' ? '⚠️' : ann.type === 'event' ? '📅' : '📢';
    const borderColor = ann.type === 'urgent' ? 'var(--danger)' : ann.type === 'event' ? 'var(--info)' : 'var(--success)';

    return `
        <div style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:12px;background:var(--bg-secondary);border-radius:0 var(--r-md) var(--r-md) 0;box-shadow:var(--shadow-sm)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span style="font-weight:700;font-size:14px">${typeIcon} ${esc(ann.title)}</span>
                <span style="font-size:11px;color:var(--text-muted)">${fmtDate(ann.created_at)}</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;margin-bottom:8px">${esc(ann.message || '')}</div>
            <div style="margin-top:8px;display:flex;gap:8px">
                <span class="badge ${ann.type === 'urgent' ? 'badge-danger' : ann.type === 'event' ? 'badge-info' : 'badge-success'}">📢 Announcement</span>
                <span style="font-size:11px;color:var(--text-muted)">To: ${esc(ann.recipients === 'all' ? 'All Users' : ann.recipients)}</span>
            </div>
        </div>
    `;
}

export function initNotifications() {
    loadNotifications();
    setInterval(checkForNewNotifications, 30000);
}

function loadNotifications() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const stored = localStorage.getItem(`notifications_${currentUser.id}`);
    if (stored) {
        _unreadNotifications = JSON.parse(stored);
        _notificationCount = _unreadNotifications.filter(n => !n.read).length;
        updateNotificationBadge();
    }
    checkSystemNotifications();
}

async function checkSystemNotifications() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date();
    const newNotifications = [];

    if (currentUser.role === 'admin') {
        const overdueFees = state.studentFees.filter(f =>
            !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
        );
        if (overdueFees.length > 0 && !hasNotification('overdue_payments')) {
            newNotifications.push({
                id: 'overdue_payments', type: 'critical', icon: '⚠️',
                title: 'Overdue Payments',
                message: `${overdueFees.length} student fee payments are overdue.`,
                action: 'overdue-payments', time: new Date().toISOString(),
                read: false, role: 'admin'
            });
        }
    } else if (currentUser.role === 'accountant') {
        const overdueFees = state.studentFees.filter(f =>
            !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
        );
        if (overdueFees.length > 0 && !hasNotification('overdue_payments_acc')) {
            newNotifications.push({
                id: 'overdue_payments_acc', type: 'critical', icon: '🔴',
                title: 'Overdue Payments Alert',
                message: `There are ${overdueFees.length} overdue fee payments requiring attention.`,
                action: 'overdue-payments', time: new Date().toISOString(),
                read: false, role: 'accountant'
            });
        }
    } else if (currentUser.role === 'teacher') {
        const assignments = await getAll('teacher_assignments', { teacher_id: currentUser.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        let pendingCount = 0;
        for (const classId of classIds) {
            const assessments = state.assessments.filter(a =>
                a.class_id === classId && a.term_id === state.currentTerm?.id && !a.is_locked
            );
            for (const assessment of assessments) {
                const expected = state.students.filter(s => s.class_id === classId && s.status === 'Active').length;
                const entered = state.marks.filter(m => m.assessment_id === assessment.id).length;
                pendingCount += (expected - entered);
            }
        }
        if (pendingCount > 0 && !hasNotification('pending_marks')) {
            newNotifications.push({
                id: 'pending_marks', type: 'reminder', icon: '📝',
                title: 'Pending Marks Entry',
                message: `You have ${pendingCount} marks pending entry across your classes.`,
                action: 'marks-entry', time: new Date().toISOString(),
                read: false, role: 'teacher'
            });
        }
    }

    for (const notif of newNotifications) {
        if (!_unreadNotifications.find(n => n.id === notif.id)) {
            _unreadNotifications.unshift(notif);
        }
    }

    const loggedInUser = getCurrentUser();
    if (loggedInUser) {
        localStorage.setItem(`notifications_${loggedInUser.id}`, JSON.stringify(_unreadNotifications));
    }
    updateNotificationBadge();
}

function hasNotification(notificationId) {
    return _unreadNotifications.some(n => n.id === notificationId && !n.read);
}

function updateNotificationBadge() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const stored = localStorage.getItem(`notifications_${currentUser.id}`);
    if (stored) {
        _unreadNotifications = JSON.parse(stored);
        _notificationCount = _unreadNotifications.filter(n => !n.read).length;
    }

    updateNotificationBadgeCount(_notificationCount);
}

function markNotificationAsRead(notificationId) {
    const user = getCurrentUser();
    if (!user) return;

    const notification = _unreadNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
    }

    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
    updateNotificationBadge();

    const contentDiv = document.getElementById('dynamic-content');
    if (contentDiv && contentDiv.innerHTML.includes('notifications-module')) {
        renderNotifications(contentDiv);
    }
}

function markAllNotificationsAsRead() {
    const user = getCurrentUser();
    if (!user) return;

    for (const notif of _unreadNotifications) {
        notif.read = true;
        notif.readAt = new Date().toISOString();
    }

    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
    updateNotificationBadge();

    const contentDiv = document.getElementById('dynamic-content');
    if (contentDiv && contentDiv.innerHTML.includes('notifications-module')) {
        renderNotifications(contentDiv);
    }

    showToast('All notifications marked as read', 'success');
}

function clearAllNotifications() {
    const user = getCurrentUser();
    if (!user) return;

    if (confirm('Delete all notifications? This action cannot be undone.')) {
        _unreadNotifications = [];
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
        updateNotificationBadge();

        const contentDiv = document.getElementById('dynamic-content');
        if (contentDiv && contentDiv.innerHTML.includes('notifications-module')) {
            renderNotifications(contentDiv);
        }

        showToast('All notifications cleared', 'success');
    }
}

async function checkForNewNotifications() {
    await checkSystemNotifications();
}

export function startNotificationWatcher() {
    initNotifications();
    setInterval(updateNotificationBadge, 60000);
}

function getCurrentUser() {
    return state.currentUser;
}

async function ensureStateLoaded() {
    if (!state.teachers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}