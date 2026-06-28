// ============================================================
// ACADEMIC REPORTS MODULE - Comprehensive academic reports
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, fmtPct, getGrade, getGradeClass, esc, exportToExcel } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

// Generate termly academic report
export async function generateTermlyReport(classId, termId) {
    const cls = getClassById(classId);
    const term = (state.terms || []).find(t => t.id == termId);
    if (!cls || !term) return null;

    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.term_id === termId);
    const subjects = (state.subjects || []).filter(s => s.level === cls.level && s.is_active !== false);

    const studentData = [];
    for (const student of students) {
        const subjectScores = [];
        let totalScore = 0, totalMax = 0;

        for (const subject of subjects) {
            const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
            let subjScore = 0, subjMax = 0;
            for (const assessment of subjectAssessments) {
                const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                if (mark) {
                    subjScore += mark.score;
                    subjMax += assessment.max_marks;
                }
            }
            const percentage = subjMax > 0 ? (subjScore / subjMax) * 100 : 0;
            subjectScores.push({
                name: subject.name,
                score: subjScore,
                max: subjMax,
                percentage: percentage,
                grade: getGrade(percentage)
            });
            totalScore += subjScore;
            totalMax += subjMax;
        }

        const overallPercentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        studentData.push({
            student: student,
            subjectScores: subjectScores,
            totalScore: totalScore,
            totalMax: totalMax,
            percentage: overallPercentage,
            grade: getGrade(overallPercentage)
        });
    }

    // Rank students
    studentData.sort((a, b) => b.percentage - a.percentage);
    let rank = 1;
    for (let i = 0; i < studentData.length; i++) {
        if (i > 0 && studentData[i].percentage === studentData[i - 1].percentage) {
            studentData[i].rank = studentData[i - 1].rank;
        } else {
            studentData[i].rank = rank;
        }
        rank = studentData[i].rank + 1;
    }

    const classAvg = studentData.reduce((sum, s) => sum + s.percentage, 0) / (studentData.length || 1);
    const passRate = studentData.filter(s => s.percentage >= 50).length / (studentData.length || 1) * 100;
    const topStudent = studentData[0];

    return {
        className: cls.name,
        termName: term.name,
        totalStudents: students.length,
        classAverage: classAvg,
        passRate: passRate,
        topStudent: topStudent ? `${topStudent.student.first_name} ${topStudent.student.last_name}` : '—',
        topStudentPercentage: topStudent?.percentage || 0,
        students: studentData
    };
}

// Generate subject-wise analysis report
export async function generateSubjectAnalysisReport(classId, termId) {
    const cls = getClassById(classId);
    const term = (state.terms || []).find(t => t.id == termId);
    if (!cls || !term) return null;

    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.term_id === termId);
    const subjects = (state.subjects || []).filter(s => s.level === cls.level && s.is_active !== false);

    const subjectData = [];
    for (const subject of subjects) {
        const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
        let totalPercentage = 0, studentCount = 0;
        let highestScore = 0, lowestScore = 100;
        let passCount = 0;

        for (const student of students) {
            let subjScore = 0, subjMax = 0;
            for (const assessment of subjectAssessments) {
                const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                if (mark) {
                    subjScore += mark.score;
                    subjMax += assessment.max_marks;
                }
            }
            if (subjMax > 0) {
                const percentage = (subjScore / subjMax) * 100;
                totalPercentage += percentage;
                studentCount++;
                if (percentage > highestScore) highestScore = percentage;
                if (percentage < lowestScore) lowestScore = percentage;
                if (percentage >= 50) passCount++;
            }
        }

        subjectData.push({
            name: subject.name,
            average: studentCount > 0 ? totalPercentage / studentCount : 0,
            highest: highestScore,
            lowest: lowestScore,
            passRate: studentCount > 0 ? (passCount / studentCount) * 100 : 0,
            grade: getGrade(studentCount > 0 ? totalPercentage / studentCount : 0)
        });
    }

    subjectData.sort((a, b) => b.average - a.average);
    return subjectData;
}

// Generate class comparison report (across multiple classes)
export async function generateClassComparisonReport(termId) {
    const classes = (state.classes || []).filter(c => c.is_active !== false);
    const classReports = [];

    for (const cls of classes) {
        const report = await generateTermlyReport(cls.id, termId);
        if (report) {
            classReports.push({
                name: cls.name,
                students: report.totalStudents,
                average: report.classAverage,
                passRate: report.passRate,
                topStudent: report.topStudent,
                grade: getGrade(report.classAverage)
            });
        }
    }

    classReports.sort((a, b) => b.average - a.average);
    return classReports;
}

