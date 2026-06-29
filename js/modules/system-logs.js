// js/modules/system-logs.js
// System Logs Module - View, filter, and export system activity logs


async function renderSystemLogs(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    let logs = state.activityLogs || [];
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Get unique users and actions for filters
    const uniqueUsers = [...new Set(logs.map(l => l.user_role).filter(Boolean))];
    const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📋 System Logs</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportAllLogs()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.clearOldLogs()">🗑️ Clear Old Logs</button>
                    <button class="btn btn-sm btn-outline" onclick="window.refreshLogs()">🔄 Refresh</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="log-user-filter" class="form-control" style="width:130px" onchange="window.filterLogs()">
                        <option value="">All Users</option>
                        ${uniqueUsers.map(u => `<option value="${u}">${esc(u)}</option>`).join('')}
                    </select>
                    <select id="log-action-filter" class="form-control" style="width:150px" onchange="window.filterLogs()">
                        <option value="">All Actions</option>
                        ${uniqueActions.slice(0, 20).map(a => `<option value="${a}">${esc(a)}</option>`).join('')}
                    </select>
                    <select id="log-entity-filter" class="form-control" style="width:130px" onchange="window.filterLogs()">
                        <option value="">All Entities</option>
                        <option value="students">Students</option>
                        <option value="teachers">Teachers</option>
                        <option value="payments">Payments</option>
                        <option value="assessments">Assessments</option>
                        <option value="marks">Marks</option>
                        <option value="fees">Fees</option>
                    </select>
                    <input type="date" id="log-date-start" class="form-control" style="width:140px" onchange="window.filterLogs()">
                    <input type="date" id="log-date-end" class="form-control" style="width:140px" onchange="window.filterLogs()">
                    <input type="text" id="log-search" class="form-control flex-1" placeholder="🔍 Search logs..." oninput="window.filterLogs()">
                    <span class="result-count" id="log-count"></span>
                </div>
                
                <div class="table-wrapper" id="logs-table-container" style="max-height:500px; overflow-y:auto">
                    <div class="loading-container"><div class="spinner"></div><p>Loading logs...</p></div>
                </div>
                
                <div class="pagination" id="logs-pagination" style="margin-top:16px"></div>
            </div>
        </div>
    `;

    window.filterLogs = filterLogs;
    window.exportAllLogs = exportAllLogs;
    window.clearOldLogs = clearOldLogs;
    window.refreshLogs = refreshLogs;
    window.viewLogDetails = viewLogDetails;

    window._allLogs = logs;
    window._currentPage = 1;
    window._pageSize = 50;

    filterLogs();
}

function filterLogs() {
    let logs = window._allLogs || [];
    const userFilter = document.getElementById('log-user-filter')?.value;
    const actionFilter = document.getElementById('log-action-filter')?.value;
    const entityFilter = document.getElementById('log-entity-filter')?.value;
    const startDate = document.getElementById('log-date-start')?.value;
    const endDate = document.getElementById('log-date-end')?.value;
    const search = document.getElementById('log-search')?.value.toLowerCase();

    if (userFilter) logs = logs.filter(l => l.user_role === userFilter);
    if (actionFilter) logs = logs.filter(l => l.action === actionFilter);
    if (entityFilter) logs = logs.filter(l => l.entity_type === entityFilter);
    if (startDate) logs = logs.filter(l => l.created_at >= startDate);
    if (endDate) logs = logs.filter(l => l.created_at <= `${endDate}T23:59:59`);
    if (search) logs = logs.filter(l =>
        l.action?.toLowerCase().includes(search) ||
        l.user_role?.toLowerCase().includes(search) ||
        (l.details || '').toLowerCase().includes(search)
    );

    window._filteredLogs = logs;
    window._currentPage = 1;
    renderLogsTable();
}

function renderLogsTable() {
    const logs = window._filteredLogs || [];
    const start = (window._currentPage - 1) * window._pageSize;
    const end = start + window._pageSize;
    const pageLogs = logs.slice(start, end);
    const container = document.getElementById('logs-table-container');
    const countSpan = document.getElementById('log-count');

    if (countSpan) countSpan.textContent = `${logs.length} record${logs.length !== 1 ? 's' : ''}`;

    if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No logs found</div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Entity Type</th>
                    <th>Entity ID</th>
                    <th>Details</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${pageLogs.map(log => `
                    <tr>
                        <td>${fmtDateTime(log.created_at)}</span>
                        <td><strong>${esc(log.action)}</strong></span>
                        <td>${esc(log.user_role || 'System')}</span>
                        <td style="text-align:center"><span class="badge ${log.user_role === 'admin' ? 'badge-danger' : log.user_role === 'accountant' ? 'badge-warning' : 'badge-info'}">${log.user_role || 'System'}</span></span>
                        <td>${log.entity_type ? `<span class="badge badge-neutral">${log.entity_type}</span>` : '—'}</span>
                        <td>${log.entity_id || '—'}</span>
                        <td>
                            <div style="max-width:250px; overflow-x:auto; font-size:11px; white-space:normal">
                                ${log.details ? (typeof log.details === 'string' ? esc(log.details.substring(0, 80)) : esc(JSON.stringify(log.details).substring(0, 80))) : '—'}
                                ${log.details && (typeof log.details === 'string' ? log.details.length : JSON.stringify(log.details).length) > 80 ? '...' : ''}
                            </div>
                         </span>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="window.viewLogDetails('${log.id}')">👁️</button>
                         </span>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    renderPagination(logs.length);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / window._pageSize);
    const pagination = document.getElementById('logs-pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= Math.min(totalPages, 10); i++) {
        html += `<div class="page-btn ${i === window._currentPage ? 'active' : ''}" onclick="window.goToLogPage(${i})">${i}</div>`;
    }
    if (totalPages > 10) {
        html += `<div class="page-btn" onclick="window.goToLogPage(${totalPages})">${totalPages}</div>`;
    }
    pagination.innerHTML = html;
}

