// ============================================================
// ANNUAL REGISTER MODULE - Combined annual view of all terms
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAccountant } from '../core/auth.js';
import { fmt, fmtPct, getGrade, getGradeClass, esc, exportToExcel } from '../core/utils.js';
import { refreshTable } from '../core/data-loader.js';

// Render Annual Register (combined terms)
export async function renderAnnualRegister(container) {
    if (isAccountant()) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Accountant cannot access academic register.</div>';
        return;
    }

    await ensureStateLoaded();

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 ANNUAL REGISTER / REGISTRE ANNUEL</span>
                <div class="btn-group">
                    <select id="annual-class" onchange="loadAnnualRegister()" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">
                        ${(state.classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-outline" onclick="exportAnnualRegister()">📤 Export</button>
                </div>
            </div>
            <div class="dash-card-body" style="padding:0">
                <div id="annual-register-container"><div class="loading-container"><div class="spinner"></div><p>Loading annual register...</p></div></div>
            </div>
        </div>
    `;

    await loadAnnualRegister();
}

// Load annual register
window.loadAnnualRegister = async function () {
    const classId = parseInt(document.getElementById('annual-class')?.value);
    if (!classId) return;

    const cls = getClassById(classId);
    const isNursery = cls?.level === 'nursery' || cls?.level === 'Nursery';
    const container = document.getElementById('annual-register-container');

    container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading data...</p></div>';

    // Get all terms for current academic year
    const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.id - b.id);
    if (terms.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No terms found for current academic year.</div>';
        return;
    }

    const students = (state.students || []).filter(s => s.class_id === classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    let subjects = (state.subjects || []).filter(s => (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() && s.is_active !== false);
    subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    // Get assessments and marks for all terms
    const termAssessments = {};
    const termMarks = {};
    for (const term of terms) {
        termAssessments[term.id] = (state.assessments || []).filter(a => a.class_id === classId && a.term_id === term.id);
        const aIds = termAssessments[term.id].map(a => a.id);
        termMarks[term.id] = (state.marks || []).filter(m => aIds.includes(m.assessment_id));
    }

    // Calculate annual scores for each student
    const rows = students.map(st => {
        let annualMG = 0, annualEX = 0, annualTOT = 0, annualMax = 0;
        const subCells = subjects.map(sub => {
            let subAnnualMG = 0, subAnnualEX = 0, subAnnualTOT = 0;
            for (const term of terms) {
                const assess = termAssessments[term.id];
                const mks = termMarks[term.id];
                const { mg, ex, tot } = calcSubjectPostMidterm(sub, assess, mks, st.id);
                subAnnualMG += (mg || 0);
                subAnnualEX += (ex || 0);
                subAnnualTOT += (tot || 0);
            }
            const subMax = (sub.mg_max || 50) + (sub.ex_max || 50);
            annualMG += subAnnualMG;
            annualEX += subAnnualEX;
            annualTOT += subAnnualTOT;
            annualMax += subMax * terms.length;
            return `<td style="text-align:center">${fmt(subAnnualMG, 1)}</span><td style="text-align:center">${fmt(subAnnualEX, 1)}</span><td style="text-align:center;font-weight:600;background:${getMarkBg(subMax * terms.length > 0 ? subAnnualTOT / (subMax * terms.length) * 100 : 0)}">${fmt(subAnnualTOT, 1)}</span>`;
        });
        const pct = annualMax > 0 ? (annualTOT / annualMax) * 100 : null;
        return { st, subCells, annualMG, annualEX, annualTOT, annualMax, pct };
    });

    // Calculate rankings
    const ranked = rankStudents(rows.map(r => ({ ...r, name: `${r.st.last_name} ${r.st.first_name}`, percentage: r.pct || 0 })));
    const rankMap = new Map(ranked.map(r => [r.st.id, r.rankDisplay]));

    // Calculate class averages
    const annAvgRow = subjects.map(sub => {
        const subMGs = [], subEXs = [];
        rows.forEach(row => {
            let sMG = 0, sEX = 0;
            for (const term of terms) {
                const assess = termAssessments[term.id];
                const mks = termMarks[term.id];
                const { mg, ex } = calcSubjectPostMidterm(sub, assess, mks, row.st.id);
                sMG += (mg || 0);
                sEX += (ex || 0);
            }
            if (sMG > 0 || sEX > 0) {
                subMGs.push(sMG);
                subEXs.push(sEX);
            }
        });
        const avgMG = subMGs.length ? subMGs.reduce((a, b) => a + b, 0) / subMGs.length : null;
        const avgEX = subEXs.length ? subEXs.reduce((a, b) => a + b, 0) / subEXs.length : null;
        const avgTOT = (avgMG !== null && avgEX !== null) ? avgMG + avgEX : null;
        return `<td style="text-align:center;background:#f0f4ff">${avgMG !== null ? fmt(avgMG, 1) : '—'}</span>
                <td style="text-align:center;background:#f0f4ff">${avgEX !== null ? fmt(avgEX, 1) : '—'}</span>
                <td style="text-align:center;font-weight:600;background:#e8f4ff">${avgTOT !== null ? fmt(avgTOT, 1) : '—'}</span>`;
    });

    const annDisplayName = isNursery ? (cls?.name || '').replace(/nursery/i, 'MATERNELLE').replace(/primary/i, 'PRIMAIRE') : (cls?.name || '');
    const totalStudents = rows.length;
    const classAvg = rows.reduce((sum, r) => sum + (r.pct || 0), 0) / totalStudents;
    const passRate = rows.filter(r => (r.pct || 0) >= 50).length / totalStudents * 100;
    const topStudent = rows.filter(r => r.pct !== null).sort((a, b) => b.pct - a.pct)[0];

    container.innerHTML = `
        <div style="padding:8px 16px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;font-size:.8rem;font-weight:600;color:#065f46">
            📊 ${isNursery ? 'VUE ANNUELLE' : 'ANNUAL VIEW'} — ${esc(annDisplayName)} — ${isNursery ? 'Les' : 'All'} ${terms.length} ${isNursery ? 'Trimestres Combinés' : 'Terms Combined'}
        </div>
        <div style="overflow-x:auto">
            <table class="data-table" style="min-width:700px;font-size:.77rem;border-collapse:collapse">
                <thead>
                    <tr style="background:var(--bg-tertiary)">
                        <th rowspan="2">#</th>
                        <th rowspan="2" style="min-width:140px">${isNursery ? 'ÉLÈVE' : 'STUDENT'}</th>
                        ${subjects.map(sub => `<th colspan="3" style="text-align:center;border:1px solid var(--border-medium)">${esc(sub.name.toUpperCase())}</th>`).join('')}
                        <th rowspan="2" style="text-align:center">TOT_MG</th>
                        <th rowspan="2" style="text-align:center">TOT_EX</th>
                        <th rowspan="2" style="text-align:center">G_TOT</th>
                        <th rowspan="2" style="text-align:center">%</th>
                        <th rowspan="2" style="text-align:center">${isNursery ? 'COTE' : 'GRADE'}</th>
                        <th rowspan="2" style="text-align:center">${isNursery ? 'RANG' : 'RANK'}</th>
                    </table>
                    <tr style="background:var(--bg-secondary)">
                        ${subjects.map(() => `<th style="text-align:center;font-size:.7rem">Tot-MG</th><th style="text-align:center;font-size:.7rem">Tot-EX</th><th style="text-align:center;font-size:.7rem">G-TOT</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((row, i) => `
                        <tr class="${i % 2 === 0 ? '' : 'alt-row'}">
                            <td style="text-align:center;color:var(--text-muted)">${i + 1}</span>
                            <td><strong>${esc(row.st.last_name + ' ' + row.st.first_name)}</strong></span>
                            ${row.subCells.join('')}
                            <td style="text-align:center;font-weight:600">${fmt(row.annualMG, 1)}</span>
                            <td style="text-align:center;font-weight:600">${fmt(row.annualEX, 1)}</span>
                            <td style="text-align:center;font-weight:700;background:${getMarkBg(row.pct || 0)}">${fmt(row.annualTOT, 1)}</span>
                            <td style="text-align:center;font-weight:600">${row.pct !== null ? fmtPct(row.pct) : '—'}</span>
                            <td style="text-align:center"><span class="badge ${getGradeClass(row.pct)}">${getGrade(row.pct)}</span></span>
                            <td style="text-align:center;font-weight:700">${rankMap.get(row.st.id) || '—'}</span>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:var(--bg-tertiary);font-weight:600">
                        <td colspan="2" style="text-align:right;padding:8px">${isNursery ? 'MOYENNE' : 'AVERAGE'}</span>
                        ${annAvgRow.join('')}
                        <td style="background:#e8f4ff"></span><td style="background:#e8f4ff"></span><td style="background:#d1fae5"></span>
                        <td style="background:#f0f4ff"></span>
                        <td style="background:#f0f4ff"></span>
                        <td style="background:#f0f4ff"></span>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div style="padding:12px 16px;background:var(--bg-secondary);border-top:1px solid var(--border-light);border-radius:0 0 8px 8px;display:flex;gap:24px;flex-wrap:wrap;font-size:.82rem">
            <span>📊 Class Avg: <strong>${classAvg.toFixed(1)}%</strong></span>
            <span>✅ Pass Rate: <strong>${passRate.toFixed(0)}%</strong></span>
            <span>🏆 Top: <strong>${topStudent ? esc(topStudent.st.last_name + ' ' + topStudent.st.first_name) + ' (' + fmtPct(topStudent.pct) + ')' : '—'}</strong></span>
            <span>👥 Students: <strong>${totalStudents}</strong></span>
        </div>
    `;
}

// Calculate subject post-midterm scores
function calcSubjectPostMidterm(sub, assessments, marks, studentId) {
    const mgMax = sub.mg_max || 50, exMax = sub.ex_max || 50;
    const mgA = assessments.filter(a => a.subject_id === sub.id && !['Exam', 'Final Exam'].includes(a.assessment_type));
    const exA = assessments.filter(a => a.subject_id === sub.id && ['Exam', 'Final Exam'].includes(a.assessment_type));
    const mgS = mgA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
    const exS = exA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
    let mg = calcMG(mgS, mgA.map(a => a.max_marks), mgMax);
    let ex = calcEX(exS, exA.map(a => a.max_marks), exMax);
    if (sub.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
    const tot = (mg !== null || ex !== null) ? (mg || 0) + (ex || 0) : null;
    return { mg, ex, tot, mgMax, exMax };
}

function calcMG(scores, maxes, mgMax) {
    if (!scores?.length) return null;
    const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
    return avgMax > 0 ? (avgRaw / avgMax) * mgMax : null;
}

function calcEX(scores, maxes, exMax) {
    return calcMG(scores, maxes, exMax);
}

function rankStudents(arr) {
    const sorted = [...arr].sort((a, b) => b.percentage !== a.percentage ? b.percentage - a.percentage : a.name.localeCompare(b.name));
    let rank = 1;
    sorted.forEach((s, i) => {
        if (i > 0 && s.percentage === sorted[i - 1].percentage) s.rank = sorted[i - 1].rank;
        else { s.rank = rank; }
        rank = s.rank + 1;
        s.rankDisplay = `${s.rank} of ${sorted.length}`;
    });
    return sorted;
}

function getMarkBg(pct) {
    if (pct === null || isNaN(pct)) return '';
    if (pct >= 80) return '#d1fae5';
    if (pct >= 60) return '#fef3c7';
    if (pct >= 50) return '#ffedd5';
    return '#fee2e2';
}

// Export annual register to Excel
window.exportAnnualRegister = function () {
    const classId = parseInt(document.getElementById('annual-class')?.value);
    const cls = getClassById(classId);
    const table = document.querySelector('#annual-register-container table');
    if (!table) { showToast('No data to export', 'warning'); return; }
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${cls?.name || 'Annual'}_Register`);
    XLSX.writeFile(wb, `AnnualRegister_${cls?.name || 'class'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Annual register exported', 'success');
};

async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.subjects.length) await refreshTable('subjects');
    if (!state.assessments.length) await refreshTable('assessments');
}

