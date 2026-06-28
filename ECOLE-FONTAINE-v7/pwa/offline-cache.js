// pwa/offline-cache.js
// Offline Cache Management

const CACHE_CONFIG = {
    name: 'ecole-la-fontaine-dynamic',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxItems: 100
};

export class OfflineCache {
    constructor() {
        this.dbName = 'ELF_CacheDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('expiry', 'expiry', { unique: false });
                }
            };
        });
    }

    async set(key, value, ttl = CACHE_CONFIG.maxAge) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put({
                key: key,
                value: value,
                timestamp: Date.now(),
                expiry: Date.now() + ttl
            });

            request.onsuccess = () => {
                this.cleanup().catch(console.warn);
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async get(key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.expiry > Date.now()) {
                    resolve(result.value);
                } else {
                    if (result) this.delete(key).catch(console.warn);
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async delete(key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async cleanup() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('expiry');
            const range = IDBKeyRange.upperBound(Date.now());
            const request = index.openCursor(range);

            let deleted = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                } else {
                    console.log(`Cleaned up ${deleted} expired cache items`);
                    resolve(deleted);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getStats() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.count();

            request.onsuccess = () => {
                resolve({
                    itemCount: request.result,
                    maxItems: CACHE_CONFIG.maxItems,
                    maxAge: CACHE_CONFIG.maxAge
                });
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// Pre-cache important data
export async function precacheData(data, key) {
    const cache = new OfflineCache();
    await cache.init();
    await cache.set(key, data);
}

// Get cached data
export async function getCachedData(key) {
    const cache = new OfflineCache();
    await cache.init();
    return await cache.get(key);
}

// Clear all cached data
export async function clearCache() {
    const cache = new OfflineCache();
    await cache.init();
    await cache.clear();
}

// Check if offline mode is active
export function isOffline() {
    return !navigator.onLine;
}

// Register for background sync
export async function registerBackgroundSync(tag) {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
            await registration.sync.register(tag);
            console.log('Background sync registered:', tag);
            return true;
        } catch (err) {
            console.error('Background sync registration failed:', err);
            return false;
        }
    }
    return false;
}