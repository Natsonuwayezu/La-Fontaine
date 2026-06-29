// ============================================================
// ANALYTICS ENGINE - Statistics and analytics calculations
// ============================================================


// Calculate class performance for a specific term
function calculateClassPerformance(classId, termId) {
    const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
    const assessments = state.assessments.filter(a => a.class_id === classId && a.term_id === termId);

    let totalPercentage = 0;
    let studentCount = 0;
    let highestScore = 0;
    let lowestScore = 100;
    let passCount = 0;
    let topStudent = '';

    for (const student of students) {
        let totalScore = 0;
        let totalMax = 0;

        for (const assessment of assessments) {
            const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }

        if (totalMax > 0) {
            const percentage = (totalScore / totalMax) * 100;
            totalPercentage += percentage;
            studentCount++;

            if (percentage > highestScore) {
                highestScore = percentage;
                topStudent = `${student.first_name} ${student.last_name}`;
            }
            if (percentage < lowestScore) lowestScore = percentage;
            if (percentage >= 50) passCount++;
        }
    }

    const avgPercentage = studentCount > 0 ? totalPercentage / studentCount : 0;
    const passRate = studentCount > 0 ? (passCount / studentCount) * 100 : 0;

    return {
        className: getClassName(classId),
        students: students.length,
        average: avgPercentage,
        highest: highestScore,
        lowest: lowestScore,
        passRate: passRate,
        topStudent: topStudent,
        grade: getGrade(avgPercentage)
    };
}

// Calculate grade distribution for all students
function calculateGradeDistribution(classId = null, termId = null) {
    let students = state.students;
    if (classId) {
        students = students.filter(s => s.class_id === classId);
    }
    students = students.filter(s => s.status === 'Active');

    const gradeCount = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

    for (const student of students) {
        let totalScore = 0;
        let totalMax = 0;

        let assessments = state.assessments;
        if (termId) {
            assessments = assessments.filter(a => a.term_id === termId);
        }
        assessments = assessments.filter(a => a.class_id === student.class_id);

        for (const assessment of assessments) {
            const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
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
    const gradePercentages = {};
    for (const [grade, count] of Object.entries(gradeCount)) {
        gradePercentages[grade] = (count / total) * 100;
    }

    return { gradeCount, gradePercentages, total };
}

// Calculate subject performance across terms
function calculateSubjectPerformance(subjectId, classId = null) {
    let assessments = state.assessments.filter(a => a.subject_id === subjectId);
    if (classId) {
        assessments = assessments.filter(a => a.class_id === classId);
    }

    const terms = [...new Set(assessments.map(a => a.term_id))];
    const performance = {};

    for (const termId of terms) {
        const termAssessments = assessments.filter(a => a.term_id === termId);
        let totalPercentage = 0;
        let markCount = 0;

        for (const assessment of termAssessments) {
            const marks = state.marks.filter(m => m.assessment_id === assessment.id);
            for (const mark of marks) {
                totalPercentage += (mark.score / assessment.max_marks) * 100;
                markCount++;
            }
        }

        const term = state.terms.find(t => t.id === termId);
        performance[term?.name || `Term ${termId}`] = markCount > 0 ? totalPercentage / markCount : 0;
    }

    return {
        subjectName: getSubjectName(subjectId),
        performance: performance,
        trend: calculateTrend(Object.values(performance))
    };
}

// Calculate trend from values
function calculateTrend(values) {
    if (values.length < 2) return 'stable';
    const lastTwo = values.slice(-2);
    const difference = lastTwo[1] - lastTwo[0];
    if (difference > 2) return 'improving';
    if (difference < -2) return 'declining';
    return 'stable';
}

// Calculate teacher performance
function calculateTeacherPerformance(teacherId, termId = null) {
    const assignments = state.teacherAssignments?.filter(a => a.teacher_id === teacherId) || [];
    const classIds = [...new Set(assignments.map(a => a.class_id))];

    let totalAvg = 0;
    let classCount = 0;

    for (const classId of classIds) {
        const performance = calculateClassPerformance(classId, termId || state.currentTerm?.id);
        if (performance.average > 0) {
            totalAvg += performance.average;
            classCount++;
        }
    }

    return {
        teacherName: getTeacherName(teacherId),
        average: classCount > 0 ? totalAvg / classCount : 0,
        classes: classCount,
        trend: 'stable'
    };
}

// Calculate school-wide statistics
function calculateSchoolStats(termId = null) {
    const students = state.students.filter(s => s.status === 'Active');
    const classes = state.classes.filter(c => c.is_active !== false);

    let totalMarks = 0;
    let totalAssessments = 0;
    let totalPayments = 0;

    const assessments = termId
        ? state.assessments.filter(a => a.term_id === termId)
        : state.assessments;

    totalAssessments = assessments.length;
    totalMarks = state.marks.filter(m => assessments.some(a => a.id === m.assessment_id)).length;
    totalPayments = state.payments.reduce((sum, p) => sum + p.amount, 0);

    let totalPercentage = 0;
    let studentCount = 0;

    for (const student of students) {
        let score = 0, max = 0;
        for (const assessment of assessments) {
            const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                score += mark.score;
                max += assessment.max_marks;
            }
        }
        if (max > 0) {
            totalPercentage += (score / max) * 100;
            studentCount++;
        }
    }

    return {
        totalStudents: students.length,
        totalClasses: classes.length,
        totalAssessments,
        totalMarks,
        totalFeesCollected: totalPayments,
        schoolAverage: studentCount > 0 ? totalPercentage / studentCount : 0,
        overallPassRate: studentCount > 0 ? (totalPercentage / studentCount) >= 50 ? 'Good' : 'Needs Improvement' : 'N/A'
    };
}

// Helper functions
function getClassName(classId) {
    const cls = state.classes.find(c => c.id == classId);
    return cls?.name || 'Unknown';
}

function getSubjectName(subjectId) {
    const sub = state.subjects.find(s => s.id == subjectId);
    return sub?.name || 'Unknown';
}

function getTeacherName(teacherId) {
    const teacher = state.teachers.find(t => t.id == teacherId);
    return teacher?.name || 'Unknown';
}

// Export analytics data
function exportAnalyticsData(stats) {
    return {
        school: stats,
        classes: state.classes.map(c => calculateClassPerformance(c.id, state.currentTerm?.id)),
        subjects: state.subjects.map(s => calculateSubjectPerformance(s.id)),
        timestamp: new Date().toISOString()
    };
}