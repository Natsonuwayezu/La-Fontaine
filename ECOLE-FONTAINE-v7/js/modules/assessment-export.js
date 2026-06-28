// js/modules/assessment-export.js
// Assessment Export Module - Export assessment data and marks to Excel/PDF

import { state } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast, showModal, closeModal } from '../ui/modals.js';
import { fmtCurrency, fmtDate, fmtPct, esc, exportToExcel, downloadBlob } from '../core/utils.js';
import { getClassById, getSubjectById, getStudentById, getTermById } from '../core/state.js';;

export async function renderAssessmentExport(container) {
    await ensureStateLoaded();

    const user = state.currentUser;
    const classes = state.classes.filter(c => c.is_active !== false);
    const terms = state.terms.filter(t => t.academic_year_id === state.currentAcadYear?.id);
    const subjects = state.subjects.filter(s => s.is_active !== false);

    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📤 Export Assessments & Marks</span>
            </div>
            <div class="dash-card-body">
                <div class="alert alert-info">
                    <strong>Export Options:</strong> Choose what data to export and in which format.
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label>Export Type</label>
                        <select id="export-type" class="form-control" onchange="window.toggleExportOptions()">
                            <option value="assessments">Assessments List</option>
                            <option value="marks_by_assessment">Marks by Assessment</option>
                            <option value="marks_by_student">Marks by Student</option>
                            <option value="summary">Assessment Summary Report</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="export-class-group">
                        <label>Class</label>
                        <select id="export-class" class="form-control">
                            <option value="">All Classes</option>
                            ${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" id="export-subject-group" style="display:none">
                        <label>Subject</label>
                        <select id="export-subject" class="form-control">
                            <option value="">All Subjects</option>
                            ${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" id="export-term-group">
                        <label>Term</label>
                        <select id="export-term" class="form-control">
                            <option value="">All Terms</option>
                            ${terms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" id="export-assessment-group" style="display:none">
                        <label>Specific Assessment</label>
                        <select id="export-assessment" class="form-control">
                            <option value="">-- Select Assessment --</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Format</label>
                        <select id="export-format" class="form-control">
                            <option value="excel">Excel (.xlsx)</option>
                            <option value="csv">CSV (.csv)</option>
                            <option value="pdf">PDF Document</option>
                        </select>
                    </div>
                </div>
                
                <div class="btn-group" style="margin-top:20px">
                    <button class="btn btn-primary" onclick="window.executeAssessmentExport()">📥 Export Data</button>
                    <button class="btn btn-outline" onclick="window.resetExportForm()">🔄 Reset</button>
                </div>
                
                <div id="export-preview" class="table-wrapper" style="margin-top:20px;display:none"></div>
            </div>
        </div>
    `;

    // Register functions
    window.toggleExportOptions = toggleExportOptions;
    window.executeAssessmentExport = executeAssessmentExport;
    window.resetExportForm = resetExportForm;

    // Event listeners for dynamic loading
    document.getElementById('export-class')?.addEventListener('change', loadAssessmentsForExport);
    document.getElementById('export-subject')?.addEventListener('change', loadAssessmentsForExport);
    document.getElementById('export-term')?.addEventListener('change', loadAssessmentsForExport);
}

function toggleExportOptions() {
    const exportType = document.getElementById('export-type')?.value;
    const subjectGroup = document.getElementById('export-subject-group');
    const assessmentGroup = document.getElementById('assessment-group');

    if (subjectGroup) {
        subjectGroup.style.display = (exportType === 'marks_by_assessment' || exportType === 'marks_by_student') ? 'block' : 'none';
    }

    if (assessmentGroup) {
        assessmentGroup.style.display = exportType === 'marks_by_assessment' ? 'block' : 'none';
    }

    if (exportType === 'marks_by_assessment') {
        loadAssessmentsForExport();
    }
}

async function loadAssessmentsForExport() {
    const classId = document.getElementById('export-class')?.value;
    const subjectId = document.getElementById('export-subject')?.value;
    const termId = document.getElementById('export-term')?.value;
    const assessmentSelect = document.getElementById('export-assessment');

    if (!assessmentSelect) return;

    let assessments = state.assessments;

    if (classId) assessments = assessments.filter(a => a.class_id == classId);
    if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);
    if (termId) assessments = assessments.filter(a => a.term_id == termId);

    assessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    assessmentSelect.innerHTML = '<option value="">-- Select Assessment --</option>' +
        assessments.map(a => {
            const cls = getClassById(a.class_id);
            const sub = getSubjectById(a.subject_id);
            return `<option value="${a.id}">${esc(a.assessment_name)} - ${esc(cls?.name || '?')} (${esc(sub?.name || '?')})</option>`;
        }).join('');
}

async function executeAssessmentExport() {
    const exportType = document.getElementById('export-type')?.value;
    const classId = document.getElementById('export-class')?.value;
    const subjectId = document.getElementById('export-subject')?.value;
    const termId = document.getElementById('export-term')?.value;
    const assessmentId = document.getElementById('export-assessment')?.value;
    const format = document.getElementById('export-format')?.value;

    let data = [];
    let filename = `Assessment_Export_${new Date().toISOString().split('T')[0]}`;

    switch (exportType) {
        case 'assessments':
            data = await exportAssessmentsList(classId, subjectId, termId);
            filename = `Assessments_List_${new Date().toISOString().split('T')[0]}`;
            break;
        case 'marks_by_assessment':
            if (!assessmentId) {
                showToast('Please select a specific assessment', 'warning');
                return;
            }
            data = await exportMarksByAssessment(assessmentId);
            const assessment = state.assessments.find(a => a.id == assessmentId);
            filename = `Marks_${assessment?.assessment_name || 'Assessment'}_${new Date().toISOString().split('T')[0]}`;
            break;
        case 'marks_by_student':
            data = await exportMarksByStudent(classId, subjectId, termId);
            filename = `Marks_By_Student_${new Date().toISOString().split('T')[0]}`;
            break;
        case 'summary':
            data = await exportAssessmentSummary(classId, termId);
            filename = `Assessment_Summary_${new Date().toISOString().split('T')[0]}`;
            break;
    }

    if (!data || data.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    if (format === 'excel') {
        exportToExcel(data, filename);
    } else if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(data);
        const csv = XLSX.utils.sheet_to_csv(ws);
        downloadBlob(csv, `${filename}.csv`, 'text/csv');
    } else if (format === 'pdf') {
        await exportToPDF(data, filename);
    }

    showToast(`✅ Exported ${data.length} records`, 'success');
}

async function exportAssessmentsList(classId, subjectId, termId) {
    let assessments = [...state.assessments];

    if (classId) assessments = assessments.filter(a => a.class_id == classId);
    if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);
    if (termId) assessments = assessments.filter(a => a.term_id == termId);

    return assessments.map(a => {
        const cls = getClassById(a.class_id);
        const sub = getSubjectById(a.subject_id);
        const term = getTermById(a.term_id);
        const marksCount = state.marks.filter(m => m.assessment_id === a.id).length;
        const studentsCount = state.students.filter(s => s.class_id === a.class_id && s.status === 'Active').length;

        return {
            'Assessment Name': a.assessment_name,
            'Type': a.assessment_type,
            'Class': cls?.name || '—',
            'Subject': sub?.name || '—',
            'Term': term?.name || '—',
            'Date': fmtDate(a.date),
            'Due Date': fmtDate(a.due_date),
            'Max Marks': a.max_marks,
            'Marks Entered': `${marksCount}/${studentsCount}`,
            'Completion %': studentsCount > 0 ? ((marksCount / studentsCount) * 100).toFixed(1) : 0,
            'Status': a.is_locked ? 'Locked' : 'Open'
        };
    });
}

async function exportMarksByAssessment(assessmentId) {
    const assessment = state.assessments.find(a => a.id == assessmentId);
    if (!assessment) return [];

    const students = state.students.filter(s => s.class_id === assessment.class_id && s.status === 'Active');
    const marks = state.marks.filter(m => m.assessment_id === assessmentId);
    const marksMap = new Map(marks.map(m => [m.student_id, m.score]));

    const cls = getClassById(assessment.class_id);
    const sub = getSubjectById(assessment.subject_id);

    return students.map(s => {
        const score = marksMap.get(s.id);
        const percentage = score ? (score / assessment.max_marks * 100).toFixed(1) : null;
        const grade = percentage ? getGrade(percentage) : '—';

        return {
            'Student Code': s.student_code,
            'Student Name': `${s.first_name} ${s.last_name}`,
            'Class': cls?.name || '—',
            'Subject': sub?.name || '—',
            'Assessment': assessment.assessment_name,
            'Type': assessment.assessment_type,
            'Score': score !== undefined ? score : 'Not Entered',
            'Max Marks': assessment.max_marks,
            'Percentage': percentage ? `${percentage}%` : '—',
            'Grade': grade
        };
    });
}

async function exportMarksByStudent(classId, subjectId, termId) {
    let students = [...state.students];
    let assessments = [...state.assessments];

    if (classId) {
        students = students.filter(s => s.class_id == classId);
        assessments = assessments.filter(a => a.class_id == classId);
    }
    if (subjectId) assessments = assessments.filter(a => a.subject_id == subjectId);
    if (termId) assessments = assessments.filter(a => a.term_id == termId);

    const data = [];
    for (const student of students) {
        const row = {
            'Student Code': student.student_code,
            'Student Name': `${student.first_name} ${student.last_name}`,
            'Class': getClassById(student.class_id)?.name || '—'
        };

        let totalScore = 0;
        let totalMax = 0;

        for (const assessment of assessments) {
            const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            const score = mark?.score || 0;
            const percentage = mark ? (mark.score / assessment.max_marks * 100).toFixed(1) : '—';

            row[`${assessment.assessment_name} (${assessment.max_marks})`] = mark ? `${mark.score}/${assessment.max_marks} (${percentage}%)` : 'Not entered';

            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }

        row['Total Score'] = totalScore > 0 ? `${totalScore}/${totalMax}` : '—';
        row['Overall %'] = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) + '%' : '—';

        data.push(row);
    }

    return data;
}

async function exportAssessmentSummary(classId, termId) {
    let assessments = [...state.assessments];

    if (classId) assessments = assessments.filter(a => a.class_id == classId);
    if (termId) assessments = assessments.filter(a => a.term_id == termId);

    return assessments.map(a => {
        const marks = state.marks.filter(m => m.assessment_id === a.id);
        const scores = marks.map(m => m.score);
        const avgScore = scores.length ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1) : '—';
        const passCount = marks.filter(m => (m.score / a.max_marks) * 100 >= 50).length;
        const passRate = marks.length ? ((passCount / marks.length) * 100).toFixed(1) : '—';
        const maxScore = scores.length ? Math.max(...scores) : '—';
        const minScore = scores.length ? Math.min(...scores) : '—';

        return {
            'Assessment': a.assessment_name,
            'Type': a.assessment_type,
            'Class': getClassById(a.class_id)?.name || '—',
            'Subject': getSubjectById(a.subject_id)?.name || '—',
            'Max Marks': a.max_marks,
            'Students Entered': marks.length,
            'Average Score': avgScore,
            'Highest Score': maxScore,
            'Lowest Score': minScore,
            'Pass Rate': passRate + '%',
            'Status': a.is_locked ? 'Locked' : 'Open'
        };
    });
}

async function exportToPDF(data, filename) {
    // Simple HTML table to PDF conversion
    const headers = Object.keys(data[0] || {});
    const rows = data.map(row => headers.map(h => row[h]));

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${filename}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px}
                h1{text-align:center;color:#1a3a5c}
                table{width:100%;border-collapse:collapse;margin-top:20px}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>${filename}</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <table>
                <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${rows.map(row => `<tr>${row.map(cell => `<td>${esc(String(cell))}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    // Use html2pdf if available
    if (typeof html2pdf !== 'undefined') {
        const element = document.createElement('div');
        element.innerHTML = html;
        html2pdf().set({
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `${filename}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        }).from(element).save();
    } else {
        // Fallback: open in new window for printing
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    }
}

function resetExportForm() {
    document.getElementById('export-type').value = 'assessments';
    document.getElementById('export-class').value = '';
    document.getElementById('export-subject').value = '';
    document.getElementById('export-term').value = '';
    document.getElementById('export-format').value = 'excel';
    toggleExportOptions();
    showToast('Form reset', 'info', 1500);
}

async function ensureStateLoaded() {
    if (!state.assessments.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}