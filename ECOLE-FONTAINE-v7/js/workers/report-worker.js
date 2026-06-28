// js/workers/report-worker.js
// Report Worker - Generates reports in background thread

self.addEventListener('message', async function (e) {
    const { type, data, options, taskId } = e.data;

    try {
        let result;

        switch (type) {
            case 'generate-report-card':
                result = await generateReportCard(data, options);
                break;
            case 'generate-class-report':
                result = await generateClassReport(data, options);
                break;
            case 'generate-financial-report':
                result = await generateFinancialReport(data, options);
                break;
            case 'generate-attendance-report':
                result = await generateAttendanceReport(data, options);
                break;
            case 'generate-transcript':
                result = await generateTranscript(data, options);
                break;
            default:
                throw new Error(`Unknown report type: ${type}`);
        }

        self.postMessage({
            success: true,
            result: result,
            taskId: taskId,
            type: type
        });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message,
            taskId: taskId,
            type: type
        });
    }
});

async function generateReportCard(data, options) {
    const { student, marks, subjects, term, schoolInfo } = data;

    // Calculate aggregates
    let totalScore = 0;
    let totalMax = 0;
    const subjectResults = subjects.map(subject => {
        const subjectMarks = marks.filter(m => m.subject_id === subject.id);
        const score = subjectMarks.reduce((sum, m) => sum + m.score, 0);
        const max = subjectMarks.reduce((sum, m) => sum + m.max_marks, 0);
        const percentage = max > 0 ? (score / max) * 100 : 0;
        totalScore += score;
        totalMax += max;

        return {
            name: subject.name,
            score: score,
            max: max,
            percentage: percentage,
            grade: calculateGrade(percentage)
        };
    });

    const overallPercentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const overallGrade = calculateGrade(overallPercentage);
    const rank = calculateRank(student.id, data.allStudents, marks);

    // Generate HTML report
    const html = generateReportCardHTML(student, subjectResults, overallPercentage, overallGrade, rank, term, schoolInfo);

    return {
        html: html,
        studentName: `${student.first_name} ${student.last_name}`,
        term: term.name,
        percentage: overallPercentage.toFixed(1),
        grade: overallGrade
    };
}

async function generateClassReport(data, options) {
    const { classInfo, students, assessments, marks } = data;

    const studentResults = students.map(student => {
        let totalScore = 0;
        let totalMax = 0;

        assessments.forEach(assessment => {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        });

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

        return {
            studentId: student.id,
            name: `${student.first_name} ${student.last_name}`,
            code: student.student_code,
            totalScore: totalScore,
            totalMax: totalMax,
            percentage: percentage,
            grade: calculateGrade(percentage)
        };
    });

    // Sort by percentage for ranking
    studentResults.sort((a, b) => b.percentage - a.percentage);
    studentResults.forEach((student, idx) => {
        student.rank = idx + 1;
    });

    const classAverage = studentResults.reduce((sum, s) => sum + s.percentage, 0) / (studentResults.length || 1);
    const passCount = studentResults.filter(s => s.percentage >= 50).length;
    const passRate = studentResults.length > 0 ? (passCount / studentResults.length) * 100 : 0;

    const html = generateClassReportHTML(classInfo, studentResults, classAverage, passRate);

    return {
        html: html,
        className: classInfo.name,
        studentCount: studentResults.length,
        classAverage: classAverage.toFixed(1),
        passRate: passRate.toFixed(1)
    };
}

