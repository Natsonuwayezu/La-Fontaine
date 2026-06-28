// js/modules/teacher-performance.js
// Teacher Performance Module - Track and analyze teacher performance metrics

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtCurrency, fmtPct, esc, exportToExcel } from '../core/utils.js';
import { ensureStateLoaded } from '../core/data-loader.js';
import { getClassById, getSubjectById, getStudentById, getTeacherById } from './student-fees.js';

export async function renderTeacherPerformance(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    if (user?.role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Access denied. Admin privileges required.</div>';
        return;
    }

    const teachers = state.teachers.filter(t => t.role === 'teacher' && t.is_active !== false);
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
    const currentTermId = state.currentTerm?.id;

    // Calculate performance metrics for each teacher
    const teacherPerformance = [];

    for (const teacher of teachers) {
        const assignments = await getAll('teacher_assignments', { teacher_id: teacher.id });
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        const subjectIds = [...new Set(assignments.map(a => a.subject_id))];

        let totalStudentPerformance = 0;
        let totalClasses = 0;
        let totalMarksEntered = 0;
        let totalAssessments = 0;

        for (const classId of classIds) {
            const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
            const assessments = state.assessments.filter(a =>
                a.class_id === classId &&
                a.term_id === currentTermId &&
                subjectIds.includes(a.subject_id)
            );

            totalAssessments += assessments.length;

            // Calculate average performance for students in this class
            let classTotalPct = 0;
            let studentCount = 0;

            for (const student of students) {
                let studentScore = 0;
                let studentMax = 0;

                for (const assessment of assessments) {
                    const mark = state.marks.find(m =>
                        m.assessment_id === assessment.id &&
                        m.student_id === student.id
                    );
                    if (mark) {
                        studentScore += mark.score;
                        studentMax += assessment.max_marks;
                    }
                }

                if (studentMax > 0) {
                    classTotalPct += (studentScore / studentMax) * 100;
                    studentCount++;
                }
            }

            if (studentCount > 0) {
                totalStudentPerformance += classTotalPct / studentCount;
                totalClasses++;
            }

            // Count marks entered by this teacher
            const teacherMarks = state.marks.filter(m => {
                const assessment = state.assessments.find(a => a.id === m.assessment_id);
                return assessment && subjectIds.includes(assessment.subject_id) && classIds.includes(assessment.class_id);
            });
            totalMarksEntered += teacherMarks.length;
        }

        const avgPerformance = totalClasses > 0 ? totalStudentPerformance / totalClasses : 0;
        const performanceGrade = getGrade(avgPerformance);
        const performanceClass = getGradeClass(avgPerformance);

        teacherPerformance.push({
            teacher: teacher,
            classCount: classIds.length,
            subjectCount: subjectIds.length,
            avgPerformance: avgPerformance,
            performanceGrade: performanceGrade,
            performanceClass: performanceClass,
            marksEntered: totalMarksEntered,
            assessmentCount: totalAssessments,
            assignments: assignments.length
        });
    }

    // Sort by performance (highest first)
    teacherPerformance.sort((a, b) => b.avgPerformance - a.avgPerformance);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">⭐ Teacher Performance Dashboard</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline" onclick="window.exportTeacherPerformance()">📥 Export</button>
                    <button class="btn btn-sm btn-outline" onclick="window.printTeacherPerformance()">🖨️ Print</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="filters-bar">
                    <select id="perf-term-filter" class="form-control" style="width:150px" onchange="window.loadTeacherPerformance()">
                        <option value="">All Terms</option>
                        ${terms.map(t => `<option value="${t.id}" ${t.id === currentTermId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                    </select>
                    <input type="text" id="perf-search" class="form-control flex-1" placeholder="🔍 Search teacher..." oninput="window.filterTeacherPerformance()">
                    <span class="result-count" id="perf-count"></span>
                </div>
                
                <div class="table-wrapper" id="teacher-performance-table">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Teacher</th>
                                <th>Department</th>
                                <th>Classes</th>
                                <th>Subjects</th>
                                <th>Avg Score</th>
                                <th>Grade</th>
                                <th>Marks Entered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherPerformance.map((tp, idx) => `
                                <tr>
                                    <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
                                    <td><strong>${esc(tp.teacher.name)}</strong><br><small>${esc(tp.teacher.email || '')}</small></span>
                                    <td>${esc(tp.teacher.department || 'General')}</span>
                                    <td style="text-align:center">${tp.classCount}</span>
                                    <td style="text-align:center">${tp.subjectCount}</span>
                                    <td style="text-align:center"><span class="badge ${tp.performanceClass}">${tp.avgPerformance.toFixed(1)}%</span></span>
                                    <td style="text-align:center">${tp.performanceGrade}</span>
                                    <td style="text-align:center">${tp.marksEntered.toLocaleString()}</span>
                                    <td style="text-align:center">
                                        <button class="btn btn-sm btn-outline" onclick="window.viewTeacherDetails(${tp.teacher.id})">👁️</button>
                                    </span>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="dash-card" style="margin-top:20px">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Performance Summary</span>
            </div>
            <div class="dash-card-body">
                <div id="perf-summary-stats" class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.length}</div>
                        <div class="stat-label">Active Teachers</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.filter(t => t.avgPerformance >= 70).length}</div>
                        <div class="stat-label">High Performers (≥70%)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.filter(t => t.avgPerformance < 50).length}</div>
                        <div class="stat-label">Needs Improvement (&lt;50%)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${teacherPerformance.reduce((sum, t) => sum + t.marksEntered, 0).toLocaleString()}</div>
                        <div class="stat-label">Total Marks Entered</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.exportTeacherPerformance = exportTeacherPerformance;
    window.printTeacherPerformance = printTeacherPerformance;
    window.filterTeacherPerformance = filterTeacherPerformance;
    window.viewTeacherDetails = viewTeacherDetails;
    window.loadTeacherPerformance = loadTeacherPerformance;

    window._teacherPerformanceData = teacherPerformance;
}

