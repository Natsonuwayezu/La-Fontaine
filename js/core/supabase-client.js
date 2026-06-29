
// Year-lock guard — prevents editing marks/fees from locked academic years
function checkYearLock(table, data) {
    if (!['marks', 'student_fees', 'payments', 'assessments'].includes(table)) return null;
    const { state } = window._appState || {};
    if (!state) return null;
    const yearId = data?.academic_year_id;
    if (!yearId) return null;
    const year = (state.academicYears || []).find(y => y.id == yearId);
    if (year?.is_locked) {
        return `Academic year "${year.name}" is locked and cannot be edited. Unlock it in Academic Years settings.`;
    }
    return null;
}

// ============================================================
// SUPABASE CLIENT - Database API wrappers
// ============================================================


// API Headers
function apiHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

// Generic API request
async function apiRequest(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const opts = { method, headers: apiHeaders() };
    if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
        opts.body = JSON.stringify(body);
    }

    try {
        const resp = await fetch(url, opts);
        if (resp.status === 204) return { success: true, data: [] };
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        return { success: true, data };
    } catch (err) {
        console.error(`[API] ${method} ${endpoint}:`, err);
        return { success: false, error: err.message };
    }
}

// Get all records from a table
async function getAll(table, filters = {}) {
    let q = `${table}?select=*`;

    if (typeof filters === 'string') {
        if (filters) q += `&${filters}`;
    } else if (filters && typeof filters === 'object') {
        for (const [k, v] of Object.entries(filters)) {
            if (k === 'order') {
                q += `&order=${encodeURIComponent(v)}`;
            } else if (k === 'limit') {
                if (v && v !== 'all') q += `&limit=${encodeURIComponent(v)}`;
            } else if (v !== null && v !== undefined && v !== '') {
                q += `&${k}=eq.${encodeURIComponent(v)}`;
            }
        }
    }

    // Add default limit if not present
    if (!q.includes('&limit=')) {
        q += `&limit=50000`;
    }

    const r = await apiRequest(q);
    return r.success ? r.data : [];
}

// Get single record by ID
async function getById(table, id) {
    const r = await apiRequest(`${table}?id=eq.${id}&select=*`);
    return (r.success && r.data.length > 0) ? r.data[0] : null;
}

// Insert a record
async function insert(table, data) {
    const r = await apiRequest(table, 'POST', data);
    return r.success ? (Array.isArray(r.data) ? r.data[0] : r.data) : null;
}

// Update a record by ID
async function update(table, id, data) {
    const r = await apiRequest(`${table}?id=eq.${id}`, 'PATCH', data);
    return r.success;
}

// Update records matching filter
async function updateWhere(table, filterStr, data) {
    const r = await apiRequest(`${table}?${filterStr}`, 'PATCH', data);
    return r.success;
}

// Delete a record by ID
async function remove(table, id) {
    const r = await apiRequest(`${table}?id=eq.${id}`, 'DELETE');
    return r.success;
}

// Delete records matching filter
async function removeWhere(table, filterStr) {
    const r = await apiRequest(`${table}?${filterStr}`, 'DELETE');
    return r.success;
}

// Get records with automatic pagination
async function getAllRecords(table, filter = '', batchSize = 1000) {
    let allRecords = [];
    let page = 0;

    while (true) {
        const offset = page * batchSize;
        const params = filter + (filter ? '&' : '') + `limit=${batchSize}&offset=${offset}`;
        const records = await apiRequest(table + '?' + params);

        if (!records.success || records.data.length === 0) break;

        allRecords = allRecords.concat(records.data);
        page++;

        if (records.data.length < batchSize) break;
        if (page > 50) break;
    }

    return allRecords;
}

// Get school settings
async function getSchoolSettings() {
    const rows = await getAll('school_settings');
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    return out;
}

// Update school setting
async function updateSchoolSetting(key, value) {
    const existing = await getAll('school_settings', { key });
    if (existing.length > 0) {
        return await updateWhere('school_settings', `key=eq.${key}`, { value, updated_at: new Date().toISOString() });
    } else {
        return await insert('school_settings', { key, value });
    }
}