async function generateFinancialReport(data, options) {
    const { payments, fees, students, startDate, endDate } = data;

    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = totalFees - totalPaid;
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    // Group by class
    const classData = {};
    students.forEach(student => {
        const className = student.class_name;
        if (!classData[className]) {
            classData[className] = { fees: 0, paid: 0 };
        }
        const studentFees = fees.filter(f => f.student_id === student.id);
        const studentPaid = payments.filter(p => p.student_id === student.id).reduce((sum, p) => sum + p.amount, 0);
        classData[className].fees += studentFees.reduce((sum, f) => sum + f.amount, 0);
        classData[className].paid += studentPaid;
    });

    const monthlyData = {};
    payments.forEach(p => {
        const month = p.date.slice(0, 7);
        if (!monthlyData[month]) monthlyData[month] = 0;
        monthlyData[month] += p.amount;
    });

    const html = generateFinancialReportHTML(totalFees, totalPaid, outstanding, collectionRate, classData, monthlyData, startDate, endDate);

    return {
        html: html,
        totalFees: totalFees,
        totalPaid: totalPaid,
        outstanding: outstanding,
        collectionRate: collectionRate.toFixed(1)
    };
}

async function generateAttendanceReport(data, options) {
    const { student, attendanceRecords, startDate, endDate } = data;

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    const lateDays = attendanceRecords.filter(a => a.status === 'late').length;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    const html = generateAttendanceReportHTML(student, attendanceRecords, presentDays, absentDays, lateDays, attendanceRate, startDate, endDate);

    return {
        html: html,
        studentName: `${student.first_name} ${student.last_name}`,
        presentDays: presentDays,
        absentDays: absentDays,
        attendanceRate: attendanceRate.toFixed(1)
    };
}

async function generateTranscript(data, options) {
    const { student, terms, subjects, marksByTerm } = data;

    const termResults = terms.map(term => {
        const termMarks = marksByTerm[term.id] || [];
        let totalScore = 0;
        let totalMax = 0;

        termMarks.forEach(mark => {
            totalScore += mark.score;
            totalMax += mark.max_marks;
        });

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

        return {
            term: term.name,
            percentage: percentage,
            grade: calculateGrade(percentage)
        };
    });

    const overallPercentage = termResults.reduce((sum, t) => sum + t.percentage, 0) / (termResults.length || 1);
    const overallGrade = calculateGrade(overallPercentage);

    const html = generateTranscriptHTML(student, termResults, overallPercentage, overallGrade);

    return {
        html: html,
        studentName: `${student.first_name} ${student.last_name}`,
        terms: termResults,
        overallPercentage: overallPercentage.toFixed(1),
        overallGrade: overallGrade
    };
}

