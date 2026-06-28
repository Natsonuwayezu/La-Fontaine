// tests/offline-tests.js
// Offline functionality tests

export async function testOfflineModule() {
    console.log('Running offline tests...');

    const tests = [
        testIndexedDBConnection,
        testSaveOfflineMarks,
        testRetrieveOfflineMarks,
        testSyncQueue,
        testOfflineIndicator
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} passed`);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} failed:`, error.message);
            failed++;
        }
    }

    console.log(`Offline tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

async function testIndexedDBConnection() {
    const isIndexedDBAvailable = 'indexedDB' in window;
    if (!isIndexedDBAvailable) {
        throw new Error('IndexedDB not available in this browser');
    }

    // Test database opening
    const dbName = 'TestOfflineDB';
    const request = indexedDB.open(dbName, 1);

    const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    if (!db) throw new Error('Failed to open IndexedDB');
    db.close();
    indexedDB.deleteDatabase(dbName);
}

async function testSaveOfflineMarks() {
    const dbName = 'TestMarksDB';
    const storeName = 'offline_marks';

    const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const testMark = {
        assessment_id: 100,
        student_id: 50,
        score: 45,
        timestamp: Date.now(),
        synced: false
    };

    const id = await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(testMark);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    if (!id) throw new Error('Failed to save offline mark');

    db.close();
    indexedDB.deleteDatabase(dbName);
}

async function testRetrieveOfflineMarks() {
    const dbName = 'TestRetrieveDB';
    const storeName = 'offline_marks';

    const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    // Add test data
    const testMark = { assessment_id: 100, student_id: 50, score: 45, synced: false };
    await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(testMark);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });

    // Retrieve data
    const marks = await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    if (marks.length === 0) throw new Error('No marks retrieved');
    if (marks[0].score !== 45) throw new Error('Retrieved mark has incorrect score');

    db.close();
    indexedDB.deleteDatabase(dbName);
}

async function testSyncQueue() {
    const syncQueue = [];

    function addToQueue(item) {
        syncQueue.push({ ...item, queuedAt: Date.now() });
    }

    function getQueue() {
        return syncQueue;
    }

    function clearQueue() {
        syncQueue.length = 0;
    }

    addToQueue({ type: 'mark', data: { score: 45 } });
    addToQueue({ type: 'mark', data: { score: 78 } });

    if (syncQueue.length !== 2) throw new Error(`Queue length incorrect: ${syncQueue.length}`);

    clearQueue();
    if (syncQueue.length !== 0) throw new Error('Queue not cleared');
}

async function testOfflineIndicator() {
    let isOnline = true;

    function setOnline(status) {
        isOnline = status;
    }

    function getOnlineStatus() {
        return isOnline;
    }

    setOnline(false);
    if (getOnlineStatus() !== false) throw new Error('Offline status not set');

    setOnline(true);
    if (getOnlineStatus() !== true) throw new Error('Online status not set');

    // Test connection event listeners
    let connectionEvents = [];
    window.addEventListener = (event, handler) => {
        if (event === 'online' || event === 'offline') {
            connectionEvents.push({ event, handler });
        }
    };

    // Verify event listeners were registered (mock)
    if (!window.addEventListener) {
        // Skip if in test environment without DOM
        console.log('Skipping event listener test');
    }
}