function filterTeacherPerformance() {
    const search = document.getElementById('perf-search')?.value.toLowerCase();
    let filtered = window._teacherPerformanceData || [];

    if (search) {
        filtered = filtered.filter(tp =>
            tp.teacher.name.toLowerCase().includes(search) ||
            (tp.teacher.department || '').toLowerCase().includes(search)
        );
    }

    const tbody = document.querySelector('#teacher-performance-table tbody');
    const countSpan = document.getElementById('perf-count');

    if (countSpan) countSpan.textContent = `${filtered.length} teacher${filtered.length !== 1 ? 's' : ''}`;

    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No teachers found</span></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((tp, idx) => `
        <tr>
            <td style="text-align:center">${idx + 1}${idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : ''}</span>
            <td><strong>${esc(tp.teacher.name)}</strong><br><small>${esc(tp.teacher.email || '')}</small></span>
            <td>${esc(tp.teacher.department || 'General')}</span>
            <td style="text-align:center">${tp.classCount}</span>
            <td style="text-align:center">${tp.subjectCount}</span>
            <td style="text-align:center"><span class="badge ${tp.performanceClass}">${tp.avgPerformance.toFixed(1)}%</span></span>
            <td style="text-align:center">${tp.performanceGrade}</span>
            <td style="text-align:center">${tp.marksEntered.toLocaleString()}</span>
            <td style="text-align:center">
                <button class="btn btn-sm btn-outline" onclick="window.viewTeacherDetails(${tp.teacher.id})">👁️</button>
            </span>
        </tr>
    `).join('');
}

async function loadTeacherPerformance() {
    const termId = document.getElementById('perf-term-filter')?.value;
    // Recalculate with new term filter
    await renderTeacherPerformance(document.getElementById('dynamic-content'));
}

