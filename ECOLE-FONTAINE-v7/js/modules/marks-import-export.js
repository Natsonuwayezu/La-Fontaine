// ============================================================
// MARKS IMPORT/EXPORT MODULE - Bulk import/export marks to Excel
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getSubjectById, getStudentById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher } from '../core/auth.js';
import { fmtDate, esc } from '../core/utils.js';
import { showToast } from '../core/helpers.js';
import { confirmDialog } from '../ui/modals.js';;
import { getAll, insert, update } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { exportToExcel } from '../core/utils.js';
import { logActivity } from '../core/helpers.js';

// Export marks template for a class
export async function exportMarksTemplate(classId, subjectId, assessmentName) {
    const cls = getClassById(classId);
    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));

    const templateData = students.map(s => ({
        'Student Code': s.student_code,
        'Student Name': `${s.first_name} ${s.last_name}`,
        'Score': ''
    }));

    const filename = `${cls?.name}_${assessmentName.replace(/\s/g, '_')}_Template`;
    exportToExcel(templateData, filename);
    showToast('✅ Template downloaded', 'success');
}

// Import marks from Excel
export async function importMarksFromExcel(file, classId, subjectId, assessmentName, maxMarks, assessmentType, assessmentDate) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);

                const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
                let imported = 0;
                let notFound = 0;
                let invalidScores = 0;
                const marksData = [];

                for (const row of rows) {
                    let studentCode = row['Student Code'] || row['student_code'] || '';
                    let studentName = row['Student Name'] || row['Student'] || row['student_name'] || '';
                    let score = parseFloat(row['Score'] || row['Marks'] || row['score'] || 0);

                    let student = students.find(s => s.student_code === studentCode);
                    if (!student && studentName) {
                        student = students.find(s => `${s.first_name} ${s.last_name}`.toLowerCase() === studentName.toLowerCase());
                    }

                    if (!student) {
                        notFound++;
                        continue;
                    }

                    if (isNaN(score) || score < 0 || score > maxMarks) {
                        invalidScores++;
                        continue;
                    }

                    marksData.push({ studentId: student.id, score });
                    imported++;
                }

                if (marksData.length === 0) {
                    reject(new Error('No valid marks found in file'));
                    return;
                }

                // Create or get assessment
                let assessmentId = null;
                const existingAssessment = (state.assessments || []).find(a =>
                    a.class_id == classId && a.subject_id == subjectId &&
                    a.assessment_name === assessmentName && a.term_id === state.currentTerm?.id
                );

                if (existingAssessment) {
                    assessmentId = existingAssessment.id;
                } else {
                    const newAssessment = await insert('assessments', {
                        class_id: parseInt(classId),
                        subject_id: parseInt(subjectId),
                        term_id: state.currentTerm?.id,
                        academic_year_id: state.currentAcadYear?.id,
                        assessment_type: assessmentType,
                        assessment_name: assessmentName,
                        max_marks: maxMarks,
                        date: assessmentDate || new Date().toISOString().split('T')[0],
                        is_locked: false,
                        created_by: getCurrentUser()?.id,
                        created_at: new Date().toISOString()
                    });
                    assessmentId = newAssessment?.id;
                }

                if (!assessmentId) {
                    reject(new Error('Failed to create assessment'));
                    return;
                }

                // Save marks
                let saved = 0;
                for (const mark of marksData) {
                    const existingMark = (state.marks || []).find(m => m.assessment_id === assessmentId && m.student_id === mark.studentId);
                    if (existingMark) {
                        await update('marks', existingMark.id, { score: mark.score });
                    } else {
                        await insert('marks', {
                            assessment_id: assessmentId,
                            student_id: mark.studentId,
                            score: mark.score,
                            entered_by: getCurrentUser()?.id,
                            entered_at: new Date().toISOString()
                        });
                    }
                    saved++;
                }

                await refreshTable('assessments');
                await refreshTable('marks');
                await logActivity(getCurrentUser()?.id, getCurrentUser()?.role, `Imported marks for ${assessmentName}`, 'marks', assessmentId);

                resolve({ imported: saved, notFound, invalidScores });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Export class marks to Excel (all assessments)
export async function exportClassMarksToExcel(classId, termId) {
    const cls = getClassById(classId);
    const students = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active').sort((a, b) => a.last_name.localeCompare(b.last_name));
    const assessments = (state.assessments || []).filter(a => a.class_id == classId && a.term_id === termId);

    if (assessments.length === 0) {
        showToast('No assessments found for this class', 'warning');
        return;
    }

    // Prepare data
    const data = students.map(student => {
        const row = {
            'Student Code': student.student_code,
            'Student Name': `${student.first_name} ${student.last_name}`
        };

        for (const assessment of assessments) {
            const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            const score = mark ? mark.score : '';
            const percentage = mark ? ((mark.score / assessment.max_marks) * 100).toFixed(1) : '';
            row[`${assessment.assessment_name} (/${assessment.max_marks})`] = score;
            row[`${assessment.assessment_name} (%)`] = percentage;
        }

        return row;
    });

    exportToExcel(data, `${cls?.name}_Term_${termId}_Marks`);
    showToast('✅ Class marks exported', 'success');
}

// Export student marks report (transcript)
export async function exportStudentTranscript(studentId) {
    const student = getStudentById(studentId);
    if (!student) return;

    const cls = getClassById(student.class_id);
    const assessments = (state.assessments || []).filter(a => a.class_id === student.class_id && a.term_id === state.currentTerm?.id);
    const subjects = [...new Set(assessments.map(a => a.subject_id))];

    const data = [];
    for (const subjectId of subjects) {
        const subject = getSubjectById(subjectId);
        const subjectAssessments = assessments.filter(a => a.subject_id === subjectId);
        let totalScore = 0, totalMax = 0;

        for (const assessment of subjectAssessments) {
            const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === studentId);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        data.push({
            'Subject': subject?.name,
            'Total Score': totalScore,
            'Max Marks': totalMax,
            'Percentage': percentage.toFixed(1) + '%',
            'Grade': getGrade(percentage)
        });
    }

    exportToExcel(data, `${student.first_name}_${student.last_name}_Transcript`);
    showToast('✅ Transcript exported', 'success');
}

// Import marks from CSV (simple format)
export function importMarksFromCSV(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());

                const studentCodeIndex = headers.findIndex(h => h.toLowerCase().includes('code'));
                const scoreIndex = headers.findIndex(h => h.toLowerCase().includes('score'));

                if (studentCodeIndex === -1 || scoreIndex === -1) {
                    reject(new Error('CSV must contain Student Code and Score columns'));
                    return;
                }

                const marks = [];
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = lines[i].split(',').map(v => v.trim());
                    const studentCode = values[studentCodeIndex];
                    const score = parseFloat(values[scoreIndex]);

                    if (studentCode && !isNaN(score)) {
                        marks.push({ studentCode, score });
                    }
                }

                resolve(marks);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Helper function
function getGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}
// ── Page render entry point ─────────────────────────────────
export async function renderMarksImportExport(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><h2>📥 Marks Import / Export</h2></div>
            <div class="dash-card-body">
                <p class="text-muted">This module provides utility functions used by other modules. 
                Select a specific action from the relevant section.</p>
            </div>
        </div>
    `;
}
