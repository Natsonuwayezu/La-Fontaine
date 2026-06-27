// ════════════════════════════════════════════════════════════════════════

        // ── MARKS ENTRY / DATABASE ─────────────────────────────────────────────

        /**
 * Save all marks in bulk with parallel processing for speed
 * Shows a progress indicator for large batches
 */
        async function saveMarks() {
            const inputs = [...document.querySelectorAll('.mark-input')];
            if (!inputs.length) { showToast('No marks to save', 'warning'); return; }

            // ── Build list of marks that are valid and changed ──
            const toSave = [];
            const markMap = new Map(state.marks.map(m => [m.assessment_id + '-' + m.student_id, m]));

            for (const input of inputs) {
                const assessmentId = parseInt(input.dataset.assessmentId);
                const studentId = parseInt(input.dataset.studentId);
                const value = parseFloat(input.value);
                const max = parseFloat(input.dataset.max || 100);
                if (isNaN(value) || value < 0 || value > max) continue;
                const existing = markMap.get(assessmentId + '-' + studentId);
                // Skip if value unchanged
                if (existing && existing.score === value) continue;
                toSave.push({ input, assessmentId, studentId, value, existing });
            }

            if (!toSave.length) { showToast('No changes to save', 'info'); return; }

            // ── Show progress modal for large batches ──
            const total = toSave.length;
            let showProgress = total > 20;
            let progressModal = null;

            if (showProgress) {
                showToast(`⏳ Saving ${total} marks in parallel...`, 'info', 2000);
            }

            // ── Fire all requests in parallel (not one-by-one) ──
            const results = await Promise.all(toSave.map(async ({ input, assessmentId, studentId, value, existing }) => {
                const payload = { assessment_id: assessmentId, student_id: studentId, score: value, updated_at: new Date().toISOString() };
                const r = existing
                    ? await apiRequest('marks?id=eq.' + existing.id, 'PATCH', payload)
                    : await apiRequest('marks', 'POST', { ...payload, created_at: new Date().toISOString() });
                return { input, success: r.success };
            }));

            // ── Process results ──
            let saved = 0, errors = 0;
            for (const { input, success } of results) {
                if (success) { saved++; input.style.background = 'var(--success-bg)'; }
                else { errors++; input.style.background = 'var(--danger-bg)'; }
                // Auto-clear success highlight after 2 seconds
                setTimeout(() => {
                    input.style.background = '';
                }, 2000);
            }

            // ── Refresh marks in state after batch completes ──
            await refreshTable('marks');

            // ── Show result ──
            if (errors === 0) {
                showToast(`✅ ${saved} marks saved successfully`, 'success');
            } else {
                showToast(`⚠️ ${saved} saved, ${errors} failed`, 'warning');
            }

            // ── Auto-update grade cells ──
            const assessmentId = document.getElementById('me-assessment-select')?.value;
            if (assessmentId) {
                const assessment = state.assessments.find(a => a.id == assessmentId);
                if (assessment) {
                    // Refresh grade cells with new data
                    const students = state.students.filter(s => s.class_id == assessment.class_id && s.status === 'Active');
                    for (const student of students) {
                        const mark = state.marks.find(m => m.assessment_id == assessmentId && m.student_id == student.id);
                        const cell = document.getElementById('grade-cell-' + student.id);
                        if (cell && mark) {
                            const pct = (mark.score / assessment.max_marks) * 100;
                            cell.innerHTML = `<span class="badge ${getGradeClass(pct)}">${pct.toFixed(1)}% — ${getGrade(pct)}</span>`;
                        }
                    }
                }
            }
        }

        async function clearMarksTable() {
            const assessmentId = document.getElementById('me-assessment-select')?.value;
            if (!assessmentId) { showToast('Select an assessment first', 'warning'); return; }
            if (!await confirmDialog('Clear all marks for this assessment? This cannot be undone.')) return;
            const marksToDelete = state.marks.filter(m => m.assessment_id == assessmentId);
            for (const mark of marksToDelete) await apiRequest('marks?id=eq.' + mark.id, 'DELETE');
            await refreshTable('marks');
            loadMEStudentsTable();
            showToast('✅ Marks cleared for this assessment', 'success');
        }

        async function refreshMarksData() {
            showToast('⏳ Refreshing marks…', 'info', 1500);
            await refreshTable('marks');
            await refreshTable('assessments');
            if (document.getElementById('me-class-select')?.value) loadMEStudentsTable();
            showToast('✅ Marks data refreshed', 'success');
        }

        async function exportAllMarksToExcel() {
            if (!initXLSX()) return;
            const data = state.marks.map(m => {
                const assessment = state.assessments.find(a => a.id === m.assessment_id);
                const student = state.students.find(s => s.id === m.student_id);
                const subject = state.subjects.find(s => s.id === assessment?.subject_id);
                const cls = state.classes.find(c => c.id === assessment?.class_id);
                return { 'Student': student ? student.first_name + ' ' + student.last_name : m.student_id, 'Class': cls?.name || '', 'Subject': subject?.name || '', 'Assessment': assessment?.title || '', 'Score': m.score, 'Max Marks': assessment?.max_marks || '', 'Date': fmtDate(m.created_at) };
            });
            exportToExcel(data, 'All_Marks_' + new Date().toISOString().split('T')[0]);
            showToast('✅ All marks exported', 'success');
        }

        async function exportMarksExcel() {
            const classId = document.getElementById('me-class-select')?.value;
            const assessmentId = document.getElementById('me-assessment-select')?.value;
            if (!classId) { showToast('Select a class first', 'warning'); return; }
            if (!initXLSX()) return;
            const assessment = state.assessments.find(a => a.id == assessmentId);
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const data = students.map(s => { const mark = state.marks.find(m => m.student_id === s.id && m.assessment_id == assessmentId); return { 'Student Name': s.first_name + ' ' + s.last_name, 'Student Code': s.student_code || '', 'Score': mark?.score ?? '', 'Max Marks': assessment?.max_marks || '' }; });
            exportToExcel(data, 'Marks_' + (assessment?.title || 'Assessment').replace(/\s/g, '_') + '_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Marks exported', 'success');
        }

        async function importMarksExcel() {
            const file = document.getElementById('marks-import-file')?.files[0];
            if (!file) { showToast('Please select an Excel file', 'warning'); return; }
            if (!initXLSX()) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws);
                    window._importedMarksRows = rows;
                    previewMarksRowsTable(rows);
                } catch (err) { showToast('Failed to read Excel file: ' + err.message, 'error'); }
            };
            reader.readAsArrayBuffer(file);
        }

        function previewMarksRowsTable(rows) {
            const container = document.getElementById('marks-import-preview');
            if (!container) return;
            if (!rows?.length) { container.innerHTML = '<div class="alert alert-warning">No data found in file</div>'; return; }
            const cols = Object.keys(rows[0]);
            const preview = rows.slice(0, 10);
            container.innerHTML = '<div class="alert alert-info">📋 Preview: ' + rows.length + ' rows found. First 10 shown.</div><div class="table-wrapper"><table class="data-table"><thead><tr>' + cols.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + preview.map(row => '<tr>' + cols.map(c => '<td>' + esc(String(row[c] ?? '')) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="btn-group" style="margin-top:12px"><button class="btn btn-primary" onclick="window.executeMarksImport()">✅ Import Marks</button></div>';
        }

        async function executeBufferedMarksImport() {
            const rows = window._importedMarksRows;
            const assessmentId = document.getElementById('me-assessment-select')?.value;
            if (!rows?.length || !assessmentId) { showToast('Missing rows or assessment', 'warning'); return; }
            let imported = 0, errors = 0;
            for (const row of rows) {
                const studentCode = String(row['Student Code'] || row['Code'] || '').trim();
                const score = parseFloat(row['Score'] || row['Marks'] || row['Mark'] || 0);
                if (!studentCode || isNaN(score)) { errors++; continue; }
                const student = state.students.find(s => s.student_code === studentCode);
                if (!student) { errors++; continue; }
                const existing = state.marks.find(m => m.assessment_id == assessmentId && m.student_id === student.id);
                const payload = { assessment_id: parseInt(assessmentId), student_id: student.id, score, updated_at: new Date().toISOString() };
                const r = existing ? await apiRequest('marks?id=eq.' + existing.id, 'PATCH', payload) : await apiRequest('marks', 'POST', { ...payload, created_at: new Date().toISOString() });
                if (r.success) imported++; else errors++;
            }
            await refreshTable('marks');
            await notifyAction('marks_import', { message: imported + ' marks imported from Excel' }, ['admin', 'teacher']);
            showToast('✅ Imported ' + imported + ' marks' + (errors ? ' (' + errors + ' errors)' : ''), errors ? 'warning' : 'success');
            loadMEStudentsTable();
        }

        async function loadMEStudentsTable() {
            const classId = document.getElementById('me-class-select')?.value;
            const assessmentId = document.getElementById('me-assessment-select')?.value;
            const tbody = document.getElementById('me-students-tbody');
            if (!tbody) return;
            if (!classId) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px">Select a class to load students</td></tr>'; return; }
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const assessment = state.assessments.find(a => a.id == assessmentId);
            const maxMarks = assessment?.max_marks || 100;
            tbody.innerHTML = students.map(student => {
                const mark = state.marks.find(m => m.student_id === student.id && m.assessment_id == assessmentId);
                const pct = mark ? (mark.score / maxMarks) * 100 : null;
                const gradeCell = pct !== null
                    ? `<span class="badge ${getGradeClass(pct)}">${pct.toFixed(1)}% — ${getGrade(pct)}</span>`
                    : '<span class="badge badge-neutral">—</span>';
                return `<tr>
                    <td>${esc(student.first_name)} ${esc(student.last_name)}</td>
                    <td>${esc(student.student_code || '—')}</td>
                    <td style="text-align:center">
                        <input type="number" class="mark-input form-control"
                            style="width:80px;text-align:center"
                            data-student-id="${student.id}"
                            data-assessment-id="${assessmentId || ''}"
                            data-max="${maxMarks}"
                            value="${mark?.score ?? ''}"
                            min="0" max="${maxMarks}" step="0.5"
                            oninput="updateMarkGrade(this, ${maxMarks})">
                    </td>
                    <td style="text-align:center">${maxMarks}</td>
                    <td style="text-align:center" id="grade-cell-${student.id}">${gradeCell}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px">No students in this class</td></tr>';
        }

        /**
         * Live-update the grade badge as a mark is typed, without waiting for Save.
         * Wired via oninput on each .mark-input in loadMEStudentsTable().
         */
        function updateMarkGrade(input, maxMarks) {
            const studentId = input.dataset.studentId;
            const cell = document.getElementById('grade-cell-' + studentId);
            if (!cell) return;
            const value = parseFloat(input.value);
            if (isNaN(value) || value < 0) { cell.innerHTML = '<span class="badge badge-neutral">—</span>'; return; }
            const pct = (value / maxMarks) * 100;
            cell.innerHTML = `<span class="badge ${getGradeClass(pct)}">${pct.toFixed(1)}% — ${getGrade(pct)}</span>`;
        }
        window.updateMarkGrade = updateMarkGrade;

        async function loadMESubjectsAndStudents() {
            const classId = document.getElementById('me-class-select')?.value;
            const subjectSel = document.getElementById('me-subject-select');
            if (!classId || !subjectSel) return;
            const cls = getClassById(classId);
            const subjects = state.subjects.filter(s => s.level === cls?.level && s.is_active !== false);
            subjectSel.innerHTML = '<option value="">-- Select Subject --</option>' + subjects.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('');
            loadMEStudentsTable();
        }

        async function loadMarksDatabase() {
            const container = document.getElementById('marks-database-container');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading marks database...</p></div>';
            const data = state.marks.map(m => { const a = state.assessments.find(x => x.id === m.assessment_id); const s = state.students.find(x => x.id === m.student_id); const sub = state.subjects.find(x => x.id === a?.subject_id); const cls = state.classes.find(x => x.id === a?.class_id); const pctNum = a?.max_marks ? (m.score / a.max_marks) * 100 : null; return { id: m.id, student: s ? s.first_name + ' ' + s.last_name : '—', class: cls?.name || '—', subject: sub?.name || '—', assessment: a?.title || '—', score: m.score, max: a?.max_marks || '—', pctNum, pct: pctNum !== null ? pctNum.toFixed(1) + '%' : '—', date: fmtDate(m.created_at) }; });
            container.innerHTML = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Subject</th><th>Assessment</th><th style="text-align:right">Score</th><th style="text-align:right">Max</th><th style="text-align:center">Grade</th><th>Date</th></tr></thead><tbody>' + data.map(d => '<tr><td>' + esc(d.student) + '</td><td>' + esc(d.class) + '</td><td>' + esc(d.subject) + '</td><td>' + esc(d.assessment) + '</td><td style="text-align:right">' + d.score + '</td><td style="text-align:right">' + d.max + '</td><td style="text-align:center">' + (d.pctNum !== null ? `<span class="badge ${getGradeClass(d.pctNum)}">${d.pctNum.toFixed(1)}% — ${getGrade(d.pctNum)}</span>` : '—') + '</td><td>' + d.date + '</td></tr>').join('') + '</tbody></table></div>';
        }

        async function loadDatabaseAssessments() {
            const cls = document.getElementById('db-class-filter')?.value;
            const sub = document.getElementById('db-subject-filter')?.value;
            const tbody = document.getElementById('db-assessments-tbody');
            if (!tbody) return;
            let assessments = [...state.assessments];
            if (cls) assessments = assessments.filter(a => a.class_id == cls);
            if (sub) assessments = assessments.filter(a => a.subject_id == sub);
            tbody.innerHTML = assessments.map(a => { const subject = state.subjects.find(s => s.id === a.subject_id); const clsObj = state.classes.find(c => c.id === a.class_id); const marksCount = state.marks.filter(m => m.assessment_id === a.id).length; return '<tr><td>' + esc(a.title) + '</td><td>' + esc(subject?.name || '—') + '</td><td>' + esc(clsObj?.name || '—') + '</td><td style="text-align:right">' + a.max_marks + '</td><td style="text-align:center">' + marksCount + '</td><td>' + fmtDate(a.created_at) + '</td></tr>'; }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px">No assessments found</td></tr>';
        }

        async function loadDatabaseSubjects() {
            const tbody = document.getElementById('db-subjects-tbody');
            if (!tbody) return;
            tbody.innerHTML = state.subjects.filter(s => s.is_active !== false).map(s => '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.level || '—') + '</td><td style="text-align:right">' + (s.mg_max || 0) + '</td><td style="text-align:right">' + (s.ex_max || 0) + '</td><td>' + esc(s.language || '—') + '</td></tr>').join('') || '<tr><td colspan="5" style="text-align:center;padding:20px">No subjects found</td></tr>';
        }

        async function updateMEMaxFromSubject() {
            const subjectId = document.getElementById('me-subject-select')?.value;
            const maxInput = document.getElementById('me-max-marks');
            if (!subjectId || !maxInput) return;
            const subject = state.subjects.find(s => s.id == subjectId);
            if (subject) maxInput.value = (subject.mg_max || 0) + (subject.ex_max || 0);
        }

        async function showExistingAssessments() {
            const classId = document.getElementById('me-class-select')?.value;
            const subjectId = document.getElementById('me-subject-select')?.value;
            const container = document.getElementById('existing-assessments');
            if (!container) return;
            const assessments = state.assessments.filter(a => (!classId || a.class_id == classId) && (!subjectId || a.subject_id == subjectId));
            container.innerHTML = assessments.length ? '<div style="margin-top:8px"><strong>Existing:</strong> ' + assessments.map(a => '<span class="badge badge-info" style="cursor:pointer;margin:2px" onclick="document.getElementById(\'me-assessment-select\').value=\'' + a.id + '\';loadMEStudentsTable()">' + esc(a.title) + '</span>').join('') + '</div>' : '';
        }

        // ── GRADING SETTINGS ───────────────────────────────────────────────────

        function addGradeLevel() {
            const container = document.getElementById('grade-levels-container');
            if (!container) return;
            const idx = container.querySelectorAll('.grade-level-row').length;
            const row = document.createElement('div'); row.className = 'grade-level-row'; row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 80px 60px 40px;gap:8px;margin-bottom:8px;align-items:center';
            row.innerHTML = '<input type="text" class="form-control" placeholder="Grade name (e.g. A+)" value=""><input type="number" class="form-control" placeholder="Min %" value=""><input type="number" class="form-control" placeholder="Max %" value=""><input type="color" class="form-control" value="#10b981"><button class="btn btn-sm btn-danger" onclick="this.parentElement.remove();refreshGradePreview()">✕</button>';
            row.querySelectorAll('input').forEach(el => el.addEventListener('change', refreshGradePreview));
            container.appendChild(row);
            refreshGradePreview();
        }

        function removeGradeLevel() {
            const rows = document.querySelectorAll('.grade-level-row');
            if (rows.length > 1) { rows[rows.length - 1].remove(); refreshGradePreview(); }
            else showToast('At least one grade level required', 'warning');
        }

        function moveGradeUp() {
            const container = document.getElementById('grade-levels-container');
            const rows = [...container.querySelectorAll('.grade-level-row')];
            if (rows.length < 2) return;
            const last = rows[rows.length - 1]; const secondLast = rows[rows.length - 2];
            container.insertBefore(last, secondLast); refreshGradePreview();
        }

        function moveGradeDown() {
            const container = document.getElementById('grade-levels-container');
            const rows = [...container.querySelectorAll('.grade-level-row')];
            if (rows.length < 2) return;
            const first = rows[0]; const second = rows[1];
            container.insertBefore(second, first); refreshGradePreview();
        }

        function refreshGradePreview() {
            const grades = getGradeScaleFromUI();
            const preview = document.getElementById('grade-preview');
            if (!preview) return;
            preview.innerHTML = grades.map(g => '<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + g.color + '"></span><span class="badge" style="background:' + g.color + ';color:#fff">' + esc(g.name) + '</span><span>' + g.min + '% – ' + g.max + '%</span></div>').join('') || '<div style="color:var(--text-muted)">Add grade levels above</div>';
        }

        function getGradeScaleFromUI() {
            const rows = document.querySelectorAll('.grade-level-row');
            const grades = [];
            rows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                grades.push({ name: inputs[0]?.value || '', min: parseFloat(inputs[1]?.value) || 0, max: parseFloat(inputs[2]?.value) || 100, color: inputs[3]?.value || '#6b7280' });
            });
            return grades;
        }

        async function saveGradingSettings() {
            const grades = getGradeScaleFromUI();
            if (!grades.length) { showToast('Add at least one grade level', 'warning'); return; }
            const passing = parseFloat(document.getElementById('passing-score')?.value) || 50;
            const payload = { setting_key: 'grading_scale', setting_value: JSON.stringify({ grades, passing }), updated_at: new Date().toISOString() };
            const existing = (state.schoolSettings || {}).__grading_row_id;
            const r = existing ? await apiRequest('school_settings?id=eq.' + existing, 'PATCH', payload) : await apiRequest('school_settings', 'POST', { ...payload, created_at: new Date().toISOString() });
            if (r.success) {
                localStorage.setItem('grading_scale', JSON.stringify({ grades, passing }));
                // Refresh state.gradingScale so getGrade() uses new scale immediately
                await refreshTable('grading_scale');
                showToast('✅ Grading settings saved', 'success');
            }
            else showToast('Failed to save: ' + r.error, 'error');
        }

        function resetToDefaultGrading() {
            const defaults = [{ name: 'A+', min: 90, max: 100, color: '#10b981' }, { name: 'A', min: 80, max: 89, color: '#22c55e' }, { name: 'B', min: 70, max: 79, color: '#f59e0b' }, { name: 'C', min: 60, max: 69, color: '#f97316' }, { name: 'D', min: 50, max: 59, color: '#ef4444' }, { name: 'F', min: 0, max: 49, color: '#991b1b' }];
            const container = document.getElementById('grade-levels-container'); if (!container) return;
            container.innerHTML = '';
            defaults.forEach(g => {
                const row = document.createElement('div'); row.className = 'grade-level-row'; row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 80px 60px 40px;gap:8px;margin-bottom:8px;align-items:center';
                row.innerHTML = '<input type="text" class="form-control" value="' + g.name + '"><input type="number" class="form-control" value="' + g.min + '"><input type="number" class="form-control" value="' + g.max + '"><input type="color" class="form-control" value="' + g.color + '"><button class="btn btn-sm btn-danger" onclick="this.parentElement.remove();refreshGradePreview()">✕</button>';
                row.querySelectorAll('input').forEach(el => el.addEventListener('change', refreshGradePreview));
                container.appendChild(row);
            });
            if (document.getElementById('passing-score')) document.getElementById('passing-score').value = 50;
            refreshGradePreview(); showToast('✅ Reset to default grading scale', 'success');
        }

        function exportGradingSettings() {
            const grades = getGradeScaleFromUI();
            const passing = document.getElementById('passing-score')?.value || 50;
            exportToExcel(grades.map(g => ({ 'Grade': g.name, 'Min %': g.min, 'Max %': g.max, 'Color': g.color })), 'Grading_Settings');
            showToast('✅ Grading settings exported', 'success');
        }

        // ── API SETTINGS ───────────────────────────────────────────────────────

        function saveApiSettings() {
            const url = document.getElementById('supabase-url')?.value.trim();
            const key = document.getElementById('supabase-key')?.value.trim();
            if (!url || !key) { showToast('Both URL and API Key are required', 'warning'); return; }
            localStorage.setItem('supabase_url_override', url);
            localStorage.setItem('supabase_key_override', key);
            showToast('✅ API settings saved. Reload the page to apply.', 'success');
        }

        function resetApiSettings() {
            localStorage.removeItem('supabase_url_override'); localStorage.removeItem('supabase_key_override');
            if (document.getElementById('supabase-url')) document.getElementById('supabase-url').value = SUPABASE_URL || '';
            if (document.getElementById('supabase-key')) document.getElementById('supabase-key').value = SUPABASE_KEY || '';
            showToast('✅ API settings reset to defaults', 'success');
        }

        async function testApiConnection() {
            const r = await apiRequest('students?limit=1');
            showToast(r.success ? '✅ Connection successful! API is working.' : '❌ Connection failed: ' + r.error, r.success ? 'success' : 'error');
        }

        function toggleApiKeyVisibility() {
            const el = document.getElementById('supabase-key'); if (!el) return;
            el.type = el.type === 'password' ? 'text' : 'password';
            const btn = el.nextElementSibling; if (btn) btn.textContent = el.type === 'password' ? '👁️' : '🙈';
        }

        // ── USERS MANAGEMENT ───────────────────────────────────────────────────



        // ── REMINDERS ─────────────────────────────────────────────────────────

        function showRemindersTab() {
            const tab = document.querySelector('[data-tab="reminders"]') || document.querySelector('[onclick*="reminders"]');
            if (tab) tab.click();
        }

        async function openAddReminderModal() {
            showModal('<div class="modal-overlay" id="add-reminder-modal"><div class="modal modal-sm"><div class="modal-header"><h3>⏰ Add Reminder</h3><button class="modal-close" onclick="closeModal(\'add-reminder-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Title</label><input id="reminder-title" class="form-control" placeholder="e.g. Fee payment deadline"></div><div class="form-group"><label>Date</label><input id="reminder-date" type="date" class="form-control" min="' + new Date().toISOString().split('T')[0] + '"></div><div class="form-group"><label>Message</label><textarea id="reminder-message" class="form-control" rows="3" placeholder="Reminder details..."></textarea></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'add-reminder-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._saveReminder()">Save Reminder</button></div></div></div>');
            window._saveReminder = async () => {
                const title = document.getElementById('reminder-title')?.value.trim();
                const date = document.getElementById('reminder-date')?.value;
                const msg = document.getElementById('reminder-message')?.value.trim();
                if (!title || !date) { showToast('Title and date are required', 'warning'); return; }
                const r = await apiRequest('reminders', 'POST', { title, due_date: date, message: msg, completed: false, user_id: state.currentUser?.id, created_at: new Date().toISOString() });
                if (r.success) { closeModal(); showToast('✅ Reminder saved', 'success'); navigateTo('reminders'); }
                else showToast('Failed to save reminder: ' + r.error, 'error');
            };
        }

        /** Marks a personal reminder as completed. */
        async function completeReminder(id) {
            const r = await apiRequest('reminders?id=eq.' + id, 'PATCH', { completed: true, completed_at: new Date().toISOString() });
            if (r.success) { showToast('✅ Reminder completed', 'success'); navigateTo('reminders'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        /** Deletes a personal reminder. */
        async function deleteReminder(id) {
            if (!await confirmDialog('Delete this reminder?')) return;
            const r = await apiRequest('reminders?id=eq.' + id, 'DELETE');
            if (r.success) { showToast('✅ Reminder deleted', 'success'); navigateTo('reminders'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        function exportReminders() {
            const reminders = state.reminders || [];
            exportToExcel(reminders.map(r => ({ 'Title': r.title, 'Due Date': fmtDate(r.due_date), 'Message': r.message || '', 'Completed': r.completed ? 'Yes' : 'No' })), 'Reminders_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Reminders exported', 'success');
        }

        // ── DISCOUNTS ─────────────────────────────────────────────────────────

        function showDiscountTab() {
            const tab = document.querySelector('[data-tab="discounts"]') || document.querySelector('[onclick*="discount"]');
            if (tab) tab.click();
        }

        async function openAddDiscountRuleModal() {
            const categories = state.feeCategories || [];
            showModal('<div class="modal-overlay" id="add-discount-modal"><div class="modal modal-sm"><div class="modal-header"><h3>💰 Add Discount Rule</h3><button class="modal-close" onclick="closeModal(\'add-discount-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Discount Name</label><input id="disc-name" class="form-control" placeholder="e.g. Sibling Discount"></div><div class="form-group"><label>Applies To</label><select id="disc-category" class="form-control"><option value="">All Fees</option>' + categories.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') + '</select></div><div class="form-group"><label>Type</label><select id="disc-type" class="form-control"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount (RWF)</option></select></div><div class="form-group"><label>Value</label><input id="disc-value" type="number" class="form-control" placeholder="e.g. 10 for 10%"></div><div class="form-group"><label>Condition</label><select id="disc-condition" class="form-control"><option value="always">Always Apply</option><option value="sibling">Has Sibling Enrolled</option><option value="scholarship">Scholarship</option><option value="staff">Staff Child</option></select></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'add-discount-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._saveDiscountRule()">Save Rule</button></div></div></div>');
            window._saveDiscountRule = async () => {
                const name = document.getElementById('disc-name')?.value.trim(); const catId = document.getElementById('disc-category')?.value; const type = document.getElementById('disc-type')?.value; const value = parseFloat(document.getElementById('disc-value')?.value); const condition = document.getElementById('disc-condition')?.value;
                if (!name || isNaN(value)) { showToast('Name and value are required', 'warning'); return; }
                const r = await apiRequest('discounts', 'POST', { name, fee_category_id: catId || null, discount_type: type, discount_value: value, condition, is_active: true, created_at: new Date().toISOString() });
                if (r.success) { closeModal(); await refreshTable('discounts'); showToast('✅ Discount rule saved', 'success'); }
                else showToast('Failed to save: ' + r.error, 'error');
            };
        }

        function exportDiscountsData() {
            const discounts = state.discounts || [];
            exportToExcel(discounts.map(d => ({ 'Name': d.name, 'Type': d.discount_type, 'Value': d.discount_value, 'Condition': d.condition || '', 'Active': d.is_active ? 'Yes' : 'No' })), 'Discounts_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Discounts exported', 'success');
        }

        async function applyBulkDiscountToClass() {
            const classId = document.getElementById('bulk-disc-class')?.value; const catId = document.getElementById('bulk-disc-category')?.value; const type = document.getElementById('bulk-disc-type')?.value; const value = parseFloat(document.getElementById('bulk-disc-value')?.value);
            if (!classId || isNaN(value) || value <= 0) { showToast('Select class and enter a valid discount value', 'warning'); return; }
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            if (!students.length) { showToast('No active students in selected class', 'warning'); return; }
            if (!await confirmDialog('Apply ' + (type === 'percentage' ? value + '%' : fmtCurrency(value)) + ' discount to ' + students.length + ' students?')) return;
            let applied = 0;
            for (const student of students) {
                const fees = (state.studentFees || []).filter(f => f.student_id === student.id && (!catId || f.fee_category_id == catId) && !f.is_paid && !f.is_waived);
                for (const fee of fees) {
                    const discAmount = type === 'percentage' ? fee.amount * (value / 100) : Math.min(value, fee.amount);
                    await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { amount: Math.max(0, fee.amount - discAmount), updated_at: new Date().toISOString() }); applied++;
                }
            }
            await refreshTable('student_fees'); showToast('✅ Discount applied to ' + applied + ' fee records', 'success');
        }

        async function applyFamilyDiscountToAll() {
            const discVal = parseFloat(document.getElementById('family-disc-amount')?.value); const catId = document.getElementById('family-disc-category')?.value;
            if (isNaN(discVal) || discVal <= 0) { showToast('Enter a valid discount amount', 'warning'); return; }
            const families = state.families || [];
            if (!families.length) { showToast('No families found', 'warning'); return; }
            if (!await confirmDialog('Apply family discount to all families?')) return;
            let updated = 0;
            for (const family of families) {
                const r = await apiRequest('families?id=eq.' + family.id, 'PATCH', { discount_amount: discVal, updated_at: new Date().toISOString() });
                if (r.success) updated++;
            }
            await refreshTable('families'); showToast('✅ Discount applied to ' + updated + ' families', 'success');
        }

        async function applySiblingDiscount() {
            const discPct = parseFloat(document.getElementById('sibling-disc-pct')?.value) || 10;
            const families = state.families || [];
            let applied = 0;
            for (const family of families) {
                const members = state.students.filter(s => s.family_id === family.id && s.status === 'Active');
                if (members.length < 2) continue;
                // Apply to all but oldest enrolled student
                const younger = members.slice(1);
                for (const student of younger) {
                    const fees = (state.studentFees || []).filter(f => f.student_id === student.id && !f.is_paid && !f.is_waived);
                    for (const fee of fees) { const disc = fee.amount * (discPct / 100); await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { amount: Math.max(0, fee.amount - disc), updated_at: new Date().toISOString() }); applied++; }
                }
            }
            await refreshTable('student_fees'); showToast('✅ Sibling discount applied (' + discPct + '%) to ' + applied + ' fees', 'success');
        }

        async function previewBulkDiscount() {
            const classId = document.getElementById('bulk-disc-class')?.value; const type = document.getElementById('bulk-disc-type')?.value; const value = parseFloat(document.getElementById('bulk-disc-value')?.value);
            if (!classId || isNaN(value)) { showToast('Select class and enter a discount value first', 'warning'); return; }
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const totalFees = students.reduce((sum, s) => sum + (state.studentFees || []).filter(f => f.student_id === s.id && !f.is_paid && !f.is_waived).reduce((s2, f) => s2 + f.amount, 0), 0);
            const discTotal = type === 'percentage' ? totalFees * (value / 100) : students.length * value;
            showToast('Preview: ' + fmtCurrency(discTotal) + ' total discount for ' + students.length + ' students (' + fmtCurrency(totalFees) + ' total fees)', 'info', 6000);
        }

        async function editFamilyDiscount(familyId) {
            const family = state.families.find(f => f.id === familyId);
            if (!family) return;
            showModal('<div class="modal-overlay" id="edit-family-disc-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Family Discount</h3><button class="modal-close" onclick="closeModal(\'edit-family-disc-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Family: <strong>' + esc(family.family_code) + '</strong></label></div><div class="form-group"><label>Discount Amount (RWF)</label><input id="edit-family-disc-amount" type="number" class="form-control" value="' + (family.discount_amount || 0) + '" min="0"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'edit-family-disc-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditFamilyDiscount(' + familyId + ')">Save</button></div></div></div>');
            window._saveEditFamilyDiscount = async (id) => {
                const amount = parseFloat(document.getElementById('edit-family-disc-amount')?.value) || 0;
                const r = await apiRequest('families?id=eq.' + id, 'PATCH', { discount_amount: amount, updated_at: new Date().toISOString() });
                if (r.success) { closeModal(); await refreshTable('families'); showToast('✅ Family discount updated', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        // ── ACADEMIC YEARS ─────────────────────────────────────────────────────

        async function openAddYearModal() {
            showModal('<div class="modal-overlay" id="add-year-modal"><div class="modal modal-sm"><div class="modal-header"><h3>📅 Add Academic Year</h3><button class="modal-close" onclick="closeModal(\'add-year-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Year Name</label><input id="year-name" class="form-control" placeholder="e.g. 2025-2026"></div><div class="form-group"><label>Start Date</label><input id="year-start" type="date" class="form-control"></div><div class="form-group"><label>End Date</label><input id="year-end" type="date" class="form-control"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'add-year-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._saveYear()">Save Year</button></div></div></div>');
            window._saveYear = async () => {
                const name = document.getElementById('year-name')?.value.trim(); const start = document.getElementById('year-start')?.value; const end = document.getElementById('year-end')?.value;
                if (!name) { showToast('Year name is required', 'warning'); return; }
                const r = await apiRequest('academic_years', 'POST', { name, start_date: start, end_date: end, is_active: false, created_at: new Date().toISOString() });
                if (r.success) { closeModal(); await refreshTable('academic_years'); showToast('✅ Academic year added', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function editAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId); if (!year) return;
            showModal('<div class="modal-overlay" id="edit-year-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Academic Year</h3><button class="modal-close" onclick="closeModal(\'edit-year-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Year Name</label><input id="edit-year-name" class="form-control" value="' + esc(year.name) + '"></div><div class="form-group"><label>Start Date</label><input id="edit-year-start" type="date" class="form-control" value="' + (year.start_date || '') + '"></div><div class="form-group"><label>End Date</label><input id="edit-year-end" type="date" class="form-control" value="' + (year.end_date || '') + '"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'edit-year-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._updateYear(' + yearId + ')">Update</button></div></div></div>');
            window._updateYear = async (id) => {
                const r = await apiRequest('academic_years?id=eq.' + id, 'PATCH', { name: document.getElementById('edit-year-name')?.value.trim(), start_date: document.getElementById('edit-year-start')?.value, end_date: document.getElementById('edit-year-end')?.value, updated_at: new Date().toISOString() });
                if (r.success) { closeModal(); await refreshTable('academic_years'); showToast('✅ Year updated', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function deleteAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId); if (!year) return;
            if (year.is_active) { showToast('Cannot delete the active academic year', 'error'); return; }
            if (!await confirmDialog('Delete academic year "' + year.name + '"? This will also delete all its terms and assessments.')) return;
            await apiRequest('academic_years?id=eq.' + yearId, 'DELETE');
            await refreshTable('academic_years'); showToast('✅ Academic year deleted', 'success');
        }

        async function cloneAcademicYear(yearId) {
            const year = state.academicYears.find(y => y.id === yearId); if (!year) return;
            const newName = prompt('Name for cloned year:', year.name + ' (Copy)'); if (!newName) return;
            const r = await apiRequest('academic_years', 'POST', { name: newName, start_date: year.start_date, end_date: year.end_date, is_active: false, created_at: new Date().toISOString() });
            if (r.success) { const newYearId = r.data[0]?.id; const terms = state.terms.filter(t => t.academic_year_id === yearId); for (const term of terms) await apiRequest('terms', 'POST', { name: term.name, term_number: term.term_number, start_date: term.start_date, end_date: term.end_date, academic_year_id: newYearId, is_active: false, created_at: new Date().toISOString() }); await refreshTable('academic_years'); await refreshTable('terms'); showToast('✅ Academic year cloned with terms', 'success'); }
            else showToast('Failed to clone: ' + r.error, 'error');
        }

        async function setAcademicYearStatus(yearId, activate) {
            if (activate) { for (const y of state.academicYears) await apiRequest('academic_years?id=eq.' + y.id, 'PATCH', { is_active: y.id === yearId, updated_at: new Date().toISOString() }); }
            else await apiRequest('academic_years?id=eq.' + yearId, 'PATCH', { is_active: false, updated_at: new Date().toISOString() });
            await refreshTable('academic_years'); showToast('✅ Academic year status updated', 'success');
        }

        async function viewYearTerms(yearId) {
            const year = state.academicYears.find(y => y.id === yearId); const terms = state.terms.filter(t => t.academic_year_id === yearId).sort((a, b) => a.term_number - b.term_number);
            showModal('<div class="modal-overlay" id="year-terms-modal"><div class="modal"><div class="modal-header"><h3>📅 Terms — ' + esc(year?.name) + '</h3><button class="modal-close" onclick="closeModal(\'year-terms-modal\')">✕</button></div><div class="modal-body"><div class="table-wrapper"><table class="data-table"><thead><tr><th>#</th><th>Term Name</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>' + terms.map(t => '<tr><td>' + t.term_number + '</td><td><strong>' + esc(t.name) + '</strong></td><td>' + fmtDate(t.start_date) + '</td><td>' + fmtDate(t.end_date) + '</td><td>' + (t.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>') + '</td></tr>').join('') + '</tbody></table></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'year-terms-modal\')">Close</button></div></div></div>');
        }

        function exportAcademicYearsData() {
            const data = state.academicYears.flatMap(y => { const terms = state.terms.filter(t => t.academic_year_id === y.id); return terms.length ? terms.map(t => ({ 'Academic Year': y.name, 'Term': t.name, 'Term #': t.term_number, 'Start': fmtDate(t.start_date), 'End': fmtDate(t.end_date), 'Year Active': y.is_active ? 'Yes' : 'No', 'Term Active': t.is_active ? 'Yes' : 'No' })) : [{ 'Academic Year': y.name, 'Term': '(no terms)', 'Term #': '', 'Start': fmtDate(y.start_date), 'End': fmtDate(y.end_date), 'Year Active': y.is_active ? 'Yes' : 'No', 'Term Active': '' }]; });
            exportToExcel(data, 'Academic_Years_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Academic years exported', 'success');
        }

        // ── NOTIFICATIONS ─────────────────────────────────────────────────────

        async function createSystemNotification() {
            showModal('<div class="modal-overlay" id="create-notif-modal"><div class="modal modal-sm"><div class="modal-header"><h3>🔔 Create Notification</h3><button class="modal-close" onclick="closeModal(\'create-notif-modal\')">✕</button></div><div class="modal-body"><div class="form-group"><label>Title</label><input id="notif-title" class="form-control" placeholder="Notification title"></div><div class="form-group"><label>Message</label><textarea id="notif-message" class="form-control" rows="3" placeholder="Notification message..."></textarea></div><div class="form-group"><label>Recipients</label><select id="notif-recipients" class="form-control"><option value="all">All Users</option><option value="teachers">Teachers Only</option><option value="accountants">Accountants Only</option></select></div><div class="form-group"><label>Type</label><select id="notif-type" class="form-control"><option value="info">ℹ️ Info</option><option value="warning">⚠️ Warning</option><option value="urgent">🚨 Urgent</option></select></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'create-notif-modal\')">Cancel</button><button class="btn btn-primary" onclick="window._sendNotif()">Send</button></div></div></div>');
            window._sendNotif = async () => {
                const title = document.getElementById('notif-title')?.value.trim(); const message = document.getElementById('notif-message')?.value.trim(); const recip = document.getElementById('notif-recipients')?.value; const type = document.getElementById('notif-type')?.value;
                if (!title || !message) { showToast('Title and message are required', 'warning'); return; }
                const r = await apiRequest('announcements', 'POST', { title, message, recipients: recip, type, status: 'published', category: 'system', created_by: state.currentUser?.id, created_at: new Date().toISOString() });
                if (r.success) { closeModal(); showToast('✅ Notification sent', 'success'); updateNotificationBadgeCount((state.notifications || []).filter(n => !n.is_read).length + 1); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function clearAllNotificationsData() {
            if (!await confirmDialog('Clear all notifications? This cannot be undone.')) return;
            const notifs = await getAllRecords('announcements', '');
            for (const n of notifs) await apiRequest('announcements?id=eq.' + n.id, 'DELETE');
            state.notifications = []; updateNotificationBadgeCount(0);
            showToast('✅ All notifications cleared', 'success');
        }

        function exportNotificationsData() {
            const notifs = state.notifications || [];
            exportToExcel(notifs.map(n => ({ 'Title': n.title, 'Message': n.message, 'Type': n.type, 'Recipients': n.recipients || 'all', 'Category': n.category || '', 'Date': fmtDateTime(n.created_at) })), 'Notifications_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Notifications exported', 'success');
        }

        async function markAllNotificationsRead() {
            const unread = (state.notifications || []).filter(n => !n.is_read);
            for (const n of unread) { await apiRequest('announcements?id=eq.' + n.id, 'PATCH', { is_read: true }); n.is_read = true; }
            updateNotificationBadgeCount(0); showToast('✅ All notifications marked as read', 'success');
        }

        function filterNotificationsList() {
            const q = (document.getElementById('notif-search')?.value || '').toLowerCase();
            const type = document.getElementById('notif-type-filter')?.value || '';
            const status = document.getElementById('notif-status-filter')?.value || '';
            let visibleCount = 0;
            document.querySelectorAll('#notifications-list .notif-item').forEach(el => {
                const text = el.innerText.toLowerCase();
                const matchQ = !q || text.includes(q);
                const matchType = !type || type === 'all' || el.dataset.type === type;
                const matchStatus = !status || status === 'all' || el.dataset.read === status;
                const visible = matchQ && matchType && matchStatus;
                el.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });
            const countEl = document.getElementById('notif-count');
            if (countEl) countEl.textContent = `${visibleCount} notification${visibleCount !== 1 ? 's' : ''}`;
        }

        // ── SYSTEM HEALTH ─────────────────────────────────────────────────────

        async function runSystemHealthCheck() {
            const container = document.getElementById('health-results'); if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Running health check...</p></div>';
            const checks = [];
            const r = await apiRequest('students?limit=1');
            checks.push({ name: 'Supabase Connection', status: r.success ? 'pass' : 'fail', msg: r.success ? 'Connected' : r.error });
            checks.push({ name: 'Students Data', status: state.students?.length ? 'pass' : 'warn', msg: state.students?.length + ' students loaded' });
            checks.push({ name: 'Marks Data', status: state.marks?.length ? 'pass' : 'warn', msg: state.marks?.length + ' marks loaded' });
            checks.push({ name: 'Payments Data', status: state.payments?.length ? 'pass' : 'warn', msg: state.payments?.length + ' payments loaded' });
            checks.push({ name: 'Fee Categories', status: state.feeCategories?.length ? 'pass' : 'warn', msg: state.feeCategories?.length + ' categories defined' });
            checks.push({ name: 'Academic Year Set', status: state.currentAcadYear ? 'pass' : 'fail', msg: state.currentAcadYear?.name || 'No active academic year' });
            checks.push({ name: 'Current Term Set', status: state.currentTerm ? 'pass' : 'warn', msg: state.currentTerm?.name || 'No active term' });
            checks.push({ name: 'Service Worker', status: ('serviceWorker' in navigator) ? 'pass' : 'warn', msg: ('serviceWorker' in navigator) ? 'Supported' : 'Not supported (offline features disabled)' });
            checks.push({ name: 'SheetJS (Export)', status: (typeof XLSX !== 'undefined') ? 'pass' : 'warn', msg: (typeof XLSX !== 'undefined') ? 'Loaded' : 'Not loaded — Excel exports disabled' });
            checks.push({ name: 'html2pdf (PDF)', status: (typeof html2pdf !== 'undefined') ? 'pass' : 'warn', msg: (typeof html2pdf !== 'undefined') ? 'Loaded' : 'Not loaded — PDF generation disabled' });
            container.innerHTML = '<div class="table-wrapper"><table class="data-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>' + checks.map(c => '<tr><td><strong>' + esc(c.name) + '</strong></td><td style="text-align:center"><span class="badge ' + (c.status === 'pass' ? 'badge-success' : c.status === 'warn' ? 'badge-warning' : 'badge-danger') + '">' + (c.status === 'pass' ? '✅ Pass' : c.status === 'warn' ? '⚠️ Warn' : '❌ Fail') + '</span></td><td>' + esc(c.msg) + '</td></tr>').join('') + '</tbody></table></div>';
        }

        function exportHealthReport() {
            const rows = document.querySelectorAll('#health-results tbody tr');
            if (!rows.length) { showToast('Run health check first', 'warning'); return; }
            const data = Array.from(rows).map(row => { const cells = row.querySelectorAll('td'); return { 'Check': cells[0]?.innerText || '', 'Status': cells[1]?.innerText || '', 'Details': cells[2]?.innerText || '' }; });
            exportToExcel(data, 'Health_Check_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Health report exported', 'success');
        }

        async function showDatabaseSummary() {
            const modal = document.createElement('div'); modal.id = 'db-summary-modal';
            const tables = ['students', 'teachers', 'classes', 'subjects', 'terms', 'academic_years', 'marks', 'assessments', 'payments', 'student_fees', 'families', 'announcements', 'reminders', 'discounts', 'users'];
            const counts = {};
            for (const t of tables) { const r = await apiRequest(t + '?select=id&limit=1', 'GET', null, true); const range = r.headers?.get('content-range') || ''; const total = range.includes('/') ? parseInt(range.split('/')[1]) : (state[t]?.length || 0); counts[t] = isNaN(total) ? (state[t]?.length || 0) : total; }
            showModal('<div class="modal-overlay" id="db-summary-modal"><div class="modal"><div class="modal-header"><h3>🗄️ Database Summary</h3><button class="modal-close" onclick="closeModal(\'db-summary-modal\')">✕</button></div><div class="modal-body"><div class="stats-grid">' + tables.map(t => '<div class="stat-card"><div class="stat-value">' + (counts[t] || 0).toLocaleString() + '</div><div class="stat-label">' + t.replace(/_/g, ' ') + '</div></div>').join('') + '</div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'db-summary-modal\')">Close</button></div></div></div>');
        }

        // ── CLASS REGISTER ─────────────────────────────────────────────────────

        async function renderCRTable() {
            const classId = document.getElementById('cr-class-select')?.value; const termId = document.getElementById('cr-term-select')?.value;
            const container = document.getElementById('cr-table-container'); if (!container) return;
            if (!classId) { container.innerHTML = '<div class="alert alert-info">Select a class to view the register</div>'; return; }

            // "Annual" option routes to the combined three-term register
            if (termId === 'annual') {
                const cls = getClassById(classId);
                container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading annual register...</p></div>';
                await renderCRTableAnnual(cls, (cls?.level || '').toLowerCase() === 'nursery', container);
                return;
            }

            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const cls = getClassById(classId); const term = getTermById(termId);
            const assessments = state.assessments.filter(a => a.class_id == classId && (!termId || a.term_id == termId));
            const subjects = [...new Map(assessments.map(a => [a.subject_id, state.subjects.find(s => s.id === a.subject_id)])).values()].filter(Boolean)
                .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
            const headerRow = '<tr><th class="cr-col-rank">#</th><th class="cr-col-name">Student Name</th>' + subjects.map(s => '<th colspan="2" style="text-align:center">' + esc(s.name) + '</th>').join('') + '<th style="text-align:center">Total</th><th style="text-align:center">%</th><th style="text-align:center">Grade</th><th style="text-align:center">Rank</th></tr>';
            const subHeaderRow = '<tr><th class="cr-col-rank"></th><th class="cr-col-name"></th>' + subjects.map(() => '<th style="text-align:center;font-size:10px">MG</th><th style="text-align:center;font-size:10px">EX</th>').join('') + '<th colspan="4"></th></tr>';
            const studentScores = students.map(student => {
                const marks = state.marks.filter(m => m.student_id === student.id); let totalScore = 0, totalMax = 0;
                const subjectMarks = subjects.map(subject => {
                    const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
                    let mg = 0, ex = 0, mgMax = 0, exMax = 0;
                    for (const a of subjectAssessments) {
                        const mark = marks.find(m => m.assessment_id === a.id);
                        if (mark) {
                            if (['Exam', 'Final Exam'].includes(a.assessment_type)) { ex += mark.score; exMax += a.max_marks; }
                            else { mg += mark.score; mgMax += a.max_marks; }
                        }
                    }
                    totalScore += mg + ex; totalMax += mgMax + exMax;
                    return { mg: mgMax > 0 ? mg : null, ex: exMax > 0 ? ex : null };
                });
                const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                return { student, subjectMarks, totalScore, totalMax, pct, grade: getGrade(pct) };
            }).sort((a, b) => b.pct - a.pct);
            studentScores.forEach((s, i) => s.rank = i + 1);
            const bodyRows = studentScores.map((s, i) => '<tr><td class="cr-col-rank">' + s.rank + '</td><td class="cr-col-name"><strong>' + esc(s.student.first_name) + ' ' + esc(s.student.last_name) + '</strong></td>' + s.subjectMarks.map(m => '<td style="text-align:center">' + (m.mg !== null ? m.mg.toFixed(1) : '—') + '</td><td style="text-align:center">' + (m.ex !== null ? m.ex.toFixed(1) : '—') + '</td>').join('') + '<td style="text-align:right;font-weight:600">' + s.totalScore.toFixed(1) + '</td><td style="text-align:center"><span class="badge ' + getGradeClass(s.pct) + '">' + s.pct.toFixed(1) + '%</span></td><td style="text-align:center">' + s.grade + '</td><td style="text-align:center;font-weight:700">' + s.rank + '</td></tr>').join('');
            container.innerHTML = '<div class="cr-table-wrapper"><table class="data-table cr-table" id="cr-table"><thead>' + headerRow + subHeaderRow + '</thead><tbody>' + bodyRows + '</tbody></table></div>';
        }

        function exportCRToExcel() {
            const table = document.getElementById('cr-table'); if (!table || !initXLSX()) return;
            const ws = XLSX.utils.table_to_sheet(table); const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Class_Register');
            XLSX.writeFile(wb, 'Class_Register_' + new Date().toISOString().split('T')[0] + '.xlsx');
            showToast('✅ Class register exported', 'success');
        }

        // ── FAMILY MANAGEMENT EXTRAS ───────────────────────────────────────────

        async function createFamilyFromSiblings() {
            const cbs = document.querySelectorAll('.unlinked-cb:checked');
            if (cbs.length < 2) { showToast('Select at least 2 students to create a family from siblings', 'warning'); return; }
            const studentIds = Array.from(cbs).map(cb => parseInt(cb.dataset.id));
            const students = studentIds.map(id => state.students.find(s => s.id === id)).filter(Boolean);
            const guardian = students[0].guardian_name || '';
            const code = 'FAM-SIB-' + Date.now().toString().slice(-6);
            const r = await apiRequest('families', 'POST', { family_code: code, guardian_name: guardian, guardian_phone: students[0].guardian_phone || '', created_at: new Date().toISOString() });
            if (!r.success) { showToast('Failed to create family: ' + r.error, 'error'); return; }
            for (const s of students) await apiRequest('students?id=eq.' + s.id, 'PATCH', { family_id: r.data[0].id, updated_at: new Date().toISOString() });
            await refreshTable('students'); await refreshTable('families');
            showToast('✅ Sibling family created (' + code + ')', 'success');
            renderUnlinkedStudents(); filterFamilyList();
        }

        // ── FINANCE EXTRAS ─────────────────────────────────────────────────────

        async function generateStudentStatement(studentId) {
            const student = getStudentById(studentId); if (!student) { showToast('Student not found', 'error'); return; }
            const fees = (state.studentFees || []).filter(f => f.student_id == studentId);
            const payments = (state.payments || []).filter(p => p.student_id == studentId).sort((a, b) => new Date(a.payment_date || a.created_at) - new Date(b.payment_date || b.created_at));
            const cls = getClassById(student.class_id);
            const school = state.schoolSettings || {};
            const totalFees = fees.filter(f => !f.is_waived && !f.is_credit).reduce((s, f) => s + (f.amount || 0), 0);
            const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
            const balance = totalFees - totalPaid;
            const feeRows = fees.filter(f => !f.is_waived && !f.is_credit).map(f => { const cat = state.feeCategories.find(c => c.id === f.fee_category_id); return '<tr><td>' + esc(cat?.name || 'Fee') + '</td><td style="text-align:right">' + fmtCurrency(f.amount) + '</td><td style="text-align:right">' + fmtCurrency(f.paid_amount || 0) + '</td><td style="text-align:right">' + fmtCurrency(f.amount - (f.paid_amount || 0)) + '</td><td>' + (f.is_paid ? '<span class="badge badge-success">Paid</span>' : f.paid_amount > 0 ? '<span class="badge badge-warning">Partial</span>' : '<span class="badge badge-danger">Due</span>') + '</td></tr>'; }).join('');
            const payRows = payments.map(p => '<tr><td>' + fmtDate(p.payment_date || p.created_at) + '</td><td>' + esc(p.receipt_number || '—') + '</td><td>' + esc(p.payment_method || '—') + '</td><td style="text-align:right">' + fmtCurrency(p.amount) + '</td></tr>').join('');
            window._currentStudentStatement = { student, cls, totalFees, totalPaid, balance, fees, payments };
            const modal = document.getElementById('student-statement-modal');
            if (modal) {
                document.getElementById('statement-title').textContent = 'Statement — ' + student.first_name + ' ' + student.last_name;
                document.getElementById('statement-content').innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;background:var(--bg-tertiary);padding:12px;border-radius:8px"><div><div style="font-size:11px;color:var(--text-muted)">Total Fees</div><div style="font-size:18px;font-weight:700">' + fmtCurrency(totalFees) + '</div></div><div><div style="font-size:11px;color:var(--text-muted)">Total Paid</div><div style="font-size:18px;font-weight:700;color:var(--success)">' + fmtCurrency(totalPaid) + '</div></div><div><div style="font-size:11px;color:var(--text-muted)">Balance</div><div style="font-size:18px;font-weight:700;' + (balance > 0 ? 'color:var(--danger)' : 'color:var(--success)') + '">' + fmtCurrency(balance) + '</div></div></div><h4>Fee Breakdown</h4><div class="table-wrapper" style="margin-bottom:16px"><table class="data-table"><thead><tr><th>Fee</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>' + feeRows + '</tbody></table></div><h4>Payment History</h4><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Receipt #</th><th>Method</th><th>Amount</th></tr></thead><tbody>' + (payRows || '<tr><td colspan="4" style="text-align:center">No payments recorded</td></tr>') + '</tbody></table></div>';
                modal.style.display = 'flex';
            } else {
                printStudentStatement();
            }
        }

        function printStudentStatement() {
            const data = window._currentStudentStatement; if (!data) { showToast('Generate a statement first', 'warning'); return; }
            const school = state.schoolSettings || {}; const win = window.open('', '_blank'); if (!win) { showToast('Popup blocked', 'warning'); return; }
            win.document.write('<!DOCTYPE html><html><head><title>Statement - ' + data.student.first_name + ' ' + data.student.last_name + '</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1,h2{text-align:center;color:#1a3a5c}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ccc;padding:8px}th{background:#1a3a5c;color:white}.total{font-size:18px;font-weight:bold;padding:12px;text-align:right}@media print{body{padding:0}}</style></head><body><h1>' + esc(school.school_name || 'ECOLE LA FONTAINE') + '</h1><h2>Student Fee Statement</h2><p style="text-align:center"><strong>' + esc(data.student.first_name) + ' ' + esc(data.student.last_name) + '</strong> | ' + esc(data.cls?.name || '') + ' | Generated: ' + new Date().toLocaleString() + '</p><h3>Fee Summary</h3><table><thead><tr><th>Fee</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>' + data.fees.filter(f => !f.is_waived && !f.is_credit).map(f => { const cat = state.feeCategories.find(c => c.id === f.fee_category_id); return '<tr><td>' + esc(cat?.name || 'Fee') + '</td><td style="text-align:right">' + fmtCurrency(f.amount) + '</td><td style="text-align:right">' + fmtCurrency(f.paid_amount || 0) + '</td><td style="text-align:right">' + fmtCurrency(f.amount - (f.paid_amount || 0)) + '</td></tr>'; }).join('') + '</tbody></table><h3>Payment History</h3><table><thead><tr><th>Date</th><th>Receipt #</th><th>Method</th><th>Amount</th></tr></thead><tbody>' + data.payments.map(p => '<tr><td>' + fmtDate(p.payment_date || p.created_at) + '</td><td>' + esc(p.receipt_number || '—') + '</td><td>' + esc(p.payment_method || '—') + '</td><td style="text-align:right">' + fmtCurrency(p.amount) + '</td></tr>').join('') + '</tbody></table><div class="total">Outstanding Balance: ' + fmtCurrency(data.balance) + '</div></body></html>');
            win.document.close(); win.print();
        }

        function exportStatementToExcel() {
            const data = window._currentStudentStatement; if (!data || !initXLSX()) { showToast('Generate a statement first', 'warning'); return; }
            const rows = [['Date', 'Receipt #', 'Method', 'Amount (RWF)'], ...data.payments.map(p => [fmtDate(p.payment_date || p.created_at), p.receipt_number || '', p.payment_method || '', p.amount])];
            const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Statement');
            XLSX.writeFile(wb, 'Statement_' + data.student.first_name + '_' + data.student.last_name + '.xlsx');
            showToast('✅ Statement exported', 'success');
        }

        async function printReceiptById(paymentId) {
            const payment = state.payments.find(p => p.id === paymentId); if (!payment) { showToast('Payment not found', 'error'); return; }
            const student = state.students.find(s => s.id === payment.student_id); const cls = getClassById(student?.class_id);
            const school = state.schoolSettings || {};
            const studentCode = student?.student_code || '—';
            const parentName = student?.guardian_name || '—';
            // Look up who recorded this payment (by user id) to determine role/name
            let recordedBy = null;
            if (payment.recorded_by) {
                let recordedUser = (state.users || []).find(u => u.id === payment.recorded_by);
                if (!recordedUser) {
                    try {
                        const r = await apiRequest('users?id=eq.' + payment.recorded_by, 'GET');
                        if (r.success && r.data?.length) recordedUser = r.data[0];
                    } catch (e) { /* ignore — fallback to '—' */ }
                }
                if (recordedUser) recordedBy = { role: recordedUser.role, name: recordedUser.name };
            }
            // Itemized fees for this student (for the fee breakdown table)
            const studentFees = (state.studentFees || []).filter(f => f.student_id === payment.student_id && !f.is_credit && !f.manually_deleted);
            const feeDetails = studentFees.map(f => {
                const cat = (state.feeCategories || []).find(c => c.id === f.fee_category_id);
                return { name: cat?.name || 'Fee', amount: f.is_waived ? (f.paid_amount || 0) : (f.amount || 0), paid: f.paid_amount || 0 };
            });
            await downloadReceiptPDF({ receiptNum: payment.receipt_number || 'RCP-' + paymentId, studentName: student ? student.first_name + ' ' + student.last_name : 'Unknown', studentCode, className: cls?.name || '—', parentName, amount: payment.amount, method: payment.payment_method || '—', date: fmtDate(payment.payment_date || payment.created_at), recordedBy, fees: feeDetails, schoolName: school.school_name || 'ECOLE LA FONTAINE', schoolAddress: school.school_address || school.address || '', logo: school.school_logo || school.logo_url || '🏫' });
        }

        function exportAccountantDashboard() {
            const payments = state.payments || []; const fees = state.studentFees || [];
            const totalFees = fees.filter(f => !f.is_waived && !f.is_credit).reduce((s, f) => s + (f.amount || 0), 0);
            const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
            const outstanding = totalFees - totalPaid;
            const data = [{ 'Metric': 'Total Fees Assessed', 'Value (RWF)': totalFees }, { 'Metric': 'Total Payments Received', 'Value (RWF)': totalPaid }, { 'Metric': 'Outstanding Balance', 'Value (RWF)': outstanding }, { 'Metric': 'Collection Rate (%)', 'Value (RWF)': totalFees > 0 ? ((totalPaid / totalFees) * 100).toFixed(1) : '0' }, { 'Metric': 'Total Students', 'Value (RWF)': (state.students || []).filter(s => s.status === 'Active').length }, { 'Metric': 'Payments Recorded', 'Value (RWF)': payments.length }];
            exportToExcel(data, 'Accountant_Dashboard_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Dashboard exported', 'success');
        }

        function exportCollectionByClass() {
            const data = state.classes.filter(c => c.is_active !== false).map(cls => {
                const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
                let totalFees = 0, totalPaid = 0;
                for (const s of students) { const fees = (state.studentFees || []).filter(f => f.student_id === s.id && !f.is_waived && !f.is_credit); totalFees += fees.reduce((sum, f) => sum + (f.amount || 0), 0); totalPaid += fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0); }
                return { 'Class': cls.name, 'Students': students.length, 'Total Fees (RWF)': totalFees, 'Total Paid (RWF)': totalPaid, 'Outstanding (RWF)': totalFees - totalPaid, 'Collection Rate (%)': totalFees > 0 ? ((totalPaid / totalFees) * 100).toFixed(1) : '0' };
            });
            exportToExcel(data, 'Collection_By_Class_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Collection by class exported', 'success');
        }

        function exportClassPerf() {
            const yearId = state.currentAcadYear?.id; const termId = state.currentTerm?.id;
            const data = state.classes.filter(c => c.is_active !== false).map(cls => {
                const students = state.students.filter(s => s.class_id === cls.id && s.status === 'Active');
                const assessments = state.assessments.filter(a => a.class_id === cls.id && (!termId || a.term_id == termId));
                let totalPct = 0, count = 0;
                for (const student of students) { let score = 0, max = 0; const marks = state.marks.filter(m => m.student_id === student.id); for (const a of assessments) { const mark = marks.find(m => m.assessment_id === a.id); if (mark) { score += mark.score; max += a.max_marks; } } if (max > 0) { totalPct += (score / max) * 100; count++; } }
                const avg = count > 0 ? totalPct / count : 0;
                return { 'Class': cls.name, 'Students': students.length, 'Assessments': assessments.length, 'Average (%)': avg.toFixed(1), 'Grade': getGrade(avg), 'Pass Rate (%)': count > 0 ? ((students.filter(s => { let sc = 0, mx = 0; state.marks.filter(m => m.student_id === s.id).forEach(m => { const a = assessments.find(x => x.id === m.assessment_id); if (a) { sc += m.score; mx += a.max_marks; } }); return mx > 0 && (sc / mx) * 100 >= 50; }).length / count) * 100).toFixed(1) : '0' };
            });
            exportToExcel(data, 'Class_Performance_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Class performance exported', 'success');
        }

        //============================================================================
        // ECOLE LA FONTAINE — MISSING_FUNCTIONS
        // ============================================================================
        // ============================================================================

        // ════════════════════════════════════════════════════════════════════
        // BLOCK A — ASSESSMENT LOCKING
        // ════════════════════════════════════════════════════════════════════

        async function refreshAssessmentList() {
            const container = document.getElementById('assessment-lock-table');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
            await ensureStateLoaded();
            filterLockAssessments();
        }

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
            if (!list.length) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No assessments match the filters.</div>';
                return;
            }
            const rows = list.map(a => {
                const cls = state.classes.find(c => c.id === a.class_id);
                const subj = state.subjects.find(s => s.id === a.subject_id);
                const term = state.terms.find(t => t.id === a.term_id);
                return `<tr>
                    <td><strong>${esc(a.title)}</strong></td>
                    <td>${esc(cls?.name || '—')}</td><td>${esc(subj?.name || '—')}</td>
                    <td>${esc(term?.name || '—')}</td><td>${esc(a.assessment_type || '—')}</td>
                    <td>${fmtDate(a.date)}</td>
                    <td><span class="badge ${a.is_locked ? 'badge-danger' : 'badge-success'}">${a.is_locked ? '🔒 Locked' : '🔓 Open'}</span></td>
                    <td><button class="btn btn-sm ${a.is_locked ? 'btn-success' : 'btn-warning'}"
                        onclick="window.toggleAssessmentLock(${a.id},${a.is_locked})">
                        ${a.is_locked ? '🔓 Unlock' : '🔒 Lock'}</button></td></tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table"><thead><tr>
                <th>Title</th><th>Class</th><th>Subject</th><th>Term</th>
                <th>Type</th><th>Date</th><th>Status</th><th>Action</th>
            </tr></thead><tbody>${rows}</tbody></table>`;
        }

        async function toggleAssessmentLock(id, isLocked) {
            const r = await apiRequest('assessments?id=eq.' + id, 'PATCH', {
                is_locked: !isLocked, updated_at: new Date().toISOString()
            });
            if (r.success) {
                const a = state.assessments.find(x => x.id === id);
                if (a) a.is_locked = !isLocked;
                showToast(isLocked ? '🔓 Assessment unlocked' : '🔒 Assessment locked', 'success');
                filterLockAssessments();
            } else showToast('Failed: ' + r.error, 'error');
        }

        function openBulkLockModal() {
            const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const classes = (state.classes || []).filter(c => c.is_active !== false);
            showModal(`<div class="modal-overlay" id="bulk-lock-modal"><div class="modal">
                <div class="modal-header"><h3>🔒 Bulk Lock / Unlock</h3>
                <button class="modal-close" onclick="closeModal('bulk-lock-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="alert alert-warning">⚠️ Applies to ALL assessments matching filters.</div>
                    <div class="form-grid">
                        <div class="form-group"><label>Term</label>
                            <select id="bulk-lock-term" class="form-control"><option value="">All Terms</option>
                            ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Class</label>
                            <select id="bulk-lock-class" class="form-control"><option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('bulk-lock-modal')">Cancel</button>
                    <button class="btn btn-warning" onclick="window._bulkLock(true)">🔒 Lock All</button>
                    <button class="btn btn-success" onclick="window._bulkLock(false)">🔓 Unlock All</button>
                </div></div></div>`);
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

        async function saveAutoLockSettings() {
            const days = parseInt(document.getElementById('auto-lock-days')?.value) || 0;
            await updateSchoolSetting('auto_lock_days', String(days));
            state.schoolSettings.auto_lock_days = days;
            showToast('✅ Auto-lock setting saved (' + days + ' days)', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK B — ASSESSMENT EXPORT
        // ════════════════════════════════════════════════════════════════════

        async function executeAssessmentExport() {
            await ensureStateLoaded();
            const aId = document.getElementById('ae-assessment')?.value;
            const cId = document.getElementById('ae-class')?.value;
            const tId = document.getElementById('ae-term')?.value;
            let assessments = state.assessments || [];
            if (aId) assessments = assessments.filter(a => String(a.id) === aId);
            if (cId) assessments = assessments.filter(a => String(a.class_id) === cId);
            if (tId) assessments = assessments.filter(a => String(a.term_id) === tId);
            if (!assessments.length) { showToast('No assessments match selection', 'warning'); return; }
            const rows = [];
            for (const a of assessments) {
                const cls = state.classes.find(c => c.id === a.class_id);
                const subj = state.subjects.find(s => s.id === a.subject_id);
                const term = state.terms.find(t => t.id === a.term_id);
                const marks = (state.marks || []).filter(m => m.assessment_id === a.id);
                const students = (state.students || []).filter(s => s.class_id === a.class_id && s.status === 'Active')
                    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
                for (const s of students) {
                    const mark = marks.find(m => m.student_id === s.id);
                    rows.push({
                        'Assessment': a.title, 'Class': cls?.name || '—', 'Subject': subj?.name || '—',
                        'Term': term?.name || '—', 'Type': a.assessment_type || '—', 'Max': a.max_marks,
                        'Date': fmtDate(a.date), 'Student': (s.first_name + ' ' + s.last_name).trim(),
                        'Score': mark?.score ?? '—',
                        'Pct': mark?.score != null && a.max_marks > 0 ? ((mark.score / a.max_marks) * 100).toFixed(1) + '%' : '—'
                    });
                }
            }
            if (!rows.length) { showToast('No marks data to export', 'warning'); return; }
            exportToExcel(rows, 'Assessment_Export_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Assessment export complete — ' + rows.length + ' rows', 'success');
        }

        function resetExportForm() {
            ['ae-assessment', 'ae-class', 'ae-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const fmt = document.getElementById('ae-format'); if (fmt) fmt.value = 'excel';
            showToast('Filters reset', 'info', 1500);
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK C — CLASS TIMETABLE
        // ════════════════════════════════════════════════════════════════════

        async function loadClassTimetable() {
            const classId = document.getElementById('ct-class')?.value;
            const container = document.getElementById('ct-grid');
            if (!container) return;
            if (!classId) { container.innerHTML = '<div class="alert alert-info">Select a class to view its timetable.</div>'; return; }
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
            await ensureStateLoaded();
            let slots = [];
            try { const r = await apiRequest('timetable_slots?class_id=eq.' + classId + '&order=day_of_week.asc,time_slot.asc'); slots = r.success ? r.data : []; } catch (e) { }
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const timeSlots = (typeof TIMETABLE_TIME_SLOTS !== 'undefined') ? TIMETABLE_TIME_SLOTS
                : ['08:20-09:00', '09:00-09:40', '09:40-10:20', '10:20-10:40', '10:40-11:20', '11:20-12:00', '12:00-13:00', '13:00-13:40', '13:40-14:20', '14:20-15:00', '15:00-15:20', '15:20-16:00', '16:00-16:40'];
            const grid = timeSlots.map(ts => {
                const cells = days.map(day => {
                    const slot = slots.find(s => s.day_of_week === day && s.time_slot === ts);
                    if (slot) {
                        const subj = state.subjects.find(s => s.id === slot.subject_id);
                        const teacher = state.teachers.find(t => t.id === slot.teacher_id);
                        return `<td style="background:var(--primary-soft);font-size:12px"><strong>${esc(subj?.code || subj?.name || '?')}</strong><br><small>${esc((teacher?.last_name || '').substring(0, 10))}</small></td>`;
                    }
                    const isBreak = typeof isBreakSlot === 'function' && isBreakSlot(ts);
                    return `<td style="${isBreak ? 'background:var(--bg-tertiary);color:var(--text-muted);text-align:center;font-size:11px' : ''}">${isBreak ? (typeof getBreakIcon === 'function' ? getBreakIcon(ts) : '☕') : ''}</td>`;
                }).join('');
                return `<tr><td style="font-size:11px;white-space:nowrap;color:var(--text-muted)">${esc(ts)}</td>${cells}</tr>`;
            }).join('');
            container.innerHTML = `<div class="table-wrapper"><table class="data-table" style="font-size:13px">
                <thead><tr><th>Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
                <tbody>${grid}</tbody></table></div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-sm btn-outline" onclick="window.openAddTimetableSlot()">➕ Add Slot</button>
                    <button class="btn btn-sm btn-outline" onclick="window.exportClassTimetable()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printClassTimetable()">🖨️ Print</button>
                </div>`;
        }

        async function exportClassTimetable() {
            const classId = document.getElementById('ct-class')?.value;
            if (!classId) { showToast('Select a class first', 'warning'); return; }
            const cls = state.classes.find(c => String(c.id) === String(classId));
            let slots = [];
            try { const r = await apiRequest('timetable_slots?class_id=eq.' + classId + '&order=day_of_week.asc,time_slot.asc'); slots = r.success ? r.data : []; } catch (e) { }
            const rows = slots.map(s => {
                const subj = state.subjects.find(x => x.id === s.subject_id);
                const teacher = state.teachers.find(t => t.id === s.teacher_id);
                return { 'Day': s.day_of_week, 'Time': s.time_slot, 'Subject': subj?.name || '—', 'Code': subj?.code || '—', 'Teacher': teacher ? (teacher.first_name + ' ' + teacher.last_name).trim() : '—' };
            });
            exportToExcel(rows, (cls?.name || 'Class') + '_Timetable_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Timetable exported', 'success');
        }

        function printClassTimetable() {
            const classId = document.getElementById('ct-class')?.value;
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const grid = document.getElementById('ct-grid');
            if (!grid || !classId) { showToast('Load a timetable first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Timetable — ${esc(cls?.name || '')}</title>
            <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px}th{background:#1a3a5c;color:#fff}
            @media print{button{display:none}}</style></head>
            <body><h2>📅 ${esc(cls?.name || '')} — Timetable — ${new Date().toLocaleDateString()}</h2>
            ${grid.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        function openAddTimetableSlot() {
            const classId = document.getElementById('ct-class')?.value;
            const classes = (state.classes || []).filter(c => c.is_active !== false);
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const timeSlots = (typeof TIMETABLE_TIME_SLOTS !== 'undefined') ? TIMETABLE_TIME_SLOTS
                : ['08:20-09:00', '09:00-09:40', '09:40-10:20', '10:40-11:20', '11:20-12:00', '13:00-13:40', '13:40-14:20', '14:20-15:00', '15:20-16:00', '16:00-16:40'];
            showModal(`<div class="modal-overlay" id="add-slot-modal"><div class="modal modal-sm">
                <div class="modal-header"><h3>➕ Add Timetable Slot</h3>
                <button class="modal-close" onclick="closeModal('add-slot-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Class *</label>
                        <select id="ts-class" class="form-control">${classes.map(c => `<option value="${c.id}"${String(c.id) === String(classId) ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Day *</label>
                        <select id="ts-day" class="form-control">${days.map(d => `<option>${d}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Time Slot *</label>
                        <select id="ts-time" class="form-control">${timeSlots.map(t => `<option>${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Subject *</label>
                        <select id="ts-subject" class="form-control"><option value="">— Select —</option>
                        ${(state.subjects || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Teacher</label>
                        <select id="ts-teacher" class="form-control"><option value="">— None —</option>
                        ${(state.teachers || []).map(t => `<option value="${t.id}">${esc(t.first_name + ' ' + t.last_name)}</option>`).join('')}</select></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('add-slot-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window._saveSlot()">💾 Save Slot</button>
                </div></div></div>`);
            window._saveSlot = async () => {
                const payload = {
                    class_id: parseInt(document.getElementById('ts-class')?.value),
                    day_of_week: document.getElementById('ts-day')?.value,
                    time_slot: document.getElementById('ts-time')?.value,
                    subject_id: parseInt(document.getElementById('ts-subject')?.value) || null,
                    teacher_id: parseInt(document.getElementById('ts-teacher')?.value) || null,
                    created_at: new Date().toISOString()
                };
                if (!payload.class_id || !payload.day_of_week || !payload.time_slot || !payload.subject_id) {
                    showToast('Class, day, time, and subject are required', 'warning'); return;
                }
                const r = await apiRequest('timetable_slots', 'POST', payload);
                if (r.success) { closeModal('add-slot-modal'); showToast('✅ Slot added', 'success'); await loadClassTimetable(); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function openEditTimetableSlot(slotId) {
            let slot;
            try { const r = await apiRequest('timetable_slots?id=eq.' + slotId); slot = r.success && r.data[0] ? r.data[0] : null; } catch (e) { }
            if (!slot) { showToast('Slot not found', 'error'); return; }
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const timeSlots = (typeof TIMETABLE_TIME_SLOTS !== 'undefined') ? TIMETABLE_TIME_SLOTS
                : ['08:20-09:00', '09:00-09:40', '09:40-10:20', '10:40-11:20', '11:20-12:00', '13:00-13:40', '13:40-14:20', '14:20-15:00', '15:20-16:00', '16:00-16:40'];
            showModal(`<div class="modal-overlay" id="edit-slot-modal"><div class="modal modal-sm">
                <div class="modal-header"><h3>✏️ Edit Timetable Slot</h3>
                <button class="modal-close" onclick="closeModal('edit-slot-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Day</label>
                        <select id="ets-day" class="form-control">${days.map(d => `<option${d === slot.day_of_week ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Time</label>
                        <select id="ets-time" class="form-control">${timeSlots.map(t => `<option${t === slot.time_slot ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Subject</label>
                        <select id="ets-subject" class="form-control"><option value="">— None —</option>
                        ${(state.subjects || []).map(s => `<option value="${s.id}"${s.id === slot.subject_id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Teacher</label>
                        <select id="ets-teacher" class="form-control"><option value="">— None —</option>
                        ${(state.teachers || []).map(t => `<option value="${t.id}"${t.id === slot.teacher_id ? ' selected' : ''}>${esc(t.first_name + ' ' + t.last_name)}</option>`).join('')}</select></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" onclick="window.deleteTimetableSlot(${slotId})">🗑️ Delete</button>
                    <button class="btn btn-outline" onclick="closeModal('edit-slot-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="window._updateSlot(${slotId})">💾 Save</button>
                </div></div></div>`);
            window._updateSlot = async (id) => {
                const r = await apiRequest('timetable_slots?id=eq.' + id, 'PATCH', {
                    day_of_week: document.getElementById('ets-day')?.value,
                    time_slot: document.getElementById('ets-time')?.value,
                    subject_id: parseInt(document.getElementById('ets-subject')?.value) || null,
                    teacher_id: parseInt(document.getElementById('ets-teacher')?.value) || null,
                    updated_at: new Date().toISOString()
                });
                if (r.success) { closeModal('edit-slot-modal'); showToast('✅ Slot updated', 'success'); await loadClassTimetable(); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function deleteTimetableSlot(slotId) {
            if (!await confirmDialog('Delete this timetable slot?')) return;
            closeModal('edit-slot-modal');
            const r = await apiRequest('timetable_slots?id=eq.' + slotId, 'DELETE');
            if (r.success) { showToast('✅ Slot deleted', 'success'); await loadClassTimetable(); }
            else showToast('Failed: ' + r.error, 'error');
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK E — TIMETABLE CONFLICTS
        // ════════════════════════════════════════════════════════════════════

        async function detectAllConflicts() {
            const container = document.getElementById('conflicts-container');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Scanning…</p></div>';
            let allSlots = [];
            try { const r = await apiRequest('timetable_slots?order=teacher_id.asc,day_of_week.asc,time_slot.asc&limit=5000'); allSlots = r.success ? r.data : []; } catch (e) { }
            const conflicts = []; const seen = {};
            for (const slot of allSlots) {
                if (!slot.teacher_id) continue;
                const key = `${slot.teacher_id}_${slot.day_of_week}_${slot.time_slot}`;
                if (seen[key]) conflicts.push({ slot1: seen[key], slot2: slot }); else seen[key] = slot;
            }
            const countEl = document.getElementById('conflict-count'); if (countEl) countEl.textContent = conflicts.length + ' conflict(s)';
            if (!conflicts.length) { container.innerHTML = '<div class="alert alert-success">✅ No conflicts detected!</div>'; return; }
            const rows = conflicts.map((c, i) => {
                const t = state.teachers.find(x => x.id === c.slot1.teacher_id);
                const s1 = state.subjects.find(x => x.id === c.slot1.subject_id);
                const s2 = state.subjects.find(x => x.id === c.slot2.subject_id);
                const c1 = state.classes.find(x => x.id === c.slot1.class_id);
                const c2 = state.classes.find(x => x.id === c.slot2.class_id);
                return `<tr><td>${esc(t ? t.first_name + ' ' + t.last_name : '—')}</td>
                    <td>${esc(c.slot1.day_of_week)} ${esc(c.slot1.time_slot)}</td>
                    <td>${esc(c1?.name || '—')} — ${esc(s1?.name || '—')}</td>
                    <td>${esc(c2?.name || '—')} — ${esc(s2?.name || '—')}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="window.resolveConflict(${c.slot2.id})">🗑️ Remove 2nd</button></td></tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table"><thead><tr><th>Teacher</th><th>Day & Time</th><th>Slot 1</th><th>Slot 2</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
        }

        async function exportConflictReport() {
            const rows = []; let allSlots = [];
            try { const r = await apiRequest('timetable_slots?limit=5000'); allSlots = r.success ? r.data : []; } catch (e) { }
            const seen = {};
            for (const slot of allSlots) {
                if (!slot.teacher_id) continue;
                const key = `${slot.teacher_id}_${slot.day_of_week}_${slot.time_slot}`;
                if (seen[key]) {
                    const t = state.teachers.find(x => x.id === slot.teacher_id);
                    const s1 = state.subjects.find(x => x.id === seen[key].subject_id);
                    const s2 = state.subjects.find(x => x.id === slot.subject_id);
                    rows.push({ 'Teacher': t ? t.first_name + ' ' + t.last_name : '—', 'Day': slot.day_of_week, 'Time': slot.time_slot, 'Subject 1': s1?.name || '—', 'Subject 2': s2?.name || '—' });
                } else seen[key] = slot;
            }
            if (!rows.length) { showToast('No conflicts to export', 'info'); return; }
            exportToExcel(rows, 'Timetable_Conflicts_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Conflict report exported', 'success');
        }

        function filterConflicts() {
            const search = (document.getElementById('conflict-search')?.value || '').toLowerCase();
            document.querySelectorAll('#conflicts-container tbody tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
            });
        }

        async function resolveConflict(slotId) {
            const r = await apiRequest('timetable_slots?id=eq.' + slotId, 'DELETE');
            if (r.success) { showToast('✅ Conflict resolved', 'success'); await detectAllConflicts(); }
            else showToast('Failed: ' + r.error, 'error');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK F — TIMETABLE IMPORT
        // ════════════════════════════════════════════════════════════════════

        function downloadImportTemplate() {
            exportToExcel([{ class_name: 'PRIMARY 4', day_of_week: 'Monday', time_slot: '08:20-09:00', subject_code: 'MATH', teacher_username: 'jean.mukesa' }], 'Timetable_Import_Template');
            showToast('✅ Template downloaded', 'success');
        }

        async function previewTimetableImport() {
            const fileInput = document.getElementById('timetable-import-file');
            if (!fileInput?.files[0]) { showToast('Select a file first', 'warning'); return; }
            const preview = document.getElementById('timetable-import-preview'); if (!preview) return;
            try {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => { const wb = XLSX.read(e.target.result, { type: 'binary' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); };
                    reader.onerror = reject; reader.readAsBinaryString(fileInput.files[0]);
                });
                window._timetableImportData = data;
                preview.innerHTML = `<div class="alert alert-info">📋 ${data.length} rows ready.</div>
                    <table class="data-table"><thead><tr><th>Class</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead>
                    <tbody>${data.slice(0, 10).map(r => `<tr><td>${esc(r.class_name || '')}</td><td>${esc(r.day_of_week || '')}</td><td>${esc(r.time_slot || '')}</td><td>${esc(r.subject_code || '')}</td><td>${esc(r.teacher_username || '')}</td></tr>`).join('')}
                    ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">…and ${data.length - 10} more</td></tr>` : ''}</tbody></table>
                    <button class="btn btn-primary" style="margin-top:12px" onclick="window.executeTimetableImport()">▶️ Import Now</button>`;
            } catch (e) { preview.innerHTML = '<div class="alert alert-danger">❌ Failed: ' + e.message + '</div>'; }
        }

        async function executeTimetableImport() {
            const data = window._timetableImportData;
            if (!data?.length) { showToast('No data to import', 'warning'); return; }
            await ensureStateLoaded();
            showToast('⏳ Importing ' + data.length + ' slots…', 'info', 5000);
            let ok = 0, fail = 0;
            for (const row of data) {
                const cls = state.classes.find(c => (c.name || '').toLowerCase() === (row.class_name || '').toLowerCase());
                const subj = state.subjects.find(s => (s.code || '').toLowerCase() === (row.subject_code || '').toLowerCase());
                const teacher = state.teachers.find(t => (t.username || '').toLowerCase() === (row.teacher_username || '').toLowerCase());
                if (!cls || !subj) { fail++; continue; }
                const r = await apiRequest('timetable_slots', 'POST', { class_id: cls.id, subject_id: subj.id, teacher_id: teacher?.id || null, day_of_week: row.day_of_week, time_slot: row.time_slot, created_at: new Date().toISOString() });
                if (r.success) ok++; else fail++;
            }
            showToast(`✅ Import complete: ${ok} imported, ${fail} failed`, ok > 0 ? 'success' : 'error');
            window._timetableImportData = null;
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK G — ATTENDANCE ENTRY
        // ════════════════════════════════════════════════════════════════════

        async function loadAttendanceStudents() {
            const classId = document.getElementById('att-class')?.value;
            const date = document.getElementById('att-date')?.value;
            const container = document.getElementById('attendance-students-container');
            const toolbar = document.getElementById('att-toolbar');
            const saveRow = document.getElementById('att-save-row');
            if (!container) return;
            if (!classId || !date) {
                container.innerHTML = '<div class="alert alert-info">Select a class and date to load attendance.</div>';
                if (toolbar) toolbar.style.display = 'none'; if (saveRow) saveRow.style.display = 'none'; return;
            }
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading students…</p></div>';
            await ensureStateLoaded();
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active')
                .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
            if (!students.length) {
                container.innerHTML = '<div class="alert alert-warning">No active students in this class.</div>';
                if (toolbar) toolbar.style.display = 'none'; if (saveRow) saveRow.style.display = 'none'; return;
            }
            let existing = [];
            try { const r = await apiRequest('attendance?class_id=eq.' + classId + '&date=eq.' + date + '&limit=500'); existing = r.success ? r.data : []; } catch (e) { }
            const rows = students.map(s => {
                const rec = existing.find(e => e.student_id === s.id);
                const status = rec ? rec.status : 'present';
                return `<tr>
                    <td>${esc(s.first_name + ' ' + s.last_name)}</td>
                    <td>${esc((state.classes.find(c => c.id === s.class_id))?.name || '—')}</td>
                    <td><select id="att-status-${s.id}" class="form-control" style="width:130px" onchange="window.updateAttSummary()">
                        <option value="present"${status === 'present' ? ' selected' : ''}>✅ Present</option>
                        <option value="absent"${status === 'absent' ? ' selected' : ''}>❌ Absent</option>
                        <option value="late"${status === 'late' ? ' selected' : ''}>⏰ Late</option>
                        <option value="excused"${status === 'excused' ? ' selected' : ''}>📋 Excused</option>
                    </select></td>
                    <td><input type="text" id="att-note-${s.id}" value="${esc(rec?.notes || '')}" placeholder="Note…" style="width:180px" class="form-control"></td>
                </tr>`;
            }).join('');
            container.innerHTML = `<div class="table-wrapper"><table class="data-table">
                <thead><tr><th>Student</th><th>Class</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>${rows}</tbody></table></div>`;
            if (toolbar) toolbar.style.display = ''; if (saveRow) saveRow.style.display = '';
            updateAttSummary();
        }

        function updateAttSummary() {
            const classId = document.getElementById('att-class')?.value;
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active');
            let present = 0, absent = 0, late = 0, excused = 0;
            students.forEach(s => {
                const val = document.getElementById('att-status-' + s.id)?.value || 'present';
                if (val === 'present') present++; else if (val === 'absent') absent++;
                else if (val === 'late') late++; else if (val === 'excused') excused++;
            });
            const el = document.getElementById('att-summary-line');
            if (el) el.textContent = `Total: ${students.length} | ✅ ${present} | ❌ ${absent} | ⏰ ${late} | 📋 ${excused}`;
        }

        function markAllPresent() {
            (state.students || []).filter(s => s.class_id === parseInt(document.getElementById('att-class')?.value) && s.status === 'Active')
                .forEach(s => { const sel = document.getElementById('att-status-' + s.id); if (sel) sel.value = 'present'; });
            updateAttSummary(); showToast('All marked Present', 'info', 1500);
        }

        function markAllAbsent() {
            (state.students || []).filter(s => s.class_id === parseInt(document.getElementById('att-class')?.value) && s.status === 'Active')
                .forEach(s => { const sel = document.getElementById('att-status-' + s.id); if (sel) sel.value = 'absent'; });
            updateAttSummary(); showToast('All marked Absent', 'info', 1500);
        }

        async function saveAttendance() {
            const classId = document.getElementById('att-class')?.value;
            const date = document.getElementById('att-date')?.value;
            if (!classId || !date) { showToast('Select class and date first', 'warning'); return; }
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active');
            if (!students.length) { showToast('No students loaded', 'warning'); return; }
            showToast('⏳ Saving attendance…', 'info', 2000);
            let saved = 0, errors = 0;
            for (const s of students) {
                const status = document.getElementById('att-status-' + s.id)?.value || 'present';
                const notes = document.getElementById('att-note-' + s.id)?.value || '';
                const payload = {
                    student_id: s.id, class_id: parseInt(classId), date, status, notes,
                    recorded_by: state.currentUser?.username || state.currentUser?.name || '',
                    updated_at: new Date().toISOString()
                };
                try {
                    const check = await apiRequest('attendance?student_id=eq.' + s.id + '&date=eq.' + date);
                    const existing = check.success && check.data[0];
                    const r = existing ? await apiRequest('attendance?id=eq.' + existing.id, 'PATCH', payload)
                        : await apiRequest('attendance', 'POST', { ...payload, created_at: new Date().toISOString() });
                    if (r.success) saved++; else errors++;
                } catch (e) { errors++; }
            }
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Saved attendance class ' + classId + ' on ' + date, 'attendance');
            showToast(`✅ Attendance saved — ${saved} students` + (errors ? ` (${errors} errors)` : ''), errors ? 'warning' : 'success');
            const absentList = students.filter(s => document.getElementById('att-status-' + s.id)?.value === 'absent');
            const abDiv = document.getElementById('att-absent-report'); const abBody = document.getElementById('att-absent-list');
            if (abDiv && abBody) { abDiv.style.display = ''; abBody.innerHTML = absentList.length ? absentList.map(s => `<div style="padding:6px 0;border-bottom:1px solid var(--border-light)">${esc(s.first_name + ' ' + s.last_name)}</div>`).join('') : '<p style="color:var(--text-muted)">🎉 No absent students today!</p>'; }
        }

        async function exportAttendanceDay() {
            const classId = document.getElementById('att-class')?.value;
            const date = document.getElementById('att-date')?.value;
            if (!classId || !date) { showToast('Load attendance first', 'warning'); return; }
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active');
            const rows = students.map(s => ({ 'Date': date, 'Class': cls?.name || '—', 'Student': s.first_name + ' ' + s.last_name, 'Status': document.getElementById('att-status-' + s.id)?.value || '—', 'Notes': document.getElementById('att-note-' + s.id)?.value || '' }));
            exportToExcel(rows, 'Attendance_' + (cls?.name || 'Class') + '_' + date);
            showToast('✅ Attendance exported', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK H — ATTENDANCE REPORTS
        // ════════════════════════════════════════════════════════════════════

        function toggleAttReportFields() {
            const type = document.getElementById('att-rtype')?.value;
            const fgClass = document.getElementById('fg-class'); const fgStudent = document.getElementById('fg-student'); const fgTerm = document.getElementById('fg-term');
            if (fgClass) fgClass.style.display = ['daily', 'class', 'term'].includes(type) ? '' : 'none';
            if (fgStudent) fgStudent.style.display = type === 'student' ? '' : 'none';
            if (fgTerm) fgTerm.style.display = type === 'term' ? '' : 'none';
        }

        async function generateAttReport() {
            const type = document.getElementById('att-rtype')?.value || 'daily';
            const classId = document.getElementById('att-rclass')?.value;
            const termId = document.getElementById('att-rterm')?.value;
            const studentId = document.getElementById('att-rstudent')?.value;
            const dateFrom = document.getElementById('att-rfrom')?.value;
            const dateTo = document.getElementById('att-rto')?.value;
            const container = document.getElementById('att-report-container'); if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Generating…</p></div>';
            let query = 'attendance?limit=5000&order=date.desc';
            if (classId) query += '&class_id=eq.' + classId;
            if (studentId) query += '&student_id=eq.' + studentId;
            if (dateFrom) query += '&date=gte.' + dateFrom;
            if (dateTo) query += '&date=lte.' + dateTo;
            if (termId) { const term = state.terms.find(t => String(t.id) === termId); if (term?.start_date) query += '&date=gte.' + term.start_date; if (term?.end_date) query += '&date=lte.' + term.end_date; }
            let records = [];
            try { const r = await apiRequest(query); records = r.success ? r.data : []; } catch (e) { }
            if (!records.length) { container.innerHTML = '<div class="alert alert-info">No attendance records found.</div>'; return; }
            const byStudent = {};
            records.forEach(rec => { if (!byStudent[rec.student_id]) byStudent[rec.student_id] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }; const s = byStudent[rec.student_id]; s.total++; s[rec.status] = (s[rec.status] || 0) + 1; });
            const rows = Object.entries(byStudent).map(([sid, counts]) => {
                const student = state.students.find(s => String(s.id) === String(sid));
                const cls = state.classes.find(c => c.id === student?.class_id);
                const attPct = counts.total > 0 ? ((counts.present + (counts.late || 0)) / counts.total * 100).toFixed(1) : '0.0';
                return `<tr><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td><td>${esc(cls?.name || '—')}</td>
                    <td style="text-align:center">${counts.total}</td><td style="text-align:center;color:var(--success)">${counts.present || 0}</td>
                    <td style="text-align:center;color:var(--danger)">${counts.absent || 0}</td><td style="text-align:center;color:var(--warning)">${counts.late || 0}</td>
                    <td style="text-align:center">${counts.excused || 0}</td>
                    <td><span class="badge ${parseFloat(attPct) >= 80 ? 'badge-success' : parseFloat(attPct) >= 60 ? 'badge-warning' : 'badge-danger'}">${attPct}%</span></td></tr>`;
            }).join('');
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Days</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            window._attReportData = { records, byStudent };
        }

        function printAttendanceReport() {
            const container = document.getElementById('att-report-container');
            if (!container?.querySelector('table')) { showToast('Generate a report first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Attendance Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#1a3a5c;color:#fff}</style></head><body><h2>📊 Attendance Report — ${new Date().toLocaleDateString()}</h2>${container.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        async function exportAttReport() {
            if (!window._attReportData) await generateAttReport();
            const { records } = window._attReportData || {};
            if (!records?.length) { showToast('Generate a report first', 'warning'); return; }
            const rows = records.map(rec => {
                const student = state.students.find(s => s.id === rec.student_id);
                const cls = state.classes.find(c => c.id === rec.class_id);
                return { 'Date': rec.date, 'Class': cls?.name || '—', 'Student': student ? student.first_name + ' ' + student.last_name : '—', 'Status': rec.status, 'Notes': rec.notes || '' };
            });
            exportToExcel(rows, 'Attendance_Report_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Report exported', 'success');
        }

        async function downloadAttReportPDF() {
            const container = document.getElementById('att-report-container');
            if (!container?.querySelector('table')) { showToast('Generate a report first', 'warning'); return; }
            if (typeof html2pdf === 'undefined') { showToast('PDF library not loaded', 'error'); return; }
            const el = document.createElement('div');
            el.innerHTML = `<h2 style="font-family:Arial">Attendance Report — ${new Date().toLocaleDateString()}</h2>` + container.innerHTML;
            el.style.padding = '20px'; document.body.appendChild(el);
            await html2pdf().set({ margin: 10, filename: 'Attendance_Report_' + new Date().toISOString().split('T')[0] + '.pdf', html2canvas: { scale: 2 }, jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' } }).from(el).save();
            document.body.removeChild(el);
            showToast('✅ PDF downloaded', 'success');
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK I — STUDENT LIST
        // ════════════════════════════════════════════════════════════════════

        function filterStudentList() {
            const classId = document.getElementById('sf-class')?.value;
            const status = document.getElementById('sf-status')?.value;
            const search = (document.getElementById('sf-search')?.value || '').toLowerCase();
            let students = state.students || [];
            if (classId) students = students.filter(s => String(s.class_id) === classId);
            if (status) students = students.filter(s => s.status === status);
            if (search) students = students.filter(s => (s.first_name || '').toLowerCase().includes(search) || (s.last_name || '').toLowerCase().includes(search) || (s.student_code || '').toLowerCase().includes(search));
            const countEl = document.getElementById('sf-count'); if (countEl) countEl.textContent = students.length + ' student(s)';
            renderStudentTable(students);
        }

        function renderStudentTable(students) {
            const tbody = document.getElementById('students-tbody'); if (!tbody) return;
            const canEdit = isAdmin() || isAccountant(); const canDelete = isAdmin(); const canPayment = isAdmin() || isAccountant();
            if (!students.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No students found.</td></tr>'; return; }
            tbody.innerHTML = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id);
                return `<tr>
                    <td><code>${esc(s.student_code || '—')}</code></td>
                    <td><a href="#" onclick="navigateToWithData('student-details',{student_id:${s.id}});return false" style="font-weight:600;color:var(--primary)">${esc((s.first_name + ' ' + s.last_name).trim())}</a></td>
                    <td>${esc(cls?.name || '—')}</td><td>${esc(s.gender || '—')}</td><td>${esc(s.guardian_name || '—')}</td>
                    <td><span class="badge ${s.status === 'Active' ? 'badge-success' : s.status === 'Transferred' ? 'badge-warning' : 'badge-neutral'}">${esc(s.status || 'Active')}</span></td>
                    <td><div class="btn-group" style="gap:4px">
                        <button class="btn btn-sm btn-outline" onclick="navigateToWithData('student-details',{student_id:${s.id}})" title="View">👁️</button>
                        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="window.openEditStudentModal(${s.id})" title="Edit">✏️</button>` : ''}
                        ${canPayment ? `<button class="btn btn-sm btn-outline" onclick="navigateToWithData('record-payment',{student_id:${s.id}})" title="Pay">💰</button>` : ''}
                        ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="window.deleteStudentPrompt(${s.id})" title="Delete">🗑️</button>` : ''}
                    </div></td></tr>`;
            }).join('');
        }

        function exportStudentsData() {
            const classId = document.getElementById('sf-class')?.value;
            const status = document.getElementById('sf-status')?.value;
            const search = (document.getElementById('sf-search')?.value || '').toLowerCase();
            let students = state.students || [];
            if (classId) students = students.filter(s => String(s.class_id) === classId);
            if (status) students = students.filter(s => s.status === status);
            if (search) students = students.filter(s => (s.first_name || '').toLowerCase().includes(search) || (s.last_name || '').toLowerCase().includes(search));
            const rows = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id);
                return { 'Code': s.student_code || '', 'First Name': s.first_name || '', 'Last Name': s.last_name || '', 'Class': cls?.name || '', 'Gender': s.gender || '', 'DOB': fmtDate(s.date_of_birth), 'Guardian': s.guardian_name || '', 'Guardian Phone': s.guardian_phone || '', 'Status': s.status || 'Active', 'Enrolled': fmtDate(s.created_at) };
            });
            exportToExcel(rows, 'Students_' + new Date().toISOString().split('T')[0]);
            showToast('✅ ' + rows.length + ' students exported', 'success');
        }

        function viewStudentDetail(studentId) { navigateToWithData('student-details', { student_id: studentId }); }

        function openEditStudentModal(studentId) {
            const s = state.students.find(x => x.id === studentId); if (!s) { showToast('Student not found', 'error'); return; }
            const classes = (state.classes || []).filter(c => c.is_active !== false);
            showModal(`<div class="modal-overlay" id="edit-student-modal"><div class="modal">
                <div class="modal-header"><h3>✏️ Edit Student — ${esc(s.first_name + ' ' + s.last_name)}</h3>
                <button class="modal-close" onclick="closeModal('edit-student-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>First Name *</label><input id="es-first" class="form-control" value="${esc(s.first_name || '')}"></div>
                    <div class="form-group"><label>Last Name *</label><input id="es-last" class="form-control" value="${esc(s.last_name || '')}"></div>
                    <div class="form-group"><label>Class *</label><select id="es-class" class="form-control">${classes.map(c => `<option value="${c.id}"${c.id === s.class_id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Gender</label><select id="es-gender" class="form-control"><option${s.gender === 'Male' ? ' selected' : ''}>Male</option><option${s.gender === 'Female' ? ' selected' : ''}>Female</option></select></div>
                    <div class="form-group"><label>Date of Birth</label><input type="date" id="es-dob" class="form-control" value="${s.date_of_birth || ''}"></div>
                    <div class="form-group"><label>Status</label><select id="es-status" class="form-control">${['Active', 'Inactive', 'Transferred', 'Graduated'].map(st => `<option${s.status === st ? ' selected' : ''}>${st}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Guardian Name</label><input id="es-guardian" class="form-control" value="${esc(s.guardian_name || '')}"></div>
                    <div class="form-group"><label>Guardian Phone</label><input id="es-phone" class="form-control" value="${esc(s.guardian_phone || '')}"></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-student-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="window.submitEditStudent(${studentId})">💾 Save Changes</button></div>
            </div></div>`);
        }

        async function submitEditStudent(studentId) {
            const first = document.getElementById('es-first')?.value.trim();
            const last = document.getElementById('es-last')?.value.trim();
            const classId = parseInt(document.getElementById('es-class')?.value);
            if (!first || !last || !classId) { showToast('First name, last name, and class are required', 'warning'); return; }
            const payload = {
                first_name: first, last_name: last, class_id: classId,
                gender: document.getElementById('es-gender')?.value,
                date_of_birth: document.getElementById('es-dob')?.value || null,
                status: document.getElementById('es-status')?.value,
                guardian_name: document.getElementById('es-guardian')?.value.trim(),
                guardian_phone: document.getElementById('es-phone')?.value.trim(),
                updated_at: new Date().toISOString()
            };
            const r = await apiRequest('students?id=eq.' + studentId, 'PATCH', payload);
            if (r.success) {
                const idx = state.students.findIndex(s => s.id === studentId);
                if (idx !== -1) state.students[idx] = { ...state.students[idx], ...payload };
                closeModal('edit-student-modal');
                await logActivity(state.currentUser?.id, state.currentUser?.role, 'Updated student: ' + first + ' ' + last, 'students', studentId);
                showToast('✅ Student updated', 'success'); filterStudentList();
            } else showToast('Failed: ' + r.error, 'error');
        }

        async function deleteStudentPrompt(studentId) {
            const s = state.students.find(x => x.id === studentId); if (!s) return;
            if (!await confirmDialog(`Archive student ${s.first_name} ${s.last_name}? They can be restored later.`)) return;
            const r = await apiRequest('students?id=eq.' + studentId, 'PATCH', { is_deleted: true, status: 'Inactive', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            if (r.success) {
                state.students = state.students.filter(x => x.id !== studentId);
                await logActivity(state.currentUser?.id, state.currentUser?.role, 'Archived student: ' + s.first_name + ' ' + s.last_name, 'students', studentId);
                showToast('✅ Student archived', 'success'); filterStudentList();
            } else showToast('Failed: ' + r.error, 'error');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK J — STUDENT ARCHIVE
        // ════════════════════════════════════════════════════════════════════

        async function restoreStudent(studentId) {
            if (!await confirmDialog('Restore this student to Active?')) return;
            const r = await apiRequest('students?id=eq.' + studentId, 'PATCH', { is_deleted: false, status: 'Active', updated_at: new Date().toISOString() });
            if (r.success) { showToast('✅ Student restored', 'success'); await refreshTable('students'); navigateTo('student-archive'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function permanentlyDeleteStudent(studentId) {
            if (!await confirmDialog('⚠️ PERMANENTLY DELETE this student? All records will be lost. CANNOT be undone.')) return;
            if (!await confirmDialog('Final confirmation — permanently delete?')) return;
            const r = await apiRequest('students?id=eq.' + studentId, 'DELETE');
            if (r.success) {
                state.students = state.students.filter(s => s.id !== studentId);
                showToast('✅ Student permanently deleted', 'success');
                await logActivity(state.currentUser?.id, state.currentUser?.role, 'Permanently deleted student ID ' + studentId, 'students', studentId);
                navigateTo('student-archive');
            } else showToast('Failed: ' + r.error, 'error');
        }

        async function runAutoArchive() {
            await ensureStateLoaded();
            const days = parseInt(state.schoolSettings.auto_archive_days) || 365;
            const cutoff = new Date(Date.now() - days * 86400000).toISOString();
            const toArc = (state.students || []).filter(s => s.status !== 'Active' && !s.is_deleted && s.updated_at && s.updated_at < cutoff);
            if (!toArc.length) { showToast('No students eligible for auto-archive (' + days + ' days threshold)', 'info'); return; }
            if (!await confirmDialog(`Auto-archive ${toArc.length} inactive students (inactive > ${days} days)?`)) return;
            let done = 0;
            for (const s of toArc) { const r = await apiRequest('students?id=eq.' + s.id, 'PATCH', { is_deleted: true, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }); if (r.success) done++; }
            await refreshTable('students'); showToast('✅ Auto-archived ' + done + ' students', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK K — BULK IMPORT
        // ════════════════════════════════════════════════════════════════════

        async function previewBulkImport() {
            const fileInput = document.getElementById('bulk-import-file'); if (!fileInput?.files[0]) { showToast('Select a file first', 'warning'); return; }
            const preview = document.getElementById('bulk-import-preview'); if (!preview) return;
            try {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => { const wb = XLSX.read(e.target.result, { type: 'binary' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); };
                    reader.onerror = reject; reader.readAsBinaryString(fileInput.files[0]);
                });
                window._bulkImportData = data;
                preview.innerHTML = `<div class="alert alert-info">📋 ${data.length} students ready to import.</div>
                    <table class="data-table"><thead><tr><th>Last Name</th><th>First Name</th><th>Class</th><th>Gender</th><th>Guardian</th></tr></thead>
                    <tbody>${data.slice(0, 10).map(r => `<tr><td>${esc(r.last_name || r['Last Name'] || '')}</td><td>${esc(r.first_name || r['First Name'] || '')}</td><td>${esc(r.class_name || r['Class'] || '')}</td><td>${esc(r.gender || r['Gender'] || '')}</td><td>${esc(r.guardian_name || r['Guardian Name'] || '')}</td></tr>`).join('')}
                    ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">…and ${data.length - 10} more rows</td></tr>` : ''}</tbody></table>
                    <button class="btn btn-primary" style="margin-top:12px" onclick="window.executeBulkImport()">▶️ Import ${data.length} Students</button>`;
            } catch (e) { preview.innerHTML = '<div class="alert alert-danger">❌ Failed: ' + e.message + '</div>'; }
        }

        async function executeBulkImport() {
            const data = window._bulkImportData; if (!data?.length) { showToast('No data to import', 'warning'); return; }
            await ensureStateLoaded(); showToast('⏳ Importing ' + data.length + ' students…', 'info', 5000);
            let ok = 0, fail = 0, dupes = 0;
            for (const row of data) {
                const firstName = (row.first_name || row['First Name'] || '').trim();
                const lastName = (row.last_name || row['Last Name'] || '').trim();
                const className = (row.class_name || row['Class'] || '').trim();
                if (!firstName || !lastName) { fail++; continue; }
                const cls = state.classes.find(c => (c.name || '').toLowerCase() === className.toLowerCase());
                const dupe = state.students.find(s => (s.first_name || '').toLowerCase() === firstName.toLowerCase() && (s.last_name || '').toLowerCase() === lastName.toLowerCase());
                if (dupe) { dupes++; continue; }
                const studentCode = 'ELF-' + String(state.students.length + ok + 1).padStart(4, '0');
                const r = await apiRequest('students', 'POST', { first_name: firstName, last_name: lastName, student_code: studentCode, class_id: cls?.id || null, gender: row.gender || row['Gender'] || null, date_of_birth: row.date_of_birth || row['DOB'] || null, guardian_name: row.guardian_name || row['Guardian Name'] || null, guardian_phone: row.guardian_phone || row['Guardian Phone'] || null, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
                if (r.success) ok++; else fail++;
            }
            await refreshTable('students');
            showToast(`✅ Import: ${ok} added, ${dupes} duplicates skipped, ${fail} errors`, ok > 0 ? 'success' : 'warning');
            window._bulkImportData = null;
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK L — BULK EXPORT
        // ════════════════════════════════════════════════════════════════════

        function updateBulkExportOptions() {
            const type = document.getElementById('be-type')?.value;
            const classGp = document.getElementById('be-class-group'); const termGp = document.getElementById('be-term-group');
            if (classGp) classGp.style.display = ['students', 'marks', 'attendance'].includes(type) ? '' : 'none';
            if (termGp) termGp.style.display = ['marks', 'attendance', 'payments'].includes(type) ? '' : 'none';
        }

        async function executeBulkExport() {
            await ensureStateLoaded();
            const type = document.getElementById('be-type')?.value || 'students';
            const classId = document.getElementById('be-class')?.value;
            const termId = document.getElementById('be-term')?.value;
            let rows = [], filename = 'Export';
            if (type === 'students') {
                let students = state.students || []; if (classId) students = students.filter(s => String(s.class_id) === classId);
                rows = students.map(s => { const cls = state.classes.find(c => c.id === s.class_id); return { 'Code': s.student_code, 'First Name': s.first_name, 'Last Name': s.last_name, 'Class': cls?.name || '', 'Gender': s.gender, 'Status': s.status, 'Guardian': s.guardian_name, 'Phone': s.guardian_phone }; });
                filename = 'Students_Export';
            } else if (type === 'marks') {
                let assessments = state.assessments || []; if (classId) assessments = assessments.filter(a => String(a.class_id) === classId); if (termId) assessments = assessments.filter(a => String(a.term_id) === termId);
                const aIds = new Set(assessments.map(a => a.id));
                const marks = (state.marks || []).filter(m => aIds.has(m.assessment_id));
                rows = marks.map(m => { const a = assessments.find(x => x.id === m.assessment_id); const s = state.students.find(x => x.id === m.student_id); const subj = state.subjects.find(x => x.id === a?.subject_id); return { 'Student': s ? s.first_name + ' ' + s.last_name : '—', 'Assessment': a?.title || '—', 'Subject': subj?.name || '—', 'Score': m.score, 'Max': a?.max_marks, 'Absent': m.is_absent ? 'Yes' : 'No' }; });
                filename = 'Marks_Export';
            } else if (type === 'payments') {
                let payments = state.payments || []; if (termId) payments = payments.filter(p => String(p.term_id) === termId);
                rows = payments.map(p => { const s = state.students.find(x => x.id === p.student_id); return { 'Receipt': p.receipt_number, 'Date': fmtDate(p.payment_date), 'Student': s ? s.first_name + ' ' + s.last_name : '—', 'Amount': p.amount, 'Method': p.payment_method, 'Notes': p.notes || '' }; });
                filename = 'Payments_Export';
            } else if (type === 'attendance') {
                let query = 'attendance?limit=10000&order=date.desc'; if (classId) query += '&class_id=eq.' + classId;
                if (termId) { const t = state.terms.find(x => String(x.id) === termId); if (t?.start_date) query += '&date=gte.' + t.start_date; if (t?.end_date) query += '&date=lte.' + t.end_date; }
                let records = []; try { const r = await apiRequest(query); records = r.success ? r.data : []; } catch (e) { }
                rows = records.map(rec => { const s = state.students.find(x => x.id === rec.student_id); return { 'Date': rec.date, 'Student': s ? s.first_name + ' ' + s.last_name : '—', 'Class': (state.classes.find(c => c.id === rec.class_id))?.name || '—', 'Status': rec.status, 'Notes': rec.notes || '' }; });
                filename = 'Attendance_Export';
            }
            if (!rows.length) { showToast('No data to export', 'warning'); return; }
            exportToExcel(rows, filename + '_' + new Date().toISOString().split('T')[0]);
            showToast('✅ ' + rows.length + ' rows exported', 'success');
        }

        function resetBulkExportFilters() {
            ['be-type', 'be-class', 'be-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            updateBulkExportOptions(); showToast('Filters reset', 'info', 1500);
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK M — BULK FINANCE ACTIONS
        // ════════════════════════════════════════════════════════════════════

        function showBulkTab(tab, event) {
            ['payments', 'fees', 'adjustments', 'waivers'].forEach(t => { const p = document.getElementById('bfa-tab-' + t); if (p) p.style.display = t === tab ? '' : 'none'; });
            document.querySelectorAll('.bfa-tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }

        async function loadBulkPayStudents() {
            const classId = document.getElementById('bfp-class')?.value;
            const container = document.getElementById('bulk-pay-students'); if (!container) return;
            if (!classId) { container.innerHTML = '<p style="color:var(--text-muted)">Select a class first.</p>'; return; }
            await ensureStateLoaded();
            const students = (state.students || []).filter(s => s.class_id === parseInt(classId) && s.status === 'Active').sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
            if (!students.length) { container.innerHTML = '<div class="alert alert-warning">No active students in this class.</div>'; return; }
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr>
                <th><input type="checkbox" onclick="window.selectAllBulkPay(this.checked)" title="Select All"></th>
                <th>Student</th><th>Balance (RWF)</th><th>Amount to Pay</th></tr></thead>
                <tbody>${students.map(s => {
                const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { balance: 0 };
                return `<tr><td><input type="checkbox" class="bulk-pay-check" data-student-id="${s.id}"></td>
                        <td>${esc(s.first_name + ' ' + s.last_name)}</td>
                        <td style="text-align:right;color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(bal.balance || 0)}</td>
                        <td><input type="number" id="bpa-${s.id}" value="${bal.balance > 0 ? bal.balance : 0}" min="0" style="width:120px" class="form-control"></td></tr>`;
            }).join('')}
                </tbody></table></div>`;
        }

        function selectAllBulkPay(checked) { document.querySelectorAll('.bulk-pay-check').forEach(cb => { cb.checked = checked; }); }

        function downloadBulkPaymentTemplate() {
            exportToExcel([{ student_code: 'ELF-0001', amount: 150000, payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0], notes: '' }], 'Bulk_Payment_Template');
            showToast('✅ Template downloaded', 'success');
        }

        async function importBulkPaymentExcel() {
            const fileInput = document.getElementById('bulk-pay-file'); if (!fileInput?.files[0]) { showToast('Select a file first', 'warning'); return; }
            try {
                const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => { const wb = XLSX.read(e.target.result, { type: 'binary' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); }; reader.onerror = reject; reader.readAsBinaryString(fileInput.files[0]); });
                window._bulkPayImportData = data; showToast('📋 ' + data.length + ' rows loaded — click Process to apply', 'info', 4000);
            } catch (e) { showToast('Failed to read file: ' + e.message, 'error'); }
        }

        async function processBulkPayments() {
            const checks = document.querySelectorAll('.bulk-pay-check:checked');
            const method = document.getElementById('bfp-method')?.value || 'Cash';
            const date = document.getElementById('bfp-date')?.value || new Date().toISOString().split('T')[0];
            if (!checks.length) { showToast('Select at least one student', 'warning'); return; }
            if (!await confirmDialog(`Process payments for ${checks.length} students?`)) return;
            showToast('⏳ Processing…', 'info', 3000);
            let ok = 0; let receiptNum = (state.payments?.length || 0) + 1;
            for (const cb of checks) {
                const studentId = parseInt(cb.dataset.studentId);
                const amount = parseFloat(document.getElementById('bpa-' + studentId)?.value || 0);
                if (!amount || amount <= 0) continue;
                const receipt = 'RCP-' + String(receiptNum++).padStart(4, '0');
                const r = await apiRequest('payments', 'POST', { student_id: studentId, amount, payment_method: method, payment_date: date, receipt_number: receipt, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, recorded_by: state.currentUser?.username || '', notes: 'Bulk payment', created_at: new Date().toISOString() });
                if (r.success) ok++;
            }
            await refreshTable('payments'); showToast(`✅ ${ok} payments recorded`, 'success');
        }

        async function applyBulkFeeToClass() {
            await ensureStateLoaded();
            const classId = document.getElementById('bff-class')?.value; const categoryId = document.getElementById('bff-category')?.value; const amount = parseFloat(document.getElementById('bff-amount')?.value || 0);
            if (!classId || !categoryId || !amount) { showToast('Class, fee category, and amount required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!students.length) { showToast('No active students in this class', 'warning'); return; }
            if (!await confirmDialog(`Apply ${fmtCurrency(amount)} fee to ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) { const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: parseInt(categoryId), term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount, paid_amount: 0, is_paid: false, is_waived: false, due_date: state.currentTerm?.end_date || null, created_at: new Date().toISOString() }); if (r.success) ok++; }
            await refreshTable('student_fees'); showToast('✅ Fee applied to ' + ok + ' students', 'success');
        }

        function previewBulkFee() {
            const classId = document.getElementById('bff-class')?.value; const categoryId = document.getElementById('bff-category')?.value; const amount = parseFloat(document.getElementById('bff-amount')?.value || 0);
            const cls = state.classes.find(c => String(c.id) === String(classId)); const cat = state.feeCategories.find(f => String(f.id) === String(categoryId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: ${fmtCurrency(amount)} × ${count} students in ${cls?.name || '—'} (${cat?.name || '—'}) = ${fmtCurrency(amount * count)} total`, 'info', 5000);
        }

        function previewBulkAdjustment() {
            const classId = document.getElementById('badj-class')?.value; const amount = parseFloat(document.getElementById('badj-amount')?.value || 0); const type = document.getElementById('badj-type')?.value || 'credit';
            const cls = state.classes.find(c => String(c.id) === String(classId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: ${type} of ${fmtCurrency(amount)} for ${count} students in ${cls?.name || '—'}`, 'info', 4000);
        }

        async function executeBulkAdjustment() {
            const classId = document.getElementById('badj-class')?.value; const amount = parseFloat(document.getElementById('badj-amount')?.value || 0); const type = document.getElementById('badj-type')?.value || 'credit'; const reason = document.getElementById('badj-reason')?.value?.trim() || 'Bulk adjustment';
            if (!classId || !amount) { showToast('Class and amount required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!students.length) { showToast('No students found', 'warning'); return; }
            if (!await confirmDialog(`Apply ${type} of ${fmtCurrency(amount)} to ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) { const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: null, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount: type === 'credit' ? -amount : amount, paid_amount: 0, is_paid: false, is_waived: false, notes: reason, created_at: new Date().toISOString() }); if (r.success) ok++; }
            await refreshTable('student_fees'); showToast('✅ Adjustment applied to ' + ok + ' students', 'success');
        }

        function previewBulkWaiver() {
            const classId = document.getElementById('bwv-class')?.value; const categoryId = document.getElementById('bwv-category')?.value;
            const cls = state.classes.find(c => String(c.id) === String(classId)); const cat = state.feeCategories.find(f => String(f.id) === String(categoryId));
            const count = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active').length;
            showToast(`Preview: waive "${cat?.name || 'selected fee'}" for ${count} students in ${cls?.name || '—'}`, 'info', 4000);
        }

        async function applyBulkWaiver() {
            const classId = document.getElementById('bwv-class')?.value; const categoryId = document.getElementById('bwv-category')?.value; const reason = document.getElementById('bwv-reason')?.value?.trim() || 'Bulk waiver';
            if (!classId || !categoryId) { showToast('Class and fee category required', 'warning'); return; }
            const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
            if (!await confirmDialog(`Waive fee for ${students.length} students?`)) return;
            let ok = 0;
            for (const s of students) {
                const fees = (state.studentFees || []).filter(f => f.student_id === s.id && String(f.fee_category_id) === String(categoryId) && !f.is_waived);
                for (const fee of fees) { const r = await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, notes: reason, updated_at: new Date().toISOString() }); if (r.success) ok++; }
            }
            await refreshTable('student_fees'); showToast('✅ Waived ' + ok + ' fee record(s)', 'success');
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK N — STUDENT FEES & PAYMENT HISTORY
        // ════════════════════════════════════════════════════════════════════

        async function renderStudentFeesTable() {
            await ensureStateLoaded();
            const classId = document.getElementById('sft-class')?.value; const categoryId = document.getElementById('sft-category')?.value; const statusVal = document.getElementById('sft-status')?.value;
            const container = document.getElementById('student-fees-tbody') || document.getElementById('sft-container'); if (!container) return;
            let students = (state.students || []).filter(s => s.status === 'Active'); if (classId) students = students.filter(s => String(s.class_id) === classId);
            const rows = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id);
                const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { total: 0, paid: 0, balance: 0 };
                if (statusVal === 'paid' && bal.balance > 0) return ''; if (statusVal === 'unpaid' && bal.balance <= 0) return ''; if (statusVal === 'partial' && (bal.paid === 0 || bal.balance <= 0)) return '';
                return `<tr><td><a href="#" onclick="navigateToWithData('student-fees',{fee_student_id:${s.id}});return false" style="font-weight:600">${esc((s.first_name + ' ' + s.last_name).trim())}</a></td>
                    <td>${esc(cls?.name || '—')}</td><td style="text-align:right">${fmtCurrency(bal.total || 0)}</td><td style="text-align:right">${fmtCurrency(bal.paid || 0)}</td>
                    <td style="text-align:right;color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${fmtCurrency(bal.balance || 0)}</td>
                    <td><span class="badge ${bal.balance <= 0 ? 'badge-success' : bal.paid > 0 ? 'badge-warning' : 'badge-danger'}">${bal.balance <= 0 ? '✅ Paid' : bal.paid > 0 ? '⚡ Partial' : '⏳ Unpaid'}</span></td>
                    <td><button class="btn btn-sm btn-outline" onclick="navigateToWithData('record-payment',{student_id:${s.id}})">💰 Pay</button></td></tr>`;
            }).filter(Boolean).join('');
            container.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No records found.</td></tr>';
        }

        async function exportStudentFeeBalances() {
            await ensureStateLoaded();
            const classId = document.getElementById('sft-class')?.value;
            let students = (state.students || []).filter(s => s.status === 'Active'); if (classId) students = students.filter(s => String(s.class_id) === classId);
            const rows = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id); const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { total: 0, paid: 0, balance: 0 };
                return { 'Student': s.first_name + ' ' + s.last_name, 'Class': cls?.name || '', 'Total Fees': bal.total || 0, 'Paid (RWF)': bal.paid || 0, 'Balance (RWF)': bal.balance || 0, 'Status': bal.balance <= 0 ? 'Paid' : bal.paid > 0 ? 'Partial' : 'Unpaid' };
            });
            exportToExcel(rows, 'Student_Fee_Balances_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Fee balances exported', 'success');
        }

        function printFeeReport() {
            const container = document.getElementById('sft-container') || document.getElementById('student-fees-tbody');
            const table = container?.closest('table') || container?.querySelector('table');
            if (!table) { showToast('No data to print', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Fee Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#1a3a5c;color:#fff}</style></head><body><h2>💰 Fee Report — ${new Date().toLocaleDateString()}</h2>${table.outerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        function openStudentFeeDetails(studentId) { navigateToWithData('student-fees', { fee_student_id: studentId }); }

        function filterPaymentHistoryTable() {
            const classId = document.getElementById('ph-class')?.value; const termId = document.getElementById('ph-term')?.value; const method = document.getElementById('ph-method')?.value;
            const dateFrom = document.getElementById('ph-from')?.value; const dateTo = document.getElementById('ph-to')?.value; const search = (document.getElementById('ph-search')?.value || '').toLowerCase();
            let payments = state.payments || [];
            if (termId) payments = payments.filter(p => String(p.term_id) === termId);
            if (method) payments = payments.filter(p => p.payment_method === method);
            if (dateFrom) payments = payments.filter(p => (p.payment_date || '') >= dateFrom);
            if (dateTo) payments = payments.filter(p => (p.payment_date || '') <= dateTo);
            if (classId) { const sids = new Set((state.students || []).filter(s => String(s.class_id) === classId).map(s => s.id)); payments = payments.filter(p => sids.has(p.student_id)); }
            if (search) payments = payments.filter(p => { const student = state.students.find(s => s.id === p.student_id); return (p.receipt_number || '').toLowerCase().includes(search) || (student ? (student.first_name + ' ' + student.last_name).toLowerCase().includes(search) : false); });
            const tbody = document.getElementById('ph-tbody'); if (!tbody) return;
            const countEl = document.getElementById('ph-count'); const totalEl = document.getElementById('ph-total');
            if (countEl) countEl.textContent = payments.length + ' transaction(s)';
            if (totalEl) totalEl.textContent = fmtCurrency(payments.reduce((s, p) => s + (p.amount || 0), 0));
            if (!payments.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No payments found.</td></tr>'; return; }
            tbody.innerHTML = payments.map(p => {
                const student = state.students.find(s => s.id === p.student_id); const cls = state.classes.find(c => c.id === student?.class_id);
                return `<tr><td><code>${esc(p.receipt_number || '—')}</code></td><td>${fmtDate(p.payment_date)}</td><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right;font-weight:600">${fmtCurrency(p.amount)}</td><td><span class="badge badge-info">${esc(p.payment_method || '—')}</span></td><td><button class="btn btn-sm btn-outline" onclick="window.printReceiptById&&window.printReceiptById(${p.id})">🧾</button></td></tr>`;
            }).join('');
        }

        async function exportFullPaymentHistory() {
            await ensureStateLoaded();
            const rows = (state.payments || []).map(p => {
                const student = state.students.find(s => s.id === p.student_id); const cls = state.classes.find(c => c.id === student?.class_id); const term = state.terms.find(t => t.id === p.term_id);
                return { 'Receipt': p.receipt_number, 'Date': fmtDate(p.payment_date), 'Student': student ? student.first_name + ' ' + student.last_name : '—', 'Class': cls?.name || '—', 'Term': term?.name || '—', 'Amount (RWF)': p.amount, 'Method': p.payment_method, 'Recorded By': p.recorded_by || '—', 'Notes': p.notes || '' };
            });
            exportToExcel(rows, 'Payment_History_' + new Date().toISOString().split('T')[0]);
            showToast('✅ ' + rows.length + ' payments exported', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK O — RECEIPTS
        // ════════════════════════════════════════════════════════════════════

        function filterReceipts() {
            const search = (document.getElementById('rec-search')?.value || '').toLowerCase();
            const dateFrom = document.getElementById('rec-from')?.value; const dateTo = document.getElementById('rec-to')?.value;
            const method = document.getElementById('receipt-method-filter')?.value;
            let payments = state.payments || [];
            if (dateFrom) payments = payments.filter(p => (p.payment_date || '') >= dateFrom);
            if (dateTo) payments = payments.filter(p => (p.payment_date || '') <= dateTo);
            if (method) payments = payments.filter(p => p.payment_method === method);
            if (search) payments = payments.filter(p => { const s = state.students.find(x => x.id === p.student_id); return (p.receipt_number || '').toLowerCase().includes(search) || (s ? (s.first_name + ' ' + s.last_name).toLowerCase().includes(search) : false); });
            const countEl = document.getElementById('receipt-count');
            if (countEl) countEl.textContent = `${payments.length} receipt${payments.length !== 1 ? 's' : ''}`;
            renderFullReceiptsList(payments);
        }

        /**
         * Initial render of the receipts list on the Receipt Printing page —
         * shows all payments (no filters applied yet).
         */
        function renderReceiptsList() {
            renderFullReceiptsList(state.payments || []);
            const countEl = document.getElementById('receipt-count');
            if (countEl) countEl.textContent = `${(state.payments || []).length} receipt${(state.payments || []).length !== 1 ? 's' : ''}`;
        }

        function renderFullReceiptsList(payments) {
            const container = document.getElementById('receipts-list-container'); if (!container) return;
            payments = payments || state.payments || []; payments = [...payments].sort((a, b) => new Date(b.payment_date || 0) - new Date(a.payment_date || 0));
            if (!payments.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No receipts found.</div>'; return; }
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Receipt #</th><th>Date</th><th>Student</th><th>Class</th><th>Amount (RWF)</th><th>Method</th><th>Actions</th></tr></thead>
                <tbody>${payments.map(p => {
                const student = state.students.find(s => s.id === p.student_id); const cls = state.classes.find(c => c.id === student?.class_id);
                return `<tr><td><code>${esc(p.receipt_number || '—')}</code></td><td>${fmtDate(p.payment_date)}</td><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right;font-weight:600">${fmtCurrency(p.amount)}</td><td><span class="badge badge-info">${esc(p.payment_method || '—')}</span></td><td><button class="btn btn-sm btn-outline" onclick="window.printReceiptById&&window.printReceiptById(${p.id})">🖨️ Print</button></td></tr>`;
            }).join('')}
                </tbody></table></div>`;
        }

        async function bulkPrintReceipts() {
            const rows = document.querySelectorAll('#receipts-list-container tbody tr');
            if (!rows.length) { showToast('No receipts to print', 'warning'); return; }
            if (!await confirmDialog('Print ' + rows.length + ' receipts? Multiple windows will open.')) return;
            let printed = 0;
            for (const row of rows) { const btn = row.querySelector('button'); if (btn) { const match = btn.getAttribute('onclick')?.match(/printReceiptById\((\d+)\)/); if (match && window.printReceiptById) { window.printReceiptById(parseInt(match[1])); printed++; await new Promise(r => setTimeout(r, 300)); } } }
            showToast('✅ Sent ' + printed + ' receipts to print', 'success');
        }

        function exportReceiptsList() {
            const rows = (state.payments || []).map(p => {
                const student = state.students.find(s => s.id === p.student_id); const cls = state.classes.find(c => c.id === student?.class_id);
                return { 'Receipt #': p.receipt_number, 'Date': fmtDate(p.payment_date), 'Student': student ? student.first_name + ' ' + student.last_name : '—', 'Class': cls?.name || '—', 'Amount': p.amount, 'Method': p.payment_method, 'Notes': p.notes || '' };
            });
            exportToExcel(rows, 'Receipts_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Receipts exported', 'success');
        }

        async function printReceipt(paymentId) {
            if (window.printReceiptById) return window.printReceiptById(paymentId);
            const p = (state.payments || []).find(x => x.id === paymentId); if (!p) { showToast('Receipt not found', 'error'); return; }
            const student = state.students.find(s => s.id === p.student_id); const cls = state.classes.find(c => c.id === student?.class_id); const settings = state.schoolSettings || {};
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${esc(p.receipt_number)}</title><style>body{font-family:Arial;padding:20px;max-width:400px;margin:0 auto}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:bold;text-align:center;margin:12px 0;padding:8px;background:#d1fae5;border-radius:8px}h2{text-align:center}@media print{button{display:none}}</style></head>
            <body><h2>${esc(settings.school_name || 'ECOLE LA FONTAINE')}</h2><p style="text-align:center;color:#666">${esc(settings.location || 'Rubavu, Rwanda')}</p><hr><h3 style="text-align:center">PAYMENT RECEIPT</h3>
            <div class="row"><span>Receipt #:</span><strong>${esc(p.receipt_number)}</strong></div>
            <div class="row"><span>Date:</span><span>${fmtDate(p.payment_date)}</span></div>
            <div class="row"><span>Student:</span><span>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</span></div>
            <div class="row"><span>Class:</span><span>${esc(cls?.name || '—')}</span></div>
            <div class="row"><span>Method:</span><span>${esc(p.payment_method || '—')}</span></div>
            ${p.notes ? `<div class="row"><span>Notes:</span><span>${esc(p.notes)}</span></div>` : ''}
            <div class="total">RWF ${fmtCurrency(p.amount)}</div>
            <p style="text-align:center;font-size:11px;color:#666">Thank you for your payment</p>
            <button onclick="window.print()">🖨️ Print</button>
            <script>window.print();setTimeout(window.close,800);<\/script></body></html>`);
            w.document.close();
        }

        async function saveReceiptSetting() {
            const size = document.getElementById('rec-paper-size')?.value || 'A5'; const logo = document.getElementById('rec-show-logo')?.checked ? '1' : '0'; const sig = document.getElementById('rec-show-sig')?.checked ? '1' : '0'; const foot = document.getElementById('rec-footer')?.value?.trim() || '';
            await Promise.all([updateSchoolSetting('receipt_paper_size', size), updateSchoolSetting('receipt_show_logo', logo), updateSchoolSetting('receipt_show_sig', sig), updateSchoolSetting('receipt_footer', foot)]);
            Object.assign(state.schoolSettings, { receipt_paper_size: size, receipt_show_logo: logo, receipt_show_sig: sig, receipt_footer: foot });
            showToast('✅ Receipt settings saved', 'success');
        }

        function previewReceiptSettings() {
            const settings = state.schoolSettings || {}; const size = document.getElementById('rec-paper-size')?.value || 'A5';
            showModal(`<div class="modal-overlay" id="rec-preview-modal"><div class="modal modal-sm"><div class="modal-header"><h3>👁️ Receipt Preview</h3><button class="modal-close" onclick="closeModal('rec-preview-modal')">✕</button></div>
                <div class="modal-body"><div style="border:1px solid #ccc;padding:16px;border-radius:8px;font-family:Arial;max-width:300px;margin:0 auto;font-size:12px">
                    <h3 style="text-align:center;margin:0">${esc(settings.school_name || 'ECOLE LA FONTAINE')}</h3>
                    <p style="text-align:center;color:#888;margin:4px 0">${esc(settings.location || 'Rubavu, Rwanda')}</p><hr>
                    <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Receipt #:</span><strong>RCP-0001</strong></div>
                    <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Student:</span><span>SAMPLE STUDENT</span></div>
                    <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Amount:</span><strong>RWF 150,000</strong></div>
                    <p style="text-align:center;font-size:10px;color:#888">Paper: ${size}</p>
                    ${document.getElementById('rec-footer')?.value ? `<p style="text-align:center;font-size:10px">${esc(document.getElementById('rec-footer').value)}</p>` : ''}
                </div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('rec-preview-modal')">Close</button></div></div></div>`);
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK P — PAYMENT REVERSALS
        // ════════════════════════════════════════════════════════════════════

        async function filterReversalPayments() {
            const search = (document.getElementById('rev-search')?.value || '').toLowerCase();
            const dateFrom = document.getElementById('rev-from')?.value; const dateTo = document.getElementById('rev-to')?.value;
            const container = document.getElementById('reversals-tbody'); if (!container) return;
            let reversals = [];
            try { const r = await apiRequest('payment_reversals?order=created_at.desc&limit=500'); reversals = r.success ? r.data : []; } catch (e) { }
            if (dateFrom) reversals = reversals.filter(r => (r.created_at || '') >= dateFrom);
            if (dateTo) reversals = reversals.filter(r => (r.created_at || '') <= dateTo);
            if (search) reversals = reversals.filter(r => { const s = state.students.find(x => x.id === r.student_id); return (r.original_receipt || '').toLowerCase().includes(search) || (s ? (s.first_name + ' ' + s.last_name).toLowerCase().includes(search) : false); });
            if (!reversals.length) { container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No reversals found.</td></tr>'; return; }
            container.innerHTML = reversals.map(rev => {
                const student = state.students.find(s => s.id === rev.student_id);
                return `<tr><td>${fmtDate(rev.created_at)}</td><td><code>${esc(rev.original_receipt || '—')}</code></td><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td><td style="text-align:right;color:var(--danger)">${fmtCurrency(rev.amount || 0)}</td><td>${esc(rev.reason || '—')}</td><td>${esc(rev.reversed_by || '—')}</td></tr>`;
            }).join('');
        }

        async function exportReversalHistory() {
            let reversals = [];
            try { const r = await apiRequest('payment_reversals?order=created_at.desc&limit=5000'); reversals = r.success ? r.data : []; } catch (e) { }
            const rows = reversals.map(rev => {
                const student = state.students.find(s => s.id === rev.student_id);
                return { 'Date': fmtDate(rev.created_at), 'Receipt': rev.original_receipt || '—', 'Student': student ? student.first_name + ' ' + student.last_name : '—', 'Amount': rev.amount || 0, 'Reason': rev.reason || '', 'By': rev.reversed_by || '' };
            });
            exportToExcel(rows, 'Payment_Reversals_' + new Date().toISOString().split('T')[0]);
            showToast('✅ Reversal history exported', 'success');
        }

        async function reversePayment(paymentId) {
            const p = (state.payments || []).find(x => x.id === paymentId); if (!p) { showToast('Payment not found', 'error'); return; }
            const reason = prompt('Reason for reversal:'); if (!reason) return;
            if (!await confirmDialog(`Reverse payment of ${fmtCurrency(p.amount)} (${p.receipt_number})? Cannot be undone.`)) return;
            const rr = await apiRequest('payment_reversals', 'POST', { student_id: p.student_id, payment_id: p.id, original_receipt: p.receipt_number, amount: p.amount, reason, reversed_by: state.currentUser?.username || state.currentUser?.name || '', created_at: new Date().toISOString() });
            if (!rr.success) { showToast('Failed to create reversal record: ' + rr.error, 'error'); return; }
            await apiRequest('payments?id=eq.' + paymentId, 'DELETE');
            await refreshTable('payments');
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Reversed payment ' + p.receipt_number + ' (' + fmtCurrency(p.amount) + ')', 'finance', paymentId);
            showToast('✅ Payment reversed — ' + p.receipt_number, 'success');
        }

        async function viewReversalDetails(reversalId) {
            let rev;
            try { const r = await apiRequest('payment_reversals?id=eq.' + reversalId); rev = r.success && r.data[0] ? r.data[0] : null; } catch (e) { }
            if (!rev) { showToast('Reversal not found', 'error'); return; }
            const student = state.students.find(s => s.id === rev.student_id);
            showModal(`<div class="modal-overlay" id="rev-detail-modal"><div class="modal modal-sm"><div class="modal-header"><h3>↩️ Reversal Details</h3><button class="modal-close" onclick="closeModal('rev-detail-modal')">✕</button></div>
                <div class="modal-body"><table class="data-table"><tbody>
                    <tr><td><strong>Date</strong></td><td>${fmtDateTime(rev.created_at)}</td></tr>
                    <tr><td><strong>Original Receipt</strong></td><td><code>${esc(rev.original_receipt || '—')}</code></td></tr>
                    <tr><td><strong>Student</strong></td><td>${esc(student ? student.first_name + ' ' + student.last_name : '—')}</td></tr>
                    <tr><td><strong>Amount</strong></td><td>${fmtCurrency(rev.amount || 0)}</td></tr>
                    <tr><td><strong>Reason</strong></td><td>${esc(rev.reason || '—')}</td></tr>
                    <tr><td><strong>Reversed By</strong></td><td>${esc(rev.reversed_by || '—')}</td></tr>
                </tbody></table></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('rev-detail-modal')">Close</button></div></div></div>`);
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK Q — OVERDUE PAYMENTS
        // ════════════════════════════════════════════════════════════════════

        function openRecordPaymentForStudent(studentId) { navigateToWithData('record-payment', { student_id: studentId }); }

        async function openBulkPaymentModal() {
            await ensureStateLoaded();
            const today = new Date().toISOString().split('T')[0];
            const overdue = (state.studentFees || []).filter(f => !f.is_paid && !f.is_waived && f.due_date && f.due_date < today);
            const studentIds = [...new Set(overdue.map(f => f.student_id))];
            showModal(`<div class="modal-overlay" id="bulk-overdue-modal"><div class="modal"><div class="modal-header"><h3>💸 Bulk Overdue Payment</h3><button class="modal-close" onclick="closeModal('bulk-overdue-modal')">✕</button></div>
                <div class="modal-body"><div class="alert alert-warning">${studentIds.length} students have overdue balances.</div>
                    <div class="form-group"><label>Payment Method</label><select id="bod-method" class="form-control">${['Cash', 'Mobile-Money', 'Bank Transfer', 'Cheque'].map(m => `<option>${m}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Date</label><input type="date" id="bod-date" value="${today}" class="form-control"></div>
                    <p style="color:var(--text-muted);font-size:13px">Each student pays their current balance.</p></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('bulk-overdue-modal')">Cancel</button><button class="btn btn-primary" onclick="window._processBulkOverdue()">💸 Process All</button></div></div></div>`);
            window._processBulkOverdue = async () => {
                const method = document.getElementById('bod-method')?.value; const date = document.getElementById('bod-date')?.value;
                closeModal('bulk-overdue-modal'); showToast('⏳ Processing ' + studentIds.length + ' payments…', 'info', 5000);
                let ok = 0; let num = (state.payments?.length || 0) + 1;
                for (const sid of studentIds) {
                    const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(sid) : { balance: 0 }; if (bal.balance <= 0) continue;
                    const r = await apiRequest('payments', 'POST', { student_id: sid, amount: bal.balance, payment_method: method, payment_date: date, receipt_number: 'RCP-' + String(num++).padStart(4, '0'), term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, recorded_by: state.currentUser?.username || '', notes: 'Bulk overdue payment', created_at: new Date().toISOString() });
                    if (r.success) ok++;
                }
                await refreshTable('payments'); showToast('✅ ' + ok + ' overdue payments processed', 'success');
            };
        }

        function exportBulkPaymentTemplate() {
            const today = new Date().toISOString().split('T')[0];
            const overdue = (state.studentFees || []).filter(f => !f.is_paid && !f.is_waived && f.due_date && f.due_date < today);
            const studentIds = [...new Set(overdue.map(f => f.student_id))];
            const rows = studentIds.map(sid => {
                const s = state.students.find(x => x.id === sid); const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(sid) : { balance: 0 };
                return { student_code: s?.student_code || '', student_name: s ? s.first_name + ' ' + s.last_name : '—', amount: bal.balance || 0, payment_method: 'Cash', payment_date: today, notes: '' };
            });
            exportToExcel(rows, 'Overdue_Payment_Template_' + today);
            showToast('✅ Template exported with ' + rows.length + ' overdue students', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK R — MANUAL ADJUSTMENTS
        // ════════════════════════════════════════════════════════════════════

        async function loadStudentBalanceInfo() {
            const studentId = document.getElementById('ma-student')?.value; const container = document.getElementById('ma-balance-info'); if (!container) return;
            if (!studentId) { container.innerHTML = ''; return; }
            await ensureStateLoaded();
            const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(parseInt(studentId)) : { total: 0, paid: 0, balance: 0 };
            container.innerHTML = `<div style="background:var(--bg-tertiary);padding:12px;border-radius:8px;font-size:13px"><div style="display:flex;gap:24px;flex-wrap:wrap">
                <div><strong>Total Fees:</strong> ${fmtCurrency(bal.total || 0)}</div><div><strong>Paid:</strong> ${fmtCurrency(bal.paid || 0)}</div>
                <div style="color:${(bal.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>Balance:</strong> ${fmtCurrency(bal.balance || 0)}</div></div></div>`;
        }

        function toggleAdjustmentFields() {
            const type = document.getElementById('ma-type')?.value; const catGp = document.getElementById('ma-category-group');
            if (catGp) catGp.style.display = type === 'waive' ? '' : 'none';
        }

        async function submitManualAdjustment() {
            const studentId = document.getElementById('ma-student')?.value; const type = document.getElementById('ma-type')?.value || 'credit';
            const amount = parseFloat(document.getElementById('ma-amount')?.value || 0); const reason = document.getElementById('ma-reason')?.value?.trim();
            if (!studentId) { showToast('Select a student', 'warning'); return; }
            if (!amount || amount <= 0) { showToast('Enter a valid amount', 'warning'); return; }
            if (!reason) { showToast('Reason is required', 'warning'); return; }
            const payload = { student_id: parseInt(studentId), fee_category_id: null, term_id: state.currentTerm?.id || null, academic_year_id: state.currentAcadYear?.id || null, amount: type === 'credit' ? -Math.abs(amount) : Math.abs(amount), paid_amount: 0, is_paid: false, is_waived: type === 'waive', notes: '[' + type.toUpperCase() + '] ' + reason, created_at: new Date().toISOString() };
            const r = await apiRequest('student_fees', 'POST', payload);
            if (r.success) {
                await refreshTable('student_fees');
                await logActivity(state.currentUser?.id, state.currentUser?.role, type + ' of ' + fmtCurrency(amount) + ' for student #' + studentId + ': ' + reason, 'finance');
                showToast('✅ Adjustment applied', 'success'); resetAdjustmentForm(); await loadStudentBalanceInfo(); await loadAdjustmentHistory();
            } else showToast('Failed: ' + r.error, 'error');
        }

        function resetAdjustmentForm() {
            ['ma-student', 'ma-type', 'ma-amount', 'ma-reason', 'ma-category'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value || '' : ''; });
            const info = document.getElementById('ma-balance-info'); if (info) info.innerHTML = '';
        }

        async function loadAdjustmentHistory() {
            const studentId = document.getElementById('ma-student')?.value; const container = document.getElementById('ma-history'); if (!container) return;
            if (!studentId) { container.innerHTML = ''; return; }
            const fees = (state.studentFees || []).filter(f => f.student_id === parseInt(studentId) && (f.notes || '').match(/^\[(CREDIT|DEBIT|WAIVE)\]/)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
            if (!fees.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No manual adjustments yet.</p>'; return; }
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Notes</th></tr></thead>
                <tbody>${fees.map(f => `<tr><td>${fmtDate(f.created_at)}</td><td><span class="badge ${f.amount < 0 ? 'badge-success' : f.is_waived ? 'badge-info' : 'badge-danger'}">${f.notes?.match(/^\[([A-Z]+)\]/)?.[1] || '—'}</span></td><td style="text-align:right">${fmtCurrency(Math.abs(f.amount || 0))}</td><td>${esc((f.notes || '').replace(/^\[[A-Z]+\] /, ''))}</td></tr>`).join('')}</tbody></table></div>`;
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK S — FEE STRUCTURE MANAGEMENT
        // ════════════════════════════════════════════════════════════════════

        async function refreshFeeAmounts() {
            const yearId = document.getElementById('fa-year')?.value; const classFilter = document.getElementById('fa-class-filter')?.value; const catFilter = document.getElementById('fa-category-filter')?.value;
            const container = document.getElementById('fee-amounts-container'); if (!container) return;
            container.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
            let feeAmounts = [];
            try { let q = 'fee_amounts?limit=1000'; if (yearId) q += '&academic_year_id=eq.' + yearId; const r = await apiRequest(q); feeAmounts = r.success ? r.data : []; } catch (e) { }
            if (classFilter) feeAmounts = feeAmounts.filter(f => String(f.class_id) === classFilter);
            if (catFilter) feeAmounts = feeAmounts.filter(f => String(f.fee_category_id) === catFilter);
            if (!feeAmounts.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No fee amounts configured.</div>'; return; }
            const rows = feeAmounts.map(fa => {
                const cls = state.classes.find(c => c.id === fa.class_id); const cat = state.feeCategories.find(f => f.id === fa.fee_category_id); const yr = state.academicYears.find(y => y.id === fa.academic_year_id);
                return `<tr><td>${esc(cat?.name || '—')}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right;font-weight:600">${fmtCurrency(fa.amount || 0)}</td><td>${esc(yr?.name || '—')}</td><td><button class="btn btn-sm btn-outline" onclick="window.openEditFeeAmount(${fa.id})">✏️</button></td></tr>`;
            }).join('');
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Category</th><th>Class</th><th>Amount (RWF)</th><th>Year</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }

        function openAddFeeCategory() {
            showModal(`<div class="modal-overlay" id="add-fee-cat-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Fee Category</h3><button class="modal-close" onclick="closeModal('add-fee-cat-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Name *</label><input id="nfc-name" class="form-control" placeholder="e.g. School Fees"></div>
                    <div class="form-group"><label>Description</label><input id="nfc-desc" class="form-control"></div>
                    <div class="form-group"><label>Type</label><select id="nfc-type" class="form-control">${['standard', 'transport', 'activity', 'one-time'].map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Reset Frequency</label><select id="nfc-freq" class="form-control">${['monthly', 'termly', 'annual', 'one-time'].map(f => `<option value="${f}">${f}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Default Amount (RWF)</label><input type="number" id="nfc-amount" class="form-control" placeholder="0" min="0"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-fee-cat-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewFeeCategory()">💾 Save</button></div></div></div>`);
            window._saveNewFeeCategory = async () => {
                const name = document.getElementById('nfc-name')?.value.trim(); if (!name) { showToast('Name is required', 'warning'); return; }
                const r = await apiRequest('fee_categories', 'POST', { name, description: document.getElementById('nfc-desc')?.value.trim(), fee_type: document.getElementById('nfc-type')?.value, reset_frequency: document.getElementById('nfc-freq')?.value, amount: parseFloat(document.getElementById('nfc-amount')?.value || 0), is_active: true, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-fee-cat-modal'); await refreshTable('feeCategories'); showToast('✅ Fee category added', 'success'); navigateTo('fee-structure'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function createFeeCategory() { openAddFeeCategory(); }

        function openAddFeeAmount() {
            const classes = (state.classes || []).filter(c => c.is_active !== false); const cats = state.feeCategories || []; const years = state.academicYears || [];
            showModal(`<div class="modal-overlay" id="add-fee-amt-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Class Fee Amount</h3><button class="modal-close" onclick="closeModal('add-fee-amt-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Category *</label><select id="nfa-cat" class="form-control"><option value="">— Select —</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Class *</label><select id="nfa-class" class="form-control"><option value="">— Select —</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Academic Year *</label><select id="nfa-year" class="form-control">${years.map(y => `<option value="${y.id}"${y.id === state.currentAcadYear?.id ? ' selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Amount (RWF) *</label><input type="number" id="nfa-amount" class="form-control" min="0"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-fee-amt-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewFeeAmount()">💾 Save</button></div></div></div>`);
            window._saveNewFeeAmount = async () => {
                const catId = parseInt(document.getElementById('nfa-cat')?.value); const clsId = parseInt(document.getElementById('nfa-class')?.value); const yearId = parseInt(document.getElementById('nfa-year')?.value); const amount = parseFloat(document.getElementById('nfa-amount')?.value || 0);
                if (!catId || !clsId || !yearId || !amount) { showToast('All fields required', 'warning'); return; }
                const r = await apiRequest('fee_amounts', 'POST', { fee_category_id: catId, class_id: clsId, academic_year_id: yearId, amount, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-fee-amt-modal'); showToast('✅ Fee amount added', 'success'); await refreshFeeAmounts(); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        function openEditFeeCategory(categoryId) {
            const cat = state.feeCategories.find(f => f.id === categoryId); if (!cat) { showToast('Category not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-fee-cat-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Fee Category</h3><button class="modal-close" onclick="closeModal('edit-fee-cat-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Name *</label><input id="efc-name" class="form-control" value="${esc(cat.name || '')}"></div>
                    <div class="form-group"><label>Description</label><input id="efc-desc" class="form-control" value="${esc(cat.description || '')}"></div>
                    <div class="form-group"><label>Type</label><select id="efc-type" class="form-control">${['standard', 'transport', 'activity', 'one-time'].map(t => `<option value="${t}"${cat.fee_type === t ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Reset Frequency</label><select id="efc-freq" class="form-control">${['monthly', 'termly', 'annual', 'one-time'].map(f => `<option value="${f}"${cat.reset_frequency === f ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Default Amount (RWF)</label><input type="number" id="efc-amount" class="form-control" value="${cat.amount || 0}"></div>
                    <div class="form-group"><label>Status</label><select id="efc-active" class="form-control"><option value="true"${cat.is_active !== false ? ' selected' : ''}>Active</option><option value="false"${cat.is_active === false ? ' selected' : ''}>Inactive</option></select></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-fee-cat-modal')">Cancel</button><button class="btn btn-primary" onclick="window.saveEditFeeCategory(${categoryId})">💾 Save</button></div></div></div>`);
        }

        async function saveEditFeeCategory(categoryId) {
            const name = document.getElementById('efc-name')?.value.trim(); if (!name) { showToast('Name required', 'warning'); return; }
            const payload = { name, description: document.getElementById('efc-desc')?.value.trim(), fee_type: document.getElementById('efc-type')?.value, reset_frequency: document.getElementById('efc-freq')?.value, amount: parseFloat(document.getElementById('efc-amount')?.value || 0), is_active: document.getElementById('efc-active')?.value === 'true', updated_at: new Date().toISOString() };
            const r = await apiRequest('fee_categories?id=eq.' + categoryId, 'PATCH', payload);
            if (r.success) { const idx = state.feeCategories.findIndex(f => f.id === categoryId); if (idx !== -1) state.feeCategories[idx] = { ...state.feeCategories[idx], ...payload }; closeModal('edit-fee-cat-modal'); showToast('✅ Category updated', 'success'); navigateTo('fee-structure'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function updateFeeCategory(categoryId) { await saveEditFeeCategory(categoryId); }

        async function openEditFeeAmount(feeAmountId) {
            let fa; try { const r = await apiRequest('fee_amounts?id=eq.' + feeAmountId); fa = r.success && r.data[0] ? r.data[0] : null; } catch (e) { }
            if (!fa) { showToast('Fee amount not found', 'error'); return; }
            const cls = state.classes.find(c => c.id === fa.class_id); const cat = state.feeCategories.find(f => f.id === fa.fee_category_id);
            
            showModal(`<div class="modal-overlay" id="edit-fee-amt-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Fee Amount</h3><button class="modal-close" onclick="closeModal('edit-fee-amt-modal')">✕</button></div>
                <div class="modal-body"><p><strong>Category:</strong> ${esc(cat?.name || '—')}</p><p><strong>Class:</strong> ${esc(cls?.name || '—')}</p>
                    <div class="form-group"><label>Amount (RWF) *</label><input type="number" id="efa-amount" class="form-control" value="${fa.amount || 0}" min="0"></div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-fee-amt-modal')">Cancel</button><button class="btn btn-primary" onclick="window.saveEditFeeAmount(${feeAmountId})">💾 Save</button></div></div></div>`);
        }

        async function saveEditFeeAmount(feeAmountId) {
            const amount = parseFloat(document.getElementById('efa-amount')?.value || 0); if (!amount) { showToast('Enter a valid amount', 'warning'); return; }
            const r = await apiRequest('fee_amounts?id=eq.' + feeAmountId, 'PATCH', { amount, updated_at: new Date().toISOString() });
            if (r.success) { closeModal('edit-fee-amt-modal'); showToast('✅ Amount updated', 'success'); await refreshFeeAmounts(); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function deleteFeeCategory(categoryId, name) {
            if (!await confirmDialog(`Delete fee category "${name || categoryId}"? Cannot be undone.`)) return;
            const r = await apiRequest('fee_categories?id=eq.' + categoryId, 'DELETE');
            if (r.success) { state.feeCategories = state.feeCategories.filter(f => f.id !== categoryId); showToast('✅ Fee category deleted', 'success'); navigateTo('fee-structure'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function exportFeeAmounts() {
            let feeAmounts = [];
            try { const r = await apiRequest('fee_amounts?limit=5000'); feeAmounts = r.success ? r.data : []; } catch (e) { }
            const rows = feeAmounts.map(fa => {
                const cls = state.classes.find(c => c.id === fa.class_id); const cat = state.feeCategories.find(f => f.id === fa.fee_category_id); const yr = state.academicYears.find(y => y.id === fa.academic_year_id);
                return { 'Category': cat?.name || '—', 'Class': cls?.name || '—', 'Amount (RWF)': fa.amount || 0, 'Academic Year': yr?.name || '—' };
            });
            exportToExcel(rows, 'Fee_Amounts_' + new Date().toISOString().split('T')[0]); showToast('✅ Fee amounts exported', 'success');
        }

        function showStructureTab(tab, event) {
            ['categories', 'templates', 'class-overrides'].forEach(t => { const p = document.getElementById('fs-tab-' + t); if (p) p.style.display = t === tab ? '' : 'none'; });
            document.querySelectorAll('.fs-tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }

        function openAddFeeCategoryModal() { openAddFeeCategory(); }
        function editFeeCategory(categoryId) { openEditFeeCategory(categoryId); }

        async function copyFeeCategory(categoryId) {
            const cat = state.feeCategories.find(f => f.id === categoryId); if (!cat) { showToast('Category not found', 'error'); return; }
            const r = await apiRequest('fee_categories', 'POST', { name: cat.name + ' (Copy)', description: cat.description, fee_type: cat.fee_type, reset_frequency: cat.reset_frequency, amount: cat.amount, is_active: true, created_at: new Date().toISOString() });
            if (r.success) { await refreshTable('feeCategories'); showToast('✅ Category duplicated', 'success'); navigateTo('fee-structure'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        function exportFeeStructures() {
            const rows = (state.feeCategories || []).map(f => ({ 'Name': f.name, 'Type': f.fee_type || '—', 'Frequency': f.reset_frequency || '—', 'Amount (RWF)': f.amount || 0, 'Description': f.description || '', 'Status': f.is_active !== false ? 'Active' : 'Inactive' }));
            exportToExcel(rows, 'Fee_Structures_' + new Date().toISOString().split('T')[0]); showToast('✅ Fee structures exported', 'success');
        }

        function openAddTemplateModal() {
            const cats = state.feeCategories || [];
            showModal(`<div class="modal-overlay" id="add-template-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Fee Template</h3><button class="modal-close" onclick="closeModal('add-template-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Template Name *</label><input id="ft-name" class="form-control" placeholder="e.g. Standard Term Package"></div>
                    <div class="form-group"><label>Fee Categories</label><div>${cats.map(c => `<label style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><input type="checkbox" class="ft-cat-check" value="${c.id}"> ${esc(c.name)} (${fmtCurrency(c.amount || 0)})</label>`).join('')}</div></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-template-modal')">Cancel</button><button class="btn btn-primary" onclick="window.saveFeeTemplate()">💾 Save</button></div></div></div>`);
        }

        async function saveFeeTemplate() {
            const name = document.getElementById('ft-name')?.value.trim(); const catIds = [...document.querySelectorAll('.ft-cat-check:checked')].map(c => parseInt(c.value));
            if (!name) { showToast('Template name required', 'warning'); return; }
            const existing = JSON.parse(state.schoolSettings.fee_templates || '[]');
            existing.push({ id: Date.now(), name, category_ids: catIds, created_at: new Date().toISOString() });
            await updateSchoolSetting('fee_templates', JSON.stringify(existing)); state.schoolSettings.fee_templates = JSON.stringify(existing);
            closeModal('add-template-modal'); showToast('✅ Template saved', 'success');
        }

        /**
         * Loads fee amount overrides into #class-overrides-list, filtered by
         * the #override-class-filter dropdown if set. (Previously wrote into
         * #class-overrides-container and copied from #fee-amounts-container —
         * neither of which exist on this page — so this was silently a no-op.)
         */
        async function loadClassOverrides() {
            const container = document.getElementById('class-overrides-list'); if (!container) return;
            container.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
            const classFilter = document.getElementById('override-class-filter')?.value;
            let feeAmounts = [];
            try {
                let q = 'fee_amounts?limit=1000';
                if (state.currentAcadYear?.id) q += '&academic_year_id=eq.' + state.currentAcadYear.id;
                const r = await apiRequest(q);
                feeAmounts = r.success ? r.data : [];
            } catch (e) { }
            if (classFilter) feeAmounts = feeAmounts.filter(f => String(f.class_id) === classFilter);
            if (!feeAmounts.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No fee overrides configured.</div>'; return; }
            const rows = feeAmounts.map(fa => {
                const cls = state.classes.find(c => c.id === fa.class_id);
                const cat = state.feeCategories.find(f => f.id === fa.fee_category_id);
                return `<tr><td>${esc(cat?.name || '—')}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right;font-weight:600">${fmtCurrency(fa.amount || 0)}</td>
                    <td><button class="btn btn-sm btn-outline" onclick="window.editOverride(${fa.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="window.deleteOverride(${fa.id})">🗑️</button></td></tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table"><thead><tr><th>Category</th><th>Class</th><th>Amount (RWF)</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
        }

        function openAddOverrideModal() { openAddFeeAmount(); }
        async function updateOverrideDefaultAmount(id) { await saveEditFeeAmount(id); }
        function createOverride() { openAddFeeAmount(); }
        function editOverride(id) { openEditFeeAmount(id); }
        async function deleteOverride(id) {
            if (!await confirmDialog('Delete this fee override?')) return;
            const r = await apiRequest('fee_amounts?id=eq.' + id, 'DELETE');
            if (r.success) { showToast('✅ Override deleted', 'success'); await refreshFeeAmounts(); } else showToast('Failed: ' + r.error, 'error');
        }

        function viewTemplate(templateId) {
            const templates = JSON.parse(state.schoolSettings.fee_templates || '[]'); const t = templates.find(x => String(x.id) === String(templateId));
            if (!t) { showToast('Template not found', 'error'); return; }
            const catNames = (t.category_ids || []).map(id => state.feeCategories.find(f => f.id === id)?.name || '—').join(', ');
            showModal(`<div class="modal-overlay" id="view-template-modal"><div class="modal modal-sm"><div class="modal-header"><h3>📋 ${esc(t.name)}</h3><button class="modal-close" onclick="closeModal('view-template-modal')">✕</button></div>
                <div class="modal-body"><p><strong>Categories:</strong> ${esc(catNames || 'None')}</p><p><strong>Created:</strong> ${fmtDate(t.created_at)}</p></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('view-template-modal')">Close</button></div></div></div>`);
        }

        async function deleteTemplate(templateId) {
            if (!await confirmDialog('Delete this template?')) return;
            const templates = JSON.parse(state.schoolSettings.fee_templates || '[]');
            const updated = templates.filter(t => String(t.id) !== String(templateId));
            await updateSchoolSetting('fee_templates', JSON.stringify(updated)); state.schoolSettings.fee_templates = JSON.stringify(updated);
            showToast('✅ Template deleted', 'success');
        }

        /**
         * Applies a fee template (a saved set of fee categories) to all active
         * students in a chosen class — creates one student_fees row per
         * category per student, using each category's default amount.
         * Named distinctly from applyTemplate() (report-card template
         * selector) to avoid a naming collision between the two features.
         */
        async function applyFeeTemplate(templateId) {
            const templates = JSON.parse(state.schoolSettings.fee_templates || '[]');
            const template = templates.find(t => String(t.id) === String(templateId));
            if (!template) { showToast('Template not found', 'error'); return; }

            const classOptions = (state.classes || []).filter(c => c.is_active !== false);
            showModal(`<div class="modal-overlay" id="apply-template-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✅ Apply Template: ${esc(template.name)}</h3><button class="modal-close" onclick="closeModal('apply-template-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Class *</label><select id="apt-class" class="form-control">${classOptions.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <p style="color:var(--text-muted);font-size:13px">This will apply ${(template.category_ids || []).length} fee categories to all active students in the selected class.</p>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('apply-template-modal')">Cancel</button><button class="btn btn-primary" onclick="window._executeApplyFeeTemplate('${templateId}')">✅ Apply</button></div></div></div>`);

            window._executeApplyFeeTemplate = async (tid) => {
                const classId = document.getElementById('apt-class')?.value;
                if (!classId) { showToast('Select a class', 'warning'); return; }
                const tpl = templates.find(t => String(t.id) === String(tid));
                const students = (state.students || []).filter(s => String(s.class_id) === String(classId) && s.status === 'Active');
                if (!students.length) { showToast('No active students in this class', 'warning'); return; }
                closeModal('apply-template-modal');
                showToast('⏳ Applying template…', 'info', 4000);
                let ok = 0;
                for (const catId of (tpl.category_ids || [])) {
                    const cat = state.feeCategories.find(c => c.id === catId);
                    if (!cat) continue;
                    for (const s of students) {
                        const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: catId, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount: cat.amount || 0, paid_amount: 0, is_paid: false, is_waived: false, due_date: state.currentTerm?.end_date || null, created_at: new Date().toISOString() });
                        if (r.success) ok++;
                    }
                }
                await refreshTable('student_fees');
                showToast(`✅ Template applied — ${ok} fee record(s) created`, 'success');
            };
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK T — FEE ASSIGNMENTS, WAIVERS, TERM STATUS, BALANCES
        // ════════════════════════════════════════════════════════════════════

        async function renderFeeAssignmentsTable() {
            const container = document.getElementById('fee-assignments-table'); if (!container) return;
            container.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
            await ensureStateLoaded();
            const classFilter = document.getElementById('assign-class-filter')?.value;
            const termFilter = document.getElementById('assign-term-filter')?.value;
            const statusFilter = document.getElementById('assign-status-filter')?.value;
            const yearId = state.currentAcadYear?.id;
            let fees = (state.studentFees || []).filter(f => f.academic_year_id === yearId);
            if (classFilter) { const sids = new Set((state.students || []).filter(s => String(s.class_id) === classFilter).map(s => s.id)); fees = fees.filter(f => sids.has(f.student_id)); }
            if (termFilter) fees = fees.filter(f => String(f.term_id) === termFilter);
            if (statusFilter === 'waived') fees = fees.filter(f => f.is_waived);
            else if (statusFilter === 'paid') fees = fees.filter(f => f.is_paid);
            else if (statusFilter === 'active') fees = fees.filter(f => !f.is_waived && !f.is_paid);
            const countEl = document.getElementById('assign-count');
            if (countEl) countEl.textContent = `${fees.length} assignment${fees.length !== 1 ? 's' : ''}`;
            if (!fees.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No fee assignments found.</div>'; return; }
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Category</th><th>Amount</th><th>Paid</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${fees.slice(0, 200).map(f => {
                const s = state.students.find(x => x.id === f.student_id); const cls = state.classes.find(c => c.id === s?.class_id); const cat = state.feeCategories.find(x => x.id === f.fee_category_id);
                return `<tr><td>${esc(s ? s.first_name + ' ' + s.last_name : '—')}</td><td>${esc(cls?.name || '—')}</td><td>${esc(cat?.name || '—')}</td><td>${fmtCurrency(f.amount || 0)}</td><td>${fmtCurrency(f.paid_amount || 0)}</td>
                        <td><span class="badge ${f.is_paid ? 'badge-success' : f.is_waived ? 'badge-info' : 'badge-warning'}">${f.is_paid ? '✅ Paid' : f.is_waived ? '🎁 Waived' : '⏳ Pending'}</span></td>
                        <td><button class="btn btn-sm btn-outline" onclick="window.editFeeAssignment(${f.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="window.deleteFeeAssignment(${f.id})">🗑️</button></td></tr>`;
            }).join('')}
                </tbody></table></div>${fees.length > 200 ? `<p style="color:var(--text-muted);text-align:center;padding:8px">Showing first 200 of ${fees.length}</p>` : ''}`;
        }

        /**
         * Renders 4 summary stat cards into #assign-stats-container for the
         * Fee Assignments page: total assignments, total paid, total waived,
         * total pending — across the current academic year.
         */
        async function renderAssignmentStats() {
            const container = document.getElementById('assign-stats-container');
            if (!container) return;
            const yearId = state.currentAcadYear?.id;
            const fees = (state.studentFees || []).filter(f => f.academic_year_id === yearId);
            const paidCount = fees.filter(f => f.is_paid).length;
            const waivedCount = fees.filter(f => f.is_waived).length;
            const pendingCount = fees.filter(f => !f.is_paid && !f.is_waived).length;
            container.innerHTML = `
                <div class="stat-card"><div class="stat-value">${fees.length}</div><div class="stat-label">📋 Total Assignments</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--success)">${paidCount}</div><div class="stat-label">✅ Paid</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--info)">${waivedCount}</div><div class="stat-label">🎁 Waived</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${pendingCount}</div><div class="stat-label">⏳ Pending</div></div>
            `;
        }

        function openAssignFeeModal() {
            const classes = (state.classes || []).filter(c => c.is_active !== false); const cats = state.feeCategories || [];
            showModal(`<div class="modal-overlay" id="assign-fee-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Assign Fee</h3><button class="modal-close" onclick="closeModal('assign-fee-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Fee Category *</label><select id="af-cat" class="form-control"><option value="">— Select —</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)} — ${fmtCurrency(c.amount || 0)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Apply To</label><select id="af-target" class="form-control" onchange="window._toggleAssignTarget()"><option value="class">All students in a class</option><option value="all">All active students</option></select></div>
                    <div class="form-group" id="af-class-group"><label>Class</label><select id="af-class" class="form-control"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Custom Amount (RWF) — 0 uses category default</label><input type="number" id="af-amount" class="form-control" value="0" min="0"></div>
                    <div class="form-group"><label>Due Date</label><input type="date" id="af-due" class="form-control" value="${state.currentTerm?.end_date || ''}"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('assign-fee-modal')">Cancel</button><button class="btn btn-primary" onclick="window._doAssignFee()">💾 Assign</button></div></div></div>`);
            window._toggleAssignTarget = () => { const grp = document.getElementById('af-class-group'); if (grp) grp.style.display = document.getElementById('af-target')?.value === 'class' ? '' : 'none'; };
            window._doAssignFee = async () => {
                const catId = parseInt(document.getElementById('af-cat')?.value); const target = document.getElementById('af-target')?.value; const classId = document.getElementById('af-class')?.value; const customAmt = parseFloat(document.getElementById('af-amount')?.value || 0); const due = document.getElementById('af-due')?.value;
                if (!catId) { showToast('Select a fee category', 'warning'); return; }
                const cat = state.feeCategories.find(f => f.id === catId); const amount = customAmt > 0 ? customAmt : (cat?.amount || 0);
                let students = (state.students || []).filter(s => s.status === 'Active'); if (target === 'class' && classId) students = students.filter(s => String(s.class_id) === classId);
                closeModal('assign-fee-modal'); showToast('⏳ Assigning fee to ' + students.length + ' students…', 'info', 3000);
                let ok = 0;
                for (const s of students) { const r = await apiRequest('student_fees', 'POST', { student_id: s.id, fee_category_id: catId, term_id: state.currentTerm?.id, academic_year_id: state.currentAcadYear?.id, amount, paid_amount: 0, is_paid: false, is_waived: false, due_date: due || null, created_at: new Date().toISOString() }); if (r.success) ok++; }
                await refreshTable('student_fees'); showToast('✅ Fee assigned to ' + ok + ' students', 'success'); await renderFeeAssignmentsTable();
            };
        }

        async function exportFeeAssignments() {
            await ensureStateLoaded();
            const rows = (state.studentFees || []).map(f => {
                const s = state.students.find(x => x.id === f.student_id); const cls = state.classes.find(c => c.id === s?.class_id); const cat = state.feeCategories.find(x => x.id === f.fee_category_id);
                return { 'Student': s ? s.first_name + ' ' + s.last_name : '—', 'Class': cls?.name || '—', 'Category': cat?.name || '—', 'Amount': f.amount || 0, 'Paid': f.paid_amount || 0, 'Balance': (f.amount || 0) - (f.paid_amount || 0), 'Status': f.is_paid ? 'Paid' : f.is_waived ? 'Waived' : 'Pending', 'Due Date': fmtDate(f.due_date) };
            });
            exportToExcel(rows, 'Fee_Assignments_' + new Date().toISOString().split('T')[0]); showToast('✅ Fee assignments exported', 'success');
        }

        async function editFeeAssignment(feeId) {
            const fee = (state.studentFees || []).find(f => f.id === feeId); if (!fee) { showToast('Fee record not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-fee-assign-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Fee Assignment</h3><button class="modal-close" onclick="closeModal('edit-fee-assign-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Amount (RWF)</label><input type="number" id="efa2-amount" class="form-control" value="${fee.amount || 0}"></div>
                    <div class="form-group"><label>Paid Amount (RWF)</label><input type="number" id="efa2-paid" class="form-control" value="${fee.paid_amount || 0}"></div>
                    <div class="form-group"><label>Due Date</label><input type="date" id="efa2-due" class="form-control" value="${fee.due_date || ''}"></div>
                    <div class="form-group"><label>Notes</label><input id="efa2-notes" class="form-control" value="${esc(fee.notes || '')}"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-fee-assign-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditFeeAssign(${feeId})">💾 Save</button></div></div></div>`);
            window._saveEditFeeAssign = async (id) => {
                const amount = parseFloat(document.getElementById('efa2-amount')?.value || 0); const paid = parseFloat(document.getElementById('efa2-paid')?.value || 0); const due = document.getElementById('efa2-due')?.value; const notes = document.getElementById('efa2-notes')?.value;
                const r = await apiRequest('student_fees?id=eq.' + id, 'PATCH', { amount, paid_amount: paid, is_paid: paid >= amount, due_date: due || null, notes, updated_at: new Date().toISOString() });
                if (r.success) { closeModal('edit-fee-assign-modal'); await refreshTable('student_fees'); showToast('✅ Fee record updated', 'success'); await renderFeeAssignmentsTable(); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function deleteFeeAssignment(feeId) {
            if (!await confirmDialog('Delete this fee assignment?')) return;
            const r = await apiRequest('student_fees?id=eq.' + feeId, 'DELETE');
            if (r.success) { state.studentFees = (state.studentFees || []).filter(f => f.id !== feeId); showToast('✅ Deleted', 'success'); await renderFeeAssignmentsTable(); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function bulkAssignToClass() { openAssignFeeModal(); }

        /**
         * Smart Waiver Modal — choose student, fee category (or all),
         * custom amount or full waiver, and whether it recurs each term or is once-off.
         */
        function openSmartWaiverModal(prefillStudentId = null) {
            const students = (state.students || []).filter(s => s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            const cats = (state.feeCategories || []).filter(c => c.is_active !== false);
            showModal(`
                <div class="modal-overlay" id="smart-waiver-modal">
                <div class="modal" onclick="event.stopPropagation()" style="max-width:540px">
                    <div class="modal-header">
                        <h3>🎁 Apply Fee Waiver</h3>
                        <button class="modal-close" onclick="closeModal('smart-waiver-modal')">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-grid">
                            <div class="form-group full">
                                <label>Student *</label>
                                <select id="sw-student" class="form-control" onchange="window._loadWaiverFees()">
                                    <option value="">— Select Student —</option>
                                    ${students.map(s => `<option value="${s.id}" ${prefillStudentId == s.id ? 'selected' : ''}>${esc(s.first_name + ' ' + s.last_name)} (${esc(getClassById(s.class_id)?.name || '—')})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group full">
                                <label>Fee Category</label>
                                <select id="sw-category" class="form-control" onchange="window._updateWaiverAmount()">
                                    <option value="all">All Outstanding Fees</option>
                                    ${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Waiver Type</label>
                                <select id="sw-type" class="form-control" onchange="window._updateWaiverAmount()">
                                    <option value="full">Full Waiver (100%)</option>
                                    <option value="percentage">Percentage Discount</option>
                                    <option value="custom">Custom Amount (RWF)</option>
                                </select>
                            </div>
                            <div class="form-group" id="sw-amount-group" style="display:none">
                                <label id="sw-amount-label">Amount / Percentage</label>
                                <input type="number" id="sw-amount" class="form-control" min="0" placeholder="Enter value">
                            </div>
                            <div class="form-group full">
                                <label>Applies To</label>
                                <select id="sw-recurrence" class="form-control">
                                    <option value="once">This fee only (once-off)</option>
                                    <option value="recurring">Every time this fee is renewed (recurring)</option>
                                </select>
                                <small class="field-hint">Recurring waivers are re-applied automatically when fees reset for new terms.</small>
                            </div>
                            <div class="form-group full">
                                <label>Reason *</label>
                                <textarea id="sw-reason" class="form-control" rows="2" placeholder="Reason for waiver (e.g. scholarship, financial hardship)…"></textarea>
                            </div>
                            <div id="sw-fee-preview" class="form-group full"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal('smart-waiver-modal')">Cancel</button>
                        <button class="btn btn-warning" onclick="window.submitSmartWaiver()">🎁 Apply Waiver</button>
                    </div>
                </div></div>`);

            // Show/hide amount input on type change
            document.getElementById('sw-type').onchange = window._updateWaiverAmount;

            // Auto-load fees when student pre-filled
            if (prefillStudentId) setTimeout(() => window._loadWaiverFees(), 100);
        }
        window.openSmartWaiverModal = openSmartWaiverModal;

        window._loadWaiverFees = function () {
            const studentId = document.getElementById('sw-student')?.value;
            const preview = document.getElementById('sw-fee-preview');
            if (!studentId || !preview) return;
            const fees = (state.studentFees || []).filter(f => f.student_id == studentId && !f.is_waived && !f.is_credit && !f.manually_deleted);
            if (!fees.length) { preview.innerHTML = '<div class="alert alert-info">No outstanding fees found</div>'; return; }
            const total = fees.reduce((s, f) => s + (f.amount || 0), 0);
            const paid = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);
            preview.innerHTML = `<div style="background:var(--bg-tertiary);padding:10px;border-radius:8px;font-size:.82rem">
                <strong>Outstanding:</strong> ${fees.length} fee(s) | Total: ${fmtCurrency(total)} | Paid: ${fmtCurrency(paid)} | <strong>Balance: ${fmtCurrency(Math.max(0, total - paid))}</strong>
            </div>`;
            window._updateWaiverAmount();
        };

        window._updateWaiverAmount = function () {
            const type = document.getElementById('sw-type')?.value;
            const group = document.getElementById('sw-amount-group');
            const label = document.getElementById('sw-amount-label');
            if (!group || !label) return;
            if (type === 'full') {
                group.style.display = 'none';
            } else if (type === 'percentage') {
                group.style.display = 'block';
                label.textContent = 'Discount Percentage (%)';
                document.getElementById('sw-amount').placeholder = 'e.g. 25 for 25%';
            } else {
                group.style.display = 'block';
                label.textContent = 'Custom Amount (RWF)';
                document.getElementById('sw-amount').placeholder = 'e.g. 50000';
            }
        };

        async function submitSmartWaiver() {
            const studentId = document.getElementById('sw-student')?.value;
            const catId = document.getElementById('sw-category')?.value;
            const waiverType = document.getElementById('sw-type')?.value;
            const amount = parseFloat(document.getElementById('sw-amount')?.value) || 0;
            const recurrence = document.getElementById('sw-recurrence')?.value;
            const reason = document.getElementById('sw-reason')?.value?.trim();

            if (!studentId) { showToast('Select a student', 'warning'); return; }
            if (!reason) { showToast('Reason is required', 'warning'); return; }
            if ((waiverType === 'percentage' || waiverType === 'custom') && !amount) {
                showToast('Enter the amount or percentage', 'warning'); return;
            }

            // Get target fees
            let fees = (state.studentFees || []).filter(f =>
                f.student_id == studentId && !f.is_waived && !f.is_credit && !f.manually_deleted
            );
            if (catId !== 'all') fees = fees.filter(f => f.fee_category_id == catId);
            if (!fees.length) { showToast('No outstanding fees match the selection', 'info'); return; }

            const count = fees.length;
            if (!await confirmDialog(`Apply waiver to ${count} fee(s)? ${recurrence === 'recurring' ? 'This will recur each term.' : 'Once-off only.'}`)) return;

            let ok = 0;
            for (const fee of fees) {
                let waivedAmount = fee.amount;
                if (waiverType === 'percentage') waivedAmount = Math.round((amount / 100) * fee.amount);
                else if (waiverType === 'custom') waivedAmount = Math.min(amount, fee.amount);

                await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', {
                    is_waived: true,
                    waiver_reason: reason,
                    waiver_type: waiverType,
                    waiver_amount: waivedAmount,
                    waiver_recurring: recurrence === 'recurring',
                    notes: reason,
                    updated_at: new Date().toISOString()
                });
                ok++;
            }

            // If recurring, save a waiver template to school_settings for auto-application
            if (recurrence === 'recurring') {
                const waiverTemplate = {
                    student_id: studentId,
                    category_id: catId,
                    waiver_type: waiverType,
                    amount,
                    reason,
                    created_at: new Date().toISOString()
                };
                try {
                    await insert('waiver_templates', waiverTemplate);
                } catch (e) {
                    // Table may not exist — store in localStorage as fallback
                    const key = `recurring_waiver_${studentId}`;
                    const existing = JSON.parse(localStorage.getItem(key) || '[]');
                    existing.push(waiverTemplate);
                    localStorage.setItem(key, JSON.stringify(existing));
                }
            }

            await refreshTable('student_fees');
            closeModal('smart-waiver-modal');
            await logActivity(state.currentUser?.id, state.currentUser?.role,
                `Waiver applied: ${waiverType} to ${ok} fee(s) for student #${studentId} (${recurrence})`,
                'finance', studentId, { reason, waiverType, recurrence });
            showToast(`✅ Waiver applied to ${ok} fee(s)${recurrence === 'recurring' ? ' — will recur each term' : ''}`, 'success');
            renderFeeWaivers(document.getElementById('dynamic-content'));
        }
        window.submitSmartWaiver = submitSmartWaiver;


        function openFullWaiverModal() {
            const students = (state.students || []).filter(s => s.status === 'Active');
            showModal(`<div class="modal-overlay" id="full-waiver-modal"><div class="modal modal-sm"><div class="modal-header"><h3>🎁 Full Fee Waiver</h3><button class="modal-close" onclick="closeModal('full-waiver-modal')">✕</button></div>
                <div class="modal-body"><div class="alert alert-warning">⚠️ Waives ALL outstanding fees for this student.</div>
                    <div class="form-group"><label>Student *</label><select id="fwv-student" class="form-control"><option value="">— Select Student —</option>${students.map(s => `<option value="${s.id}">${esc(s.first_name + ' ' + s.last_name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Reason *</label><textarea id="fwv-reason" class="form-control" rows="3" placeholder="Reason for waiver…"></textarea></div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('full-waiver-modal')">Cancel</button><button class="btn btn-warning" onclick="window.submitFullWaiver()">🎁 Apply</button></div></div></div>`);
        }

        async function submitFullWaiver() {
            const studentId = document.getElementById('fwv-student')?.value; const reason = document.getElementById('fwv-reason')?.value?.trim();
            if (!studentId) { showToast('Select a student', 'warning'); return; }
            if (!reason) { showToast('Reason required', 'warning'); return; }
            const fees = (state.studentFees || []).filter(f => String(f.student_id) === String(studentId) && !f.is_paid && !f.is_waived);
            if (!fees.length) { showToast('No outstanding fees for this student', 'info'); return; }
            if (!await confirmDialog(`Waive ${fees.length} outstanding fee(s)?`)) return;
            let ok = 0;
            for (const fee of fees) { const r = await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, notes: reason, updated_at: new Date().toISOString() }); if (r.success) ok++; }
            await refreshTable('student_fees'); closeModal('full-waiver-modal');
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Full waiver applied to student #' + studentId + ': ' + reason, 'finance');
            showToast('✅ Full waiver applied — ' + ok + ' fee(s) waived', 'success');
        }

        async function removeWaiver(feeId) {
            if (!await confirmDialog('Remove this waiver? Student will owe this fee again.')) return;
            const r = await apiRequest('student_fees?id=eq.' + feeId, 'PATCH', { is_waived: false, notes: '', updated_at: new Date().toISOString() });
            if (r.success) { const fee = (state.studentFees || []).find(f => f.id === feeId); if (fee) fee.is_waived = false; showToast('✅ Waiver removed', 'success'); navigateTo('fee-waivers'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        /**
 * Download a Discount Receipt PDF
 * @param {Object} discountData - Discount details
 */
        async function downloadDiscountReceipt(discountData) {
            const {
                studentName, studentCode, className, feeName,
                originalAmount, discountAmount, netAmount,
                discountType, discountReason,
                receiptNumber, date, approvedBy,
                schoolName = 'ECOLE LA FONTAINE',
                schoolAddress = 'Rubavu, Rwanda',
                logo = '🏫'
            } = discountData;

            const discountPct = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0;
            const logoHtml = (typeof logo === 'string' && (logo.startsWith('data:') || logo.startsWith('http')))
                ? `<img src="${logo}" alt="logo" style="width:38px;height:38px;object-fit:contain;border-radius:4px">`
                : `<span style="font-size:26px;line-height:1">${logo || '🏫'}</span>`;

            const html = `<div id="discount-pdf-content" style="font-family:'Courier New',Monaco,Menlo,monospace;width:350px;margin:0 auto;background:#fff;padding:10px;font-size:9.5px;line-height:1.25">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">
            <div style="width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center">${logoHtml}</div>
            <div style="text-align:center">
                <div style="font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;line-height:1.2">${esc(schoolName)}</div>
                ${schoolAddress ? `<div style="font-size:7px;color:#666;margin-top:1px">${esc(schoolAddress)}</div>` : ''}
                <div style="font-size:9px;font-weight:600;letter-spacing:1px;color:#444;margin-top:2px">DISCOUNT RECEIPT</div>
                <div style="font-size:8px;font-family:monospace;background:#f0f0f0;display:inline-block;padding:1px 5px;margin-top:2px">${esc(receiptNumber)}</div>
            </div>
        </div>
        <div style="border-top:1px dashed #999;margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Student:</span><span style="font-weight:500;text-align:right">${esc(studentName)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Code:</span><span style="font-weight:500;text-align:right">${esc(studentCode)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Class:</span><span style="font-weight:500;text-align:right">${esc(className)}</span></div>
        <div style="border-top:1px dotted #999;margin:5px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Fee Category:</span><span style="font-weight:500;text-align:right">${esc(feeName)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;text-decoration:line-through;color:#94a3b8">
            <span style="font-weight:600;color:#555">Original Amount:</span>
            <span style="font-weight:500;text-align:right">${fmtCurrency(originalAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;background:#fef3c7;padding:4px 8px;border-radius:4px">
            <span style="font-weight:700;color:#92400e">DISCOUNT (${discountPct}%):</span>
            <span style="font-weight:700;color:#92400e">- ${fmtCurrency(discountAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;font-weight:700;font-size:11px">
            <span style="color:#065f46">NET AMOUNT:</span>
            <span style="color:#065f46">${fmtCurrency(netAmount)}</span>
        </div>
        <div style="border-top:1px dashed #999;margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Discount Type:</span><span style="font-weight:500;text-align:right">${esc(discountType)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Reason:</span><span style="font-weight:500;text-align:right">${esc(discountReason)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Date:</span><span style="font-weight:500;text-align:right">${esc(date)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Approved By:</span><span style="font-weight:500;text-align:right">${esc(approvedBy)}</span></div>
        <div style="border-top:1px solid #000;margin:6px 0"></div>
        <div style="text-align:center;font-size:8px;color:#666;margin-top:8px">
            <div style="background:#fef3c7;padding:4px 12px;border-radius:12px;display:inline-block;font-weight:700;color:#92400e;font-size:9px">🎁 DISCOUNT APPLIED</div>
            <div style="margin-top:6px">Thank you for being part of the ECOLE LA FONTAINE community</div>
            <div style="margin-top:4px">\u2729 ${esc(schoolName)} \u2729</div>
        </div>
    </div>`;

            const container = document.createElement('div');
            container.innerHTML = html;
            container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:350px';
            document.body.appendChild(container);

            try {
                if (typeof html2pdf === 'undefined') throw new Error('html2pdf not loaded');
                await html2pdf().set({
                    margin: [4, 4, 4, 4],
                    filename: `Discount_${esc(studentName).replace(/\s+/g, '_')}_${esc(receiptNumber)}.pdf`,
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
                }).from(container.querySelector('#discount-pdf-content')).save();
                return true;
            } catch (err) {
                console.warn('[Discount PDF] Failed:', err);
                return false;
            } finally {
                document.body.removeChild(container);
            }
        }

        async function renderFeeTermTable() {
            const container = document.getElementById('fee-term-container'); if (!container) return;
            container.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
            await ensureStateLoaded();
            const termId = document.getElementById('fts-term')?.value || String(state.currentTerm?.id || ''); const classId = document.getElementById('fts-class')?.value;
            let students = (state.students || []).filter(s => s.status === 'Active'); if (classId) students = students.filter(s => String(s.class_id) === classId);
            const rows = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id); const fees = (state.studentFees || []).filter(f => f.student_id === s.id && (!termId || String(f.term_id) === termId));
                const totalOwed = fees.reduce((sum, f) => sum + (!f.is_waived ? (f.amount || 0) : 0), 0); const totalPaid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0); const balance = totalOwed - totalPaid;
                return `<tr><td>${esc(s.first_name + ' ' + s.last_name)}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right">${fmtCurrency(totalOwed)}</td><td style="text-align:right">${fmtCurrency(totalPaid)}</td><td style="text-align:right;color:${balance > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${fmtCurrency(balance)}</td><td><span class="badge ${balance <= 0 ? 'badge-success' : totalPaid > 0 ? 'badge-warning' : 'badge-danger'}">${balance <= 0 ? '✅ Clear' : totalPaid > 0 ? '⚡ Partial' : '⏳ Unpaid'}</span></td></tr>`;
            }).join('');
            container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Owed</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No records found.</td></tr>'}</tbody></table></div>`;
        }

        async function exportFeeTermStatus() {
            await ensureStateLoaded();
            const termId = document.getElementById('fts-term')?.value || String(state.currentTerm?.id || '');
            const rows = (state.students || []).filter(s => s.status === 'Active').map(s => {
                const cls = state.classes.find(c => c.id === s.class_id); const fees = (state.studentFees || []).filter(f => f.student_id === s.id && (!termId || String(f.term_id) === termId));
                const owed = fees.reduce((sum, f) => sum + (!f.is_waived ? (f.amount || 0) : 0), 0); const paid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0); const balance = owed - paid;
                return { 'Student': s.first_name + ' ' + s.last_name, 'Class': cls?.name || '', 'Owed': owed, 'Paid': paid, 'Balance': balance, 'Status': balance <= 0 ? 'Clear' : paid > 0 ? 'Partial' : 'Unpaid' };
            });
            exportToExcel(rows, 'Fee_Term_Status_' + new Date().toISOString().split('T')[0]); showToast('✅ Fee term status exported', 'success');
        }

        function printFeeTermStatus() {
            const container = document.getElementById('fee-term-container');
            if (!container?.querySelector('table')) { showToast('Load data first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Fee Term Status</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:11px}th{background:#1a3a5c;color:#fff}</style></head><body><h2>Fee Term Status — ${new Date().toLocaleDateString()}</h2>${container.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        function showStudentTermDetails(studentId) { navigateToWithData('student-fees', { fee_student_id: studentId }); }

        async function exportFamilyFeeSummary() {
            await ensureStateLoaded();
            const families = state.families || []; const students = state.students || [];
            const rows = families.map(fam => {
                const members = students.filter(s => s.family_id === fam.id);
                const totalOwed = members.reduce((sum, s) => { const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { total: 0 }; return sum + (bal.total || 0); }, 0);
                const totalPaid = members.reduce((sum, s) => { const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { paid: 0 }; return sum + (bal.paid || 0); }, 0);
                return { 'Family Code': fam.family_code || '—', 'Guardian': fam.guardian_name || '—', 'Members': members.length, 'Total Owed': totalOwed, 'Total Paid': totalPaid, 'Balance': totalOwed - totalPaid, 'Discount': fam.discount_amount || 0 };
            });
            exportToExcel(rows, 'Family_Fee_Summary_' + new Date().toISOString().split('T')[0]); showToast('✅ Family summary exported', 'success');
        }

        async function refreshFamilySummary() { await ensureStateLoaded(); await refreshTable('families'); navigateTo('family-fee-summary'); }
        function filterFamilySummary() { const search = (document.getElementById('ffs-search')?.value || '').toLowerCase(); document.querySelectorAll('#family-summary-tbody tr').forEach(row => { row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none'; }); }

        async function renderBalancesTable() {
            const container = document.getElementById('balances-tbody') || document.getElementById('balances-container'); if (!container) return;
            await ensureStateLoaded();
            const classId = document.getElementById('bal-class')?.value; const statusFilt = document.getElementById('bal-status')?.value;
            let students = (state.students || []).filter(s => s.status === 'Active'); if (classId) students = students.filter(s => String(s.class_id) === classId);
            let rows = students.map(s => {
                const cls = state.classes.find(c => c.id === s.class_id); const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { total: 0, paid: 0, balance: 0, credit: 0 };
                const status = bal.balance <= 0 ? 'clear' : bal.paid > 0 ? 'partial' : 'unpaid'; return { s, cls, bal, status };
            });
            if (statusFilt) rows = rows.filter(r => r.status === statusFilt);
            const html = rows.map(({ s, cls, bal, status }) => `<tr><td>${esc(s.first_name + ' ' + s.last_name)}</td><td>${esc(cls?.name || '—')}</td><td style="text-align:right">${fmtCurrency(bal.total || 0)}</td><td style="text-align:right">${fmtCurrency(bal.paid || 0)}</td><td style="text-align:right;color:${(bal.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${fmtCurrency(bal.balance || 0)}</td><td>${bal.credit > 0 ? fmtCurrency(bal.credit) : '—'}</td><td><span class="badge ${status === 'clear' ? 'badge-success' : status === 'partial' ? 'badge-warning' : 'badge-danger'}">${status === 'clear' ? '✅ Clear' : status === 'partial' ? '⚡ Partial' : '⏳ Unpaid'}</span></td><td><button class="btn btn-sm btn-outline" onclick="navigateToWithData('record-payment',{student_id:${s.id}})">💰 Pay</button></td></tr>`).join('');
            const tbody = container.tagName === 'TBODY' ? container : container.querySelector('tbody');
            if (tbody) tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No records.</td></tr>';
            else container.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Total</th><th>Paid</th><th>Balance</th><th>Credit</th><th>Status</th><th>Action</th></tr></thead><tbody>${html}</tbody></table></div>`;
        }

        async function exportBalancesToExcel() {
            await ensureStateLoaded();
            const rows = (state.students || []).filter(s => s.status === 'Active').map(s => {
                const cls = state.classes.find(c => c.id === s.class_id); const bal = typeof getFullStudentBalance === 'function' ? getFullStudentBalance(s.id) : { total: 0, paid: 0, balance: 0 };
                return { 'Student': s.first_name + ' ' + s.last_name, 'Class': cls?.name || '', 'Total (RWF)': bal.total || 0, 'Paid (RWF)': bal.paid || 0, 'Balance (RWF)': bal.balance || 0, 'Status': (bal.balance || 0) <= 0 ? 'Clear' : (bal.paid || 0) > 0 ? 'Partial' : 'Unpaid' };
            });
            exportToExcel(rows, 'Student_Balances_' + new Date().toISOString().split('T')[0]); showToast('✅ Balances exported', 'success');
        }

        function printBalanceReport() {
            const container = document.getElementById('balances-container'); if (!container?.querySelector('table')) { showToast('Load data first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Balance Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px;font-size:11px}th{background:#1a3a5c;color:#fff}</style></head><body><h2>Student Balances — ${new Date().toLocaleDateString()}</h2>${container.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        async function exportAuditLog() {
            const logs = (state.activityLogs || []).filter(l => ['finance', 'payment', 'fee'].some(k => (l.module || l.action || '').toLowerCase().includes(k)));
            const rows = logs.map(l => ({ 'Date': fmtDateTime(l.created_at), 'User': l.user_name || '—', 'Role': l.user_role || '—', 'Action': l.action || '—', 'Module': l.module || '—' }));
            exportToExcel(rows, 'Finance_Audit_' + new Date().toISOString().split('T')[0]); showToast('✅ Audit log exported', 'success');
        }

        async function refreshAuditLog() {
            try { const r = await apiRequest('activity_logs?order=created_at.desc&limit=500'); if (r.success) state.activityLogs = r.data; } catch (e) { }
            navigateTo('finance-audit'); showToast('🔄 Audit log refreshed', 'info', 1500);
        }

        function filterAuditLog() {
            const search = (document.getElementById('audit-search')?.value || '').toLowerCase(); const role = document.getElementById('audit-role')?.value;
            document.querySelectorAll('#audit-tbody tr').forEach(row => { const text = row.textContent.toLowerCase(); row.style.display = ((!search || text.includes(search)) && (!role || text.includes(role.toLowerCase()))) ? '' : 'none'; });
        }

        function viewAuditDetails(logId) {
            const log = (state.activityLogs || []).find(l => l.id === logId); if (!log) { showToast('Log entry not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="audit-detail-modal"><div class="modal modal-sm"><div class="modal-header"><h3>📋 Audit Log Entry</h3><button class="modal-close" onclick="closeModal('audit-detail-modal')">✕</button></div>
                <div class="modal-body"><table class="data-table"><tbody>
                    <tr><td><strong>Date</strong></td><td>${fmtDateTime(log.created_at)}</td></tr>
                    <tr><td><strong>User</strong></td><td>${esc(log.user_name || '—')}</td></tr>
                    <tr><td><strong>Role</strong></td><td>${esc(log.user_role || '—')}</td></tr>
                    <tr><td><strong>Action</strong></td><td>${esc(log.action || '—')}</td></tr>
                    <tr><td><strong>Module</strong></td><td>${esc(log.module || '—')}</td></tr>
                    ${log.record_id ? `<tr><td><strong>Record ID</strong></td><td>${log.record_id}</td></tr>` : ''}
                </tbody></table></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('audit-detail-modal')">Close</button></div></div></div>`);
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK U — TEACHERS, SUBJECTS, CLASSES
        // ════════════════════════════════════════════════════════════════════

        function showTeacherTab(tab, event) {
            ['teachers', 'accountants', 'admins'].forEach(t => { const p = document.getElementById(t + '-list-tab'); if (p) p.style.display = t === tab ? '' : 'none'; });
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }

        function openAddTeacherModal() {
            showModal(`<div class="modal-overlay" id="add-teacher-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Staff Member</h3><button class="modal-close" onclick="closeModal('add-teacher-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>First Name *</label><input id="nt-first" class="form-control"></div>
                    <div class="form-group"><label>Last Name *</label><input id="nt-last" class="form-control"></div>
                    <div class="form-group"><label>Email</label><input id="nt-email" class="form-control" type="email"></div>
                    <div class="form-group"><label>Phone</label><input id="nt-phone" class="form-control"></div>
                    <div class="form-group"><label>Username *</label><input id="nt-username" class="form-control" placeholder="e.g. jean.mukesa"></div>
                    <div class="form-group"><label>Password *</label><input id="nt-password" class="form-control" type="password"></div>
                    <div class="form-group"><label>Role *</label><select id="nt-role" class="form-control"><option value="teacher">👩‍🏫 Teacher</option><option value="accountant">💰 Accountant</option></select></div>
                    <div class="form-group"><label>Status</label><select id="nt-active" class="form-control"><option value="true">Active</option><option value="false">Inactive</option></select></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-teacher-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewTeacher()">💾 Save</button></div></div></div>`);
            window._saveNewTeacher = async () => {
                const first = document.getElementById('nt-first')?.value.trim(); const last = document.getElementById('nt-last')?.value.trim(); const username = document.getElementById('nt-username')?.value.trim(); const password = document.getElementById('nt-password')?.value;
                if (!first || !last || !username || !password) { showToast('First name, last name, username, and password required', 'warning'); return; }
                const dupe = (state.teachers || []).find(t => t.username === username); if (dupe) { showToast('Username already exists', 'warning'); return; }
                const r = await apiRequest('teachers', 'POST', { first_name: first, last_name: last, email: document.getElementById('nt-email')?.value.trim(), phone: document.getElementById('nt-phone')?.value.trim(), username, password, role: document.getElementById('nt-role')?.value, is_active: document.getElementById('nt-active')?.value === 'true', created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-teacher-modal'); await refreshTable('teachers'); await logActivity(state.currentUser?.id, state.currentUser?.role, 'Added staff: ' + first + ' ' + last, 'staff'); showToast('✅ Staff member added', 'success'); navigateTo('teachers-list'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        function exportTeachers() {
            const rows = (state.teachers || []).map(t => ({ 'First Name': t.first_name || '', 'Last Name': t.last_name || '', 'Email': t.email || '', 'Phone': t.phone || '', 'Username': t.username || '', 'Role': t.role || '', 'Status': t.is_active !== false ? 'Active' : 'Inactive', 'Joined': fmtDate(t.created_at) }));
            exportToExcel(rows, 'Staff_' + new Date().toISOString().split('T')[0]); showToast('✅ Staff exported', 'success');
        }

        function editTeacher(teacherId) {
            const t = (state.teachers || []).find(x => x.id === teacherId); if (!t) { showToast('Teacher not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-teacher-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit — ${esc(t.first_name + ' ' + t.last_name)}</h3><button class="modal-close" onclick="closeModal('edit-teacher-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>First Name</label><input id="et-first" class="form-control" value="${esc(t.first_name || '')}"></div>
                    <div class="form-group"><label>Last Name</label><input id="et-last" class="form-control" value="${esc(t.last_name || '')}"></div>
                    <div class="form-group"><label>Email</label><input id="et-email" class="form-control" value="${esc(t.email || '')}"></div>
                    <div class="form-group"><label>Phone</label><input id="et-phone" class="form-control" value="${esc(t.phone || '')}"></div>
                    <div class="form-group"><label>Username</label><input id="et-username" class="form-control" value="${esc(t.username || '')}"></div>
                    <div class="form-group"><label>New Password (blank = keep)</label><input id="et-password" class="form-control" type="password"></div>
                    <div class="form-group"><label>Status</label><select id="et-active" class="form-control"><option value="true"${t.is_active !== false ? ' selected' : ''}>Active</option><option value="false"${t.is_active === false ? ' selected' : ''}>Inactive</option></select></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-danger" onclick="window.deleteTeacher(${teacherId})">🗑️ Delete</button><button class="btn btn-outline" onclick="closeModal('edit-teacher-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditTeacher(${teacherId})">💾 Save</button></div></div></div>`);
            window._saveEditTeacher = async (id) => {
                const payload = { first_name: document.getElementById('et-first')?.value.trim(), last_name: document.getElementById('et-last')?.value.trim(), email: document.getElementById('et-email')?.value.trim(), phone: document.getElementById('et-phone')?.value.trim(), username: document.getElementById('et-username')?.value.trim(), is_active: document.getElementById('et-active')?.value === 'true', updated_at: new Date().toISOString() };
                const newPw = document.getElementById('et-password')?.value; if (newPw) payload.password = newPw;
                const r = await apiRequest('teachers?id=eq.' + id, 'PATCH', payload);
                if (r.success) { const idx = state.teachers.findIndex(x => x.id === id); if (idx !== -1) state.teachers[idx] = { ...state.teachers[idx], ...payload }; closeModal('edit-teacher-modal'); showToast('✅ Staff updated', 'success'); navigateTo('teachers-list'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        async function deleteTeacher(teacherId) {
            const t = (state.teachers || []).find(x => x.id === teacherId); if (!t) return;
            if (!await confirmDialog(`Delete ${t.first_name} ${t.last_name}? Cannot be undone.`)) return;
            closeModal('edit-teacher-modal');
            const r = await apiRequest('teachers?id=eq.' + teacherId, 'DELETE');
            if (r.success) { state.teachers = state.teachers.filter(x => x.id !== teacherId); showToast('✅ Staff member deleted', 'success'); navigateTo('teachers-list'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function toggleTeacherStatus(teacherId) {
            const t = (state.teachers || []).find(x => x.id === teacherId); if (!t) return;
            const r = await apiRequest('teachers?id=eq.' + teacherId, 'PATCH', { is_active: !t.is_active, updated_at: new Date().toISOString() });
            if (r.success) { t.is_active = !t.is_active; showToast('✅ Status updated — ' + t.last_name + ' is now ' + (t.is_active ? 'Active' : 'Inactive'), 'success'); navigateTo('teachers-list'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        function resetTeacherPassword(teacherId) {
            const t = (state.teachers || []).find(x => x.id === teacherId); if (!t) return;
            showModal(`<div class="modal-overlay" id="reset-pw-modal"><div class="modal modal-sm"><div class="modal-header"><h3>🔑 Reset Password — ${esc(t.first_name + ' ' + t.last_name)}</h3><button class="modal-close" onclick="closeModal('reset-pw-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>New Password *</label><input id="rp-new" class="form-control" type="password" placeholder="Enter new password"></div>
                    <div class="form-group"><label>Confirm Password *</label><input id="rp-confirm" class="form-control" type="password" placeholder="Confirm new password"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('reset-pw-modal')">Cancel</button><button class="btn btn-primary" onclick="window._doResetPw(${teacherId})">🔑 Reset</button></div></div></div>`);
            window._doResetPw = async (id) => {
                const newPw = document.getElementById('rp-new')?.value; const confPw = document.getElementById('rp-confirm')?.value;
                if (!newPw) { showToast('Enter a new password', 'warning'); return; }
                if (newPw !== confPw) { showToast('Passwords do not match', 'warning'); return; }
                const r = await apiRequest('teachers?id=eq.' + id, 'PATCH', { password: newPw, updated_at: new Date().toISOString() });
                if (r.success) { closeModal('reset-pw-modal'); await logActivity(state.currentUser?.id, state.currentUser?.role, 'Password reset for teacher ID ' + id, 'staff'); showToast('✅ Password reset successfully', 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        // ─── SUBJECTS ────────────────────────────────────────────────────────

        function showSubjectTab(tab, event) {
            const nursery = document.getElementById('nursery-subjects'); const primary = document.getElementById('primary-subjects');
            if (nursery) nursery.style.display = tab === 'nursery' ? '' : 'none';
            if (primary) primary.style.display = tab === 'primary' ? '' : 'none';
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }

        function openAddSubjectModal() {
            showModal(`<div class="modal-overlay" id="add-subject-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Subject</h3><button class="modal-close" onclick="closeModal('add-subject-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Subject Name *</label><input id="ns-name" class="form-control" placeholder="e.g. Mathematics"></div>
                    <div class="form-group"><label>Code *</label><input id="ns-code" class="form-control" placeholder="e.g. MATH"></div>
                    <div class="form-group"><label>Level *</label><select id="ns-level" class="form-control"><option value="Primary">Primary</option><option value="Nursery">Nursery</option><option value="Both">Both</option></select></div>
                    <div class="form-group"><label>Max Marks</label><input type="number" id="ns-max" class="form-control" value="100" min="1"></div>
                    <div class="form-group"><label>Order</label><input type="number" id="ns-order" class="form-control" value="1" min="1"></div>
                    <div class="form-group"><label>Is Core Subject</label><select id="ns-core" class="form-control"><option value="true">Yes</option><option value="false">No</option></select></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-subject-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewSubject()">💾 Save</button></div></div></div>`);
            window._saveNewSubject = async () => {
                const name = document.getElementById('ns-name')?.value.trim(); const code = document.getElementById('ns-code')?.value.trim().toUpperCase();
                if (!name || !code) { showToast('Name and code are required', 'warning'); return; }
                const r = await apiRequest('subjects', 'POST', { name, code, level: document.getElementById('ns-level')?.value, max_marks: parseInt(document.getElementById('ns-max')?.value || 100), sort_order: parseInt(document.getElementById('ns-order')?.value || 1), is_core: document.getElementById('ns-core')?.value === 'true', is_active: true, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-subject-modal'); await refreshTable('subjects'); showToast('✅ Subject added', 'success'); navigateTo('subjects'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        function openEditSubjectModal(subjectId) {
            const s = state.subjects.find(x => x.id === subjectId); if (!s) { showToast('Subject not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-subject-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Subject — ${esc(s.name)}</h3><button class="modal-close" onclick="closeModal('edit-subject-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Name *</label><input id="es2-name" class="form-control" value="${esc(s.name || '')}"></div>
                    <div class="form-group"><label>Code *</label><input id="es2-code" class="form-control" value="${esc(s.code || '')}"></div>
                    <div class="form-group"><label>Level</label><select id="es2-level" class="form-control"><option value="Primary"${s.level === 'Primary' ? ' selected' : ''}>Primary</option><option value="Nursery"${s.level === 'Nursery' ? ' selected' : ''}>Nursery</option><option value="Both"${s.level === 'Both' ? ' selected' : ''}>Both</option></select></div>
                    <div class="form-group"><label>Max Marks</label><input type="number" id="es2-max" class="form-control" value="${s.max_marks || 100}"></div>
                    <div class="form-group"><label>Order</label><input type="number" id="es2-order" class="form-control" value="${s.sort_order || 1}"></div>
                    <div class="form-group"><label>Status</label><select id="es2-active" class="form-control"><option value="true"${s.is_active !== false ? ' selected' : ''}>Active</option><option value="false"${s.is_active === false ? ' selected' : ''}>Inactive</option></select></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-danger" onclick="window.deleteSubject(${subjectId})">🗑️</button><button class="btn btn-outline" onclick="closeModal('edit-subject-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditSubject(${subjectId})">💾 Save</button></div></div></div>`);
            window._saveEditSubject = async (id) => {
                const name = document.getElementById('es2-name')?.value.trim(); const code = document.getElementById('es2-code')?.value.trim().toUpperCase();
                if (!name || !code) { showToast('Name and code required', 'warning'); return; }
                const payload = { name, code, level: document.getElementById('es2-level')?.value, max_marks: parseInt(document.getElementById('es2-max')?.value || 100), sort_order: parseInt(document.getElementById('es2-order')?.value || 1), is_active: document.getElementById('es2-active')?.value === 'true', updated_at: new Date().toISOString() };
                const r = await apiRequest('subjects?id=eq.' + id, 'PATCH', payload);
                if (r.success) { const idx = state.subjects.findIndex(x => x.id === id); if (idx !== -1) state.subjects[idx] = { ...state.subjects[idx], ...payload }; closeModal('edit-subject-modal'); showToast('✅ Subject updated', 'success'); navigateTo('subjects'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        /**
         * Delete a subject by ID.
         * Prevents deletion if the subject has existing marks.
         */
        async function deleteSubject(subjectId, subjectName) {
            const name = subjectName || (state.subjects || []).find(s => s.id === subjectId)?.name || 'this subject';
            const hasMarks = (state.assessments || []).some(a => a.subject_id == subjectId);
            if (hasMarks) {
                showToast(`Cannot delete "${name}" — it has existing assessments and marks. Hide it instead.`, 'warning');
                return;
            }
            if (!await confirmDialog(`Delete subject "${name}"? This cannot be undone.`)) return;
            try {
                closeModal('edit-subject-modal');
                const r = await apiRequest('subjects?id=eq.' + subjectId, 'DELETE');
                if (r.success) {
                    state.subjects = (state.subjects || []).filter(x => x.id !== subjectId);
                    await refreshTable('subjects');
                    showToast('✅ Subject deleted', 'success');
                    const container = document.getElementById('dynamic-content');
                    if (container) renderSubjects(container);
                } else {
                    showToast('Failed to delete: ' + (r.error || 'Unknown error'), 'error');
                }
            } catch (e) {
                showToast('Error deleting subject: ' + e.message, 'error');
            }
        }

        function exportSubjects() {
            const rows = (state.subjects || []).map(s => ({ 'Code': s.code, 'Name': s.name, 'Level': s.level, 'Max Marks': s.max_marks, 'Order': s.sort_order, 'Core': s.is_core ? 'Yes' : 'No', 'Status': s.is_active !== false ? 'Active' : 'Inactive' }));
            exportToExcel(rows, 'Subjects_' + new Date().toISOString().split('T')[0]); showToast('✅ Subjects exported', 'success');
        }

        // ─── CLASSES ─────────────────────────────────────────────────────────

        function openAddClassModal() {
            const sections = (state.classes || []).filter(c => c.is_active !== false).map(c => c.section || '').filter((v, i, a) => v && a.indexOf(v) === i);
            showModal(`<div class="modal-overlay" id="add-class-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Class</h3><button class="modal-close" onclick="closeModal('add-class-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Class Name *</label><input id="nc-name" class="form-control" placeholder="e.g. PRIMARY 1"></div>
                    <div class="form-group"><label>Level *</label><select id="nc-level" class="form-control"><option value="Primary">Primary</option><option value="Nursery">Nursery</option></select></div>
                    <div class="form-group"><label>Section</label><input id="nc-section" class="form-control" placeholder="e.g. A"></div>
                    <div class="form-group"><label>Capacity</label><input type="number" id="nc-cap" class="form-control" value="30" min="1"></div>
                    <div class="form-group"><label>Sort Order</label><input type="number" id="nc-order" class="form-control" value="${(state.classes || []).length + 1}" min="1"></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-class-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewClass()">💾 Save</button></div></div></div>`);
            window._saveNewClass = async () => {
                const name = document.getElementById('nc-name')?.value.trim(); if (!name) { showToast('Class name required', 'warning'); return; }
                const r = await apiRequest('classes', 'POST', { name, level: document.getElementById('nc-level')?.value, section: document.getElementById('nc-section')?.value.trim() || null, capacity: parseInt(document.getElementById('nc-cap')?.value || 30), sort_order: parseInt(document.getElementById('nc-order')?.value || 1), is_active: true, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-class-modal'); await refreshTable('classes'); showToast('✅ Class added', 'success'); navigateTo('class-management'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        function editClass(classId) {
            const cls = state.classes.find(c => c.id === classId); if (!cls) { showToast('Class not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-class-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Class — ${esc(cls.name)}</h3><button class="modal-close" onclick="closeModal('edit-class-modal')">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Class Name *</label><input id="ec-name" class="form-control" value="${esc(cls.name || '')}"></div>
                    <div class="form-group"><label>Level</label><select id="ec-level" class="form-control"><option value="Primary"${cls.level === 'Primary' ? ' selected' : ''}>Primary</option><option value="Nursery"${cls.level === 'Nursery' ? ' selected' : ''}>Nursery</option></select></div>
                    <div class="form-group"><label>Section</label><input id="ec-section" class="form-control" value="${esc(cls.section || '')}"></div>
                    <div class="form-group"><label>Capacity</label><input type="number" id="ec-cap" class="form-control" value="${cls.capacity || 30}"></div>
                    <div class="form-group"><label>Sort Order</label><input type="number" id="ec-order" class="form-control" value="${cls.sort_order || 1}"></div>
                    <div class="form-group"><label>Status</label><select id="ec-active" class="form-control"><option value="true"${cls.is_active !== false ? ' selected' : ''}>Active</option><option value="false"${cls.is_active === false ? ' selected' : ''}>Inactive</option></select></div>
                </div></div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('edit-class-modal')">Cancel</button><button class="btn btn-primary" onclick="window.updateClass(${classId})">💾 Save</button></div></div></div>`);
        }

        async function updateClass(classId) {
            const name = document.getElementById('ec-name')?.value.trim(); if (!name) { showToast('Class name required', 'warning'); return; }
            const payload = { name, level: document.getElementById('ec-level')?.value, section: document.getElementById('ec-section')?.value.trim() || null, capacity: parseInt(document.getElementById('ec-cap')?.value || 30), sort_order: parseInt(document.getElementById('ec-order')?.value || 1), is_active: document.getElementById('ec-active')?.value === 'true', updated_at: new Date().toISOString() };
            const r = await apiRequest('classes?id=eq.' + classId, 'PATCH', payload);
            if (r.success) { const idx = state.classes.findIndex(c => c.id === classId); if (idx !== -1) state.classes[idx] = { ...state.classes[idx], ...payload }; closeModal('edit-class-modal'); showToast('✅ Class updated', 'success'); navigateTo('class-management'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function deleteClass(classId) {
            const cls = state.classes.find(c => c.id === classId); if (!cls) return;
            const studentCount = (state.students || []).filter(s => s.class_id === classId && s.status === 'Active').length;
            if (studentCount > 0) { showToast(`Cannot delete — ${studentCount} active student(s) in this class. Move them first.`, 'warning'); return; }
            if (!await confirmDialog(`Delete class "${cls.name}"? Cannot be undone.`)) return;
            const r = await apiRequest('classes?id=eq.' + classId, 'DELETE');
            if (r.success) { state.classes = state.classes.filter(c => c.id !== classId); showToast('✅ Class deleted', 'success'); navigateTo('class-management'); }
            else showToast('Failed: ' + r.error, 'error');
        }

        async function moveClassUp(classId) {
            const idx = state.classes.findIndex(c => c.id === classId); if (idx <= 0) return;
            const cls = state.classes[idx]; const prev = state.classes[idx - 1];
            const t = cls.sort_order; await apiRequest('classes?id=eq.' + cls.id, 'PATCH', { sort_order: prev.sort_order }); await apiRequest('classes?id=eq.' + prev.id, 'PATCH', { sort_order: t });
            cls.sort_order = prev.sort_order; prev.sort_order = t; state.classes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            showToast('✅ Class moved up', 'success'); navigateTo('class-management');
        }

        async function moveClassDown(classId) {
            const idx = state.classes.findIndex(c => c.id === classId); if (idx < 0 || idx >= state.classes.length - 1) return;
            const cls = state.classes[idx]; const next = state.classes[idx + 1];
            const t = cls.sort_order; await apiRequest('classes?id=eq.' + cls.id, 'PATCH', { sort_order: next.sort_order }); await apiRequest('classes?id=eq.' + next.id, 'PATCH', { sort_order: t });
            cls.sort_order = next.sort_order; next.sort_order = t; state.classes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            showToast('✅ Class moved down', 'success'); navigateTo('class-management');
        }

        function exportClasses() {
            const rows = (state.classes || []).map(c => ({ 'Name': c.name, 'Level': c.level || '', 'Section': c.section || '', 'Capacity': c.capacity || '', 'Students': (state.students || []).filter(s => s.class_id === c.id && s.status === 'Active').length, 'Order': c.sort_order || '', 'Status': c.is_active !== false ? 'Active' : 'Inactive' }));
            exportToExcel(rows, 'Classes_' + new Date().toISOString().split('T')[0]); showToast('✅ Classes exported', 'success');
        }


        // ════════════════════════════════════════════════════════════════════
        // BLOCK V — HOLIDAYS (Rwanda auto-import + academic year clone)
        // ════════════════════════════════════════════════════════════════════

        // Fixed Rwanda public holidays (recurring annually by month/day)
        const RWANDA_PUBLIC_HOLIDAYS = [
            { name: "New Year's Day", month: 1, day: 1 },
            { name: "Heroes' Day", month: 2, day: 1 },
            { name: "International Women's Day", month: 3, day: 8 },
            { name: "Genocide Memorial Day", month: 4, day: 7 },
            { name: "Good Friday", dynamic: true, offset: -2 }, // Easter - 2
            { name: "Easter Sunday", dynamic: true, offset: 0 },
            { name: "Easter Monday", dynamic: true, offset: 1 },
            { name: "Labour Day", month: 5, day: 1 },
            { name: "Liberation Day", month: 7, day: 4 },
            { name: "Umuganura Day", month: 8, day: 1 }, // First Friday of August — approx
            { name: "Assumption Day", month: 8, day: 15 },
            { name: "Christmas Day", month: 12, day: 25 },
            { name: "Boxing Day", month: 12, day: 26 }
        ];

        /**
         * Calculate Easter Sunday date for a given year (Meeus/Jones/Butcher algorithm).
         * @param {number} year
         * @returns {Date}
         */
        function getEasterSunday(year) {
            const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
            const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
            const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const month = Math.floor((h + l - 7 * m + 114) / 31);
            const day = ((h + l - 7 * m + 114) % 31) + 1;
            return new Date(year, month - 1, day);
        }

        /**
         * Import Rwanda public holidays for a given academic year.
         * Reads the year's start/end dates and populates the holidays table.
         * Called once per academic year, or when admin triggers manually.
         * @param {number} [academicYearId] — defaults to current academic year
         */
        async function importRwandaHolidays(academicYearId) {
            await ensureStateLoaded();
            const yearId = academicYearId || state.currentAcadYear?.id;
            if (!yearId) { showToast('No academic year selected', 'warning'); return; }
            const acadYear = state.academicYears.find(y => y.id === yearId);
            if (!acadYear) { showToast('Academic year not found', 'error'); return; }

            // Determine the calendar year(s) this academic year spans
            const startDate = new Date(acadYear.start_date || new Date().getFullYear() + '-01-01');
            const endDate = new Date(acadYear.end_date || new Date().getFullYear() + '-12-31');
            const startYear = startDate.getFullYear();
            const endYear = endDate.getFullYear();

            // Check existing holidays for this year
            let existing = [];
            try { const r = await apiRequest('holidays?academic_year_id=eq.' + yearId + '&limit=100'); existing = r.success ? r.data : []; } catch (e) { }
            const existingNames = new Set(existing.map(h => h.name));

            const toInsert = [];
            for (let yr = startYear; yr <= endYear; yr++) {
                const easter = getEasterSunday(yr);
                for (const h of RWANDA_PUBLIC_HOLIDAYS) {
                    let date;
                    if (h.dynamic) {
                        const d = new Date(easter); d.setDate(d.getDate() + (h.offset || 0));
                        date = d.toISOString().split('T')[0];
                    } else {
                        date = `${yr}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
                    }
                    // Only include if within the academic year range
                    if (date < acadYear.start_date || date > acadYear.end_date) continue;
                    if (existingNames.has(h.name + ' ' + yr)) continue;
                    toInsert.push({ name: h.name + (startYear !== endYear ? ' ' + yr : ''), date, holiday_type: 'public', academic_year_id: yearId, is_recurring: true, created_at: new Date().toISOString() });
                }
            }

            if (!toInsert.length) { showToast('All Rwanda public holidays already imported for this year', 'info'); return; }
            if (!await confirmDialog(`Import ${toInsert.length} Rwanda public holiday(s) for ${acadYear.name}?`)) return;

            let ok = 0;
            for (const holiday of toInsert) { const r = await apiRequest('holidays', 'POST', holiday); if (r.success) ok++; }
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Imported ' + ok + ' Rwanda public holidays for ' + acadYear.name, 'holidays');
            showToast('✅ ' + ok + ' public holidays imported for ' + acadYear.name, 'success');
            navigateTo('academic-calendar');
        }

        /**
         * Open the Add Holiday modal (admin-defined school-specific holiday).
         */
        function openAddHolidayModal() {
            const years = state.academicYears || [];
            showModal(`<div class="modal-overlay" id="add-holiday-modal"><div class="modal modal-sm"><div class="modal-header"><h3>➕ Add Holiday</h3><button class="modal-close" onclick="closeModal('add-holiday-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Holiday Name *</label><input id="nh-name" class="form-control" placeholder="e.g. School Founding Day"></div>
                    <div class="form-group"><label>Date *</label><input type="date" id="nh-date" class="form-control"></div>
                    <div class="form-group"><label>Type</label><select id="nh-type" class="form-control"><option value="school">School</option><option value="public">Public</option><option value="half-day">Half Day</option></select></div>
                    <div class="form-group"><label>Academic Year</label><select id="nh-year" class="form-control">${years.map(y => `<option value="${y.id}"${y.id === state.currentAcadYear?.id ? ' selected' : ''}>${esc(y.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Description</label><input id="nh-desc" class="form-control" placeholder="Optional"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('add-holiday-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveNewHoliday()">💾 Save</button></div></div></div>`);
            window._saveNewHoliday = async () => {
                const name = document.getElementById('nh-name')?.value.trim(); const date = document.getElementById('nh-date')?.value;
                if (!name || !date) { showToast('Name and date required', 'warning'); return; }
                const r = await apiRequest('holidays', 'POST', { name, date, holiday_type: document.getElementById('nh-type')?.value, academic_year_id: parseInt(document.getElementById('nh-year')?.value), description: document.getElementById('nh-desc')?.value.trim() || null, is_recurring: false, created_at: new Date().toISOString() });
                if (r.success) { closeModal('add-holiday-modal'); showToast('✅ Holiday added', 'success'); navigateTo('academic-calendar'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        /**
         * Open the edit modal for an existing holiday.
         * @param {number} holidayId
         */
        async function editHoliday(holidayId) {
            let h; try { const r = await apiRequest('holidays?id=eq.' + holidayId); h = r.success && r.data[0] ? r.data[0] : null; } catch (e) { }
            if (!h) { showToast('Holiday not found', 'error'); return; }
            showModal(`<div class="modal-overlay" id="edit-holiday-modal"><div class="modal modal-sm"><div class="modal-header"><h3>✏️ Edit Holiday</h3><button class="modal-close" onclick="closeModal('edit-holiday-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Name *</label><input id="eh-name" class="form-control" value="${esc(h.name || '')}"></div>
                    <div class="form-group"><label>Date *</label><input type="date" id="eh-date" class="form-control" value="${h.date || ''}"></div>
                    <div class="form-group"><label>Type</label><select id="eh-type" class="form-control"><option value="school"${h.holiday_type === 'school' ? ' selected' : ''}>School</option><option value="public"${h.holiday_type === 'public' ? ' selected' : ''}>Public</option><option value="half-day"${h.holiday_type === 'half-day' ? ' selected' : ''}>Half Day</option></select></div>
                    <div class="form-group"><label>Description</label><input id="eh-desc" class="form-control" value="${esc(h.description || '')}"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-danger" onclick="window.deleteHoliday(${holidayId})">🗑️</button><button class="btn btn-outline" onclick="closeModal('edit-holiday-modal')">Cancel</button><button class="btn btn-primary" onclick="window._saveEditHoliday(${holidayId})">💾 Save</button></div></div></div>`);
            window._saveEditHoliday = async (id) => {
                const name = document.getElementById('eh-name')?.value.trim(); const date = document.getElementById('eh-date')?.value;
                if (!name || !date) { showToast('Name and date required', 'warning'); return; }
                const r = await apiRequest('holidays?id=eq.' + id, 'PATCH', { name, date, holiday_type: document.getElementById('eh-type')?.value, description: document.getElementById('eh-desc')?.value.trim() || null, updated_at: new Date().toISOString() });
                if (r.success) { closeModal('edit-holiday-modal'); showToast('✅ Holiday updated', 'success'); navigateTo('academic-calendar'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        /**
         * Delete a holiday.
         * @param {number} holidayId
         */
        async function deleteHoliday(holidayId) {
            if (!await confirmDialog('Delete this holiday?')) return;
            closeModal('edit-holiday-modal');
            const r = await apiRequest('holidays?id=eq.' + holidayId, 'DELETE');
            if (r.success) showToast('✅ Holiday deleted', 'success'); else showToast('Failed: ' + r.error, 'error');
            navigateTo('academic-calendar');
        }

        /**
         * Save a holiday (used if form is inline rather than modal).
         */
        async function saveHoliday() { openAddHolidayModal(); }

        /**
         * Export the holiday calendar to Excel.
         */
        async function exportHolidayCalendar() {
            let holidays = [];
            try { const r = await apiRequest('holidays?order=date.asc&limit=500'); holidays = r.success ? r.data : []; } catch (e) { }
            const rows = holidays.map(h => {
                const yr = state.academicYears.find(y => y.id === h.academic_year_id);
                return { 'Name': h.name, 'Date': fmtDate(h.date), 'Type': h.holiday_type || '—', 'Academic Year': yr?.name || '—', 'Description': h.description || '' };
            });
            exportToExcel(rows, 'Holiday_Calendar_' + new Date().toISOString().split('T')[0]); showToast('✅ Holiday calendar exported', 'success');
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK W — BACKUP & RESTORE
        // ════════════════════════════════════════════════════════════════════

        /**
         * Create a full data backup and offer download.
         */
        async function createFullBackup() {
            await ensureStateLoaded();
            showToast('⏳ Creating backup…', 'info', 3000);
            const tables = ['students', 'classes', 'subjects', 'teachers', 'terms', 'academicYears', 'assessments', 'marks', 'payments', 'studentFees', 'feeCategories', 'attendance', 'families', 'activityLogs', 'announcements'];
            const backup = { version: '9.0', created_at: new Date().toISOString(), school: state.schoolSettings?.school_name || 'ECOLE LA FONTAINE', data: {} };
            for (const table of tables) {
                const stateKey = table; const dbTable = table.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (state[stateKey]?.length) { backup.data[dbTable] = state[stateKey]; }
                else {
                    try { const r = await apiRequest(dbTable + '?limit=10000'); if (r.success) backup.data[dbTable] = r.data; } catch (e) { }
                }
            }
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'ELF_Backup_' + new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19) + '.json'; a.click();
            URL.revokeObjectURL(url);
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Created full backup', 'backup');
            showToast('✅ Backup downloaded', 'success');
        }

        /**
         * Download backup file (alias for createFullBackup with explicit download).
         */
        async function downloadBackupFile() { await createFullBackup(); }

        /**
         * Alias for createFullBackup + history rotation (called by doFullBackup button).
         */
        async function doFullBackupWithHistory() { await createFullBackup(); }

        /**
         * Read and preview a backup JSON file before restoring.
         */
        async function previewRestoreFile() {
            const fileInput = document.getElementById('restore-file'); if (!fileInput?.files[0]) { showToast('Select a backup file first', 'warning'); return; }
            const preview = document.getElementById('restore-preview'); if (!preview) return;
            try {
                const text = await fileInput.files[0].text();
                const data = JSON.parse(text);
                if (!data.version || !data.data) { showToast('Invalid backup file format', 'error'); return; }
                window._restoreData = data;
                const tableList = Object.keys(data.data).map(t => `<li><strong>${t}:</strong> ${data.data[t]?.length || 0} records</li>`).join('');
                preview.innerHTML = `<div class="alert alert-info"><strong>📦 Backup Preview</strong><br>Version: ${esc(data.version)}<br>Created: ${fmtDateTime(data.created_at)}<br>School: ${esc(data.school || '—')}</div>
                    <ul style="max-height:200px;overflow-y:auto;font-size:13px">${tableList}</ul>
                    <div class="alert alert-warning" style="margin-top:12px">⚠️ Restoring will OVERWRITE current data. This cannot be undone.</div>
                    <button class="btn btn-danger" style="margin-top:8px" onclick="window.confirmRestore()">🔄 Restore This Backup</button>`;
            } catch (e) { preview.innerHTML = '<div class="alert alert-danger">❌ Failed to read file: ' + e.message + '</div>'; }
        }

        /**
         * Confirm and execute the restore from the previewed backup data.
         */
        async function confirmRestore() {
            const data = window._restoreData;
            if (!data?.data) { showToast('No backup data loaded', 'warning'); return; }
            if (!await confirmDialog('⚠️ RESTORE BACKUP? This will overwrite all current data. Are you sure?')) return;
            if (!await confirmDialog('Final confirmation. This CANNOT be undone.')) return;

            showToast('⏳ Restoring backup…', 'info', 5000);
            // For safety, restore one table at a time via upsert where possible
            const tableMap = { 'students': 'students', 'classes': 'classes', 'subjects': 'subjects', 'teachers': 'teachers', 'payments': 'payments', 'student_fees': 'student_fees', 'fee_categories': 'fee_categories', 'attendance': 'attendance', 'activity_logs': 'activity_logs', 'announcements': 'announcements' };
            let restored = 0;
            for (const [tableName, records] of Object.entries(data.data || {})) {
                if (!Array.isArray(records) || !records.length) continue;
                // Batch insert by chunks of 100
                for (let i = 0; i < records.length; i += 100) {
                    const chunk = records.slice(i, i + 100);
                    try { const r = await apiRequest(tableName, 'POST', chunk); if (r.success) restored += chunk.length; } catch (e) { }
                }
            }
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'Restored backup: ' + data.created_at, 'backup');
            showToast('✅ Backup restored — ' + restored + ' records', 'success');
            window._restoreData = null;
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK X — PUSH NOTIFICATIONS (WebPush via VAPID)
        // ════════════════════════════════════════════════════════════════════

        /**
         * Subscribe the current device to push notifications.
         * Reads VAPID public key from school_settings, subscribes via the browser
         * PushManager, then saves the subscription endpoint to push_subscriptions table.
         */
        async function subscribeToPush() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                showToast('Push notifications not supported on this device', 'warning'); return;
            }
            await ensureStateLoaded();
            const vapidPublicKey = state.schoolSettings?.vapid_public_key;
            if (!vapidPublicKey) { showToast('VAPID public key not configured in school settings', 'error'); return; }

            try {
                const reg = await navigator.serviceWorker.ready;
                // Check for existing subscription
                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                    // Convert VAPID key from base64 to Uint8Array
                    const keyData = vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
                    const rawKey = atob(keyData); const keyArray = new Uint8Array(rawKey.length);
                    for (let i = 0; i < rawKey.length; i++) keyArray[i] = rawKey.charCodeAt(i);

                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: keyArray
                    });
                }

                // Save subscription to DB
                const subData = {
                    user_id: state.currentUser?.id || null,
                    username: state.currentUser?.username || state.currentUser?.name || '',
                    role: state.currentUser?.role || '',
                    endpoint: sub.endpoint,
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
                    device_ua: navigator.userAgent.substring(0, 200),
                    subscribed_at: new Date().toISOString(),
                    is_active: true,
                    updated_at: new Date().toISOString()
                };

                // Upsert: delete old + insert new by endpoint
                await apiRequest('push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), 'DELETE').catch(() => { });
                const r = await apiRequest('push_subscriptions', 'POST', subData);
                if (r.success) {
                    state._pushSubscribed = true;
                    showToast('✅ Push notifications enabled for this device', 'success');
                    await logActivity(state.currentUser?.id, state.currentUser?.role, 'Subscribed to push notifications', 'notifications');
                } else showToast('Failed to save subscription: ' + r.error, 'error');
            } catch (e) {
                console.error('Push subscribe error:', e);
                if (e.name === 'NotAllowedError') showToast('Notification permission denied. Enable it in browser settings.', 'error');
                else showToast('Failed to subscribe: ' + e.message, 'error');
            }
        }

        /**
         * Unsubscribe the current device from push notifications.
         */
        async function unsubscribeFromPush() {
            if (!('serviceWorker' in navigator)) return;
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    await apiRequest('push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), 'DELETE').catch(() => { });
                    await sub.unsubscribe();
                }
                state._pushSubscribed = false;
                showToast('✅ Push notifications disabled for this device', 'info');
            } catch (e) { showToast('Failed to unsubscribe: ' + e.message, 'error'); }
        }

        /**
         * Check if this device is currently subscribed to push.
         * Updates the UI subscription status indicator if present.
         */
        async function checkPushSubscriptionStatus() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                state._pushSubscribed = !!sub;
                const statusEl = document.getElementById('push-status');
                if (statusEl) statusEl.innerHTML = sub
                    ? '<span class="badge badge-success">✅ Notifications enabled on this device</span>'
                    : '<span class="badge badge-neutral">🔕 Not subscribed on this device</span>';
                const subBtn = document.getElementById('push-subscribe-btn');
                const unsubBtn = document.getElementById('push-unsubscribe-btn');
                if (subBtn) subBtn.style.display = sub ? 'none' : '';
                if (unsubBtn) unsubBtn.style.display = sub ? '' : 'none';
            } catch (e) { /* silently ignore */ }
        }

        /**
         * Send a test push notification to the current device.
         */
        async function sendTestPushNotification() {
            await ensureStateLoaded();
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            if (!reg) { showToast('Service worker not ready', 'error'); return; }
            // Trigger via Supabase Edge Function
            const SUPABASE_URL = state.schoolSettings?.supabase_url || localStorage.getItem('sb_url') || '';
            const SUPABASE_KEY = localStorage.getItem('sb_anon_key') || localStorage.getItem('sb_key') || '';
            try {
                const resp = await fetch(SUPABASE_URL + '/functions/v1/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
                    body: JSON.stringify({ user_ids: [state.currentUser?.id], title: 'Test Notification', body: 'Push notifications are working correctly!', url: '/' })
                });
                if (resp.ok) showToast('✅ Test notification sent — check your device', 'success');
                else showToast('Edge function returned: ' + resp.status, 'warning');
            } catch (e) { showToast('Failed to send test: ' + e.message, 'error'); }
        }

        // ════════════════════════════════════════════════════════════════════
        // BLOCK Y — MISC HELPERS (referenced but missing)
        // ════════════════════════════════════════════════════════════════════

        /**
         * Sort students alphabetically in the current view.
         */
        function sortStudentsAlphabetically() {
            state.students = [...state.students].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
            filterStudentList();
        }

        /**
         * Refresh the student fees view table.
         */
        async function refreshStudentFeesView() { await renderStudentFeesTable(); }

        /**
         * Refresh the balances view.
         */
        async function refreshBalancesView() { await renderBalancesTable(); }

        /**
         * Open a modal to record an absence for a single student.
         * @param {number} studentId
         */
        function markStudentAbsent(studentId) {
            const s = state.students.find(x => x.id === studentId); if (!s) return;
            const today = new Date().toISOString().split('T')[0];
            showModal(`<div class="modal-overlay" id="mark-absent-modal"><div class="modal modal-sm"><div class="modal-header"><h3>❌ Mark Absent — ${esc(s.first_name + ' ' + s.last_name)}</h3><button class="modal-close" onclick="closeModal('mark-absent-modal')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Date</label><input type="date" id="ma2-date" class="form-control" value="${today}"></div>
                    <div class="form-group"><label>Reason / Notes</label><input id="ma2-notes" class="form-control" placeholder="Optional"></div>
                </div>
                <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('mark-absent-modal')">Cancel</button><button class="btn btn-danger" onclick="window._doMarkAbsent(${studentId})">❌ Mark Absent</button></div></div></div>`);
            window._doMarkAbsent = async (sid) => {
                const date = document.getElementById('ma2-date')?.value; const notes = document.getElementById('ma2-notes')?.value;
                const cls = s.class_id;
                const r = await apiRequest('attendance', 'POST', { student_id: sid, class_id: cls, date, status: 'absent', notes, recorded_by: state.currentUser?.username || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
                if (r.success) { closeModal('mark-absent-modal'); showToast('✅ Absent recorded for ' + s.last_name, 'success'); }
                else showToast('Failed: ' + r.error, 'error');
            };
        }

        /**
         * Export fee report — generic alias used from various places.
         */
        async function exportFeeReport() { await exportStudentFeeBalances(); }

        /**
         * Print class list for a selected class.
         */
        function printClassList() {
            const classId = document.getElementById('sf-class')?.value;
            const cls = state.classes.find(c => String(c.id) === String(classId));
            let students = state.students || []; if (classId) students = students.filter(s => String(s.class_id) === classId && s.status === 'Active');
            students = [...students].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
            const rows = students.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.last_name)}</td><td>${esc(s.first_name)}</td><td>${esc(s.gender || '—')}</td><td>${esc(s.guardian_phone || '—')}</td></tr>`).join('');
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Class List — ${esc(cls?.name || 'All Classes')}</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;font-size:12px}th{background:#1a3a5c;color:#fff}</style></head>
            <body><h2>${esc(cls?.name || 'All Classes')} — Student List (${students.length})</h2>
            <table><thead><tr><th>#</th><th>Last Name</th><th>First Name</th><th>Gender</th><th>Guardian Phone</th></tr></thead><tbody>${rows}</tbody></table>
            <script>window.print();setTimeout(window.close,500);<\/script></body></html>`);
            w.document.close();
        }

        /**
         * Navigate to add student page.
         */
        function openAddStudentPage() { navigateTo('add-student'); }

        // ════════════════════════════════════════════════════════════════════
        // WINDOW EXPORTS — all missing functions exposed globally
        // ════════════════════════════════════════════════════════════════════
        window.refreshAssessmentList = refreshAssessmentList;
        window.filterLockAssessments = filterLockAssessments;
        window.toggleAssessmentLock = toggleAssessmentLock;
        window.openBulkLockModal = openBulkLockModal;
        window.saveAutoLockSettings = saveAutoLockSettings;
        window.executeAssessmentExport = executeAssessmentExport;
        window.resetExportForm = resetExportForm;
        window.loadClassTimetable = loadClassTimetable;
        window.exportClassTimetable = exportClassTimetable;
        window.printClassTimetable = printClassTimetable;
        window.openAddTimetableSlot = openAddTimetableSlot;
        window.openEditTimetableSlot = openEditTimetableSlot;
        window.deleteTimetableSlot = deleteTimetableSlot;
        window.detectAllConflicts = detectAllConflicts;
        window.exportConflictReport = exportConflictReport;
        window.filterConflicts = filterConflicts;
        window.resolveConflict = resolveConflict;
        window.downloadImportTemplate = downloadImportTemplate;
        window.previewTimetableImport = previewTimetableImport;
        window.executeTimetableImport = executeTimetableImport;
        window.loadAttendanceStudents = loadAttendanceStudents;
        window.updateAttSummary = updateAttSummary;
        window.markAllPresent = markAllPresent;
        window.markAllAbsent = markAllAbsent;
        window.saveAttendance = saveAttendance;
        window.exportAttendanceDay = exportAttendanceDay;
        window.toggleAttReportFields = toggleAttReportFields;
        window.generateAttReport = generateAttReport;
        window.printAttendanceReport = printAttendanceReport;
        window.exportAttReport = exportAttReport;
        window.downloadAttReportPDF = downloadAttReportPDF;
        window.filterStudentList = filterStudentList;
        window.renderStudentTable = renderStudentTable;
        window.exportStudentsData = exportStudentsData;
        window.viewStudentDetail = viewStudentDetail;
        window.openEditStudentModal = openEditStudentModal;
        window.submitEditStudent = submitEditStudent;
        window.deleteStudentPrompt = deleteStudentPrompt;
        window.restoreStudent = restoreStudent;
        window.permanentlyDeleteStudent = permanentlyDeleteStudent;
        window.runAutoArchive = runAutoArchive;
        window.previewBulkImport = previewBulkImport;
        window.executeBulkImport = executeBulkImport;
        window.updateBulkExportOptions = updateBulkExportOptions;
        window.executeBulkExport = executeBulkExport;
        window.resetBulkExportFilters = resetBulkExportFilters;
        window.showBulkTab = showBulkTab;
        window.loadBulkPayStudents = loadBulkPayStudents;
        window.selectAllBulkPay = selectAllBulkPay;
        window.downloadBulkPaymentTemplate = downloadBulkPaymentTemplate;
        window.importBulkPaymentExcel = importBulkPaymentExcel;
        window.processBulkPayments = processBulkPayments;
        window.applyBulkFeeToClass = applyBulkFeeToClass;
        window.previewBulkFee = previewBulkFee;
        window.previewBulkAdjustment = previewBulkAdjustment;
        window.executeBulkAdjustment = executeBulkAdjustment;
        window.previewBulkWaiver = previewBulkWaiver;
        window.applyBulkWaiver = applyBulkWaiver;
        window.renderStudentFeesTable = renderStudentFeesTable;
        window.exportStudentFeeBalances = exportStudentFeeBalances;
        window.printFeeReport = printFeeReport;
        window.openStudentFeeDetails = openStudentFeeDetails;
        window.filterPaymentHistoryTable = filterPaymentHistoryTable;
        window.exportFullPaymentHistory = exportFullPaymentHistory;
        window.filterReceipts = filterReceipts;
        window.renderFullReceiptsList = renderFullReceiptsList;
        window.bulkPrintReceipts = bulkPrintReceipts;
        window.exportReceiptsList = exportReceiptsList;
        window.printReceipt = printReceipt;
        window.saveReceiptSetting = saveReceiptSetting;
        window.previewReceiptSettings = previewReceiptSettings;
        window.filterReversalPayments = filterReversalPayments;
        window.exportReversalHistory = exportReversalHistory;
        window.reversePayment = reversePayment;
        window.viewReversalDetails = viewReversalDetails;
        window.openRecordPaymentForStudent = openRecordPaymentForStudent;
        window.openBulkPaymentModal = openBulkPaymentModal;
        window.exportBulkPaymentTemplate = exportBulkPaymentTemplate;
        window.loadStudentBalanceInfo = loadStudentBalanceInfo;
        window.toggleAdjustmentFields = toggleAdjustmentFields;
        window.submitManualAdjustment = submitManualAdjustment;
        window.resetAdjustmentForm = resetAdjustmentForm;
        window.loadAdjustmentHistory = loadAdjustmentHistory;
        window.refreshFeeAmounts = refreshFeeAmounts;
        window.openAddFeeCategory = openAddFeeCategory;
        window.createFeeCategory = createFeeCategory;
        window.openAddFeeAmount = openAddFeeAmount;
        window.openEditFeeCategory = openEditFeeCategory;
        window.saveEditFeeCategory = saveEditFeeCategory;
        window.updateFeeCategory = updateFeeCategory;
        window.openEditFeeAmount = openEditFeeAmount;
        window.saveEditFeeAmount = saveEditFeeAmount;
        window.deleteFeeCategory = deleteFeeCategory;
        window.exportFeeAmounts = exportFeeAmounts;
        window.showStructureTab = showStructureTab;
        window.openAddFeeCategoryModal = openAddFeeCategoryModal;
        window.editFeeCategory = editFeeCategory;
        window.copyFeeCategory = copyFeeCategory;
        window.exportFeeStructures = exportFeeStructures;
        window.openAddTemplateModal = openAddTemplateModal;
        window.saveFeeTemplate = saveFeeTemplate;
        window.loadClassOverrides = loadClassOverrides;
        window.openAddOverrideModal = openAddOverrideModal;
        window.updateOverrideDefaultAmount = updateOverrideDefaultAmount;
        window.createOverride = createOverride;
        window.editOverride = editOverride;
        window.deleteOverride = deleteOverride;
        window.viewTemplate = viewTemplate;
        window.deleteTemplate = deleteTemplate;
        window.renderFeeAssignmentsTable = renderFeeAssignmentsTable;
        window.openAssignFeeModal = openAssignFeeModal;
        window.exportFeeAssignments = exportFeeAssignments;
        window.editFeeAssignment = editFeeAssignment;
        window.deleteFeeAssignment = deleteFeeAssignment;
        window.bulkAssignToClass = bulkAssignToClass;
        window.openFullWaiverModal = openFullWaiverModal;
        window.submitFullWaiver = submitFullWaiver;
        window.removeWaiver = removeWaiver;
        window.renderFeeTermTable = renderFeeTermTable;
        window.exportFeeTermStatus = exportFeeTermStatus;
        window.printFeeTermStatus = printFeeTermStatus;
        window.showStudentTermDetails = showStudentTermDetails;
        window.exportFamilyFeeSummary = exportFamilyFeeSummary;
        window.refreshFamilySummary = refreshFamilySummary;
        window.filterFamilySummary = filterFamilySummary;
        window.renderBalancesTable = renderBalancesTable;
        window.exportBalancesToExcel = exportBalancesToExcel;
        window.printBalanceReport = printBalanceReport;
        window.exportAuditLog = exportAuditLog;
        window.refreshAuditLog = refreshAuditLog;
        window.filterAuditLog = filterAuditLog;
        window.viewAuditDetails = viewAuditDetails;
        window.showTeacherTab = showTeacherTab;
        window.openAddTeacherModal = openAddTeacherModal;
        window.exportTeachers = exportTeachers;
        window.editTeacher = editTeacher;
        window.deleteTeacher = deleteTeacher;
        window.toggleTeacherStatus = toggleTeacherStatus;
        window.resetTeacherPassword = resetTeacherPassword;
        window.showSubjectTab = showSubjectTab;
        window.openAddSubjectModal = openAddSubjectModal;
        window.openEditSubjectModal = openEditSubjectModal;
        window.deleteSubject = deleteSubject;
        window.exportSubjects = exportSubjects;
        window.openAddClassModal = openAddClassModal;
        window.editClass = editClass;
        window.updateClass = updateClass;
        window.deleteClass = deleteClass;
        window.moveClassUp = moveClassUp;
        window.moveClassDown = moveClassDown;
        window.exportClasses = exportClasses;
        window.importRwandaHolidays = importRwandaHolidays;
        window.openAddHolidayModal = openAddHolidayModal;
        window.editHoliday = editHoliday;
        window.deleteHoliday = deleteHoliday;
        window.saveHoliday = saveHoliday;
        window.exportHolidayCalendar = exportHolidayCalendar;
        window.createFullBackup = createFullBackup;
        window.downloadBackupFile = downloadBackupFile;
        window.doFullBackupWithHistory = doFullBackupWithHistory;
        window.previewRestoreFile = previewRestoreFile;
        window.confirmRestore = confirmRestore;
        window.subscribeToPush = subscribeToPush;
        window.unsubscribeFromPush = unsubscribeFromPush;
        window.checkPushSubscriptionStatus = checkPushSubscriptionStatus;
        window.sendTestPushNotification = sendTestPushNotification;
        window.sortStudentsAlphabetically = sortStudentsAlphabetically;
        window.refreshStudentFeesView = refreshStudentFeesView;
        window.refreshBalancesView = refreshBalancesView;
        window.markStudentAbsent = markStudentAbsent;
        window.exportFeeReport = exportFeeReport;
        window.printClassList = printClassList;
        window.openAddStudentPage = openAddStudentPage;

        console.log('✅ MISSING_FUNCTIONS_COMPLETE.js loaded — all functions registered.');



        // ════════════════════════════════════════════════════════════════════════
        // SECTION 99c — WINDOW EXPOSURE FOR ALL MISSING FUNCTIONS (Section 98)
