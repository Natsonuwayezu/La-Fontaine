// ============================================================
// TRANSCRIPTS MODULE - Student academic transcripts
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, fmtPct, getGrade, getGradeClass, esc, exportToExcel } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

// Generate student transcript
export async function generateStudentTranscript(studentId, includeAllTerms = true) {
    const student = getStudentById(studentId);
    if (!student) return null;

    const cls = getClassById(student.class_id);
    let terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
    if (!includeAllTerms) terms = [state.currentTerm].filter(t => t);

    const transcript = {
        student: student,
        class: cls,
        terms: []
    };

    for (const term of terms) {
        const assessments = (state.assessments || []).filter(a => a.class_id === student.class_id && a.term_id === term.id);
        const marks = (state.marks || []).filter(m => m.student_id === studentId && assessments.some(a => a.id === m.assessment_id));
        const subjects = (state.subjects || []).filter(s => s.level === cls?.level && s.is_active !== false);

        const termData = {
            term: term,
            subjects: [],
            totalScore: 0,
            totalMax: 0,
            percentage: 0,
            grade: '—'
        };

        for (const subject of subjects) {
            const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
            let totalScore = 0, totalMax = 0;
            for (const assessment of subjectAssessments) {
                const mark = marks.find(m => m.assessment_id === assessment.id);
                if (mark) {
                    totalScore += mark.score;
                    totalMax += assessment.max_marks;
                }
            }
            const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
            termData.subjects.push({
                name: subject.name,
                score: totalScore,
                max: totalMax,
                percentage: percentage,
                grade: getGrade(percentage)
            });
            termData.totalScore += totalScore;
            termData.totalMax += totalMax;
        }

        termData.percentage = termData.totalMax > 0 ? (termData.totalScore / termData.totalMax) * 100 : 0;
        termData.grade = getGrade(termData.percentage);
        transcript.terms.push(termData);
    }

    // Calculate cumulative average
    let totalScore = 0, totalMax = 0;
    for (const term of transcript.terms) {
        totalScore += term.totalScore;
        totalMax += term.totalMax;
    }
    transcript.cumulativePercentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    transcript.cumulativeGrade = getGrade(transcript.cumulativePercentage);

    return transcript;
}

// Print student transcript
export async function printStudentTranscript(studentId) {
    const transcript = await generateStudentTranscript(studentId);
    if (!transcript) {
        showToast('Could not generate transcript', 'error');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Transcript - ${transcript.student.first_name} ${transcript.student.last_name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h1 { text-align: center; color: #1a3a5c; }
                .header { text-align: center; margin-bottom: 30px; }
                .info { margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px; display: flex; justify-content: space-between; flex-wrap: wrap; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background: #1a3a5c; color: white; }
                .term-title { background: #e8f0fe; font-weight: bold; }
                .cumulative { margin-top: 20px; padding: 10px; background: #d1fae5; border-radius: 8px; text-align: center; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏫 ECOLE LA FONTAINE</h1>
                <h3>ACADEMIC TRANSCRIPT</h3>
            </div>
            <div class="info">
                <div><strong>Student:</strong> ${esc(transcript.student.first_name)} ${esc(transcript.student.last_name)}</div>
                <div><strong>Code:</strong> ${esc(transcript.student.student_code || '—')}</div>
                <div><strong>Class:</strong> ${esc(transcript.class?.name || '—')}</div>
            </div>
            ${transcript.terms.map(term => `
                <h3>${esc(term.term.name)}</h3>
                <table>
                    <thead><tr><th>Subject</th><th>Score</th><th>Max</th><th>%</th><th>Grade</th></tr></thead>
                    <tbody>
                        ${term.subjects.map(s => `
                            <tr><td>${esc(s.name)}</td><td>${s.score}</td><td>${s.max}</td><td>${s.percentage.toFixed(1)}%</td><td>${s.grade}</td></tr>
                        `).join('')}
                        <tr class="term-title"><td><strong>TOTAL</strong></td><td><strong>${term.totalScore}</strong></td><td><strong>${term.totalMax}</strong></td><td><strong>${term.percentage.toFixed(1)}%</strong></td><td><strong>${term.grade}</strong></td></tr>
                    </tbody>
                </table>
            `).join('')}
            <div class="cumulative">
                <strong>CUMULATIVE AVERAGE: ${transcript.cumulativePercentage.toFixed(1)}% (${transcript.cumulativeGrade})</strong>
            </div>
            <div style="text-align:center; margin-top:30px; font-size:11px; color:#666;">
                Generated on ${new Date().toLocaleString()} | ECOLE LA FONTAINE
            </div>
            <script>window.print();setTimeout(window.close,500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Export transcript to Excel
export async function exportTranscriptToExcel(studentId) {
    const transcript = await generateStudentTranscript(studentId);
    if (!transcript) {
        showToast('Could not generate transcript', 'error');
        return;
    }

    const data = [];
    for (const term of transcript.terms) {
        for (const subject of term.subjects) {
            data.push({
                'Student': `${transcript.student.first_name} ${transcript.student.last_name}`,
                'Student Code': transcript.student.student_code,
                'Class': transcript.class?.name,
                'Term': term.term.name,
                'Subject': subject.name,
                'Score': subject.score,
                'Max Marks': subject.max,
                'Percentage (%)': subject.percentage.toFixed(1),
                'Grade': subject.grade
            });
        }
        data.push({
            'Student': `${transcript.student.first_name} ${transcript.student.last_name}`,
            'Student Code': transcript.student.student_code,
            'Class': transcript.class?.name,
            'Term': term.term.name,
            'Subject': 'TOTAL',
            'Score': term.totalScore,
            'Max Marks': term.totalMax,
            'Percentage (%)': term.percentage.toFixed(1),
            'Grade': term.grade
        });
    }

    exportToExcel(data, `${transcript.student.first_name}_${transcript.student.last_name}_Transcript`);
    showToast('✅ Transcript exported', 'success');
}
// ── Page render entry point ─────────────────────────────────
export async function renderTranscripts(container) {
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
