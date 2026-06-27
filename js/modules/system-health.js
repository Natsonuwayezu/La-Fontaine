// SECTION 67: SYSTEM HEALTH
        // ================================================================

        async function renderSystemHealth(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }
            await ensureStateLoaded();

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🩺 System Health Monitor</span><div class="btn-group"><button class="btn btn-sm btn-primary" onclick="window.runSystemHealthCheck()">🔄 Run Health Check</button><button class="btn btn-sm btn-outline" onclick="window.exportHealthReport()">📥 Export Report</button></div></div>
            <div class="dash-card-body"><div id="health-status" class="stats-grid" style="grid-template-columns:repeat(4,1fr)"><div class="loading-container"><div class="spinner"></div><p>Loading system status...</p></div></div></div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📊 Database Status</span></div><div class="dash-card-body"><div id="db-status" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading database status...</p></div></div></div></div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">⚠️ System Alerts</span></div><div class="dash-card-body"><div id="system-alerts" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading alerts...</p></div></div></div></div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📈 Performance Metrics</span></div><div class="dash-card-body"><div id="performance-metrics" class="form-grid"><div class="loading-container"><div class="spinner"></div><p>Loading metrics...</p></div></div></div></div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">💾 Cache Statistics</span></div><div class="dash-card-body"><div id="cache-stats" class="table-wrapper"><div class="loading-container"><div class="spinner"></div><p>Loading cache stats...</p></div></div></div></div>
    `;

            await runSystemHealthCheck();
        }
        window.renderSystemHealth = renderSystemHealth;

        async function runSystemHealthCheck() {
            const container = document.getElementById('health-status');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Running health check...</p></div>';

            const checks = [];
            const r = await apiRequest('students?limit=1');
            checks.push({ name: 'Supabase Connection', status: r.success ? 'pass' : 'fail', msg: r.success ? 'Connected' : r.error });
            checks.push({ name: 'Students Data', status: state.students?.length ? 'pass' : 'warn', msg: state.students?.length + ' students loaded' });
            checks.push({ name: 'Marks Data', status: state.marks?.length ? 'pass' : 'warn', msg: state.marks?.length + ' marks loaded' });
            checks.push({ name: 'Payments Data', status: state.payments?.length ? 'pass' : 'warn', msg: state.payments?.length + ' payments loaded' });
            checks.push({ name: 'Fee Categories', status: state.feeCategories?.length ? 'pass' : 'warn', msg: state.feeCategories?.length + ' categories defined' });
            checks.push({ name: 'Academic Year Set', status: state.currentAcadYear ? 'pass' : 'fail', msg: state.currentAcadYear?.name || 'No active academic year' });
            checks.push({ name: 'Current Term Set', status: state.currentTerm ? 'pass' : 'warn', msg: state.currentTerm?.name || 'No active term' });
            checks.push({ name: 'Service Worker', status: ('serviceWorker' in navigator) ? 'pass' : 'warn', msg: ('serviceWorker' in navigator) ? 'Supported' : 'Not supported (offline features disabled)' });
            checks.push({ name: 'SheetJS (Export)', status: (typeof XLSX !== 'undefined') ? 'pass' : 'warn', msg: (typeof XLSX !== 'undefined') ? 'Loaded' : 'Not loaded — Excel exports disabled' });
            checks.push({ name: 'html2pdf (PDF)', status: (typeof html2pdf !== 'undefined') ? 'pass' : 'warn', msg: (typeof html2pdf !== 'undefined') ? 'Loaded' : 'Not loaded — PDF generation disabled' });

            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>${checks.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td style="text-align:center"><span class="badge ${c.status === 'pass' ? 'badge-success' : c.status === 'warn' ? 'badge-warning' : 'badge-danger'}">${c.status === 'pass' ? '✅ Pass' : c.status === 'warn' ? '⚠️ Warn' : '❌ Fail'}</span></td><td>${esc(c.msg)}</td></tr>`).join('')}</tbody></table></div>`;
        }
        window.runSystemHealthCheck = runSystemHealthCheck;

        function exportHealthReport() {
            const rows = document.querySelectorAll('#health-status tbody tr');
            if (!rows.length) { showToast('Run health check first', 'warning'); return; }
            const data = Array.from(rows).map(row => { const cells = row.querySelectorAll('td'); return { 'Check': cells[0]?.innerText || '', 'Status': cells[1]?.innerText || '', 'Details': cells[2]?.innerText || '' }; });
            exportToExcel(data, 'Health_Check_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Health report exported', 'success');
        }
        window.exportHealthReport = exportHealthReport;

        // ================================================================
