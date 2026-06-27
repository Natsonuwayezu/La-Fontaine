// js/patches/missing-functions.js
// Source lines: 24299–26284 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════

        // ── Dashboard helpers ─────────────────────────────────────────────────
        async function refreshAccountantDashboard() {
            await loadInitialData();
            renderAccountantDashboard(document.getElementById('dynamic-content'));
        }

        async function promptPromoteStudents() {
            openPromoteStudentsModal();
        }

        async function doFullBackup() {
            try {
                const backupData = {
                    version: '8.0', date: new Date().toISOString(),
                    students:    state.students,
                    teachers:    state.teachers,
                    classes:     state.classes,
                    subjects:    state.subjects,
                    terms:       state.terms,
                    assessments: state.assessments,
                    marks:       state.marks,
                    studentFees: state.studentFees,
                    payments:    state.payments,
                    feeCategories: state.feeCategories,
                    schoolSettings: state.schoolSettings
                };
                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const filename = `EcoleLaFontaine_Backup_${new Date().toISOString().split('T')[0]}.json`;
                downloadBlob(blob, filename, 'application/json');
                // Save to backup history
                const BACKUP_KEY = 'elf_backup_history';
                let history = [];
                try { history = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { history = []; }
                history.unshift({ date: new Date().toISOString(), type: 'manual', filename,
                    size: (blob.size / 1024).toFixed(1) + ' KB',
                    records: { students: state.students.length, marks: state.marks.length } });
                if (history.length > 30) history = history.slice(0, 30);
                localStorage.setItem(BACKUP_KEY, JSON.stringify(history));
                showToast('✅ Full backup downloaded successfully', 'success');
            } catch (e) { showToast('Backup failed: ' + e.message, 'error'); }
        }

        // ── Assessment helpers ────────────────────────────────────────────────
        async function viewAssessmentDetails(assessmentId) {
            const a = (state.assessments || []).find(x => x.id === assessmentId);
            if (!a) { showToast('Assessment not found', 'error'); return; }
            const cls = getClassById(a.class_id);
            const sub = getSubjectById(a.subject_id);
            const term = getTermById(a.term_id);
            const marks = (state.marks || []).filter(m => m.assessment_id === assessmentId);
            const scores = marks.map(m => m.score);
            const avg = scores.length ? (scores.reduce((s,v)=>s+v,0)/scores.length).toFixed(1) : '—';
            const pass = scores.length ? scores.filter(s=>(s/a.max_marks)*100>=50).length : 0;
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>📋 Assessment Details</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Name</label><input readonly value="${esc(a.assessment_name)}"></div>
                    <div class="form-group"><label>Type</label><input readonly value="${esc(a.assessment_type)}"></div>
                    <div class="form-group"><label>Class</label><input readonly value="${esc(cls?.name||'—')}"></div>
                    <div class="form-group"><label>Subject</label><input readonly value="${esc(sub?.name||'—')}"></div>
                    <div class="form-group"><label>Term</label><input readonly value="${esc(term?.name||'—')}"></div>
                    <div class="form-group"><label>Max Marks</label><input readonly value="${a.max_marks}"></div>
                    <div class="form-group"><label>Due Date</label><input readonly value="${fmtDate(a.due_date)}"></div>
                    <div class="form-group"><label>Status</label><input readonly value="${a.is_locked?'🔒 Locked':'✅ Open'}"></div>
                    <div class="form-group"><label>Marks Entered</label><input readonly value="${marks.length}"></div>
                    <div class="form-group"><label>Average Score</label><input readonly value="${avg}"></div>
                    <div class="form-group"><label>Pass Rate</label><input readonly value="${scores.length?(pass/scores.length*100).toFixed(0)+'%':'—'}"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-primary" onclick="closeModal();navigateTo('marks-entry')">✏️ Enter Marks</button>
                </div></div></div>`);
        }

        async function editAssessment(assessmentId) {
            const a = (state.assessments || []).find(x => x.id === assessmentId);
            if (!a) return;
            if (a.is_locked && !isAdmin()) { showToast('🔒 Assessment is locked', 'warning'); return; }
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>✏️ Edit Assessment</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group full"><label>Assessment Name *</label>
                        <input type="text" id="edit-assess-name" value="${esc(a.assessment_name)}"></div>
                    <div class="form-group"><label>Max Marks *</label>
                        <input type="number" id="edit-assess-max" value="${a.max_marks}" min="1" max="200"></div>
                    <div class="form-group"><label>Due Date</label>
                        <input type="date" id="edit-assess-due" value="${a.due_date||''}"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveEditAssessment(${assessmentId})">Save</button>
                </div></div></div>`);
        }

        async function saveEditAssessment(id) {
            const name = document.getElementById('edit-assess-name')?.value.trim();
            const max  = parseInt(document.getElementById('edit-assess-max')?.value);
            const due  = document.getElementById('edit-assess-due')?.value;
            if (!name || !max) { showToast('Name and max marks required', 'warning'); return; }
            await update('assessments', id, { assessment_name: name, max_marks: max, due_date: due||null });
            await refreshTable('assessments');
            closeModal();
            showToast('✅ Assessment updated', 'success');
            renderAssessments(document.getElementById('dynamic-content'));
        }

        async function lockAssessment(id) {
            const a = (state.assessments||[]).find(x=>x.id===id);
            if (!a) return;
            const newState = !a.is_locked;
            if (!await confirmDialog(`${newState?'Lock':'Unlock'} this assessment?`)) return;
            await update('assessments', id, { is_locked: newState });
            await refreshTable('assessments');
            showToast(`Assessment ${newState?'locked':'unlocked'}`, 'success');
            renderAssessments(document.getElementById('dynamic-content'));
        }

        function openCreateAssessmentModal() {
            const classes  = (state.classes||[]).filter(c=>c.is_active!==false);
            const subjects = (state.subjects||[]).filter(s=>s.is_active!==false);
            const terms    = (state.terms||[]).filter(t=>t.academic_year_id===state.currentAcadYear?.id);
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>➕ Create Assessment</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Class *</label><select id="new-assess-class">
                        ${classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Subject *</label><select id="new-assess-subject">
                        ${subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Term *</label><select id="new-assess-term">
                        ${terms.map(t=>`<option value="${t.id}" ${t.id===state.currentTerm?.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Type *</label><select id="new-assess-type">
                        <option>Quiz</option><option>Assignment</option><option>Mid-term</option>
                        <option>Exam</option><option>Final Exam</option></select></div>
                    <div class="form-group full"><label>Assessment Name</label>
                        <input type="text" id="new-assess-name" placeholder="Leave blank to auto-generate"></div>
                    <div class="form-group"><label>Max Marks *</label>
                        <input type="number" id="new-assess-max" value="50" min="1" max="200"></div>
                    <div class="form-group"><label>Due Date</label>
                        <input type="date" id="new-assess-due"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="createAssessmentFromModal()">Create</button>
                </div></div></div>`);
        }

        async function createAssessmentFromModal() {
            const classId   = parseInt(document.getElementById('new-assess-class')?.value);
            const subjectId = parseInt(document.getElementById('new-assess-subject')?.value);
            const termId    = parseInt(document.getElementById('new-assess-term')?.value);
            const type      = document.getElementById('new-assess-type')?.value;
            const nameVal   = document.getElementById('new-assess-name')?.value.trim();
            const max       = parseInt(document.getElementById('new-assess-max')?.value);
            const due       = document.getElementById('new-assess-due')?.value;
            const sub = getSubjectById(subjectId);
            const name = nameVal || `${type} — ${sub?.name||'Subject'}`;
            if (!classId||!subjectId||!termId||!max) { showToast('All required fields must be filled', 'warning'); return; }
            await insert('assessments', { class_id:classId, subject_id:subjectId, term_id:termId,
                assessment_type:type, assessment_name:name, max_marks:max, due_date:due||null,
                is_locked:false, created_by:getCurrentUser()?.id, created_at:new Date().toISOString() });
            await refreshTable('assessments');
            closeModal();
            showToast('✅ Assessment created', 'success');
            renderAssessments(document.getElementById('dynamic-content'));
        }

        function exportAssessmentsToExcel() {
            const data = (state.assessments||[]).map(a => ({
                'Class':       getClassById(a.class_id)?.name||'—',
                'Subject':     getSubjectById(a.subject_id)?.name||'—',
                'Assessment':  a.assessment_name,
                'Type':        a.assessment_type,
                'Max Marks':   a.max_marks,
                'Due Date':    fmtDate(a.due_date),
                'Status':      a.is_locked?'Locked':'Open',
                'Marks Entered': (state.marks||[]).filter(m=>m.assessment_id===a.id).length
            }));
            exportToExcel(data, 'Assessments_Export');
        }

        function filterAssessmentsTable() {
            const cls  = document.getElementById('assess-class-filter')?.value;
            const sub  = document.getElementById('assess-subject-filter')?.value;
            const term = document.getElementById('assess-term-filter')?.value;
            const srch = document.getElementById('assess-search')?.value?.toLowerCase();
            const rows = document.querySelectorAll('#assessments-table tbody tr');
            rows.forEach(row => {
                const txt = row.innerText.toLowerCase();
                const show = (!cls||row.dataset.class===cls) &&
                             (!sub||row.dataset.subject===sub) &&
                             (!term||row.dataset.term===term) &&
                             (!srch||txt.includes(srch));
                row.style.display = show ? '' : 'none';
            });
        }

        // ── Report Card helpers ───────────────────────────────────────────────
        function onReportTypeChange() {
            const type   = document.getElementById('report-type')?.value;
            const termEl = document.getElementById('report-term-group');
            if (termEl) termEl.style.display = type === 'annual' ? 'none' : 'block';
        }

        function onReportTermChange() {
            // Re-populate student list when term changes
            if (typeof loadReportStudents === 'function') loadReportStudents();
        }

        async function loadReportStudents() {
            const classId = document.getElementById('report-class')?.value;
            if (!classId) return;
            const students = sortStudentsByLastName(
                (state.students||[]).filter(s=>s.class_id==classId&&s.status==='Active')
            );
            const sel = document.getElementById('report-student');
            if (sel) {
                sel.innerHTML = '<option value="">— Select Student —</option>' +
                    students.map(s=>`<option value="${s.id}">${esc(s.last_name+' '+s.first_name)}</option>`).join('');
            }
        }

        async function generateReportCard() {
            const classId   = document.getElementById('report-class')?.value;
            const studentId = document.getElementById('report-student')?.value;
            const termId    = document.getElementById('report-term')?.value;
            const type      = document.getElementById('report-type')?.value || 'term';
            if (!classId||!studentId) { showToast('Select class and student', 'warning'); return; }
            const student = getStudentById(parseInt(studentId));
            const cls     = getClassById(parseInt(classId));
            const term    = getTermById(parseInt(termId));
            if (!student) { showToast('Student not found', 'error'); return; }
            const isNursery = (cls?.level||'').toLowerCase()==='nursery';
            const assessments = (state.assessments||[]).filter(a=>a.class_id==classId&&a.term_id==termId);
            const subjects    = (state.subjects||[]).filter(s=>(s.level||'').toLowerCase()===(cls?.level||'').toLowerCase()&&s.is_active!==false).sort((a,b)=>(a.sort_order||99)-(b.sort_order||99));
            const marks       = (state.marks||[]).filter(m=>assessments.map(a=>a.id).includes(m.assessment_id));
            let totTot=0, totMax=0;
            const subRows = subjects.map(sub => {
                const mgMax=sub.mg_max||50, exMax=sub.ex_max||50;
                const mgA=assessments.filter(a=>a.subject_id===sub.id&&!['Exam','Final Exam'].includes(a.assessment_type));
                const exA=assessments.filter(a=>a.subject_id===sub.id&&['Exam','Final Exam'].includes(a.assessment_type));
                const mgS=mgA.map(a=>marks.find(m=>m.assessment_id===a.id&&m.student_id===student.id)?.score).filter(v=>v!==undefined);
                const exS=exA.map(a=>marks.find(m=>m.assessment_id===a.id&&m.student_id===student.id)?.score).filter(v=>v!==undefined);
                let mg=mgS.length?((mgS.reduce((s,v)=>s+v,0)/mgA.reduce((s,a)=>s+a.max_marks,0))*mgMax):null;
                let ex=exS.length?((exS.reduce((s,v)=>s+v,0)/exA.reduce((s,a)=>s+a.max_marks,0))*exMax):null;
                const tot=(mg!==null||ex!==null)?(mg||0)+(ex||0):null;
                if(tot!==null){totTot+=tot;totMax+=(mgMax+exMax);}
                return {sub,mg,ex,tot,mgMax,exMax};
            });
            const pct  = totMax>0?(totTot/totMax)*100:null;
            const grade= pct!==null?getGrade(pct):'—';
            const school = state.schoolSettings||{};
            const rank = await calculateStudentRank(student.id, parseInt(classId));
            const empty = document.getElementById('report-card-empty');
            const content = document.getElementById('report-card-content');
            if (empty)   empty.style.display='none';
            if (content) { content.style.display='block'; content.innerHTML=buildReportCardHTML(student,cls,term,subRows,pct,grade,rank,school,isNursery,type); }
        }

        function buildReportCardHTML(student,cls,term,subRows,pct,grade,rank,school,isNursery,type) {
            const logo = school.school_logo?`<img src="${school.school_logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:('🏫');
            return `<div class="report-card" id="report-card">
                <div class="report-header">
                    <div class="report-logo">${logo}</div>
                    <div class="report-header-text">
                        <h2>${esc(school.school_name||'ECOLE LA FONTAINE')}</h2>
                        <p>${esc(school.school_address||'')}</p>
                        <h3>${type==='midterm'?'MID-TERM REPORT':'END OF TERM REPORT'} — ${esc(term?.name||'')}</h3>
                    </div>
                </div>
                <div class="report-info">
                    <div class="report-info-item"><strong>STUDENT NAME</strong>${esc(student.first_name+' '+student.last_name)}</div>
                    <div class="report-info-item"><strong>CLASS</strong>${esc(cls?.name||'—')}</div>
                    <div class="report-info-item"><strong>STUDENT CODE</strong>${esc(student.student_code||'—')}</div>
                    <div class="report-info-item"><strong>GENDER</strong>${esc(student.gender||'—')}</div>
                    <div class="report-info-item"><strong>ACADEMIC YEAR</strong>${esc(state.currentAcadYear?.name||'—')}</div>
                    <div class="report-info-item"><strong>DATE PRINTED</strong>${new Date().toLocaleDateString()}</div>
                </div>
                <table class="report-subjects">
                    <thead><tr>
                        <th>${isNursery?'MATIÈRE':'SUBJECT'}</th>
                        <th style="text-align:center">MG<br><small>/${subRows[0]?.mgMax||50}</small></th>
                        <th style="text-align:center">EX<br><small>/${subRows[0]?.exMax||50}</small></th>
                        <th style="text-align:center">TOT<br><small>/${(subRows[0]?.mgMax||50)+(subRows[0]?.exMax||50)}</small></th>
                        <th style="text-align:center">${isNursery?'COTE':'GRADE'}</th>
                    </tr></thead>
                    <tbody>${subRows.map(r=>`<tr>
                        <td><strong>${esc(r.sub.name)}</strong></td>
                        <td style="text-align:center">${r.mg!==null?r.mg.toFixed(1):'—'}</td>
                        <td style="text-align:center">${r.ex!==null?r.ex.toFixed(1):'—'}</td>
                        <td style="text-align:center;font-weight:700">${r.tot!==null?r.tot.toFixed(1):'—'}</td>
                        <td style="text-align:center"><span class="badge ${getGradeClass(r.tot&&r.tot/((r.mgMax+r.exMax))*100)}">${r.tot!==null?getGrade((r.tot/(r.mgMax+r.exMax))*100):'—'}</span></td>
                    </tr>`).join('')}</tbody>
                </table>
                <div class="report-summary">
                    <div><div class="summary-label">${isNursery?'TOTAL GÉNÉRAL':'GRAND TOTAL'}</div>
                        <div class="summary-value">${pct!==null?(pct.toFixed(1)+'%'):'—'}</div></div>
                    <div><div class="summary-label">${isNursery?'COTE':'GRADE'}</div>
                        <div class="summary-value">${grade}</div></div>
                    <div><div class="summary-label">${isNursery?'RANG':'RANK'}</div>
                        <div class="summary-value">${rank}</div></div>
                </div>
                <div class="report-footer">
                    ${(() => {
                        // Configurable pass mark from settings (default 50)
                        const passMark   = parseFloat(state.schoolSettings?.pass_mark || 50);
                        const promotionMark = parseFloat(state.schoolSettings?.promotion_mark || state.schoolSettings?.pass_mark || 50);
                        const passed     = pct !== null && pct >= promotionMark;
                        const decision   = pct === null ? '' :
                            passed
                                ? `<div style="margin:12px 0;padding:10px 16px;background:#d1fae5;border-radius:8px;text-align:center;font-weight:700;color:#065f46;font-size:.95rem">
                                    ✅ ${isNursery ? 'ADMIS(E) EN CLASSE SUPÉRIEURE' : 'PROMOTED TO NEXT CLASS'}
                                   </div>`
                                : `<div style="margin:12px 0;padding:10px 16px;background:#fee2e2;border-radius:8px;text-align:center;font-weight:700;color:#991b1b;font-size:.95rem">
                                    ⚠️ ${isNursery
                                        ? 'DOIT SUIVRE LES COURS DE RATTRAPAGE DES VACANCES POUR UNE DEUXIÈME SESSION'
                                        : 'MUST ATTEND HOLIDAY REMEDIAL COURSES TO SIT FOR SECOND SITTING'}
                                   </div>`;
                        return decision;
                    })()}
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;margin-top:12px">
                        <div><strong>${isNursery?"Signature de l'enseignant(e)":'Teacher Signature'}</strong><br>
                            <div style="margin-top:24px;border-top:1px solid #ccc;padding-top:4px">${esc(school.school_name||'')}</div></div>
                        <div><strong>${isNursery?"Cachet de l'école":'School Stamp'}</strong><br>
                            <div style="margin-top:40px"></div></div>
                        <div><strong>${isNursery?"Signature du/de la directeur(trice)":'Head Teacher Signature'}</strong><br>
                            <div style="margin-top:24px;border-top:1px solid #ccc;padding-top:4px">${esc(school.head_teacher||'')}</div></div>
                    </div>
                    ${school.school_motto?`<p style="text-align:center;margin-top:12px;font-style:italic">"${esc(school.school_motto)}"</p>`:''}
                </div>
            </div>`;
        }

        function printReportCard() {
            const card = document.getElementById('report-card');
            if (!card) { showToast('Generate a report first', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Report Card</title>
                <style>body{font-family:Arial,sans-serif;padding:20px}
                .report-card{max-width:700px;margin:0 auto;border:2px solid #1a3a5c;border-radius:8px;padding:24px}
                .report-header{display:flex;align-items:center;gap:20px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a3a5c}
                .report-logo{width:80px;height:80px;border-radius:50%;background:#f0f4ff;display:flex;align-items:center;justify-content:center;font-size:2.5rem;overflow:hidden}
                .report-header-text h2{color:#1a3a5c;margin:0;font-size:1.1rem}
                .report-header-text h3{font-size:.9rem;margin:4px 0 0}
                .report-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:12px}
                .report-info-item{font-size:.8rem}.report-info-item strong{display:block;color:#64748b;font-size:.7rem;text-transform:uppercase}
                .report-subjects{width:100%;border-collapse:collapse;margin:8px 0;font-size:.82rem}
                .report-subjects th{background:#1a3a5c;color:#fff;padding:7px;text-align:left}
                .report-subjects td{padding:5px 7px;border:1px solid #e2e8f0}
                .report-subjects tr:nth-child(even){background:#f8fafc}
                .report-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#f0fdf4;padding:14px;border-radius:6px;margin:12px 0;text-align:center}
                .summary-label{font-size:.7rem;color:#64748b;font-weight:600;text-transform:uppercase}
                .summary-value{font-size:1.1rem;font-weight:700;color:#1a3a5c}
                .report-footer{padding:12px;border-top:2px solid #1a3a5c;margin-top:16px;font-size:.8rem}
                .badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:.75rem}
                .grade-Ap,.grade-A{background:#d1fae5;color:#065f46}.grade-B{background:#dbeafe;color:#1e40af}
                .grade-C{background:#fef3c7;color:#92400e}.grade-D{background:#ffedd5;color:#c2410c}
                .grade-F{background:#fee2e2;color:#991b1b}
                @media print{body{padding:0}button{display:none}}</style></head>
                <body>${card.outerHTML}</body></html>`);
            w.document.close();
            w.onload = () => w.print();
        }

        async function exportReportPDF() {
            showToast('💾 Preparing report for download…', 'info');
            const card = document.getElementById('report-card');
            if (!card) { showToast('Generate a report first', 'warning'); return; }
            const html = `<!DOCTYPE html><html><head><title>Report Card</title>
                <style>body{font-family:Arial,sans-serif;padding:20px}</style></head>
                <body>${card.outerHTML}</body></html>`;
            downloadBlob(html, `ReportCard_${new Date().toISOString().split('T')[0]}.html`, 'text/html');
            showToast('✅ Report card downloaded as HTML', 'success');
        }

        async function generateAllReports() {
            const classId = document.getElementById('report-class')?.value;
            if (!classId) { showToast('Select a class first', 'warning'); return; }
            const students = sortStudentsByLastName((state.students||[]).filter(s=>s.class_id==classId&&s.status==='Active'));
            if (!students.length) { showToast('No students found', 'warning'); return; }
            showToast(`📄 Generating ${students.length} report cards…`, 'info');
            const allHtml = [];
            for (const st of students) {
                document.getElementById('report-student').value = st.id;
                await generateReportCard();
                const card = document.getElementById('report-card');
                if (card) allHtml.push(card.outerHTML+'<div style="page-break-after:always"></div>');
            }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>All Reports</title>
                <style>body{font-family:Arial,sans-serif}
                .report-card{max-width:700px;margin:0 auto 20px;border:2px solid #1a3a5c;padding:20px}
                @media print{.report-card{page-break-inside:avoid}}</style></head>
                <body>${allHtml.join('')}</body></html>`);
            w.document.close();
            w.onload = () => w.print();
        }

        // ── Grading Scale helpers ─────────────────────────────────────────────
        /**
         * Save the grading scale from the table in renderGradingSettings.
         * Reads grade-name-N, grade-min-N, grade-max-N, grade-desc-N, grade-color-N inputs.
         * Also saves the promotion mark setting.
         * After saving, immediately refreshes state.gradingScale so getGrade() is up-to-date.
         */
        async function saveGradingScale() {
            // Determine how many grade rows exist
            const grades = state.gradingScale || DEFAULT_GRADES;
            let saved = 0;

            for (let i = 0; i < grades.length + 5; i++) {
                const gradeEl = document.getElementById(`grade-name-${i}`);
                if (!gradeEl) break;  // No more rows
                const grade  = gradeEl.value?.trim();
                const minPct = parseInt(document.getElementById(`grade-min-${i}`)?.value);
                const maxPct = parseInt(document.getElementById(`grade-max-${i}`)?.value);
                const desc   = document.getElementById(`grade-desc-${i}`)?.value?.trim() || '';
                const color  = document.getElementById(`grade-color-${i}`)?.value || '#d1fae5';
                const order  = parseInt(document.getElementById(`grade-order-${i}`)?.value) || i + 1;
                if (!grade || isNaN(minPct) || isNaN(maxPct)) continue;

                const existing = grades[i];
                if (existing?.id) {
                    await update('grading_scale', existing.id, {
                        grade, min_percentage: minPct, max_percentage: maxPct,
                        description: desc, color, sort_order: order
                    });
                } else {
                    await insert('grading_scale', {
                        grade, min_percentage: minPct, max_percentage: maxPct,
                        description: desc, color, sort_order: order,
                        created_at: new Date().toISOString()
                    });
                }
                saved++;
            }

            // Save promotion mark if present
            const pmEl = document.getElementById('setting-promotion-mark')
                      || document.getElementById('setting-pass-mark');
            if (pmEl) await updateSchoolSetting('promotion_mark', pmEl.value);
            const passEl = document.getElementById('setting-pass-mark');
            if (passEl) await updateSchoolSetting('pass_mark', passEl.value);

            // Immediately refresh so getGrade() uses the new scale
            await refreshTable('grading_scale');
            state.schoolSettings = await getSchoolSettings();

            showToast(`✅ Saved ${saved} grade levels`, 'success');
            renderGradingSettings(document.getElementById('dynamic-content'));
        }

        async function resetGradingScale() {
            if (!await confirmDialog('Reset to default grading scale? This will overwrite your current scale.')) return;
            await removeWhere('grading_scale', 'id=gt.0');
            for (const g of DEFAULT_GRADES) {
                await insert('grading_scale', { grade:g.grade, min_percentage:g.min, max_percentage:g.max, description:g.desc, color:g.color, sort_order:g.sort_order });
            }
            await refreshTable('grading_scale');
            showToast('✅ Grading scale reset to defaults', 'success');
            renderGradingSettings(document.getElementById('dynamic-content'));
        }

        // ── Finance export helpers ────────────────────────────────────────────
        function exportFinancialReportData() {
            const tbody = document.querySelector('#financial-report-table tbody');
            if (!tbody) { showToast('No report data to export', 'warning'); return; }
            const rows = Array.from(tbody.querySelectorAll('tr')).map(tr =>
                Array.from(tr.querySelectorAll('td')).map(td => td.innerText)
            );
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Financial Report');
            XLSX.writeFile(wb, `Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Report exported', 'success');
        }

        function printFinancialReport() {
            const content = document.getElementById('financial-report-content');
            if (!content) { showToast('No report to print', 'warning'); return; }
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Financial Report</title>
                <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px}th{background:#1a3a5c;color:#fff}
                h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Financial Report</h2>
                <p style="text-align:center">${new Date().toLocaleDateString()}</p>
                ${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }

        function exportClassBreakdown() {
            const data = (state.classes||[]).filter(c=>c.is_active!==false).map(cls => {
                const students = (state.students||[]).filter(s=>s.class_id===cls.id&&s.status==='Active');
                const fees = (state.studentFees||[]).filter(f=>students.some(s=>s.id===f.student_id)&&!f.is_waived&&!f.is_credit);
                const total = fees.reduce((s,f)=>s+(f.amount||0),0);
                const paid  = fees.reduce((s,f)=>s+(f.paid_amount||0),0);
                return { 'Class':cls.name, 'Students':students.length, 'Total Fees':total, 'Paid':paid, 'Balance':Math.max(0,total-paid), 'Collection %':total>0?((paid/total)*100).toFixed(1)+'%':'0%' };
            });
            exportToExcel(data, 'Class_Fee_Breakdown');
        }

        function exportCategoryBreakdown() {
            const data = (state.feeCategories||[]).map(cat => {
                const fees = (state.studentFees||[]).filter(f=>f.fee_category_id===cat.id&&!f.is_waived&&!f.is_credit);
                const total = fees.reduce((s,f)=>s+(f.amount||0),0);
                const paid  = fees.reduce((s,f)=>s+(f.paid_amount||0),0);
                return { 'Category':cat.name, 'Students':fees.length, 'Total':total, 'Paid':paid, 'Balance':Math.max(0,total-paid) };
            });
            exportToExcel(data, 'Fee_Category_Breakdown');
        }

        async function exportTopPayers() {
            const activeStudents = (state.students||[]).filter(s=>s.status==='Active');
            const students = [];
            for (const s of activeStudents) {
                const b = await getFullStudentBalance(s.id);
                students.push({ id:s.id, name:`${s.first_name} ${s.last_name}`, paid:b.paid, total:b.total, pct:b.pct });
            }
            students.sort((a,b)=>b.paid-a.paid);
            const top = students.slice(0,50);
            const data = top.map((s,i) => ({ 'Rank':i+1, 'Student':s.name, 'Amount Paid':s.paid, 'Total Fees':s.total, 'Collection %':s.pct.toFixed(1)+'%' }));
            exportToExcel(data, 'Top_Payers');
        }

        function exportMonthlyTrend() {
            const monthly = {};
            (state.payments||[]).forEach(p => {
                const m = (p.payment_date||p.created_at||'').slice(0,7);
                if (m) monthly[m] = (monthly[m]||0)+p.amount;
            });
            const data = Object.entries(monthly).sort().map(([month,amount]) => ({ 'Month':month, 'Total Collected':amount }));
            exportToExcel(data, 'Monthly_Collection_Trend');
        }

        function exportClassCollection() {
            exportClassBreakdown();
        }

        function exportCreditBalances() {
            const data = (state.students||[]).filter(s=>s.status==='Active').map(s => {
                const credit = getStudentCreditBalance(s.id);
                return credit.total>0 ? { 'Student':`${s.first_name} ${s.last_name}`, 'Code':s.student_code||'—', 'Class':getClassById(s.class_id)?.name||'—', 'Credit Total':credit.total, 'Credit Used':credit.used, 'Available Credit':credit.available } : null;
            }).filter(Boolean);
            if (!data.length) { showToast('No credit balances found', 'info'); return; }
            exportToExcel(data, 'Credit_Balances');
        }

        async function renderCreditTable() {
            const filter = document.getElementById('credit-filter')?.value||'';
            let students = (state.students||[]).filter(s=>s.status==='Active');
            if (filter) students = students.filter(s=>s.class_id==filter);
            const tbody = document.getElementById('credit-table-body');
            if (!tbody) return;
            const rows = students.map(s => {
                const cr = getStudentCreditBalance(s.id);
                if (cr.total===0 && cr.available===0) return '';
                return `<tr><td>${esc(s.first_name+' '+s.last_name)}</td>
                    <td>${esc(getClassById(s.class_id)?.name||'—')}</td>
                    <td>${fmtCurrency(cr.total)}</td><td>${fmtCurrency(cr.used)}</td>
                    <td><strong>${fmtCurrency(cr.available)}</strong></td>
                    <td><button class="btn btn-sm btn-outline" onclick="navigateToWithData('student-details',{studentId:${s.id}})">👁️</button></td></tr>`;
            }).filter(Boolean).join('');
            tbody.innerHTML = rows||'<tr><td colspan="6" style="text-align:center">No credit balances</td></tr>';
        }

        // ── Carry Forward helpers ─────────────────────────────────────────────
        async function previewCarryForward() {
            const fromTerm = document.getElementById('carry-from-term')?.value;
            const toTerm   = document.getElementById('carry-to-term')?.value;
            if (!fromTerm||!toTerm||fromTerm===toTerm) { showToast('Select different from/to terms', 'warning'); return; }
            const fromFees = (state.studentFees||[]).filter(f=>f.term_id==fromTerm&&!f.is_waived&&!f.is_credit&&!f.manually_deleted);
            const preview  = fromFees.map(f => {
                const s = getStudentById(f.student_id);
                const balance = Math.max(0, (f.amount||0)-(f.paid_amount||0));
                return balance>0 ? { student:s, fee:f, balance } : null;
            }).filter(Boolean);
            window._carryPreviewData = preview;
            const tbody = document.getElementById('carry-preview-tbody');
            if (!tbody) return;
            tbody.innerHTML = preview.length ? preview.map(p=>`<tr>
                <td>${esc(p.student?`${p.student.first_name} ${p.student.last_name}`:'—')}</td>
                <td>${esc(getClassById(p.student?.class_id)?.name||'—')}</td>
                <td>${fmtCurrency(p.fee.amount)}</td><td>${fmtCurrency(p.fee.paid_amount||0)}</td>
                <td>${fmtCurrency(p.balance)}</td></tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center">No outstanding balances to carry forward</td></tr>';
            document.getElementById('carry-preview-section')?.style?.setProperty('display','block');
        }

        async function executeCarryForward() {
            const preview = window._carryPreviewData||[];
            const toTerm  = document.getElementById('carry-to-term')?.value;
            if (!preview.length||!toTerm) { showToast('Run preview first', 'warning'); return; }
            if (!await confirmDialog(`Carry forward ${preview.length} unpaid balances to the selected term?`)) return;
            let done=0;
            for (const p of preview) {
                await insert('student_fees', { student_id:p.student?.id, fee_category_id:p.fee.fee_category_id,
                    term_id:parseInt(toTerm), academic_year_id:state.currentAcadYear?.id,
                    amount:p.balance, paid_amount:0, is_paid:false, is_waived:false,
                    notes:`Carried forward from term ${p.fee.term_id}`, created_at:new Date().toISOString() });
                done++;
            }
            await refreshTable('student_fees');
            window._carryPreviewData=[];
            showToast(`✅ Carried forward ${done} balances`, 'success');
            renderCarryForward(document.getElementById('dynamic-content'));
        }

        function exportCarryPreview() {
            const preview = window._carryPreviewData||[];
            if (!preview.length) { showToast('Run preview first', 'warning'); return; }
            const data = preview.map(p=>({
                'Student':p.student?`${p.student.first_name} ${p.student.last_name}`:'—',
                'Class':getClassById(p.student?.class_id)?.name||'—',
                'Total Fee':p.fee.amount, 'Paid':p.fee.paid_amount||0, 'Balance':p.balance
            }));
            exportToExcel(data, 'Carry_Forward_Preview');
        }

        async function loadCarryHistory() {
            const div = document.getElementById('carry-history-content');
            if (!div) return;
            const fees = (state.studentFees||[]).filter(f=>(f.notes||'').includes('Carried forward'));
            if (!fees.length) { div.innerHTML='<div class="alert alert-info">No carry-forward history found</div>'; return; }
            div.innerHTML = `<table class="data-table"><thead><tr>
                <th>Student</th><th>Amount</th><th>Notes</th><th>Date</th></tr></thead>
                <tbody>${fees.map(f=>{const s=getStudentById(f.student_id);return `<tr>
                    <td>${esc(s?`${s.first_name} ${s.last_name}`:'—')}</td>
                    <td>${fmtCurrency(f.amount)}</td><td>${esc(f.notes||'—')}</td>
                    <td>${fmtDate(f.created_at)}</td></tr>`;}).join('')}</tbody></table>`;
        }

        // ── Statistics helpers ────────────────────────────────────────────────
        async function loadStatisticsData() {
            renderStatistics(document.getElementById('dynamic-content'));
        }

        function exportStatisticsData() {
            const classes = (state.classes||[]).filter(c=>c.is_active!==false);
            const data = classes.map(cls => {
                const students   = (state.students||[]).filter(s=>s.class_id===cls.id&&s.status==='Active');
                const assessments= (state.assessments||[]).filter(a=>a.class_id===cls.id&&a.term_id===state.currentTerm?.id);
                const aIds       = assessments.map(a=>a.id);
                const marks      = (state.marks||[]).filter(m=>aIds.includes(m.assessment_id));
                const pcts       = marks.map(m=>{const a=assessments.find(x=>x.id===m.assessment_id);return a?(m.score/a.max_marks)*100:null;}).filter(Boolean);
                const avg        = pcts.length?pcts.reduce((s,v)=>s+v,0)/pcts.length:null;
                return { 'Class':cls.name, 'Students':students.length, 'Assessments':assessments.length,
                    'Marks Entered':marks.length, 'Average %':avg?avg.toFixed(1)+'%':'—',
                    'Grade':avg?getGrade(avg):'—', 'Pass Rate %':avg?(pcts.filter(p=>p>=50).length/pcts.length*100).toFixed(1)+'%':'—' };
            });
            exportToExcel(data, 'Class_Statistics');
        }

        function printStatisticsReport() {
            const content = document.getElementById('statistics-content')||document.getElementById('dynamic-content');
            if (!content) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Statistics Report</title>
                <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px}th{background:#1a3a5c;color:#fff}
                h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Statistics Report</h2>
                <p style="text-align:center">${new Date().toLocaleDateString()}</p>
                ${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }

        // ── Rankings export/load helpers ──────────────────────────────────────
        async function loadRankings() {
            const classId = document.getElementById('rank-class')?.value;
            const termId  = document.getElementById('rank-term')?.value;
            if (!classId) { showToast('Select a class', 'warning'); return; }
            const div = document.getElementById('rankings-content');
            if (!div) return;
            div.innerHTML='<div class="loading-container"><div class="spinner"></div><p>Calculating...</p></div>';
            const ranked = calculateClassRanks(parseInt(classId), parseInt(termId));
            if (!ranked.length) { div.innerHTML='<div class="alert alert-info">No ranked students — enter marks first.</div>'; return; }
            const avg  = ranked.reduce((s,r)=>s+r.percentage,0)/ranked.length;
            const pass = ranked.filter(r=>r.percentage>=50).length;
            div.innerHTML = `
                <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
                    <div class="stat-card stat-blue"><div class="stat-body"><div class="stat-value">${ranked.length}</div><div class="stat-label">Students Ranked</div></div></div>
                    <div class="stat-card stat-green"><div class="stat-body"><div class="stat-value">${avg.toFixed(1)}%</div><div class="stat-label">Class Average</div></div></div>
                    <div class="stat-card stat-purple"><div class="stat-body"><div class="stat-value">${pass}</div><div class="stat-label">Passed</div></div></div>
                    <div class="stat-card stat-orange"><div class="stat-body"><div class="stat-value">${ranked.length-pass}</div><div class="stat-label">Below 50%</div></div></div>
                </div>
                <div class="table-wrapper"><table class="data-table">
                    <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>%</th><th>Grade</th></tr></thead>
                    <tbody>${ranked.map(r=>`<tr>
                        <td style="text-align:center;font-weight:700">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</td>
                        <td>${esc(r.name)}</td>
                        <td style="text-align:center">${r.totalScore.toFixed(1)}/${r.totalMax}</td>
                        <td><span class="badge ${getGradeClass(r.percentage)}">${r.percentage.toFixed(1)}%</span></td>
                        <td><span class="badge ${getGradeClass(r.percentage)}">${getGrade(r.percentage)}</span></td>
                    </tr>`).join('')}</tbody>
                </table></div>`;
        }

        function exportRankingsToExcel() {
            const classId = document.getElementById('rank-class')?.value;
            const termId  = document.getElementById('rank-term')?.value;
            if (!classId) { showToast('Select a class', 'warning'); return; }
            const ranked = calculateClassRanks(parseInt(classId), parseInt(termId));
            const data   = ranked.map(r=>({ 'Rank':r.rank, 'Student':r.name, 'Score':r.totalScore.toFixed(1), 'Out of':r.totalMax, '%':r.percentage.toFixed(1)+'%', 'Grade':getGrade(r.percentage) }));
            exportToExcel(data, `Rankings_${getClassById(classId)?.name||'class'}_${new Date().toISOString().split('T')[0]}`);
        }

        // ── Annual Register helpers ───────────────────────────────────────────

        /**
         * Renders the combined three-term annual register for a class into `container`.
         * Shows, for each student: per-term MG/EX per subject, term totals, the annual
         * grand total (G-TOT), overall %, grade, and rank — using the same calculation
         * engine as report cards (generateSingleReport) so figures always match.
         */
        async function renderCRTableAnnual(cls, isNursery, container) {
            if (!cls) { container.innerHTML = '<div class="alert alert-info">Select a class to view the annual register</div>'; return; }
            const students = state.students.filter(s => s.class_id == cls.id && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
            if (!students.length) { container.innerHTML = '<div class="alert alert-info">No active students in this class</div>'; return; }

            // Generate the annual report data for every student (reuses report-card logic)
            const results = [];
            for (const student of students) {
                try {
                    const data = await generateSingleReport(student.id, cls.id, 'annual', null);
                    results.push(data);
                } catch (e) { console.warn('[Annual Register] Failed for student', student.id, e); }
            }
            if (!results.length) { container.innerHTML = '<div class="alert alert-warning">No marks available for this class yet</div>'; return; }

            // Subjects + terms come from the first student's result (same for whole class)
            const subjects = results[0].subjects;
            const terms = results[0].termsToProcess;

            // ── Header rows ──
            const termHeader = '<tr><th class="cr-col-rank">#</th><th class="cr-col-name">Student Name</th>'
                + terms.map(t => '<th colspan="' + (subjects.length * 2 + 1) + '" style="text-align:center">' + esc(t.name) + '</th>').join('')
                + '<th colspan="3" style="text-align:center">Annual</th></tr>';
            const subjectHeader = '<tr><th class="cr-col-rank"></th><th class="cr-col-name"></th>'
                + terms.map(() => subjects.map(s => '<th colspan="2" style="text-align:center;font-size:10px">' + esc(s.code || s.name) + '</th>').join('') + '<th style="text-align:center;font-size:10px">T-TOT</th>').join('')
                + '<th style="text-align:center">G-TOT</th><th style="text-align:center">%</th><th style="text-align:center">Grade</th></tr>';
            const mgExHeader = '<tr><th class="cr-col-rank"></th><th class="cr-col-name"></th>'
                + terms.map(() => subjects.map(() => '<th style="text-align:center;font-size:9px">MG</th><th style="text-align:center;font-size:9px">EX</th>').join('') + '<th></th>').join('')
                + '<th></th><th></th><th></th></tr>';

            // ── Body rows ──
            // Sort by overall percentage (descending) for ranking, since each result already has .rank
            const sorted = [...results].sort((a, b) => (a.rank || 999) - (b.rank || 999));
            const bodyRows = sorted.map(r => {
                let row = '<td class="cr-col-rank">' + (r.rank || '—') + '</td><td class="cr-col-name"><strong>' + esc(r.student.first_name) + ' ' + esc(r.student.last_name) + '</strong></td>';
                for (const t of terms) {
                    const ts = r.termScores[t.id];
                    for (const subj of subjects) {
                        const sc = ts.subjects[subj.id];
                        const mg = sc?.mg !== null && sc?.mg !== undefined ? sc.mg.toFixed(1) : '—';
                        const ex = sc?.ex !== null && sc?.ex !== undefined ? sc.ex.toFixed(1) : '—';
                        row += '<td style="text-align:center">' + mg + '</td><td style="text-align:center">' + ex + '</td>';
                    }
                    row += '<td style="text-align:right;font-weight:600">' + ts.totals.total.toFixed(1) + '</td>';
                }
                row += '<td style="text-align:right;font-weight:700">' + r.annualTotalScore.toFixed(1) + ' / ' + r.annualTotalMax + '</td>';
                row += '<td style="text-align:center"><span class="badge ' + getGradeClass(r.overallPercentage) + '">' + r.overallPercentage.toFixed(1) + '%</span></td>';
                row += '<td style="text-align:center">' + r.overallGrade + '</td>';
                return '<tr>' + row + '</tr>';
            }).join('');

            container.innerHTML = '<div class="cr-table-wrapper"><table class="data-table cr-table cr-table-annual" id="cr-table"><thead>' + termHeader + subjectHeader + mgExHeader + '</thead><tbody>' + bodyRows + '</tbody></table></div>';
        }

        async function loadAnnualRegister() {
            const classId = document.getElementById('annual-class')?.value;
            if (!classId) return;
            const cls  = getClassById(parseInt(classId));
            const body = document.getElementById('annual-register-container');
            if (!body) return;
            body.innerHTML='<div class="loading-container"><div class="spinner"></div></div>';
            await renderCRTableAnnual(cls, (cls?.level||'').toLowerCase()==='nursery', body);
        }

        function exportAnnualRegister() {
            const table = document.querySelector('#annual-register-container table');
            if (!table) { showToast('No data', 'warning'); return; }
            const ws = XLSX.utils.table_to_sheet(table);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Annual');
            XLSX.writeFile(wb, `AnnualRegister_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Exported', 'success');
        }

        function printAnnualRegister() {
            const c = document.getElementById('annual-register-container');
            if (!c) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Annual Register</title>
                <style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%;font-size:10px}
                th,td{border:1px solid #ccc;padding:5px}th{background:#1a3a5c;color:#fff}
                h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Annual Register</h2>
                <p style="text-align:center">${new Date().toLocaleDateString()}</p>
                ${c.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }

        function exportMarksAnalysis() {
            loadAnalysisData().then(() => {
                const table = document.querySelector('#analysis-content table');
                if (!table) { showToast('Run analysis first', 'warning'); return; }
                const ws = XLSX.utils.table_to_sheet(table);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Marks Analysis');
                XLSX.writeFile(wb, `Marks_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
                showToast('✅ Exported', 'success');
            });
        }

        function printMarksAnalysis() {
            const content = document.getElementById('analysis-content');
            if (!content) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Marks Analysis</title>
                <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}
                th,td{border:1px solid #ccc;padding:7px}th{background:#1a3a5c;color:#fff}
                h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Marks Analysis</h2>
                <p style="text-align:center">${new Date().toLocaleDateString()}</p>
                ${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }

        // ── Analytics Export ──────────────────────────────────────────────────
        function exportAnalyticsReport() {
            const content = document.getElementById('analytics-content')||document.getElementById('dynamic-content');
            const tables  = content?.querySelectorAll('table');
            if (!tables?.length) { showToast('No analytics data to export', 'warning'); return; }
            const wb = XLSX.utils.book_new();
            tables.forEach((table, i) => {
                const ws = XLSX.utils.table_to_sheet(table);
                XLSX.utils.book_append_sheet(wb, ws, `Analytics_${i+1}`);
            });
            XLSX.writeFile(wb, `Analytics_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Analytics report exported', 'success');
        }

        // ── Student enrollment / detail helpers ───────────────────────────────
        async function submitEnrollStudent() {
            const f = id => document.getElementById(id)?.value?.trim();
            const required = ['enroll-firstname','enroll-lastname','enroll-class'];
            for (const r of required) { if (!f(r)) { showToast(`${r.replace('enroll-','')} is required`, 'warning'); return; } }
            const classId = parseInt(f('enroll-class'));
            const year    = state.currentAcadYear?.name||new Date().getFullYear().toString();
            const cls     = getClassById(classId);
            const prefix  = cls?.code||'STU';
            const count   = (state.students||[]).filter(s=>s.class_id===classId).length+1;
            const code    = `${prefix}-${year.slice(-2)}-${String(count).padStart(3,'0')}`;
            const student = await insert('students', {
                first_name: f('enroll-firstname'), last_name: f('enroll-lastname'),
                date_of_birth: f('enroll-dob')||null, gender: f('enroll-gender')||'Male',
                class_id: classId, student_code: code,
                guardian_name: f('enroll-guardian')||null, guardian_phone: f('enroll-phone')||null,
                guardian_email: f('enroll-email')||null, address: f('enroll-address')||null,
                enrollment_date: new Date().toISOString().split('T')[0],
                status: 'Active', is_deleted: false, created_at: new Date().toISOString()
            });
            if (!student) { showToast('Failed to enroll student', 'error'); return; }
            await refreshTable('students');
            await logActivity(getCurrentUser()?.id, getCurrentUser()?.role,
                `Enrolled student: ${f('enroll-firstname')} ${f('enroll-lastname')}`, 'students', student.id);
            showToast(`✅ Student enrolled — Code: ${code}`, 'success');
            renderStudentList(document.getElementById('dynamic-content'));
        }

        /**
         * Switch the active tab on the Student Details page.
         * Updates the highlighted tab button and re-renders #student-tab-content
         * with the selected tab's content via loadStudentTabContent().
         */
        function switchStudentTab(tabName, studentId, event) {
            _activeStudentTab = tabName;
            // Re-style tab buttons (they all live in the .tabs row rendered by renderStudentDetails)
            document.querySelectorAll('.tabs .tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderBottom = '2px solid transparent';
                b.style.color = 'var(--text-muted)';
            });
            if (event?.target) {
                event.target.classList.add('active');
                event.target.style.borderBottom = '2px solid var(--role-primary)';
                event.target.style.color = 'var(--role-primary)';
            }
            loadStudentTabContent(tabName, studentId);
        }

        /**
         * Render the content for one Student Details tab into #student-tab-content.
         * Role gating mirrors the tab buttons in renderStudentDetails:
         *  - 'fees' is for admin/accountant only (never shown/loaded for teachers)
         *  - 'academics' is hidden from accountants
         */
        async function loadStudentTabContent(tabName, studentId) {
            const container = document.getElementById('student-tab-content');
            if (!container) return;
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';

            const role = state.currentUser?.role;
            if (tabName === 'fees' && role === 'teacher') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Finance information is not available for Teacher accounts.</div>';
                return;
            }
            if (tabName === 'academics' && role === 'accountant') {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Academic information is not available for Accountant accounts.</div>';
                return;
            }

            try {
                switch (tabName) {
                    case 'fees': await renderStudentFeesTab(container, studentId); break;
                    case 'academics': await renderStudentAcademicsTab(container, studentId); break;
                    case 'family': await renderStudentFamilyTab(container, studentId); break;
                    case 'history': await renderStudentHistoryTab(container, studentId); break;
                    default: await renderStudentInfoTab(container, studentId); break;
                }
            } catch (err) {
                console.error(`[Student Tab ${tabName}]`, err);
                container.innerHTML = `<div class="alert alert-danger"><strong>Error loading tab:</strong> ${esc(err.message)}</div>`;
            }
        }

        /** Info tab: basic biodata, class, guardian contact, enrollment status. */
        async function renderStudentInfoTab(container, studentId) {
            const s = getStudentById(studentId);
            if (!s) { container.innerHTML = '<div class="alert alert-warning">Student not found</div>'; return; }
            const cls = getClassById(s.class_id);
            const age = s.date_of_birth ? Math.floor((new Date() - new Date(s.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25)) : null;

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group"><label>Full Name</label><div><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></div></div>
                            <div class="form-group"><label>Student Code</label><div>${esc(s.student_code || '—')}</div></div>
                            <div class="form-group"><label>Class</label><div>${esc(cls?.name || '—')}</div></div>
                            <div class="form-group"><label>Status</label><div><span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-warning'}">${esc(s.status || '—')}</span></div></div>
                            <div class="form-group"><label>Gender</label><div>${esc(s.gender || '—')}</div></div>
                            <div class="form-group"><label>Date of Birth</label><div>${fmtDate(s.date_of_birth)}${age !== null ? ` (${age} yrs)` : ''}</div></div>
                            <div class="form-group"><label>Enrollment Date</label><div>${fmtDate(s.enrollment_date)}</div></div>
                            <div class="form-group"><label>Guardian Name</label><div>${esc(s.guardian_name || '—')}</div></div>
                            <div class="form-group"><label>Guardian Phone</label><div>${esc(s.guardian_phone || '—')}</div></div>
                            <div class="form-group"><label>Guardian Email</label><div>${esc(s.guardian_email || '—')}</div></div>
                            <div class="form-group" style="grid-column:1/-1"><label>Address</label><div>${esc(s.address || '—')}</div></div>
                        </div>
                    </div>
                </div>
            `;
        }

        /** Fees tab: balance summary + itemized fee list (admin/accountant only). */
        async function renderStudentFeesTab(container, studentId) {
            const bal = await getFullStudentBalance(studentId);
            const fees = (state.studentFees || []).filter(f => f.student_id == studentId && !f.is_credit && !f.manually_deleted);

            const rows = fees.map(f => {
                const cat = (state.feeCategories || []).find(c => c.id === f.fee_category_id);
                const due = f.is_waived ? 0 : Math.max(0, (f.amount || 0) - (f.paid_amount || 0));
                return `<tr>
                    <td>${esc(cat?.name || 'Fee')}${f.is_waived ? ' <span class="badge badge-info">Waived</span>' : ''}</td>
                    <td style="text-align:right">${fmtCurrency(f.amount || 0)}</td>
                    <td style="text-align:right">${fmtCurrency(f.paid_amount || 0)}</td>
                    <td style="text-align:right;color:${due > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(due)}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No fees assigned</td></tr>';

            container.innerHTML = `
                <div class="dash-card" style="margin-bottom:16px">
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group"><label>Total Fees</label><div style="font-size:1.1rem;font-weight:700">${fmtCurrency(bal.total)}</div></div>
                            <div class="form-group"><label>Total Paid</label><div style="font-size:1.1rem;font-weight:700;color:var(--success)">${fmtCurrency(bal.paid)}</div></div>
                            <div class="form-group"><label>Balance Due</label><div style="font-size:1.1rem;font-weight:700;color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(bal.balance)}</div></div>
                            ${bal.hasCredit ? `<div class="form-group"><label>Credit</label><div style="font-size:1.1rem;font-weight:700;color:var(--success)">${fmtCurrency(bal.credit)}</div></div>` : ''}
                        </div>
                        <div class="btn-group" style="margin-top:12px">
                            <button class="btn btn-sm btn-primary" onclick="localStorage.setItem('elf_pay_student', '${studentId}'); navigateTo('record-payment')">💳 Record Payment</button>
                        </div>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Fee Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        /** Academics tab: current-term subject averages + annual rank summary (hidden from accountants). */
        async function renderStudentAcademicsTab(container, studentId) {
            const s = getStudentById(studentId);
            if (!s) { container.innerHTML = '<div class="alert alert-warning">Student not found</div>'; return; }

            let data;
            try {
                data = await generateSingleReport(studentId, s.class_id, 'annual', null);
            } catch (e) {
                container.innerHTML = '<div class="alert alert-info">No marks recorded yet for this student.</div>';
                return;
            }

            const subjectRows = data.subjects.map(subj => {
                const cells = data.termsToProcess.map(t => {
                    const sc = data.termScores[t.id]?.subjects[subj.id];
                    return `<td style="text-align:center">${sc?.total !== null && sc?.total !== undefined ? sc.total.toFixed(1) : '—'}</td>`;
                }).join('');
                return `<tr><td>${esc(subj.name)}</td>${cells}</tr>`;
            }).join('');

            const termHeaders = data.termsToProcess.map(t => `<th style="text-align:center">${esc(t.name)}</th>`).join('');

            container.innerHTML = `
                <div class="dash-card" style="margin-bottom:16px">
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group"><label>Annual Total</label><div style="font-size:1.1rem;font-weight:700">${data.annualTotalScore.toFixed(1)} / ${data.annualTotalMax}</div></div>
                            <div class="form-group"><label>Overall %</label><div style="font-size:1.1rem;font-weight:700"><span class="badge ${getGradeClass(data.overallPercentage)}">${data.overallPercentage.toFixed(1)}%</span></div></div>
                            <div class="form-group"><label>Grade</label><div style="font-size:1.1rem;font-weight:700">${data.overallGrade}</div></div>
                            <div class="form-group"><label>Class Rank</label><div style="font-size:1.1rem;font-weight:700">${data.rank || '—'}</div></div>
                            <div class="form-group"><label>Attendance</label><div>${data.attendance.present}/${data.attendance.total} present</div></div>
                        </div>
                        <div class="btn-group" style="margin-top:12px">
                            <button class="btn btn-sm btn-outline" onclick="navigateTo('report-cards')">📄 Go to Report Cards</button>
                        </div>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Subject</th>${termHeaders}</tr></thead>
                        <tbody>${subjectRows || '<tr><td colspan="' + (data.termsToProcess.length + 1) + '" style="text-align:center;color:var(--text-muted)">No subjects found</td></tr>'}</tbody>
                    </table>
                </div>
            `;
        }

        /** Family tab: linked family/guardian info and siblings. */
        async function renderStudentFamilyTab(container, studentId) {
            const s = getStudentById(studentId);
            if (!s) { container.innerHTML = '<div class="alert alert-warning">Student not found</div>'; return; }

            if (!s.family_id) {
                container.innerHTML = `
                    <div class="alert alert-info">This student is not linked to a family group.</div>
                    ${state.currentUser?.role === 'admin' ? `<button class="btn btn-sm btn-primary" onclick="navigateTo('sibling-linking')">🔗 Link to Family</button>` : ''}
                `;
                return;
            }

            const family = (state.families || []).find(f => f.id === s.family_id);
            const siblings = (state.students || []).filter(st => st.family_id === s.family_id && st.id !== s.id && st.status === 'Active');

            const siblingRows = siblings.map(sib => {
                const sc = getClassById(sib.class_id);
                return `<tr>
                    <td>${esc(sib.first_name)} ${esc(sib.last_name)}</td>
                    <td>${esc(sc?.name || '—')}</td>
                    <td><button class="btn btn-sm btn-outline" onclick="localStorage.setItem('elf_view_student', ${sib.id}); navigateTo('student-details')">👁️ View</button></td>
                </tr>`;
            }).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No siblings linked</td></tr>';

            container.innerHTML = `
                <div class="dash-card" style="margin-bottom:16px">
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group"><label>Family Code</label><div><code>${esc(family?.family_code || '—')}</code></div></div>
                            <div class="form-group"><label>Guardian Name</label><div>${esc(family?.guardian_name || s.guardian_name || '—')}</div></div>
                            <div class="form-group"><label>Guardian Phone</label><div>${esc(family?.guardian_phone || s.guardian_phone || '—')}</div></div>
                            <div class="form-group"><label>Guardian Email</label><div>${esc(family?.guardian_email || s.guardian_email || '—')}</div></div>
                            ${family?.address ? `<div class="form-group" style="grid-column:1/-1"><label>Address</label><div>${esc(family.address)}</div></div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Sibling</th><th>Class</th><th>Action</th></tr></thead>
                        <tbody>${siblingRows}</tbody>
                    </table>
                </div>
            `;
        }

        /**
         * History tab: activity timeline for this student.
         * Payment history is included ONLY for admin/accountant — teachers see
         * academic-related history only (enrollment, promotions, attendance notes).
         */
        async function renderStudentHistoryTab(container, studentId) {
            const role = state.currentUser?.role;
            const events = [];

            const s = getStudentById(studentId);
            if (s?.enrollment_date) events.push({ date: s.enrollment_date, label: 'Enrolled', detail: getClassById(s.class_id)?.name || '' });

            // Payments — hidden from teachers entirely
            if (role !== 'teacher') {
                const payments = (state.payments || []).filter(p => p.student_id == studentId)
                    .sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
                for (const p of payments) {
                    events.push({ date: p.payment_date || p.created_at, label: 'Payment received', detail: fmtCurrency(p.amount) + (p.receipt_number ? ' (' + esc(p.receipt_number) + ')' : '') });
                }
            }

            // Promotions
            const promotions = (state.promotions || []).filter(p => p.student_id == studentId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            for (const p of promotions) {
                events.push({ date: p.created_at, label: 'Promotion', detail: `${esc(p.from_class || '—')} → ${esc(p.to_class || '—')}` });
            }

            events.sort((a, b) => new Date(b.date) - new Date(a.date));

            const rows = events.map(e => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.label)}</td><td>${e.detail}</td></tr>`).join('')
                || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No history recorded</td></tr>';

            container.innerHTML = `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Event</th><th>Details</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        // ── Bulk import helpers ───────────────────────────────────────────────
        function updatePreviewRow(index, field, value) {
            if (!window._importData?.[index]) return;
            window._importData[index][field] = value;
        }

        function removePreviewRow(index) {
            if (!window._importData) return;
            window._importData.splice(index, 1);
            const row = document.getElementById(`preview-row-${index}`);
            if (row) row.remove();
        }

        // ── Student promotion helpers ─────────────────────────────────────────
        function togglePromotionClass(classId) {
            const cbs = document.querySelectorAll(`.promote-student-${classId}`);
            const all = document.getElementById(`promote-all-${classId}`);
            cbs.forEach(cb => cb.checked = all?.checked||false);
        }

        function toggleSelectAll(type) {
            const master = document.getElementById(`toggle-all-${type}`);
            document.querySelectorAll(`.select-${type}`).forEach(cb => cb.checked = master?.checked||false);
        }

        async function previewFullPromotion() {
            const classList = document.querySelectorAll('.promote-class-select:checked');
            const preview   = [];
            for (const cb of classList) {
                const fromId   = parseInt(cb.dataset.fromId);
                const toName   = cb.dataset.toName;
                const students = (state.students||[]).filter(s=>s.class_id===fromId&&s.status==='Active');
                preview.push({ fromId, toName, count:students.length, students });
            }
            window._promotionPreview = preview;
            const div = document.getElementById('promotion-preview-div');
            if (!div) return;
            div.style.display='block';
            div.innerHTML = preview.length ? `
                <div class="alert alert-info">
                    <strong>Preview:</strong> ${preview.reduce((s,p)=>s+p.count,0)} students will be promoted
                    ${preview.map(p=>`<div style="margin-top:4px">${p.count} students: ${getClassById(p.fromId)?.name||'?'} → ${esc(p.toName)}</div>`).join('')}
                </div>` : '<div class="alert alert-warning">No classes selected</div>';
        }

        async function executeFullPromotion() {
            const preview = window._promotionPreview||[];
            if (!preview.length) { showToast('Run preview first', 'warning'); return; }
            const total = preview.reduce((s,p)=>s+p.count,0);
            if (!await confirmDialog(`Promote ${total} students? This cannot be undone.`)) return;
            let promoted=0, graduated=0;
            const batchName = `Promotion - ${fmtDate(new Date().toISOString())}`;
            for (const p of preview) {
                const fromClass = getClassById(p.fromId);
                for (const st of p.students) {
                    if (p.toName==='GRADUATED') {
                        await update('students', st.id, { status:'Graduated', class_id:null, updated_at:new Date().toISOString() });
                        graduated++;
                    } else {
                        const toClass = (state.classes||[]).find(c=>c.name===p.toName);
                        if (toClass) { await update('students', st.id, { class_id:toClass.id, updated_at:new Date().toISOString() }); promoted++; }
                    }
                }
                // Record this from->to batch in the promotions table so it shows
                // up in Promotion History (loadFullPromotionHistory). One row
                // per from-class/to-class group, not per student, to keep the
                // history readable.
                if (p.count > 0) {
                    try {
                        await insert('promotions', {
                            batch_name: batchName,
                            from_class: fromClass?.name || '—',
                            to_class: p.toName,
                            student_count: p.count,
                            academic_year_id: state.currentAcadYear?.id || null,
                            created_by: state.currentUser?.id || null,
                            created_at: new Date().toISOString()
                        });
                    } catch (e) {
                        console.warn('[Promotion History] Failed to record batch:', e);
                    }
                }
            }
            await refreshTable('students');
            window._promotionPreview=[];
            showToast(`✅ Promoted ${promoted}, graduated ${graduated} students`, 'success');
            renderStudentPromotion(document.getElementById('dynamic-content'));
        }

        // ── Timetable helpers ─────────────────────────────────────────────────
        async function loadTimetableData() {
            renderTeacherTimetable(document.getElementById('dynamic-content'));
        }

        function toggleTimetableView() {
            const grid  = document.getElementById('timetable-grid-view');
            const list  = document.getElementById('timetable-list-view');
            const btn   = document.getElementById('timetable-toggle-btn');
            if (!grid||!list) return;
            const showingGrid = grid.style.display!=='none';
            grid.style.display  = showingGrid?'none':'block';
            list.style.display  = showingGrid?'block':'none';
            if (btn) btn.textContent = showingGrid?'📊 Grid View':'📋 List View';
        }

        function printTimetable() {
            const content = document.getElementById('timetable-content')||document.getElementById('dynamic-content');
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Timetable</title>
                <style>body{font-family:Arial;padding:20px;font-size:11px}
                table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px;text-align:center}
                th{background:#1a3a5c;color:#fff}h2{text-align:center}
                @media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Timetable</h2>
                ${content?.innerHTML||''}</body></html>`);
            w.document.close(); w.print();
        }

        async function loadTeacherTimetable() {
            renderTeacherTimetable(document.getElementById('dynamic-content'));
        }

        function exportTeacherTimetable() {
            const table = document.querySelector('#timetable-content table');
            if (!table) { showToast('No timetable to export', 'warning'); return; }
            const ws = XLSX.utils.table_to_sheet(table);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Teacher Timetable');
            XLSX.writeFile(wb, `TeacherTimetable_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Exported', 'success');
        }

        function printTeacherTimetable() { printTimetable(); }

        async function loadStaffTimetableData() {
            renderClassTimetable(document.getElementById('dynamic-content'));
        }

        function exportStaffTimetable() { exportTeacherTimetable(); }
        function printStaffTimetable()  { printTimetable(); }

        function exportTimetableToExcel() { exportTeacherTimetable(); }

        function exportTimetableTemplate() {
            const data = TIMETABLE_DAYS.flatMap(day =>
                TIMETABLE_TIME_SLOTS.map(slot => ({ 'Day':day, 'Time Slot':slot, 'Class':'', 'Subject':'', 'Teacher':'' }))
            );
            exportToExcel(data, 'Timetable_Import_Template');
        }

        function openImportTimetableModal() {
            showModal(`<div class="modal-overlay"><div class="modal" style="max-width:500px">
                <div class="modal-header"><h3>📥 Import Timetable</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body">
                    <div class="alert alert-info">Upload an Excel file with columns: Day, Time Slot, Class, Subject, Teacher</div>
                    <div class="form-group"><label>Excel File</label>
                        <input type="file" id="timetable-import-file" accept=".xlsx,.xls,.csv">
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="exportTimetableTemplate()">📥 Download Template First</button>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="processTimetableImport()">Import</button>
                </div></div></div>`);
        }

        async function processTimetableImport() {
            const file = document.getElementById('timetable-import-file')?.files[0];
            if (!file) { showToast('Select a file', 'warning'); return; }
            showToast('📥 Processing import…', 'info');
            closeModal();
        }

        // ── Attendance helpers ────────────────────────────────────────────────
        /**
         * Load attendance summary for the selected class and date range.
         * Reads payments/marks as a proxy for presence (real attendance table
         * used when available; falls back to marks-entry data).
         */
        async function loadAttendanceSummary() {
            const div       = document.getElementById('attendance-summary-content');
            const classId   = document.getElementById('summary-class')?.value;
            const month     = document.getElementById('summary-month')?.value || new Date().toISOString().slice(0,7);
            if (!div) return;

            div.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading attendance…</p></div>';

            const students  = (state.students || []).filter(s =>
                (!classId || s.class_id == classId) && s.status === 'Active'
            ).sort((a,b) => a.last_name.localeCompare(b.last_name));

            // Try to load from attendance table; fall back to marks-entry presence
            let attendanceData = [];
            try {
                attendanceData = await getAll('attendance',
                    classId ? { class_id: classId } : 'order=date.desc&limit=5000'
                );
            } catch (e) { attendanceData = []; }

            if (!attendanceData.length) {
                // Build from marks data as attendance proxy
                const assessments = (state.assessments || []).filter(a =>
                    (!classId || a.class_id == classId) &&
                    (a.recorded_at || '').slice(0,7) === month
                );
                const aIds = assessments.map(a => a.id);
                const marks = (state.marks || []).filter(m => aIds.includes(m.assessment_id));
                attendanceData = marks.map(m => ({
                    student_id: m.student_id,
                    date:       (assessments.find(a=>a.id===m.assessment_id)?.recorded_at||'').slice(0,10),
                    status:     'present'
                }));
            }

            // Filter to selected month
            const monthData = attendanceData.filter(a => (a.date||'').slice(0,7) === month);
            const dates     = [...new Set(monthData.map(a=>a.date))].sort();

            if (!students.length) {
                div.innerHTML = '<div class="alert alert-info">No students found for the selected filters.</div>';
                return;
            }

            // Build summary table
            const rows = students.map(s => {
                const sData    = monthData.filter(a => a.student_id === s.id);
                const present  = sData.filter(a => a.status === 'present').length;
                const absent   = sData.filter(a => a.status === 'absent').length;
                const late     = sData.filter(a => a.status === 'late').length;
                const total    = dates.length;
                const rate     = total > 0 ? ((present + late) / total * 100).toFixed(0) : '—';
                return { s, present, absent, late, total, rate };
            });

            const avgRate = rows.filter(r=>r.total>0).reduce((s,r)=>s+parseFloat(r.rate||0),0) /
                            (rows.filter(r=>r.total>0).length || 1);

            div.innerHTML = `
                <div class="stats-grid" style="margin-bottom:16px">
                    <div class="stat-card stat-blue"><div class="stat-body">
                        <div class="stat-value">${students.length}</div><div class="stat-label">Students</div></div></div>
                    <div class="stat-card stat-green"><div class="stat-body">
                        <div class="stat-value">${dates.length}</div><div class="stat-label">School Days</div></div></div>
                    <div class="stat-card stat-purple"><div class="stat-body">
                        <div class="stat-value">${avgRate.toFixed(0)}%</div><div class="stat-label">Avg Attendance</div></div></div>
                </div>
                <div class="table-wrapper"><table class="data-table">
                    <thead><tr>
                        <th>Student</th><th>Class</th>
                        <th style="text-align:center;color:#10b981">✅ Present</th>
                        <th style="text-align:center;color:#ef4444">❌ Absent</th>
                        <th style="text-align:center;color:#f59e0b">⏰ Late</th>
                        <th style="text-align:center">Days</th>
                        <th style="text-align:center">Rate</th>
                    </tr></thead>
                    <tbody>${rows.map(r=>`<tr>
                        <td><strong>${esc(r.s.last_name+' '+r.s.first_name)}</strong></td>
                        <td>${esc(getClassById(r.s.class_id)?.name||'—')}</td>
                        <td style="text-align:center;color:#10b981;font-weight:600">${r.present}</td>
                        <td style="text-align:center;color:#ef4444;font-weight:600">${r.absent}</td>
                        <td style="text-align:center;color:#f59e0b;font-weight:600">${r.late}</td>
                        <td style="text-align:center">${r.total}</td>
                        <td style="text-align:center">
                            <span class="badge ${r.rate>=90?'badge-success':r.rate>=75?'badge-warning':'badge-danger'}">
                                ${r.rate}%</span></td>
                    </tr>`).join('')}</tbody>
                </table></div>`;

            window._attendanceSummaryRows = rows;
        }

        /**
         * Export the attendance summary to Excel.
         */
        function exportAttendanceSummary() {
            const rows = window._attendanceSummaryRows;
            if (!rows?.length) { showToast('Load attendance summary first', 'warning'); return; }
            const data = rows.map(r => ({
                'Student':  `${r.s.first_name} ${r.s.last_name}`,
                'Code':     r.s.student_code || '—',
                'Class':    getClassById(r.s.class_id)?.name || '—',
                'Present':  r.present,
                'Absent':   r.absent,
                'Late':     r.late,
                'Total Days': r.total,
                'Attendance %': r.rate + '%'
            }));
            exportToExcel(data, `Attendance_Summary_${new Date().toISOString().split('T')[0]}`);
            showToast('✅ Attendance summary exported', 'success');
        }

        /**
         * Load attendance analytics — trends, class comparisons, and charts.
         */
        async function loadAttendanceAnalytics() {
            const div       = document.getElementById('attendance-analytics-content');
            const classId   = document.getElementById('analytics-class')?.value;
            const period    = document.getElementById('analytics-period')?.value || 'month';
            if (!div) return;

            div.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Computing analytics…</p></div>';

            // Get attendance data per class
            const classes   = (state.classes||[]).filter(c => (!classId || c.id == classId) && c.is_active!==false);
            let attendanceData = [];
            try { attendanceData = await getAll('attendance', 'order=date.desc&limit=10000'); }
            catch (e) { attendanceData = []; }

            // Fall back: use marks as presence proxy
            if (!attendanceData.length) {
                (state.marks||[]).forEach(m => {
                    const a = (state.assessments||[]).find(x=>x.id===m.assessment_id);
                    if (a) attendanceData.push({ student_id:m.student_id, class_id:a.class_id,
                        date:(a.recorded_at||'').slice(0,10), status:'present' });
                });
            }

            // Class-level attendance rates
            const classStats = classes.map(cls => {
                const students = (state.students||[]).filter(s=>s.class_id===cls.id&&s.status==='Active');
                const clsData  = attendanceData.filter(a=>a.class_id===cls.id);
                const present  = clsData.filter(a=>a.status==='present').length;
                const total    = clsData.length;
                const rate     = total>0?(present/total*100):0;
                return { name:cls.name, students:students.length, present, total, rate };
            }).filter(c=>c.total>0);

            // Monthly trend
            const monthly = {};
            attendanceData.forEach(a => {
                const m = (a.date||'').slice(0,7);
                if (!m) return;
                if (!monthly[m]) monthly[m] = { present:0, total:0 };
                monthly[m].total++;
                if (a.status==='present') monthly[m].present++;
            });
            const trendMonths = Object.keys(monthly).sort().slice(-6);
            const trendRates  = trendMonths.map(m => monthly[m].total>0?(monthly[m].present/monthly[m].total*100):0);

            const overallRate = attendanceData.length>0
                ? (attendanceData.filter(a=>a.status==='present').length/attendanceData.length*100)
                : 0;

            div.innerHTML = `
                <div class="stats-grid" style="margin-bottom:16px">
                    <div class="stat-card stat-green"><div class="stat-body">
                        <div class="stat-value">${overallRate.toFixed(1)}%</div>
                        <div class="stat-label">Overall Attendance Rate</div></div></div>
                    <div class="stat-card stat-blue"><div class="stat-body">
                        <div class="stat-value">${classStats.length}</div>
                        <div class="stat-label">Classes with Data</div></div></div>
                    <div class="stat-card stat-purple"><div class="stat-body">
                        <div class="stat-value">${attendanceData.length}</div>
                        <div class="stat-label">Total Records</div></div></div>
                </div>
                <div class="two-col" style="margin-bottom:16px">
                    <div class="dash-card">
                        <div class="dash-card-header"><span class="dash-card-title">📊 Class Attendance Rates</span></div>
                        <div class="dash-card-body"><canvas id="att-class-chart" height="220"></canvas></div>
                    </div>
                    <div class="dash-card">
                        <div class="dash-card-header"><span class="dash-card-title">📈 Monthly Trend</span></div>
                        <div class="dash-card-body"><canvas id="att-trend-chart" height="220"></canvas></div>
                    </div>
                </div>
                ${classStats.length ? `
                <div class="dash-card">
                    <div class="dash-card-header"><span class="dash-card-title">📋 Class Summary</span></div>
                    <div class="dash-card-body" style="padding:0">
                        <div class="table-wrapper"><table class="data-table">
                            <thead><tr><th>Class</th><th>Students</th><th>Records</th><th>Rate</th></tr></thead>
                            <tbody>${classStats.map(c=>`<tr>
                                <td><strong>${esc(c.name)}</strong></td>
                                <td style="text-align:center">${c.students}</td>
                                <td style="text-align:center">${c.total}</td>
                                <td style="text-align:center">
                                    <span class="badge ${c.rate>=90?'badge-success':c.rate>=75?'badge-warning':'badge-danger'}">
                                        ${c.rate.toFixed(1)}%</span></td>
                            </tr>`).join('')}</tbody>
                        </table></div>
                    </div>
                </div>` : '<div class="alert alert-info">No attendance data found. Record attendance to see analytics.</div>'}`;

            window._attendanceAnalyticsData = { classStats, trendMonths, trendRates };

            setTimeout(() => {
                const classCtx = document.getElementById('att-class-chart')?.getContext('2d');
                if (classCtx && classStats.length) {
                    if (window._attClassChart) window._attClassChart.destroy();
                    window._attClassChart = new Chart(classCtx, {
                        type:'bar',
                        data:{ labels:classStats.map(c=>c.name),
                            datasets:[{ label:'Attendance %', data:classStats.map(c=>c.rate),
                                backgroundColor:'rgba(16,185,129,.7)', borderRadius:6 }]},
                        options:{ responsive:true, scales:{ y:{ min:0, max:100 }},
                            plugins:{ tooltip:{ callbacks:{ label:ctx=>`${ctx.raw.toFixed(1)}%` }}}}
                    });
                }
                const trendCtx = document.getElementById('att-trend-chart')?.getContext('2d');
                if (trendCtx && trendMonths.length) {
                    if (window._attTrendChart) window._attTrendChart.destroy();
                    window._attTrendChart = new Chart(trendCtx, {
                        type:'line',
                        data:{ labels:trendMonths,
                            datasets:[{ label:'Monthly Rate %', data:trendRates,
                                borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.1)',
                                fill:true, tension:0.3, pointRadius:4 }]},
                        options:{ responsive:true, scales:{ y:{ min:0, max:100 }},
                            plugins:{ tooltip:{ callbacks:{ label:ctx=>`${ctx.raw.toFixed(1)}%` }}}}
                    });
                }
            }, 120);
        }

        /**
         * Export the attendance analytics data to Excel.
         */
        function exportAttendanceAnalytics() {
            const data = window._attendanceAnalyticsData;
            if (!data?.classStats?.length) {
                showToast('Load attendance analytics first', 'warning');
                return;
            }
            const exportData = data.classStats.map(c => ({
                'Class': c.name, 'Students': c.students,
                'Total Records': c.total, 'Present': c.present,
                'Attendance Rate %': c.rate.toFixed(1)
            }));
            exportToExcel(exportData, `Attendance_Analytics_${new Date().toISOString().split('T')[0]}`);
            showToast('✅ Attendance analytics exported', 'success');
        }

        // ── Teacher helpers ───────────────────────────────────────────────────
        async function viewTeacherDetails(teacherId) {
            const t = (state.teachers||[]).find(x=>x.id===teacherId);
            if (!t) return;
            const assignments = await getAll('teacher_assignments', { teacher_id:teacherId }).catch(()=>[]);
            const classNames  = [...new Set(assignments.map(a=>getClassById(a.class_id)?.name).filter(Boolean))];
            const subjectNames= [...new Set(assignments.map(a=>getSubjectById(a.subject_id)?.name).filter(Boolean))];
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>👩‍🏫 ${esc(t.name)}</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Name</label><input readonly value="${esc(t.name)}"></div>
                    <div class="form-group"><label>Role</label><input readonly value="${esc(t.role)}"></div>
                    <div class="form-group"><label>Username</label><input readonly value="${esc(t.username||'—')}"></div>
                    <div class="form-group"><label>Email</label><input readonly value="${esc(t.email||'—')}"></div>
                    <div class="form-group"><label>Phone</label><input readonly value="${esc(t.phone||'—')}"></div>
                    <div class="form-group"><label>Status</label>
                        <input readonly value="${t.is_active===false?'Inactive':'Active'}"></div>
                    <div class="form-group full"><label>Assigned Classes</label>
                        <input readonly value="${esc(classNames.join(', ')||'None')}"></div>
                    <div class="form-group full"><label>Subjects</label>
                        <input readonly value="${esc(subjectNames.join(', ')||'None')}"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div></div></div>`);
        }

        async function loadTeacherPerformance() {
            renderTeacherPerformance(document.getElementById('dynamic-content'));
        }

        /**
         * Filter the teacher performance table by name search.
         * Called on every keystroke in #perf-search.
         */
        function filterTeacherPerformance() {
            const term    = (document.getElementById('perf-search')?.value || '').toLowerCase();
            const termFil = document.getElementById('perf-term-filter')?.value;
            const rows    = document.querySelectorAll('#teacher-perf-table tbody tr');
            let   visible = 0;
            rows.forEach(row => {
                const nameMatch = !term  || row.innerText.toLowerCase().includes(term);
                const termMatch = !termFil; // term filter is handled at data-load level
                const show = nameMatch && termMatch;
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const count = document.getElementById('perf-count');
            if (count) count.textContent = visible + ' teacher' + (visible !== 1 ? 's' : '');
        }
        window.filterTeacherPerformance = filterTeacherPerformance;

        function exportTeacherPerformance() {
            const data = (state.teachers||[]).map(t => {
                const assignments = [];
                const aIds = (state.assessments||[]).filter(a=>{
                    const asgns = [];
                    return false;
                }).map(a=>a.id);
                return { 'Teacher':t.name, 'Role':t.role, 'Status':t.is_active===false?'Inactive':'Active',
                    'Last Login':fmtDate(t.last_login) };
            });
            exportToExcel(data, 'Teacher_Performance');
        }

        function printTeacherPerformance() {
            const content = document.getElementById('dynamic-content');
            if (!content) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Teacher Performance</title>
                <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}
                th,td{border:1px solid #ccc;padding:6px}th{background:#1a3a5c;color:#fff}
                h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head>
                <body><h2>ECOLE LA FONTAINE — Teacher Performance</h2>
                <p style="text-align:center">${new Date().toLocaleDateString()}</p>
                ${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }

        // ── Notification helpers ──────────────────────────────────────────────
        function filterNotifTab(tab) {
            document.querySelectorAll('.notif-tab-panel').forEach(p=>p.style.display='none');
            document.querySelectorAll('.notif-tab-btn').forEach(b=>b.classList.remove('active'));
            const panel = document.getElementById(`notif-${tab}-panel`);
            if (panel) panel.style.display='block';
            const btn = document.querySelector(`[data-notif-tab="${tab}"]`);
            if (btn) btn.classList.add('active');
        }

        async function markAnnouncementAsRead(id) {
            await update('announcements', id, { is_read:true });
            const el = document.querySelector(`[data-announcement="${id}"]`);
            if (el) el.classList.add('read');
            state.announcements = (state.announcements||[]).map(a=>a.id===id?{...a,is_read:true}:a);
            updateNotificationBadge();
        }

        function openSendAnnouncementModal(editId=null) {
            const ann = editId?(state.announcements||[]).find(a=>a.id===editId):null;
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>${ann?'✏️ Edit':'📢 Send'} Announcement</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group full"><label>Title *</label>
                        <input type="text" id="ann-title" value="${esc(ann?.title||'')}" placeholder="Announcement title"></div>
                    <div class="form-group"><label>Type</label>
                        <select id="ann-type">
                            <option value="info" ${ann?.type==='info'?'selected':''}>ℹ️ Info</option>
                            <option value="urgent" ${ann?.type==='urgent'?'selected':''}>🔴 Urgent</option>
                            <option value="event" ${ann?.type==='event'?'selected':''}>📅 Event</option>
                            <option value="reminder" ${ann?.type==='reminder'?'selected':''}>🔔 Reminder</option>
                        </select></div>
                    <div class="form-group"><label>Recipients</label>
                        <select id="ann-recipients" onchange="toggleAnnouncementRecipients()">
                            <option value="all">All Users</option>
                            <option value="teachers">Teachers Only</option>
                            <option value="accountants">Accountants Only</option>
                            <option value="admin">Admin Only</option>
                        </select></div>
                    <div class="form-group full"><label>Message *</label>
                        <textarea id="ann-message" rows="5" placeholder="Your announcement…">${esc(ann?.message||'')}</textarea></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="sendAnnouncementFromModal(${editId||'null'})">
                        ${ann?'Update':'Send'}
                    </button>
                </div></div></div>`);
        }

        async function sendAnnouncementFromModal(editId) {
            const title     = document.getElementById('ann-title')?.value.trim();
            const message   = document.getElementById('ann-message')?.value.trim();
            const type      = document.getElementById('ann-type')?.value||'info';
            const recipients= document.getElementById('ann-recipients')?.value||'all';
            if (!title||!message) { showToast('Title and message required', 'warning'); return; }
            if (editId) {
                await update('announcements', editId, { title, message, type, recipients, updated_at:new Date().toISOString() });
            } else {
                await insert('announcements', { title, message, type, recipients, is_read:false,
                    created_by:getCurrentUser()?.id, created_at:new Date().toISOString() });
            }
            closeModal();
            showToast(`✅ Announcement ${editId?'updated':'sent'}`, 'success');
            renderAnnouncements(document.getElementById('dynamic-content'));
        }

        // ── School settings helpers ───────────────────────────────────────────
        async function saveSchoolSettings() {
            const fields = [
                'school_name','school_address','school_phone','school_email',
                'school_motto','head_teacher','school_website','current_term'
            ];
            for (const key of fields) {
                const el = document.getElementById(`setting-${key}`)||document.getElementById(key);
                if (el) await updateSchoolSetting(key, el.value);
            }
            if (window._pendingLogoData) {
                await updateSchoolSetting('school_logo', window._pendingLogoData);
                applySchoolLogo(window._pendingLogoData);
                window._pendingLogoData = null;
            }
            state.schoolSettings = await getSchoolSettings();
            showToast('✅ School settings saved', 'success');
        }

        function previewSchoolLogo(input) {
            const file = input?.files?.[0];
            if (!file) return;
            if (file.size > 2*1024*1024) { showToast('Logo too large (max 2 MB)', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = e => {
                const preview = document.getElementById('logo-preview');
                if (preview) preview.innerHTML=`<img src="${e.target.result}" style="max-width:120px;max-height:120px;border-radius:8px">`;
                window._pendingLogoData = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        // ── Family helpers (full versions) ────────────────────────────────────
        function showFamilyTabFull(tabName, event) {
            const tabs = ['families','linked','unlinked','auto'];
            tabs.forEach(t => {
                const el = document.getElementById(`${t}-tab-full`);
                if (el) el.style.display = t===tabName?'block':'none';
            });
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            if (event?.target) event.target.classList.add('active');
        }

        function openCreateFamilyModalFull() {
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>➕ Create Family</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Family Code *</label><input type="text" id="family-code-full" placeholder="e.g., FAM-001"></div>
                    <div class="form-group"><label>Guardian Name</label><input type="text" id="family-guardian-full"></div>
                    <div class="form-group"><label>Guardian Phone</label><input type="text" id="family-phone-full"></div>
                    <div class="form-group"><label>Guardian Email</label><input type="email" id="family-email-full"></div>
                    <div class="form-group full"><label>Address</label><textarea id="family-address-full" rows="2"></textarea></div>
                    <div class="form-group"><label>Discount (RWF)</label><input type="number" id="family-discount-full" value="0" step="5000"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="createFamilyFull()">Create Family</button>
                </div></div></div>`);
        }

        async function createFamilyFull() {
            const code = document.getElementById('family-code-full')?.value.trim().toUpperCase();
            if (!code) { showToast('Family code required', 'warning'); return; }
            await insert('families', {
                family_code:code, guardian_name:document.getElementById('family-guardian-full')?.value,
                guardian_phone:document.getElementById('family-phone-full')?.value,
                guardian_email:document.getElementById('family-email-full')?.value,
                address:document.getElementById('family-address-full')?.value,
                discount_amount:parseFloat(document.getElementById('family-discount-full')?.value)||0,
                created_at:new Date().toISOString()
            });
            await refreshTable('families');
            closeModal();
            showToast('✅ Family created', 'success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        function openLinkStudentModalFull(studentId, studentName) {
            const families = state.families||[];
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>🔗 Link: ${esc(studentName)}</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>Select Family</label>
                        <select id="link-family-id-full">
                            <option value="">-- Select Family --</option>
                            ${families.map(f=>`<option value="${f.id}">${esc(f.family_code)} — ${esc(f.guardian_name||'No guardian')}</option>`).join('')}
                        </select></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="linkStudentToFamilyFull(${studentId})">Link</button>
                </div></div></div>`);
        }

        async function linkStudentToFamilyFull(studentId) {
            const familyId = document.getElementById('link-family-id-full')?.value;
            if (!familyId) { showToast('Select a family', 'warning'); return; }
            await update('students', studentId, { family_id:parseInt(familyId) });
            await refreshTable('students');
            closeModal();
            showToast('✅ Student linked', 'success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        async function openEditFamilyModalFull(familyId) {
            const f = await getById('families', familyId);
            if (!f) return;
            showModal(`<div class="modal-overlay"><div class="modal"><div class="modal-header">
                <h3>✏️ Edit: ${esc(f.family_code)}</h3>
                <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body"><div class="form-grid">
                    <div class="form-group"><label>Guardian Name</label><input type="text" id="efg-name" value="${esc(f.guardian_name||'')}"></div>
                    <div class="form-group"><label>Phone</label><input type="text" id="efg-phone" value="${esc(f.guardian_phone||'')}"></div>
                    <div class="form-group"><label>Email</label><input type="email" id="efg-email" value="${esc(f.guardian_email||'')}"></div>
                    <div class="form-group full"><label>Address</label><textarea id="efg-addr" rows="2">${esc(f.address||'')}</textarea></div>
                    <div class="form-group"><label>Discount (RWF)</label><input type="number" id="efg-discount" value="${f.discount_amount||0}" step="5000"></div>
                </div></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="updateFamilyFull(${familyId})">Save</button>
                </div></div></div>`);
        }

        async function updateFamilyFull(familyId) {
            await update('families', familyId, {
                guardian_name:document.getElementById('efg-name')?.value,
                guardian_phone:document.getElementById('efg-phone')?.value,
                guardian_email:document.getElementById('efg-email')?.value,
                address:document.getElementById('efg-addr')?.value,
                discount_amount:parseFloat(document.getElementById('efg-discount')?.value)||0
            });
            await refreshTable('families');
            closeModal();
            showToast('✅ Family updated','success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        async function unlinkStudentFull(studentId, studentName) {
            if (!await confirmDialog(`Remove ${esc(studentName)} from family?`)) return;
            await update('students', studentId, { family_id:null });
            await refreshTable('students');
            showToast('✅ Student unlinked','success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        async function deleteFamilyFull(familyId, familyCode) {
            const linked = (state.students||[]).filter(s=>s.family_id===familyId).length;
            const msg = linked?`Family "${familyCode}" has ${linked} linked students. Deleting will unlink them. Continue?`:`Delete family "${familyCode}"?`;
            if (!await confirmDialog(msg)) return;
            // Unlink all students
            for (const s of (state.students||[]).filter(s=>s.family_id===familyId)) {
                await update('students', s.id, { family_id:null });
            }
            await remove('families', familyId);
            await refreshTable('families');
            await refreshTable('students');
            showToast('✅ Family deleted','success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        /**
         * Filter the unlinked-students table in the Sibling Linking module.
         * Called on every keystroke in the search box.
         */
        function filterUnlinkedStudentsFull() {
            const term = (document.getElementById('unlinked-search-full')?.value || '').toLowerCase();
            const rows = document.querySelectorAll('#unlinked-students-table tr');
            let visible = 0;
            rows.forEach(row => {
                const show = !term || row.innerText.toLowerCase().includes(term);
                row.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            const count = document.getElementById('unlinked-count');
            if (count) count.textContent = visible + ' student' + (visible !== 1 ? 's' : '');
        }
        window.filterUnlinkedStudentsFull = filterUnlinkedStudentsFull;

        async function autoCreateFamilyForGroup(studentIdsStr) {
            const studentIds = studentIdsStr.split(',').map(id=>parseInt(id.trim())).filter(Boolean);
            const students   = studentIds.map(id=>getStudentById(id)).filter(Boolean);
            if (!students.length) return;
            const familyCode = `FAM-${Date.now().toString().slice(-6)}`;
            const newFamily  = await insert('families', {
                family_code:familyCode, guardian_name:students[0]?.guardian_name||'Family',
                guardian_phone:students[0]?.guardian_phone||'',
                created_at:new Date().toISOString()
            });
            if (!newFamily) { showToast('Failed to create family','error'); return; }
            for (const s of students) { await update('students', s.id, { family_id:newFamily.id }); }
            await refreshTable('families');
            await refreshTable('students');
            showToast(`✅ Family ${familyCode} created and ${students.length} students linked`,'success');
            renderSiblingLinking(document.getElementById('dynamic-content'));
        }

        // ── executePromotion (used by class management promote modal) ─────────
        async function executePromotion() {
            const selected = [];
            document.querySelectorAll('.promote-class:checked').forEach(cb => {
                selected.push({ fromId:parseInt(cb.dataset.from), toName:cb.dataset.toName });
            });
            if (!selected.length) { showToast('Select at least one class', 'warning'); return; }
            if (!await confirmDialog(`Promote students in ${selected.length} class(es)?`)) return;
            let promoted=0, graduated=0;
            for (const s of selected) {
                const students = (state.students||[]).filter(st=>st.class_id===s.fromId&&st.status==='Active');
                for (const st of students) {
                    if (s.toName==='GRADUATED') {
                        await update('students', st.id, { status:'Graduated', class_id:null });
                        graduated++;
                    } else {
                        const toClass = (state.classes||[]).find(c=>c.name===s.toName);
                        if (toClass) { await update('students', st.id, { class_id:toClass.id }); promoted++; }
                    }
                }
            }
            await refreshTable('students');
            closeModal();
            showToast(`✅ Promoted ${promoted}, graduated ${graduated}`, 'success');
            renderClassManagement(document.getElementById('dynamic-content'));
        }


        // ── Expose all section-104 functions to window ────────────────────────
        const _s104 = [
            'refreshAccountantDashboard','promptPromoteStudents','doFullBackup',
            'viewAssessmentDetails','editAssessment','saveEditAssessment','lockAssessment',
            'openCreateAssessmentModal','createAssessmentFromModal','exportAssessmentsToExcel',
            'filterAssessmentsTable','onReportTypeChange','onReportTermChange',
            'loadReportStudents','generateReportCard','buildReportCardHTML',
            'printReportCard','exportReportPDF','generateAllReports',
            'saveGradingScale','resetGradingScale',
            'exportFinancialReportData','printFinancialReport',
            'exportClassBreakdown','exportCategoryBreakdown','exportTopPayers',
            'exportMonthlyTrend','exportClassCollection','exportCreditBalances','renderCreditTable',
            'previewCarryForward','executeCarryForward','exportCarryPreview','loadCarryHistory',
            'loadStatisticsData','exportStatisticsData','printStatisticsReport',
            'loadRankings','exportRankingsToExcel',
            'loadAnnualRegister','exportAnnualRegister','printAnnualRegister',
            'exportMarksAnalysis','printMarksAnalysis','exportAnalyticsReport',
            'submitEnrollStudent','switchStudentTab','updatePreviewRow','removePreviewRow',
            'togglePromotionClass','toggleSelectAll','previewFullPromotion','executeFullPromotion',
            'loadTimetableData','toggleTimetableView','printTimetable',
            'loadTeacherTimetable','exportTeacherTimetable','printTeacherTimetable',
            'loadStaffTimetableData','exportStaffTimetable','printStaffTimetable',
            'exportTimetableToExcel','exportTimetableTemplate','openImportTimetableModal',
            'processTimetableImport',
            'loadAttendanceSummary','exportAttendanceSummary',
            'loadAttendanceAnalytics','exportAttendanceAnalytics',
            'viewTeacherDetails','loadTeacherPerformance','exportTeacherPerformance','printTeacherPerformance',
            'filterNotifTab','markAnnouncementAsRead','openSendAnnouncementModal','sendAnnouncementFromModal',
            'saveSchoolSettings','previewSchoolLogo',
            'showFamilyTabFull','openCreateFamilyModalFull','createFamilyFull',
            'openLinkStudentModalFull','linkStudentToFamilyFull',
            'openEditFamilyModalFull','updateFamilyFull',
            'unlinkStudentFull','deleteFamilyFull','autoCreateFamilyForGroup',
            'executePromotion',
            'filterUnlinkedStudentsFull','filterTeacherPerformance',
            'openSmartWaiverModal','submitSmartWaiver',
            'renderStudentFeeStatus','exportFeeStatusList','printFeeStatusList'
        ];
        _s104.forEach(name => {
            try { if (typeof eval(name) === 'function') window[name] = eval(name); } catch(e) {}
        });


        // ============================================================
        // SECTION 105 — STUDENT FEE STATUS LIST
