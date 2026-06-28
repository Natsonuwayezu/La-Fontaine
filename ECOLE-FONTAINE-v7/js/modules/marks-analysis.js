// ============================================================
// MARKS ANALYSIS MODULE - Statistical analysis of marks
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtPct, getGrade, getGradeClass, esc, exportToExcel } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { createBarChart, createLineChart } from '../ui/charts.js';

// Render Marks Analysis page
export async function renderMarksAnalysis(container) {
    if (isAccountant()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access marks.</div>';
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
                <span class="dash-card-title">📈 Marks Analysis</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="exportMarksAnalysis()">📥 Export</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="analysis-class" onchange="loadAnalysisData()">
                        <option value="">All Classes</option>
                        ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <select id="analysis-subject" onchange="loadAnalysisData()">
                        <option value="">All Subjects</option>
                        ${(state.subjects || []).filter(s => s.is_active !== false).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                    </select>
                    <select id="analysis-term" onchange="loadAnalysisData()">
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

// Load analysis data
window.loadAnalysisData = async function () {
    const classId = document.getElementById('analysis-class')?.value;
    const subjectId = document.getElementById('analysis-subject')?.value;
    const termId = document.getElementById('analysis-term')?.value;
    const container = document.getElementById('analysis-content');

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Calculating statistics...</p></div>';

    // Filter assessments
    let assessments = (state.assessments || []).filter(a => a.term_id == termId);
    if (classId) assessments = assessments.filter(a => a.class_id == classId);
    if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);

    if (assessments.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No assessments found for the selected filters.</div>';
        return;
    }

    // Collect all marks
    const assessmentIds = assessments.map(a => a.id);
    const marks = (state.marks || []).filter(m => assessmentIds.includes(m.assessment_id));

    // Calculate statistics per assessment
    const assessmentStats = assessments.map(assessment => {
        const assessmentMarks = marks.filter(m => m.assessment_id === assessment.id);
        const scores = assessmentMarks.map(m => m.score);
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const maxScore = scores.length ? Math.max(...scores) : 0;
        const minScore = scores.length ? Math.min(...scores) : 0;
        const passCount = scores.filter(s => (s / assessment.max_marks) * 100 >= 50).length;
        const passRate = scores.length ? (passCount / scores.length) * 100 : 0;

        return {
            name: assessment.assessment_name,
            type: assessment.assessment_type,
            maxMarks: assessment.max_marks,
            avgScore: avgScore,
            avgPercentage: (avgScore / assessment.max_marks) * 100,
            maxScore: maxScore,
            minScore: minScore,
            passRate: passRate,
            studentCount: scores.length
        };
    });

    // Calculate grade distribution
    const allPercentages = [];
    for (const assessment of assessments) {
        const assessmentMarks = marks.filter(m => m.assessment_id === assessment.id);
        for (const mark of assessmentMarks) {
            allPercentages.push((mark.score / assessment.max_marks) * 100);
        }
    }

    const gradeCount = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    for (const pct of allPercentages) {
        const grade = getGrade(pct);
        if (gradeCount.hasOwnProperty(grade)) gradeCount[grade]++;
    }

    // Create HTML
    container.innerHTML = `
        <div class="two-col">
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">📊 Assessment Performance</span></div>
                <div class="dash-card-body"><canvas id="assessment-bar-chart" height="250"></canvas></div>
            </div>
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">🥧 Grade Distribution</span></div>
                <div class="dash-card-body"><canvas id="grade-pie-chart" height="250"></canvas></div>
            </div>
        </div>
        <div class="dash-card">
            <div class="dash-card-header"><span class="dash-card-title">📋 Assessment Details</span></div>
            <div class="dash-card-body" style="padding:0">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Assessment</th><th>Type</th><th>Max</th><th>Avg Score</th><th>Avg %</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Students</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assessmentStats.map(s => `
                                <tr>
                                    <td><strong>${esc(s.name)}</strong></td>
                                    <td>${esc(s.type)}</span>
                                    <td>${s.maxMarks}</span>
                                    <td>${s.avgScore.toFixed(1)}</span>
                                    <td><span class="badge ${getGradeClass(s.avgPercentage)}">${s.avgPercentage.toFixed(1)}%</span></span>
                                    <td>${s.maxScore}</span>
                                    <td>${s.minScore}</span>
                                    <td>${s.passRate.toFixed(1)}%</span>
                                    <td>${s.studentCount}</span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Create charts
    setTimeout(() => {
        const barCtx = document.getElementById('assessment-bar-chart')?.getContext('2d');
        if (barCtx && assessmentStats.length) {
            createBarChart('assessment-bar-chart',
                assessmentStats.map(s => s.name.length > 15 ? s.name.substring(0, 12) + '...' : s.name),
                [{
                    label: 'Average %',
                    data: assessmentStats.map(s => s.avgPercentage),
                    backgroundColor: 'rgba(59,130,246,0.6)',
                    borderRadius: 6
                }],
                { scales: { y: { min: 0, max: 100, title: { display: true, text: 'Percentage (%)' } } } }
            );
        }

        const pieCtx = document.getElementById('grade-pie-chart')?.getContext('2d');
        if (pieCtx && Object.values(gradeCount).some(v => v > 0)) {
            new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['A+', 'A', 'B', 'C', 'D', 'F'],
                    datasets: [{
                        data: [gradeCount['A+'], gradeCount['A'], gradeCount['B'], gradeCount['C'], gradeCount['D'], gradeCount['F']],
                        backgroundColor: ['#10b981', '#34d399', '#60a5fa', '#fbbf24', '#f97316', '#ef4444']
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'right' } } }
            });
        }
    }, 100);
};

// Export marks analysis
window.exportMarksAnalysis = async function () {
    const classId = document.getElementById('analysis-class')?.value;
    const subjectId = document.getElementById('analysis-subject')?.value;
    const termId = document.getElementById('analysis-term')?.value;

    let assessments = (state.assessments || []).filter(a => a.term_id == termId);
    if (classId) assessments = assessments.filter(a => a.class_id == classId);
    if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);

    const assessmentIds = assessments.map(a => a.id);
    const marks = (state.marks || []).filter(m => assessmentIds.includes(m.assessment_id));

    const data = assessments.map(assessment => {
        const assessmentMarks = marks.filter(m => m.assessment_id === assessment.id);
        const scores = assessmentMarks.map(m => m.score);
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const cls = getClassById(assessment.class_id);
        const sub = getSubjectById(assessment.subject_id);

        return {
            'Class': cls?.name,
            'Subject': sub?.name,
            'Assessment': assessment.assessment_name,
            'Type': assessment.assessment_type,
            'Max Marks': assessment.max_marks,
            'Average Score': avgScore.toFixed(1),
            'Average %': ((avgScore / assessment.max_marks) * 100).toFixed(1),
            'Highest Score': scores.length ? Math.max(...scores) : 0,
            'Lowest Score': scores.length ? Math.min(...scores) : 0,
            'Students Assessed': scores.length,
            'Pass Rate %': scores.length ? (scores.filter(s => (s / assessment.max_marks) * 100 >= 50).length / scores.length * 100).toFixed(1) : 0
        };
    });

    exportToExcel(data, `Marks_Analysis_Term_${termId}`);
    showToast('✅ Analysis exported', 'success');
};

// Helper functions


async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.subjects.length) await refreshTable('subjects');
    if (!state.assessments.length) await refreshTable('assessments');
}