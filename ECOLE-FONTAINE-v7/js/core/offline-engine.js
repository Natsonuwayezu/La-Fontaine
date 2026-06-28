// ============================================================
// OFFLINE ENGINE - IndexedDB storage and offline marks
// ============================================================

import { showToast } from './helpers.js';
import { info, error as logError } from './logger.js';

// Database configuration
const DB_NAME = 'EcoleLaFontaineDB';
const DB_VERSION = 2;
const STORES = {
    OFFLINE_MARKS: 'offline_marks',
    PENDING_SYNC: 'pending_sync',
    CACHED_DATA: 'cached_data'
};

let db = null;
let isOnline = navigator.onLine;

// Open IndexedDB database
export async function openDatabase() {
    return new Promise((resolve, reject) => {
        if (db && db.name === DB_NAME) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(STORES.OFFLINE_MARKS)) {
                const offlineStore = database.createObjectStore(STORES.OFFLINE_MARKS, { keyPath: 'id', autoIncrement: true });
                offlineStore.createIndex('assessment_id', 'assessment_id', { unique: false });
                offlineStore.createIndex('student_id', 'student_id', { unique: false });
                offlineStore.createIndex('synced', 'synced', { unique: false });
                offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.PENDING_SYNC)) {
                const pendingStore = database.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
                pendingStore.createIndex('type', 'type', { unique: false });
                pendingStore.createIndex('created_at', 'created_at', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.CACHED_DATA)) {
                const cacheStore = database.createObjectStore(STORES.CACHED_DATA, { keyPath: 'key' });
                cacheStore.createIndex('expiry', 'expiry', { unique: false });
            }
        };
    });
}

// Save marks offline
export async function saveOfflineMarks(assessmentData) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.OFFLINE_MARKS], 'readwrite');
        const store = transaction.objectStore(STORES.OFFLINE_MARKS);

        const record = {
            assessment_id: assessmentData.assessment_id,
            data: assessmentData,
            marks: assessmentData.marks,
            synced: false,
            timestamp: Date.now(),
            user_id: window.state?.currentUser?.id
        };

        const request = store.add(record);

        request.onsuccess = () => {
            updatePendingBadge();
            resolve(request.result);
        };

        request.onerror = () => reject(request.error);
    });
}

// Get unsynced offline marks
export async function getUnsyncedOfflineMarks() {
    await openDatabase();

    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction([STORES.OFFLINE_MARKS], 'readonly');
            const store = transaction.objectStore(STORES.OFFLINE_MARKS);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = (request.result || []).filter(r => !r.synced);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        } catch (e) {
            resolve([]);
        }
    });
}

// Mark offline marks as synced
export async function markOfflineMarksSynced(id) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.OFFLINE_MARKS], 'readwrite');
        const store = transaction.objectStore(STORES.OFFLINE_MARKS);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const record = getRequest.result;
            if (record) {
                record.synced = true;
                record.synced_at = Date.now();
                const putRequest = store.put(record);
                putRequest.onsuccess = () => resolve(true);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve(false);
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Delete offline marks
export async function deleteOfflineMarks(id) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.OFFLINE_MARKS], 'readwrite');
        const store = transaction.objectStore(STORES.OFFLINE_MARKS);
        const request = store.delete(id);

        request.onsuccess = () => {
            updatePendingBadge();
            resolve(true);
        };
        request.onerror = () => reject(request.error);
    });
}

// Get count of pending offline marks
export async function getPendingOfflineCount() {
    const unsynced = await getUnsyncedOfflineMarks();
    return unsynced.length;
}

// Update offline badge
export async function updatePendingBadge() {
    const count = await getPendingOfflineCount();
    const badge = document.getElementById('offline-badge');

    if (badge) {
        if (count > 0) {
            badge.style.display = 'flex';
            badge.innerHTML = `📱 ${count} pending ${count === 1 ? 'mark' : 'marks'} to sync`;
        } else {
            badge.style.display = 'none';
        }
    }
}

// Cache data offline
export async function cacheData(key, data, ttl = 24 * 60 * 60 * 1000) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.CACHED_DATA], 'readwrite');
        const store = transaction.objectStore(STORES.CACHED_DATA);

        const record = {
            key: key,
            data: data,
            expiry: Date.now() + ttl,
            created_at: Date.now()
        };

        const request = store.put(record);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// Get cached data
export async function getCachedData(key) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.CACHED_DATA], 'readonly');
        const store = transaction.objectStore(STORES.CACHED_DATA);
        const request = store.get(key);

        request.onsuccess = () => {
            const record = request.result;
            if (record && record.expiry > Date.now()) {
                resolve(record.data);
            } else {
                if (record) {
                    // Delete expired
                    const delTransaction = db.transaction([STORES.CACHED_DATA], 'readwrite');
                    delTransaction.objectStore(STORES.CACHED_DATA).delete(key);
                }
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Clear all offline data
export async function clearAllOfflineData() {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.OFFLINE_MARKS, STORES.PENDING_SYNC, STORES.CACHED_DATA], 'readwrite');

        transaction.objectStore(STORES.OFFLINE_MARKS).clear();
        transaction.objectStore(STORES.PENDING_SYNC).clear();
        transaction.objectStore(STORES.CACHED_DATA).clear();

        transaction.oncomplete = () => {
            updatePendingBadge();
            resolve(true);
        };
        transaction.onerror = () => reject(transaction.error);
    });
}

// Initialize offline support
export function initOfflineSupport() {
    openDatabase().catch(console.error);

    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        // Trigger sync when coming online
        if (window.syncOfflineMarks) {
            window.syncOfflineMarks();
        }
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        showToast('📴 You are offline. Marks will be saved locally.', 'warning');
    });

    updateConnectionStatus();

    // Create offline badge
    const badge = document.createElement('div');
    badge.id = 'offline-badge';
    badge.style.cssText = 'position:fixed;bottom:20px;left:20px;background:var(--warning);color:white;padding:8px 16px;border-radius:30px;font-size:12px;font-weight:600;z-index:1000;cursor:pointer;display:none;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    badge.onclick = () => {
        if (window.syncOfflineMarks) {
            window.syncOfflineMarks();
        }
    };
    document.body.appendChild(badge);

    // Create connection status indicator
    const status = document.createElement('div');
    status.id = 'connection-status';
    status.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;z-index:1000;display:none;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25);';
    document.body.appendChild(status);

    updatePendingBadge();
}

function updateConnectionStatus() {
    const statusDiv = document.getElementById('connection-status');
    if (statusDiv) {
        if (isOnline) {
            statusDiv.style.display = 'none';
        } else {
            statusDiv.style.display = 'flex';
            statusDiv.innerHTML = '🔴 OFFLINE';
            statusDiv.style.background = 'var(--danger)';
            statusDiv.style.color = 'white';
        }
    }
}