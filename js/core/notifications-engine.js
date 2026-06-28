// ============================================================
// NOTIFICATIONS ENGINE - Core notification system
// ============================================================

import { state } from './state.js';
import { getAll, insert, update, remove } from './supabase-client.js';
import { showToast } from './helpers.js';
import { info, error as logError } from './logger.js';
import { getCurrentUser } from './auth.js';
import { refreshTable } from './data-loader.js';

// Global notification state
let _unreadNotifications = [];
let _notificationCount = 0;

// Initialize notification system
export async function initNotifications() {
    await loadNotifications();
    // Check for new notifications every 30 seconds
    setInterval(checkForNewNotifications, 30000);
}

// Load notifications from storage
export async function loadNotifications() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const stored = localStorage.getItem(`notifications_${currentUser.id}`);
    if (stored) {
        _unreadNotifications = JSON.parse(stored);
        _notificationCount = _unreadNotifications.filter(n => !n.read).length;
        updateNotificationBadge();
    }

    // Also check for system notifications
    await checkSystemNotifications();
}

// Check system notifications based on role
export async function checkSystemNotifications() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const today = new Date();
    const newNotifications = [];

    if (currentUser.role === 'admin') {
        // Check overdue payments
        const overdueFees = (state.studentFees || []).filter(f =>
            !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
        );
        if (overdueFees.length > 0 && !hasNotification('overdue_payments')) {
            newNotifications.push({
                id: 'overdue_payments',
                type: 'critical',
                icon: '⚠️',
                title: 'Overdue Payments',
                message: `${overdueFees.length} student fee payments are overdue.`,
                action: 'overdue-payments',
                time: new Date().toISOString(),
                read: false,
                role: 'admin'
            });
        }

        // Check recent marks activity
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        const recentMarks = (state.marks || []).filter(m => new Date(m.created_at) >= weekAgo).length;
        if (recentMarks > 0 && !hasNotification('recent_marks')) {
            newNotifications.push({
                id: 'recent_marks',
                type: 'info',
                icon: '📝',
                title: 'Marks Entry Activity',
                message: `${recentMarks} marks have been entered in the past week.`,
                action: 'marks-database',
                time: new Date().toISOString(),
                read: false,
                role: 'admin'
            });
        }
    } else if (currentUser.role === 'accountant') {
        // Check overdue payments for accountant
        const overdueFees = (state.studentFees || []).filter(f =>
            !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
        );
        if (overdueFees.length > 0 && !hasNotification('overdue_payments_acc')) {
            newNotifications.push({
                id: 'overdue_payments_acc',
                type: 'critical',
                icon: '🔴',
                title: 'Overdue Payments Alert',
                message: `There are ${overdueFees.length} overdue fee payments requiring attention.`,
                action: 'overdue-payments',
                time: new Date().toISOString(),
                read: false,
                role: 'accountant'
            });
        }

        // Check upcoming payment deadlines (3 days)
        const threeDaysFromNow = new Date(Date.now() + 3 * 86400000);
        const upcomingDeadlines = (state.studentFees || []).filter(f =>
            !f.is_paid && !f.is_waived && f.due_date &&
            new Date(f.due_date) <= threeDaysFromNow && new Date(f.due_date) >= today
        );
        if (upcomingDeadlines.length > 0 && !hasNotification('upcoming_deadlines')) {
            newNotifications.push({
                id: 'upcoming_deadlines',
                type: 'warning',
                icon: '⏰',
                title: 'Upcoming Payment Deadlines',
                message: `${upcomingDeadlines.length} payments are due in the next 3 days.`,
                action: 'overdue-payments',
                time: new Date().toISOString(),
                read: false,
                role: 'accountant'
            });
        }
    } else if (currentUser.role === 'teacher') {
        // Get teacher's assigned classes
        const assignments = await getAll('teacher_assignments', { teacher_id: currentUser.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];

        // Check pending marks entry
        let pendingCount = 0;
        for (const classId of classIds) {
            const assessments = (state.assessments || []).filter(a =>
                a.class_id === classId && a.term_id === state.currentTerm?.id && !a.is_locked
            );
            for (const assessment of assessments) {
                const expected = (state.students || []).filter(s => s.class_id === classId && s.status === 'Active').length;
                const entered = (state.marks || []).filter(m => m.assessment_id === assessment.id).length;
                pendingCount += (expected - entered);
            }
        }

        if (pendingCount > 0 && !hasNotification('pending_marks')) {
            newNotifications.push({
                id: 'pending_marks',
                type: 'reminder',
                icon: '📝',
                title: 'Pending Marks Entry',
                message: `You have ${pendingCount} marks pending entry across your classes.`,
                action: 'marks-entry',
                time: new Date().toISOString(),
                read: false,
                role: 'teacher'
            });
        }

        // Check upcoming assessments due today/tomorrow
        const tomorrow = new Date(Date.now() + 1 * 86400000);
        const upcomingAssessments = (state.assessments || []).filter(a =>
            a.due_date && new Date(a.due_date) <= tomorrow && new Date(a.due_date) >= today &&
            classIds.includes(a.class_id) && !a.is_locked
        );
        if (upcomingAssessments.length > 0 && !hasNotification('upcoming_assessments')) {
            newNotifications.push({
                id: 'upcoming_assessments',
                type: 'urgent',
                icon: '⚠️',
                title: 'Assessment Deadlines Approaching',
                message: `${upcomingAssessments.length} assessments are due today or tomorrow.`,
                action: 'marks-entry',
                time: new Date().toISOString(),
                read: false,
                role: 'teacher'
            });
        }
    }

    // Add new notifications
    for (const notif of newNotifications) {
        if (!_unreadNotifications.find(n => n.id === notif.id)) {
            _unreadNotifications.unshift(notif);
        }
    }

    // Save to storage
    const loggedInUser = getCurrentUser();
    if (loggedInUser) {
        localStorage.setItem(`notifications_${loggedInUser.id}`, JSON.stringify(_unreadNotifications));
    }
    updateNotificationBadge();
}

