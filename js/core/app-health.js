// ============================================================
// APP HEALTH - Performance monitoring and health checks
// ============================================================


// Health status
let healthStatus = {
    status: 'healthy',
    lastCheck: null,
    issues: [],
    metrics: {
        apiLatency: null,
        memoryUsage: null,
        localStorageUsage: null,
        indexedDBStatus: null
    }
};

// Check application health
async function checkAppHealth() {
    const checks = await Promise.all([
        checkApiHealth(),
        checkMemoryHealth(),
        checkStorageHealth(),
        checkDatabaseHealth()
    ]);

    const allHealthy = checks.every(c => c.healthy);
    healthStatus.status = allHealthy ? 'healthy' : 'degraded';
    healthStatus.lastCheck = new Date().toISOString();
    healthStatus.issues = checks.filter(c => !c.healthy).map(c => c.issue);
    healthStatus.metrics = {
        apiLatency: checks[0]?.latency || null,
        memoryUsage: checks[1]?.memoryUsage || null,
        localStorageUsage: checks[2]?.usage || null,
        indexedDBStatus: checks[3]?.status || null
    };

    if (!allHealthy) {
        warn('App health degraded', { issues: healthStatus.issues }, 'app-health');
    }

    return healthStatus;
}

// Check API health
async function checkApiHealth() {
    try {
        const startTime = Date.now();
        const result = await checkDbHealth();
        const latency = Date.now() - startTime;

        if (result.healthy) {
            return { healthy: true, latency };
        } else {
            return { healthy: false, issue: `API error: ${result.error}`, latency };
        }
    } catch (error) {
        return { healthy: false, issue: `API connection failed: ${error.message}` };
    }
}

// Check memory health (if performance.memory is available)
function checkMemoryHealth() {
    if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const usagePercent = (used / limit) * 100;

        if (usagePercent > 80) {
            return {
                healthy: false,
                issue: `High memory usage: ${usagePercent.toFixed(1)}%`,
                memoryUsage: usagePercent
            };
        }
        return { healthy: true, memoryUsage: usagePercent };
    }
    return { healthy: true, memoryUsage: 'unknown' };
}

// Check localStorage health
function checkStorageHealth() {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += (key?.length || 0) + (value?.length || 0);
        }
        const usageKB = total / 1024;
        const limitKB = 5 * 1024; // 5MB typical limit

        if (usageKB > limitKB * 0.8) {
            return {
                healthy: false,
                issue: `LocalStorage nearly full: ${usageKB.toFixed(0)}KB / ${limitKB}KB`,
                usage: usageKB
            };
        }
        return { healthy: true, usage: usageKB };
    } catch (error) {
        return { healthy: false, issue: `Storage error: ${error.message}` };
    }
}

// Check IndexedDB health
async function checkDatabaseHealth() {
    try {
        const request = indexedDB.open('HealthCheck', 1);

        return new Promise((resolve) => {
            request.onsuccess = () => {
                request.result.close();
                resolve({ healthy: true, status: 'operational' });
            };
            request.onerror = () => {
                resolve({ healthy: false, issue: 'IndexedDB unavailable', status: 'error' });
            };
        });
    } catch (error) {
        return { healthy: false, issue: `IndexedDB error: ${error.message}`, status: 'error' };
    }
}

// Monitor performance metrics
function monitorPerformance() {
    if (window.performance && window.performance.getEntriesByType) {
        const navigationEntries = performance.getEntriesByType('navigation');
        if (navigationEntries.length > 0) {
            const nav = navigationEntries[0];
            info('Performance metrics', {
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                loadComplete: nav.loadEventEnd - nav.fetchStart,
                domInteractive: nav.domInteractive - nav.fetchStart
            }, 'app-health');
        }
    }
}

// Check if app is responsive (not frozen)
let lastInteraction = Date.now();
function startResponsivenessMonitor() {
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(ev => {
        document.addEventListener(ev, () => {
            lastInteraction = Date.now();
        });
    });

    setInterval(() => {
        const timeSinceInteraction = Date.now() - lastInteraction;
        if (timeSinceInteraction > 30000 && document.hasFocus()) {
            warn('Possible app freeze - no user interaction for 30 seconds', null, 'app-health');
        }
    }, 10000);
}

// Get health status summary
function getHealthSummary() {
    return healthStatus;
}

// Run self-healing actions
async function runSelfHealing() {
    const issues = healthStatus.issues;
    let fixed = 0;

    for (const issue of issues) {
        if (issue.includes('LocalStorage nearly full')) {
            // Clear old cache data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('p_cache_') || key?.startsWith('notifications_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            fixed++;
        }

        if (issue.includes('High memory usage') && window.gc) {
            window.gc();
            fixed++;
        }
    }

    if (fixed > 0) {
        info(`Self-healing completed: ${fixed} issues addressed`, null, 'app-health');
        await checkAppHealth();
    }

    return { fixed };
}