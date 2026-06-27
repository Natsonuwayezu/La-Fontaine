// SECTION 66: API SETTINGS
        // ================================================================

        async function renderApiSettings(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const currentUrl = SUPABASE_URL;
            const currentKey = SUPABASE_KEY;

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🔌 API Settings</span></div>
            <div class="dash-card-body">
                <div class="alert alert-warning"><strong>⚠️ Warning:</strong> Changing API settings will affect all database connections. The page will reload after saving. Make sure you have the correct credentials.</div>
                <div class="form-grid">
                    <div class="form-group full"><label>Supabase URL</label><input type="text" id="api-url" value="${esc(currentUrl)}" placeholder="https://your-project.supabase.co" class="form-control"><small class="field-hint">Your Supabase project URL (e.g., https://xxxxx.supabase.co)</small></div>
                    <div class="form-group full"><label>Anon Key / Public API Key</label><div class="pw-field" style="display:flex; gap:8px;"><input type="password" id="api-key" value="${esc(currentKey)}" placeholder="eyJhbGciOiJIUzI1NiIs..." class="form-control" style="flex:1"><button class="btn btn-sm btn-outline" onclick="window.toggleApiKeyVisibility()" type="button">👁️ Show/Hide</button></div><small class="field-hint">Your Supabase anon/public key from Project Settings > API</small></div>
                </div>
                <div class="btn-group" style="margin-top:16px">
                    <button class="btn btn-primary" onclick="window.testApiConnection()">🔌 Test Connection</button>
                    <button class="btn btn-success" onclick="window.saveApiSettings()">💾 Save Settings</button>
                    <button class="btn btn-outline" onclick="window.resetApiSettings()">🔄 Reset to Default</button>
                    <button class="btn btn-outline" onclick="window.showDatabaseSummary()">📊 Database Summary</button>
                </div>
                <div id="api-connection-status" style="margin-top:20px;display:none"></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">🗄️ Database Information</span></div><div class="dash-card-body"><div class="form-grid"><div class="form-group"><label>Current Environment</label><input type="text" readonly value="${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'Development' : 'Production'}" class="form-control"></div><div class="form-group"><label>API Version</label><input type="text" readonly value="v1 (REST)" class="form-control"></div><div class="form-group"><label>Last Connection Test</label><input type="text" readonly id="last-connection-test" value="${localStorage.getItem('last_api_test') || 'Never'}" class="form-control"></div><div class="form-group"><label>Default URL</label><input type="text" readonly value="${SUPABASE_URL_DEFAULT}" class="form-control"></div></div></div></div>
    `;
        }
        window.renderApiSettings = renderApiSettings;

        function saveApiSettings() {
            const url = document.getElementById('api-url')?.value.trim();
            const key = document.getElementById('api-key')?.value.trim();
            if (!url || !key) { showToast('Both URL and API Key are required', 'warning'); return; }
            localStorage.setItem('sb_url', url);
            localStorage.setItem('sb_key', key);
            SUPABASE_URL = url;
            SUPABASE_KEY = key;
            localStorage.setItem('last_api_test', new Date().toLocaleString());
            showToast('✅ API settings saved. Reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
        }
        window.saveApiSettings = saveApiSettings;

        function resetApiSettings() {
            localStorage.removeItem('sb_url');
            localStorage.removeItem('sb_key');
            document.getElementById('api-url').value = SUPABASE_URL_DEFAULT;
            document.getElementById('api-key').value = SUPABASE_KEY_DEFAULT;
            showToast('Settings reset to default. Click Save to apply.', 'info');
        }
        window.resetApiSettings = resetApiSettings;

        async function testApiConnection() {
            const url = document.getElementById('api-url')?.value.trim().replace(/\/$/, '');
            const key = document.getElementById('api-key')?.value.trim();
            const statusDiv = document.getElementById('api-connection-status');
            if (!url || !key) {
                statusDiv.innerHTML = '<div class="alert alert-danger">Please enter both URL and API Key</div>';
                statusDiv.style.display = 'block';
                return;
            }
            statusDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Testing connection...</p></div>';
            statusDiv.style.display = 'block';
            try {
                const resp = await fetch(`${url}/rest/v1/school_settings?select=key&limit=1`, {
                    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
                });
                if (resp.ok) {
                    statusDiv.innerHTML = '<div class="alert alert-success">✅ Connection successful!</div>';
                    localStorage.setItem('last_api_test', new Date().toLocaleString());
                } else {
                    statusDiv.innerHTML = `<div class="alert alert-danger">❌ Connection failed: HTTP ${resp.status}</div>`;
                }
            } catch (err) {
                statusDiv.innerHTML = `<div class="alert alert-danger">❌ Connection error: ${err.message}</div>`;
            }
        }
        window.testApiConnection = testApiConnection;

        function toggleApiKeyVisibility() {
            const el = document.getElementById('api-key');
            if (!el) return;
            el.type = el.type === 'password' ? 'text' : 'password';
        }
        window.toggleApiKeyVisibility = toggleApiKeyVisibility;

        // ================================================================
