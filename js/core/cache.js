// ============================================================
// CACHE - In-memory and persistent caching system
// ============================================================

// In-memory cache store
const memoryCache = new Map();

// Cache configuration
const DEFAULT_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cache entries

// Set cache entry
export function cacheSet(key, value, ttl = DEFAULT_TTL) {
    // Enforce max cache size (LRU - remove oldest)
    if (memoryCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
    }
    
    memoryCache.set(key, {
        value,
        expires: Date.now() + ttl,
        created: Date.now()
    });
    
    return true;
}

// Get cache entry (returns null if expired or not found)
export function cacheGet(key, allowStale = false) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
        if (!allowStale) {
            memoryCache.delete(key);
            return null;
        }
    }
    
    return entry.value;
}

// Check if cache entry exists and is valid
export function cacheHas(key) {
    const entry = memoryCache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
        memoryCache.delete(key);
        return false;
    }
    return true;
}

// Delete cache entry
export function cacheDelete(key) {
    return memoryCache.delete(key);
}

// Clear entire cache
export function cacheClear() {
    memoryCache.clear();
    return true;
}

// Get cache statistics
export function cacheStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, entry] of memoryCache.entries()) {
        if (now > entry.expires) {
            expiredCount++;
        } else {
            validCount++;
        }
    }
    
    return {
        totalEntries: memoryCache.size,
        validEntries: validCount,
        expiredEntries: expiredCount,
        oldestEntry: getOldestEntryAge(),
        keys: Array.from(memoryCache.keys())
    };
}

// Get age of oldest entry in milliseconds
function getOldestEntryAge() {
    let oldest = Infinity;
    const now = Date.now();
    
    for (const entry of memoryCache.values()) {
        const age = now - entry.created;
        if (age < oldest) oldest = age;
    }
    
    return oldest === Infinity ? 0 : oldest;
}

// Delete all entries matching a pattern
export function cacheDeletePattern(pattern) {
    let deleted = 0;
    const regex = new RegExp(pattern, 'i');
    
    for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
            memoryCache.delete(key);
            deleted++;
        }
    }
    
    return deleted;
}

// Get or set cache (atomic operation)
export async function cacheGetOrSet(key, fetchFn, ttl = DEFAULT_TTL) {
    const cached = cacheGet(key);
    if (cached) return cached;
    
    const fresh = await fetchFn();
    if (fresh !== null && fresh !== undefined) {
        cacheSet(key, fresh, ttl);
    }
    return fresh;
}

// Warm up cache with multiple keys
export async function cacheWarm(keys, fetchFn) {
    const promises = keys.map(key => cacheGetOrSet(key, () => fetchFn(key)));
    return await Promise.all(promises);
}

// Persistent cache using localStorage (for offline support)
export function persistentCacheSet(key, value, ttl = DEFAULT_TTL) {
    try {
        const item = {
            value,
            expires: Date.now() + ttl,
            created: Date.now()
        };
        localStorage.setItem(`p_cache_${key}`, JSON.stringify(item));
        return true;
    } catch (e) {
        console.warn('Persistent cache set failed:', e);
        return false;
    }
}

export function persistentCacheGet(key) {
    try {
        const item = localStorage.getItem(`p_cache_${key}`);
        if (!item) return null;
        
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expires) {
            localStorage.removeItem(`p_cache_${key}`);
            return null;
        }
        
        return parsed.value;
    } catch (e) {
        return null;
    }
}

export function persistentCacheClear() {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
        if (key.startsWith('p_cache_')) {
            localStorage.removeItem(key);
        }
    }
}