// js/modules/marks.js
// Source lines: 15185–15801 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 21.1 — Marks Entry
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Main marks entry module.
         * Select class → select subject → select assessment → enter scores.
         * Supports offline saving to IndexedDB when no internet connection.
         */
        async function renderMarksEntry(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks.</div>';
                return;
            }

            await ensureStateLoaded();

            const user = getCurrentUser();
            const termObj = state.currentTerm;
            const phase = getCurrentPhase(termObj);

            let availClasses = (state.classes || []).filter(c => c.is_active !== false);

            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                availClasses = availClasses.filter(c => classIds.includes(c.id));
                if (availClasses.length === 0) {
                    container.innerHTML = `<div class="alert alert-warning">You have not been assigned to any classes.</div>`;
                    return;
                }
            }

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">✏️ MARKS ENTRY</span>
                                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                    <span style="padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700;${phase === 'pre_midterm' ? 'background:#dbeafe;color:#1e40af' : 'background:#d1fae5;color:#065f46'}">
                                        ${phase === 'pre_midterm' ? '📋 PRE-MIDTERM PHASE' : '📝 POST-MIDTERM PHASE'}
                                    </span>
                                    <span style="font-size:.75rem;color:var(--text-muted)">${termObj?.name || ''} — ${state.schoolSettings.current_year || ''}</span>
                                    <button class="btn btn-sm btn-outline" onclick="window.showExistingAssessments()">📋 Existing</button>
                                </div>
                            </div>
                            <div class="dash-card-body">
                                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;align-items:end">
                                    <div class="form-group" style="margin:0">
                                        <label>Class *</label>
                                        <select id="me-class" onchange="window.loadMESubjectsAndStudents()">
                                            <option value="">— Select —</option>
                                            ${availClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group" style="margin:0">
                                        <label>Subject *</label>
                                        <select id="me-subject" onchange="window.updateMEMaxFromSubject()">
                                            <option value="">— Select class first —</option>
                                        </select>
                                    </div>
                                    <div class="form-group" style="margin:0">
                                        <label>Type *</label>
                                        <select id="me-type" onchange="window.updateMEMaxFromSubject()">
                                            <option value="Quiz">Quiz</option>
                                            <option value="Assignment">Assignment</option>
                                            <option value="Mid-term">Mid-term</option>
                                            ${phase === 'post_midterm' ? `
                                                <option value="Exam">Exam</option>
                                                <option value="Final Exam">Final Exam</option>
                                            ` : `
                                                <option value="Exam" disabled style="color:var(--text-muted)">Exam (post-midterm only)</option>
                                            `}
                                        </select>
                                    </div>
                                    <div class="form-group" style="margin:0">
                                        <label>Name *</label>
                                        <input type="text" id="me-name" placeholder="e.g. Quiz 3">
                                    </div>
                                    <div class="form-group" style="margin:0">
                                        <label>Max Marks</label>
                                        <input type="number" id="me-max" value="50" min="1" max="200">
                                    </div>
                                    <div class="form-group" style="margin:0">
                                        <label>Date</label>
                                        <input type="date" id="me-date" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                </div>
                                <div style="margin-top:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem">
                                        <input type="checkbox" id="me-lock-after"> Lock after saving
                                    </label>
                                    <button class="btn btn-primary" onclick="window.loadMEStudentsTable()">📋 Load Students</button>
                                    <input type="hidden" id="me-due" value="">
                                </div>
                            </div>
                        </div>

                        <div class="dash-card" id="me-table-card" style="display:none">
                            <div class="dash-card-header">
                                <span class="dash-card-title" id="me-table-title">📝 Student Marks</span>
                                <span id="me-summary" style="font-size:.82rem;color:var(--text-muted)"></span>
                            </div>
                            <div class="dash-card-body" style="padding:0">
                                <div class="table-wrapper">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th style="width:40px;text-align:center">#</th>
                                                <th>Student Name</th>
                                                <th style="width:110px;text-align:center">Score</th>
                                                <th style="width:60px;text-align:center">/ Max</th>
                                                <th style="width:100px;text-align:center">% Grade</th>
                                                <th style="width:80px;text-align:center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody id="me-tbody"></tbody>
                                    </table>
                                </div>
                                <div id="me-pagination" class="pagination" style="padding:12px;border-top:1px solid var(--border-light)"></div>
                                <div id="me-offline-notice" style="display:none;padding:10px 16px;background:var(--warning-bg);border-top:1px solid var(--border-light);font-size:.85rem;color:var(--warning)">
                                    📴 Offline — marks will sync when connection restores.
                                </div>
                            </div>
                            <div style="position:sticky;bottom:0;z-index:10;padding:12px 16px;border-top:1px solid var(--border-light);background:var(--bg-primary);display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 -2px 8px rgba(0,0,0,.08)">
                                <button class="btn btn-success" id="me-save-btn" onclick="window.saveMarks()">💾 Save to DB</button>
                                <button class="btn btn-outline" onclick="window.clearMarksTable()">🗑️ Clear</button>
                                <button class="btn btn-outline" onclick="window.importMarksExcel()">📤 Import Excel</button>
                                <button class="btn btn-outline" onclick="window.exportMarksExcel()">📥 Export Excel</button>
                                <span id="me-status-label" style="margin-left:auto;font-size:.82rem;color:var(--text-muted)"></span>
                            </div>
                        </div>
                    `;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 21.2 — Marks Database
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Browse and search all marks records with filters for class,
         * subject, assessment, and student. Export to Excel.
         */
        async function renderMarksDatabase(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks.</div>';
                return;
            }

            await ensureStateLoaded();

            const user = getCurrentUser();
            let availableClasses = (state.classes || []).filter(c => c.is_active !== false);

            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                availableClasses = availableClasses.filter(c => classIds.includes(c.id));
                if (availableClasses.length === 0) {
                    container.innerHTML = `<div class="alert alert-warning">You have not been assigned to any classes.</div>`;
                    return;
                }
            }

            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header">
                                <span class="dash-card-title">🗄️ Marks Database</span>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline" onclick="window.refreshMarksData()">🔄 Refresh</button>
                                    <button class="btn btn-sm btn-outline" onclick="window.exportAllMarksToExcel()">📤 Export All</button>
                                </div>
                            </div>
                            <div class="dash-card-body">
                                <div class="filters-bar">
                                    <select id="db-class" onchange="window.loadDatabaseSubjects()" style="padding:8px 12px;border-radius:8px">
                                        <option value="">-- Select Class --</option>
                                        ${availableClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                    </select>
                                    <select id="db-subject" onchange="window.loadDatabaseAssessments()" style="padding:8px 12px;border-radius:8px">
                                        <option value="">-- Select Subject --</option>
                                    </select>
                                    <select id="db-assessment" style="padding:8px 12px;border-radius:8px">
                                        <option value="">-- Select Assessment --</option>
                                    </select>
                                    <button class="btn btn-primary" onclick="window.loadMarksDatabase()">🔍 Load Marks</button>
                                </div>
                                <div id="marks-database-content">
                                    <div class="alert alert-info" style="text-align:center;padding:40px">👆 Select a class, subject, and assessment to view marks</div>
                                </div>
                            </div>
                        </div>
                    `;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 21.3 — Marks Analysis
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Statistical analysis of marks: grade distribution charts,
         * class average trends, subject comparisons, and performance heatmap.
         */
        async function renderMarksAnalysis(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks analysis.</div>';
                return;
            }

            await ensureStateLoaded();

            let classes = (state.classes || []).filter(c => c.is_active !== false);
            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                classes = classes.filter(c => classIds.includes(c.id));
            }

            const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📈 Marks Analysis / Analyse des Notes</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="exportMarksAnalysis()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="printMarksAnalysis()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="analysis-class" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="analysis-subject" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px">
                                <option value="">All Subjects</option>
                                ${(state.subjects || []).filter(s => s.is_active !== false).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                            </select>
                            <select id="analysis-term" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px">
                                ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-primary" onclick="loadAnalysisData()">📊 Load Analysis</button>
                        </div>
                        <div id="analysis-content">
                            <div class="loading-container"><div class="spinner"></div><p>Loading analysis...</p></div>
                        </div>
                    </div>
                </div>
            `;

            await loadAnalysisData();
        }



        // ──────────────────────────────────────────────────────────────────────
        // loadAnalysisData — global wrapper called by renderMarksAnalysis filters
        // ──────────────────────────────────────────────────────────────────────

        /**
         * Load and render the marks analysis data into #analysis-content.
         * Reads current filter values from the DOM, calculates per-assessment
         * statistics, and draws bar + grade distribution charts.
         */
        window.loadAnalysisData = async function loadAnalysisData() {
            const classId   = document.getElementById('analysis-class')?.value;
            const subjectId = document.getElementById('analysis-subject')?.value;
            const termId    = document.getElementById('analysis-term')?.value;
            const div       = document.getElementById('analysis-content');
            if (!div) return;

            div.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Calculating…</p></div>';

            let assessments = (state.assessments || []);
            if (termId)    assessments = assessments.filter(a => a.term_id    == termId);
            if (classId)   assessments = assessments.filter(a => a.class_id   == classId);
            if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);

            if (!assessments.length) {
                div.innerHTML = '<div class="alert alert-info">No assessments found for the selected filters.</div>';
                return;
            }

            const aIds  = assessments.map(a => a.id);
            const marks = (state.marks || []).filter(m => aIds.includes(m.assessment_id));

            // Per-assessment statistics
            const stats = assessments.map(a => {
                const aMarks = marks.filter(m => m.assessment_id === a.id);
                const scores = aMarks.map(m => m.score);
                const avg    = scores.length ? scores.reduce((s,v)=>s+v,0)/scores.length : 0;
                const pcts   = scores.map(s => (s/a.max_marks)*100);
                const pass   = pcts.filter(p=>p>=50).length;
                const median = scores.length ? (() => {
                    const sorted=[...scores].sort((a,b)=>a-b);
                    const mid=Math.floor(sorted.length/2);
                    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
                })() : 0;
                return {
                    id:a.id, name:a.assessment_name, type:a.assessment_type, maxMarks:a.max_marks,
                    avgScore:avg, avgPct:(avg/a.max_marks)*100,
                    median, count:scores.length,
                    highest:scores.length?Math.max(...scores):0,
                    lowest: scores.length?Math.min(...scores):0,
                    passRate:scores.length?(pass/scores.length)*100:0
                };
            });

            // Overall grade distribution
            const allPcts = marks.map(m => {
                const a = assessments.find(x=>x.id===m.assessment_id);
                return a ? (m.score/a.max_marks)*100 : null;
            }).filter(v=>v!==null);
            const gDist = {'A+':0,'A':0,'B':0,'C':0,'D':0,'F':0};
            allPcts.forEach(p=>{ const g=getGrade(p); if(g in gDist) gDist[g]++; });

            div.innerHTML = `
                <div class="two-col" style="margin-bottom:16px">
                    <div class="dash-card">
                        <div class="dash-card-header"><span class="dash-card-title">📊 Average % per Assessment</span></div>
                        <div class="dash-card-body"><canvas id="analysis-bar-chart" height="220"></canvas></div>
                    </div>
                    <div class="dash-card">
                        <div class="dash-card-header"><span class="dash-card-title">🥧 Grade Distribution</span></div>
                        <div class="dash-card-body"><canvas id="analysis-pie-chart" height="220"></canvas></div>
                    </div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-header"><span class="dash-card-title">📋 Assessment Details</span></div>
                    <div class="dash-card-body" style="padding:0">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr>
                                    <th>Assessment</th><th>Type</th><th>Max</th>
                                    <th>Avg Score</th><th>Avg %</th><th>Median</th>
                                    <th>High</th><th>Low</th><th>Pass Rate</th><th>Students</th>
                                </tr></thead>
                                <tbody>
                                    ${stats.map(s=>`<tr>
                                        <td><strong>${esc(s.name)}</strong></td>
                                        <td><span class="badge badge-neutral">${esc(s.type)}</span></td>
                                        <td>${s.maxMarks}</td>
                                        <td>${s.avgScore.toFixed(1)}</td>
                                        <td><span class="badge ${getGradeClass(s.avgPct)}">${s.avgPct.toFixed(1)}%</span></td>
                                        <td>${s.median.toFixed(1)}</td>
                                        <td>${s.highest}</td><td>${s.lowest}</td>
                                        <td>${s.passRate.toFixed(1)}%</td>
                                        <td>${s.count}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;

            // Draw charts
            setTimeout(() => {
                const barCtx = document.getElementById('analysis-bar-chart')?.getContext('2d');
                if (barCtx && stats.length) {
                    if (window._analysisBarChart) window._analysisBarChart.destroy();
                    window._analysisBarChart = new Chart(barCtx, {
                        type:'bar',
                        data:{
                            labels: stats.map(s=>s.name.length>15?s.name.slice(0,12)+'…':s.name),
                            datasets:[{ label:'Average %', data:stats.map(s=>s.avgPct),
                                backgroundColor:'rgba(59,130,246,.65)', borderColor:'#3b82f6',
                                borderWidth:1, borderRadius:6 }]
                        },
                        options:{ responsive:true, scales:{ y:{min:0,max:100} },
                            plugins:{ tooltip:{ callbacks:{ label:ctx=>`${ctx.raw.toFixed(1)}%` }}}}
                    });
                }
                const pieCtx = document.getElementById('analysis-pie-chart')?.getContext('2d');
                if (pieCtx && Object.values(gDist).some(v=>v>0)) {
                    if (window._analysisPieChart) window._analysisPieChart.destroy();
                    window._analysisPieChart = new Chart(pieCtx, {
                        type:'doughnut',
                        data:{
                            labels: Object.keys(gDist),
                            datasets:[{ data:Object.values(gDist),
                                backgroundColor:['#10b981','#34d399','#60a5fa','#fbbf24','#f97316','#ef4444'],
                                borderWidth:0 }]
                        },
                        options:{ responsive:true, plugins:{ legend:{ position:'right' }}}
                    });
                }
            }, 120);
        };


        // ──────────────────────────────────────────────────────────────────────
        // 21.4 — Marks Import / Export
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Bulk import marks from Excel template; bulk export marks to Excel.
         * Template download included.
         */
        async function renderMarksImportExport(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>📥 Marks Import / Export</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. 
                        Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 21.5 — Assessment Export
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Export assessment data with full mark sheets for printing.
         */
        async function renderAssessmentExport(container) {
            await ensureStateLoaded();

            const user = state.currentUser;
            const classes = state.classes.filter(c => c.is_active !== false);
            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
            const subjects = state.subjects.filter(s => s.is_active !== false);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📤 Export Assessments & Marks</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-info">
                            <strong>Export Options:</strong> Choose what data to export and in which format.
                        </div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>Export Type</label>
                                <select id="export-type" class="form-control" onchange="window.toggleExportOptions()">
                                    <option value="assessments">Assessments List</option>
                                    <option value="marks_by_assessment">Marks by Assessment</option>
                                    <option value="marks_by_student">Marks by Student</option>
                                    <option value="summary">Assessment Summary Report</option>
                                </select>
                            </div>

                            <div class="form-group" id="export-class-group">
                                <label>Class</label>
                                <select id="export-class" class="form-control">
                                    <option value="">All Classes</option>
                                    ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" id="export-subject-group" style="display:none">
                                <label>Subject</label>
                                <select id="export-subject" class="form-control">
                                    <option value="">All Subjects</option>
                                    ${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" id="export-term-group">
                                <label>Term</label>
                                <select id="export-term" class="form-control">
                                    <option value="">All Terms</option>
                                    ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" id="export-assessment-group" style="display:none">
                                <label>Specific Assessment</label>
                                <select id="export-assessment" class="form-control">
                                    <option value="">-- Select Assessment --</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Format</label>
                                <select id="export-format" class="form-control">
                                    <option value="excel">Excel (.xlsx)</option>
                                    <option value="csv">CSV (.csv)</option>
                                    <option value="pdf">PDF Document</option>
                                </select>
                            </div>
                        </div>

                        <div class="btn-group" style="margin-top:20px">
                            <button class="btn btn-primary" onclick="window.executeAssessmentExport()">📥 Export Data</button>
                            <button class="btn btn-outline" onclick="window.resetExportForm()">🔄 Reset</button>
                        </div>

                        <div id="export-preview" class="table-wrapper" style="margin-top:20px;display:none"></div>
                    </div>
                </div>
            `;

            // Register functions
            window.toggleExportOptions = toggleExportOptions;
            window.executeAssessmentExport = executeAssessmentExport;
            window.resetExportForm = resetExportForm;

            // Event listeners for dynamic loading
            document.getElementById('export-class')?.addEventListener('change', loadAssessmentsForExport);
            document.getElementById('export-subject')?.addEventListener('change', loadAssessmentsForExport);
            document.getElementById('export-term')?.addEventListener('change', loadAssessmentsForExport);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 21.6 — Assessment Locking
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Lock/unlock assessments to prevent further mark changes.
         * Locked assessments are read-only in marks entry.
         */
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
                    <div class="dash-card-header">
                        <span class="dash-card-title">🔒 Assessment Locking Manager</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-warning" onclick="window.openBulkLockModal()">🔒 Bulk Lock/Unlock</button>
                            <button class="btn btn-sm btn-outline" onclick="window.refreshAssessmentList()">🔄 Refresh</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="lock-term-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()">
                                <option value="">All Terms</option>
                                ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                            </select>
                            <select id="lock-class-filter" class="form-control" style="width:150px" onchange="window.filterLockAssessments()">
                                <option value="">All Classes</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <input type="text" id="lock-search" class="form-control flex-1" placeholder="🔍 Search assessments..." oninput="window.filterLockAssessments()">
                            <span class="result-count" id="lock-count"></span>
                        </div>

                        <div class="table-wrapper" id="assessment-lock-table">
                            <div class="loading-container"><div class="spinner"></div><p>Loading assessments...</p></div>
                        </div>
                    </div>
                </div>

                <div class="dash-card" style="margin-top:20px">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📋 Locking Rules</span>
                    </div>
                    <div class="dash-card-body">
                        <div class="alert alert-info">
                            <strong>Locking Rules:</strong>
                            <ul style="margin-top:8px;margin-left:20px">
                                <li>🔒 <strong>Locked assessments</strong> cannot be edited by teachers</li>
                                <li>🔓 <strong>Unlocked assessments</strong> can be edited by assigned teachers</li>
                                <li>⏰ Assessments can be auto-locked when term ends (configure in Academic Calendar)</li>
                                <li>👑 Only administrators can lock/unlock assessments</li>
                            </ul>
                        </div>

                        <div class="form-group" style="margin-top:16px">
                            <label>Auto-lock after days past due date</label>
                            <div style="display:flex; gap:12px; align-items:center">
                                <input type="number" id="auto-lock-days" value="${state.schoolSettings.auto_lock_days || 7}" min="0" max="90" class="form-control" style="width:100px">
                                <button class="btn btn-sm btn-primary" onclick="window.saveAutoLockSettings()">💾 Save Setting</button>
                            </div>
                            <small class="field-hint">0 = disabled. Assessments will auto-lock X days after due date passes.</small>
                        </div>
                    </div>
                </div>
            `;

            // Register functions
            window.openBulkLockModal = openBulkLockModal;
            window.refreshAssessmentList = refreshAssessmentList;
            window.filterLockAssessments = filterLockAssessments;
            window.saveAutoLockSettings = saveAutoLockSettings;
            window.toggleAssessmentLock = toggleAssessmentLock;

            await refreshAssessmentList();
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 22 — ACADEMICS: CLASS REGISTER & STATISTICS
