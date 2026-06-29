// ============================================================
// NOTIFICATIONS UI - Notification center and announcement display
// ============================================================


// Render notification item
function renderNotificationItem(notification, onRead, onDismiss) {
    const typeIcons = {
        critical: '🔴',
        urgent: '⚠️',
        warning: '🟡',
        reminder: '📝',
        info: 'ℹ️',
        success: '✅'
    };

    const borderColors = {
        critical: 'var(--danger)',
        urgent: 'var(--danger)',
        warning: 'var(--warning)',
        reminder: 'var(--info)',
        info: 'var(--info)',
        success: 'var(--success)'
    };

    const icon = typeIcons[notification.type] || '🔔';
    const borderColor = borderColors[notification.type] || 'var(--info)';
    const isUnread = !notification.read;

    const item = document.createElement('div');
    item.className = `notification-item ${isUnread ? 'unread' : ''}`;
    item.style.borderLeft = `4px solid ${borderColor}`;
    item.style.cursor = 'pointer';

    item.innerHTML = `
        <div class="notification-header">
            <div class="notification-icon">${icon}</div>
            <div class="notification-title">${escapeHtml(notification.title)}</div>
            <div class="notification-time">${formatAgo(notification.time)}</div>
        </div>
        <div class="notification-body" style="display: none;">
            ${escapeHtml(notification.message)}
        </div>
        <div class="notification-actions" style="display: none;">
            ${!notification.read ? `<button class="btn btn-sm btn-outline mark-read-btn">✅ Mark as Read</button>` : ''}
            <button class="btn btn-sm btn-outline dismiss-btn">🗑️ Dismiss</button>
            ${notification.action ? `<button class="btn btn-sm btn-primary action-btn">👁️ View</button>` : ''}
        </div>
    `;

    // Toggle expand/collapse
    const header = item.querySelector('.notification-header');
    const body = item.querySelector('.notification-body');
    const actions = item.querySelector('.notification-actions');

    header.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = body.style.display === 'block';
        body.style.display = isVisible ? 'none' : 'block';
        actions.style.display = isVisible ? 'none' : 'flex';
    });

    // Mark as read button
    const markReadBtn = item.querySelector('.mark-read-btn');
    if (markReadBtn && onRead) {
        markReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onRead(notification);
            item.classList.remove('unread');
            body.style.display = 'none';
            actions.style.display = 'none';
        });
    }

    // Dismiss button
    const dismissBtn = item.querySelector('.dismiss-btn');
    if (dismissBtn && onDismiss) {
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onDismiss(notification);
            item.remove();
        });
    }

    // Action button
    const actionBtn = item.querySelector('.action-btn');
    if (actionBtn && notification.action) {
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.navigateTo) {
                window.navigateTo(notification.action);
            }
            if (onRead) onRead(notification);
        });
    }

    return item;
}

// Render announcement item
function renderAnnouncementItem(announcement) {
    const typeIcons = {
        urgent: '⚠️',
        event: '📅',
        general: '📢'
    };

    const borderColors = {
        urgent: 'var(--danger)',
        event: 'var(--info)',
        general: 'var(--success)'
    };

    const icon = typeIcons[announcement.type] || '📢';
    const borderColor = borderColors[announcement.type] || 'var(--success)';

    const item = document.createElement('div');
    item.className = 'announcement-item';
    item.style.borderLeft = `4px solid ${borderColor}`;
    item.style.marginBottom = '12px';
    item.style.padding = '12px 16px';
    item.style.background = 'var(--bg-secondary)';
    item.style.borderRadius = '0 var(--r-md) var(--r-md) 0';
    item.style.boxShadow = 'var(--shadow-sm)';

    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <span style="font-weight: 700; font-size: 14px;">${icon} ${escapeHtml(announcement.title)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">${formatDate(announcement.created_at)}</span>
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); white-space: pre-wrap; margin-bottom: 8px;">
            ${escapeHtml(announcement.message)}
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge ${announcement.type === 'urgent' ? 'badge-danger' : announcement.type === 'event' ? 'badge-info' : 'badge-success'}">
                ${announcement.type || 'general'}
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">To: ${announcement.recipients === 'all' ? 'All Users' : announcement.recipients}</span>
        </div>
    `;

    return item;
}

// Show notifications modal
function showNotificationsModal(notifications, announcements, onMarkRead, onMarkAllRead, onClearAll) {
    const unreadCount = notifications.filter(n => !n.read).length;

    const modalHtml = `
        <div class="modal-overlay" id="notifications-modal">
            <div class="modal modal-lg" style="max-width: 550px;" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>🔔 Notifications <span class="badge badge-danger" style="font-size: 12px;">${unreadCount}</span></h3>
                    <button class="modal-close" onclick="closeModal('notifications-modal')">✕</button>
                </div>
                <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                    <div id="notifications-list"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-sm btn-outline" id="mark-all-read-btn">✅ Mark All as Read</button>
                    <button class="btn btn-sm btn-outline" id="clear-all-btn">🗑️ Clear All</button>
                    <button class="btn btn-sm btn-outline" onclick="closeModal('notifications-modal')">Close</button>
                </div>
            </div>
        </div>
    `;

    showModal(modalHtml);

    const listContainer = document.getElementById('notifications-list');
    if (listContainer) {
        if (notifications.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No notifications</div>';
        } else {
            listContainer.innerHTML = '';
            notifications.forEach(notif => {
                listContainer.appendChild(renderNotificationItem(notif, onMarkRead, onClearAll));
            });
        }
    }

    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn && onMarkAllRead) {
        markAllBtn.onclick = () => {
            onMarkAllRead();
            const items = document.querySelectorAll('#notifications-list .notification-item');
            items.forEach(item => item.classList.remove('unread'));
        };
    }

    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn && onClearAll) {
        clearAllBtn.onclick = () => {
            if (confirm('Delete all notifications?')) {
                onClearAll();
                const list = document.getElementById('notifications-list');
                if (list) list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No notifications</div>';
            }
        };
    }
}

// Update notification badge in topbar
function updateNotificationBadge(count) {
    const dot = document.getElementById('notif-dot');
    const bell = document.querySelector('.notif-bell');

    if (!dot) return;

    if (count > 0) {
        dot.style.display = 'flex';
        dot.textContent = count > 9 ? '9+' : count;
        if (bell) bell.setAttribute('title', `${count} notification${count !== 1 ? 's' : ''}`);
    } else {
        dot.style.display = 'none';
        if (bell) bell.setAttribute('title', 'Notifications');
    }
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
function updateNotificationBadgeCount(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}
