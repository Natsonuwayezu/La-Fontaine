// Full marks import/export with Excel template generation
        // ════════════════════════════════════════════════════════════════════════

        function switchMarksIETab(tabName, event) {
            const tabs = ['export', 'import', 'template'];
            for (const t of tabs) {
                const el = document.getElementById(`marks-${t}-tab`);
                if (el) el.style.display = t === tabName ? 'block' : 'none';
            }
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event && event.target) event.target.classList.add('active');
        }

        function toggleExportOptions() {
            const exportType = document.getElementById('export-type')?.value;
            const classGroup = document.getElementById('export-class-group');
            const subjectGroup = document.getElementById('export-subject-group');
            const assessmentGroup = document.getElementById('export-assessment-group');
            const termGroup = document.getElementById('export-term-group');
            const studentGroup = document.getElementById('export-student-group');

            if (classGroup) classGroup.style.display = exportType !== 'transcript' ? 'block' : 'none';
            if (subjectGroup) subjectGroup.style.display = exportType === 'by_assessment' ? 'block' : 'none';
            if (assessmentGroup) assessmentGroup.style.display = exportType === 'by_assessment' ? 'block' : 'none';
            if (termGroup) termGroup.style.display = exportType === 'by_class' ? 'block' : 'none';
            if (studentGroup) studentGroup.style.display = exportType === 'transcript' ? 'block' : 'none';

            if (exportType === 'by_assessment') loadExportAssessments();
            if (exportType === 'transcript') loadExportStudents();
        }

        async function loadExportAssessments() {
            const classId = document.getElementById('export-class')?.value;
            const subjectId = document.getElementById('export-subject')?.value;
            const termId = document.getElementById('export-term')?.value;
            const assessmentSelect = document.getElementById('export-assessment');

            if (!assessmentSelect) return;

            let assessments = state.assessments || [];
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

        async function loadExportStudents() {
            const classId = document.getElementById('export-class')?.value;
            const studentSelect = document.getElementById('export-student');

            if (!studentSelect) return;

            let students = state.students || [];
            if (classId) students = students.filter(s => s.class_id == classId && s.status === 'Active');
            students.sort((a, b) => a.last_name.localeCompare(b.last_name));

            studentSelect.innerHTML = '<option value="">-- Select Student --</option>' +
                students.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('');
        }

        async function executeMarksExport() {
            const exportType = document.getElementById('export-type')?.value;
            const classId = document.getElementById('export-class')?.value;
            const subjectId = document.getElementById('export-subject')?.value;
            const assessmentId = document.getElementById('export-assessment')?.value;
            const termId = document.getElementById('export-term')?.value;
            const studentId = document.getElementById('export-student')?.value;

            const preview = document.getElementById('export-preview');

            if (exportType === 'by_assessment' && !assessmentId) {
                showToast('Please select an assessment', 'warning');
                return;
            }
            if (exportType === 'by_class' && !classId) {
                showToast('Please select a class', 'warning');
                return;
            }
            if (exportType === 'transcript' && !studentId) {
                showToast('Please select a student', 'warning');
                return;
            }

            preview.style.display = 'block';
            preview.innerHTML = '<div class="spinner-sm"></div> Generating export...';

            try {
                let data = [];
                let filename = `Marks_Export_${new Date().toISOString().split('T')[0]}`;

                if (exportType === 'by_assessment') {
                    data = await exportMarksByAssessment(assessmentId);
                    const assessment = state.assessments.find(a => a.id == assessmentId);
                    filename = `Marks_${assessment?.assessment_name?.replace(/\s/g, '_')}`;
                } else if (exportType === 'by_class') {
                    data = await exportClassMarksToExcel(classId, termId);
                    const cls = getClassById(classId);
                    filename = `${cls?.name}_Marks_Export`;
                } else if (exportType === 'transcript') {
                    data = await exportStudentTranscript(studentId);
                    const student = getStudentById(studentId);
                    filename = `${student?.first_name}_${student?.last_name}_Transcript`;
                }

                if (data && data.length > 0) {
                    exportToExcel(data, filename);
                    preview.innerHTML = `<div class="alert alert-success">✅ Exported ${data.length} records successfully!</div>`;
                    setTimeout(() => preview.style.display = 'none', 3000);
                } else {
                    preview.innerHTML = '<div class="alert alert-warning">No data to export</div>';
                }
            } catch (error) {
                preview.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
            }
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
                return {
                    'Student Code': s.student_code,
                    'Student Name': `${s.first_name} ${s.last_name}`,
                    'Class': cls?.name,
                    'Subject': sub?.name,
                    'Assessment': assessment.assessment_name,
                    'Score': score !== undefined ? score : 'Not Entered',
                    'Max Marks': assessment.max_marks,
                    'Percentage': percentage ? percentage + '%' : '—',
                    'Grade': percentage ? getGrade(percentage) : '—'
                };
            });
        }

        async function exportClassMarksToExcel(classId, termId) {
            const cls = getClassById(classId);
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id == classId && (termId ? a.term_id == termId : true));

            if (assessments.length === 0) {
                showToast('No assessments found for this class', 'warning');
                return [];
            }

            return students.map(student => {
                const row = {
                    'Student Code': student.student_code,
                    'Student Name': `${student.first_name} ${student.last_name}`
                };

                for (const assessment of assessments) {
                    const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                    const score = mark ? mark.score : '';
                    const percentage = mark ? ((mark.score / assessment.max_marks) * 100).toFixed(1) : '';
                    row[`${assessment.assessment_name} (/${assessment.max_marks})`] = score;
                    row[`${assessment.assessment_name} (%)`] = percentage;
                }

                return row;
            });
        }

        async function exportStudentTranscript(studentId) {
            const student = getStudentById(studentId);
            if (!student) return [];

            const cls = getClassById(student.class_id);
            const assessments = state.assessments.filter(a => a.class_id === student.class_id && a.term_id === state.currentTerm?.id);
            const subjects = [...new Set(assessments.map(a => a.subject_id))];

            const data = [];
            for (const subjectId of subjects) {
                const subject = getSubjectById(subjectId);
                const subjectAssessments = assessments.filter(a => a.subject_id === subjectId);
                let totalScore = 0, totalMax = 0;

                for (const assessment of subjectAssessments) {
                    const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === studentId);
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

            return data;
        }

        function printMarksReport() {
            const table = document.querySelector('#marks-export-tab .table-wrapper');
            if (!table) {
                showToast('Generate export preview first', 'warning');
                return;
            }

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Marks Report - ECOLE LA FONTAINE</title>
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
            <h1>🏫 ECOLE LA FONTAINE</h1>
            <h2 style="text-align:center">Marks Report</h2>
            <p style="text-align:center">Generated on ${new Date().toLocaleString()}</p>
            ${table.outerHTML}
            <script>window.print();setTimeout(window.close,500);<\/script>
        </body>
        </html>
    `);
            printWindow.document.close();
        }

        async function previewMarksImport() {
            const file = document.getElementById('import-file')?.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const wb = XLSX.read(ev.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws);
                    const previewDiv = document.getElementById('import-preview');
                    const importBtn = document.getElementById('import-btn');

                    // Validate required columns
                    const firstRow = rows[0] || {};
                    const hasStudentCode = Object.keys(firstRow).some(k => k.toLowerCase().includes('code'));
                    const hasScore = Object.keys(firstRow).some(k => k.toLowerCase().includes('score'));

                    if (!hasStudentCode || !hasScore) {
                        previewDiv.innerHTML = '<div class="alert alert-danger">❌ File must contain "Student Code" and "Score" columns</div>';
                        previewDiv.style.display = 'block';
                        importBtn.style.display = 'none';
                        return;
                    }

                    // Store for import
                    window._importData = rows;

                    previewDiv.innerHTML = `
                <div class="alert alert-success">
                    ✅ Found <strong>${rows.length}</strong> records. Valid columns detected.
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr>${Object.keys(firstRow).map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${rows.slice(0, 5).map(r => `
                                <tr>${Object.values(r).map(v => `<td>${esc(String(v))}</td>`).join('')}</tr>
                            `).join('')}
                            ${rows.length > 5 ? `<tr><td colspan="${Object.keys(firstRow).length}" style="text-align:center">... and ${rows.length - 5} more rows</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            `;
                    previewDiv.style.display = 'block';
                    importBtn.style.display = 'inline-flex';

                } catch (e) {
                    showToast('Error reading file: ' + e.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        async function executeMarksImport() {
            const classId = document.getElementById('import-class')?.value;
            const subjectId = document.getElementById('import-subject')?.value;
            const assessmentName = document.getElementById('import-assessment-name')?.value.trim();
            const assessmentType = document.getElementById('import-assessment-type')?.value;
            const maxMarks = parseFloat(document.getElementById('import-max-marks')?.value);
            const assessmentDate = document.getElementById('import-date')?.value;
            const rows = window._importData;

            if (!classId) { showToast('Please select a class', 'warning'); return; }
            if (!subjectId) { showToast('Please select a subject', 'warning'); return; }
            if (!assessmentName) { showToast('Please enter assessment name', 'warning'); return; }
            if (!maxMarks || maxMarks <= 0) { showToast('Please enter valid max marks', 'warning'); return; }
            if (!rows || rows.length === 0) { showToast('No data to import', 'warning'); return; }

            const btn = document.getElementById('import-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm"></span> Importing...';

            try {
                const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
                let imported = 0;
                let notFound = 0;
                let invalidScores = 0;

                // Find or create assessment
                let assessmentId = null;
                const existingAssessment = state.assessments.find(a =>
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
                        date: assessmentDate,
                        is_locked: false,
                        created_by: getCurrentUser()?.id,
                        created_at: new Date().toISOString()
                    });
                    assessmentId = newAssessment?.id;
                    await refreshTable('assessments');
                }

                if (!assessmentId) throw new Error('Failed to create/find assessment');

                // Process each row
                for (const row of rows) {
                    let studentCode = row['Student Code'] || row['student_code'] || row['Code'] || '';
                    let studentName = row['Student Name'] || row['Student'] || row['student_name'] || '';
                    let score = parseFloat(row['Score'] || row['Marks'] || row['score'] || 0);

                    // Find student
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

                    // Save or update mark
                    const existingMark = state.marks.find(m => m.assessment_id === assessmentId && m.student_id === student.id);
                    if (existingMark) {
                        await update('marks', existingMark.id, { score: score });
                    } else {
                        await insert('marks', {
                            assessment_id: assessmentId,
                            student_id: student.id,
                            score: score,
                            entered_by: getCurrentUser()?.id,
                            entered_at: new Date().toISOString()
                        });
                    }
                    imported++;
                }

                await refreshTable('marks');

                showToast(`✅ Imported ${imported} marks (${notFound} students not found, ${invalidScores} invalid scores)`, 'success');

                // Clear file input
                document.getElementById('import-file').value = '';
                document.getElementById('import-preview').style.display = 'none';
                window._importData = null;

            } catch (error) {
                showToast('Import failed: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        function downloadMarksImportTemplate() {
            const data = [
                { 'Student Code': 'STU001', 'Student Name': 'John Doe', 'Score': '' },
                { 'Student Code': 'STU002', 'Student Name': 'Jane Smith', 'Score': '' }
            ];
            exportToExcel(data, 'Marks_Import_Template');
            showToast('✅ Template downloaded', 'success');
        }

        async function downloadMarksTemplate() {
            const classId = document.getElementById('template-class')?.value;
            const subjectId = document.getElementById('template-subject')?.value;
            const assessmentName = document.getElementById('template-name')?.value.trim() || 'Assessment';
            const maxMarks = document.getElementById('template-max')?.value || 50;

            if (!classId) {
                showToast('Please select a class', 'warning');
                return;
            }

            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const cls = getClassById(classId);

            if (students.length === 0) {
                showToast('No active students in this class', 'warning');
                return;
            }

            const data = students.map(s => ({
                'Student Code': s.student_code,
                'Student Name': `${s.first_name} ${s.last_name}`,
                'Score': '',
                'Max Marks': maxMarks,
                'Notes': ''
            }));

            const filename = `${cls?.name}_${assessmentName.replace(/\s/g, '_')}_Template`;
            exportToExcel(data, filename);
            showToast('✅ Template downloaded', 'success');
        }

        async function previewTemplateData() {
            const classId = document.getElementById('template-class')?.value;
            const previewDiv = document.getElementById('template-preview');

            if (!classId) {
                previewDiv.style.display = 'none';
                return;
            }

            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const cls = getClassById(classId);

            if (students.length === 0) {
                previewDiv.innerHTML = '<div class="alert alert-warning">No active students in this class</div>';
                previewDiv.style.display = 'block';
                return;
            }

            previewDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Preview:</strong> Template will include ${students.length} student(s) from ${cls?.name}
        </div>
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Student Code</th>
                        <th>Student Name</th>
                        <th>Score</th>
                        <th>Max Marks</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.slice(0, 5).map(s => `
                        <tr>
                            <td>${esc(s.student_code)}</span>
                            <td>${esc(s.first_name)} ${esc(s.last_name)}</span>
                            <td><input type="text" placeholder="Enter score" style="width:80px"></span>
                            <td>${maxMarks}</span>
                            <td><input type="text" placeholder="Optional" style="width:100px"></span>
                        </tr>
                    `).join('')}
                    ${students.length > 5 ? `<tr><td colspan="5" style="text-align:center">... and ${students.length - 5} more students</td></tr>` : ''}
                </tbody>
            </table>
        </div>
    `;
            previewDiv.style.display = 'block';
        }

        // ════════════════════════════════════════════════════════════════════════
        // SECTION EX-2 — REGISTER EXPORT MODULE
