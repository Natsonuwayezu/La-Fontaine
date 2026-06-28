// js/modules/system-health.js
// System Health Module - Monitor system performance, database status, and alerts

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtDate, fmtDateTime, esc, exportToExcel } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';

let healthCheckInterval = null;

export async function renderSystemHealth(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🩺 System Health Monitor</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.runHealthCheck()">🔄 Run Health Check</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportHealthReport()">📥 Export Report</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div id="health-status" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="loading-container"><div class="spinner"></div><p>Loading system status...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Database Status</span>
            </div>
            <div class="dash-card-body">
                <div id="db-status" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading database status...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">⚠️ System Alerts</span>
            </div>
            <div class="dash-card-body">
                <div id="system-alerts" class="table-wrapper">
                    <div class="loading-container"><div class="spinner"></div><p>Loading alerts...</p></div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📈 Performance Metrics</span>
            </div>
            <div class="dash-card-body">
                <div id="performance-metrics" class="form-grid">
                    <div class="loading-container"><div class="spinner"></div><p>Loading metrics...</p></div>
                </div>
            </div>
        </div>
    `;

    window.runHealthCheck = runHealthCheck;
    window.exportHealthReport = exportHealthReport;

    await runHealthCheck();

    // Auto-refresh every 60 seconds
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(runHealthCheck, 60000);
}

async function runHealthCheck() {
    await checkSystemStatus();
    await checkDatabaseStatus();
    await checkAlerts();
    await checkPerformanceMetrics();
}

async function checkSystemStatus() {
    const container = document.getElementById('health-status');
    if (!container) return;

    const startTime = performance.now();

    // Test API connectivity
    let apiStatus = 'healthy';
    let apiLatency = 0;
    try {
        const testStart = Date.now();
        await getAll('school_settings', { limit: 1 });
        apiLatency = Date.now() - testStart;
    } catch (e) {
        apiStatus = 'unhealthy';
    }

    const apiEndTime = performance.now();
    const responseTime = Math.round(apiEndTime - startTime);

    const localStorageStatus = checkLocalStorage();
    const indexedDBStatus = await checkIndexedDB();
    const onlineStatus = navigator.onLine ? 'online' : 'offline';

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">🌐</div>
            <div class="stat-value">${apiStatus === 'healthy' ? '✅' : '❌'}</div>
            <div class="stat-label">API Status</div>
            <div class="stat-trend ${apiStatus === 'healthy' ? 'up' : 'down'}">${apiLatency}ms</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">💾</div>
            <div class="stat-value">${localStorageStatus ? '✅' : '❌'}</div>
            <div class="stat-label">Local Storage</div>
            <div class="stat-trend ${localStorageStatus ? 'up' : 'down'}">${localStorageStatus ? 'Working' : 'Failed'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🗄️</div>
            <div class="stat-value">${indexedDBStatus ? '✅' : '❌'}</div>
            <div class="stat-label">IndexedDB</div>
            <div class="stat-trend ${indexedDBStatus ? 'up' : 'down'}">${indexedDBStatus ? 'Available' : 'Unavailable'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📶</div>
            <div class="stat-value">${onlineStatus === 'online' ? '✅' : '❌'}</div>
            <div class="stat-label">Network</div>
            <div class="stat-trend ${onlineStatus === 'online' ? 'up' : 'down'}">${onlineStatus}</div>
        </div>
    `;
}

