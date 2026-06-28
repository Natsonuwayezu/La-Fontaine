// js/modules/academic-years.js
// Academic Years Management - Create, edit, and manage academic years

import { state } from '../core/state.js';
import { getAll, insert, update, remove, updateSchoolSetting } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, fmtCurrency, esc, exportToExcel } from '../core/utils.js';
import { refreshTable, ensureStateLoaded, loadInitialData } from '../core/data-loader.js';

export async function renderAcademicYears(container) {
    await ensureStateLoaded();

    const currentYear = state.currentAcadYear;
    const years = [...state.academicYears].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📅 Academic Years</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.openAddYearModal()">➕ Add Academic Year</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportAcademicYears()">📥 Export</button>
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
                                    <tr>
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

    // Register global functions
    window.openAddYearModal = openAddYearModal;
    window.editAcademicYear = editAcademicYear;
    window.deleteAcademicYear = deleteAcademicYear;
    window.setAcademicYearStatus = setAcademicYearStatus;
    window.viewYearTerms = viewYearTerms;
    window.exportAcademicYears = exportAcademicYears;
    window.createAcademicYearWithTerms = createAcademicYearWithTerms;
    window.updateAcademicYear = updateAcademicYear;
}

function openAddYearModal() {
    showModal(`
        <div class="modal-overlay" id="add-year-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Add Academic Year</h3>
                    <button class="modal-close" onclick="closeModal('add-year-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Year Name *</label>
                            <input type="text" id="new-year-name" placeholder="e.g., 2025-2026" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" id="new-year-start" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>End Date</label>
                            <input type="date" id="new-year-end" class="form-control">
                        </div>
                        <div class="form-group full">
                            <label>Set as Active</label>
                            <select id="new-year-active" class="form-control">
                                <option value="true">Yes (activate now)</option>
                                <option value="false" selected>No</option>
                            </select>
                        </div>
                        <div class="alert alert-info" style="margin-top:8px;font-size:.82rem">
                            📅 Three terms (Term 1, Term 2, Term 3) will be created automatically.
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('add-year-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.createAcademicYearWithTerms()">Create Year + 3 Terms</button>
                </div>
            </div>
        </div>
    `);
}

async function createAcademicYearWithTerms() {
    const name = document.getElementById('new-year-name')?.value.trim();
    const startStr = document.getElementById('new-year-start')?.value;
    const endStr = document.getElementById('new-year-end')?.value;
    const isActive = document.getElementById('new-year-active')?.value === 'true';

    if (!name) {
        showToast('Year name is required', 'warning');
        return;
    }

    const yr = await insert('academic_years', {
        name: name,
        start_date: startStr || null,
        end_date: endStr || null,
        is_active: isActive,
        created_at: new Date().toISOString()
    });

    if (!yr) {
        showToast('Failed to create academic year', 'error');
        return;
    }

    if (isActive) {
        // Deactivate all other years
        for (const year of state.academicYears) {
            if (year.id !== yr.id) {
                await update('academic_years', year.id, { is_active: false });
            }
        }
        await updateSchoolSetting('current_academic_year', name);
        state.currentAcadYear = yr;
    }

    // Auto-create 3 terms with sensible dates
    const baseDate = startStr ? new Date(startStr) : new Date();
    const termNames = [`${name} — Term 1`, `${name} — Term 2`, `${name} — Term 3`];

    for (let i = 0; i < 3; i++) {
        const termStart = new Date(baseDate);
        termStart.setMonth(baseDate.getMonth() + (i * 3));

        const termEnd = new Date(termStart);
        termEnd.setMonth(termStart.getMonth() + 3);
        termEnd.setDate(termEnd.getDate() - 1);

        const midtermDate = new Date(termStart);
        midtermDate.setMonth(termStart.getMonth() + 1);

        await insert('terms', {
            name: termNames[i],
            academic_year_id: yr.id,
            term_number: i + 1,
            start_date: termStart.toISOString().split('T')[0],
            end_date: termEnd.toISOString().split('T')[0],
            midterm_date: midtermDate.toISOString().split('T')[0],
            is_active: i === 0 && isActive,
            created_at: new Date().toISOString()
        });
    }

    await refreshTable('academic_years');
    await refreshTable('terms');
    closeModal('add-year-modal');
    showToast(`✅ Academic year "${name}" created with 3 terms`, 'success');
    renderAcademicYears(document.getElementById('dynamic-content'));
}

