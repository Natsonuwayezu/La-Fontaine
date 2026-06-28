// js/modules/reminders.js
// Reminders Module - Set and manage reminders for tasks, payments, events

import { state } from '../core/state.js';
import { getAll, insert, update, remove } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, fmtDateTime, fmtAgo, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded } from '../core/data-loader.js';
import { getStudentById, getClassById } from './student-fees.js';

export async function renderReminders(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const isAdmin = user?.role === 'admin';

    let reminders = [];
    try {
        reminders = await getAll('reminders', { user_id: user.id, order: 'due_date.asc' });
    } catch (e) {
        reminders = [];
    }

    const upcomingReminders = reminders.filter(r => new Date(r.due_date) >= new Date()).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const overdueReminders = reminders.filter(r => new Date(r.due_date) < new Date() && !r.completed);
    const completedReminders = reminders.filter(r => r.completed);

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
                    <button class="tab-btn active" onclick="window.showReminderTab('upcoming', event)">📅 Upcoming (${upcomingReminders.length})</button>
                    <button class="tab-btn" onclick="window.showReminderTab('overdue', event)">⚠️ Overdue (${overdueReminders.length})</button>
                    <button class="tab-btn" onclick="window.showReminderTab('completed', event)">✅ Completed (${completedReminders.length})</button>
                </div>
                
                <div id="upcoming-reminders-tab">
                    ${renderReminderList(upcomingReminders, 'upcoming')}
                </div>
                <div id="overdue-reminders-tab" style="display:none">
                    ${renderReminderList(overdueReminders, 'overdue')}
                </div>
                <div id="completed-reminders-tab" style="display:none">
                    ${renderReminderList(completedReminders, 'completed')}
                </div>
            </div>
        </div>
    `;

    window.showReminderTab = showReminderTab;
    window.openAddReminderModal = openAddReminderModal;
    window.exportReminders = exportReminders;
    window.completeReminder = completeReminder;
    window.deleteReminder = deleteReminder;
    window.editReminder = editReminder;
    window.snoozeReminder = snoozeReminder;
}

function renderReminderList(reminders, type) {
    if (reminders.length === 0) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">No reminders in this category</div>';
    }

    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Due Date</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Related To</th>
                        <th>Priority</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${reminders.map(r => {
        const isOverdue = type === 'overdue';
        const dueClass = isOverdue ? 'overdue-red' : '';
        const priorityClass = r.priority === 'high' ? 'badge-danger' : (r.priority === 'medium' ? 'badge-warning' : 'badge-info');

        let relatedHtml = '—';
        if (r.related_type === 'student') {
            const student = getStudentById(r.related_id);
            relatedHtml = `👤 ${esc(student?.first_name || '')} ${esc(student?.last_name || '')}`;
        } else if (r.related_type === 'class') {
            const cls = getClassById(r.related_id);
            relatedHtml = `🏛️ ${esc(cls?.name || '')}`;
        } else if (r.related_type === 'payment') {
            relatedHtml = `💰 Payment`;
        }

        return `
                            <tr>
                                <td class="${dueClass}" style="white-space:nowrap">
                                    ${fmtDate(r.due_date)}
                                    ${isOverdue ? `<span class="badge badge-danger" style="margin-left:6px">${fmtAgo(r.due_date)}</span>` : ''}
                                </span>
                                <td><strong>${esc(r.title)}</strong></span>
                                <td>${esc(r.description || '—')}</span>
                                <td>${relatedHtml}</span>
                                <td style="text-align:center"><span class="badge ${priorityClass}">${r.priority || 'medium'}</span></span>
                                <td style="text-align:center">
                                    <div class="btn-group" style="gap:4px; justify-content:center">
                                        <button class="btn btn-sm btn-success" onclick="window.completeReminder(${r.id})" title="Mark Complete">✅</button>
                                        <button class="btn btn-sm btn-outline" onclick="window.editReminder(${r.id})" title="Edit">✏️</button>
                                        <button class="btn btn-sm btn-outline" onclick="window.snoozeReminder(${r.id})" title="Snooze">⏰</button>
                                        <button class="btn btn-sm btn-danger" onclick="window.deleteReminder(${r.id})" title="Delete">🗑️</button>
                                    </div>
                                </span>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showReminderTab(tabName, event) {
    const tabs = ['upcoming', 'overdue', 'completed'];
    for (const t of tabs) {
        const el = document.getElementById(`${t}-reminders-tab`);
        if (el) el.style.display = t === tabName ? 'block' : 'none';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

function openAddReminderModal(reminderId = null) {
    const isEdit = reminderId !== null;
    let reminder = null;
    if (isEdit) {
        reminder = state.reminders?.find(r => r.id === reminderId);
    }

    const students = state.students.filter(s => s.status === 'Active');
    const classes = state.classes.filter(c => c.is_active !== false);

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${isEdit ? '✏️ Edit Reminder' : '➕ Add Reminder'}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Title *</label>
                            <input type="text" id="reminder-title" class="form-control" value="${esc(reminder?.title || '')}" placeholder="e.g., Follow up with parent">
                        </div>
                        <div class="form-group full">
                            <label>Description</label>
                            <textarea id="reminder-desc" class="form-control" rows="3" placeholder="Additional details...">${esc(reminder?.description || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Due Date *</label>
                            <input type="date" id="reminder-due-date" class="form-control" value="${reminder?.due_date?.split('T')[0] || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Priority</label>
                            <select id="reminder-priority" class="form-control">
                                <option value="low" ${reminder?.priority === 'low' ? 'selected' : ''}>🟢 Low</option>
                                <option value="medium" ${reminder?.priority === 'medium' || !reminder ? 'selected' : ''}>🟡 Medium</option>
                                <option value="high" ${reminder?.priority === 'high' ? 'selected' : ''}>🔴 High</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Related To</label>
                            <select id="reminder-related-type" class="form-control" onchange="window.toggleRelatedField()">
                                <option value="none" ${!reminder?.related_type ? 'selected' : ''}>None</option>
                                <option value="student" ${reminder?.related_type === 'student' ? 'selected' : ''}>Student</option>
                                <option value="class" ${reminder?.related_type === 'class' ? 'selected' : ''}>Class</option>
                                <option value="payment" ${reminder?.related_type === 'payment' ? 'selected' : ''}>Payment</option>
                            </select>
                        </div>
                        <div class="form-group full" id="reminder-related-student-group" style="display:${reminder?.related_type === 'student' ? 'block' : 'none'}">
                            <label>Select Student</label>
                            <select id="reminder-related-student" class="form-control">
                                <option value="">-- Select Student --</option>
                                ${students.map(s => `<option value="${s.id}" ${reminder?.related_id === s.id ? 'selected' : ''}>${esc(s.first_name)} ${esc(s.last_name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group full" id="reminder-related-class-group" style="display:${reminder?.related_type === 'class' ? 'block' : 'none'}">
                            <label>Select Class</label>
                            <select id="reminder-related-class" class="form-control">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}" ${reminder?.related_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveReminder(${reminderId || ''})">${isEdit ? 'Save Changes' : 'Create Reminder'}</button>
                </div>
            </div>
        </div>
    `);

    window.toggleRelatedField = () => {
        const type = document.getElementById('reminder-related-type')?.value;
        document.getElementById('reminder-related-student-group').style.display = type === 'student' ? 'block' : 'none';
        document.getElementById('reminder-related-class-group').style.display = type === 'class' ? 'block' : 'none';
    };

    window.saveReminder = async (reminderId) => {
        const title = document.getElementById('reminder-title')?.value.trim();
        const description = document.getElementById('reminder-desc')?.value;
        const dueDate = document.getElementById('reminder-due-date')?.value;
        const priority = document.getElementById('reminder-priority')?.value;
        const relatedType = document.getElementById('reminder-related-type')?.value;
        let relatedId = null;

        if (relatedType === 'student') relatedId = document.getElementById('reminder-related-student')?.value;
        if (relatedType === 'class') relatedId = document.getElementById('reminder-related-class')?.value;

        if (!title || !dueDate) {
            showToast('Title and due date are required', 'warning');
            return;
        }

        const user = state.currentUser;
        const reminderData = {
            title: title,
            description: description,
            due_date: dueDate,
            priority: priority,
            related_type: relatedType === 'none' ? null : relatedType,
            related_id: relatedId || null,
            user_id: user.id,
            updated_at: new Date().toISOString()
        };

        if (reminderId) {
            await update('reminders', reminderId, reminderData);
            showToast('✅ Reminder updated', 'success');
        } else {
            reminderData.created_at = new Date().toISOString();
            reminderData.completed = false;
            await insert('reminders', reminderData);
            showToast('✅ Reminder created', 'success');
        }

        closeModal();
        renderReminders(document.getElementById('dynamic-content'));
    };
}

async function completeReminder(reminderId) {
    await update('reminders', reminderId, { completed: true, completed_at: new Date().toISOString() });
    showToast('✅ Reminder marked as complete', 'success');
    renderReminders(document.getElementById('dynamic-content'));
}

async function editReminder(reminderId) {
    closeModal();
    setTimeout(() => openAddReminderModal(reminderId), 200);
}

async function deleteReminder(reminderId) {
    if (!await confirmDialog('Delete this reminder?')) return;
    await remove('reminders', reminderId);
    showToast('✅ Reminder deleted', 'success');
    renderReminders(document.getElementById('dynamic-content'));
}

async function snoozeReminder(reminderId) {
    const days = prompt('Snooze for how many days? (1-30)', '1');
    const numDays = parseInt(days);
    if (isNaN(numDays) || numDays < 1 || numDays > 30) {
        showToast('Please enter a valid number of days (1-30)', 'warning');
        return;
    }

    const reminder = await getById('reminders', reminderId);
    if (reminder) {
        const newDate = new Date(reminder.due_date);
        newDate.setDate(newDate.getDate() + numDays);
        await update('reminders', reminderId, { due_date: newDate.toISOString().split('T')[0] });
        showToast(`✅ Reminder snoozed for ${numDays} day${numDays !== 1 ? 's' : ''}`, 'success');
        renderReminders(document.getElementById('dynamic-content'));
    }
}

function exportReminders() {
    const data = [];
    const exportRemindersList = window._allReminders || [];
    for (const r of exportRemindersList) {
        let related = '';
        if (r.related_type === 'student') {
            const st = getStudentById(r.related_id);
            related = st ? `${st.first_name} ${st.last_name}` : '—';
        } else if (r.related_type === 'class') {
            const cls = getClassById(r.related_id);
            related = cls?.name || '—';
        } else {
            related = r.related_type || '—';
        }

        data.push({
            'Title': r.title,
            'Description': r.description || '',
            'Due Date': fmtDate(r.due_date),
            'Priority': r.priority || 'medium',
            'Status': r.completed ? 'Completed' : (new Date(r.due_date) < new Date() ? 'Overdue' : 'Pending'),
            'Related To': related,
            'Created': fmtDate(r.created_at)
        });
    }

    exportToExcel(data, `Reminders_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Reminders exported', 'success');
}

function getById(table, id) {
    return getAll(table, { id: id }).then(r => r[0]);
}