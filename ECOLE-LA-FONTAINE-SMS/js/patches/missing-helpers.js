// js/patches/missing-helpers.js
// Source lines: 23658–24004 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        // ── Subjects module helpers ───────────────────────────────────────────


        /**
         * Create a new subject. Called from the Add Subject modal.
         * Delegates to window._saveNewSubject if the newer modal is open,
         * otherwise reads legacy field IDs for backward compatibility.
         */
        async function createSubject() {
            // If the newer modal is open, delegate to its inline handler
            if (typeof window._saveNewSubject === 'function') {
                await window._saveNewSubject();
                return;
            }
            // Legacy fallback — reads old field IDs
            const name  = document.getElementById('new-subj-name')?.value?.trim()
                       || document.getElementById('ns-name')?.value?.trim();
            const code  = (document.getElementById('new-subj-code')?.value?.trim()
                       || document.getElementById('ns-code')?.value?.trim() || '').toUpperCase();
            const level = document.getElementById('new-subj-level')?.value
                       || document.getElementById('ns-level')?.value || 'Primary';
            const mg    = parseInt(document.getElementById('new-subj-mg')?.value) || 50;
            const ex    = parseInt(document.getElementById('new-subj-ex')?.value) || 50;
            const mid   = document.getElementById('new-subj-midonly')?.checked || false;
            if (!name || !code) { showToast('Name and code are required', 'warning'); return; }
            const r = await insert('subjects', {
                name, code, level, mg_max: mg, ex_max: ex,
                appears_only_post_midterm: mid,
                is_active: true,
                sort_order: (state.subjects || []).length + 1,
                created_at: new Date().toISOString()
            });
            if (!r) { showToast('Failed to create subject', 'error'); return; }
            await refreshTable('subjects');
            closeModal();
            showToast('✅ Subject created', 'success');
            renderSubjects(document.getElementById('dynamic-content'));
        }

        async function saveAllSubjects() {
            for (const s of state.subjects) {
                const name   = document.getElementById(`subj-name-${s.id}`)?.value;
                const mg     = parseInt(document.getElementById(`subj-mg-${s.id}`)?.value);
                const ex     = parseInt(document.getElementById(`subj-ex-${s.id}`)?.value);
                const midonly = document.getElementById(`subj-midonly-${s.id}`)?.checked;
                if (name   && name   !== s.name)                      await update('subjects', s.id, { name });
                if (mg     && mg     !== s.mg_max)                     await update('subjects', s.id, { mg_max: mg });
                if (ex     && ex     !== s.ex_max)                     await update('subjects', s.id, { ex_max: ex });
                if (midonly !== s.appears_only_post_midterm)            await update('subjects', s.id, { appears_only_post_midterm: midonly });
            }
            await refreshTable('subjects');
            showToast('✅ Subjects saved', 'success');
            renderSubjects(document.getElementById('dynamic-content'));
        }

        async function toggleSubjectStatus(id, isActive) {
            await update('subjects', id, { is_active: !isActive });
            await refreshTable('subjects');
            renderSubjects(document.getElementById('dynamic-content'));
        }



        // ── Academic Calendar helpers ─────────────────────────────────────────
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
            const end   = document.getElementById(`term-end-${termId}`)?.value;
            const mid   = document.getElementById(`term-mid-${termId}`)?.value;
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

        async function saveAcademicCalendar() {
            const monthly   = document.getElementById('auto-monthly')?.value;
            const termly    = document.getElementById('auto-termly')?.value;
            const annual    = document.getElementById('auto-annual')?.value;
            const lockMarks = document.getElementById('auto-lock-marks')?.checked;
            const archiveDays = document.getElementById('auto-archive-days')?.value;
            if (monthly)   await updateSchoolSetting('auto_monthly',       monthly);
            if (termly)    await updateSchoolSetting('auto_termly',        termly);
            if (annual)    await updateSchoolSetting('auto_annual',        annual);
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
                <style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px}
                th{background:#1a3a5c;color:white}.term{background:#e8f0fe}.holiday{background:#fee2e2}
                @media print{body{padding:0}}</style></head><body>
                <h1>🏫 ECOLE LA FONTAINE</h1>
                <h2 style="text-align:center">Academic Calendar — ${currentYear?.name}</h2>
                <table><thead><tr><th>Type</th><th>Name</th><th>Start</th><th>End</th><th>Notes</th></tr></thead><tbody>
                <tr class="term"><td>📅 Academic Year</td><td><strong>${esc(currentYear?.name)}</strong></td>
                    <td>${fmtDate(currentYear?.start_date)}</td><td>${fmtDate(currentYear?.end_date)}</td><td></td></tr>
                ${terms.map(t => `<tr class="term"><td>📚 Term</td><td><strong>${esc(t.name)}</strong></td>
                    <td>${fmtDate(t.start_date)}</td><td>${fmtDate(t.end_date)}</td>
                    <td>Midterm: ${fmtDate(t.midterm_date)}</td></tr>`).join('')}
                ${holidays.map(h => `<tr class="holiday"><td>🏖️ Holiday</td><td>${esc(h.name)}</td>
                    <td>${fmtDate(h.date)}</td><td>${fmtDate(h.date)}</td>
                    <td>${esc(h.holiday_type === 'public' ? 'Public Holiday' : (h.holiday_type === 'half-day' ? 'Half Day' : 'School Holiday'))}</td></tr>`).join('')}
                </tbody></table>
                <p style="text-align:center;margin-top:30px">Generated on ${new Date().toLocaleDateString()}</p>
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
                ...holidays.map(h => ({ Type: 'Holiday', Name: h.name, Start: h.date, End: h.date, Description: h.description }))
            ];
            exportToExcel(exportData, `Academic_Calendar_${currentYear?.name || 'export'}`);
            showToast('✅ Calendar exported', 'success');
        }

        async function updateHoliday(holidayId) {
            const name  = document.getElementById('edit-holiday-name')?.value.trim();
            const start = document.getElementById('edit-holiday-start')?.value;
            const end   = document.getElementById('edit-holiday-end')?.value;
            const type  = document.getElementById('edit-holiday-type')?.value;
            const desc  = document.getElementById('edit-holiday-desc')?.value;
            if (!name || !start || !end) { showToast('Name, start date, and end date are required', 'warning'); return; }
            await update('holidays', holidayId, {
                name, start_date: start, end_date: end, type, description: desc,
                updated_at: new Date().toISOString()
            });
            closeModal('edit-holiday-modal');
            showToast('✅ Holiday updated', 'success');
            renderAcademicCalendar(document.getElementById('dynamic-content'));
        }


        // ── Class Management helpers ──────────────────────────────────────────
        async function toggleClassActive(classId, isActive) {
            await update('classes', classId, { is_active: !isActive });
            await refreshTable('classes');
            renderClassManagement(document.getElementById('dynamic-content'));
        }

        async function updateClassCapacity(classId) {
            const cap = parseInt(document.getElementById(`cap-${classId}`)?.value);
            await update('classes', classId, { capacity: cap });
            showToast('✅ Capacity updated', 'success');
        }

        function openPromoteStudentsModal() {
            const promotionMap = {
                'NURSERY 1': 'NURSERY 2', 'NURSERY 2': 'NURSERY 3', 'NURSERY 3': 'PRIMARY 1',
                'PRIMARY 1': 'PRIMARY 2', 'PRIMARY 2': 'PRIMARY 3', 'PRIMARY 3': 'PRIMARY 4',
                'PRIMARY 4': 'PRIMARY 5', 'PRIMARY 5': 'PRIMARY 6', 'PRIMARY 6': 'GRADUATED'
            };
            showModal(`
                <div class="modal-overlay"><div class="modal">
                    <div class="modal-header"><h3>🚀 Promote Students</h3>
                        <button class="modal-close" onclick="closeModal()">✕</button></div>
                    <div class="modal-body"><div class="table-wrapper"><table class="data-table">
                        <thead><tr><th>From Class</th><th>To Class</th><th>Students</th><th>Select</th></tr></thead>
                        <tbody>${Object.entries(promotionMap).map(([from, to]) => {
                            const fromClass = state.classes.find(c => c.name === from);
                            const students  = fromClass ? state.students.filter(s => s.class_id === fromClass.id && s.status === 'Active') : [];
                            return `<tr><td>${from}</td><td>${to}</td><td>${students.length}</td>
                                <td><input type="checkbox" class="promote-class"
                                    data-from="${fromClass?.id}" data-to-name="${to}"
                                    ${students.length ? 'checked' : 'disabled'}></td></tr>`;
                        }).join('')}</tbody>
                    </table></div></div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn btn-warning" onclick="executePromotion()">Promote Selected</button>
                    </div>
                </div></div>`);
        }

        function exportClassesData() {
            const data = state.classes.map(c => ({
                'Class':          c.name,
                'Code':           c.code,
                'Level':          c.level,
                'Capacity':       c.capacity || 40,
                'Students':       state.students.filter(s => s.class_id === c.id && s.status === 'Active').length,
                'Utilization %':  c.capacity
                    ? ((state.students.filter(s => s.class_id === c.id && s.status === 'Active').length / c.capacity) * 100).toFixed(1)
                    : 0,
                'Status':         c.is_active ? 'Active' : 'Inactive',
                'Sort Order':     c.sort_order || 0
            }));
            exportToExcel(data, 'Classes_Export');
        }

        function viewClassStudents(classId) {
            const cls      = getClassById(classId);
            const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
            if (!students.length) { showToast(`No active students in ${cls?.name}`, 'info'); return; }
            showModal(`
                <div class="modal-overlay"><div class="modal modal-lg">
                    <div class="modal-header">
                        <h3>👥 Students in ${esc(cls?.name)} (${students.length})</h3>
                        <button class="modal-close" onclick="closeModal()">✕</button>
                    </div>
                    <div class="modal-body"><div class="table-wrapper"><table class="data-table">
                        <thead><tr><th>Code</th><th>Name</th><th>Gender</th><th>Guardian</th><th>Status</th></tr></thead>
                        <tbody>${students.map(s => `
                            <tr>
                                <td><code>${esc(s.student_code || '—')}</code></td>
                                <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
                                <td>${esc(s.gender || '—')}</td>
                                <td>${esc(s.guardian_name || '—')}</td>
                                <td><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span></td>
                            </tr>`).join('')}
                        </tbody>
                    </table></div></div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal()">Close</button>
                        <button class="btn btn-primary" onclick="closeModal(); window.navigateToWithData('student-list', { class_id: ${classId} })">📋 View All</button>
                    </div>
                </div></div>`);
        }


        // ── Backup & Restore helpers ──────────────────────────────────────────
        function saveAutoBackupSettings() {
            const enabled   = document.getElementById('auto-backup-enabled')?.value === 'true';
            const frequency = document.getElementById('auto-backup-frequency')?.value;
            const keep      = document.getElementById('auto-backup-keep')?.value;
            localStorage.setItem('auto_backup_enabled',   enabled);
            localStorage.setItem('auto_backup_frequency', frequency);
            localStorage.setItem('auto_backup_keep',      keep);
            showToast('✅ Auto-backup settings saved', 'success');
        }

        function showBackupList() {
            const BACKUP_KEY = 'elf_backup_history';
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { backups = []; }
            const rows = backups.map(b => `
                <tr>
                    <td>${fmtDateTime(b.date)}</td>
                    <td><span class="badge ${b.type === 'auto' ? 'badge-info' : 'badge-success'}">${b.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span></td>
                    <td>${b.records?.students || 0} students, ${b.records?.marks || 0} marks</td>
                    <td>${b.size || '—'}</td>
                    <td><button class="btn btn-sm btn-outline" onclick="downloadBackupFile('${esc(b.filename)}','')">📥 Download</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBackupRecord('${esc(b.filename)}')">🗑️</button></td>
                </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">No backup history found</td></tr>';
            showModal(`
                <div class="modal-overlay"><div class="modal modal-lg" style="max-width:700px">
                    <div class="modal-header"><h3>📋 Backup History</h3>
                        <button class="modal-close" onclick="closeModal()">✕</button></div>
                    <div class="modal-body"><div class="table-wrapper"><table class="data-table">
                        <thead><tr><th>Date</th><th>Type</th><th>Records</th><th>Size</th><th>Actions</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table></div></div>
                    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Close</button></div>
                </div></div>`);
        }

        function exportAllBackups() {
            const BACKUP_KEY = 'elf_backup_history';
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { backups = []; }
            if (!backups.length) { showToast('No backups to export', 'warning'); return; }
            const exportData = backups.map(b => ({
                date: b.date, type: b.type, filename: b.filename, size: b.size, records: b.records
            }));
            downloadBlob(
                JSON.stringify(exportData, null, 2),
                `Backup_History_${new Date().toISOString().split('T')[0]}.json`,
                'application/json'
            );
            showToast('✅ Backup history exported', 'success');
        }

        function deleteBackupRecord(filename) {
            const BACKUP_KEY = 'elf_backup_history';
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { backups = []; }
            backups = backups.filter(b => b.filename !== filename);
            localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
            showToast('✅ Backup record deleted', 'success');
            renderBackupRestore(document.getElementById('dynamic-content'));
        }

        // Expose new functions to window
        window.showSubjectTab          = showSubjectTab;
        window.openAddSubjectModal     = openAddSubjectModal;
        window.createSubject           = createSubject;
        window.saveAllSubjects         = saveAllSubjects;
        window.toggleSubjectStatus     = toggleSubjectStatus;
        window.deleteSubject           = deleteSubject;
        window.loadAcademicCalendar    = loadAcademicCalendar;
        window.updateTermDates         = updateTermDates;
        window.setCurrentTerm          = setCurrentTerm;
        window.saveAcademicCalendar    = saveAcademicCalendar;
        window.generateYearCalendar    = generateYearCalendar;
        window.exportAcademicCalendar  = exportAcademicCalendar;
        window.updateHoliday           = updateHoliday;
        window.toggleClassActive       = toggleClassActive;
        window.updateClassCapacity     = updateClassCapacity;
        window.openPromoteStudentsModal = openPromoteStudentsModal;
        window.exportClassesData       = exportClassesData;
        window.viewClassStudents       = viewClassStudents;
        window.saveAutoBackupSettings  = saveAutoBackupSettings;
        window.showBackupList          = showBackupList;
        window.exportAllBackups        = exportAllBackups;
        window.deleteBackupRecord      = deleteBackupRecord;


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 101 — SYSTEM LOGS helpers