async function editAcademicYear(yearId) {
    const year = state.academicYears.find(y => y.id === yearId);
    if (!year) return;

    showModal(`
        <div class="modal-overlay" id="edit-year-modal">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Edit Academic Year</h3>
                    <button class="modal-close" onclick="closeModal('edit-year-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full">
                            <label>Year Name *</label>
                            <input type="text" id="edit-year-name" value="${esc(year.name)}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" id="edit-year-start" value="${year.start_date || ''}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>End Date</label>
                            <input type="date" id="edit-year-end" value="${year.end_date || ''}" class="form-control">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('edit-year-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window.updateAcademicYear(${yearId})">Save Changes</button>
                </div>
            </div>
        </div>
    `);
}

async function updateAcademicYear(yearId) {
    const name = document.getElementById('edit-year-name')?.value.trim();
    const start = document.getElementById('edit-year-start')?.value;
    const end = document.getElementById('edit-year-end')?.value;

    if (!name) {
        showToast('Year name is required', 'warning');
        return;
    }

    await update('academic_years', yearId, {
        name: name,
        start_date: start || null,
        end_date: end || null,
        updated_at: new Date().toISOString()
    });

    await refreshTable('academic_years');
    closeModal('edit-year-modal');
    showToast('✅ Academic year updated', 'success');
    renderAcademicYears(document.getElementById('dynamic-content'));
}

async function deleteAcademicYear(yearId, yearName) {
    const termsCount = state.terms.filter(t => t.academic_year_id === yearId).length;
    const isActive = state.currentAcadYear?.id === yearId;

    let warningMsg = `Delete academic year "${yearName}"?\n\n`;
    if (termsCount > 0) warningMsg += `⚠️ This will also delete ${termsCount} associated terms.\n`;
    if (isActive) warningMsg += `⚠️ This is the CURRENT active academic year.\n\n`;
    warningMsg += `This action CANNOT be undone.`;

    if (!await confirmDialog(warningMsg)) return;

    // Delete associated terms first
    const termsToDelete = state.terms.filter(t => t.academic_year_id === yearId);
    for (const term of termsToDelete) {
        await remove('terms', term.id);
    }

    await remove('academic_years', yearId);

    if (isActive && state.academicYears.length > 1) {
        const nextYear = state.academicYears.find(y => y.id !== yearId);
        if (nextYear) {
            await update('academic_years', nextYear.id, { is_active: true });
            await updateSchoolSetting('current_academic_year', nextYear.name);
            state.currentAcadYear = nextYear;
        }
    }

    await refreshTable('academic_years');
    await refreshTable('terms');
    showToast(`✅ Academic year "${yearName}" deleted`, 'success');
    renderAcademicYears(document.getElementById('dynamic-content'));
}

async function setAcademicYearStatus(yearId, status) {
    const isActive = status === 'active';

    if (isActive) {
        // Deactivate all other years
        for (const year of state.academicYears) {
            if (year.id !== yearId && year.is_active) {
                await update('academic_years', year.id, { is_active: false });
            }
        }
        await updateSchoolSetting('current_academic_year', state.academicYears.find(y => y.id === yearId)?.name);
    }

    await update('academic_years', yearId, { is_active: isActive });
    await refreshTable('academic_years');
    await loadInitialData();
    showToast(`Academic year ${isActive ? 'activated' : 'deactivated'}`, 'success');
    renderAcademicYears(document.getElementById('dynamic-content'));
}

async function viewYearTerms(yearId) {
    const year = state.academicYears.find(y => y.id === yearId);
    const terms = state.terms.filter(t => t.academic_year_id === yearId).sort((a, b) => a.term_number - b.term_number);

    if (terms.length === 0) {
        showToast(`No terms found for ${year?.name}`, 'info');
        return;
    }

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>📚 Terms for ${esc(year?.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr><th>Term Name</th><th>Start Date</th><th>End Date</th><th>Midterm Date</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${terms.map(term => `
                                    <tr>
                                        <td><strong>${esc(term.name)}</strong></td>
                                        <td>${fmtDate(term.start_date)}</span>
                                        <td>${fmtDate(term.end_date)}</span>
                                        <td>${fmtDate(term.midterm_date)}</span>
                                        <td><span class="badge ${term.is_active ? 'badge-success' : 'badge-neutral'}">${term.is_active ? 'Active' : 'Inactive'}</span></span>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportAcademicYears() {
    const data = state.academicYears.map(year => ({
        'Year Name': year.name,
        'Start Date': fmtDate(year.start_date),
        'End Date': fmtDate(year.end_date),
        'Status': year.is_active ? 'Active' : 'Inactive',
        'Terms Count': state.terms.filter(t => t.academic_year_id === year.id).length
    }));
    exportToExcel(data, 'Academic_Years_Export');
}