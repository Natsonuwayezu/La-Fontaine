// js/modules/class-register.js
// Source lines: 15802–15953 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * Class register with 6 views: Pre-midterm, Post-midterm, Annual, Summary,
         * Grade Distribution, and Subject Analysis.
         * Includes print and Excel export for each view.
         */
        async function renderClassRegister(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access class register.</div>';
                return;
            }
            await ensureStateLoaded();

            const termObj = state.currentTerm;
            let classes = (state.classes || []).filter(c => c.is_active !== false);
            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                classes = classes.filter(c => classIds.includes(c.id));
            }
            container.innerHTML = `
                        <div class="dash-card">
                            <div class="dash-card-header" style="flex-wrap:wrap;gap:8px">
                                <span class="dash-card-title">📋 CLASS REGISTER</span>
                                <div class="btn-group" style="flex-wrap:wrap;gap:6px">
                                    <select id="cr-class-select" onchange="window.renderCRTable()">${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
                                    <select id="cr-term-select" onchange="window.renderCRTable()">${(state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id).map(t => `<option value="${t.id}" ${t.id === termObj?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="annual">📊 Annual / Annuel</option></select>
                                    <button class="btn btn-sm btn-outline" onclick="window.exportCRToExcel()">📤 Export</button>
                                </div>
                            </div>
                            <div class="dash-card-body" style="padding:0"><div id="cr-table-container"><div class="loading-container"><div class="spinner"></div><p>Loading register...</p></div></div></div>
                        </div>
                    `;
            await renderCRTable();
        }


        /**
         * School-wide and per-class statistics: pass rates, averages, rankings,
         * gender breakdown, and subject performance charts.
         */
        async function renderStatistics(container) {
            await ensureStateLoaded();
            const user = getCurrentUser();

            // Get available classes for teacher role
            let availableClasses = state.classes.filter(c => c.is_active !== false);
            if (user.role === 'teacher') {
                const assignments = await getAll('teacher_assignments', { teacher_id: user.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                availableClasses = availableClasses.filter(c => classIds.includes(c.id));
            }

            const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header" style="flex-wrap:wrap;gap:8px">
                        <span class="dash-card-title">📈 STATISTICS</span>
                        <div class="btn-group" style="flex-wrap:wrap;gap:6px">
                            <select id="stats-view-type" onchange="loadStatisticsData()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="by-class">By Class</option>
                                <option value="annual">Annual Comparison</option>
                                <option value="grade-distribution">Grade Distribution</option>
                                <option value="subject-analysis">Subject Analysis</option>
                            </select>
                            <select id="stats-class-filter" onchange="loadStatisticsData()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Classes</option>
                                ${availableClasses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <select id="stats-term-filter" onchange="loadStatisticsData()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                <option value="">All Terms</option>
                                ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="exportStatisticsData()">📤 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="printStatisticsReport()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="dash-card-body">
                        <div id="stats-content">
                            <div class="loading-container"><div class="spinner"></div><p>Loading statistics...</p></div>
                        </div>
                    </div>
                </div>
            `;

            await loadStatisticsData();
        }


        /**
         * Full-year register combining all three terms.
         * Shows annual total, grade, rank, and promotion status.
         */
        async function renderAnnualRegister(container) {
            if (isAccountant()) {
                container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access academic register.</div>';
                return;
            }

            await ensureStateLoaded();

            let classes = (state.classes || []).filter(c => c.is_active !== false);
            if (isTeacher()) {
                const assignments = await getAll('teacher_assignments', { teacher_id: getCurrentUser()?.id });
                const classIds = [...new Set(assignments.map(a => a.class_id))];
                classes = classes.filter(c => classIds.includes(c.id));
            }

            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header">
                        <span class="dash-card-title">📊 ANNUAL REGISTER / REGISTRE ANNUEL</span>
                        <div class="btn-group">
                            <select id="annual-class" onchange="loadAnnualRegister()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                                ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="exportAnnualRegister()">📤 Export</button>
                            <button class="btn btn-sm btn-outline" onclick="printAnnualRegister()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="dash-card-body" style="padding:0">
                        <div id="annual-register-container"><div class="loading-container"><div class="spinner"></div><p>Loading annual register...</p></div></div>
                    </div>
                </div>
            `;

            await loadAnnualRegister();
        }


        /**
         * Export the class register to formatted Excel or PDF.
         */
        async function renderRegisterExport(container) {
            if (!container) return;
            container.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-header"><h2>📋 Register Export</h2></div>
                    <div class="dash-card-body">
                        <p class="text-muted">This module provides utility functions used by other modules. Select a specific action from the relevant section.</p>
                    </div>
                </div>
            `;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 23 — ACADEMICS: ASSESSMENTS
