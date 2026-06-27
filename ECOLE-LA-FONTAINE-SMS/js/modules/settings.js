// js/modules/settings.js
// Source lines: 21608–22810 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * School profile settings: name, address, logo, contact info,
         * current term, academic year. Logo upload (base64 stored in DB).
         */
        async function renderSchoolSettings(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }
            await ensureStateLoaded();

            const settings = state.schoolSettings || {};
            const logoPreview = settings.school_logo ? (settings.school_logo.startsWith('data:') || settings.school_logo.startsWith('http') ? `<img src="${settings.school_logo}" style="max-width:80px;max-height:80px;border-radius:8px;">` : `<span style="font-size:48px;">${settings.school_logo}</span>`) : '<span style="font-size:48px;">🏫</span>';

            container.innerHTML = `
                        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">🏫 School Settings</span><button class="btn btn-sm btn-success" onclick="window.saveSchoolSettings()">💾 Save All</button></div>
                        <div class="dash-card-body"><div class="form-grid">
                            <div class="form-group"><label>School Name</label><input type="text" id="setting-school-name" value="${esc(settings.school_name || 'ECOLE LA FONTAINE')}"></div>
                            <div class="form-group"><label>School Motto</label><input type="text" id="setting-motto" value="${esc(settings.school_motto || 'We Excell')}"></div>
                            <div class="form-group"><label>Location / Address</label><input type="text" id="setting-location" value="${esc(settings.school_location || 'Rubavu, Rwanda')}"></div>
                            <div class="form-group"><label>Phone Number</label><input type="text" id="setting-phone" value="${esc(settings.school_phone || '+250788534320')}"></div>
                            <div class="form-group"><label>Email Address</label><input type="email" id="setting-email" value="${esc(settings.school_email || 'info@ecolelafontaine.rw')}"></div>
                            <div class="form-group"><label>Website</label><input type="text" id="setting-website" value="${esc(settings.school_website || 'www.ecolelafontaine.rw')}"></div>
                            <div class="form-group"><label>PO Box</label><input type="text" id="setting-pobox" value="${esc(settings.school_pobox || 'Box 123, Rubavu')}"></div>
                            <div class="form-group"><label>School Logo</label><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div id="logo-preview" style="width:80px;height:80px;background:var(--bg-tertiary);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden">${logoPreview}</div>
                            <input type="file" id="setting-logo-file" accept="image/*" style="display:none" onchange="window.previewSchoolLogo(this)"><button class="btn btn-sm btn-outline" onclick="document.getElementById('setting-logo-file').click()">📤 Upload Logo</button>
                            <button class="btn btn-sm btn-outline" onclick="document.getElementById('logo-preview').innerHTML='<span style=&quot;font-size:48px;&quot;>🏫</span>';document.getElementById('setting-logo-data').value='🏫'">🗑️ Remove</button></div>
                            <input type="hidden" id="setting-logo-data" value="${esc(settings.school_logo || '🏫')}"><small class="field-hint">Upload PNG, JPG, or GIF (max 2MB).</small></div>
                        </div></div></div>
                        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📅 Academic Settings</span></div>
                        <div class="dash-card-body"><div class="form-grid">
                            <div class="form-group"><label>Current Academic Year</label><select id="setting-year">${(state.academicYears || []).map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div>
                            <div class="form-group"><label>Current Term</label><select id="setting-term">${(state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id).map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
                            <div class="form-group"><label>Term Start Date</label><input type="date" id="setting-term-start" value="${state.currentTerm?.start_date || ''}"></div>
                            <div class="form-group"><label>Term End Date</label><input type="date" id="setting-term-end" value="${state.currentTerm?.end_date || ''}"></div>
                        </div></div></div>
                        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📄 Report Card Settings</span></div>
                        <div class="dash-card-body"><div class="form-grid">
                            <div class="form-group full"><label>Report Footer Line 1</label><input type="text" id="setting-footer-line1" value="${esc(settings.report_footer_line1 || 'Done at ECOLE LA FONTAINE')}"></div>
                            <div class="form-group full"><label>Report Footer Line 2 (Head of School)</label><input type="text" id="setting-footer-line2" value="${esc(settings.report_footer_line2 || 'UWAYO GANZA Eugene')}"></div>
                            <div class="form-group"><label>Head Teacher Title</label><input type="text" id="setting-head-title" value="${esc(settings.head_teacher_title || 'THE SCHOOL HEADTEACHER')}"></div>
                            <div class="form-group"><label>Default Pass Mark (%)</label><input type="number" id="setting-pass-mark" value="${settings.pass_mark || 50}" min="0" max="100"></div>
                        </div></div></div>
                        <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">🔐 Security Settings</span></div>
                        <div class="dash-card-body"><div class="form-grid">
                            <div class="form-group"><label>Admin Password</label><input type="password" id="setting-admin-pw" placeholder="Change password"></div>
                            <div class="form-group"><label>Session Timeout (minutes)</label><input type="number" id="setting-session-timeout" value="${settings.session_timeout || 30}" min="5" max="120"></div>
                        </div></div></div>
                    `;

            window.saveSchoolSettings = async () => {
                await updateSchoolSetting('school_name', document.getElementById('setting-school-name')?.value);
                await updateSchoolSetting('school_motto', document.getElementById('setting-motto')?.value);
                await updateSchoolSetting('school_location', document.getElementById('setting-location')?.value);
                await updateSchoolSetting('school_phone', document.getElementById('setting-phone')?.value);
                await updateSchoolSetting('school_email', document.getElementById('setting-email')?.value);
                await updateSchoolSetting('school_website', document.getElementById('setting-website')?.value);
                await updateSchoolSetting('school_pobox', document.getElementById('setting-pobox')?.value);
                await updateSchoolSetting('report_footer_line1', document.getElementById('setting-footer-line1')?.value);
                await updateSchoolSetting('report_footer_line2', document.getElementById('setting-footer-line2')?.value);
                await updateSchoolSetting('head_teacher_title', document.getElementById('setting-head-title')?.value);
                await updateSchoolSetting('pass_mark', document.getElementById('setting-pass-mark')?.value);
                const promotionMarkEl = document.getElementById('setting-promotion-mark');
                if (promotionMarkEl) await updateSchoolSetting('promotion_mark', promotionMarkEl.value);
                await updateSchoolSetting('session_timeout', document.getElementById('setting-session-timeout')?.value);

                const logoData = document.getElementById('setting-logo-data')?.value;
                if (logoData !== undefined && logoData !== '🏫') await updateSchoolSetting('school_logo', logoData);

                const yearId = document.getElementById('setting-year')?.value;
                if (yearId) { await updateWhere('academic_years', `id=eq.${yearId}`, { is_active: true }); }
                const termId = document.getElementById('setting-term')?.value;
                if (termId) {
                    const term = (state.terms || []).find(t => t.id == termId);
                    if (term) await updateSchoolSetting('current_term', term.name);
                    const termStart = document.getElementById('setting-term-start')?.value;
                    const termEnd = document.getElementById('setting-term-end')?.value;
                    if (termStart || termEnd) await update('terms', termId, { start_date: termStart, end_date: termEnd });
                }
                const newPw = document.getElementById('setting-admin-pw')?.value;
                if (newPw && newPw.length >= 4) await updateSchoolSetting('admin_password', newPw);

                await refreshTable('school_settings');
                await loadInitialData();
                showToast('✅ Settings saved successfully', 'success');
            };

            window.previewSchoolLogo = (input) => {
                const file = input.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { showToast('Logo too large. Max 2MB.', 'error'); return; }
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64 = e.target.result;
                    document.getElementById('logo-preview').innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;">`;
                    document.getElementById('setting-logo-data').value = base64;
                };
                reader.readAsDataURL(file);
            };
        }


        /**
         * Manage term dates, midterm dates, holidays, and auto-reset rules.
         * Rwanda public holidays import included.
         */
        async function renderAcademicCalendar(container) {
            await ensureStateLoaded();

            const currentYear = state.currentAcadYear || state.academicYears[0];
            const years = state.academicYears;

            let holidays = [];
            try {
                holidays = await getAll('holidays', { academic_year_id: currentYear?.id });
            } catch (e) {
                console.warn('Holidays table not found:', e);
                holidays = [];
            }

            // Rwanda public holidays are imported once per academic year (importRwandaHolidays
            // inserts records with holiday_type:'public' and is_recurring:true). If any such
            // record already exists for this year, hide the import button — it stays hidden
            // until a new academic year is created (which has no holidays yet).
            const rwandaHolidaysImported = holidays.some(h => h.holiday_type === 'public' && h.is_recurring === true);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📅 Academic Calendar</span>
                        <div class="btn-group">
                            <select id="cal-year" onchange="window.loadAcademicCalendar()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                ${years.map(y => `<option value="${y.id}" ${y.id === currentYear?.id ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-primary" onclick="window.openAddYearModal()">➕ Add New Year</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <!-- TERM DATES SECTION -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 12px;">📅 TERM DATES</h4>
                            <div id="terms-container">
                                ${state.terms.filter(t => t.academic_year_id === currentYear?.id).map(term => {
                const status = getTermStatus(term);
                const statusIcon = status === 'completed' ? '✅' : (status === 'current' ? '🟡' : '⏳');
                const statusText = status === 'completed' ? 'Completed' : (status === 'current' ? 'In Progress' : 'Upcoming');
                const isCurrent = status === 'current';
                return `
                                        <div style="border:1px solid var(--border-light);border-radius:var(--r-lg);padding:16px;margin-bottom:16px;">
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                                <strong style="font-size:1rem;">${esc(term.name)}</strong>
                                                <span class="badge ${status === 'completed' ? 'badge-success' : (status === 'current' ? 'badge-warning' : 'badge-info')}">${statusIcon} ${statusText}</span>
                                            </div>
                                            <div class="form-grid">
                                                <div class="form-group">
                                                    <label>Start Date</label>
                                                    <input type="date" id="term-start-${term.id}" value="${term.start_date || ''}" class="form-control">
                                                </div>
                                                <div class="form-group">
                                                    <label>End Date</label>
                                                    <input type="date" id="term-end-${term.id}" value="${term.end_date || ''}" class="form-control">
                                                </div>
                                                <div class="form-group">
                                                    <label>Midterm Date</label>
                                                    <input type="date" id="term-mid-${term.id}" value="${term.midterm_date || ''}" class="form-control">
                                                </div>
                                                <div class="form-group" style="justify-content:flex-end;display:flex;gap:8px;">
                                                    <button class="btn btn-sm btn-primary" onclick="window.updateTermDates(${term.id})">Save</button>
                                                    ${isCurrent ? `<button class="btn btn-sm btn-success" onclick="window.setCurrentTerm(${term.id})">Set as Current</button>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        </div>

                        <!-- HOLIDAYS SECTION -->
                        <div style="margin-bottom: 24px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                <h4>🏖️ HOLIDAYS & BREAKS</h4>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-primary" onclick="window.openAddHolidayModal()">➕ Add Holiday</button>
                                    ${rwandaHolidaysImported ? '' : '<button class="btn btn-sm btn-outline" onclick="window.importRwandaHolidays()">🇷🇼 Import RW Holidays</button>'}
                                </div>
                            </div>
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr><th>Holiday Name</th><th>Start Date</th><th>End Date</th><th>Type</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody id="holidays-tbody">
                                        ${holidays && holidays.length ? holidays.map(h => `
                                            <tr>
                                                <td><strong>${esc(h.name)}</strong></td>
                                                <td>${fmtDate(h.date)}</td>
                                                <td>${fmtDate(h.date)}</td>
                                                <td><span class="badge ${h.holiday_type === 'public' ? 'badge-info' : 'badge-warning'}">${esc(h.holiday_type === 'public' ? 'Public Holiday' : (h.holiday_type === 'half-day' ? 'Half Day' : 'School Holiday'))}</span></td>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.editHoliday(${h.id})">✏️</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteHoliday(${h.id})">🗑️</button>
                                                </td>
                                            </tr>
                                        `).join('') : '<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No holidays added yet</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- AUTO-RESET RULES SECTION -->
                        <div>
                            <h4 style="margin-bottom: 12px;">⚙️ AUTO-RESET RULES</h4>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Monthly Reset</label>
                                    <select id="auto-monthly" class="form-control">
                                        <option value="1st" ${state.schoolSettings.auto_monthly === '1st' ? 'selected' : ''}>1st of every month</option>
                                        <option value="disabled" ${state.schoolSettings.auto_monthly === 'disabled' ? 'selected' : ''}>Disabled</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Termly Reset</label>
                                    <select id="auto-termly" class="form-control">
                                        <option value="end" ${state.schoolSettings.auto_termly === 'end' ? 'selected' : ''}>On term end date</option>
                                        <option value="disabled" ${state.schoolSettings.auto_termly === 'disabled' ? 'selected' : ''}>Disabled</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Annual Reset</label>
                                    <select id="auto-annual" class="form-control">
                                        <option value="end" ${state.schoolSettings.auto_annual === 'end' ? 'selected' : ''}>On academic year end</option>
                                        <option value="disabled" ${state.schoolSettings.auto_annual === 'disabled' ? 'selected' : ''}>Disabled</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label><input type="checkbox" id="auto-lock-marks" ${state.schoolSettings.auto_lock_marks ? 'checked' : ''}> Auto-lock marks on term end</label>
                                </div>
                                <div class="form-group">
                                    <label>Auto-archive students after (days inactive)</label>
                                    <input type="number" id="auto-archive-days" value="${state.schoolSettings.auto_archive_days || 365}" class="form-control">
                                </div>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top: 24px;">
                            <button class="btn btn-primary" onclick="window.saveAcademicCalendar()">💾 Save Calendar</button>
                            <button class="btn btn-outline" onclick="window.generateYearCalendar()">📅 Generate Year Calendar</button>
                            <button class="btn btn-outline" onclick="window.exportAcademicCalendar()">📤 Export</button>
                        </div>
                    </div>
                </div>
            `;

            // Register global functions
            window.loadAcademicCalendar = loadAcademicCalendar;
            window.updateTermDates = updateTermDates;
            window.setCurrentTerm = setCurrentTerm;
            window.openAddHolidayModal = openAddHolidayModal;
            window.saveHoliday = saveHoliday;
            window.saveAcademicCalendar = saveAcademicCalendar;
            window.generateYearCalendar = generateYearCalendar;
            window.exportAcademicCalendar = exportAcademicCalendar;
            window.editHoliday = editHoliday;
            window.updateHoliday = updateHoliday;
            window.deleteHoliday = deleteHoliday;
            window.importRwandaHolidays = importRwandaHolidays;
        }


        /**
         * Manage academic years: create, set active, view term structure.
         * Creating a year auto-generates its 3 terms.
         */
        async function renderAcademicYears(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const currentYear = state.currentAcadYear;
            const years = [...state.academicYears].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📅 Academic Years Management</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddYearModal()">➕ Add Academic Year</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportAcademicYearsData()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Year Name</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th>Status</th>
                                        <th>Terms</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${years.length ? years.map(year => {
                const termCount = state.terms.filter(t => t.academic_year_id === year.id).length;
                return `
                                            <tr class="${year.is_active ? 'active-year' : ''}">
                                                <td><strong>${esc(year.name)}</strong> ${year.id === currentYear?.id ? '<span class="badge badge-success">Active</span>' : ''}</td>
                                                <td>${fmtDate(year.start_date)}</span>
                                                <td>${fmtDate(year.end_date)}</span>
                                                <td>
                                                    <select onchange="window.setAcademicYearStatus(${year.id}, this.value)" class="form-control" style="width:100px;padding:4px">
                                                        <option value="active" ${year.is_active ? 'selected' : ''}>Active</option>
                                                        <option value="inactive" ${!year.is_active ? 'selected' : ''}>Inactive</option>
                                                    </select>
                                                 </span>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.viewYearTerms(${year.id})">📋 ${termCount} Terms</button>
                                                    <button class="btn btn-sm btn-primary" onclick="window.cloneAcademicYear(${year.id})">📋 Clone</button>
                                                 </span>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.editAcademicYear(${year.id})">✏️</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteAcademicYear(${year.id}, '${esc(year.name)}')">🗑️</button>
                                                 </span>
                                            </tr>
                                        `;
            }).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No academic years found</span>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }


        /**
         * Manage classes: add, edit, delete, set sort order and class teacher.
         */
        async function renderClassManagement(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const classes = [...state.classes].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🏛️ Class Management</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.openAddClassModal()">➕ Add Class</button>
                            <button class="btn btn-sm btn-warning" onclick="window.openPromoteStudentsModal()">🚀 Promote Students</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportClassesData()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Class</th>
                                        <th>Code</th>
                                        <th>Level</th>
                                        <th>Students</th>
                                        <th>Capacity</th>
                                        <th>Utilization</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${classes.map((c, idx) => {
                const studentCount = state.students.filter(s => s.class_id === c.id && s.status === 'Active').length;
                const capacity = c.capacity || 40;
                const utilization = capacity > 0 ? (studentCount / capacity) * 100 : 0;
                const utilizationClass = utilization >= 90 ? 'badge-danger' : (utilization >= 75 ? 'badge-warning' : 'badge-success');

                return `
                                            <tr>
                                                <td style="text-align:center">
                                                    <button class="btn btn-sm btn-outline" onclick="window.moveClassUp(${c.id})" title="Move Up">▲</button>
                                                    ${c.sort_order || idx + 1}
                                                    <button class="btn btn-sm btn-outline" onclick="window.moveClassDown(${c.id})" title="Move Down">▼</button>
                                                 </span>
                                                <td><strong>${esc(c.name)}</strong></td>
                                                <td>${esc(c.code)}</span>
                                                <td><span class="badge ${c.level === 'Nursery' ? 'badge-info' : 'badge-primary'}">${c.level || '—'}</span></td>
                                                <td style="text-align:center">${studentCount}</span>
                                                <td style="text-align:center"><input type="number" id="cap-${c.id}" value="${capacity}" style="width:70px" class="form-control" onchange="window.updateClassCapacity(${c.id})"></span>
                                                <td style="text-align:center"><span class="badge ${utilizationClass}">${utilization.toFixed(0)}%</span></span>
                                                <td style="text-align:center"><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Active' : 'Inactive'}</span></span>
                                                <td style="text-align:center">
                                                    <div class="btn-group" style="gap:4px">
                                                        <button class="btn btn-sm btn-outline" onclick="window.editClass(${c.id})">✏️</button>
                                                        <button class="btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-success'}" onclick="window.toggleClassActive(${c.id}, ${c.is_active})">${c.is_active ? 'Deactivate' : 'Activate'}</button>
                                                        <button class="btn btn-sm btn-outline" onclick="window.viewClassStudents(${c.id})">👥</button>
                                                    </div>
                                                 </span>
                                            </tr>
                                        `;
            }).join('') || '<tr><td colspan="9" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No classes found</span>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Class Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="class-stats-container" class="stats-grid">
                            <div class="loading-container"><div class="spinner"></div><p>Loading stats...</p></div>
                        </div>
                    </div>
                </div>
            `;

            window.openAddClassModal = openAddClassModal;
            window.editClass = editClass;
            window.updateClass = updateClass;
            window.toggleClassActive = toggleClassActive;
            window.updateClassCapacity = updateClassCapacity;
            window.moveClassUp = moveClassUp;
            window.moveClassDown = moveClassDown;
            window.openPromoteStudentsModal = openPromoteStudentsModal;
            window.exportClassesData = exportClassesData;
            window.viewClassStudents = viewClassStudents;

            await renderClassStats();
        }

        /**
         * Renders summary stat cards into #class-stats-container on the Class
         * Management page: total classes, total active students, average
         * class utilization, and a breakdown by level (Nursery vs Primary).
         */
        async function renderClassStats() {
            const container = document.getElementById('class-stats-container');
            if (!container) return;

            const classes = state.classes || [];
            const activeClasses = classes.filter(c => c.is_active);
            const totalStudents = state.students.filter(s => s.status === 'Active').length;
            const totalCapacity = activeClasses.reduce((sum, c) => sum + (c.capacity || 40), 0);
            const avgUtilization = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;
            const nurseryCount = activeClasses.filter(c => c.level === 'Nursery').length;
            const primaryCount = activeClasses.filter(c => c.level !== 'Nursery').length;

            container.innerHTML = `
                <div class="stat-card"><div class="stat-value">${activeClasses.length}</div><div class="stat-label">🏛️ Active Classes</div></div>
                <div class="stat-card"><div class="stat-value">${totalStudents}</div><div class="stat-label">👥 Total Students</div></div>
                <div class="stat-card"><div class="stat-value">${avgUtilization.toFixed(0)}%</div><div class="stat-label">📊 Avg. Utilization</div></div>
                <div class="stat-card"><div class="stat-value">${nurseryCount} / ${primaryCount}</div><div class="stat-label">🎒 Nursery / Primary</div></div>
            `;
        }


        /**
         * Manual backup (JSON download of all tables).
         * Auto-backup every 6 hours with 5-rotation history.
         * Restore from a downloaded backup file.
         */
        async function renderBackupRestore(container) {
            await ensureStateLoaded();

            let backupHistory = [];
            try {
                backupHistory = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
            } catch (e) {
                backupHistory = [];
            }

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">💾 Backup & Restore</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.showBackupList()">📋 Backup History</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportAllBackups()">📤 Export All Backups</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <!-- MANUAL BACKUP -->
                        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                            <h4 style="margin-bottom: 12px;">💾 MANUAL BACKUP</h4>
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Download a complete backup of all school data.</p>
                            <div class="btn-group">
                                <button class="btn btn-primary" onclick="window.doFullBackupWithHistory()">📥 Download Full Backup</button>
                                <button class="btn btn-outline" onclick="window.createFullBackup()">💾 Create Backup (Keep in System)</button>
                            </div>
                            <span style="margin-left: 12px; font-size: 12px; color: var(--text-muted);">Last backup: ${backupHistory[0] ? fmtDate(backupHistory[0].date) : 'Never'}</span>
                        </div>

                        <!-- RESTORE FROM BACKUP -->
                        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                            <h4 style="margin-bottom: 12px;">🔄 RESTORE FROM BACKUP</h4>
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">⚠️ Warning: Restoring will replace ALL current data!</p>
                            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                <input type="file" id="restore-file" accept=".json" style="display:none" onchange="window.previewRestoreFile()">
                                <button class="btn btn-outline" onclick="document.getElementById('restore-file').click()">📂 Select Backup File</button>
                                <button class="btn btn-danger" id="restore-btn" style="display:none" onclick="window.confirmRestore()">⚠️ Restore Data</button>
                            </div>
                            <div id="restore-preview" style="margin-top: 12px; display: none;"></div>
                        </div>

                        <!-- AUTOMATIC BACKUP SCHEDULE -->
                        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--r-lg);">
                            <h4 style="margin-bottom: 12px;">🤖 AUTOMATIC BACKUP SCHEDULE</h4>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Enable Auto-Backup</label>
                                    <select id="auto-backup-enabled" class="form-control">
                                        <option value="true" ${localStorage.getItem('auto_backup_enabled') === 'true' ? 'selected' : ''}>Yes</option>
                                        <option value="false" ${localStorage.getItem('auto_backup_enabled') !== 'true' ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Frequency</label>
                                    <select id="auto-backup-frequency" class="form-control">
                                        <option value="daily" ${localStorage.getItem('auto_backup_frequency') === 'daily' ? 'selected' : ''}>Daily</option>
                                        <option value="weekly" ${localStorage.getItem('auto_backup_frequency') === 'weekly' ? 'selected' : ''}>Weekly</option>
                                        <option value="monthly" ${localStorage.getItem('auto_backup_frequency') === 'monthly' || !localStorage.getItem('auto_backup_frequency') ? 'selected' : ''}>Monthly</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Keep backups</label>
                                    <select id="auto-backup-keep" class="form-control">
                                        <option value="3">Last 3 backups</option>
                                        <option value="5">Last 5 backups</option>
                                        <option value="10" selected>Last 10 backups</option>
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-outline" onclick="window.saveAutoBackupSettings()" style="margin-top: 12px;">💾 Save Settings</button>
                        </div>

                        <!-- BACKUP HISTORY -->
                        <div>
                            <h4 style="margin-bottom: 12px;">📋 BACKUP HISTORY</h4>
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Size</th>
                                            <th>Records</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="backup-history-tbody">
                                        ${backupHistory.map(b => `
                                            <tr>
                                                <td>${fmtDateTime(b.date)}</span>
                                                <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
                                                <td>${b.size || '—'} </span>
                                                <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</span>
                                                <td>
                                                    <button class="btn btn-sm btn-outline" onclick="window.downloadBackupFile('${b.filename}', '${b.data}')">📥 Download</button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteBackupRecord('${b.filename}')">🗑️ Delete</button>
                                                 </span>
                                            </table>
                                        `).join('') || '<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No backups found</span>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Register functions
            window.doFullBackupWithHistory = doFullBackupWithHistory;
            window.createFullBackup = createFullBackup;
            window.previewRestoreFile = previewRestoreFile;
            window.confirmRestore = confirmRestore;
            window.saveAutoBackupSettings = saveAutoBackupSettings;
            window.showBackupList = showBackupList;
            window.exportAllBackups = exportAllBackups;
            window.downloadBackupFile = downloadBackupFile;
            window.deleteBackupRecord = deleteBackupRecord;
        }


        /**
         * Activity log viewer: who did what, when.
         * Filter by user, role, action type. Export to Excel.
         */
        async function renderSystemLogs(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            let logs = state.activityLogs || [];
            logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Get unique users and actions for filters
            const uniqueUsers = [...new Set(logs.map(l => l.user_role).filter(Boolean))];
            const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📋 System Logs</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportAllLogs()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="window.clearOldLogs()">🗑️ Clear Old Logs</button>
                            <button class="btn btn-sm btn-outline" onclick="window.refreshLogs()">🔄 Refresh</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="log-user-filter" class="form-control" style="width:130px" onchange="window.filterLogs()">
                                <option value="">All Users</option>
                                ${uniqueUsers.map(u => `<option value="${u}">${esc(u)}</option>`).join('')}
                            </select>
                            <select id="log-action-filter" class="form-control" style="width:150px" onchange="window.filterLogs()">
                                <option value="">All Actions</option>
                                ${uniqueActions.slice(0, 20).map(a => `<option value="${a}">${esc(a)}</option>`).join('')}
                            </select>
                            <select id="log-entity-filter" class="form-control" style="width:130px" onchange="window.filterLogs()">
                                <option value="">All Entities</option>
                                <option value="students">Students</option>
                                <option value="teachers">Teachers</option>
                                <option value="payments">Payments</option>
                                <option value="assessments">Assessments</option>
                                <option value="marks">Marks</option>
                                <option value="fees">Fees</option>
                            </select>
                            <input type="date" id="log-date-start" class="form-control" style="width:140px" onchange="window.filterLogs()">
                            <input type="date" id="log-date-end" class="form-control" style="width:140px" onchange="window.filterLogs()">
                            <input type="text" id="log-search" class="form-control flex-1" placeholder="🔍 Search logs..." oninput="window.filterLogs()">
                            <span class="result-count" id="log-count"></span>
                        </div>

                        <div class="table-wrapper" id="logs-table-container" style="max-height:500px; overflow-y:auto">
                            <div class="loading-container"><div class="spinner"></div><p>Loading logs...</p></div>
                        </div>

                        <div class="pagination" id="logs-pagination" style="margin-top:16px"></div>
                    </div>
                </div>
            `;

            window.filterLogs = filterLogs;
            window.exportAllLogs = exportAllLogs;
            window.clearOldLogs = clearOldLogs;
            window.refreshLogs = refreshLogs;
            window.viewLogDetails = viewLogDetails;

            window._allLogs = logs;
            window._currentPage = 1;
            window._pageSize = 50;

            filterLogs();
        }


        /**
         * System health dashboard: DB connection status, table record counts,
         * last backup time, offline queue depth, and browser capabilities.
         */
        async function renderSystemHealth(container) {
            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🩺 System Health Monitor</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" onclick="window.runSystemHealthCheck()">🔄 Run Health Check</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportHealthReport()">📥 Export Report</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div id="health-status" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                            <div class="loading-container"><div class="spinner"></div><p>Loading system status...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Database Status</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="db-status" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Loading database status...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">⚠️ System Alerts</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="system-alerts" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Loading alerts...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📈 Performance Metrics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="performance-metrics" class="form-grid">
                            <div class="loading-container"><div class="spinner"></div><p>Loading metrics...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">💾 Cache Statistics</span>
                    </div>
                    <div class="dash-card-body">
                        <div id="cache-stats" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Loading cache stats...</p></div>
                        </div>
                    </div>
                </div>
            `;

            await runSystemHealthCheck();
        }


        /**
         * Usage analytics: most-used modules, login frequency, data growth trends.
         */
        async function renderAnalytics(container) {
            await ensureStateLoaded();
            const user = getCurrentUser();
            if (!user || user.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const terms = state.terms.filter(t => t.academic_year_id === (state.currentAcadYear?.id || 1));

            // Prepare data for term comparison chart
            const classPerformanceByTerm = {};
            for (const term of terms) {
                classPerformanceByTerm[term.name] = [];
                for (const cls of state.classes) {
                    const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
                    const assessments = state.assessments.filter(a => a.class_id === cls.id && a.term_id === term.id);
                    let totalPct = 0, cnt = 0;
                    for (const st of students) {
                        let score = 0, max = 0;
                        for (const a of assessments) {
                            const m = state.marks.find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                            if (m) { score += m.score; max += a.max_marks; }
                        }
                        if (max > 0) { totalPct += (score / max) * 100; cnt++; }
                    }
                    classPerformanceByTerm[term.name].push({ class_name: cls.name, average: cnt > 0 ? totalPct / cnt : 0 });
                }
            }

            // Prepare subject performance data
            const subjectPerformance = [];
            for (const subject of state.subjects) {
                const termScores = { term1: 0, term2: 0, term3: 0 };
                for (const term of terms) {
                    const assessments = state.assessments.filter(a => a.subject_id === subject.id && a.term_id === term.id);
                    let totalPercentage = 0, count = 0;
                    for (const assessment of assessments) {
                        const marks = state.marks.filter(m => m.assessment_id === assessment.id);
                        for (const mark of marks) {
                            totalPercentage += (mark.score / assessment.max_marks) * 100;
                            count++;
                        }
                    }
                    const avg = count > 0 ? totalPercentage / count : 0;
                    if (term.name === 'Term 1') termScores.term1 = avg;
                    else if (term.name === 'Term 2') termScores.term2 = avg;
                    else if (term.name === 'Term 3') termScores.term3 = avg;
                }
                subjectPerformance.push({ name: subject.name, ...termScores });
            }

            // Prepare teacher ranking
            const teacherRanking = [];
            for (const teacher of state.teachers) {
                if (teacher.role !== 'teacher') continue;
                const assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                let totalAvg = 0;
                for (const classId of classIds) {
                    const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
                    const assessments = state.assessments.filter(a => a.class_id === classId && a.term_id === state.currentTerm?.id);
                    let totalPct = 0, cnt = 0;
                    for (const st of students) {
                        let score = 0, max = 0;
                        for (const a of assessments) {
                            const m = state.marks.find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                            if (m) { score += m.score; max += a.max_marks; }
                        }
                        if (max > 0) { totalPct += (score / max) * 100; cnt++; }
                    }
                    totalAvg += cnt > 0 ? totalPct / cnt : 0;
                }
                teacherRanking.push({ name: teacher.name, avg: classIds.length > 0 ? totalAvg / classIds.length : 0, classes: classIds.length });
            }
            teacherRanking.sort((a, b) => b.avg - a.avg);

            container.innerHTML = `
                <div class="analytics-module">
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <h3><span>📈</span> Advanced Analytics Dashboard</h3>
                            <div class="header-actions">
                                <button class="btn btn-sm btn-outline" onclick="exportAnalyticsReport()">📤 Export Report</button>
                            </div>
                        </div>
                        <div class="dash-card-body">
                            <div class="dash-card" style="margin-bottom:24px">
                                <div class="dash-card-header"><span class="dash-card-title">📊 Term Performance Comparison</span></div>
                                <div class="dash-card-body"><canvas id="termComparisonChart" style="height:300px"></canvas></div>
                            </div>
                            <div class="dash-card" style="margin-bottom:24px">
                                <div class="dash-card-header"><span class="dash-card-title">📖 Subject Performance by Term</span></div>
                                <div class="dash-card-body">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Subject</th><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Trend</th></tr></thead>
                                            <tbody>${subjectPerformance.slice(0, 15).map(s => `
                                                <tr>
                                                    <td><strong>${esc(s.name)}</strong></td>
                                                    <td><span class="badge ${getGradeClass(s.term1)}">${s.term1.toFixed(1)}%</span></td>
                                                    <td><span class="badge ${getGradeClass(s.term2)}">${s.term2.toFixed(1)}%</span></td>
                                                    <td><span class="badge ${getGradeClass(s.term3)}">${s.term3.toFixed(1)}%</span></td>
                                                    <td>${s.term3 > s.term2 ? '📈 Improving' : (s.term3 < s.term2 ? '📉 Declining' : '📊 Stable')}</td>
                                                </tr>
                                            `).join('')}</tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div class="dash-card">
                                <div class="dash-card-header"><span class="dash-card-title">👩‍🏫 Teacher Performance Ranking</span></div>
                                <div class="dash-card-body">
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead><tr><th>Rank</th><th>Teacher</th><th>Class Avg</th><th>Classes</th><th>Trend</th></tr></thead>
                                            <tbody>${teacherRanking.slice(0, 15).map((t, idx) => `
                                                <tr>
                                                    <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</td>
                                                    <td><strong>${esc(t.name)}</strong></td>
                                                    <td><span class="badge ${getGradeClass(t.avg)}">${t.avg.toFixed(1)}%</span></td>
                                                    <td>${t.classes}</td>
                                                    <td><span class="stat-trend ${t.avg > 70 ? 'up' : (t.avg > 50 ? '' : 'down')}">${t.avg > 70 ? '📈 High' : (t.avg > 50 ? '📊 Average' : '📉 Low')}</td>
                                                </tr>
                                            `).join('')}</tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;

            // Render chart after DOM is ready
            setTimeout(() => {
                const ctx = document.getElementById('termComparisonChart')?.getContext('2d');
                if (ctx) {
                    const classNames = state.classes.slice(0, 8).map(c => c.name.substring(0, 3));
                    const term1Data = classPerformanceByTerm['Term 1']?.slice(0, 8).map(c => c.average) || [];
                    const term2Data = classPerformanceByTerm['Term 2']?.slice(0, 8).map(c => c.average) || [];
                    const term3Data = classPerformanceByTerm['Term 3']?.slice(0, 8).map(c => c.average) || [];

                    if (window.analyticsChart) window.analyticsChart.destroy();
                    window.analyticsChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: classNames,
                            datasets: [
                                { label: 'Term 1', data: term1Data, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3 },
                                { label: 'Term 2', data: term2Data, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 },
                                { label: 'Term 3', data: term3Data, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3 }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` } } },
                            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } }
                        }
                    });
                }
            }, 200);
        }


        /**
         * Configure analytics data retention and display options.
         */
        async function renderAnalyticsSettings(container) {
            await ensureStateLoaded();

            const settings = state.schoolSettings;

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Analytics Settings</span>
                        <button class="btn btn-sm btn-success" onclick="window.saveAnalyticsSettings()">💾 Save Settings</button>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Default Analytics Period</label>
                                <select id="analytics-period" class="form-control">
                                    <option value="current_term" ${settings.analytics_period === 'current_term' ? 'selected' : ''}>Current Term</option>
                                    <option value="current_year" ${settings.analytics_period === 'current_year' ? 'selected' : ''}>Current Academic Year</option>
                                    <option value="last_3_years" ${settings.analytics_period === 'last_3_years' ? 'selected' : ''}>Last 3 Years</option>
                                    <option value="all" ${settings.analytics_period === 'all' ? 'selected' : ''}>All Time</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Dashboard Charts Refresh Rate (seconds)</label>
                                <input type="number" id="analytics-refresh-rate" value="${settings.analytics_refresh_rate || 60}" min="10" max="3600" class="form-control">
                                <small class="field-hint">How often auto-refresh analytics charts (0 = disabled)</small>
                            </div>
                            <div class="form-group">
                                <label><input type="checkbox" id="analytics-show-comparison" ${settings.analytics_show_comparison !== false ? 'checked' : ''}> Show Year-over-Year Comparison</label>
                            </div>
                            <div class="form-group">
                                <label><input type="checkbox" id="analytics-show-trend-lines" ${settings.analytics_show_trend_lines !== false ? 'checked' : ''}> Show Trend Lines on Charts</label>
                            </div>
                            <div class="form-group full">
                                <label>Default Report Format</label>
                                <select id="analytics-default-format" class="form-control">
                                    <option value="pdf" ${settings.analytics_default_format === 'pdf' ? 'selected' : ''}>PDF Document</option>
                                    <option value="excel" ${settings.analytics_default_format === 'excel' ? 'selected' : ''}>Excel Spreadsheet</option>
                                    <option value="csv" ${settings.analytics_default_format === 'csv' ? 'selected' : ''}>CSV File</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📈 Report Templates</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="window.exportReportTemplates()">📥 Export Templates</button>
                            <button class="btn btn-sm btn-primary" onclick="window.openUploadTemplateModal()">📤 Upload Custom Template</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div id="report-templates-list" class="table-wrapper">
                            <div class="loading-container"><div class="spinner"></div><p>Loading templates...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Cached Analytics Data</span>
                        <button class="btn btn-sm btn-danger" onclick="window.clearAnalyticsCache()">🗑️ Clear Cache</button>
                    </div>
                    <div class="dash-card-body">
                        <div id="cache-stats" class="alert alert-info">
                            Last cache update: ${localStorage.getItem('analytics_cache_time') ? new Date(localStorage.getItem('analytics_cache_time')).toLocaleString() : 'Never'}
                        </div>
                    </div>
                </div>
            `;

            /**
             * Renders the built-in report template list (plus any uploaded
             * custom template) into #report-templates-list.
             */
            async function loadReportTemplates() {
                const container = document.getElementById('report-templates-list');
                if (!container) return;
                const templates = [
                    { id: 'report_card', name: 'Report Card', desc: 'Standard report card template with grades and comments' },
                    { id: 'transcript', name: 'Transcript', desc: 'Academic transcript with all subjects and terms' },
                    { id: 'attendance', name: 'Attendance Report', desc: 'Monthly attendance summary report' },
                    { id: 'fee_statement', name: 'Fee Statement', desc: 'Fee payment statement with receipt history' }
                ];
                const hasCustom = !!localStorage.getItem('custom_report_template');
                const activeTemplate = localStorage.getItem('report_template') || 'report_card';
                container.innerHTML = `
                    <table class="data-table">
                        <thead><tr><th>Template</th><th>Description</th><th>Status</th></tr></thead>
                        <tbody>
                            ${templates.map(t => `
                                <tr>
                                    <td><strong>${esc(t.name)}</strong></td>
                                    <td>${esc(t.desc)}</td>
                                    <td><span class="badge ${activeTemplate === t.id ? 'badge-success' : 'badge-info'}">${activeTemplate === t.id ? '✅ Active' : 'Built-in'}</span></td>
                                </tr>
                            `).join('')}
                            ${hasCustom ? `
                                <tr>
                                    <td><strong>Custom Template</strong></td>
                                    <td>Uploaded custom report template</td>
                                    <td><span class="badge ${activeTemplate === 'custom' ? 'badge-success' : 'badge-info'}">${activeTemplate === 'custom' ? '✅ Active' : 'Uploaded'}</span></td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                `;
            }

            await loadReportTemplates();

            window.saveAnalyticsSettings = saveAnalyticsSettings;
            window.exportReportTemplates = exportReportTemplates;
            window.openUploadTemplateModal = openUploadTemplateModal;
            window.clearAnalyticsCache = clearAnalyticsCache;
        }


        /**
         * Change the Supabase project URL and API key.
         * Tests the connection before saving. Changes take effect on next load.
         */
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
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔌 API Settings</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-warning">
                            <strong>⚠️ Warning:</strong> Changing API settings will affect all database connections.
                            The page will reload after saving. Make sure you have the correct credentials.
                        </div>
                        <div class="form-grid">
                            <div class="form-group full">
                                <label>Supabase URL</label>
                                <input type="text" id="api-url" value="${esc(currentUrl)}" placeholder="https://your-project.supabase.co" class="form-control">
                                <small class="field-hint">Your Supabase project URL (e.g., https://xxxxx.supabase.co)</small>
                            </div>
                            <div class="form-group full">
                                <label>Anon Key / Public API Key</label>
                                <div class="pw-field" style="display:flex; gap:8px;">
                                    <input type="password" id="api-key" value="${esc(currentKey)}" placeholder="eyJhbGciOiJIUzI1NiIs..." class="form-control" style="flex:1">
                                    <button class="btn btn-sm btn-outline" onclick="window.toggleApiKeyVisibility()" type="button">👁️ Show/Hide</button>
                                </div>
                                <small class="field-hint">Your Supabase anon/public key from Project Settings > API</small>
                            </div>
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

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">🗄️ Database Information</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Current Environment</label>
                                <input type="text" readonly value="${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'Development' : 'Production'}" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>API Version</label>
                                <input type="text" readonly value="v1 (REST)" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Last Connection Test</label>
                                <input type="text" readonly id="last-connection-test" value="${localStorage.getItem('last_api_test') || 'Never'}" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Default URL</label>
                                <input type="text" readonly value="${SUPABASE_URL_DEFAULT}" class="form-control">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }


        /**
         * General settings hub (redirects to sub-sections).
         */
        async function renderSettings(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            if (user?.role !== 'admin') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            const modules = [
                { id: 'school-settings', icon: '🏫', name: 'School Settings', description: 'Configure school information, logo, contact details' },
                { id: 'academic-calendar', icon: '📅', name: 'Academic Calendar', description: 'Manage terms, holidays, and auto-reset rules' },
                { id: 'class-management', icon: '🏛️', name: 'Class Management', description: 'Manage classes, sections, capacities' },
                { id: 'grading-scale', icon: '📊', name: 'Grading Scale', description: 'Configure grade boundaries and descriptions' },
                { id: 'user-management', icon: '👥', name: 'User Management', description: 'Manage teacher and staff accounts' },
                { id: 'backup-restore', icon: '💾', name: 'Backup & Restore', description: 'Backup and restore system data' },
                { id: 'system-logs', icon: '📋', name: 'System Logs', description: 'View and export system activity logs' },
                { id: 'api-settings', icon: '🔌', name: 'API Settings', description: 'Configure Supabase connection settings' },
                { id: 'academic-years', icon: '📆', name: 'Academic Years', description: 'Manage academic years and terms' },
                { id: 'analytics-settings', icon: '📈', name: 'Analytics Settings', description: 'Configure analytics and reporting preferences' },
                { id: 'system-health', icon: '🩺', name: 'System Health', description: 'Monitor system performance and status' }
            ];

            container.innerHTML = `
                <div class="settings-container">
                    <div class="dash-card">
                        <div class="dash-card-header">
                            <span class="dash-card-title">⚙️ System Settings</span>
                        </div>
                        <div class="dash-card-body">
                            <div class="settings-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px">
                                ${modules.map(module => `
                                    <div class="setting-card" style="
                                        background:var(--bg-secondary);
                                        border:1px solid var(--border-light);
                                        border-radius:var(--r-lg);
                                        padding:16px;
                                        cursor:pointer;
                                        transition:all 0.2s;
                                        display:flex;
                                        align-items:center;
                                        gap:16px;
                                    " onclick="window.navigateTo('${module.id}')">
                                        <div style="font-size:2rem;">${module.icon}</div>
                                        <div style="flex:1">
                                            <div style="font-weight:700; margin-bottom:4px">${module.name}</div>
                                            <div style="font-size:12px; color:var(--text-muted)">${module.description}</div>
                                        </div>
                                        <div style="font-size:1.2rem; color:var(--text-muted)">→</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="dash-card" style="margin-top:20px">
                        <div class="dash-card-header">
                            <span class="dash-card-title">ℹ️ System Information</span>
                        </div>
                        <div class="dash-card-body">
                            <div class="form-grid">
                                <div class="form-group"><label>Version</label><input readonly value="7.0.0" class="form-control"></div>
                                <div class="form-group"><label>Environment</label><input readonly value="${window.location.hostname === 'localhost' ? 'Development' : 'Production'}" class="form-control"></div>
                                <div class="form-group"><label>Last Login</label><input readonly value="${new Date().toLocaleString()}" class="form-control"></div>
                                <div class="form-group"><label>Database Status</label><input readonly value="${navigator.onLine ? '🟢 Connected' : '🔴 Offline'}" class="form-control"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 55 — NOTIFICATIONS & COMMUNICATION
