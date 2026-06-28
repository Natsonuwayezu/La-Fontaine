// js/workers/analytics-worker.js
// Analytics Worker - Processes analytics in background thread

self.addEventListener('message', async function (e) {
    const { type, data, options, taskId } = e.data;

    try {
        let result;

        switch (type) {
            case 'calculate-class-stats':
                result = calculateClassStats(data);
                break;
            case 'calculate-teacher-stats':
                result = calculateTeacherStats(data);
                break;
            case 'calculate-financial-stats':
                result = calculateFinancialStats(data);
                break;
            case 'calculate-grade-distribution':
                result = calculateGradeDistribution(data);
                break;
            case 'calculate-trends':
                result = calculateTrends(data, options);
                break;
            case 'calculate-predictions':
                result = calculatePredictions(data, options);
                break;
            default:
                throw new Error(`Unknown analytics type: ${type}`);
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
            taskId: taskId
        });
    }
});

function calculateClassStats(data) {
    const { classes, students, assessments, marks } = data;

    const stats = classes.map(cls => {
        const classStudents = students.filter(s => s.class_id === cls.id && s.status === 'Active');
        const classAssessments = assessments.filter(a => a.class_id === cls.id);

        let totalPercentage = 0;
        let studentCount = 0;
        let highestScore = 0;
        let lowestScore = 100;
        let passCount = 0;
        let topStudent = '';

        for (const student of classStudents) {
            let totalScore = 0;
            let totalMax = 0;

            for (const assessment of classAssessments) {
                const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
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

        return {
            classId: cls.id,
            className: cls.name,
            studentCount: studentCount,
            averagePercentage: avgPercentage,
            highestScore: highestScore,
            lowestScore: lowestScore,
            passRate: studentCount > 0 ? (passCount / studentCount) * 100 : 0,
            topStudent: topStudent,
            grade: calculateGrade(avgPercentage)
        };
    });

    return stats;
}

function calculateTeacherStats(data) {
    const { teachers, assignments, classes, students, assessments, marks } = data;

    const stats = teachers.filter(t => t.role === 'teacher').map(teacher => {
        const teacherAssignments = assignments.filter(a => a.teacher_id === teacher.id);
        const classIds = [...new Set(teacherAssignments.map(a => a.class_id))];

        let totalPerformance = 0;
        let totalClasses = 0;
        let totalMarksEntered = 0;

        for (const classId of classIds) {
            const cls = classes.find(c => c.id === classId);
            const classStudents = students.filter(s => s.class_id === classId && s.status === 'Active');
            const classAssessments = assessments.filter(a => a.class_id === classId);

            let classTotalPct = 0;
            let studentCount = 0;

            for (const student of classStudents) {
                let totalScore = 0;
                let totalMax = 0;

                for (const assessment of classAssessments) {
                    const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                    if (mark) {
                        totalScore += mark.score;
                        totalMax += assessment.max_marks;
                        totalMarksEntered++;
                    }
                }

                if (totalMax > 0) {
                    classTotalPct += (totalScore / totalMax) * 100;
                    studentCount++;
                }
            }

            if (studentCount > 0) {
                totalPerformance += classTotalPct / studentCount;
                totalClasses++;
            }
        }

        const avgPerformance = totalClasses > 0 ? totalPerformance / totalClasses : 0;

        return {
            teacherId: teacher.id,
            teacherName: teacher.name,
            department: teacher.department || 'General',
            classCount: classIds.length,
            assignmentCount: teacherAssignments.length,
            avgPerformance: avgPerformance,
            marksEntered: totalMarksEntered,
            grade: calculateGrade(avgPerformance)
        };
    });

    return stats.sort((a, b) => b.avgPerformance - a.avgPerformance);
}

function calculateFinancialStats(data) {
    const { payments, studentFees, students } = data;

    const totalFees = studentFees.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = totalFees - totalPaid;
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    // Payment method breakdown
    const methodBreakdown = {};
    payments.forEach(p => {
        const method = p.payment_method || 'Other';
        methodBreakdown[method] = (methodBreakdown[method] || 0) + p.amount;
    });

    // Monthly collection trend
    const monthlyTrend = {};
    payments.forEach(p => {
        const month = (p.payment_date || p.created_at || '').slice(0, 7);
        if (month) {
            monthlyTrend[month] = (monthlyTrend[month] || 0) + p.amount;
        }
    });

    // Class-wise collection
    const classCollection = {};
    for (const student of students) {
        const className = student.class_name || 'Unknown';
        const studentFeesTotal = studentFees.filter(f => f.student_id === student.id).reduce((sum, f) => sum + f.amount, 0);
        const studentPaid = payments.filter(p => p.student_id === student.id).reduce((sum, p) => sum + p.amount, 0);

        if (!classCollection[className]) {
            classCollection[className] = { expected: 0, collected: 0 };
        }
        classCollection[className].expected += studentFeesTotal;
        classCollection[className].collected += studentPaid;
    }

    // Overdue statistics
    const today = new Date();
    const overdueFees = studentFees.filter(f =>
        !f.is_paid && !f.is_waived && f.due_date && new Date(f.due_date) < today
    );
    const overdueAmount = overdueFees.reduce((sum, f) => sum + (f.amount - (f.paid_amount || 0)), 0);

    return {
        totalFees: totalFees,
        totalPaid: totalPaid,
        outstanding: outstanding,
        collectionRate: collectionRate,
        methodBreakdown: methodBreakdown,
        monthlyTrend: monthlyTrend,
        classCollection: classCollection,
        overdueAmount: overdueAmount,
        overdueCount: overdueFees.length
    };
}

function calculateGradeDistribution(data) {
    const { students, assessments, marks } = data;

    const distribution = {
        'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0
    };

    for (const student of students) {
        let totalScore = 0;
        let totalMax = 0;
        const studentAssessments = assessments.filter(a => a.class_id === student.class_id);

        for (const assessment of studentAssessments) {
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark) {
                totalScore += mark.score;
                totalMax += assessment.max_marks;
            }
        }

        if (totalMax > 0) {
            const percentage = (totalScore / totalMax) * 100;
            const grade = calculateGrade(percentage);
            if (distribution.hasOwnProperty(grade)) {
                distribution[grade]++;
            }
        }
    }

    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const percentages = {};
    for (const [grade, count] of Object.entries(distribution)) {
        percentages[grade] = total > 0 ? (count / total) * 100 : 0;
    }

    return {
        counts: distribution,
        percentages: percentages,
        totalStudents: total
    };
}

function calculateTrends(data, options) {
    const { marks, assessments, students, periods = 3 } = options;

    // Group marks by term
    const marksByTerm = {};
    for (const mark of marks) {
        const assessment = assessments.find(a => a.id === mark.assessment_id);
        if (assessment && assessment.term_id) {
            if (!marksByTerm[assessment.term_id]) {
                marksByTerm[assessment.term_id] = [];
            }
            marksByTerm[assessment.term_id].push({
                student_id: mark.student_id,
                score: mark.score,
                max: assessment.max_marks
            });
        }
    }

    // Calculate average per term
    const termAverages = [];
    for (const [termId, termMarks] of Object.entries(marksByTerm)) {
        let totalPercentage = 0;
        let count = 0;

        for (const mark of termMarks) {
            totalPercentage += (mark.score / mark.max) * 100;
            count++;
        }

        termAverages.push({
            termId: parseInt(termId),
            average: count > 0 ? totalPercentage / count : 0
        });
    }

    termAverages.sort((a, b) => a.termId - b.termId);

    // Calculate trend line
    const trend = calculateLinearRegression(termAverages.map(t => t.average));

    // Predict next period
    const nextPrediction = trend.slope * termAverages.length + trend.intercept;

    return {
        historical: termAverages.slice(-periods),
        trend: trend,
        prediction: Math.max(0, Math.min(100, nextPrediction)),
        improvement: termAverages.length >= 2 ?
            termAverages[termAverages.length - 1].average - termAverages[termAverages.length - 2].average : 0
    };
}

function calculatePredictions(data, options) {
    const { historicalData, forecastPeriods = 3 } = options;

    if (!historicalData || historicalData.length < 2) {
        return { predictions: [], confidence: 0 };
    }

    // Simple linear regression for prediction
    const trend = calculateLinearRegression(historicalData);

    const predictions = [];
    const lastIndex = historicalData.length;

    for (let i = 1; i <= forecastPeriods; i++) {
        const prediction = trend.slope * (lastIndex + i - 1) + trend.intercept;
        predictions.push({
            period: lastIndex + i,
            value: Math.max(0, prediction),
            confidence: calculateConfidence(historicalData, trend)
        });
    }

    return {
        predictions: predictions,
        trend: trend,
        confidence: calculateConfidence(historicalData, trend)
    };
}

function calculateLinearRegression(values) {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }

    const denominator = (n * sumX2 - sumX * sumX);
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

function calculateConfidence(values, trend) {
    if (values.length < 2) return 0.5;

    // Calculate R-squared (coefficient of determination)
    const yMean = values.reduce((a, b) => a + b, 0) / values.length;
    let ssTotal = 0;
    let ssResidual = 0;

    for (let i = 0; i < values.length; i++) {
        const predicted = trend.slope * i + trend.intercept;
        ssTotal += Math.pow(values[i] - yMean, 2);
        ssResidual += Math.pow(values[i] - predicted, 2);
    }

    const rSquared = 1 - (ssResidual / ssTotal);
    return Math.max(0, Math.min(1, rSquared));
}

function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}