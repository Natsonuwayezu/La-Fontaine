// ============================================================
// REGISTER EXPORT MODULE - Export class register to various formats
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById } from '../core/state.js';
import { exportToExcel, downloadBlob } from '../core/utils.js';
import { showToast } from '../core/helpers.js';;
import { refreshTable } from '../core/data-loader.js';

// Export class register to Excel
export async function exportRegisterToExcel(classId, termId, isAnnual = false) {
    const cls = getClassById(classId);
    if (!cls) {
        showToast('Class not found', 'error');
        return;
    }

    const students = (state.students || []).filter(s => s.class_id === classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));

    if (isAnnual) {
        await exportAnnualRegisterToExcel(classId, cls, students);
        return;
    }

    const term = (state.terms || []).find(t => t.id == termId);
    const phase = getCurrentPhase(term);
    const isNursery = cls?.level === 'nursery' || cls?.level === 'Nursery';

    let subjects = (state.subjects || []).filter(s => (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() && s.is_active !== false);
    if (phase === 'pre_midterm') subjects = subjects.filter(s => !s.appears_only_post_midterm);
    subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    const assessments = (state.assessments || []).filter(a => a.class_id === classId && a.term_id === termId);
    const marks = (state.marks || []).filter(m => assessments.some(a => a.id === m.assessment_id));

    // Prepare export data
    const exportData = students.map(student => {
        const row = {
            'Student Code': student.student_code || '',
            'Student Name': `${student.first_name} ${student.last_name}`
        };

        for (const subject of subjects) {
            const subAssess = assessments.filter(a => a.subject_id === subject.id);
            const quizAssess = subAssess.filter(a => !['Exam', 'Final Exam'].includes(a.assessment_type));
            const examAssess = subAssess.filter(a => ['Exam', 'Final Exam'].includes(a.assessment_type));

            if (phase === 'pre_midterm') {
                const scores = quizAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const maxes = quizAssess.map(a => a.max_marks);
                const tot = isNursery ? calcPreMidtermNursery(scores) : calcPreMidtermPrimary(scores, maxes);
                row[`${subject.name} (Score)`] = tot !== null ? tot.toFixed(1) : '—';
                row[`${subject.name} (Grade)`] = tot !== null ? getGrade(tot) : '—';
            } else {
                const mgScores = quizAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const exScores = examAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const mgMax = subject.mg_max || 50, exMax = subject.ex_max || 50;
                let mg = calcMG(mgScores, quizAssess.map(a => a.max_marks), mgMax);
                const ex = calcEX(exScores, examAssess.map(a => a.max_marks), exMax);
                if (subject.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
                const tot = (mg !== null && ex !== null) ? mg + ex : (mg !== null ? mg : (ex !== null ? ex : null));
                row[`${subject.name} (MG)`] = mg !== null ? mg.toFixed(1) : '—';
                row[`${subject.name} (EX)`] = ex !== null ? ex.toFixed(1) : '—';
                row[`${subject.name} (Total)`] = tot !== null ? tot.toFixed(1) : '—';
            }
        }

        // Calculate total
        let totalScore = 0, totalMax = 0;
        for (const subject of subjects) {
            const subAssess = assessments.filter(a => a.subject_id === subject.id);
            const quizAssess = subAssess.filter(a => !['Exam', 'Final Exam'].includes(a.assessment_type));
            const examAssess = subAssess.filter(a => ['Exam', 'Final Exam'].includes(a.assessment_type));

            if (phase === 'pre_midterm') {
                const scores = quizAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const maxes = quizAssess.map(a => a.max_marks);
                const tot = isNursery ? calcPreMidtermNursery(scores) : calcPreMidtermPrimary(scores, maxes);
                const subMax = isNursery ? (subject.mg_max || 50) : 100;
                if (tot !== null) { totalScore += tot; totalMax += subMax; }
            } else {
                const mgScores = quizAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const exScores = examAssess.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === student.id)?.score).filter(v => v !== undefined);
                const mgMax = subject.mg_max || 50, exMax = subject.ex_max || 50;
                let mg = calcMG(mgScores, quizAssess.map(a => a.max_marks), mgMax);
                const ex = calcEX(exScores, examAssess.map(a => a.max_marks), exMax);
                if (subject.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
                const tot = (mg !== null && ex !== null) ? mg + ex : (mg !== null ? mg : (ex !== null ? ex : null));
                const subTot = mgMax + exMax;
                if (tot !== null) { totalScore += tot; totalMax += subTot; }
            }
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        row['Total Score'] = totalScore.toFixed(1);
        row['Max Possible'] = totalMax;
        row['Percentage %'] = percentage.toFixed(1);
        row['Grade'] = getGrade(percentage);

        return row;
    });

    const filename = `${cls.name}_${term?.name || 'Register'}_${phase === 'pre_midterm' ? 'PreMidterm' : 'PostMidterm'}`;
    exportToExcel(exportData, filename);
    showToast('✅ Register exported', 'success');
}

// Export annual register to Excel
async function exportAnnualRegisterToExcel(classId, cls, students) {
    const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.id - b.id);
    let subjects = (state.subjects || []).filter(s => (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() && s.is_active !== false);
    subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

    const termAssessments = {};
    const termMarks = {};
    for (const term of terms) {
        termAssessments[term.id] = (state.assessments || []).filter(a => a.class_id === classId && a.term_id === term.id);
        const aIds = termAssessments[term.id].map(a => a.id);
        termMarks[term.id] = (state.marks || []).filter(m => aIds.includes(m.assessment_id));
    }

    const exportData = students.map(student => {
        const row = {
            'Student Code': student.student_code || '',
            'Student Name': `${student.first_name} ${student.last_name}`
        };

        let annualMG = 0, annualEX = 0, annualTOT = 0, annualMax = 0;

        for (const subject of subjects) {
            let subAnnualMG = 0, subAnnualEX = 0, subAnnualTOT = 0;
            for (const term of terms) {
                const assess = termAssessments[term.id];
                const mks = termMarks[term.id];
                const { mg, ex, tot } = calcSubjectPostMidterm(subject, assess, mks, student.id);
                subAnnualMG += (mg || 0);
                subAnnualEX += (ex || 0);
                subAnnualTOT += (tot || 0);
            }
            annualMG += subAnnualMG;
            annualEX += subAnnualEX;
            annualTOT += subAnnualTOT;
            annualMax += (subject.mg_max + subject.ex_max) * terms.length;

            row[`${subject.name} (Tot-MG)`] = subAnnualMG.toFixed(1);
            row[`${subject.name} (Tot-EX)`] = subAnnualEX.toFixed(1);
            row[`${subject.name} (G-TOT)`] = subAnnualTOT.toFixed(1);
        }

        const percentage = annualMax > 0 ? (annualTOT / annualMax) * 100 : 0;
        row['Annual TOT MG'] = annualMG.toFixed(1);
        row['Annual TOT EX'] = annualEX.toFixed(1);
        row['G_TOT'] = annualTOT.toFixed(1);
        row['Percentage %'] = percentage.toFixed(1);
        row['Grade'] = getGrade(percentage);

        return row;
    });

    exportToExcel(exportData, `${cls.name}_Annual_Register`);
    showToast('✅ Annual register exported', 'success');
}

// Export register as PDF (print-friendly HTML)
export function exportRegisterAsPDF(classId, termId) {
    const cls = getClassById(classId);
    const table = document.querySelector('#cr-table-container table');
    if (!table) {
        showToast('No data to export', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Class Register - ${cls?.name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; font-size: 11px; }
                th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
                th { background: #1a3a5c; color: white; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h2 style="text-align:center">ECOLE LA FONTAINE</h2>
            <h3 style="text-align:center">Class Register - ${cls?.name}</h3>
            <p style="text-align:center">Generated on ${new Date().toLocaleDateString()}</p>
            ${table.outerHTML}
            <script>window.print(); setTimeout(window.close, 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Helper functions
function getCurrentPhase(term) {
    if (!term?.midterm_date) return 'post_midterm';
    return new Date() < new Date(term.midterm_date) ? 'pre_midterm' : 'post_midterm';
}

function calcPreMidtermPrimary(scores, maxes) {
    if (!scores?.length) return null;
    const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
    return avgMax > 0 ? (avgRaw / avgMax) * 100 : null;
}

function calcPreMidtermNursery(scores) {
    if (!scores?.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
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

function getGrade(percentage) {
    const scale = state.gradingScale || [];
    for (const g of scale) {
        if (percentage >= g.min && percentage <= g.max) return g.grade;
    }
    return 'F';
}
// ── Page render entry point ─────────────────────────────────
export async function renderRegisterExport(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><h2>📋 Register Export</h2></div>
            <div class="dash-card-body">
                <p class="text-muted">This module provides utility functions used by other modules. 
                Select a specific action from the relevant section.</p>
            </div>
        </div>
    `;
}