async function viewTeacherDetails(teacherId) {
    const teacher = getTeacherById(teacherId);
    if (!teacher) return;

    const assignments = await getAll('teacher_assignments', { teacher_id: teacherId });
    const classIds = [...new Set(assignments.map(a => a.class_id))];
    const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
    const currentTermId = state.currentTerm?.id;

    // Get class performance details
    const classDetails = [];
    for (const classId of classIds) {
        const cls = getClassById(classId);
        const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
        const assessments = state.assessments.filter(a =>
            a.class_id === classId &&
            a.term_id === currentTermId &&
            subjectIds.includes(a.subject_id)
        );

        let classTotalPct = 0;
        let studentCount = 0;
        let topStudent = '';
        let topScore = 0;

        for (const student of students) {
            let studentScore = 0;
            let studentMax = 0;

            for (const assessment of assessments) {
                const mark = state.marks.find(m =>
                    m.assessment_id === assessment.id &&
                    m.student_id === student.id
                );
                if (mark) {
                    studentScore += mark.score;
                    studentMax += assessment.max_marks;
                }
            }

            if (studentMax > 0) {
                const pct = (studentScore / studentMax) * 100;
                classTotalPct += pct;
                studentCount++;

                if (pct > topScore) {
                    topScore = pct;
                    topStudent = `${student.first_name} ${student.last_name}`;
                }
            }
        }

        const avgPct = studentCount > 0 ? classTotalPct / studentCount : 0;

        classDetails.push({
            class: cls,
            students: students.length,
            avgPerformance: avgPct,
            topStudent: topStudent,
            topScore: topScore,
            assessmentCount: assessments.length
        });
    }

    classDetails.sort((a, b) => b.avgPerformance - a.avgPerformance);

    showModal(`
        <div class="modal-overlay">
            <div class="modal modal-lg" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>👩‍🏫 Teacher Performance Details - ${esc(teacher.name)}</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid" style="margin-bottom:16px">
                        <div class="form-group"><label>Name</label><input readonly value="${esc(teacher.name)}" class="form-control"></div>
                        <div class="form-group"><label>Email</label><input readonly value="${esc(teacher.email)}" class="form-control"></div>
                        <div class="form-group"><label>Department</label><input readonly value="${esc(teacher.department || 'General')}" class="form-control"></div>
                        <div class="form-group"><label>Phone</label><input readonly value="${esc(teacher.phone || '—')}" class="form-control"></div>
                    </div>
                    
                    <h4>📋 Class Performance</h4>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th style="text-align:center">Students</th>
                                    <th style="text-align:center">Assessments</th>
                                    <th style="text-align:center">Avg Score</th>
                                    <th>Top Performer</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${classDetails.map(cd => `
                                    <tr>
                                        <td><strong>${esc(cd.class?.name)}</strong></td>
                                        <td style="text-align:center">${cd.students}</span>
                                        <td style="text-align:center">${cd.assessmentCount}</span>
                                        <td style="text-align:center"><span class="badge ${getGradeClass(cd.avgPerformance)}">${cd.avgPerformance.toFixed(1)}%</span></span>
                                        <td>${cd.topStudent ? esc(cd.topStudent) + ` (${cd.topScore.toFixed(1)}%)` : '—'}</span>
                                    </tr>
                                `).join('') || '<td><td colspan="5" style="text-align:center;padding:20px">No class data available</span></td>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `);
}

function exportTeacherPerformance() {
    const data = (window._teacherPerformanceData || []).map(tp => ({
        'Teacher Name': tp.teacher.name,
        'Email': tp.teacher.email,
        'Department': tp.teacher.department || 'General',
        'Number of Classes': tp.classCount,
        'Number of Subjects': tp.subjectCount,
        'Average Performance %': tp.avgPerformance.toFixed(1),
        'Grade': tp.performanceGrade,
        'Marks Entered': tp.marksEntered,
        'Assessments': tp.assessmentCount
    }));

    exportToExcel(data, `Teacher_Performance_${new Date().toISOString().split('T')[0]}`);
    showToast('✅ Teacher performance exported', 'success');
}

function printTeacherPerformance() {
    const table = document.querySelector('#teacher-performance-table');
    if (!table) {
        showToast('No data to print', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Teacher Performance Report - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Teacher Performance Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${table.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Helper functions that need to be available
function getGrade(pct) {
    if (pct === null || isNaN(pct)) return '—';
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
}

function getGradeClass(pct) {
    const grade = getGrade(pct);
    if (grade === 'A+') return 'grade-Ap';
    if (grade === 'A') return 'grade-A';
    if (grade === 'B') return 'grade-B';
    if (grade === 'C') return 'grade-C';
    if (grade === 'D') return 'grade-D';
    return 'grade-F';
}