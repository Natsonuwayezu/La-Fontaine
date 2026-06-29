// ============================================================
// DB SAFE QUERY - Retry logic, timeouts, and fallback cache
// ============================================================


// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    useCache: true,
    cacheTTL: 300000 // 5 minutes
};

// Execute query with retry logic
async function safeQuery(queryFn, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    let lastError = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), config.timeout);
            });

            // Execute query with timeout
            const result = await Promise.race([queryFn(), timeoutPromise]);
            return result;

        } catch (error) {
            lastError = error;
            console.warn(`Query attempt ${attempt} failed:`, error.message);

            if (attempt < config.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
            }
        }
    }

    throw lastError;
}

// Safe get with caching and retry
async function safeGet(table, filters = {}, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    const cacheKey = `${table}:${JSON.stringify(filters)}`;

    // Check cache first
    if (config.useCache) {
        const cached = cacheGet(cacheKey);
        if (cached) return cached;
    }

    try {
        const result = await safeQuery(async () => {
            const response = await apiRequest(`${table}?select=*`, 'GET');
            return response;
        }, config);

        if (config.useCache && result?.success && result?.data) {
            cacheSet(cacheKey, result.data, config.cacheTTL);
        }

        return result;
    } catch (error) {
        console.error(`Safe get failed for ${table}:`, error);

        // Return cached data even if expired as fallback
        const staleCache = cacheGet(cacheKey, true);
        if (staleCache) {
            showToast('Using cached data (offline mode)', 'warning', 2000);
            return { success: true, data: staleCache, fromCache: true };
        }

        return { success: false, error: error.message, data: [] };
    }
}

// Safe insert with validation and retry
async function safeInsert(table, data, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };

    return await safeQuery(async () => {
        const response = await apiRequest(table, 'POST', data);

        if (!response.success) {
            throw new Error(response.error || 'Insert failed');
        }

        // Invalidate cache for this table
        invalidateTableCache(table);

        return response;
    }, config);
}

// Safe update with retry
async function safeUpdate(table, id, data, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };

    return await safeQuery(async () => {
        const response = await apiRequest(`${table}?id=eq.${id}`, 'PATCH', data);

        if (!response.success) {
            throw new Error(response.error || 'Update failed');
        }

        invalidateTableCache(table);

        return response;
    }, config);
}

// Safe delete with retry
async function safeDelete(table, id, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };

    return await safeQuery(async () => {
        const response = await apiRequest(`${table}?id=eq.${id}`, 'DELETE');

        if (!response.success) {
            throw new Error(response.error || 'Delete failed');
        }

        invalidateTableCache(table);

        return response;
    }, config);
}

// Invalidate all cache entries for a table
function invalidateTableCache(table) {
    if (window.cacheInstance) {
        window.cacheInstance.deletePattern(table);
    }
}

// Batch insert with progress callback
async function batchInsert(table, items, batchSize = 100, onProgress = null) {
    const results = [];
    const errors = [];
    const total = items.length;

    for (let i = 0; i < total; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        for (const item of batch) {
            try {
                const result = await safeInsert(table, item);
                results.push(result);
            } catch (error) {
                errors.push({ item, error: error.message });
            }
        }

        if (onProgress) {
            onProgress(Math.min(i + batchSize, total), total);
        }
    }

    invalidateTableCache(table);

    return { results, errors, successCount: results.length, errorCount: errors.length };
}

// Check database connection health
async function checkDbHealth() {
    try {
        const startTime = Date.now();
        const result = await safeQuery(async () => {
            return await apiRequest('school_settings?limit=1', 'GET');
        }, { maxRetries: 1, timeout: 5000 });

        const latency = Date.now() - startTime;

        if (result.success) {
            return { healthy: true, latency, timestamp: new Date().toISOString() };
        } else {
            return { healthy: false, error: result.error, latency, timestamp: new Date().toISOString() };
        }
    } catch (error) {
        return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
    }
}