function generateReportCardHTML(student, subjectResults, overallPercentage, overallGrade, rank, term, schoolInfo) {
    return `
        <div class="report-card">
            <div class="report-header">
                <div class="report-logo">🏫</div>
                <div class="report-header-text">
                    <h2>${escapeHtml(schoolInfo.name || 'ECOLE LA FONTAINE')}</h2>
                    <h3>END OF TERM REPORT CARD</h3>
                    <p>${escapeHtml(term.name)} - ${escapeHtml(term.year)}</p>
                </div>
            </div>
            <div class="report-info">
                <div><strong>Student:</strong> ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</div>
                <div><strong>Class:</strong> ${escapeHtml(student.class_name)}</div>
                <div><strong>Code:</strong> ${escapeHtml(student.student_code)}</div>
            </div>
            <table class="report-subjects">
                <thead><tr><th>Subject</th><th>Score</th><th>Max</th><th>%</th><th>Grade</th></tr></thead>
                <tbody>
                    ${subjectResults.map(s => `
                        <tr>
                            <td>${escapeHtml(s.name)}</td>
                            <td>${s.score}</td>
                            <td>${s.max}</td>
                            <td>${s.percentage.toFixed(1)}%</td>
                            <td>${s.grade}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="report-summary">
                <div>Total: ${overallPercentage.toFixed(1)}%</div>
                <div>Grade: ${overallGrade}</div>
                <div>Rank: ${rank}</div>
            </div>
        </div>
    `;
}

function generateClassReportHTML(classInfo, studentResults, classAverage, passRate) {
    return `
        <div class="class-report">
            <h2>Class Report - ${escapeHtml(classInfo.name)}</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <div class="summary">
                <div>Class Average: ${classAverage.toFixed(1)}%</div>
                <div>Pass Rate: ${passRate.toFixed(1)}%</div>
                <div>Total Students: ${studentResults.length}</div>
            </div>
            <table>
                <thead><tr><th>Rank</th><th>Student</th><th>Code</th><th>Percentage</th><th>Grade</th></tr></thead>
                <tbody>
                    ${studentResults.map(s => `
                        <tr>
                            <td>${s.rank}</td>
                            <td>${escapeHtml(s.name)}</td>
                            <td>${escapeHtml(s.code)}</td>
                            <td>${s.percentage.toFixed(1)}%</td>
                            <td>${s.grade}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateFinancialReportHTML(totalFees, totalPaid, outstanding, collectionRate, classData, monthlyData, startDate, endDate) {
    return `
        <div class="financial-report">
            <h2>Financial Report</h2>
            <p>Period: ${startDate} to ${endDate}</p>
            <div class="summary">
                <div>Total Fees: ${formatCurrency(totalFees)}</div>
                <div>Total Paid: ${formatCurrency(totalPaid)}</div>
                <div>Outstanding: ${formatCurrency(outstanding)}</div>
                <div>Collection Rate: ${collectionRate}%</div>
            </div>
            <h3>Collection by Class</h3>
            <table>
                <thead><tr><th>Class</th><th>Expected</th><th>Collected</th><th>Rate</th></tr></thead>
                <tbody>
                    ${Object.entries(classData).map(([className, data]) => `
                        <tr>
                            <td>${escapeHtml(className)}</td>
                            <td>${formatCurrency(data.fees)}</td>
                            <td>${formatCurrency(data.paid)}</td>
                            <td>${data.fees > 0 ? ((data.paid / data.fees) * 100).toFixed(1) : 0}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateAttendanceReportHTML(student, records, present, absent, late, rate, startDate, endDate) {
    return `
        <div class="attendance-report">
            <h2>Attendance Report</h2>
            <p>Student: ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</p>
            <p>Period: ${startDate} to ${endDate}</p>
            <div class="summary">
                <div>Present: ${present} days</div>
                <div>Absent: ${absent} days</div>
                <div>Late: ${late} days</div>
                <div>Attendance Rate: ${rate.toFixed(1)}%</div>
            </div>
            <table>
                <thead><tr><th>Date</th><th>Status</th><th>Time In</th><th>Note</th></tr></thead>
                <tbody>
                    ${records.map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.status}</td>
                            <td>${r.time_in || '—'}</td>
                            <td>${escapeHtml(r.note || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateTranscriptHTML(student, termResults, overallPercentage, overallGrade) {
    return `
        <div class="transcript">
            <h2>Academic Transcript</h2>
            <p>Student: ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</p>
            <p>Student Code: ${escapeHtml(student.student_code)}</p>
            <table>
                <thead><tr><th>Term</th><th>Average %</th><th>Grade</th></tr></thead>
                <tbody>
                    ${termResults.map(t => `
                        <tr>
                            <td>${escapeHtml(t.term)}</td>
                            <td>${t.percentage.toFixed(1)}%</td>
                            <td>${t.grade}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr><td><strong>Overall</strong></td><td><strong>${overallPercentage.toFixed(1)}%</strong></td><td><strong>${overallGrade}</strong></td></tr>
                </tfoot>
            </table>
        </div>
    `;
}

function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

function calculateRank(studentId, allStudents, marks) {
    const studentPercentages = [];

    for (const student of allStudents) {
        let totalScore = 0;
        let totalMax = 0;
        const studentMarks = marks.filter(m => m.student_id === student.id);

        for (const mark of studentMarks) {
            totalScore += mark.score;
            totalMax += mark.max_marks;
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        studentPercentages.push({ id: student.id, percentage: percentage });
    }

    studentPercentages.sort((a, b) => b.percentage - a.percentage);
    const rank = studentPercentages.findIndex(s => s.id === studentId) + 1;
    const total = studentPercentages.length;

    return `${rank} of ${total}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(amount || 0);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}