// Check if a notification already exists
function hasNotification(notificationId) {
    return _unreadNotifications.some(n => n.id === notificationId && !n.read);
}

// Update notification badge in UI
export function updateNotificationBadge() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const stored = localStorage.getItem(`notifications_${currentUser.id}`);
    if (stored) {
        _unreadNotifications = JSON.parse(stored);
        _notificationCount = _unreadNotifications.filter(n => !n.read).length;
    }

    const badgeDot = document.getElementById('notif-dot');
    if (badgeDot) {
        if (_notificationCount > 0) {
            badgeDot.style.display = 'block';
            badgeDot.setAttribute('title', `${_notificationCount} unread notifications`);
        } else {
            badgeDot.style.display = 'none';
        }
    }
}

// Mark a single notification as read
export function markNotificationAsRead(notificationId) {
    const user = getCurrentUser();
    if (!user) return;

    const notification = _unreadNotifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
    }

    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
    updateNotificationBadge();

    // Refresh notifications page if open
    const contentDiv = document.getElementById('dynamic-content');
    if (contentDiv && contentDiv.innerHTML.includes('notifications-module')) {
        if (window.renderNotifications) {
            window.renderNotifications(contentDiv);
        }
    }
}

// Mark all notifications as read
export function markAllNotificationsAsRead() {
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
        if (window.renderNotifications) {
            window.renderNotifications(contentDiv);
        }
    }

    showToast('All notifications marked as read', 'success');
}

// Clear all notifications
export function clearAllNotifications() {
    const user = getCurrentUser();
    if (!user) return;

    if (confirm('Delete all notifications? This action cannot be undone.')) {
        _unreadNotifications = [];
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
        updateNotificationBadge();

        const contentDiv = document.getElementById('dynamic-content');
        if (contentDiv && contentDiv.innerHTML.includes('notifications-module')) {
            if (window.renderNotifications) {
                window.renderNotifications(contentDiv);
            }
        }

        showToast('All notifications cleared', 'success');
    }
}

// Check for new notifications (called periodically)
async function checkForNewNotifications() {
    await checkSystemNotifications();
}

// Create a custom notification
export async function createNotification(notification) {
    const newNotif = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        ...notification,
        time: new Date().toISOString(),
        read: false
    };

    _unreadNotifications.unshift(newNotif);

    const user = getCurrentUser();
    if (user) {
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(_unreadNotifications));
    }

    updateNotificationBadge();
    return newNotif;
}