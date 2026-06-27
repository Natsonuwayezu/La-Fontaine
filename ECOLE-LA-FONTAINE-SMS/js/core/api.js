// js/core/api.js
// Source lines: 9810–10178 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 3.1 — Request Headers
        // ──────────────────────────────────────────────────────────────────────


        /** Returns the standard headers needed for every Supabase REST request. */
        function apiHeaders() {
            return {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };
        }


        // ──────────────────────────────────────────────────────────────────────
        // 3.2 — Core HTTP Wrapper
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Low-level fetch wrapper for the Supabase REST API.
         * Throws a descriptive Error on non-2xx responses.
         * @param {string} path   - Table + query string, e.g. 'students?class_id=eq.3'
         * @param {string} method - HTTP method (GET/POST/PATCH/DELETE)
         * @param {object} body   - Request body for POST/PATCH
         */
        async function api(path, method, body) {
            method = method || 'GET';
            const headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };
            const opts = { method: method, headers: headers };
            if (body) opts.body = JSON.stringify(body);
            let res;
            try {
                res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
            } catch (networkErr) {
                // fetch() itself threw — this means the request never reached the
                // server at all (no internet connection, DNS failure, or the
                // Supabase project is unreachable), NOT a Supabase error response.
                // Report this once via a friendly, de-duplicated toast instead of
                // letting the raw "Failed to fetch" bubble up and get logged
                // separately for every single table in the same batch.
                notifyOffline();
                throw new Error('OFFLINE: Could not reach the server. Check your internet connection.');
            }
            if (res.status === 204) return [];
            const apiResp = await res.json();
            if (!res.ok) throw new Error(apiResp.message || apiResp.hint || 'HTTP ' + res.status);
            return apiResp;
        }

        // Shows the "you appear to be offline" toast at most once every 10
        // seconds, no matter how many table requests fail in the same batch —
        // avoids the console/toast spam seen when 6+ tables fail simultaneously
        // because the whole device lost its network connection.
        let _lastOfflineNotice = 0;
        function notifyOffline() {
            const now = Date.now();
            if (now - _lastOfflineNotice < 10000) return;
            _lastOfflineNotice = now;
            console.warn('[Network] Offline or server unreachable — check your internet connection.');
            showToast('📡 No internet connection. Some data may not load until you\'re back online.', 'warning', 6000);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 3.3 — Read Operations
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Fetches all records using automatic pagination (handles tables > 1000 rows).
         * Supabase default page size is 1000; we loop until we get a short page.
         */
        async function getAllRecords(table, filter = '', batchSize = 1000) {
            console.log(`📥 Fetching all records from: ${table} (filter: ${filter.substring(0, 50)}...)`);

            let allRecords = [];
            let page = 0;
            let totalFetched = 0;

            while (true) {
                const offset = page * batchSize;
                const params = filter + (filter ? '&' : '') + `limit=${batchSize}&offset=${offset}`;

                console.log(`  ├─ Page ${page + 1}: fetching offset ${offset}, limit ${batchSize}`);

                const records = await api(table + '?' + params, 'GET');

                if (records.length === 0) break;

                allRecords = allRecords.concat(records);
                totalFetched += records.length;
                page++;

                console.log(`  │  └─ Got ${records.length} records (total: ${totalFetched})`);

                if (records.length < batchSize) break;
                if (page > 50) break;
            }

            console.log(`✅ Completed ${table}: ${totalFetched} total records`);
            return allRecords;
        }


        /**
         * High-level get — accepts either a filter object or raw query string.
         * Examples:
         *   getAll('students', { class_id: 3, status: 'Active' })
         *   getAll('marks', 'assessment_id=eq.17&student_id=eq.44')
         */
        async function getAll(table, filters = {}) {
            let q = '';

            if (typeof filters === 'string') {
                q = filters;
            } else if (filters && typeof filters === 'object') {
                const parts = [];
                for (const [k, v] of Object.entries(filters)) {
                    if (k === 'order') {
                        parts.push(`order=${encodeURIComponent(v)}`);
                    } else if (k === 'limit') {
                        if (v && v !== 'all') parts.push(`limit=${encodeURIComponent(v)}`);
                    } else if (v !== null && v !== undefined && v !== '') {
                        parts.push(`${k}=eq.${encodeURIComponent(v)}`);
                    }
                }
                q = parts.join('&');
            }

            // For large tables, use paginated get
            if (['marks', 'assessments', 'payments', 'student_fees'].includes(table)) {
                return get(table, q);
            }

            // For other tables, single request
            if (!q.includes('limit=')) {
                q += (q ? '&' : '') + 'limit=50000';
            }

            const result = await apiRequest(`${table}?${q}`, 'GET');
            return result.success ? result.data : [];
        }

        // ── updateNotificationBadgeCount (used but never defined) ─────────
        function updateNotificationBadgeCount(count) {
            const dot = document.getElementById('notif-dot');
            if (!dot) return;
            if (count > 0) {
                dot.textContent = count > 9 ? '9+' : String(count);
                dot.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:#ef4444;color:#fff;border-radius:99px;font-size:.6rem;font-weight:700;min-width:16px;height:16px;padding:0 3px;position:absolute;top:-4px;right:-4px;';
                const bell = document.querySelector('.notif-bell');
                if (bell && !bell.style.position) bell.style.position = 'relative';
            } else {
                dot.style.display = 'none';
            }
        }

        /**
         * Recompute the unread count from state.notifications/state.announcements
         * and refresh the bell badge. Used after marking something as read,
         * when the caller doesn't already have the count on hand.
         */
        function updateNotificationBadge() {
            const unreadNotifs = (state.notifications || []).filter(n => !n.is_read).length;
            const unreadAnnouncements = (state.announcements || []).filter(a => !a.is_read).length;
            updateNotificationBadgeCount(unreadNotifs + unreadAnnouncements);
        }


        // Returns the total record count for a table/filter without fetching all rows.
        async function getCount(table, filters = '') {
            const result = await apiRequest(`${table}?select=id&${filters}&limit=0`, 'GET', null, true);
            if (result.headers) {
                const range = result.headers.get('Content-Range');
                if (range) {
                    const match = range.match(/\/(\d+)$/);
                    if (match) return parseInt(match[1]);
                }
            }
            // Fallback: fetch all ids (lightweight)
            const data = await get(table, `select=id&${filters}&limit=50000`);
            return data.length;
        }


        /**
         * Fetch a single record by primary key ID.
         */
        async function getById(table, id) {
            const r = await apiRequest(`${table}?id=eq.${id}&select=*`);
            return (r.success && r.data.length > 0) ? r.data[0] : null;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 3.4 — Write Operations
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Insert a single row; returns the created record.
         */
        async function insert(table, data) {
            const r = await apiRequest(table, 'POST', data);
            return r.success ? (Array.isArray(r.data) ? r.data[0] : r.data) : null;
        }


        /**
         * Update a single row by ID; returns the updated record.
         */
        async function update(table, id, data) {
            const r = await apiRequest(`${table}?id=eq.${id}`, 'PATCH', data);
            return r.success;
        }


        /**
         * Update rows matching an arbitrary filter string (e.g. 'student_id=eq.3').
         */
        async function updateWhere(table, filterStr, data) {
            const r = await apiRequest(`${table}?${filterStr}`, 'PATCH', data);
            return r.success;
        }


        /**
         * Delete a single row by ID.
         */
        async function remove(table, id) {
            const r = await apiRequest(`${table}?id=eq.${id}`, 'DELETE');
            return r.success;
        }


        /**
         * Delete rows matching an arbitrary filter string.
         */
        async function removeWhere(table, filterStr) {
            const r = await apiRequest(`${table}?${filterStr}`, 'DELETE');
            return r.success;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 3.5 — School Settings Helpers
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Load all school_settings rows as a { key: value } map.
         * Cached in memory for the session — call invalidateSettingsCache() after any update.
         */
        let _settingsCache = null;
        let _settingsCacheTime = 0;
        const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

        async function getSchoolSettings() {
            const now = Date.now();
            // Return cached copy if still fresh
            if (_settingsCache && (now - _settingsCacheTime) < SETTINGS_CACHE_TTL) {
                return _settingsCache;
            }
            const rows = await getAll('school_settings');
            const settings = {};
            rows.forEach(r => { settings[r.key] = r.value; });
            _settingsCache = settings;
            _settingsCacheTime = now;
            return settings;
        }

        /** Invalidate the settings cache — call after any updateSchoolSetting(). */
        function invalidateSettingsCache() {
            _settingsCache = null;
            _settingsCacheTime = 0;
        }


        /**
         * Get a single setting value by key, with a fallback default.
         */
        async function getSchoolSetting(key, defaultVal = null) {
            // Get a single school setting value by key
            try {
                const settings = await getSchoolSettings();
                return settings[key] !== undefined ? settings[key] : defaultVal;
            } catch (err) {
                console.warn('[getSchoolSetting]', err.message);
                return defaultVal;
            }
        }


        /**
         * Upsert a single school setting.
         * Inserts a new row if the key doesn't exist, otherwise PATCHes the existing row.
         * Always invalidates the settings cache so the next read fetches fresh data.
         */
        async function updateSchoolSetting(key, value) {
            const existing = await getAll('school_settings', { key });
            let result;
            if (existing.length > 0) {
                result = await updateWhere('school_settings', `key=eq.${key}`, {
                    value: value,
                    updated_at: new Date().toISOString()
                });
            } else {
                result = await insert('school_settings', {
                    key: key,
                    value: value,
                    created_at: new Date().toISOString()
                });
            }
            invalidateSettingsCache(); // always flush after a write
            return result;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 3.6 — Activity Logging
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Write a row to the activity_logs table.
         * Called after every significant user action (login, edit, delete, etc.).
         * Fails silently so it never blocks the main action.
         */
        async function logActivity(userId, userRole, action, entityType = null, entityId = null, details = null) {
            try {
                const newLog = {
                    user_id: userId,
                    user_role: userRole,
                    action: action,
                    entity_type: entityType,
                    entity_id: entityId,
                    details: details,
                    created_at: new Date().toISOString()
                };
                const result = await insert('activity_logs', newLog);
                if (result) {
                    state.activityLogs.unshift({ id: result.id, ...newLog });
                    if (state.activityLogs.length > 500) state.activityLogs.pop();
                }
            } catch (e) {
                console.warn('Failed to log activity:', e);
            }
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 4 — UTILITY & FORMATTING FUNCTIONS
