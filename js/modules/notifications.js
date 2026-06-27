// ══════════════════════════════════════════════════════════════════════════


        /**
         * Notification inbox: system alerts, fee reminders, mark entry prompts.
         * Mark as read / mark all read.
         */
        async function renderNotifications(el) {
            await ensureStateLoaded();
            const user = state.currentUser;
            const isAdmin = user?.role === 'admin';
            const isTeacher = user?.role === 'teacher';
            const isAccountant = user?.role === 'accountant';

            // Load announcements from database
            let announcements = [];
            try {
                announcements = await getAll('announcements');
            } catch (e) {
                console.warn('Could not load announcements:', e);
                announcements = [];
            }

            // Filter announcements based on user role
            let filteredAnnouncements = announcements.filter(a => a.status !== 'draft');

            if (isTeacher) {
                // Teachers see announcements for 'all', 'teachers', or specific to their subjects
                filteredAnnouncements = filteredAnnouncements.filter(a => {
                    if (a.recipients === 'all' || a.recipients === 'teachers') return true;
                    if (a.recipients === 'specific' && a.specific_teacher_id == user.id) return true;
                    return false;
                });
            } else if (isAccountant) {
                // Accountants see announcements for 'all' or 'accountants'
                filteredAnnouncements = filteredAnnouncements.filter(a =>
                    a.recipients === 'all' || a.recipients === 'accountants'
                );
            }
            // Admin sees all announcements

            filteredAnnouncements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            // Get unread count for badge
            const unreadCount = filteredAnnouncements.filter(a => !a.is_read).length;
            updateNotificationBadgeCount(unreadCount);

            const renderAnnouncementItem = (ann) => {
                const typeIcon = ann.type === 'urgent' ? '⚠️' : ann.type === 'event' ? '📅' : '📢';
                const borderColor = ann.type === 'urgent' ? 'var(--danger)' : ann.type === 'event' ? 'var(--info)' : 'var(--success)';
                const isUnread = !ann.is_read;

                return `
                    <div style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:12px;background:${isUnread ? 'var(--info-bg)' : 'var(--bg-secondary)'};border-radius:0 var(--r-md) var(--r-md) 0;box-shadow:var(--shadow-sm);cursor:pointer" onclick="markAnnouncementAsRead(${ann.id})">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:8px">
                            <span style="font-weight:700;font-size:14px">${typeIcon} ${esc(ann.title)}</span>
                            <span style="font-size:11px;color:var(--text-muted)">${formatDate(ann.created_at)}</span>
                        </div>
                        <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;margin-bottom:8px">${esc(ann.message || '')}</div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <span class="badge ${ann.type === 'urgent' ? 'badge-danger' : ann.type === 'event' ? 'badge-info' : 'badge-success'}">📢 Announcement</span>
                            <span style="font-size:11px;color:var(--text-muted)">To: ${esc(ann.recipients === 'all' ? 'All Users' : ann.recipients)}</span>
                            ${isUnread ? '<span class="badge badge-info" style="background:#3b82f6;color:#fff;">📌 New</span>' : ''}
                        </div>
                    </div>
                `;
            };

            // Renders a system-generated notification (overdue fees, pending marks,
            // upcoming deadlines, etc.) using the same visual style as announcements.
            const renderSysBlock = (n) => {
                const borderColor = n.type === 'urgent' ? 'var(--danger)' : n.type === 'reminder' ? 'var(--warning)' : 'var(--info)';
                return `
                    <div style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:12px;background:var(--bg-secondary);border-radius:0 var(--r-md) var(--r-md) 0;box-shadow:var(--shadow-sm);cursor:pointer" onclick="navigateTo('${n.action}')">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:8px">
                            <span style="font-weight:700;font-size:14px">${n.icon} ${esc(n.title)}</span>
                            <span style="font-size:11px;color:var(--text-muted)">${esc(n.time)}</span>
                        </div>
                        <div style="font-size:13px;color:var(--text-secondary)">${esc(n.body)}</div>
                    </div>
                `;
            };

            const systemNotifs = [];
            const today = new Date();

            // System notifications based on role
            if (isAdmin) {
                const overdueCount = state.studentFees.filter(f =>
                    !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
                ).length;
                if (overdueCount > 0) {
                    systemNotifs.push({
                        type: 'warning',
                        icon: '⚠️',
                        title: 'Overdue Payments',
                        body: `${overdueCount} student fee payments are overdue.`,
                        action: 'overdue-payments',
                        time: 'System'
                    });
                }
            } else if (isAccountant) {
                const overdue = state.studentFees.filter(f =>
                    !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
                );
                if (overdue.length > 0) {
                    systemNotifs.push({
                        type: 'critical',
                        icon: '🔴',
                        title: `${overdue.length} Overdue Payments`,
                        body: `There are ${overdue.length} overdue fee payments requiring attention.`,
                        action: 'overdue-payments',
                        time: 'System'
                    });
                }
            } else if (isTeacher) {
                // Get teacher's assigned classes
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
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

                if (pendingCount > 0) {
                    systemNotifs.push({
                        type: 'reminder',
                        icon: '📝',
                        title: 'Pending Marks Entry',
                        body: `You have ${pendingCount} marks pending entry across your classes.`,
                        action: 'marks-entry',
                        time: 'System'
                    });
                }

                // Check upcoming assessments
                const tomorrow = new Date(Date.now() + 1 * 86400000);
                const upcomingAssessments = state.assessments.filter(a =>
                    a.due_date && new Date(a.due_date) <= tomorrow && new Date(a.due_date) >= today &&
                    classIds.includes(a.class_id) && !a.is_locked
                );
                if (upcomingAssessments.length > 0) {
                    systemNotifs.push({
                        type: 'urgent',
                        icon: '⚠️',
                        title: 'Assessment Deadlines Approaching',
                        body: `${upcomingAssessments.length} assessments are due today or tomorrow.`,
                        action: 'marks-entry',
                        time: 'System'
                    });
                }
            }

            const allContent = [
                ...filteredAnnouncements.map(a => ({ _type: 'ann', _html: renderAnnouncementItem(a) })),
                ...systemNotifs.map(n => ({ _type: 'sys', _html: renderSysBlock(n) }))
            ];

            const renderSection = (items) => {
                if (!items.length) return `<div class="alert alert-info" style="text-align:center;padding:40px">No notifications at this time.</div>`;
                return items.map(i => i._html).join('');
            };

            el.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header" style="flex-wrap:wrap;gap:8px">
                        <span class="dash-card-title">🔔 Notifications <span class="badge badge-danger" style="font-size:12px">${allContent.length}</span></span>
                        <div class="btn-group" style="flex-wrap:wrap;gap:6px">
                            <button class="btn btn-sm btn-outline" id="ntab-all" onclick="filterNotifTab('all')" style="font-weight:700;border-color:var(--role-primary)">All (${allContent.length})</button>
                            <button class="btn btn-sm btn-outline" id="ntab-ann" onclick="filterNotifTab('ann')">📢 Announcements (${filteredAnnouncements.length})</button>
                            <button class="btn btn-sm btn-outline" id="ntab-sys" onclick="filterNotifTab('sys')">🔧 System (${systemNotifs.length})</button>
                            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="openSendAnnouncementModal()">📢 New Announcement</button>` : ''}
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <div id="notif-content" style="padding:16px">
                            ${renderSection(allContent)}
                        </div>
                    </div>
                </div>
            `;

            // Store content for filtering
            el._allContent = allContent;
            el._annContent = allContent.filter(i => i._type === 'ann');
            el._sysContent = allContent.filter(i => i._type === 'sys');
            el._renderSection = renderSection;
        }


        /**
         * Loads all announcement-style notifications from the 'announcements'
         * table into state.notifications, filtered to those visible to the
         * current user's role (all / teachers / accountants).
         */
        async function loadAllSystemNotifications() {
            const role = state.currentUser?.role;
            let notifs = [];
            try { notifs = await getAll('announcements'); } catch (e) { notifs = []; }
            if (role && role !== 'admin') {
                notifs = notifs.filter(n => !n.recipients || n.recipients === 'all' || n.recipients === role + 's' || n.recipients === role);
            }
            state.notifications = notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        /**
         * Full notification center with tabs: Inbox, Sent, Announcements, Reminders.
         */
        async function renderNotificationCenter(container) {
            const user = state.currentUser;
            const isAdmin = user?.role === 'admin';

            await loadAllSystemNotifications();

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔔 Notification Center</span>
                        <div class="btn-group">
                            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="window.createSystemNotification()">📢 Create Notification</button>` : ''}
                            <button class="btn btn-sm btn-outline" onclick="window.markAllNotificationsRead()">✅ Mark All as Read</button>
                            <button class="btn btn-sm btn-outline" onclick="window.clearAllNotificationsData()">🗑️ Clear All</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportNotificationsData()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="notif-type-filter" class="form-control" style="width:130px" onchange="window.filterNotificationsList()">
                                <option value="all">All Types</option>
                                <option value="system">🔧 System</option>
                                <option value="announcement">📢 Announcement</option>
                                <option value="payment">💰 Payment</option>
                                <option value="reminder">⏰ Reminder</option>
                                <option value="marks">✏️ Marks</option>
                            </select>
                            <select id="notif-status-filter" class="form-control" style="width:130px" onchange="window.filterNotificationsList()">
                                <option value="all">All Status</option>
                                <option value="unread">Unread</option>
                                <option value="read">Read</option>
                            </select>
                            <input type="text" id="notif-search" class="form-control flex-1" placeholder="🔍 Search notifications..." oninput="window.filterNotificationsList()">
                            <span class="result-count" id="notif-count"></span>
                        </div>

                        <div id="notifications-list" class="notifications-container">
                            <div class="loading-container"><div class="spinner"></div><p>Loading notifications...</p></div>
                        </div>

                        <div class="pagination" id="notifications-pagination" style="margin-top:16px"></div>
                    </div>
                </div>
            `;

            await renderNotificationsList();
        }

        /**
         * Renders state.notifications into #notifications-list as a list of
         * .notif-item rows with data-type/data-read attributes, so
         * filterNotificationsList() can show/hide them client-side.
         */
        async function renderNotificationsList() {
            const container = document.getElementById('notifications-list');
            if (!container) return;
            const notifs = state.notifications || [];
            if (!notifs.length) {
                container.innerHTML = '<div class="alert alert-info" style="text-align:center;padding:40px">No notifications at this time.</div>';
                return;
            }
            container.innerHTML = notifs.map(n => {
                const typeIcon = n.type === 'urgent' ? '🚨' : n.type === 'warning' ? '⚠️' : n.category === 'system' ? '🔧' : '📢';
                const borderColor = n.type === 'urgent' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--info)';
                const isUnread = !n.is_read;
                const dataType = n.category === 'system' ? 'system' : (n.type === 'urgent' || n.type === 'warning' ? 'reminder' : 'announcement');
                return `
                    <div class="notif-item" data-type="${dataType}" data-read="${n.is_read ? 'read' : 'unread'}" style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:12px;background:${isUnread ? 'var(--info-bg)' : 'var(--bg-secondary)'};border-radius:0 var(--r-md) var(--r-md) 0;box-shadow:var(--shadow-sm);cursor:pointer" onclick="markAnnouncementAsRead(${n.id})">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:8px">
                            <span style="font-weight:700;font-size:14px">${typeIcon} ${esc(n.title)}</span>
                            <span style="font-size:11px;color:var(--text-muted)">${fmtDateTime(n.created_at)}</span>
                        </div>
                        <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${esc(n.message || '')}</div>
                        ${isUnread ? '<span class="badge badge-info" style="background:#3b82f6;color:#fff;margin-top:6px;display:inline-block">📌 New</span>' : ''}
                    </div>
                `;
            }).join('');
            const countEl = document.getElementById('notif-count');
            if (countEl) countEl.textContent = `${notifs.length} notification${notifs.length !== 1 ? 's' : ''}`;
        }


        /**
         * School-wide announcements: create, publish, archive.
         * Announcements visible to all roles on their dashboards.
         */
        async function renderAnnouncements(container) {
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


        /**
         * Personal reminders: add, complete, delete.
         * Reminders shown in the notification bell.
         */
        async function renderReminders(container) {
            const user = state.currentUser;

            let reminders = [];
            try {
                reminders = await getAll('reminders', { user_id: user.id, order: 'due_date.asc' });
            } catch (e) {
                reminders = [];
            }

            const upcomingReminders = reminders.filter(r => new Date(r.due_date) >= new Date() && !r.completed)
                .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            const overdueReminders = reminders.filter(r => new Date(r.due_date) < new Date() && !r.completed)
                .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            const completedReminders = reminders.filter(r => r.completed)
                .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">⏰ Reminders</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddReminderModal()">➕ Add Reminder</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportReminders()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr); margin-bottom:16px">
                            <div class="stat-card" style="padding:12px; text-align:center">
                                <div class="stat-value">${upcomingReminders.length}</div>
                                <div class="stat-label">Upcoming</div>
                            </div>
                            <div class="stat-card" style="padding:12px; text-align:center; background:var(--danger-bg)">
                                <div class="stat-value" style="color:var(--danger)">${overdueReminders.length}</div>
                                <div class="stat-label">Overdue</div>
                            </div>
                            <div class="stat-card" style="padding:12px; text-align:center">
                                <div class="stat-value">${completedReminders.length}</div>
                                <div class="stat-label">Completed</div>
                            </div>
                            <div class="stat-card" style="padding:12px; text-align:center">
                                <div class="stat-value">${reminders.length}</div>
                                <div class="stat-label">Total</div>
                            </div>
                        </div>

                        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:16px">
                            <button class="tab-btn active" onclick="window.showRemindersTab('upcoming', event)">📅 Upcoming (${upcomingReminders.length})</button>
                            <button class="tab-btn" onclick="window.showRemindersTab('overdue', event)">⚠️ Overdue (${overdueReminders.length})</button>
                            <button class="tab-btn" onclick="window.showRemindersTab('completed', event)">✅ Completed (${completedReminders.length})</button>
                        </div>

                        <div id="upcoming-reminders-tab">
                            ${renderRemindersList(upcomingReminders, 'upcoming')}
                        </div>
                        <div id="overdue-reminders-tab" style="display:none">
                            ${renderRemindersList(overdueReminders, 'overdue')}
                        </div>
                        <div id="completed-reminders-tab" style="display:none">
                            ${renderRemindersList(completedReminders, 'completed')}
                        </div>
                    </div>
                </div>
            `;

            window.completeReminder = completeReminder;
            window.deleteReminder = deleteReminder;
        }

        /**
         * Builds the HTML list for one reminders tab (upcoming/overdue/completed).
         * Returns a string since it's interpolated directly into a template
         * literal inside renderReminders().
         */
        function renderRemindersList(reminders, status) {
            if (!reminders.length) {
                return `<div class="alert alert-info" style="text-align:center;padding:30px">No ${esc(status)} reminders.</div>`;
            }
            return reminders.map(r => `
                <div class="dash-card" style="margin-bottom:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <div>
                        <div style="font-weight:600">${esc(r.title)}</div>
                        ${r.message ? `<div style="font-size:13px;color:var(--text-muted);margin-top:2px">${esc(r.message)}</div>` : ''}
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${status === 'completed' ? '✅ Completed ' + fmtDate(r.completed_at) : '📅 Due ' + fmtDate(r.due_date)}</div>
                    </div>
                    <div class="btn-group">
                        ${status !== 'completed' ? `<button class="btn btn-sm btn-success" onclick="window.completeReminder(${r.id})">✅ Done</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="window.deleteReminder(${r.id})">🗑️</button>
                    </div>
                </div>
            `).join('');
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 99 — WINDOW EXPOSURE & APPLICATION ENTRY POINT
