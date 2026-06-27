// SECTION 70: ASSESSMENT LOCKING
        // ================================================================

        async function renderAssessmentLocking(container) {
            await ensureStateLoaded();
            const user = state.currentUser;
            if (!user || user.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const classes = state.classes.filter(c => c.is_active !== false);

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">🔒 Assessment Locking Manager</span><div class="btn-group"><button class="btn btn-sm btn-warning" onclick="window.openBulkLockModal()">🔒 Bulk Lock/Unlock</button><button class="btn btn-sm btn-outline" onclick="window.refreshAssessmentList()">🔄 Refresh</button></div></div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="lock-term-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()"><option value="">All Terms</option>${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
                    <select id="lock-class-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
                    <input type="text" id="lock-search" class="form-control flex-1" placeholder="🔍 Search assessments..." oninput="window.filterLockAssessments()">
                    <span class="result-count" id="lock-count"></span>
                </div>
                <div class="table-wrapper" id="assessment-lock-table"><div class="loading-container"><div class="spinner"></div><p>Loading assessments...</p></div></div>
            </div>
        </div>
        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📋 Locking Rules</span></div><div class="dash-card-body"><div class="alert alert-info"><strong>Locking Rules:</strong><ul style="margin-top:8px;margin-left:20px"><li>🔒 <strong>Locked assessments</strong> cannot be edited by teachers</li><li>🔓 <strong>Unlocked assessments</strong> can be edited by assigned teachers</li><li>⏰ Assessments can be auto-locked when term ends (configure in Academic Calendar)</li><li>👑 Only administrators can lock/unlock assessments</li></ul></div><div class="form-group" style="margin-top:16px"><label>Auto-lock after days past due date</label><div style="display:flex; gap:12px; align-items:center"><input type="number" id="auto-lock-days" value="${state.schoolSettings.auto_lock_days || 7}" min="0" max="90" class="form-control" style="width:100px"><button class="btn btn-sm btn-primary" onclick="window.saveAutoLockSettings()">💾 Save Setting</button></div><small class="field-hint">0 = disabled. Assessments will auto-lock X days after due date passes.</small></div></div></div>
    `;

            window.openBulkLockModal = openBulkLockModal;
            window.refreshAssessmentList = refreshAssessmentList;
            window.filterLockAssessments = filterLockAssessments;
            window.saveAutoLockSettings = saveAutoLockSettings;
            window.toggleAssessmentLock = toggleAssessmentLock;

            await refreshAssessmentList();
        }
        window.renderAssessmentLocking = renderAssessmentLocking;

        async function refreshAssessmentList() {
            const container = document.getElementById('assessment-lock-table');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
            await ensureStateLoaded();
            filterLockAssessments();
        }
        window.refreshAssessmentList = refreshAssessmentList;

        function filterLockAssessments() {
            const container = document.getElementById('assessment-lock-table');
            if (!container) return;
            const termId = document.getElementById('lock-term-filter')?.value;
            const classId = document.getElementById('lock-class-filter')?.value;
            const search = (document.getElementById('lock-search')?.value || '').toLowerCase();
            let list = state.assessments || [];
            if (termId) list = list.filter(a => String(a.term_id) === termId);
            if (classId) list = list.filter(a => String(a.class_id) === classId);
            if (search) list = list.filter(a => (a.title || '').toLowerCase().includes(search));
            const countEl = document.getElementById('lock-count');
            if (countEl) countEl.textContent = list.length + ' assessment(s)';
            if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No assessments match the filters.</div>'; return; }
            const rows = list.map(a => {
                const cls = state.classes.find(c => c.id === a.class_id);
                const subj = state.subjects.find(s => s.id === a.subject_id);
                const term = state.terms.find(t => t.id === a.term_id);
                return `<tr><td><strong>${esc(a.title)}</strong></td><td>${esc(cls?.name || '—')}</td><td>${esc(subj?.name || '—')}</td><td>${esc(term?.name || '—')}</td><td>${esc(a.assessment_type || '—')}</td><td>${fmtDate(a.date)}</td><td><span class="badge ${a.is_locked ? 'badge-danger' : 'badge-success'}">${a.is_locked ? '🔒 Locked' : '🔓 Open'}</span></td><td><button class="btn btn-sm ${a.is_locked ? 'btn-success' : 'btn-warning'}" onclick="window.toggleAssessmentLock(${a.id},${a.is_locked})">${a.is_locked ? '🔓 Unlock' : '🔒 Lock'}</button></td></tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table"><thead><tr><th>Title</th><th>Class</th><th>Subject</th><th>Term</th><th>Type</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
        }
        window.filterLockAssessments = filterLockAssessments;

        async function toggleAssessmentLock(id, isLocked) {
            const r = await apiRequest('assessments?id=eq.' + id, 'PATCH', { is_locked: !isLocked, updated_at: new Date().toISOString() });
            if (r.success) {
                const a = state.assessments.find(x => x.id === id);
                if (a) a.is_locked = !isLocked;
                showToast(isLocked ? '🔓 Assessment unlocked' : '🔒 Assessment locked', 'success');
                filterLockAssessments();
            } else showToast('Failed: ' + r.error, 'error');
        }
        window.toggleAssessmentLock = toggleAssessmentLock;

        function openBulkLockModal() {
            const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const classes = (state.classes || []).filter(c => c.is_active !== false);
            showModal(`<div class="modal-overlay" id="bulk-lock-modal"><div class="modal"><div class="modal-header"><h3>🔒 Bulk Lock / Unlock</h3><button class="modal-close" onclick="closeModal('bulk-lock-modal')">✕</button></div><div class="modal-body"><div class="alert alert-warning">⚠️ Applies to ALL assessments matching filters.</div><div class="form-grid"><div class="form-group"><label>Term</label><select id="bulk-lock-term" class="form-control"><option value="">All Terms</option>${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="form-group"><label>Class</label><select id="bulk-lock-class" class="form-control"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('bulk-lock-modal')">Cancel</button><button class="btn btn-warning" onclick="window._bulkLock(true)">🔒 Lock All</button><button class="btn btn-success" onclick="window._bulkLock(false)">🔓 Unlock All</button></div></div></div>`);
            window._bulkLock = async (lock) => {
                const tId = document.getElementById('bulk-lock-term')?.value;
                const cId = document.getElementById('bulk-lock-class')?.value;
                let list = state.assessments || [];
                if (tId) list = list.filter(a => String(a.term_id) === tId);
                if (cId) list = list.filter(a => String(a.class_id) === cId);
                closeModal('bulk-lock-modal');
                showToast('⏳ Processing ' + list.length + ' assessments…', 'info', 3000);
                let done = 0;
                for (const a of list) {
                    const r = await apiRequest('assessments?id=eq.' + a.id, 'PATCH', { is_locked: lock, updated_at: new Date().toISOString() });
                    if (r.success) { a.is_locked = lock; done++; }
                }
                showToast(`✅ ${done} assessments ${lock ? 'locked' : 'unlocked'}`, 'success');
                filterLockAssessments();
            };
        }
        window.openBulkLockModal = openBulkLockModal;

        // ================================================================
