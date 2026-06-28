// ============================================================
// REPORT CARDS MODULE - Generate student report cards (6 formats)
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher, isAccountant } from '../core/auth.js';
import { fmtDate, fmtPct, getGrade, getGradeClass, esc } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

// Global state for report cards
let _currentReportStudent = null;
let _currentReportClass = null;
let _currentReportTerm = null;
let _currentReportType = null;

// Render Report Cards page
export async function renderReportCards(container) {
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

// Load students for selected class
window.loadReportStudents = async function () {
    const classId = document.getElementById('report-class').value;
    if (!classId) return;

    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    const studentSelect = document.getElementById('report-student');

    if (students.length === 0) {
        studentSelect.innerHTML = '<option value="">— No students found —</option>';
        return;
    }

    studentSelect.innerHTML = '<option value="">— Select student —</option>' +
        students.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || 'N/A')})</option>`).join('');
};

// Handle report type change
window.onReportTypeChange = function () {
    const reportType = document.getElementById('report-type').value;
    const termSelect = document.getElementById('report-term');
    if (reportType === 'annual') {
        termSelect.value = 'annual';
        termSelect.disabled = true;
    } else {
        termSelect.disabled = false;
        if (termSelect.value === 'annual') {
            termSelect.value = state.currentTerm?.id || '';
        }
    }
    if (document.getElementById('report-class').value && document.getElementById('report-student').value) {
        generateReportCard();
    }
};

// Handle term change
window.onReportTermChange = function () {
    if (document.getElementById('report-class').value && document.getElementById('report-student').value) {
        generateReportCard();
    }
};

// Generate report card
window.generateReportCard = async function () {
    const studentId = document.getElementById('report-student').value;
    const classId = document.getElementById('report-class').value;
    const termValue = document.getElementById('report-term').value;
    const reportType = document.getElementById('report-type').value;

    if (!studentId || !classId) {
        showToast('Please select class and student', 'warning');
        return;
    }

    const isAnnual = termValue === 'annual' || reportType === 'annual';
    const isPreMidterm = reportType === 'midterm' && !isAnnual;

    _currentReportStudent = parseInt(studentId);
    _currentReportClass = parseInt(classId);
    _currentReportTerm = termValue;
    _currentReportType = reportType;

    const student = getStudentById(studentId);
    const cls = getClassById(classId);
    const isNursery = (cls?.level || '').toLowerCase() === 'nursery';

    // Determine terms to process
    let termsToProcess = [];
    if (isAnnual) {
        termsToProcess = (state.terms || []).filter(t => t.academic_year_id === (state.currentAcadYear?.id || 1));
    } else {
        const term = (state.terms || []).find(t => t.id == termValue);
        if (term) termsToProcess = [term];
    }

    // Get subjects for this level
    let subjects = (state.subjects || []).filter(s => s.level === cls?.level && s.is_active !== false);
    if (isPreMidterm) subjects = subjects.filter(s => !s.appears_only_post_midterm);
    subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    // Get assessments and marks
    let allAssessments = [];
    for (const term of termsToProcess) {
        const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.term_id === term.id);
        allAssessments.push(...assessments);
    }
    const allMarks = (state.marks || []).filter(m => m.student_id == studentId);

    // Calculate scores per term and per subject
    const termScores = {};
    for (const term of termsToProcess) {
        termScores[term.id] = { subjects: {}, totals: { mg: 0, ex: 0, total: 0, max: 0 } };

        for (const subject of subjects) {
            const termAssessments = allAssessments.filter(a => a.term_id === term.id && a.subject_id === subject.id);
            const mgAssessments = termAssessments.filter(a => !['Exam', 'Exam 1', 'Exam 2', 'Final Exam'].includes(a.assessment_type));
            const exAssessments = termAssessments.filter(a => ['Exam', 'Exam 1', 'Exam 2', 'Final Exam'].includes(a.assessment_type));

            let mgScore = null, exScore = null;
            const mgMax = subject.mg_max || 50;
            const exMax = subject.ex_max || 50;

            // Calculate MG
            if (mgAssessments.length > 0) {
                let totalRaw = 0, totalMaxRaw = 0, completedCount = 0;
                for (const ass of mgAssessments) {
                    const mark = allMarks.find(m => m.assessment_id === ass.id);
                    if (mark && mark.score !== null && mark.score !== undefined) {
                        totalRaw += mark.score;
                        totalMaxRaw += ass.max_marks;
                        completedCount++;
                    }
                }
                if (completedCount > 0) {
                    const avgRaw = totalRaw / completedCount;
                    const avgMax = totalMaxRaw / completedCount;
                    if (isPreMidterm) {
                        mgScore = isNursery ? avgRaw : (avgMax > 0 ? (avgRaw / avgMax) * 100 : 0);
                    } else {
                        mgScore = avgMax > 0 ? (avgRaw / avgMax) * mgMax : 0;
                    }
                }
            }

            // Calculate EX
            if (!isPreMidterm && exAssessments.length > 0) {
                let totalRaw = 0, totalMaxRaw = 0, completedCount = 0;
                for (const ass of exAssessments) {
                    const mark = allMarks.find(m => m.assessment_id === ass.id);
                    if (mark && mark.score !== null && mark.score !== undefined) {
                        totalRaw += mark.score;
                        totalMaxRaw += ass.max_marks;
                        completedCount++;
                    }
                }
                if (completedCount > 0) {
                    const avgRaw = totalRaw / completedCount;
                    const avgMax = totalMaxRaw / completedCount;
                    exScore = avgMax > 0 ? (avgRaw / avgMax) * exMax : 0;
                }
            }

            // Post-midterm only subjects: MG = EX
            if (!isPreMidterm && subject.appears_only_post_midterm && mgScore === null && exScore !== null) {
                mgScore = exScore;
            }

            // Calculate total
            let total = null, maxTotal = 0;
            if (isPreMidterm) {
                total = mgScore;
                maxTotal = isNursery ? mgMax : 100;
            } else {
                if (mgScore !== null || exScore !== null) {
                    total = (mgScore || 0) + (exScore || 0);
                }
                maxTotal = mgMax + exMax;
            }

            const percentage = (total !== null && maxTotal > 0) ? (total / maxTotal) * 100 : null;

            termScores[term.id].subjects[subject.id] = {
                mg: mgScore, ex: exScore, total: total, max: maxTotal,
                percentage: percentage, mgMax: mgMax, exMax: exMax
            };

            termScores[term.id].totals.mg += mgScore || 0;
            termScores[term.id].totals.ex += exScore || 0;
            termScores[term.id].totals.total += total || 0;
            termScores[term.id].totals.max += maxTotal;
        }
    }

    // Calculate overall scores
    let annualTotalMG = 0, annualTotalEX = 0, annualTotalScore = 0, annualTotalMax = 0;
    for (const term of termsToProcess) {
        annualTotalMG += termScores[term.id].totals.mg;
        annualTotalEX += termScores[term.id].totals.ex;
        annualTotalScore += termScores[term.id].totals.total;
        annualTotalMax += termScores[term.id].totals.max;
    }

    const overallPercentage = annualTotalMax > 0 ? (annualTotalScore / annualTotalMax) * 100 : 0;
    const overallGrade = getGrade(overallPercentage);
    const rank = await calculateStudentRank(studentId, classId, termsToProcess, allAssessments, allMarks);

    // ── Attendance for this term ───────────────────────────
    let attPresent = 0, attAbsent = 0, attLate = 0, attExcused = 0, attTotal = 0;
    try {
        const attRecords = await getAll('attendance', { student_id: studentId });
        const termAttRecords = isAnnual
            ? attRecords.filter(a => termsToProcess.some(t => a.date >= t.start_date && a.date <= t.end_date))
            : attRecords.filter(a => termsToProcess[0] && a.date >= termsToProcess[0].start_date && a.date <= termsToProcess[0].end_date);
        attTotal   = termAttRecords.length;
        attPresent = termAttRecords.filter(a => a.status === 'present').length;
        attAbsent  = termAttRecords.filter(a => a.status === 'absent').length;
        attLate    = termAttRecords.filter(a => a.status === 'late').length;
        attExcused = termAttRecords.filter(a => a.status === 'excused').length;
    } catch(_e) {}
    const lblAtt = isNursery ? 'PRÉSENCES' : 'ATTENDANCE';
    const attHtml = attTotal > 0 ? `
        <div class="report-attendance">
            <strong>${lblAtt}:</strong>
            ✅ ${isNursery ? 'Présent' : 'Present'}: ${attPresent} &nbsp;|&nbsp;
            ❌ ${isNursery ? 'Absent' : 'Absent'}: ${attAbsent} &nbsp;|&nbsp;
            ⏰ ${isNursery ? 'Retard' : 'Late'}: ${attLate} &nbsp;|&nbsp;
            📅 ${isNursery ? 'Jours' : 'Total Days'}: ${attTotal}
        </div>` : '';

    // School info with logo
    const schoolName = state.schoolSettings?.school_name || 'ECOLE LA FONTAINE';
    const schoolLocation = state.schoolSettings?.school_location || 'Rubavu, Rwanda';
    const headTeacherName = state.schoolSettings?.report_footer_line2 || 'UWAYO GANZA Eugene';
    const schoolLogo = state.schoolSettings?.school_logo || '🏫';
    const logoHtml = getSchoolLogoHtml(schoolLogo);

    // Report title based on type
    let reportTitle = '';
    if (isPreMidterm) {
        reportTitle = isNursery ? 'RÉSULTATS DES TESTS DEMI-TRIMESTRE' : 'MID-TERM EXAMINATION RESULTS';
    } else if (isAnnual) {
        reportTitle = isNursery ? 'RAPPORT ANNUEL' : 'ANNUAL REPORT CARD';
    } else {
        reportTitle = isNursery ? 'RÉSULTATS DE FIN DE TRIMESTRE' : 'END OF TERM EXAMINATIONS RESULTS';
    }

    const termLabel = isAnnual ?
        (isNursery ? 'ANNÉE SCOLAIRE' : 'ACADEMIC YEAR') + ' ' + (state.schoolSettings?.current_year || '2025-2026') :
        (termsToProcess[0]?.name || '') + ' - ' + (state.schoolSettings?.current_year || '2025-2026');

    // Get grade and class names
    let gradeName = isNursery ? (cls.name.replace(/NURSERY/i, 'MATERNELLE').replace(/PRIMARY/i, 'PRIMAIRE')) : cls.name;
    gradeName = gradeName.replace(/\s+[A-Za-z]$/, '').trim();
    let className = isNursery ? (cls.name.replace(/NURSERY/i, 'MATERNELLE').replace(/PRIMARY/i, 'PRIMAIRE')) : cls.name;

    const lblGrade = isNursery ? 'GRADE' : 'GRADE';
    const lblStudent = isNursery ? 'NOM DE L\'ÉLÈVE' : 'STUDENT NAME';
    const lblCode = isNursery ? 'CODE' : 'STUDENT CODE';
    const lblClass = isNursery ? 'CLASSE' : 'CLASS';

    // Build report HTML
    let reportHtml = `
        <div class="report-card" id="report-card">
            <div class="report-header">
                <div class="report-logo">${logoHtml}</div>
                <div class="report-header-text">
                    <h2>${esc(schoolName)}</h2>
                    <p>${esc(schoolLocation)}</p>
                    <h3>${reportTitle}</h3>
                    <p>${termLabel}</p>
                </div>
            </div>
            <div class="report-info">
                <div class="report-info-item"><strong>${lblGrade}</strong><span>${esc(gradeName)}</span></div>
                <div class="report-info-item"><strong>${lblStudent}</strong><span>${esc(student.first_name + ' ' + student.last_name)}</span></div>
                <div class="report-info-item"><strong>${lblCode}</strong><span>${esc(student.student_code || '—')}</span></div>
                <div class="report-info-item"><strong>${lblClass}</strong><span>${esc(className)}</span></div>
            </div>
    `;

    // Generate subject table based on report type
    if (isPreMidterm && isNursery) {
        // NURSERY PRE-MIDTERM (French)
        reportHtml += `<table class="report-subjects"><thead><tr><th>MATIÈRES</th><th>MAX</th><th>NOTE</th><th>COTE</th></tr></thead><tbody>`;
        for (const subject of subjects) {
            const score = termScores[termsToProcess[0]?.id]?.subjects[subject.id];
            const pct = score?.percentage;
            reportHtml += `<tr><td style="font-weight:600">${subject.name.toUpperCase()}</td><td style="text-align:center">${score?.max || subject.mg_max}</td><td style="text-align:center;font-weight:700">${score?.total !== null ? score.total.toFixed(1) : '—'}</td><td style="text-align:center"><span class="badge ${getGradeClass(pct)}">${pct !== null ? getGrade(pct) : '—'}</span></td></tr>`;
        }
        reportHtml += `</tbody></table>`;
    } else if (isPreMidterm && !isNursery) {
        // PRIMARY PRE-MIDTERM (English)
        reportHtml += `<table class="report-subjects"><thead><tr><th>SUBJECTS</th><th>MAX</th><th>SCORE</th><th>%</th><th>GRADE</th></tr></thead><tbody>`;
        for (const subject of subjects) {
            const score = termScores[termsToProcess[0]?.id]?.subjects[subject.id];
            const pct = score?.percentage;
            reportHtml += `<tr><td style="font-weight:600">${subject.name}</td><td style="text-align:center">${score?.max || 100}</td><td style="text-align:center;font-weight:700">${score?.total !== null ? score.total.toFixed(1) : '—'}</td><td style="text-align:center">${pct !== null ? pct.toFixed(1) + '%' : '—'}</td><td style="text-align:center"><span class="badge ${getGradeClass(pct)}">${pct !== null ? getGrade(pct) : '—'}</span></td></tr>`;
        }
        reportHtml += `</tbody></table>`;
    } else if (isAnnual) {
        // ANNUAL REPORT (Nursery French or Primary English)
        const subjectHdr = isNursery ? 'MATIÈRES' : 'SUBJECT';
        reportHtml += `<table class="report-subjects"><thead><tr><th>${subjectHdr}</th><th>T-MG</th><th>T-EX</th><th>TOTAL</th><th>MAX</th><th>%</th><th>${isNursery ? 'COTE' : 'GRADE'}</th></tr></thead><tbody>`;
        for (const subject of subjects) {
            let tMG = 0, tEX = 0, tMAX = 0;
            for (const term of termsToProcess) {
                const score = termScores[term.id]?.subjects[subject.id];
                tMG += score?.mg || 0;
                tEX += score?.ex || 0;
                tMAX += score?.max || 0;
            }
            const pct = tMAX > 0 ? (tMG + tEX) / tMAX * 100 : 0;
            const displayName = isNursery ? subject.name.toUpperCase() : subject.name;
            reportHtml += `<tr><td style="font-weight:600">${displayName}</td><td style="text-align:center">${tMG.toFixed(1)}</td><td style="text-align:center">${tEX.toFixed(1)}</td><td style="text-align:center;font-weight:700">${(tMG + tEX).toFixed(1)}</td><td style="text-align:center">${tMAX}</td><td style="text-align:center">${pct.toFixed(1)}%</td><td style="text-align:center"><span class="badge ${getGradeClass(pct)}">${getGrade(pct)}</span></td></tr>`;
        }
        reportHtml += `</tbody></table>`;
    } else if (isNursery && !isPreMidterm) {
        // NURSERY POST-MIDTERM (French)
        reportHtml += `<table class="report-subjects"><thead><tr><th>MATIÈRES</th><th>MG</th><th>EX</th><th>TOTAL</th><th>MAX</th><th>COTE</th></tr></thead><tbody>`;
        for (const subject of subjects) {
            const score = termScores[termsToProcess[0]?.id]?.subjects[subject.id];
            const pct = score?.percentage;
            const isCopied = subject.appears_only_post_midterm && score?.mg === score?.ex && score?.mg !== null;
            reportHtml += `<tr><td style="font-weight:600">${subject.name.toUpperCase()}</td><td style="text-align:center">${score?.mg !== null ? score.mg.toFixed(1) : '—'}${isCopied ? '<sup title="Copied from EX" style="font-size:.6rem">★</sup>' : ''}</td><td style="text-align:center">${score?.ex !== null ? score.ex.toFixed(1) : '—'}</td><td style="text-align:center;font-weight:700">${score?.total !== null ? score.total.toFixed(1) : '—'}</td><td style="text-align:center">${score?.max || 0}</td><td style="text-align:center"><span class="badge ${getGradeClass(pct)}">${pct !== null ? getGrade(pct) : '—'}</span></td></tr>`;
        }
        reportHtml += `</tbody></table>`;
    } else {
        // PRIMARY POST-MIDTERM (English)
        reportHtml += `<table class="report-subjects"><thead><tr><th>SUBJECTS</th><th>MG</th><th>EX</th><th>TOTAL</th><th>MAX</th><th>%</th><th>GRADE</th></tr></thead><tbody>`;
        for (const subject of subjects) {
            const score = termScores[termsToProcess[0]?.id]?.subjects[subject.id];
            const pct = score?.percentage;
            const isCopied = subject.appears_only_post_midterm && score?.mg === score?.ex && score?.mg !== null;
            reportHtml += `<tr><td style="font-weight:600">${subject.name}</td><td style="text-align:center">${score?.mg !== null ? score.mg.toFixed(1) : '—'}${isCopied ? '<sup title="Copied from EX" style="font-size:.6rem">★</sup>' : ''}</td><td style="text-align:center">${score?.ex !== null ? score.ex.toFixed(1) : '—'}</td><td style="text-align:center;font-weight:700">${score?.total !== null ? score.total.toFixed(1) : '—'}</td><td style="text-align:center">${score?.max || 0}</td><td style="text-align:center">${pct !== null ? pct.toFixed(1) + '%' : '—'}</td><td style="text-align:center"><span class="badge ${getGradeClass(pct)}">${pct !== null ? getGrade(pct) : '—'}</span></td></tr>`;
        }
        reportHtml += `</tbody></table>`;
    }

    // Summary section
    let summaryHtml = '';
    if (isAnnual) {
        const annualMGMax = subjects.reduce((sum, s) => sum + (s.mg_max || 50), 0) * termsToProcess.length;
        const annualEXMax = subjects.reduce((sum, s) => sum + (s.ex_max || 50), 0) * termsToProcess.length;
        summaryHtml = `<div class="report-summary">
            <div><div class="summary-label">${isNursery ? 'TOTAL MG' : 'ANNUAL TOT MG'}</div><div class="summary-value">${annualTotalMG.toFixed(1)} / ${annualMGMax}</div></div>
            <div><div class="summary-label">${isNursery ? 'TOTAL EX' : 'ANNUAL TOT EX'}</div><div class="summary-value">${annualTotalEX.toFixed(1)} / ${annualEXMax}</div></div>
            <div><div class="summary-label">G_TOT</div><div class="summary-value">${annualTotalScore.toFixed(1)} / ${annualMGMax + annualEXMax}</div></div>
            <div><div class="summary-label">${isNursery ? 'MOYENNE' : 'AVERAGE %'}</div><div class="summary-value">${overallPercentage.toFixed(1)}%</div></div>
            <div><div class="summary-label">${isNursery ? 'COTE' : 'GRADE'}</div><div class="summary-value">${overallGrade}</div></div>
            <div><div class="summary-label">${isNursery ? 'RANG' : 'RANK'}</div><div class="summary-value">${rank}</div></div>
        </div>`;
    } else {
        const termTotal = termScores[termsToProcess[0]?.id]?.totals;
        summaryHtml = `<div class="report-summary">
            <div><div class="summary-label">${isNursery ? 'TOTAL DES POINTS' : 'TOTAL SCORE'}</div><div class="summary-value">${(termTotal?.total || 0).toFixed(1)} / ${termTotal?.max || 0}</div></div>
            <div><div class="summary-label">${isNursery ? 'MOYENNE' : 'AVERAGE %'}</div><div class="summary-value">${overallPercentage.toFixed(1)}%</div></div>
            <div><div class="summary-label">${isNursery ? 'COTE' : 'GRADE'}</div><div class="summary-value">${overallGrade}</div></div>
            <div><div class="summary-label">${isNursery ? 'RANG' : 'RANK'}</div><div class="summary-value">${rank}</div></div>
        </div>`;
    }

    reportHtml += summaryHtml;
    reportHtml += attHtml;

    // Promotion notice for annual report
    if (isAnnual) {
        const nextClass = getNextClassForStudent(cls.name.replace(/\s+[A-Za-z]$/, '').trim());
        const promotionMessage = isNursery ?
            (overallPercentage >= 50 ?
                `🎉 FÉLICITATIONS! L'élève a obtenu une moyenne supérieure à 50% et est PROMU(E) en ${nextClass || 'la classe suivante'} pour l'année académique ${(state.currentAcadYear?.year_name || '2026-2027')}.` :
                `⚠️ ATTENTION: L'élève a obtenu une moyenne inférieure à 50% et devra REPRENDRE la même classe.`) :
            (overallPercentage >= 50 ?
                `🎉 CONGRATULATIONS! The student has achieved above 50% average and is PROMOTED to ${nextClass || 'the next class'} for the academic year ${(state.currentAcadYear?.year_name || '2026-2027')}.` :
                `⚠️ ATTENTION: The student scored below 50% and will REPEAT the current class.`);
        reportHtml += `<div class="report-footer" style="background:#f0fdf4;color:#065f46;font-weight:bold;margin-bottom:20px;">${promotionMessage}</div>`;
    }

    // Footer
    const footerLine1 = isNursery ? `Fait à ${schoolName}, Le ${fmtDate(new Date())}` : `Done at ${schoolName}, ON ${fmtDate(new Date())}`;
    const footerLine2 = headTeacherName;
    const footerLine3 = isNursery ? 'LE DIRECTEUR DE L\'ÉCOLE' : 'THE SCHOOL HEADTEACHER';

    reportHtml += `<div class="report-footer" style="margin-top:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:30px;flex-wrap:wrap;gap:20px">
            <div style="text-align:center;width:200px;"><div style="margin-bottom:8px;font-size:11px;font-weight:600;">${isNursery ? 'SIGNATURE DU PARENT/TUTEUR' : 'PARENT/GUARDIAN SIGNATURE'}</div><div style="border-bottom:1px solid #000;margin-top:30px;"></div><div style="font-size:9px;margin-top:6px;color:#64748b;">${isNursery ? 'Date et signature' : 'Date & Signature'}</div></div>
            <div style="text-align:center;width:200px;"><div style="margin-bottom:8px;font-size:11px;font-weight:600;">${footerLine3}</div><div style="border-bottom:1px solid #000;margin-top:30px;"></div><div style="font-size:9px;margin-top:6px;color:#64748b;">${esc(footerLine2)}</div></div>
        </div>
        <div style="text-align:center;font-size:11px;color:#64748b;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
            ${footerLine1}<br>${esc(footerLine2)}<br>${footerLine3}
        </div>
    </div></div>`;

    document.getElementById('report-card-content').innerHTML = reportHtml;
    document.getElementById('report-card-content').style.display = 'block';
    document.getElementById('report-card-empty').style.display = 'none';
}

