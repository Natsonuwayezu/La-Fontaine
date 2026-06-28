// js/modules/school-settings.js
// School Settings Module - Configure school information, logo, contact details

import { state } from '../core/state.js';
import { getAll, updateSchoolSetting } from '../core/supabase-client.js';
import { showToast, showModal, closeModal, confirmDialog } from '../ui/modals.js';
import { fmtDate, esc } from '../core/utils.js';
import { refreshTable, loadInitialData } from '../core/data-loader.js';

export async function renderSchoolSettings(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const settings = state.schoolSettings;
    const logoPreview = settings.school_logo ?
        (settings.school_logo.startsWith('data:') || settings.school_logo.startsWith('http') ?
            `<img src="${settings.school_logo}" style="max-width:80px;max-height:80px;border-radius:8px;">` :
            `<span style="font-size:48px;">${settings.school_logo}</span>`) :
        '<span style="font-size:48px;">🏫</span>';

    const academicYears = state.academicYears || [];
    const terms = state.terms || [];

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">🏫 School Settings</span>
                <button class="btn btn-sm btn-success" onclick="window.saveSchoolSettings()">💾 Save All</button>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group">
                        <label>School Name</label>
                        <input type="text" id="setting-school-name" value="${esc(settings.school_name || 'ECOLE LA FONTAINE')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>School Motto</label>
                        <input type="text" id="setting-motto" value="${esc(settings.school_motto || 'We Excell')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Location / Address</label>
                        <input type="text" id="setting-location" value="${esc(settings.school_location || 'Rubavu, Rwanda')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="text" id="setting-phone" value="${esc(settings.school_phone || '+250788534320')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="setting-email" value="${esc(settings.school_email || 'info@ecolelafontaine.rw')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Website</label>
                        <input type="text" id="setting-website" value="${esc(settings.school_website || 'www.ecolelafontaine.rw')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>PO Box</label>
                        <input type="text" id="setting-pobox" value="${esc(settings.school_pobox || 'Box 123, Rubavu')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>School Logo</label>
                        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                            <div id="logo-preview" style="width:80px;height:80px;background:var(--bg-tertiary);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden">${logoPreview}</div>
                            <input type="file" id="setting-logo-file" accept="image/*" style="display:none" onchange="window.previewSchoolLogo(this)">
                            <button class="btn btn-sm btn-outline" onclick="document.getElementById('setting-logo-file').click()">📤 Upload Logo</button>
                            <button class="btn btn-sm btn-outline" onclick="document.getElementById('logo-preview').innerHTML='<span style=&quot;font-size:48px;&quot;>🏫</span>';document.getElementById('setting-logo-data').value='🏫'">🗑️ Remove</button>
                        </div>
                        <input type="hidden" id="setting-logo-data" value="${esc(settings.school_logo || '🏫')}">
                        <small class="field-hint">Upload PNG, JPG, or GIF (max 2MB). Logo appears on report cards, receipts, and sidebar.</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📅 Academic Settings</span>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Current Academic Year</label>
                        <select id="setting-year" class="form-control">
                            ${academicYears.map(y => `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>${esc(y.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Current Term</label>
                        <select id="setting-term" class="form-control">
                            ${terms.filter(t => t.academic_year_id === state.currentAcadYear?.id).map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Term Start Date</label>
                        <input type="date" id="setting-term-start" value="${state.currentTerm?.start_date || ''}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Term End Date</label>
                        <input type="date" id="setting-term-end" value="${state.currentTerm?.end_date || ''}" class="form-control">
                    </div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📄 Report Card Settings</span>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group full">
                        <label>Report Footer Line 1</label>
                        <input type="text" id="setting-footer-line1" value="${esc(settings.report_footer_line1 || 'Done at ECOLE LA FONTAINE')}" class="form-control">
                    </div>
                    <div class="form-group full">
                        <label>Report Footer Line 2 (Head of School)</label>
                        <input type="text" id="setting-footer-line2" value="${esc(settings.report_footer_line2 || 'UWAYO GANZA Eugene')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Head Teacher Title</label>
                        <input type="text" id="setting-head-title" value="${esc(settings.head_teacher_title || 'THE SCHOOL HEADTEACHER')}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Default Pass Mark (%)</label>
                        <input type="number" id="setting-pass-mark" value="${settings.pass_mark || 50}" class="form-control" min="0" max="100">
                    </div>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">🔐 Security Settings</span>
            </div>
            <div class="dash-card-body">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Admin Password</label>
                        <input type="password" id="setting-admin-pw" class="form-control" placeholder="Change password">
                        <small class="field-hint">Leave blank to keep current password</small>
                    </div>
                    <div class="form-group">
                        <label>Session Timeout (minutes)</label>
                        <input type="number" id="setting-session-timeout" value="${settings.session_timeout || 30}" class="form-control" min="5" max="120">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="setting-force-2fa" ${settings.force_2fa === 'true' ? 'checked' : ''}> Enforce Two-Factor Authentication for Admin</label>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.saveSchoolSettings = saveSchoolSettings;
    window.previewSchoolLogo = previewSchoolLogo;
}

async function saveSchoolSettings() {
    // Basic info
    await updateSchoolSetting('school_name', document.getElementById('setting-school-name')?.value);
    await updateSchoolSetting('school_motto', document.getElementById('setting-motto')?.value);
    await updateSchoolSetting('school_location', document.getElementById('setting-location')?.value);
    await updateSchoolSetting('school_phone', document.getElementById('setting-phone')?.value);
    await updateSchoolSetting('school_email', document.getElementById('setting-email')?.value);
    await updateSchoolSetting('school_website', document.getElementById('setting-website')?.value);
    await updateSchoolSetting('school_pobox', document.getElementById('setting-pobox')?.value);

    // Report settings
    await updateSchoolSetting('report_footer_line1', document.getElementById('setting-footer-line1')?.value);
    await updateSchoolSetting('report_footer_line2', document.getElementById('setting-footer-line2')?.value);
    await updateSchoolSetting('head_teacher_title', document.getElementById('setting-head-title')?.value);
    await updateSchoolSetting('pass_mark', document.getElementById('setting-pass-mark')?.value);

    // Security settings
    await updateSchoolSetting('session_timeout', document.getElementById('setting-session-timeout')?.value);
    await updateSchoolSetting('force_2fa', document.getElementById('setting-force-2fa')?.checked ? 'true' : 'false');

    // Logo handling
    const logoData = document.getElementById('setting-logo-data')?.value;
    if (logoData !== undefined && logoData !== '🏫') {
        await updateSchoolSetting('school_logo', logoData);
        applySchoolLogo(logoData);
    }

    // Academic year and term
    const yearId = document.getElementById('setting-year')?.value;
    if (yearId) {
        await updateWhere('academic_years', `id=eq.${yearId}`, { is_active: true });
        const year = state.academicYears.find(y => y.id == yearId);
        if (year) await updateSchoolSetting('current_academic_year', year.name);
    }

    const termId = document.getElementById('setting-term')?.value;
    if (termId) {
        const term = state.terms.find(t => t.id == termId);
        if (term) {
            await updateSchoolSetting('current_term', term.name);

            // Update term dates if changed
            const termStart = document.getElementById('setting-term-start')?.value;
            const termEnd = document.getElementById('setting-term-end')?.value;
            if (termStart || termEnd) {
                await update('terms', termId, {
                    start_date: termStart || term.start_date,
                    end_date: termEnd || term.end_date
                });
            }
        }
    }

    // Admin password
    const newPw = document.getElementById('setting-admin-pw')?.value;
    if (newPw && newPw.length >= 4) {
        await updateSchoolSetting('admin_password', newPw);
    }

    await refreshTable('school_settings');
    await loadInitialData();

    showToast('✅ Settings saved successfully', 'success');
}

function previewSchoolLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        showToast('Logo too large. Max 2MB.', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;
        document.getElementById('logo-preview').innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;">`;
        document.getElementById('setting-logo-data').value = base64;
    };
    reader.readAsDataURL(file);
}

async function ensureStateLoaded() {
    if (!state.schoolSettings) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}