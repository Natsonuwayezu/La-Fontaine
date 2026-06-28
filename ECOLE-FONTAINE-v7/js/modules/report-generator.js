// ============================================================
// REPORT GENERATOR MODULE - Generate and export academic reports
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, fmtPct, getGrade, getGradeClass, esc, exportToExcel } from '../core/utils.js';
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';

// Generate class performance report
export async function generateClassPerformanceReport(classId, termId) {
    const cls = getClassById(classId);
    const term = (state.terms || []).find(t => t.id == termId);
    if (!cls || !term) return null;

    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.term_id === termId);
    const marks = (state.marks || []).filter(m => assessments.some(a => a.id === m.assessment_id));

    const studentData = students.map(student => {
        let totalScore = 0, totalMax = 0;
        for (const assessment of assessments) {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }
        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        return {
            name: `${student.first_name} ${student.last_name}`,
            code: student.student_code,
            totalScore: totalScore,
            totalMax: totalMax,
            percentage: percentage,
            grade: getGrade(percentage)
        };
    });

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
        topStudent: topStudent?.name || '—',
        topStudentPercentage: topStudent?.percentage || 0,
        students: studentData
    };
}

// Export class performance report to Excel
export async function exportClassPerformanceReport(classId, termId) {
    const report = await generateClassPerformanceReport(classId, termId);
    if (!report) {
        showToast('Could not generate report', 'error');
        return;
    }

    const data = report.students.map(s => ({
        'Rank': s.rank,
        'Student Name': s.name,
        'Student Code': s.code,
        'Total Score': s.totalScore,
        'Max Score': s.totalMax,
        'Percentage (%)': s.percentage.toFixed(1),
        'Grade': s.grade
    }));

    exportToExcel(data, `${report.className}_${report.termName}_Performance`);
    showToast('✅ Class performance report exported', 'success');
}

// Generate subject performance report
export async function generateSubjectPerformanceReport(subjectId, classId, termId) {
    const subject = getSubjectById(subjectId);
    const cls = getClassById(classId);
    const term = (state.terms || []).find(t => t.id == termId);
    if (!subject || !cls || !term) return null;

    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
    const assessments = (state.assessments || []).filter(a => a.class_id === classId && a.subject_id === subjectId && a.term_id === termId);
    const marks = (state.marks || []).filter(m => assessments.some(a => a.id === m.assessment_id));

    const studentData = students.map(student => {
        let totalScore = 0, totalMax = 0;
        for (const assessment of assessments) {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }
        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        return {
            name: `${student.first_name} ${student.last_name}`,
            code: student.student_code,
            score: totalScore,
            maxScore: totalMax,
            percentage: percentage,
            grade: getGrade(percentage)
        };
    });

    studentData.sort((a, b) => b.percentage - a.percentage);
    const classAvg = studentData.reduce((sum, s) => sum + s.percentage, 0) / (studentData.length || 1);
    const passRate = studentData.filter(s => s.percentage >= 50).length / (studentData.length || 1) * 100;

    return {
        subjectName: subject.name,
        className: cls.name,
        termName: term.name,
        totalStudents: students.length,
        classAverage: classAvg,
        passRate: passRate,
        students: studentData
    };
}

// Generate teacher performance report
export async function generateTeacherPerformanceReport(teacherId, termId) {
    const teacher = (state.teachers || []).find(t => t.id == teacherId);
    if (!teacher) return null;

    const assignments = await getAll('teacher_assignments', { teacher_id: teacherId });
    const classIds = [...new Set(assignments.map(a => a.class_id))];

    const classPerformances = [];
    for (const classId of classIds) {
        const report = await generateClassPerformanceReport(classId, termId);
        if (report) classPerformances.push(report);
    }

    const overallAvg = classPerformances.reduce((sum, c) => sum + c.classAverage, 0) / (classPerformances.length || 1);
    const totalStudents = classPerformances.reduce((sum, c) => sum + c.totalStudents, 0);

    return {
        teacherName: teacher.name,
        classesTaught: classPerformances.length,
        totalStudents: totalStudents,
        overallAverage: overallAvg,
        classPerformances: classPerformances
    };
}

// Generate grade distribution report
export function generateGradeDistributionReport(classId = null, termId = null) {
    let students = (state.students || []).filter(s => s.status === 'Active');
    if (classId) students = students.filter(s => s.class_id == classId);

    let assessments = (state.assessments || []);
    if (termId) assessments = assessments.filter(a => a.term_id == termId);
    if (classId) assessments = assessments.filter(a => a.class_id == classId);

    const marks = (state.marks || []).filter(m => assessments.some(a => a.id === m.assessment_id));
    const gradeCount = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

    for (const student of students) {
        let totalScore = 0, totalMax = 0;
        for (const assessment of assessments) {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }
        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        const grade = getGrade(percentage);
        if (gradeCount.hasOwnProperty(grade)) gradeCount[grade]++;
    }

    const total = students.length || 1;
    const distribution = {};
    for (const [grade, count] of Object.entries(gradeCount)) {
        distribution[grade] = { count, percentage: (count / total) * 100 };
    }

    return distribution;
}

// Generate school summary report
export function generateSchoolSummaryReport(termId = null) {
    const classes = (state.classes || []).filter(c => c.is_active !== false);
    const classReports = [];

    for (const cls of classes) {
        const report = generateGradeDistributionReport(cls.id, termId);
        const students = (state.students || []).filter(s => s.class_id == cls.id && s.status === 'Active').length;
        classReports.push({
            className: cls.name,
            students: students,
            distribution: report
        });
    }

    const totalStudents = (state.students || []).filter(s => s.status === 'Active').length;
    const totalAssessments = termId ? (state.assessments || []).filter(a => a.term_id == termId).length : (state.assessments || []).length;
    const totalMarks = (state.marks || []).length;

    return {
        totalStudents,
        totalClasses: classes.length,
        totalAssessments,
        totalMarks,
        classReports
    };
}

// Print report (generic)
export function printReport(elementId, title) {
    const element = document.getElementById(elementId);
    if (!element) {
        showToast('Report content not found', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title || 'Report'}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background: #1a3a5c; color: white; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>${element.innerHTML}<script>window.print();setTimeout(window.close,500);<\/script></body>
        </html>
    `);
    printWindow.document.close();
}

// Export summary report to Excel
export function exportSummaryReport(termId = null) {
    const summary = generateSchoolSummaryReport(termId);
    const data = summary.classReports.map(cr => {
        const row = { 'Class': cr.className, 'Students': cr.students };
        for (const [grade, stats] of Object.entries(cr.distribution)) {
            row[`${grade} Count`] = stats.count;
            row[`${grade} %`] = stats.percentage.toFixed(1);
        }
        return row;
    });

    const filename = termId ? `School_Summary_Term_${termId}` : 'School_Summary_Annual';
    exportToExcel(data, filename);
    showToast('✅ Summary report exported', 'success');
}
// ── Page render entry point ─────────────────────────────────
export async function renderReportGenerator(container) {
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