window.goToLogPage = function (page) {
    window._currentPage = page;
    renderLogsTable();
};

async function viewLogDetails(logId) {
    const log = await getById('activity_logs', logId);
    if (!log) {
        showToast('Log record not found', 'error');
        return;
    }

    let detailsHtml = '';
    if (log.details) {
        try {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            detailsHtml = `<pre style="background:var(--bg-tertiary); padding:12px; border-radius:8px; overflow-x:auto; font-size:12px">${esc(JSON.stringify(details, null, 2))}</pre>`;
        } catch (e) {
            detailsHtml = `<div style="background:var(--bg-tertiary); padding:12px; border-radius:8px">${esc(log.details)}</div>`;
        }
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>📋 Log Record Details</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Date</label><input readonly value="${fmtDateTime(log.created_at)}" class="form-control"></div>
                        <div class="form-group"><label>Action</label><input readonly value="${esc(log.action)}" class="form-control"></div>
                        <div class="form-group"><label>User Role</label><input readonly value="${esc(log.user_role || 'System')}" class="form-control"></div>
                        <div class="form-group"><label>User ID</label><input readonly value="${log.user_id || '—'}" class="form-control"></div>
                        <div class="form-group"><label>Entity Type</label><input readonly value="${esc(log.entity_type || '—')}" class="form-control"></div>
                        <div class="form-group"><label>Entity ID</label><input readonly value="${log.entity_id || '—'}" class="form-control"></div>
                    </div>
                    <div class="form-group full">
                        <label>Details</label>
                        ${detailsHtml || '<div class="alert alert-info">No additional details</div>'}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportAllLogs() {
    const logs = window._filteredLogs || window._allLogs || [];
    const data = logs.map(log => ({
        'Date': fmtDateTime(log.created_at),
        'Action': log.action,
        'User Role': log.user_role || 'System',
        'User ID': log.user_id || '—',
        'Entity Type': log.entity_type || '—',
        'Entity ID': log.entity_id || '—',
        'Details': typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})
    }));

    exportToExcel(data, `System_Logs_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Logs exported', 'success');
}

async function clearOldLogs() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const oldLogsCount = (window._allLogs || []).filter(l => new Date(l.created_at) < threeMonthsAgo).length;

    if (oldLogsCount === 0) {
        showToast('No old logs to clear', 'info');
        return;
    }

    if (!await confirmDialog(`Delete ${oldLogsCount} log records older than 3 months? This action cannot be undone.`)) return;

    try {
        await removeWhere('activity_logs', `created_at lt ${threeMonthsAgo.toISOString()}`);
        await refreshTable('activity_logs');
        showToast(`✅ Cleared ${oldLogsCount} old log records`, 'success');
        await refreshLogs();
    } catch (e) {
        showToast('Error clearing logs: ' + e.message, 'error');
    }
}

async function refreshLogs() {
    const logs = await getAll('activity_logs', { order: 'created_at.desc', limit: 1000 });
    window._allLogs = logs;
    filterLogs();
}

function getById(table, id) {
    return getAll(table, { id: id }).then(r => r[0]);
}