// Helper functions
function getSchoolLogoHtml(logoData) {
    if (!logoData || logoData === '🏫') return '🏫';
    if (logoData.startsWith('data:image')) return `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;">`;
    if (logoData.startsWith('http')) return `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='🏫'">`;
    return logoData;
}

async function calculateStudentRank(studentId, classId, termsToProcess, allAssessments, allMarks) {
    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    const studentScores = [];
    for (const student of students) {
        let totalScore = 0, totalMax = 0;
        const studentMarks = (state.marks || []).filter(m => m.student_id === student.id);
        for (const assessment of allAssessments) {
            totalMax += assessment.max_marks;
            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
            if (mark && mark.score !== null && mark.score !== undefined) totalScore += mark.score;
        }
        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        studentScores.push({ id: student.id, name: `${student.first_name} ${student.last_name}`, percentage: percentage });
    }
    const ranked = rankStudents(studentScores);
    const found = ranked.find(s => s.id == studentId);
    return found?.rankDisplay || '—';
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

function getNextClassForStudent(currentClassName) {
    const promotionMap = {
        'NURSERY 1': 'NURSERY 2', 'NURSERY 2': 'NURSERY 3', 'NURSERY 3': 'PRIMARY 1',
        'PRIMARY 1': 'PRIMARY 2', 'PRIMARY 2': 'PRIMARY 3', 'PRIMARY 3': 'PRIMARY 4',
        'PRIMARY 4': 'PRIMARY 5', 'PRIMARY 5': 'PRIMARY 6', 'PRIMARY 6': 'GRADUATED'
    };
    return promotionMap[currentClassName] || null;
}

function getCurrentPhase(term) {
    if (!term?.midterm_date) return 'post_midterm';
    return new Date() < new Date(term.midterm_date) ? 'pre_midterm' : 'post_midterm';
}

// Print report card
window.printReportCard = function () {
    const reportCard = document.getElementById('report-card');
    if (!reportCard) { showToast('Generate a report card first', 'error'); return; }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Report Card - ECOLE LA FONTAINE</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;padding:20px;background:#fff}.report-card{max-width:800px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.report-header{background:#1a3a5c;color:#fff;padding:24px 28px;display:flex;gap:18px;align-items:center}.report-logo{width:70px;height:70px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:30px;overflow:hidden}.report-logo img{width:100%;height:100%;object-fit:cover}.report-header-text h2{font-size:18px;font-weight:700;margin-bottom:4px}.report-info{display:grid;grid-template-columns:repeat(2,1fr);border-bottom:1px solid #e2e8f0}.report-info-item{padding:12px 20px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.report-info-item strong{display:block;font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px}.report-subjects{width:100%;border-collapse:collapse}.report-subjects th{background:#e8f0fe;color:#1a3a5c;padding:10px 12px;font-size:11px;font-weight:700;text-align:center}.report-subjects td{padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0;text-align:center}.report-subjects td:first-child{text-align:left;font-weight:600}.report-summary{background:#1a3a5c;color:#fff;display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));padding:14px 20px;text-align:center;gap:12px}.summary-label{font-size:9px;opacity:.7;text-transform:uppercase}.summary-value{font-size:17px;font-weight:700;margin-top:4px}.report-footer{padding:14px 20px;background:#f8fafc;text-align:center;font-size:11px;color:#64748b;font-style:italic;border-top:1px solid #e2e8f0}.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}.grade-Ap,.grade-A{background:#d1fae5;color:#065f46}.grade-B{background:#fef3c7;color:#92400e}.grade-C{background:#ffedd5;color:#9a3412}.grade-D,.grade-F{background:#fee2e2;color:#991b1b}@media print{body{padding:0}.report-card{box-shadow:none;margin:0}}</style></head><body>${reportCard.outerHTML}<script>window.print();<\/script></body></html>`);
    printWindow.document.close();
};

// Export report card as PDF
window.exportReportPDF = function () {
    const reportCard = document.getElementById('report-card');
    if (!reportCard) { showToast('Generate a report card first', 'error'); return; }
    html2pdf().set({ margin: [0.5, 0.5, 0.5, 0.5], filename: `Report_Card_${_currentReportStudent}_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(reportCard).save();
};

// Generate all reports for a class
window.generateAllReports = async function () {
    const classId = document.getElementById('report-class').value;
    if (!classId) { showToast('Please select a class', 'error'); return; }
    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    if (students.length === 0) { showToast('No active students in this class', 'warning'); return; }
    showToast(`Generating ${students.length} reports...`, 'info');
    const cls = getClassById(classId);
    const className = cls?.name || 'Class';
    const safeClassName = className.replace(/[^a-zA-Z0-9]/g, '_');
    let allReportsHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>All Reports - ${esc(className)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;padding:20px;background:#fff}.report-card{max-width:800px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;page-break-after:always}.report-header{background:#1a3a5c;color:#fff;padding:24px 28px;display:flex;gap:18px;align-items:center}.report-logo{width:70px;height:70px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:30px;overflow:hidden}.report-logo img{width:100%;height:100%;object-fit:cover}.report-header-text h2{font-size:18px;font-weight:700;margin-bottom:4px}.report-info{display:grid;grid-template-columns:repeat(2,1fr);border-bottom:1px solid #e2e8f0}.report-info-item{padding:12px 20px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.report-info-item strong{display:block;font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px}.report-subjects{width:100%;border-collapse:collapse}.report-subjects th{background:#e8f0fe;color:#1a3a5c;padding:10px 12px;font-size:11px;font-weight:700;text-align:center}.report-subjects td{padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0;text-align:center}.report-subjects td:first-child{text-align:left;font-weight:600}.report-summary{background:#1a3a5c;color:#fff;display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));padding:14px 20px;text-align:center;gap:12px}.summary-label{font-size:9px;opacity:.7;text-transform:uppercase}.summary-value{font-size:17px;font-weight:700;margin-top:4px}.report-footer{padding:14px 20px;background:#f8fafc;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0}.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}.grade-Ap,.grade-A{background:#d1fae5;color:#065f46}.grade-B{background:#fef3c7;color:#92400e}.grade-C{background:#ffedd5;color:#9a3412}.grade-D,.grade-F{background:#fee2e2;color:#991b1b}.btn-group{text-align:center;margin:20px 0;position:sticky;top:0;background:#fff;padding:10px;z-index:100}.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none;margin:0 5px}.btn-primary{background:#1a3a5c;color:#fff}.btn-outline{background:transparent;border:1px solid #1a3a5c;color:#1a3a5c}@media print{body{padding:0;margin:0}.report-card{box-shadow:none;margin:0;page-break-after:always}.btn-group{display:none}}</style></head><body><div class="btn-group"><button class="btn btn-primary" onclick="window.print()">🖨️ Print All Reports</button><button class="btn btn-outline" onclick="downloadAllReportsPDF()">📑 Download All as PDF</button></div><div id="reports-container">`;
    const originalStudentId = document.getElementById('report-student').value;
    for (const student of students) {
        document.getElementById('report-student').value = student.id;
        await generateReportCard();
        const reportCard = document.getElementById('report-card');
        if (reportCard) allReportsHtml += reportCard.outerHTML;
    }
    if (originalStudentId) { document.getElementById('report-student').value = originalStudentId; await generateReportCard(); }
    const safeDate = new Date().toISOString().split('T')[0];
    allReportsHtml += `</div><div class="btn-group"><button class="btn btn-primary" onclick="window.print()">🖨️ Print All Reports</button><button class="btn btn-outline" onclick="downloadAllReportsPDF()">📑 Download All as PDF</button></div><script>function downloadAllReportsPDF(){const element=document.getElementById('reports-container');html2pdf().set({margin:[0.5,0.5,0.5,0.5],filename:'All_Reports_${safeClassName}_${safeDate}.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2},jsPDF:{unit:'in',format:'a4',orientation:'portrait'}}).from(element).save();}<\/script></body></html>`;
    const blob = new Blob([allReportsHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
    showToast(`${students.length} reports generated`, 'success');
};

async function ensureStateLoaded() {
    if (!state.classes.length) await refreshTable('classes');
    if (!state.subjects.length) await refreshTable('subjects');
    if (!state.assessments.length) await refreshTable('assessments');
}