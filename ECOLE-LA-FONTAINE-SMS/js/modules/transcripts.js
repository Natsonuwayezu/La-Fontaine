// js/modules/transcripts.js
// Source lines: 28546–29605 of original monolith
// ============================================================

        // Full academic transcripts with multi-year, GPA, PDF/Excel export
        // ════════════════════════════════════════════════════════════════════════

        function switchTranscriptTab(tabName, event) {
            const tabs = ['single', 'batch', 'comparison', 'settings'];
            for (const t of tabs) {
                const el = document.getElementById(`transcript-${t}-tab`);
                if (el) el.style.display = t === tabName ? 'block' : 'none';
            }
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event && event.target) event.target.classList.add('active');
        }

        function toggleTranscriptOptions() {
            const type = document.getElementById('transcript-type')?.value;
            const yearGroup = document.getElementById('transcript-year-group');
            const termGroup = document.getElementById('transcript-term-group');

            if (yearGroup) yearGroup.style.display = (type === 'year' || type === 'cumulative') ? 'block' : 'none';
            if (termGroup) termGroup.style.display = type === 'term' ? 'block' : 'none';
        }

        async function loadTranscriptData() {
            const studentId = document.getElementById('transcript-student')?.value;
            if (!studentId) return;

            const previewDiv = document.getElementById('transcript-preview');
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading student data...</p></div>';

            try {
                const student = getStudentById(studentId);
                const cls = getClassById(student.class_id);

                // Get all academic years
                const years = state.academicYears.sort((a, b) => a.id - b.id);

                // Get all marks for this student
                const allMarks = state.marks.filter(m => m.student_id == studentId);
                const allAssessments = state.assessments;

                // Build year-by-year performance data
                const yearData = [];
                for (const year of years) {
                    const terms = state.terms.filter(t => t.academic_year_id === year.id).sort((a, b) => a.term_number - b.term_number);
                    const yearAssessments = allAssessments.filter(a => a.term_id && terms.some(t => t.id === a.term_id));

                    let yearTotalScore = 0, yearTotalMax = 0;
                    const termData = [];

                    for (const term of terms) {
                        const termAssessments = yearAssessments.filter(a => a.term_id === term.id);
                        let termScore = 0, termMax = 0;

                        for (const assessment of termAssessments) {
                            const mark = allMarks.find(m => m.assessment_id === assessment.id);
                            if (mark) {
                                termScore += mark.score;
                                termMax += assessment.max_marks;
                            }
                        }

                        const termPercentage = termMax > 0 ? (termScore / termMax) * 100 : 0;
                        termData.push({
                            term: term,
                            score: termScore,
                            max: termMax,
                            percentage: termPercentage,
                            grade: getGrade(termPercentage)
                        });

                        yearTotalScore += termScore;
                        yearTotalMax += termMax;
                    }

                    const yearPercentage = yearTotalMax > 0 ? (yearTotalScore / yearTotalMax) * 100 : 0;
                    yearData.push({
                        year: year,
                        terms: termData,
                        totalScore: yearTotalScore,
                        totalMax: yearTotalMax,
                        percentage: yearPercentage,
                        grade: getGrade(yearPercentage)
                    });
                }

                // Calculate overall GPA
                const allScores = yearData.flatMap(y => y.terms.map(t => t.percentage)).filter(p => p > 0);
                const overallGPA = calculateGPA(allScores, localStorage.getItem('transcript_gpa_scale') || '4.0');

                // Calculate class rank for latest year
                let rank = '—';
                if (yearData.length > 0) {
                    const latestYear = yearData[yearData.length - 1];
                    rank = await calculateStudentRankForYear(studentId, student.class_id, latestYear.year.id);
                }

                // Store data for export
                window._currentTranscriptData = { student, cls, yearData, overallGPA, rank };

                // Show summary in preview
                previewDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>✅ Data loaded for ${esc(student.first_name)} ${esc(student.last_name)}</strong><br>
                ${yearData.length} academic years, ${yearData.reduce((sum, y) => sum + y.terms.length, 0)} terms recorded.
                Overall GPA: <strong>${overallGPA}</strong> | Latest Rank: <strong>${rank}</strong>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Academic Year</th>
                            <th>Term 1</th>
                            <th>Term 2</th>
                            <th>Term 3</th>
                            <th>Year Average</th>
                            <th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${yearData.map(y => `
                            <tr>
                                <td><strong>${esc(y.year.name)}</strong></td>
                                ${y.terms.map(t => `<td style="text-align:center"><span class="badge ${getGradeClass(t.percentage)}">${t.percentage.toFixed(1)}%</span></td>`).join('')}
                                ${y.terms.length < 3 ? `<td colspan="${3 - y.terms.length}" style="text-align:center">—</td>` : ''}
                                <td style="text-align:center; font-weight:700">${y.percentage.toFixed(1)}%</td>
                                <td style="text-align:center">${y.grade}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="btn-group" style="margin-top:12px">
                <button class="btn btn-primary" onclick="window.generateTranscript()">📄 Generate Full Transcript</button>
            </div>
        `;

            } catch (error) {
                previewDiv.innerHTML = `<div class="alert alert-danger">Error loading data: ${error.message}</div>`;
            }
        }

        function calculateGPA(percentages, scale) {
            if (percentages.length === 0) return '—';

            const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;

            if (scale === '4.0') {
                if (avgPercentage >= 90) return '4.0';
                if (avgPercentage >= 85) return '3.7';
                if (avgPercentage >= 80) return '3.3';
                if (avgPercentage >= 75) return '3.0';
                if (avgPercentage >= 70) return '2.7';
                if (avgPercentage >= 65) return '2.3';
                if (avgPercentage >= 60) return '2.0';
                if (avgPercentage >= 55) return '1.7';
                if (avgPercentage >= 50) return '1.0';
                return '0.0';
            } else if (scale === '5.0') {
                return (avgPercentage / 20).toFixed(1);
            }

            return avgPercentage.toFixed(1) + '%';
        }

        async function calculateStudentRankForYear(studentId, classId, yearId) {
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const yearTerms = state.terms.filter(t => t.academic_year_id == yearId);
            const yearAssessments = state.assessments.filter(a => yearTerms.some(t => t.id === a.term_id));

            const studentScores = [];
            for (const student of students) {
                let totalScore = 0, totalMax = 0;
                const studentMarks = state.marks.filter(m => m.student_id === student.id);

                for (const assessment of yearAssessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    if (mark) {
                        totalScore += mark.score;
                        totalMax += assessment.max_marks;
                    }
                }

                const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                studentScores.push({ id: student.id, percentage });
            }

            studentScores.sort((a, b) => b.percentage - a.percentage);
            const rank = studentScores.findIndex(s => s.id === studentId) + 1;
            const total = studentScores.length;

            let ordinal = rank;
            let suffix = 'th';
            if (ordinal === 1) suffix = 'st';
            else if (ordinal === 2) suffix = 'nd';
            else if (ordinal === 3) suffix = 'rd';
            return `${ordinal}${suffix} of ${total}`;
        }

        async function generateTranscript() {
            const data = window._currentTranscriptData;
            if (!data) {
                showToast('Please select a student first', 'warning');
                return;
            }

            const format = document.getElementById('transcript-format')?.value;
            const includeGPA = document.getElementById('include-gpa')?.checked;
            const includeRank = document.getElementById('include-rank')?.checked;
            const includeAttendance = document.getElementById('include-attendance-summary')?.checked;
            const includeComments = document.getElementById('include-teacher-comments')?.checked;
            const transcriptType = document.getElementById('transcript-type')?.value;
            const yearId = document.getElementById('transcript-year')?.value;
            const termId = document.getElementById('transcript-term')?.value;

            const modal = document.getElementById('transcript-progress-modal');
            modal.style.display = 'flex';

            try {
                let transcriptData = data;

                // Filter by type if needed
                if (transcriptType === 'year' && yearId) {
                    transcriptData = {
                        ...data,
                        yearData: data.yearData.filter(y => y.year.id == yearId)
                    };
                } else if (transcriptType === 'term' && termId) {
                    const term = state.terms.find(t => t.id == termId);
                    const year = state.academicYears.find(y => y.id === term?.academic_year_id);
                    transcriptData = {
                        ...data,
                        yearData: [{
                            year: year,
                            terms: data.yearData.find(y => y.year.id === year?.id)?.terms.filter(t => t.term.id == termId) || [],
                            totalScore: 0,
                            totalMax: 0,
                            percentage: 0,
                            grade: '—'
                        }]
                    };
                }

                if (format === 'pdf') {
                    await generateTranscriptPDF(transcriptData, { includeGPA, includeRank, includeAttendance, includeComments });
                } else if (format === 'excel') {
                    await generateTranscriptExcel(transcriptData);
                } else {
                    openTranscriptPrintView(transcriptData, { includeGPA, includeRank, includeAttendance, includeComments });
                }

                modal.style.display = 'none';
                showToast('✅ Transcript generated successfully', 'success');

            } catch (error) {
                modal.style.display = 'none';
                showToast('Error generating transcript: ' + error.message, 'error');
            }
        }

        async function generateTranscriptPDF(data, options) {
            if (typeof html2pdf === 'undefined') {
                showToast('PDF library not loaded. Using print view instead.', 'warning');
                openTranscriptPrintView(data, options);
                return;
            }

            const html = generateTranscriptHTML(data, options);
            const element = document.createElement('div');
            element.innerHTML = html;

            const settings = localStorage.getItem('transcript_include_letterhead') !== 'false';
            const orientation = data.yearData.length > 3 ? 'landscape' : 'portrait';

            html2pdf().set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `Transcript_${data.student.first_name}_${data.student.last_name}_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: orientation }
            }).from(element).save();
        }

        async function generateTranscriptExcel(data) {
            const exportData = [];

            for (const year of data.yearData) {
                for (const term of year.terms) {
                    exportData.push({
                        'Academic Year': year.year.name,
                        'Term': term.term.name,
                        'Term Score': term.score,
                        'Term Max': term.max,
                        'Term Percentage (%)': term.percentage.toFixed(1),
                        'Term Grade': term.grade,
                        'Year Average (%)': year.percentage.toFixed(1),
                        'Year Grade': year.grade
                    });
                }
            }

            // Add summary row
            exportData.push({
                'Academic Year': 'SUMMARY',
                'Term': `Overall GPA: ${data.overallGPA}`,
                'Term Score': '',
                'Term Max': '',
                'Term Percentage (%)': '',
                'Term Grade': '',
                'Year Average (%)': '',
                'Year Grade': `Rank: ${data.rank}`
            });

            exportToExcel(exportData, `Transcript_${data.student.first_name}_${data.student.last_name}`);
        }

        function generateTranscriptHTML(data, options) {
            const school = state.schoolSettings || {};
            const includeLetterhead = localStorage.getItem('transcript_include_letterhead') !== 'false';
            const signatureStyle = localStorage.getItem('transcript_signature_style') || 'printed';
            const logoHtml = getSchoolLogoHtml(school.school_logo);

            let termRows = '';
            for (const year of data.yearData) {
                for (const term of year.terms) {
                    termRows += `
                <tr>
                    <td><strong>${esc(year.year.name)}</strong></td>
                    <td>${esc(term.term.name)}</td>
                    <td style="text-align:right">${term.score.toFixed(1)}</td>
                    <td style="text-align:right">${term.max}</td>
                    <td style="text-align:center"><span class="badge ${getGradeClass(term.percentage)}">${term.percentage.toFixed(1)}%</span></td>
                    <td style="text-align:center">${term.grade}</td>
                </tr>
            `;
                }

                // Add year summary row
                termRows += `
            <tr style="background:var(--bg-tertiary); font-weight:700">
                <td colspan="2" style="text-align:right">YEAR TOTAL:</td>
                <td style="text-align:right">${year.totalScore.toFixed(1)}</td>
                <td style="text-align:right">${year.totalMax}</td>
                <td style="text-align:center">${year.percentage.toFixed(1)}%</td>
                <td style="text-align:center">${year.grade}</td>
            </tr>
        `;
            }

            const gpaSection = options.includeGPA ? `
        <div class="info-item">
            <strong>Overall GPA:</strong> ${data.overallGPA}
            <span style="margin-left:20px"><strong>Scale:</strong> ${localStorage.getItem('transcript_gpa_scale') || '4.0'}</span>
        </div>
    ` : '';

            const rankSection = options.includeRank ? `
        <div class="info-item">
            <strong>Class Rank (Latest Year):</strong> ${data.rank}
        </div>
    ` : '';

            const attendanceSection = options.includeAttendance ? `
        <div class="info-item">
            <strong>Attendance Summary:</strong> To be calculated from attendance records
        </div>
    ` : '';

            return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Academic Transcript - ${data.student.first_name} ${data.student.last_name}</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box}
                body{font-family:'Inter',Arial,sans-serif;padding:20px}
                .transcript{max-width:1100px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
                .header{${includeLetterhead ? `background:#1a3a5c;color:#fff;padding:24px 28px;display:flex;gap:18px;align-items:center` : 'padding:20px 28px;border-bottom:2px solid #1a3a5c'}}
                .header-text h1{font-size:20px;font-weight:800;margin-bottom:4px}
                .header-text p{font-size:12px;opacity:0.8}
                .student-info{display:grid;grid-template-columns:repeat(3,1fr);padding:16px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
                .info-item{margin:8px 0}
                .info-item strong{font-size:11px;text-transform:uppercase;color:#64748b;display:block}
                table{width:100%;border-collapse:collapse}
                th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left}
                th{background:#f1f5f9;font-weight:700;font-size:12px}
                .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
                .grade-Ap,.grade-A{background:#d1fae5;color:#065f46}
                .grade-B{background:#fef3c7;color:#92400e}
                .grade-C{background:#ffedd5;color:#9a3412}
                .grade-D,.grade-F{background:#fee2e2;color:#991b1b}
                .footer{text-align:center;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
                .signatures{display:flex;justify-content:space-between;margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0}
                @media print{body{padding:0}.transcript{box-shadow:none;margin:0}}
            </style>
        </head>
        <body>
            <div class="transcript">
                <div class="header">
                    ${includeLetterhead ? `<div class="logo">${logoHtml}</div>` : ''}
                    <div class="header-text">
                        <h1>${esc(school.school_name || 'ECOLE LA FONTAINE')}</h1>
                        <p>${esc(school.school_location || 'Rubavu, Rwanda')} | Tel: ${esc(school.school_phone || '')}</p>
                        <h2 style="margin-top:8px">ACADEMIC TRANSCRIPT</h2>
                    </div>
                </div>
                
                <div class="student-info">
                    <div class="info-item"><strong>Student Name</strong>${esc(data.student.first_name)} ${esc(data.student.last_name)}</div>
                    <div class="info-item"><strong>Student Code</strong>${esc(data.student.student_code || '—')}</div>
                    <div class="info-item"><strong>Class</strong>${esc(data.cls?.name || '—')}</div>
                    ${gpaSection}
                    ${rankSection}
                    ${attendanceSection}
                </div>
                
                <div class="table-wrapper" style="padding:0; margin:0">
                    <table>
                        <thead>
                            <tr>
                                <th>Academic Year</th>
                                <th>Term</th>
                                <th style="text-align:right">Score</th>
                                <th style="text-align:right">Max</th>
                                <th style="text-align:center">%</th>
                                <th style="text-align:center">Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${termRows}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    <div>This transcript is an official record of academic achievement.</div>
                    <div>Generated on ${new Date().toLocaleString()}</div>
                    ${signatureStyle === 'digital' ? `
                        <div class="signatures">
                            <div>_________________________<br>Class Teacher</div>
                            <div>_________________________<br>Head of School</div>
                        </div>
                    ` : `
                        <div style="margin-top:12px">Digitally generated - No signature required</div>
                    `}
                </div>
            </div>
        </body>
        </html>
    `;
        }

        function openTranscriptPrintView(data, options) {
            const html = generateTranscriptHTML(data, options);
            const win = window.open('', '_blank', 'width=900,height=700');
            win.document.write(html);
            win.document.close();
            win.print();
        }

        async function previewTranscript() {
            const data = window._currentTranscriptData;
            if (!data) {
                showToast('Please select a student first', 'warning');
                return;
            }

            const includeGPA = document.getElementById('include-gpa')?.checked;
            const includeRank = document.getElementById('include-rank')?.checked;
            const includeAttendance = document.getElementById('include-attendance-summary')?.checked;
            const includeComments = document.getElementById('include-teacher-comments')?.checked;

            openTranscriptPrintView(data, { includeGPA, includeRank, includeAttendance, includeComments });
        }

        function resetTranscriptForm() {
            document.getElementById('transcript-student').value = '';
            document.getElementById('transcript-type').value = 'full';
            document.getElementById('transcript-format').value = 'pdf';
            document.getElementById('include-gpa').checked = true;
            document.getElementById('include-rank').checked = true;
            document.getElementById('include-attendance-summary').checked = true;
            document.getElementById('include-teacher-comments').checked = false;
            document.getElementById('transcript-preview').style.display = 'none';
            toggleTranscriptOptions();
            showToast('Form reset', 'info', 1500);
        }

        async function loadBatchTranscriptStudents() {
            const classId = document.getElementById('batch-class')?.value;
            const container = document.getElementById('batch-students-list');

            if (!classId) {
                container.innerHTML = '<div class="alert alert-info">Select a class to load students</div>';
                return;
            }

            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading students...</p></div>';

            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active')
                .sort((a, b) => a.last_name.localeCompare(b.last_name));

            if (students.length === 0) {
                container.innerHTML = '<div class="alert alert-warning">No active students in this class</div>';
                return;
            }

            container.innerHTML = students.map(s => `
        <label style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid var(--border-light); cursor:pointer">
            <input type="checkbox" class="batch-student-cb" data-id="${s.id}" data-name="${esc(s.first_name)} ${esc(s.last_name)}">
            <div style="flex:1">
                <strong>${esc(s.first_name)} ${esc(s.last_name)}</strong>
                <div style="font-size:11px; color:var(--text-muted)">${esc(s.student_code || 'No code')}</div>
            </div>
        </label>
    `).join('');
        }

        function selectAllBatchStudents(select) {
            document.querySelectorAll('.batch-student-cb').forEach(cb => cb.checked = select);
        }

        async function generateBatchTranscripts() {
            const selectedCbs = document.querySelectorAll('.batch-student-cb:checked');
            if (selectedCbs.length === 0) {
                showToast('No students selected', 'warning');
                return;
            }

            const yearId = document.getElementById('batch-year')?.value;
            const format = document.getElementById('batch-format')?.value;
            const modal = document.getElementById('transcript-progress-modal');
            const modalBar = document.getElementById('transcript-modal-bar');
            const modalText = document.getElementById('transcript-modal-text');

            modal.style.display = 'flex';
            modalBar.style.width = '0%';

            const results = [];
            let completed = 0;

            for (const cb of selectedCbs) {
                const studentId = parseInt(cb.dataset.id);
                const studentName = cb.dataset.name;

                modalText.textContent = `Processing: ${studentName}`;
                modalBar.style.width = `${(completed / selectedCbs.length) * 100}%`;

                try {
                    // Load transcript data for this student
                    const student = getStudentById(studentId);
                    const cls = getClassById(student.class_id);
                    const yearTerms = state.terms.filter(t => t.academic_year_id == yearId);
                    const yearAssessments = state.assessments.filter(a => yearTerms.some(t => t.id === a.term_id));
                    const allMarks = state.marks.filter(m => m.student_id == studentId);

                    let yearTotalScore = 0, yearTotalMax = 0;
                    const termData = [];

                    for (const term of yearTerms) {
                        const termAssessments = yearAssessments.filter(a => a.term_id === term.id);
                        let termScore = 0, termMax = 0;

                        for (const assessment of termAssessments) {
                            const mark = allMarks.find(m => m.assessment_id === assessment.id);
                            if (mark) {
                                termScore += mark.score;
                                termMax += assessment.max_marks;
                            }
                        }

                        const termPercentage = termMax > 0 ? (termScore / termMax) * 100 : 0;
                        termData.push({
                            term: term,
                            score: termScore,
                            max: termMax,
                            percentage: termPercentage,
                            grade: getGrade(termPercentage)
                        });

                        yearTotalScore += termScore;
                        yearTotalMax += termMax;
                    }

                    const yearPercentage = yearTotalMax > 0 ? (yearTotalScore / yearTotalMax) * 100 : 0;

                    results.push({
                        studentId,
                        studentName,
                        studentCode: student.student_code,
                        className: cls?.name,
                        termData,
                        yearPercentage,
                        yearGrade: getGrade(yearPercentage),
                        success: true
                    });

                } catch (error) {
                    results.push({
                        studentId,
                        studentName,
                        success: false,
                        error: error.message
                    });
                }

                completed++;
                modalBar.style.width = `${(completed / selectedCbs.length) * 100}%`;
            }

            modal.style.display = 'none';

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            if (successCount === 0) {
                showToast('Failed to generate any transcripts', 'error');
                return;
            }

            if (format === 'excel') {
                exportBatchTranscriptsExcel(results);
            } else if (format === 'combined') {
                await generateCombinedTranscriptsPDF(results);
            } else {
                await generateSeparateTranscriptsZIP(results);
            }

            showToast(`✅ Generated ${successCount} transcripts (${failCount} failed)`, successCount === selectedCbs.length ? 'success' : 'warning');
        }

        function exportBatchTranscriptsExcel(results) {
            const data = [];
            for (const result of results) {
                if (!result.success) continue;

                for (const term of result.termData) {
                    data.push({
                        'Student Name': result.studentName,
                        'Student Code': result.studentCode,
                        'Class': result.className,
                        'Term': term.term.name,
                        'Term Score': term.score,
                        'Term Max': term.max,
                        'Term Percentage (%)': term.percentage.toFixed(1),
                        'Term Grade': term.grade,
                        'Year Average (%)': result.yearPercentage.toFixed(1),
                        'Year Grade': result.yearGrade
                    });
                }
            }

            exportToExcel(data, `Batch_Transcripts_${new Date().toISOString().split('T')[0]}`);
        }

        async function generateCombinedTranscriptsPDF(results) {
            if (typeof html2pdf === 'undefined') {
                showToast('PDF library not loaded', 'warning');
                return;
            }

            let combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Combined Transcripts - ECOLE LA FONTAINE</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box}
                body{font-family:'Inter',Arial,sans-serif;padding:20px}
                .transcript{max-width:1000px;margin:20px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;page-break-after:always}
                .header{background:#1a3a5c;color:#fff;padding:20px 24px}
                .student-info{padding:16px 24px;background:#f8fafc}
                table{width:100%;border-collapse:collapse}
                th,td{border:1px solid #e2e8f0;padding:8px 10px}
                th{background:#f1f5f9}
                .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px}
                .grade-Ap,.grade-A{background:#d1fae5;color:#065f46}
                .grade-B{background:#fef3c7;color:#92400e}
                .grade-C{background:#ffedd5;color:#9a3412}
                .footer{text-align:center;padding:12px;font-size:10px}
            </style>
        </head>
        <body>
    `;

            for (const result of results) {
                if (!result.success) continue;

                combinedHtml += `
            <div class="transcript">
                <div class="header">
                    <h2>${esc(state.schoolSettings?.school_name || 'ECOLE LA FONTAINE')}</h2>
                    <p>ACADEMIC TRANSCRIPT</p>
                </div>
                <div class="student-info">
                    <strong>${esc(result.studentName)}</strong> (${esc(result.studentCode)}) - ${esc(result.className)}
                </div>
                <table>
                    <thead><tr><th>Term</th><th>Score</th><th>Max</th><th>%</th><th>Grade</th></tr></thead>
                    <tbody>
                        ${result.termData.map(t => `
                            <tr>
                                <td>${esc(t.term.name)}</span>
                                <td style="text-align:right">${t.score.toFixed(1)}</span>
                                <td style="text-align:right">${t.max}</span>
                                <td style="text-align:center">${t.percentage.toFixed(1)}%</span>
                                <td style="text-align:center">${t.grade}</span>
                            </tr>
                        `).join('')}
                        <tr style="font-weight:700; background:#f8fafc">
                            <td>YEAR TOTAL</td>
                            <td style="text-align:right">—</span>
                            <td style="text-align:right">—</span>
                            <td style="text-align:center">${result.yearPercentage.toFixed(1)}%</span>
                            <td style="text-align:center">${result.yearGrade}</span>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">Generated on ${new Date().toLocaleString()}</div>
            </div>
        `;
            }

            combinedHtml += `</body></html>`;

            const element = document.createElement('div');
            element.innerHTML = combinedHtml;

            html2pdf().set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `Combined_Transcripts_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
            }).from(element).save();
        }

        async function generateSeparateTranscriptsZIP(results) {
            if (typeof JSZip === 'undefined') {
                showToast('JSZip library not loaded. Use Excel or combined PDF option.', 'warning');
                return;
            }

            const zip = new JSZip();
            const folder = zip.folder(`Transcripts_${new Date().toISOString().split('T')[0]}`);

            for (const result of results) {
                if (!result.success) continue;

                const transcriptData = {
                    student: { first_name: result.studentName.split(' ')[0], last_name: result.studentName.split(' ').slice(1).join(' '), student_code: result.studentCode },
                    cls: { name: result.className },
                    yearData: [{ year: { name: document.getElementById('batch-year')?.options[document.getElementById('batch-year')?.selectedIndex]?.text }, terms: result.termData, totalScore: 0, totalMax: 0, percentage: result.yearPercentage, grade: result.yearGrade }],
                    overallGPA: calculateGPA(result.termData.map(t => t.percentage), '4.0'),
                    rank: '—'
                };

                const html = generateTranscriptHTML(transcriptData, { includeGPA: true, includeRank: false, includeAttendance: false, includeComments: false });
                folder.file(`${result.studentName.replace(/\s/g, '_')}.html`, html);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Transcripts_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function exportBatchTranscriptList() {
            const selectedCbs = document.querySelectorAll('.batch-student-cb:checked');
            if (selectedCbs.length === 0) {
                showToast('No students selected', 'warning');
                return;
            }

            const data = Array.from(selectedCbs).map(cb => ({
                'Student Name': cb.dataset.name,
                'Student ID': cb.dataset.id
            }));

            exportToExcel(data, `Batch_Student_List_${new Date().toISOString().split('T')[0]}`);
        }

        async function loadComparisonData() {
            // Trigger comparison generation when both students selected
            const student1 = document.getElementById('compare-student-1')?.value;
            const student2 = document.getElementById('compare-student-2')?.value;
            if (student1 && student2) {
                generateComparison();
            }
        }

        async function generateComparison() {
            const student1Id = document.getElementById('compare-student-1')?.value;
            const student2Id = document.getElementById('compare-student-2')?.value;
            const yearId = document.getElementById('compare-year')?.value;
            const container = document.getElementById('comparison-content');

            if (!student1Id || !student2Id) {
                showToast('Please select both students', 'warning');
                return;
            }

            container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading comparison data...</p></div>';
            container.style.display = 'block';

            const student1 = getStudentById(student1Id);
            const student2 = getStudentById(student2Id);
            const year = state.academicYears.find(y => y.id == yearId);
            const yearTerms = state.terms.filter(t => t.academic_year_id == yearId);
            const yearAssessments = state.assessments.filter(a => yearTerms.some(t => t.id === a.term_id));

            // Get subjects
            const cls1 = getClassById(student1.class_id);
            const cls2 = getClassById(student2.class_id);
            const subjects = state.subjects.filter(s => s.level === cls1?.level && s.is_active !== false);

            // Calculate subject-wise performance
            const student1Marks = state.marks.filter(m => m.student_id == student1Id);
            const student2Marks = state.marks.filter(m => m.student_id == student2Id);

            const subjectData = [];
            for (const subject of subjects) {
                const subjectAssessments = yearAssessments.filter(a => a.subject_id === subject.id);
                let s1Score = 0, s1Max = 0, s2Score = 0, s2Max = 0;

                for (const assessment of subjectAssessments) {
                    const s1Mark = student1Marks.find(m => m.assessment_id === assessment.id);
                    const s2Mark = student2Marks.find(m => m.assessment_id === assessment.id);

                    if (s1Mark) { s1Score += s1Mark.score; s1Max += assessment.max_marks; }
                    if (s2Mark) { s2Score += s2Mark.score; s2Max += assessment.max_marks; }
                }

                const s1Pct = s1Max > 0 ? (s1Score / s1Max) * 100 : 0;
                const s2Pct = s2Max > 0 ? (s2Score / s2Max) * 100 : 0;

                subjectData.push({
                    name: subject.name,
                    s1: { score: s1Score, max: s1Max, pct: s1Pct, grade: getGrade(s1Pct) },
                    s2: { score: s2Score, max: s2Max, pct: s2Pct, grade: getGrade(s2Pct) },
                    difference: s1Pct - s2Pct
                });
            }

            const s1Total = subjectData.reduce((sum, s) => sum + s.s1.score, 0);
            const s1TotalMax = subjectData.reduce((sum, s) => sum + s.s1.max, 0);
            const s2Total = subjectData.reduce((sum, s) => sum + s.s2.score, 0);
            const s2TotalMax = subjectData.reduce((sum, s) => sum + s.s2.max, 0);
            const s1Overall = s1TotalMax > 0 ? (s1Total / s1TotalMax) * 100 : 0;
            const s2Overall = s2TotalMax > 0 ? (s2Total / s2TotalMax) * 100 : 0;

            container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header">
                <span class="dash-card-title">📊 Student Performance Comparison</span>
                <span>${esc(year?.name)}</span>
            </div>
            <div class="dash-card-body">
                <div class="stats-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:20px">
                    <div class="stat-card" style="text-align:center">
                        <div class="stat-value">${s1Overall.toFixed(1)}%</div>
                        <div class="stat-label">${esc(student1.first_name)} ${esc(student1.last_name)}</div>
                    </div>
                    <div class="stat-card" style="text-align:center; background:var(--bg-tertiary)">
                        <div class="stat-value">${(s1Overall - s2Overall).toFixed(1)}%</div>
                        <div class="stat-label">Difference</div>
                    </div>
                    <div class="stat-card" style="text-align:center">
                        <div class="stat-value">${s2Overall.toFixed(1)}%</div>
                        <div class="stat-label">${esc(student2.first_name)} ${esc(student2.last_name)}</div>
                    </div>
                </div>
                
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th colspan="3" style="text-align:center">${esc(student1.first_name)}</th>
                                <th colspan="3" style="text-align:center">${esc(student2.first_name)}</th>
                                <th>Comparison</th>
                            </tr>
                            <tr>
                                <th></th>
                                <th>Score</th><th>Max</th><th>Grade</th>
                                <th>Score</th><th>Max</th><th>Grade</th>
                                <th>Diff</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${subjectData.map(s => `
                                <tr>
                                    <td><strong>${esc(s.name)}</strong></td>
                                    <td style="text-align:right">${s.s1.score.toFixed(1)}</span>
                                    <td style="text-align:right">${s.s1.max}</span>
                                    <td style="text-align:center">${s.s1.grade}</span>
                                    <td style="text-align:right">${s.s2.score.toFixed(1)}</span>
                                    <td style="text-align:right">${s.s2.max}</span>
                                    <td style="text-align:center">${s.s2.grade}</span>
                                    <td style="text-align:center">
                                        <span class="badge ${s.difference > 0 ? 'badge-success' : s.difference < 0 ? 'badge-danger' : 'badge-neutral'}">
                                            ${s.difference > 0 ? '+' : ''}${s.difference.toFixed(1)}%
                                        </span>
                                    </span>
                                </tr>
                            `).join('')}
                            <tr style="font-weight:700; background:var(--bg-tertiary)">
                                <td>TOTAL / AVERAGE</span>
                                <td style="text-align:right">${s1Total.toFixed(1)}</span>
                                <td style="text-align:right">${s1TotalMax}</span>
                                <td style="text-align:center">${getGrade(s1Overall)}</span>
                                <td style="text-align:right">${s2Total.toFixed(1)}</span>
                                <td style="text-align:right">${s2TotalMax}</span>
                                <td style="text-align:center">${getGrade(s2Overall)}</span>
                                <td style="text-align:center">
                                    <span class="badge ${s1Overall > s2Overall ? 'badge-success' : s1Overall < s2Overall ? 'badge-danger' : 'badge-neutral'}">
                                        ${s1Overall > s2Overall ? 'Leading' : s1Overall < s2Overall ? 'Trailing' : 'Tied'}
                                    </span>
                                </span>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="btn-group" style="margin-top:16px">
                    <button class="btn btn-outline" onclick="window.exportComparison()">📥 Export Comparison</button>
                </div>
            </div>
        </div>
    `;
        }

        function exportComparison() {
            const comparisonTable = document.querySelector('#comparison-content table');
            if (!comparisonTable) {
                showToast('No comparison data to export', 'warning');
                return;
            }

            const student1 = document.getElementById('compare-student-1')?.options[document.getElementById('compare-student-1')?.selectedIndex]?.text;
            const student2 = document.getElementById('compare-student-2')?.options[document.getElementById('compare-student-2')?.selectedIndex]?.text;

            const ws = XLSX.utils.table_to_sheet(comparisonTable);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Comparison_${student1}_vs_${student2}`);
            XLSX.writeFile(wb, `Student_Comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('✅ Comparison exported', 'success');
        }

        function saveTranscriptSettings() {
            const defaultFormat = document.getElementById('default-format')?.value;
            const gpaScale = document.getElementById('gpa-scale')?.value;
            const includeLetterhead = document.getElementById('include-letterhead')?.value;
            const signatureStyle = document.getElementById('signature-style')?.value;

            if (defaultFormat) localStorage.setItem('transcript_default_format', defaultFormat);
            if (gpaScale) localStorage.setItem('transcript_gpa_scale', gpaScale);
            if (includeLetterhead) localStorage.setItem('transcript_include_letterhead', includeLetterhead);
            if (signatureStyle) localStorage.setItem('transcript_signature_style', signatureStyle);

            // Apply to main form
            const formatSelect = document.getElementById('transcript-format');
            if (formatSelect && defaultFormat) formatSelect.value = defaultFormat;

            showToast('✅ Transcript settings saved', 'success');
        }

        function resetTranscriptSettings() {
            localStorage.removeItem('transcript_default_format');
            localStorage.removeItem('transcript_gpa_scale');
            localStorage.removeItem('transcript_include_letterhead');
            localStorage.removeItem('transcript_signature_style');

            document.getElementById('default-format').value = 'pdf';
            document.getElementById('gpa-scale').value = '4.0';
            document.getElementById('include-letterhead').value = 'true';
            document.getElementById('signature-style').value = 'printed';
            document.getElementById('transcript-format').value = 'pdf';

            showToast('✅ Settings reset to defaults', 'success');
        }

        function loadTranscriptSettings() {
            const defaultFormat = localStorage.getItem('transcript_default_format');
            const gpaScale = localStorage.getItem('transcript_gpa_scale');

            if (defaultFormat) document.getElementById('transcript-format').value = defaultFormat;
            if (gpaScale) console.log('GPA scale set to:', gpaScale);
        }

        function exportTranscriptsList() {
            const students = state.students.filter(s => s.status === 'Active');
            const data = students.map(s => ({
                'Student Name': `${s.first_name} ${s.last_name}`,
                'Student Code': s.student_code || '',
                'Class': getClassById(s.class_id)?.name || '',
                'Gender': s.gender || '',
                'Guardian': s.guardian_name || '',
                'Status': s.status
            }));

            exportToExcel(data, `Transcripts_Student_List_${new Date().toISOString().split('T')[0]}`);
            showToast('✅ Student list exported', 'success');
        }

        function printTranscriptGuide() {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Transcript Guide - ECOLE LA FONTAINE</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}
                h1{color:#1a3a5c;text-align:center}
                h2{color:#1a3a5c;margin-top:20px}
                .step{margin:15px 0;padding:10px;background:#f8fafc;border-radius:8px}
                .step-number{display:inline-block;width:30px;height:30px;background:#1a3a5c;color:#fff;border-radius:50%;text-align:center;line-height:30px;margin-right:10px}
                @media print{body{padding:0}}
            </style>
        </head>
        <body>
            <h1>📜 Academic Transcript Guide</h1>
            <p style="text-align:center">How to generate and use academic transcripts</p>
            
            <h2>📋 Single Transcript</h2>
            <div class="step"><span class="step-number">1</span> Select a student from the dropdown</div>
            <div class="step"><span class="step-number">2</span> Choose transcript type (Full/Year/Term)</div>
            <div class="step"><span class="step-number">3</span> Select output format (PDF/Excel/Print)</div>
            <div class="step"><span class="step-number">4</span> Click "Generate Transcript"</div>
            
            <h2>📚 Batch Transcripts</h2>
            <div class="step"><span class="step-number">1</span> Select a class</div>
            <div class="step"><span class="step-number">2</span> Choose academic year</div>
            <div class="step"><span class="step-number">3</span> Select students to include</div>
            <div class="step"><span class="step-number">4</span> Choose output format (ZIP/Combined PDF/Excel)</div>
            
            <h2>📊 Student Comparison</h2>
            <div class="step"><span class="step-number">1</span> Select two students</div>
            <div class="step"><span class="step-number">2</span> Choose academic year</div>
            <div class="step"><span class="step-number">3</span> View side-by-side comparison</div>
            
            <p style="margin-top:30px; text-align:center; font-size:11px; color:#666">
                ECOLE LA FONTAINE School Management System<br>
                Generated on ${new Date().toLocaleString()}
            </p>
            <script>window.print();setTimeout(window.close,500);<\/script>
        </body>
        </html>
    `);
            printWindow.document.close();
        }

        // ════════════════════════════════════════════════════════════════════════
        // SECTION EX-5 — RANKING ENGINE MODULE
