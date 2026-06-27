// SECTION 75: HOLIDAYS
        // ================================================================

        async function renderHolidays(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }
            await ensureStateLoaded();

            const currentYear = state.currentAcadYear || state.academicYears[0];
            let holidays = [];
            try { holidays = await getAll('holidays', { academic_year_id: currentYear?.id }); } catch (e) { holidays = []; }

            const rwandaHolidaysImported = holidays.some(h => h.holiday_type === 'public' && h.is_recurring === true);

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🏖️ Holidays & Breaks</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddHolidayModal()">➕ Add Holiday</button>
                    ${rwandaHolidaysImported ? '' : '<button class="btn btn-sm btn-outline" onclick="window.importRwandaHolidays()">🇷🇼 Import RW Holidays</button>'}
                    <button class="btn btn-sm btn-outline" onclick="window.exportHolidayCalendar()">📤 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Holiday Name</th><th>Date</th><th>Type</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${holidays && holidays.length ? holidays.map(h => `
                                <tr>
                                    <td><strong>${esc(h.name)}</strong></td>
                                    <td>${fmtDate(h.date)}</td>
                                    <td><span class="badge ${h.holiday_type === 'public' ? 'badge-info' : 'badge-warning'}">${esc(h.holiday_type === 'public' ? 'Public Holiday' : (h.holiday_type === 'half-day' ? 'Half Day' : 'School Holiday'))}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="window.editHoliday(${h.id})">✏️</button>
                                        <button class="btn btn-sm btn-danger" onclick="window.deleteHoliday(${h.id})">🗑️</button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No holidays added yet</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

            window.importRwandaHolidays = importRwandaHolidays;
            window.openAddHolidayModal = openAddHolidayModal;
            window.editHoliday = editHoliday;
            window.deleteHoliday = deleteHoliday;
            window.exportHolidayCalendar = exportHolidayCalendar;
        }
        window.renderHolidays = renderHolidays;

        const RWANDA_PUBLIC_HOLIDAYS = [
            { name: "New Year's Day", month: 1, day: 1 },
            { name: "Heroes' Day", month: 2, day: 1 },
            { name: "International Women's Day", month: 3, day: 8 },
            { name: "Genocide Memorial Day", month: 4, day: 7 },
            { name: "Good Friday", dynamic: true, offset: -2 },
            { name: "Easter Sunday", dynamic: true, offset: 0 },
            { name: "Easter Monday", dynamic: true, offset: 1 },
            { name: "Labour Day", month: 5, day: 1 },
            { name: "Liberation Day", month: 7, day: 4 },
            { name: "Umuganura Day", month: 8, day: 1 },
            { name: "Assumption Day", month: 8, day: 15 },
            { name: "Christmas Day", month: 12, day: 25 },
            { name: "Boxing Day", month: 12, day: 26 }
        ];

        function getEasterSunday(year) {
            const a = year % 19;
            const b = Math.floor(year / 100);
            const c = year % 100;
            const d = Math.floor(b / 4);
            const e = b % 4;
            const f = Math.floor((b + 8) / 25);
            const g = Math.floor((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4);
            const k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const month = Math.floor((h + l - 7 * m + 114) / 31);
            const day = ((h + l - 7 * m + 114) % 31) + 1;
            return new Date(year, month - 1, day);
        }

        async function importRwandaHolidays(academicYearId) {
            await ensureStateLoaded();
            const yearId = academicYearId || state.currentAcadYear?.id;
            if (!yearId) { showToast('No academic year selected', 'warning'); return; }
            const acadYear = state.academicYears.find(y => y.id === yearId);
            if (!acadYear) { showToast('Academic year not found', 'error'); return; }

            const startDate = new Date(acadYear.start_date || new Date().getFullYear() + '-01-01');
            const endDate = new Date(acadYear.end_date || new Date().getFullYear() + '-12-31');
            const startYear = startDate.getFullYear();
            const endYear = endDate.getFullYear();

            let existing = [];
            try {
                const r = await apiRequest('holidays?academic_year_id=eq.' + yearId + '&limit=100');
                existing = r.success ? r.data : [];
            } catch (e) { }
            const existingNames = new Set(existing.map(h => h.name));

            const toInsert = [];
            for (let yr = startYear; yr <= endYear; yr++) {
                const easter = getEasterSunday(yr);
                for (const h of RWANDA_PUBLIC_HOLIDAYS) {
                    let date;
                    if (h.dynamic) {
                        const d = new Date(easter);
                        d.setDate(d.getDate() + (h.offset || 0));
                        date = d.toISOString().split('T')[0];
                    } else {
                        date = `${yr}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
                    }
                    if (date < acadYear.start_date || date > acadYear.end_date) continue;
                    if (existingNames.has(h.name + ' ' + yr)) continue;
                    toInsert.push({
                        name: h.name + (startYear !== endYear ? ' ' + yr : ''),
                        date: date,
                        holiday_type: 'public',
                        academic_year_id: yearId,
                        is_recurring: true,
                        created_at: new Date().toISOString()
                    });
                }
            }

            if (!toInsert.length) { showToast('All Rwanda public holidays already imported for this year', 'info'); return; }
            if (!await confirmDialog(`Import ${toInsert.length} Rwanda public holiday(s) for ${acadYear.name}?`)) return;

            let ok = 0;
            for (const holiday of toInsert) {
                const r = await apiRequest('holidays', 'POST', holiday);
                if (r.success) ok++;
            }
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Imported ' + ok + ' Rwanda public holidays for ' + acadYear.name, 'holidays');
            showToast('✅ ' + ok + ' public holidays imported for ' + acadYear.name, 'success');
            renderHolidays(document.getElementById('dynamic-content'));
        }
        window.importRwandaHolidays = importRwandaHolidays;

        function openAddHolidayModal() {
            const years = state.academicYears || [];
            showModal(`<div class="modal-overlay" id="add-holiday-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Holiday</h3><button class="modal-close" onclick="closeModal('add-holiday-modal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Holiday Name *</label><input id="nh-name" class="form-control" placeholder="e.g. School Founding Day"></div><div class="form-group"><label>Date *</label><input type="date" id="nh-date" class="form-control"></div><div class="form-group"><label>Type</label><select id="nh-type" class="form-control"><option value="school">School</option><option value="public">Public</option><option value="half-day">Half Day</option></select></div><div class="form-group"><label>Academic Year</label><select id="nh-year" class="form-control">${years.map(y => `<option value="${y.id}"${y.id === state.currentAcadYear?.id ? ' selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div><div class="form-group"><label>Description</label><input id="nh-desc" class="form-control" placeholder="Optional"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-holiday-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewHoliday()">💾 Save</button></div></div></div>`);
            window._saveNewHoliday = async () => {
                const name = document.getElementById('nh-name')?.value.trim();
                const date = document.getElementById('nh-date')?.value;
                if (!name || !date) { showToast('Name and date required', 'warning'); return; }
                const r = await apiRequest('holidays', 'POST', {
                    name, date,
                    holiday_type: document.getElementById('nh-type')?.value,
                    academic_year_id: parseInt(document.getElementById('nh-year')?.value),
                    description: document.getElementById('nh-desc')?.value.trim() || null,
                    is_recurring: false,
                    created_at: new Date().toISOString()
                });
                if (r.success) {
                    closeModal('add-holiday-modal'); showToast('✅ Holiday added', 'success');
                    renderHolidays(document.getElementById('dynamic-content'));
                }
                else showToast('Failed: ' + r.error, 'error');
            };
        }
        window.openAddHolidayModal = openAddHolidayModal;

        async function editHoliday(holidayId) {
            let h;
            try {
                const r = await apiRequest('holidays?id=eq.' + holidayId);
                h = r.success && r.data[0] ? r.data[0] : null;
            } catch (e) { }
            if (!h) { showToast('Holiday not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-holiday-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Holiday</h3><button class="modal-close" onclick="closeModal('edit-holiday-modal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="eh-name" class="form-control" value="${esc(h.name || '')}"></div><div class="form-group"><label>Date *</label><input type="date" id="eh-date" class="form-control" value="${h.date || ''}"></div><div class="form-group"><label>Type</label><select id="eh-type" class="form-control"><option value="school"${h.holiday_type === 'school' ? ' selected' : ''}>School</option><option value="public"${h.holiday_type === 'public' ? ' selected' : ''}>Public</option><option value="half-day"${h.holiday_type === 'half-day' ? ' selected' : ''}>Half Day</option></select></div><div class="form-group"><label>Description</label><input id="eh-desc" class="form-control" value="${esc(h.description || '')}"></div></div></div><div class="modal-footer"><button class="btn btn-danger" onclick="window.deleteHoliday(${holidayId})">🗑️</button><button class="btn btn-outline" onclick="closeModal('edit-holiday-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditHoliday(${holidayId})">💾 Save</button></div></div></div>`);
            window._saveEditHoliday = async (id) => {
                const name = document.getElementById('eh-name')?.value.trim();
                const date = document.getElementById('eh-date')?.value;
                if (!name || !date) { showToast('Name and date required', 'warning'); return; }
                const r = await apiRequest('holidays?id=eq.' + id, 'PATCH', {
                    name, date,
                    holiday_type: document.getElementById('eh-type')?.value,
                    description: document.getElementById('eh-desc')?.value.trim() || null,
                    updated_at: new Date().toISOString()
                });
                if (r.success) {
                    closeModal('edit-holiday-modal'); showToast('✅ Holiday updated', 'success');
                    renderHolidays(document.getElementById('dynamic-content'));
                }
                else showToast('Failed: ' + r.error, 'error');
            };
        }
        window.editHoliday = editHoliday;

        async function deleteHoliday(holidayId) {
            if (!await confirmDialog('Delete this holiday?')) return;
            closeModal('edit-holiday-modal');
            const r = await apiRequest('holidays?id=eq.' + holidayId, 'DELETE');
            if (r.success) showToast('✅ Holiday deleted', 'success');
            else showToast('Failed: ' + r.error, 'error');
            renderHolidays(document.getElementById('dynamic-content'));
        }
        window.deleteHoliday = deleteHoliday;

        function exportHolidayCalendar() {
            const holidays = [];
            // Use the existing function or re-implement
            showToast('Export holidays - use the Export button in the holidays section', 'info');
        }
        window.exportHolidayCalendar = exportHolidayCalendar;

        // ================================================================
