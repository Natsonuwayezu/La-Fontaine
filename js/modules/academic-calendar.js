// js/modules/academic-calendar.js
// Academic Calendar Management - Term dates, holidays, auto-reset rules


/**
 * Render Academic Calendar page
 * @param {HTMLElement} container - DOM element to render into
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
                            <button class="btn btn-sm btn-outline" onclick="window.importRwandaHolidays()">🇷🇼 Import RW Holidays</button>
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
                                        <td>${fmtDate(h.start_date)}</td>
                                        <td>${fmtDate(h.end_date)}</td>
                                        <td><span class="badge ${h.type === 'Public Holiday' ? 'badge-info' : 'badge-warning'}">${esc(h.type)}</span></td>
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

function getTermStatus(term) {
    const today = new Date();
    const start = term.start_date ? new Date(term.start_date) : null;
    const end = term.end_date ? new Date(term.end_date) : null;
    if (!start || !end) return 'upcoming';
    if (today > end) return 'completed';
    if (today >= start && today <= end) return 'current';
    return 'upcoming';
}

async function loadAcademicCalendar() {
    const yearId = document.getElementById('cal-year')?.value;
    if (!yearId) return;
    const year = state.academicYears.find(y => y.id == yearId);
    if (year) {
        state.currentAcadYear = year;
        await renderAcademicCalendar(document.getElementById('dynamic-content'));
    }
}

async function updateTermDates(termId) {
    const start = document.getElementById(`term-start-${termId}`)?.value;
    const end = document.getElementById(`term-end-${termId}`)?.value;
    const mid = document.getElementById(`term-mid-${termId}`)?.value;
    await update('terms', termId, { start_date: start, end_date: end, midterm_date: mid });
    await refreshTable('terms');
    showToast('✅ Term dates updated', 'success');
}

async function setCurrentTerm(termId) {
    const term = state.terms.find(t => t.id === termId);
    if (term) {
        await updateSchoolSetting('current_term', term.name);
        await loadInitialData();
        showToast(`✅ Current term set to ${term.name}`, 'success');
        renderAcademicCalendar(document.getElementById('dynamic-content'));
    }
}

function openAddHolidayModal() {
    showModal(`
        <div class="modal-overlay" id="holiday-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>➕ Add Holiday</h3>
                    <button class="modal-close" onclick="closeModal('holiday-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Holiday Name *</label><input type="text" id="holiday-name" placeholder="e.g., Christmas Break"></div>
                        <div class="form-group"><label>Start Date *</label><input type="date" id="holiday-start"></div>
                        <div class="form-group"><label>End Date *</label><input type="date" id="holiday-end"></div>
                        <div class="form-group"><label>Type</label>
                            <select id="holiday-type">
                                <option value="Public Holiday">Public Holiday</option>
                                <option value="Vacation">Vacation</option>
                                <option value="Event">Event</option>
                            </select>
                        </div>
                        <div class="form-group full"><label>Description</label><textarea id="holiday-desc" rows="2"></textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('holiday-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveHoliday()">Add Holiday</button>
                </div>
            </div>
        </div>
    `);
}

async function saveHoliday() {
    const name = document.getElementById('holiday-name')?.value.trim();
    const start = document.getElementById('holiday-start')?.value;
    const end = document.getElementById('holiday-end')?.value;
    const type = document.getElementById('holiday-type')?.value;
    const desc = document.getElementById('holiday-desc')?.value;
    const yearId = state.currentAcadYear?.id;

    if (!name || !start || !end) {
        showToast('Name, start date, and end date are required', 'warning');
        return;
    }

    await insert('holidays', {
        name, start_date: start, end_date: end, type, description: desc,
        academic_year_id: yearId, created_at: new Date().toISOString()
    });

    closeModal('holiday-modal');
    showToast('✅ Holiday added', 'success');
    renderAcademicCalendar(document.getElementById('dynamic-content'));
}

async function saveAcademicCalendar() {
    const monthly = document.getElementById('auto-monthly')?.value;
    const termly = document.getElementById('auto-termly')?.value;
    const annual = document.getElementById('auto-annual')?.value;
    const lockMarks = document.getElementById('auto-lock-marks')?.checked;
    const archiveDays = document.getElementById('auto-archive-days')?.value;

    if (monthly) await updateSchoolSetting('auto_monthly', monthly);
    if (termly) await updateSchoolSetting('auto_termly', termly);
    if (annual) await updateSchoolSetting('auto_annual', annual);
    if (lockMarks !== undefined) await updateSchoolSetting('auto_lock_marks', lockMarks);
    if (archiveDays) await updateSchoolSetting('auto_archive_days', archiveDays);

    showToast('✅ Calendar settings saved', 'success');
}

async function generateYearCalendar() {
    const currentYear = state.currentAcadYear;
    const terms = state.terms.filter(t => t.academic_year_id === currentYear?.id);
    let holidays = [];
    try { holidays = await getAll('holidays', { academic_year_id: currentYear?.id }); } catch (e) { holidays = []; }

    const html = `<!DOCTYPE html><html><head><title>Academic Calendar - ${currentYear?.name}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center;color:#1a3a5c}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#1a3a5c;color:white}.term{background:#e8f0fe}.holiday{background:#fee2e2}@media print{body{padding:0}}</style>
        </head><body>
        <h1>🏫 ECOLE LA FONTAINE</h1><h2 style="text-align:center">Academic Calendar - ${currentYear?.name}</h2>
        <table><thead><tr><th>Event Type</th><th>Name</th><th>Start Date</th><th>End Date</th><th>Notes</th></tr></thead>
        <tbody>
        <tr class="term"><td>📅 Academic Year</td><td><strong>${esc(currentYear?.name)}</strong></td><td>${fmtDate(currentYear?.start_date)}</td><td>${fmtDate(currentYear?.end_date)}</td><td></td></tr>
        ${terms.map(t => `<tr class="term"><td>📚 Term</td><td><strong>${esc(t.name)}</strong></td><td>${fmtDate(t.start_date)}</td><td>${fmtDate(t.end_date)}</td><td>Midterm: ${fmtDate(t.midterm_date)}</td></tr>`).join('')}
        ${holidays.map(h => `<tr class="holiday"><td>🏖️ Holiday</td><td>${esc(h.name)}</td><td>${fmtDate(h.start_date)}</td><td>${fmtDate(h.end_date)}</td><td>${esc(h.type || '')}</td></tr>`).join('')}
        </tbody></table><p style="text-align:center;margin-top:30px;">Generated on ${new Date().toLocaleDateString()}</p>
        </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
}

async function exportAcademicCalendar() {
    const currentYear = state.currentAcadYear;
    const terms = state.terms.filter(t => t.academic_year_id === currentYear?.id);
    let holidays = [];
    try { holidays = await getAll('holidays', { academic_year_id: currentYear?.id }); } catch (e) { holidays = []; }

    const exportData = [
        { Type: 'Academic Year', Name: currentYear?.name, Start: currentYear?.start_date, End: currentYear?.end_date },
        ...terms.map(t => ({ Type: 'Term', Name: t.name, Start: t.start_date, End: t.end_date, Midterm: t.midterm_date })),
        ...holidays.map(h => ({ Type: 'Holiday', Name: h.name, Start: h.start_date, End: h.end_date, Description: h.description }))
    ];

    exportToExcel(exportData, `Academic_Calendar_${currentYear?.name || 'export'}`);
    showToast('✅ Calendar exported', 'success');
}

async function editHoliday(holidayId) {
    const holiday = await getById('holidays', holidayId);
    if (!holiday) return;

    showModal(`
        <div class="modal-overlay" id="edit-holiday-modal">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header"><h3>✏️ Edit Holiday</h3><button class="modal-close" onclick="closeModal('edit-holiday-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group"><label>Holiday Name *</label><input type="text" id="edit-holiday-name" value="${esc(holiday.name)}"></div>
                        <div class="form-group"><label>Start Date *</label><input type="date" id="edit-holiday-start" value="${holiday.start_date || ''}"></div>
                        <div class="form-group"><label>End Date *</label><input type="date" id="edit-holiday-end" value="${holiday.end_date || ''}"></div>
                        <div class="form-group"><label>Type</label><select id="edit-holiday-type"><option value="Public Holiday" ${holiday.type === 'Public Holiday' ? 'selected' : ''}>Public Holiday</option><option value="Vacation" ${holiday.type === 'Vacation' ? 'selected' : ''}>Vacation</option><option value="Event" ${holiday.type === 'Event' ? 'selected' : ''}>Event</option></select></div>
                        <div class="form-group full"><label>Description</label><textarea id="edit-holiday-desc" rows="2">${esc(holiday.description || '')}</textarea></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-holiday-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="updateHoliday(${holidayId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function updateHoliday(holidayId) {
    const name = document.getElementById('edit-holiday-name')?.value.trim();
    const start = document.getElementById('edit-holiday-start')?.value;
    const end = document.getElementById('edit-holiday-end')?.value;
    const type = document.getElementById('edit-holiday-type')?.value;
    const desc = document.getElementById('edit-holiday-desc')?.value;

    if (!name || !start || !end) { showToast('Name, start date, and end date are required', 'warning'); return; }

    await update('holidays', holidayId, {
        name, start_date: start, end_date: end, type, description: desc,
        updated_at: new Date().toISOString()
    });

    closeModal('edit-holiday-modal');
    showToast('✅ Holiday updated', 'success');
    renderAcademicCalendar(document.getElementById('dynamic-content'));
}

async function deleteHoliday(holidayId) {
    if (!await confirmDialog('Delete this holiday?')) return;
    await remove('holidays', holidayId);
    showToast('✅ Holiday deleted', 'success');
    renderAcademicCalendar(document.getElementById('dynamic-content'));
}

async function importRwandaHolidays() {
    const yearId = state.currentAcadYear?.id;
    if (!yearId) { showToast('No active academic year selected', 'error'); return; }
    if (!await confirmDialog('Import all Rwanda public holidays for 2026?')) return;

    const holidays2026 = [
        { name: "New Year's Day", start_date: '2026-01-01', end_date: '2026-01-01', type: 'Public Holiday' },
        { name: "New Year's Holiday", start_date: '2026-01-02', end_date: '2026-01-02', type: 'Public Holiday' },
        { name: 'National Heroes Day', start_date: '2026-02-01', end_date: '2026-02-01', type: 'Public Holiday' },
        { name: 'Genocide Memorial Day', start_date: '2026-04-07', end_date: '2026-04-13', type: 'Public Holiday' },
        { name: 'Good Friday', start_date: '2026-04-03', end_date: '2026-04-03', type: 'Public Holiday' },
        { name: 'Easter Monday', start_date: '2026-04-06', end_date: '2026-04-06', type: 'Public Holiday' },
        { name: 'Labour Day', start_date: '2026-05-01', end_date: '2026-05-01', type: 'Public Holiday' },
        { name: 'Eid al-Fitr', start_date: '2026-05-20', end_date: '2026-05-20', type: 'Public Holiday' },
        { name: 'Eid al-Adha', start_date: '2026-07-28', end_date: '2026-07-28', type: 'Public Holiday' },
        { name: 'Liberation Day', start_date: '2026-07-04', end_date: '2026-07-04', type: 'Public Holiday' },
        { name: 'Umuganura (Harvest Day)', start_date: '2026-08-01', end_date: '2026-08-01', type: 'Public Holiday' },
        { name: 'Assumption Day', start_date: '2026-08-15', end_date: '2026-08-15', type: 'Public Holiday' },
        { name: 'Christmas Day', start_date: '2026-12-25', end_date: '2026-12-25', type: 'Public Holiday' },
        { name: 'Boxing Day', start_date: '2026-12-26', end_date: '2026-12-26', type: 'Public Holiday' }
    ];

    let added = 0;
    for (const h of holidays2026) {
        try {
            await insert('holidays', { ...h, academic_year_id: yearId, created_at: new Date().toISOString() });
            added++;
        } catch (e) { console.warn('Holiday insert failed:', e); }
    }
    showToast(`✅ Imported ${added} Rwanda public holidays for 2026`, 'success');
    renderAcademicCalendar(document.getElementById('dynamic-content'));
}

// Helper imports


