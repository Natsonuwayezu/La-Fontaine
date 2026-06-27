// js/core/offline.js
// Source lines: 12130–12706 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 9.1 — Database Initialization
        // ──────────────────────────────────────────────────────────────────────


        // IndexedDB database reference and online/offline flag
        const DB_NAME = 'EcoleLaFontaineDB';
        const DB_VERSION = 3; // bumped: defines STORES.CACHED_DATA properly (previously undefined, so the store was never created)
        const STORES = {
            OFFLINE_MARKS: 'offline_marks',
            PENDING_SYNC: 'pending_sync',
            CACHED_DATA: 'cached_data'
        };
        let db = null;
        let isOnline = navigator.onLine;


        /**
         * Open (or create) the IndexedDB database.
         * Creates object stores for offline_marks, pending_sync, cached_data.
         * Called automatically by any offline operation.
         */
        async function openDatabase() {
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



        // ──────────────────────────────────────────────────────────────────────
        // 9.1b — Per-User State Cache (fast reload after login)
        // ──────────────────────────────────────────────────────────────────────

        // Keys from `state` that are populated by loadInitialData() and are
        // safe/useful to cache. Anything role-sensitive (e.g. payments) is
        // still cached, but the cache is cleared on logout (see clearStateCache)
        // and is keyed per-user, so switching accounts never reuses another
        // user's cached data.
        const CACHEABLE_STATE_KEYS = [
            'academicYears', 'classes', 'subjects', 'schoolSettings', 'terms',
            'students', 'teachers', 'assessments', 'marks', 'feeCategories',
            'feeAmounts', 'studentFees', 'payments', 'families', 'activityLogs',
            'gradingScale', 'currentAcadYear', 'currentTerm'
        ];

        const STATE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

        /** Build the IndexedDB cache key for a given user. */
        function _stateCacheKey(user) {
            return `state_v1:${user.role}:${user.id}`;
        }

        /**
         * Persist the cacheable parts of `state` to IndexedDB for `user`.
         * Called after loadInitialData() succeeds, so the next login by the
         * same user can render instantly from cache while fresh data loads
         * in the background.
         */
        async function saveStateToCache(user) {
            if (!user) return;
            try {
                await openDatabase();
                const snapshot = {};
                for (const key of CACHEABLE_STATE_KEYS) snapshot[key] = state[key];
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.CACHED_DATA], 'readwrite');
                    const store = tx.objectStore(STORES.CACHED_DATA);
                    const req = store.put({ key: _stateCacheKey(user), data: snapshot, expiry: Date.now() + STATE_CACHE_MAX_AGE_MS });
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            } catch (e) {
                console.warn('[State Cache] Save failed:', e);
            }
        }

        /**
         * Try to populate `state` from IndexedDB for `user`. Returns true if a
         * valid (non-expired) cache was found and applied, false otherwise.
         * On success, `state.currentUser` is also set so the UI can render
         * immediately — loadInitialData() should still run afterwards in the
         * background to refresh with the latest server data.
         */
        async function loadStateFromCache(user) {
            if (!user) return false;
            try {
                await openDatabase();
                const record = await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.CACHED_DATA], 'readonly');
                    const store = tx.objectStore(STORES.CACHED_DATA);
                    const req = store.get(_stateCacheKey(user));
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => reject(req.error);
                });
                if (!record || !record.data || record.expiry < Date.now()) return false;
                for (const key of CACHEABLE_STATE_KEYS) {
                    if (record.data[key] !== undefined) state[key] = record.data[key];
                }
                invalidateCache();
                return true;
            } catch (e) {
                console.warn('[State Cache] Load failed:', e);
                return false;
            }
        }

        /**
         * Clear ALL cached state for ALL users from IndexedDB. Called on
         * logout so that logging into a different account never shows stale
         * or cross-account data, and the new session reloads fresh data.
         */
        async function clearStateCache() {
            try {
                await openDatabase();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.CACHED_DATA], 'readwrite');
                    const store = tx.objectStore(STORES.CACHED_DATA);
                    const req = store.clear();
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            } catch (e) {
                console.warn('[State Cache] Clear failed:', e);
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 9.2 — Offline Mark Storage
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Save a marks payload to IndexedDB when offline.
         */
        async function saveMarksOffline(data) {
            // Save marks to IndexedDB when offline
            await openDatabase();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['offline_marks'], 'readwrite');
                const store = tx.objectStore('offline_marks');
                const req = store.add({ data, synced: false, timestamp: Date.now() });
                req.onsuccess = () => { updatePendingBadge(); resolve(req.result); };
                req.onerror = () => reject(req.error);
            });
        }


        /**
         * Return all unsynced mark records from IndexedDB.
         */
        async function getUnsyncedOfflineMarks() {
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


        /**
         * Delete a synced mark record from IndexedDB by ID.
         */
        async function deleteOfflineMarks(id) {
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

        /**
         * Mark an offline mark record as synced (removes it from the pending
         * queue, same as deleteOfflineMarks — kept as a separate, clearly-named
         * function since that's what syncOfflineMarks() calls).
         */
        async function markOfflineMarksSynced(id) {
            return deleteOfflineMarks(id);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 9.3 — Sync Engine
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Upload all pending offline marks to Supabase when back online.
         * Shows a progress modal while syncing.
         */
        async function syncOfflineMarks() {
            if (!navigator.onLine) {
                showToast('No internet connection. Cannot sync.', 'warning');
                return { success: false, message: 'No internet connection' };
            }

            if (isSyncing) {
                showToast('Sync already in progress...', 'info');
                return { success: false, message: 'Sync already in progress' };
            }

            const unsynced = await getUnsyncedOfflineMarks();
            if (unsynced.length === 0) {
                showToast('No pending marks to sync', 'success');
                return { success: true, message: 'No pending marks' };
            }

            isSyncing = true;
            showSyncProgressModal(unsynced.length);

            let syncedIds = [];
            let failedIds = [];
            let current = 0;

            for (const offlineMark of unsynced) {
                updateSyncProgress(current + 1, unsynced.length, offlineMark);

                try {
                    const data = offlineMark.data || offlineMark.marks;
                    if (!data || !data.marks || !data.marks.length) {
                        failedIds.push(offlineMark.id);
                        current++;
                        continue;
                    }

                    // Create assessment if needed
                    let assessmentId = offlineMark.assessment_id;
                    if (!assessmentId) {
                        const assessment = await insert('assessments', {
                            class_id: data.classId,
                            subject_id: data.subjectId,
                            assessment_type: data.assessmentType,
                            assessment_name: data.assessmentName,
                            max_marks: data.maxMarks,
                            due_date: data.dueDate || null,
                            recorded_at: new Date().toISOString().split('T')[0],
                            is_locked: false,
                            created_by: getCurrentUser()?.id || null
                        });
                        assessmentId = assessment?.id;
                    }

                    if (!assessmentId) {
                        failedIds.push(offlineMark.id);
                        current++;
                        continue;
                    }

                    // Save marks to server
                    for (const studentMark of data.marks) {
                        const existing = await getAll('marks', {
                            assessment_id: assessmentId,
                            student_id: studentMark.student_id
                        });

                        if (existing.length > 0) {
                            await update('marks', existing[0].id, { score: studentMark.score });
                        } else {
                            await insert('marks', {
                                assessment_id: assessmentId,
                                student_id: studentMark.student_id,
                                score: studentMark.score,
                                entered_by: getCurrentUser()?.id || null,
                                entered_at: new Date().toISOString()
                            });
                        }
                    }

                    await markOfflineMarksSynced(offlineMark.id);
                    syncedIds.push(offlineMark.id);
                } catch (error) {
                    console.error('Sync error for offline mark:', error);
                    failedIds.push(offlineMark.id);
                }
                current++;
            }

            // Delete successfully synced marks
            for (const id of syncedIds) {
                await deleteOfflineMarks(id).catch(console.error);
            }

            await updatePendingBadge();
            await refreshTable('marks');
            await refreshTable('assessments');

            closeSyncModal();

            if (failedIds.length === 0) {
                showToast(`✅ Successfully synced ${syncedIds.length} marks`, 'success');
            } else {
                showToast(`⚠️ Synced ${syncedIds.length} marks, ${failedIds.length} failed`, 'warning');
            }

            isSyncing = false;

            return {
                success: failedIds.length === 0,
                syncedCount: syncedIds.length,
                failedCount: failedIds.length,
                message: `Synced ${syncedIds.length} marks, ${failedIds.length} failed`
            };
        }


        /**
         * Show the syncing progress overlay.
         */
        function showSyncProgressModal(total, current = 0, currentItem = null) {
            const modalHtml = `
                        <div class="modal-overlay" id="sync-modal" onclick="if(event.target===this)closeSyncModal()">
                            <div class="modal modal-sm" onclick="event.stopPropagation()">
                                <div class="modal-header">
                                    <h3>📱 Syncing Offline Marks</h3>
                                    <button class="modal-close" onclick="closeSyncModal()">✕</button>
                                </div>
                                <div class="modal-body">
                                    <div id="sync-status" style="text-align:center;margin-bottom:16px;">
                                        <div class="spinner" style="margin:0 auto 12px;"></div>
                                        <p id="sync-message">Preparing to sync...</p>
                                    </div>
                                    <div id="sync-progress-container" style="margin:16px 0;">
                                        <div style="background:var(--border-light);border-radius:99px;height:8px;overflow:hidden;">
                                            <div id="sync-progress-bar" style="width:0%;height:100%;background:var(--role-primary);transition:width .3s ease;"></div>
                                        </div>
                                        <p id="sync-progress-text" style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center;">0/${total} marks</p>
                                    </div>
                                    <div id="sync-details" style="font-size:11px;color:var(--text-muted);text-align:center;"></div>
                                </div>
                                <div class="modal-footer">
                                    <button class="btn btn-outline" onclick="closeSyncModal()">Cancel</button>
                                </div>
                            </div>
                        </div>
                    `;

            const container = document.getElementById('modals-container');
            if (container) container.innerHTML = modalHtml;

            if (current > 0) {
                updateSyncProgress(current, total, currentItem);
            }
        }


        /**
         * Update the progress bar in the sync modal.
         */
        function updateSyncProgress(current, total, currentItem) {
            const percent = (current / total) * 100;
            const progressBar = document.getElementById('sync-progress-bar');
            const progressText = document.getElementById('sync-progress-text');
            const messageEl = document.getElementById('sync-message');
            const detailsEl = document.getElementById('sync-details');

            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `${current}/${total} marks`;
            if (messageEl) messageEl.textContent = `Syncing mark ${current} of ${total}...`;

            if (currentItem && detailsEl) {
                const data = currentItem.data || currentItem.marks;
                if (data) {
                    detailsEl.innerHTML = `Currently syncing: ${data.assessmentName || 'Assessment'} - ${data.marks?.length || 0} marks`;
                }
            }
        }


        /**
         * Close/remove the sync progress modal.
         */
        function closeSyncModal() {
            const modal = document.getElementById('sync-modal');
            if (modal) modal.remove();
        }



        // ──────────────────────────────────────────────────────────────────────
        // 9.4 — Connection Status
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Update the floating badge showing how many marks are pending sync.
         */
        function updatePendingBadge() {
            getUnsyncedOfflineMarks().then(unsynced => {
                const count = unsynced.length;
                const badge = document.getElementById('offline-badge');

                if (badge) {
                    if (count > 0) {
                        badge.style.display = 'flex';
                        badge.innerHTML = `📱 ${count} pending ${count === 1 ? 'mark' : 'marks'} to sync`;
                        badge.onclick = () => {
                            if (navigator.onLine) {
                                syncOfflineMarks();
                            } else {
                                showToast('No internet connection. Please connect to sync.', 'warning');
                            }
                        };
                    } else {
                        badge.style.display = 'none';
                    }
                }
            });
        }


        /**
         * Show/hide the offline indicator pill in the corner of the screen.
         */
        function updateConnectionStatus() {
            isOnline = navigator.onLine;
            const statusDiv = document.getElementById('connection-status');

            if (statusDiv) {
                if (isOnline) {
                    statusDiv.style.display = 'none';
                    // Auto-sync when coming online
                    syncOfflineMarks().then(result => {
                        if (result.syncedCount > 0) {
                            showToast(`Synced ${result.syncedCount} marks successfully`, 'success');
                        }
                    });
                } else {
                    statusDiv.style.display = 'flex';
                    statusDiv.innerHTML = '🔴 OFFLINE';
                    statusDiv.style.background = 'var(--danger)';
                    statusDiv.style.color = 'white';
                }
            }
        }


        /**
         * Initialize offline support: open IndexedDB, attach online/offline listeners,
         * create the pending badge and connection status indicator DOM elements.
         */
        function initOfflineSupport() {
            openDatabase().catch(console.error);

            window.addEventListener('online', () => {
                isOnline = true;
                updateConnectionStatus();
                showToast('📶 Internet connection restored. Syncing offline marks...', 'success');
                syncOfflineMarks();
            });

            window.addEventListener('offline', () => {
                isOnline = false;
                updateConnectionStatus();
                showToast('📴 Internet connection lost. Marks will be saved locally.', 'warning');
            });

            updateConnectionStatus();

            // Create offline badge
            const badge = document.createElement('div');
            badge.id = 'offline-badge';
            badge.style.cssText = `
                        position: fixed;
                        bottom: 20px;
                        left: 20px;
                        background: var(--warning);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 30px;
                        font-size: 12px;
                        font-weight: 600;
                        z-index: 1000;
                        cursor: pointer;
                        display: none;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    `;
            badge.onclick = () => {
                if (navigator.onLine) {
                    syncOfflineMarks();
                } else {
                    showToast('No internet connection. Please connect to sync.', 'warning');
                }
            };
            document.body.appendChild(badge);

            // Create connection status indicator
            const status = document.createElement('div');
            status.id = 'connection-status';
            status.style.cssText = `
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        padding: 6px 14px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 700;
                        z-index: 1000;
                        display: none;
                        align-items: center;
                        gap: 6px;
                        letter-spacing: .5px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                    `;
            document.body.appendChild(status);

            updatePendingBadge();
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 10 — APP SHELL (Login Particles, Sidebar, Topbar, Theme)