async function checkDatabaseStatus() {
    const container = document.getElementById('db-status');
    if (!container) return;

    const tables = [
        { name: 'students', label: 'Students' },
        { name: 'teachers', label: 'Teachers' },
        { name: 'classes', label: 'Classes' },
        { name: 'subjects', label: 'Subjects' },
        { name: 'assessments', label: 'Assessments' },
        { name: 'marks', label: 'Marks' },
        { name: 'payments', label: 'Payments' },
        { name: 'student_fees', label: 'Student Fees' }
    ];

    let tableStatus = [];
    let totalRecords = 0;

    for (const table of tables) {
        try {
            const data = await getAll(table.name, { limit: 1 });
            const count = await getTableCount(table.name);
            totalRecords += count;
            tableStatus.push({
                name: table.label,
                status: 'healthy',
                count: count,
                error: null
            });
        } catch (e) {
            tableStatus.push({
                name: table.label,
                status: 'unhealthy',
                count: 0,
                error: e.message
            });
        }
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Table</th>
                    <th style="text-align:right">Records</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${tableStatus.map(t => `
                    <tr>
                        <td><strong>${esc(t.name)}</strong></span>
                        <td style="text-align:right">${t.count.toLocaleString()}</span>
                        <td style="text-align:center"><span class="badge ${t.status === 'healthy' ? 'badge-success' : 'badge-danger'}">${t.status === 'healthy' ? '✅ Healthy' : '❌ Error'}</span></span>
                        <td style="font-size:11px">${t.error ? esc(t.error) : '—'}</span>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="background:var(--bg-tertiary); font-weight:700">
                    <td>TOTAL RECORDS</td>
                    <td style="text-align:right">${totalRecords.toLocaleString()}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
    `;
}

async function getTableCount(tableName) {
    try {
        const data = await getAll(tableName);
        return data.length;
    } catch (e) {
        return 0;
    }
}

async function checkAlerts() {
    const container = document.getElementById('system-alerts');
    if (!container) return;

    const alerts = [];

    // Check for low storage
    const storageEstimate = await getStorageEstimate();
    if (storageEstimate && storageEstimate.usage / storageEstimate.quota > 0.8) {
        alerts.push({
            severity: 'warning',
            title: 'Storage Nearly Full',
            message: `Local storage is ${Math.round((storageEstimate.usage / storageEstimate.quota) * 100)}% full`
        });
    }

    // Check for offline mode
    if (!navigator.onLine) {
        alerts.push({
            severity: 'critical',
            title: 'Offline Mode',
            message: 'System is running offline. Changes will sync when connection restored.'
        });
    }

    // Check for pending offline marks
    const pendingMarks = await getPendingOfflineMarks();
    if (pendingMarks > 0) {
        alerts.push({
            severity: 'info',
            title: 'Pending Sync',
            message: `${pendingMarks} offline marks waiting to sync`
        });
    }

    // Check for overdue backups
    const lastBackup = localStorage.getItem('elf_auto_backup_time');
    if (lastBackup) {
        const daysSinceBackup = (Date.now() - new Date(lastBackup)) / 86400000;
        if (daysSinceBackup > 7) {
            alerts.push({
                severity: 'warning',
                title: 'Backup Overdue',
                message: `Last backup was ${Math.floor(daysSinceBackup)} days ago`
            });
        }
    }

    if (alerts.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">✅ No active alerts. System is healthy.</div>';
        return;
    }

    container.innerHTML = alerts.map(alert => `
        <div class="alert alert-${alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}" style="margin-bottom:12px">
            <strong>${alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'} ${esc(alert.title)}</strong><br>
            ${esc(alert.message)}
        </div>
    `).join('');
}

async function checkPerformanceMetrics() {
    const container = document.getElementById('performance-metrics');
    if (!container) return;

    // Memory usage
    let memoryInfo = 'Not available';
    if (performance.memory) {
        const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
        const totalMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);
        memoryInfo = `${Math.round(usedMB)} MB / ${Math.round(totalMB)} MB`;
    }

    // Page load time
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;

    // Last database sync
    const lastSync = localStorage.getItem('last_sync_time') || 'Never';

    // Cache size
    const cacheSize = await getCacheSize();

    container.innerHTML = `
        <div class="form-group">
            <label>Memory Usage</label>
            <input readonly value="${memoryInfo}" class="form-control">
        </div>
        <div class="form-group">
            <label>Page Load Time</label>
            <input readonly value="${loadTime}ms" class="form-control">
        </div>
        <div class="form-group">
            <label>Last Database Sync</label>
            <input readonly value="${fmtDateTime(lastSync)}" class="form-control">
        </div>
        <div class="form-group">
            <label>Cache Size</label>
            <input readonly value="${cacheSize}" class="form-control">
        </div>
        <div class="form-group">
            <label>Uptime</label>
            <input readonly value="${Math.floor(performance.now() / 1000 / 60)} minutes" class="form-control">
        </div>
        <div class="form-group">
            <label>Browser</label>
            <input readonly value="${navigator.userAgent.split(' ').slice(-2).join(' ')}" class="form-control">
        </div>
    `;
}

function checkLocalStorage() {
    try {
        const testKey = '__test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

async function checkIndexedDB() {
    try {
        return new Promise((resolve) => {
            const request = indexedDB.open('__test__', 1);
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                request.result.close();
                indexedDB.deleteDatabase('__test__');
                resolve(true);
            };
        });
    } catch (e) {
        return false;
    }
}

async function getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        return await navigator.storage.estimate();
    }
    return null;
}

async function getPendingOfflineMarks() {
    try {
        const db = await openDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction(['offline_marks'], 'readonly');
            const store = transaction.objectStore('offline_marks');
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
        });
    } catch (e) {
        return 0;
    }
}

async function getCacheSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key?.length || 0) + (value?.length || 0);
    }
    return `${Math.round(total / 1024)} KB`;
}

function exportHealthReport() {
    const report = {
        timestamp: new Date().toISOString(),
        system: {
            online: navigator.onLine,
            localStorage: checkLocalStorage(),
            userAgent: navigator.userAgent,
            language: navigator.language
        },
        database: {
            students: state.students.length,
            teachers: state.teachers.length,
            classes: state.classes.length,
            subjects: state.subjects.length,
            assessments: state.assessments.length,
            marks: state.marks.length,
            payments: state.payments.length
        },
        storage: {
            localStorageSize: `${Math.round(JSON.stringify(localStorage).length / 1024)} KB`
        }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `System_Health_Report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Health report exported', 'success');
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EcoleLaFontaineDB', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}