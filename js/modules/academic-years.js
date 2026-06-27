// SECTION 74: ACADEMIC YEARS
        // ================================================================

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
                            <tr><th>Year Name</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Terms</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            ${years.length ? years.map(year => {
                const termCount = state.terms.filter(t => t.academic_year_id === year.id).length;
                return `
                                    <tr class="${year.is_active ? 'active-year' : ''}">
                                        <td><strong>${esc(year.name)}</strong> ${year.id === currentYear?.id ? '<span class="badge badge-success">Active</span>' : ''}</td>
                                        <td>${fmtDate(year.start_date)}</td>
                                        <td>${fmtDate(year.end_date)}</td>
                                        <td>
                                            <select onchange="window.setAcademicYearStatus(${year.id}, this.value)" class="form-control" style="width:100px;padding:4px">
                                                <option value="active" ${year.is_active ? 'selected' : ''}>Active</option>
                                                <option value="inactive" ${!year.is_active ? 'selected' : ''}>Inactive</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.viewYearTerms(${year.id})">📋 ${termCount} Terms</button>
                                            <button class="btn btn-sm btn-primary" onclick="window.cloneAcademicYear(${year.id})">📋 Clone</button>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="window.editAcademicYear(${year.id})">✏️</button>
                                            <button class="btn btn-sm btn-danger" onclick="window.deleteAcademicYear(${year.id}, '${esc(year.name)}')">🗑️</button>
                                        </td>
                                    </tr>
                                `;
            }).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No academic years found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
        }
        window.renderAcademicYears = renderAcademicYears;

        function openAddYearModal() {
            showModal(`<div class="modal-overlay" id="add-year-modal"><div class="modal modal-sm"><div class="modal-header"><h3>📅 Add Academic Year</h3><button class="modal-close" onclick="closeModal('add-year-modal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Year Name *</label><input id="year-name" class="form-control" placeholder="e.g. 2025-2026"></div><div class="form-group"><label>Start Date</label><input type="date" id="year-start" class="form-control"></div><div class="form-group"><label>End Date</label><input type="date" id="year-end" class="form-control"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-year-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveYear()">Save Year</button></div></div></div>`);
            window._saveYear = async () => {
                const name = document.getElementById('year-name')?.value.trim();
                const start = document.getElementById('year-start')?.value;
                const end = document.getElementById('year-end')?.value;
                if (!name) { showToast('Year name is required', 'warning'); return; }
                const r = await apiRequest('academic_years', 'POST', { name, start_date: start, end_date: end, is_active: false, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-year-modal'); await refreshTable('academic_years'); showToast('✅ Academic year added', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }
        window.openAddYearModal = openAddYearModal;

        async function editAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId);
            if (!year) return;
            showModal(`<div class="modal-overlay" id="edit-year-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Academic Year</h3><button class="modal-close" onclick="closeModal('edit-year-modal')">✕</button></div><div class="modal-body"><div class="form-grid"><div class="form-group"><label>Year Name</label><input id="edit-year-name" class="form-control" value="${esc(year.name)}"></div><div class="form-group"><label>Start Date</label><input type="date" id="edit-year-start" class="form-control" value="${year.start_date || ''}"></div><div class="form-group"><label>End Date</label><input type="date" id="edit-year-end" class="form-control" value="${year.end_date || ''}"></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-year-modal')">Cancel</button><button class="btn btn-primary" onclick="window._updateYear(${yearId})">Update</button></div></div></div>`);
            window._updateYear = async (id) => {
                const r = await apiRequest('academic_years?id=eq.' + id, 'PATCH', {
                    name: document.getElementById('edit-year-name')?.value.trim(),
                    start_date: document.getElementById('edit-year-start')?.value,
                    end_date: document.getElementById('edit-year-end')?.value,
                    updated_at: new Date().toISOString()
                });
                if (r.success) { closeModal('edit-year-modal'); await refreshTable('academic_years'); showToast('✅ Year updated', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }
        window.editAcademicYear = editAcademicYear;

        async function deleteAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId);
            if (!year) return;
            if (year.is_active) { showToast('Cannot delete the active academic year', 'error'); return; }
            if (!await confirmDialog('Delete academic year "' + year.name + '"? This will also delete all its terms and assessments.')) return;
            await apiRequest('academic_years?id=eq.' + yearId, 'DELETE');
            await refreshTable('academic_years');
            showToast('✅ Academic year deleted', 'success');
        }
        window.deleteAcademicYear = deleteAcademicYear;

        async function cloneAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId);
            if (!year) return;
            const newName = prompt('Name for cloned year:', year.name + ' (Copy)');
            if (!newName) return;
            const r = await apiRequest('academic_years', 'POST', { name: newName, start_date: year.start_date, end_date: year.end_date, is_active: false, created_at: new Date().toISOString() });
            if (r.success) {
                const newYearId = r.data[0]?.id;
                const terms = state.terms.filter(t => t.academic_year_id === yearId);
                for (const term of terms) {
                    await apiRequest('terms', 'POST', { name: term.name, term_number: term.term_number, start_date: term.start_date, end_date: term.end_date, academic_year_id: newYearId, is_active: false, created_at: new Date().toISOString() });
                }
                await refreshTable('academic_years');
                await refreshTable('terms');
                showToast('✅ Academic year cloned with terms', 'success');
            } else showToast('Failed to clone: ' + r.error, 'error');
        }
        window.cloneAcademicYear = cloneAcademicYear;

        async function setAcademicYearStatus(yearId, activate) {
            if (activate) {
                for (const y of state.academicYears) {
                    await apiRequest('academic_years?id=eq.' + y.id, 'PATCH', { is_active: y.id === yearId, updated_at: new Date().toISOString() });
                }
            } else {
                await apiRequest('academic_years?id=eq.' + yearId, 'PATCH', { is_active: false, updated_at: new Date().toISOString() });
            }
            await refreshTable('academic_years');
            showToast('✅ Academic year status updated', 'success');
        }
        window.setAcademicYearStatus = setAcademicYearStatus;

        async function viewYearTerms(yearId) {
            const year = state.academicYears.find(y => y.id === yearId);
            const terms = state.terms.filter(t => t.academic_year_id === yearId).sort((a, b) => a.term_number - b.term_number);
            showModal(`<div class="modal-overlay" id="year-terms-modal"><div class="modal"><div class="modal-header"><h3>📅 Terms — ${esc(year?.name)}</h3><button class="modal-close" onclick="closeModal('year-terms-modal')">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>#</th><th>Term Name</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>${terms.map(t => `<tr><td>${t.term_number}</td><td><strong>${esc(t.name)}</strong></td><td>${fmtDate(t.start_date)}</td><td>${fmtDate(t.end_date)}</td><td>${t.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}</td></tr>`).join('')}</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('year-terms-modal')">Close</button></div></div></div>`);
        }
        window.viewYearTerms = viewYearTerms;

        function exportAcademicYearsData() {
            const data = state.academicYears.flatMap(y => {
                const terms = state.terms.filter(t => t.academic_year_id === y.id);
                return terms.length ? terms.map(t => ({
                    'Academic Year': y.name,
                    'Term': t.name,
                    'Term #': t.term_number,
                    'Start': fmtDate(t.start_date),
                    'End': fmtDate(t.end_date),
                    'Year Active': y.is_active ? 'Yes' : 'No',
                    'Term Active': t.is_active ? 'Yes' : 'No'
                })) : [{
                    'Academic Year': y.name,
                    'Term': '(no terms)',
                    'Term #': '',
                    'Start': fmtDate(y.start_date),
                    'End': fmtDate(y.end_date),
                    'Year Active': y.is_active ? 'Yes' : 'No',
                    'Term Active': ''
                }];
            });
            exportToExcel(data, 'Academic_Years_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Academic years exported', 'success');
        }
        window.exportAcademicYearsData = exportAcademicYearsData;

        // ================================================================
