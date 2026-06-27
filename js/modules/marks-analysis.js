// SECTION 69: MARKS ANALYSIS
        // ================================================================

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
            <div class="dash-card-header"><span class="dash-card-title">📈 Marks Analysis / Analyse des Notes</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="exportMarksAnalysis()">📥 Export</button><button class="btn btn-sm btn-outline" onclick="printMarksAnalysis()">🖨️ Print</button></div></div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="analysis-class" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px"><option value="">All Classes</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
                    <select id="analysis-subject" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px"><option value="">All Subjects</option>${(state.subjects || []).filter(s => s.is_active !== false).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
                    <select id="analysis-term" onchange="loadAnalysisData()" style="padding:8px 12px;border-radius:8px">${terms.map(t => `<option value="${t.id}" ${t.id === state.currentTerm?.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
                    <button class="btn btn-primary" onclick="loadAnalysisData()">📊 Load Analysis</button>
                </div>
                <div id="analysis-content"><div class="loading-container"><div class="spinner"></div><p>Loading analysis...</p></div></div>
            </div>
        </div>
    `;

            await loadAnalysisData();
        }
        window.renderMarksAnalysis = renderMarksAnalysis;

        window.loadAnalysisData = async function loadAnalysisData() {
            const classId = document.getElementById('analysis-class')?.value;
            const subjectId = document.getElementById('analysis-subject')?.value;
            const termId = document.getElementById('analysis-term')?.value;
            const div = document.getElementById('analysis-content');
            if (!div) return;

            div.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Calculating…</p></div>';

            let assessments = (state.assessments || []);
            if (termId) assessments = assessments.filter(a => a.term_id == termId);
            if (classId) assessments = assessments.filter(a => a.class_id == classId);
            if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);

            if (!assessments.length) {
                div.innerHTML = '<div class="alert alert-info">No assessments found for the selected filters.</div>';
                return;
            }

            const aIds = assessments.map(a => a.id);
            const marks = (state.marks || []).filter(m => aIds.includes(m.assessment_id));

            const stats = assessments.map(a => {
                const aMarks = marks.filter(m => m.assessment_id === a.id);
                const scores = aMarks.map(m => m.score);
                const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
                const pcts = scores.map(s => (s / a.max_marks) * 100);
                const pass = pcts.filter(p => p >= 50).length;
                const median = scores.length ? (() => { const sorted = [...scores].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; })() : 0;
                return {
                    id: a.id, name: a.assessment_name, type: a.assessment_type, maxMarks: a.max_marks,
                    avgScore: avg, avgPct: (avg / a.max_marks) * 100,
                    median, count: scores.length,
                    highest: scores.length ? Math.max(...scores) : 0,
                    lowest: scores.length ? Math.min(...scores) : 0,
                    passRate: scores.length ? (pass / scores.length) * 100 : 0
                };
            });

            const allPcts = marks.map(m => { const a = assessments.find(x => x.id === m.assessment_id); return a ? (m.score / a.max_marks) * 100 : null; }).filter(v => v !== null);
            const gDist = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
            allPcts.forEach(p => { const g = getGrade(p); if (g in gDist) gDist[g]++; });

            div.innerHTML = `
        <div class="two-col" style="margin-bottom:16px">
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📊 Average % per Assessment</span></div><div class="dash-card-body"><canvas id="analysis-bar-chart" height="220"></canvas></div></div>
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">🥧 Grade Distribution</span></div><div class="dash-card-body"><canvas id="analysis-pie-chart" height="220"></canvas></div></div>
        </div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📋 Assessment Details</span></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Assessment</th><th>Type</th><th>Max</th><th>Avg Score</th><th>Avg %</th><th>Median</th><th>High</th><th>Low</th><th>Pass Rate</th><th>Students</th></tr></thead><tbody>${stats.map(s => `<tr><td><strong>${esc(s.name)}</strong></td><td><span class="badge badge-neutral">${esc(s.type)}</span></td><td>${s.maxMarks}</td><td>${s.avgScore.toFixed(1)}</td><td><span class="badge ${getGradeClass(s.avgPct)}">${s.avgPct.toFixed(1)}%</span></td><td>${s.median.toFixed(1)}</td><td>${s.highest}</td><td>${s.lowest}</td><td>${s.passRate.toFixed(1)}%</td><td>${s.count}</td></tr>`).join('')}</tbody></table></div></div>
    `;

            setTimeout(() => {
                const barCtx = document.getElementById('analysis-bar-chart')?.getContext('2d');
                if (barCtx && stats.length) {
                    if (window._analysisBarChart) window._analysisBarChart.destroy();
                    window._analysisBarChart = new Chart(barCtx, {
                        type: 'bar',
                        data: { labels: stats.map(s => s.name.length > 15 ? s.name.slice(0, 12) + '…' : s.name), datasets: [{ label: 'Average %', data: stats.map(s => s.avgPct), backgroundColor: 'rgba(59,130,246,.65)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6 }] },
                        options: { responsive: true, scales: { y: { min: 0, max: 100 } }, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(1)}%` } } } }
                    });
                }
                const pieCtx = document.getElementById('analysis-pie-chart')?.getContext('2d');
                if (pieCtx && Object.values(gDist).some(v => v > 0)) {
                    if (window._analysisPieChart) window._analysisPieChart.destroy();
                    window._analysisPieChart = new Chart(pieCtx, {
                        type: 'doughnut',
                        data: { labels: Object.keys(gDist), datasets: [{ data: Object.values(gDist), backgroundColor: ['#10b981', '#34d399', '#60a5fa', '#fbbf24', '#f97316', '#ef4444'], borderWidth: 0 }] },
                        options: { responsive: true, plugins: { legend: { position: 'right' } } }
                    });
                }
            }, 120);
        };

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
        window.exportMarksAnalysis = exportMarksAnalysis;

        function printMarksAnalysis() {
            const content = document.getElementById('analysis-content');
            if (!content) return;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html><head><title>Marks Analysis</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:7px}th{background:#1a3a5c;color:#fff}h2{text-align:center}@media print{body{padding:0}button{display:none}}</style></head><body><h2>ECOLE LA FONTAINE — Marks Analysis</h2><p style="text-align:center">${new Date().toLocaleDateString()}</p>${content.innerHTML}</body></html>`);
            w.document.close(); w.print();
        }
        window.printMarksAnalysis = printMarksAnalysis;

        // ================================================================
