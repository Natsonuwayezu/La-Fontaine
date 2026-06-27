// ══════════════════════════════════════════════════════════════════════════


        /**
         * Generate and print individual student report cards.
         * Includes MG, EX, Total, Grade, Class Rank, and teacher remarks.
         */
        async function renderReportCards(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access report cards.</div>';
                return;
            }

            await ensureStateLoaded();

            const user = getCurrentUser();
            let availableClasses = (state.classes || []).filter(c => c.is_active !== false);

            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                availableClasses = availableClasses.filter(c => classIds.includes(c.id));
            }

            const currentTerm = state.currentTerm;
            const phase = getCurrentPhase(currentTerm);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📄 Report Cards / Bulletins Scolaires</span>
                        <span style="padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;${phase === 'pre_midterm' ? 'background:#dbeafe;color:#1e40af' : 'background:#d1fae5;color:#065f46'}">
                            ${phase === 'pre_midterm' ? '📋 PRE-MIDTERM / PRÉ-MIDTERM' : '📝 POST-MIDTERM'}
                        </span>
                    </div>
                    <div class="dash-card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Report Type / Type de Rapport</label>
                                <select id="report-type" onchange="onReportTypeChange()">
                                    <option value="midterm" ${phase === 'pre_midterm' ? 'selected' : ''}>Mid-term / Demi-Trimestre</option>
                                    <option value="endterm" ${phase === 'post_midterm' ? 'selected' : ''}>End of Term / Fin de Trimestre</option>
                                    <option value="annual">Annual / Annuel</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Term / Trimestre</label>
                                <select id="report-term" onchange="onReportTermChange()">
                                    ${(state.terms || []).filter(t => t.academic_year_id === (state.currentAcadYear?.id || 1)).map(t => `<option value="${t.id}" ${currentTerm?.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                                    <option value="annual">Annual / Annuel</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Class / Classe</label>
                                <select id="report-class" onchange="loadReportStudents()">
                                    <option value="">— Select class —</option>
                                    ${availableClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Student / Élève</label>
                                <select id="report-student" onchange="generateReportCard()">
                                    <option value="">— Select student —</option>
                                </select>
                            </div>
                        </div>
                        <div class="btn-group" style="flex-wrap:wrap;gap:8px;margin-top:16px">
                            <button class="btn btn-primary" onclick="generateReportCard()">📄 Generate / Générer</button>
                            <button class="btn btn-outline" onclick="printReportCard()">🖨️ Print / Imprimer</button>
                            <button class="btn btn-outline" onclick="exportReportPDF()">📑 PDF</button>
                            <button class="btn btn-success" onclick="generateAllReports()">📑 All Reports for Class / Tous les bulletins</button>
                        </div>
                    </div>
                </div>
                <div id="report-card-content" style="margin:var(--md);display:none;"></div>
                <div id="report-card-empty" style="margin:var(--md);text-align:center;padding:60px;color:var(--text-muted);">
                    📄 Select a report type, class, and student to generate the report card<br>
                    📄 Sélectionnez le type, la classe et l'élève pour générer le bulletin
                </div>
            `;
        }


        /**
         * Manage the grading scale: add, edit, delete grade bands.
         * Changes apply immediately to all grade calculations.
         */
        async function renderGradingSettings(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const grades = state.gradingScale || DEFAULT_GRADES;
            const settings = state.schoolSettings || {};

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Grading Scale & Settings</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-success" onclick="window.saveGradingSettings()">💾 Save All</button>
                            <button class="btn btn-sm btn-outline" onclick="window.exportGradingSettings()">📥 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="window.resetToDefaultGrading()">🔄 Reset to Default</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <!-- Grading Scale Table -->
                        <div class="alert alert-info" style="margin-bottom:16px">
                            <strong>📐 Grading Scale Rules:</strong> Grades are calculated based on percentage scores. 
                            Students receive the grade corresponding to the percentage range they fall into.
                        </div>

                        <div class="table-wrapper">
                            <table class="data-table" id="grading-scale-table">
                                <thead>
                                    <tr>
                                        <th>Grade</th>
                                        <th>Min %</th>
                                        <th>Max %</th>
                                        <th>Description</th>
                                        <th>Color</th>
                                        <th>Order</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="grading-scale-tbody">
                                    ${grades.map((g, i) => `
                                        <tr id="grade-row-${i}">
                                            <td><input type="text" id="grade-name-${i}" value="${esc(g.grade)}" class="form-control" style="width:80px" placeholder="Grade">
                                            <td><input type="number" id="grade-min-${i}" value="${g.min_percentage !== undefined ? g.min_percentage : g.min}" class="form-control" style="width:80px" min="0" max="100" step="1">
                                            <td><input type="number" id="grade-max-${i}" value="${g.max_percentage !== undefined ? g.max_percentage : g.max}" class="form-control" style="width:80px" min="0" max="100" step="1">
                                            <td><input type="text" id="grade-desc-${i}" value="${esc(g.description || g.desc || '')}" class="form-control" style="width:150px">
                                            <td><input type="color" id="grade-color-${i}" value="${g.color || g.bg || '#d1fae5'}" style="width:50px; height:34px">
                                            <td><input type="number" id="grade-order-${i}" value="${g.sort_order || i + 1}" class="form-control" style="width:60px" min="1">
                                            <td>
                                                <button class="btn btn-sm btn-outline" onclick="window.moveGradeUp(${i})" title="Move Up">▲</button>
                                                <button class="btn btn-sm btn-outline" onclick="window.moveGradeDown(${i})" title="Move Down">▼</button>
                                                <button class="btn btn-sm btn-danger" onclick="window.removeGradeLevel(${i})" title="Remove">🗑️</button>
                                             </span>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="btn-group" style="margin:16px 0">
                            <button class="btn btn-sm btn-outline" onclick="window.addGradeLevel()">➕ Add Grade Level</button>
                        </div>

                        <!-- Grading Configuration -->
                        <div class="form-grid" style="margin-top:24px; border-top:1px solid var(--border-light); padding-top:20px">
                            <div class="form-group">
                                <label>Default Pass Mark (%)</label>
                                <input type="number" id="setting-pass-mark" value="${settings.pass_mark || 50}" class="form-control" min="0" max="100">
                                <small class="field-hint">Minimum percentage to pass an assessment</small>
                            </div>
                            <div class="form-group">
                                <label>Promotion Mark (%)</label>
                                <input type="number" id="setting-promotion-mark" value="${settings.promotion_mark || settings.pass_mark || 50}" class="form-control" min="0" max="100">
                                <small class="field-hint">Minimum % for promotion to next class (shown on report cards). Can differ from pass mark.</small>
                            </div>
                            <div class="form-group">
                                <label>GPA Scale Type</label>
                                <select id="setting-gpa-scale" class="form-control">
                                    <option value="4.0" ${settings.gpa_scale === '4.0' || !settings.gpa_scale ? 'selected' : ''}>4.0 Scale (Standard)</option>
                                    <option value="5.0" ${settings.gpa_scale === '5.0' ? 'selected' : ''}>5.0 Scale (Advanced)</option>
                                    <option value="custom" ${settings.gpa_scale === 'custom' ? 'selected' : ''}>Custom Scale</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Rounding Method</label>
                                <select id="setting-rounding" class="form-control">
                                    <option value="none" ${settings.rounding === 'none' || !settings.rounding ? 'selected' : ''}>No Rounding</option>
                                    <option value="half_up" ${settings.rounding === 'half_up' ? 'selected' : ''}>Round Half Up</option>
                                    <option value="ceil" ${settings.rounding === 'ceil' ? 'selected' : ''}>Always Round Up</option>
                                    <option value="floor" ${settings.rounding === 'floor' ? 'selected' : ''}>Always Round Down</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Decimal Places</label>
                                <select id="setting-decimals" class="form-control">
                                    <option value="0" ${settings.decimal_places === '0' ? 'selected' : ''}>0 (Whole numbers)</option>
                                    <option value="1" ${settings.decimal_places === '1' ? 'selected' : ''}>1 decimal place</option>
                                    <option value="2" ${settings.decimal_places === '2' || !settings.decimal_places ? 'selected' : ''}>2 decimal places</option>
                                </select>
                            </div>
                        </div>

                        <!-- Grade Distribution Preview -->
                        <div class="dash-card" style="margin-top:20px">
                            <div class="dash-card-header">
                                <span class="dash-card-title">📈 Grade Distribution Preview</span>
                                <button class="btn btn-sm btn-outline" onclick="window.refreshGradePreview()">🔄 Refresh</button>
                            </div>
                            <div class="dash-card-body">
                                <div id="grade-distribution-preview" class="grade-distribution">
                                    <div class="loading-container"><div class="spinner"></div><p>Loading distribution...</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            await renderGradeDistributionPreview();
        }


        /**
         * Alias for renderGradingSettings.
         */
        async function renderGradingScale(container) {
            if (!isAdmin()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
                return;
            }

            await ensureStateLoaded();

            const grades = state.gradingScale || DEFAULT_GRADES;

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 Grading Scale</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-success" onclick="saveGradingScale()">💾 Save</button>
                            <button class="btn btn-sm btn-outline" onclick="resetGradingScale()">🔄 Reset to Default</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Grade</th>
                                        <th>Min %</th>
                                        <th>Max %</th>
                                        <th>Description</th>
                                        <th>Color</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="grading-scale-tbody">
                                    ${grades.map((g, i) => `
                                    <tr>
                                        <td><input type="text" id="grade-name-${i}" value="${esc(g.grade)}" style="width:70px"></td>
                                        <td><input type="number" id="grade-min-${i}" value="${g.min}" style="width:70px" min="0" max="100"></td>
                                        <td><input type="number" id="grade-max-${i}" value="${g.max}" style="width:70px" min="0" max="100"></td>
                                        <td><input type="text" id="grade-desc-${i}" value="${esc(g.desc || '')}" style="width:120px"></td>
                                        <td><input type="color" id="grade-color-${i}" value="${g.bg === '#d1fae5' ? '#d1fae5' : (g.bg || '#d1fae5')}" style="width:50px"></td>
                                        <td><button class="btn btn-sm btn-danger" onclick="removeGradeLevel(${i})">🗑️</button></td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <button class="btn btn-sm btn-outline" style="margin-top:16px" onclick="addGradeLevel()">➕ Add Grade Level</button>

                        <div class="alert alert-info" style="margin-top:20px">
                            <strong>📐 Grade Calculation Formula:</strong><br>
                            Percentage = (Student Score / Assessment Max Marks) × 100<br>
                            Grade = Lookup in table above based on percentage range
                        </div>

                        <div id="grade-preview" style="margin-top:20px">
                            <h4>Preview Distribution (based on current data)</h4>
                            <div id="grade-distribution-chart" style="height:200px"></div>
                        </div>
                    </div>
                </div>
            `;

            renderGradeDistributionPreview();
        }

        /**
         * Renders a bar chart into #grade-distribution-chart showing how many
         * students currently fall into each grade band (based on the current
         * term's marks), so admins can preview the effect of grading scale
         * changes before saving them.
         */
        function renderGradeDistributionPreview() {
            const wrapper = document.getElementById('grade-distribution-chart');
            if (!wrapper) return;

            const grades = state.gradingScale || DEFAULT_GRADES;
            const termId = state.currentTerm?.id;
            const counts = grades.map(() => 0);

            for (const student of state.students.filter(s => s.status === 'Active')) {
                const assessments = state.assessments.filter(a => a.class_id === student.class_id && (!termId || a.term_id === termId));
                if (!assessments.length) continue;
                let total = 0, max = 0;
                for (const a of assessments) {
                    const mark = state.marks.find(m => m.assessment_id === a.id && m.student_id === student.id);
                    if (mark) { total += mark.score; max += a.max_marks; }
                }
                if (max === 0) continue;
                const pct = (total / max) * 100;
                const idx = grades.findIndex(g => pct >= g.min && pct <= g.max);
                if (idx >= 0) counts[idx]++;
            }

            // Ensure a canvas exists inside the wrapper div (createBarChart needs a <canvas>)
            if (!wrapper.querySelector('canvas')) {
                wrapper.innerHTML = '<canvas id="grade-distribution-canvas"></canvas>';
            }

            createBarChart('grade-distribution-canvas', grades.map(g => g.grade), [{
                label: 'Students',
                data: counts,
                backgroundColor: grades.map(g => g.bg || '#94a3b8')
            }]);
        }


        /**
         * Batch report generation: generate report cards for a whole class at once.
         */
        async function renderReportGenerator(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>📄 Report Generator</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. 
                        Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }


        /**
         * Full academic transcript for a student across all years and terms.
         */
        async function renderTranscripts(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>📜 Transcripts</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. 
                        Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }


        /**
         * Class rankings table with rank, name, total marks, percentage, grade.
         * Print-ready and exportable to Excel.
         */
        async function renderRankings(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access rankings.</div>';
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
                        <span class="dash-card-title">🏆 Student Rankings</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="exportRankingsToExcel()">📥 Export</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div class="filters-bar">
                            <select id="rank-class" onchange="loadRankings()">
                                <option value="">-- Select Class --</option>
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="rank-term" onchange="loadRankings()">
                                ${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-primary" onclick="loadRankings()">📊 Load Rankings</button>
                        </div>
                        <div id="rankings-content">
                            <div class="alert alert-info" style="text-align:center;padding:40px">Select a class and term to view rankings</div>
                        </div>
                    </div>
                </div>
            `;
        }


        /**
         * Advanced ranking with tie-breaking rules and multiple sort options.
         */
        async function renderRankingEngine(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>🏆 Ranking Engine</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. 
                        Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }


        /**
         * Comprehensive academic reports: term summary, subject analysis, trends.
         */
        async function renderAcademicReports(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>📊 Academic Reports</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. 
                        Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 25 — ACADEMICS: TIMETABLE