// Generate student progression report (across terms)
export async function generateStudentProgressionReport(studentId) {
    const student = getStudentById(studentId);
    if (!student) return null;

    const cls = getClassById(student.class_id);
    const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id).sort((a, b) => a.id - b.id);
    const subjects = (state.subjects || []).filter(s => s.level === cls?.level && s.is_active !== false);

    const termData = [];
    for (const term of terms) {
        const assessments = (state.assessments || []).filter(a => a.class_id === student.class_id && a.term_id === term.id);
        let totalScore = 0, totalMax = 0;

        for (const subject of subjects) {
            const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
            let subjScore = 0, subjMax = 0;
            for (const assessment of subjectAssessments) {
                const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === studentId);
                if (mark) {
                    subjScore += mark.score;
                    subjMax += assessment.max_marks;
                }
            }
            totalScore += subjScore;
            totalMax += subjMax;
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        termData.push({
            term: term.name,
            percentage: percentage,
            grade: getGrade(percentage),
            totalScore: totalScore,
            totalMax: totalMax
        });
    }

    const trend = termData.length >= 2 ? (termData[termData.length - 1].percentage - termData[0].percentage) : 0;
    const trendText = trend > 2 ? 'Improving' : (trend < -2 ? 'Declining' : 'Stable');

    return {
        student: student,
        class: cls,
        progression: termData,
        trend: trendText,
        currentAverage: termData[termData.length - 1]?.percentage || 0
    };
}

// Export academic report to Excel
export async function exportAcademicReport(reportType, classId, termId) {
    let data = [];
    let filename = '';

    if (reportType === 'termly') {
        const report = await generateTermlyReport(classId, termId);
        if (report) {
            data = report.students.map(s => ({
                'Rank': s.rank,
                'Student Name': `${s.student.first_name} ${s.student.last_name}`,
                'Student Code': s.student.student_code,
                'Total Score': s.totalScore,
                'Max Score': s.totalMax,
                'Percentage (%)': s.percentage.toFixed(1),
                'Grade': s.grade
            }));
            const cls = getClassById(classId);
            filename = `${cls?.name}_${report.termName}_Academic_Report`;
        }
    } else if (reportType === 'subject') {
        const report = await generateSubjectAnalysisReport(classId, termId);
        if (report) {
            data = report.map(s => ({
                'Subject': s.name,
                'Average %': s.average.toFixed(1),
                'Highest %': s.highest.toFixed(1),
                'Lowest %': s.lowest.toFixed(1),
                'Pass Rate %': s.passRate.toFixed(1),
                'Grade': s.grade
            }));
            const cls = getClassById(classId);
            filename = `${cls?.name}_Subject_Analysis`;
        }
    } else if (reportType === 'comparison') {
        const report = await generateClassComparisonReport(termId);
        if (report) {
            data = report.map(c => ({
                'Class': c.name,
                'Students': c.students,
                'Average %': c.average.toFixed(1),
                'Pass Rate %': c.passRate.toFixed(1),
                'Top Student': c.topStudent,
                'Grade': c.grade
            }));
            filename = `Class_Comparison_Report`;
        }
    }

    if (data.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    exportToExcel(data, filename);
    showToast('✅ Academic report exported', 'success');
}

// Print academic report
export async function printAcademicReport(reportType, classId, termId) {
    let html = '';
    let title = '';

    if (reportType === 'termly') {
        const report = await generateTermlyReport(classId, termId);
        if (!report) return;
        title = `${report.className} - ${report.termName} Academic Report`;
        html = `
            <h2>${report.className} - ${report.termName} Academic Report</h2>
            <div class="summary">Class Average: ${report.classAverage.toFixed(1)}% | Pass Rate: ${report.passRate.toFixed(1)}% | Top Student: ${report.topStudent} (${report.topStudentPercentage.toFixed(1)}%)</div>
            <table><thead><tr><th>Rank</th><th>Student Name</th><th>Student Code</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>
            ${report.students.map(s => `<tr><td>${s.rank}</td><td>${s.student.first_name} ${s.student.last_name}</td><td>${s.student.student_code}</td><td>${s.percentage.toFixed(1)}%</td><td>${s.grade}</td></tr>`).join('')}
            </tbody></table>
        `;
    } else if (reportType === 'subject') {
        const report = await generateSubjectAnalysisReport(classId, termId);
        if (!report) return;
        const cls = getClassById(classId);
        title = `${cls?.name} - Subject Analysis`;
        html = `
            <h2>${cls?.name} - Subject Performance Analysis</h2>
            <table><thead><tr><th>Subject</th><th>Average %</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Grade</th></tr></thead><tbody>
            ${report.map(s => `<tr><td>${s.name}</td><td>${s.average.toFixed(1)}%</td><td>${s.highest.toFixed(1)}%</td><td>${s.lowest.toFixed(1)}%</td><td>${s.passRate.toFixed(1)}%</td><td>${s.grade}</td></tr>`).join('')}
            </tbody></table>
        `;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>${title}</title><style>body{font-family:Arial;padding:20px}h2{text-align:center}.summary{margin:20px 0;padding:10px;background:#f0f0f0;border-radius:8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#1a3a5c;color:#fff}</style></head>
        <body>${html}<p style="text-align:center;margin-top:30px;">Generated on ${new Date().toLocaleString()}</p><script>window.print();setTimeout(window.close,500);</script></body>
        </html>
    `);
    printWindow.document.close();
}
// ── Page render entry point ─────────────────────────────────
export async function renderAcademicReports(container) {
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
