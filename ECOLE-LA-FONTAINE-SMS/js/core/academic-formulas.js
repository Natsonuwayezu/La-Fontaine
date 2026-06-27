// js/core/academic-formulas.js
// Source lines: 10671–11259 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 5.1 — Grading Scale
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Look up the letter grade for a percentage score using the active grading scale.
         * @param {number} pct   - Percentage (0-100)
         * @param {Array}  scale - Optional custom scale; defaults to state.gradingScale
         */
        function getGrade(pct, scale = null) {
            if (pct === null || pct === undefined || isNaN(pct)) return '—';
            const gradingScale = scale || state.gradingScale || DEFAULT_GRADES;
            for (const g of gradingScale) {
                const minVal = g.min_percentage !== undefined ? g.min_percentage : g.min;
                const maxVal = g.max_percentage !== undefined ? g.max_percentage : g.max;
                if (pct >= minVal && pct <= maxVal) return g.grade;
            }
            return 'F';
        }


        /**
         * Return a CSS class name for the grade badge colour (e.g. 'grade-Ap', 'grade-B').
         */
        function getGradeClass(pct) {
            const g = getGrade(pct);
            if (g === 'A+') return 'grade-Ap';
            if (g === 'A') return 'grade-A';
            if (g === 'B') return 'grade-B';
            if (g === 'C') return 'grade-C';
            if (g === 'D') return 'grade-D';
            return 'grade-F';
        }


        /**
         * Alias of getGrade — used by some modules.
         */
        function calculateGrade(percentage) {
            if (percentage >= 90) return 'A+';
            if (percentage >= 80) return 'A';
            if (percentage >= 70) return 'B';
            if (percentage >= 60) return 'C';
            if (percentage >= 50) return 'D';
            return 'F';
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.2 — Continuous Assessment (MG) Calculation
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Scale a set of continuous-assessment scores into the MG component.
         * Formula: avg(scores) / avg(maxScores) × mgMax
         * @param {number[]} scores  - Raw scores from assessment marks
         * @param {number[]} maxes   - Max marks for each assessment
         * @param {number}   mgMax   - Target scale (e.g. 50)
         * @returns {number|null}    - Scaled MG score, or null if no scores
         */
        function calcMG(scores, maxes, mgMax) {
            if (!scores?.length) return null;
            const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
            const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
            return avgMax > 0 ? (avgRaw / avgMax) * mgMax : null;
        }


        /**
         * Scale exam scores into the EX component.
         * Uses the same formula as calcMG (separate function for code clarity).
         */
        function calcEX(scores, maxes, exMax) {
            return calcMG(scores, maxes, exMax);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.3 — Pre-Midterm Averages
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Pre-midterm average for Primary classes.
         * Returns percentage: avg(scores)/avg(maxes) × 100
         */
        function calcPreMidtermPrimary(scores, maxes) {
            if (!scores?.length) return null;
            const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
            const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
            return avgMax > 0 ? (avgRaw / avgMax) * 100 : null;
        }


        /**
         * Pre-midterm average for Nursery classes.
         * Returns raw average score (Nursery marks are absolute, not percentage).
         */
        function calcPreMidtermNursery(scores) {
            if (!scores?.length) return null;
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.4 — Post-Midterm Subject Calculation
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Full post-midterm calculation for one subject and one student.
         * Splits assessments into MG group and EX group, scales each to its max,
         * then combines into a total out of (mgMax + exMax).
         * @returns {{ mg, ex, tot, mgMax, exMax }}
         */
        function calcSubjectPostMidterm(sub, assessments, marks, studentId) {
            const mgMax = sub.mg_max || 50, exMax = sub.ex_max || 50;
            const mgA = assessments.filter(a => a.subject_id === sub.id && !['Exam', 'Final Exam'].includes(a.assessment_type));
            const exA = assessments.filter(a => a.subject_id === sub.id && ['Exam', 'Final Exam'].includes(a.assessment_type));
            const mgS = mgA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
            const exS = exA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
            let mg = calcMG(mgS, mgA.map(a => a.max_marks), mgMax);
            let ex = calcEX(exS, exA.map(a => a.max_marks), exMax);
            if (sub.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
            const tot = (mg !== null || ex !== null) ? (mg || 0) + (ex || 0) : null;
            return { mg, ex, tot, mgMax, exMax };
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.5 — Annual / Full-Year Calculation
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Calculate full-year subject result by averaging across terms.
         * Used for annual register and final transcripts.
         */
        function calcSubjectAnnual(sub, assessments, marks, studentId) {
            const mgMax = sub.mg_max || 50, exMax = sub.ex_max || 50;
            const mgA = assessments.filter(a => a.subject_id === sub.id && !['Exam', 'Final Exam'].includes(a.assessment_type));
            const exA = assessments.filter(a => a.subject_id === sub.id && ['Exam', 'Final Exam'].includes(a.assessment_type));
            const mgS = mgA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
            const exS = exA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
            let mg = calcMG(mgS, mgA.map(a => a.max_marks), mgMax);
            let ex = calcEX(exS, exA.map(a => a.max_marks), exMax);
            if (sub.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
            const tot = (mg !== null || ex !== null) ? (mg || 0) + (ex || 0) : null;
            return { mg, ex, tot, mgMax, exMax };
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.6 — Term & Phase Helpers
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Return 'pre_midterm' or 'post_midterm' based on today vs the midterm date.
         */
        function getCurrentPhase(term = null) {
            const currentTerm = term || window.state?.currentTerm;
            if (!currentTerm?.midterm_date) return 'post_midterm';
            return new Date() < new Date(currentTerm.midterm_date) ? 'pre_midterm' : 'post_midterm';
        }


        /**
         * Calculate how far through the current term we are.
         * @returns {{ pct, daysLeft, text }}
         */
        function termProgress(term = null) {
            const currentTerm = term || state.currentTerm;
            if (!currentTerm?.start_date || !currentTerm?.end_date) {
                return { pct: 0, daysLeft: 0, text: 'No term data' };
            }

            const start = new Date(currentTerm.start_date);
            const end = new Date(currentTerm.end_date);
            const now = new Date();

            if (now < start) {
                return { pct: 0, daysLeft: Math.ceil((end - start) / 86400000), text: 'Not started' };
            }
            if (now > end) {
                return { pct: 100, daysLeft: 0, text: 'Term ended' };
            }

            const pct = ((now - start) / (end - start)) * 100;
            const daysLeft = Math.ceil((end - now) / 86400000);
            return { pct: Math.round(pct), daysLeft, text: `${Math.round(pct)}% complete` };
        }



        // ──────────────────────────────────────────────────────────────────────
        // 5.7 — Ranking
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Sort students by percentage descending and assign ranks.
         * Tied students share the same rank (Olympic ranking).
         * Each student gets .rank (number) and .rankDisplay ('3 of 28').
         */
        function rankStudents(students) {
            const sorted = [...students].sort((a, b) => {
                if (b.percentage !== a.percentage) return b.percentage - a.percentage;
                return a.name.localeCompare(b.name);
            });

            let rank = 1;
            sorted.forEach((s, i) => {
                if (i > 0 && s.percentage === sorted[i - 1].percentage) {
                    s.rank = sorted[i - 1].rank;
                } else {
                    s.rank = rank;
                }
                rank = s.rank + 1;
                s.rankDisplay = `${s.rank} of ${sorted.length}`;
            });

            return sorted;
        }


        /**
         * Single-student rank from a pre-sorted class list.
         */
        async function calculateStudentRank(studentId, classId) {
            const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
            const studentPercentages = [];
            const currentTermId = state.currentTerm?.id;

            // Get assessments for this class and current term
            const allAssessments = state.assessments.filter(a => a.class_id === classId && a.term_id === currentTermId);

            // If no assessments, return default rank
            if (!allAssessments || allAssessments.length === 0) {
                return '—';
            }

            for (const student of students) {
                let totalScore = 0, totalMax = 0;

                for (const assessment of allAssessments) {
                    const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                    if (mark && mark.score !== null && mark.score !== undefined) {
                        totalScore += mark.score;
                        totalMax += assessment.max_marks;
                    }
                }
                const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                studentPercentages.push({ id: student.id, percentage });
            }

            studentPercentages.sort((a, b) => b.percentage - a.percentage);
            const rank = studentPercentages.findIndex(s => s.id === studentId) + 1;
            const total = studentPercentages.length;

            return total > 0 ? `${rank} of ${total}` : '—';
        }


        /**
         * Fair rank with tie-breaking by name.
         */
        async function calculateStudentRankFair(studentId, classId, termsToProcess, allAssessments, totalMaxPossible) {
            // Get all active students in the class
            const students = state.students.filter(s => s.class_id == classId && s.status === 'Active');
            const cls = state.classes.find(c => c.id == classId);
            const isNursery = cls?.level === 'Nursery';
            const phase = getCurrentPhase();

            // If no terms provided, use current term
            let terms = termsToProcess;
            if (!terms || terms.length === 0) {
                terms = [state.currentTerm];
            }

            // Get subjects for this level (ONLY those with assessments)
            const subjectIdsWithAssessments = [...new Set(allAssessments.map(a => a.subject_id))];
            const subjects = state.subjects.filter(s =>
                subjectIdsWithAssessments.includes(s.id) &&
                (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() &&
                s.is_active !== false
            );

            const studentScores = [];

            for (const student of students) {
                let totalScore = 0;
                const studentMarks = state.marks.filter(m => m.student_id === student.id);

                for (const subject of subjects) {
                    const mgMax = subject.mg_max || 50;
                    const exMax = subject.ex_max || 50;
                    const subAssessments = allAssessments.filter(a => a.subject_id === subject.id);

                    const quizAssessments = subAssessments.filter(a => !['Exam', 'Final Exam'].includes(a.assessment_type));
                    const examAssessments = subAssessments.filter(a => ['Exam', 'Final Exam'].includes(a.assessment_type));

                    let mgScore = null;
                    let exScore = null;

                    // Calculate MG
                    if (quizAssessments.length > 0) {
                        let totalRaw = 0;
                        let totalMaxRaw = 0;
                        let completedCount = 0;

                        for (const assessment of quizAssessments) {
                            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                            if (mark && mark.score !== null && mark.score !== undefined) {
                                totalRaw += mark.score;
                                totalMaxRaw += assessment.max_marks;
                                completedCount++;
                            }
                        }

                        if (completedCount > 0) {
                            const avgRaw = totalRaw / completedCount;
                            const avgMax = totalMaxRaw / completedCount;
                            if (phase === 'pre_midterm') {
                                mgScore = isNursery ? avgRaw : (avgMax > 0 ? (avgRaw / avgMax) * 100 : 0);
                            } else {
                                mgScore = avgMax > 0 ? (avgRaw / avgMax) * mgMax : 0;
                            }
                        }
                    }

                    // Calculate EX (only for post-midterm)
                    if (phase !== 'pre_midterm' && examAssessments.length > 0) {
                        let totalRaw = 0;
                        let totalMaxRaw = 0;
                        let completedCount = 0;

                        for (const assessment of examAssessments) {
                            const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                            if (mark && mark.score !== null && mark.score !== undefined) {
                                totalRaw += mark.score;
                                totalMaxRaw += assessment.max_marks;
                                completedCount++;
                            }
                        }

                        if (completedCount > 0) {
                            const avgRaw = totalRaw / completedCount;
                            const avgMax = totalMaxRaw / completedCount;
                            exScore = avgMax > 0 ? (avgRaw / avgMax) * exMax : 0;
                        }
                    }

                    // Handle post-midterm only subjects
                    if (phase !== 'pre_midterm' && subject.appears_only_post_midterm && mgScore === null && exScore !== null) {
                        mgScore = exScore;
                    }

                    // Calculate total for this subject
                    let subjectTotal = null;
                    if (phase === 'pre_midterm') {
                        subjectTotal = mgScore;
                    } else {
                        if (mgScore !== null || exScore !== null) {
                            subjectTotal = (mgScore || 0) + (exScore || 0);
                        }
                    }

                    if (subjectTotal !== null) {
                        totalScore += subjectTotal;
                    }
                }

                // ====================================================================
                // ALL students use the SAME denominator (totalMaxPossible)
                // ====================================================================
                const percentage = totalMaxPossible > 0 ? (totalScore / totalMaxPossible) * 100 : 0;
                studentScores.push({
                    id: student.id,
                    name: `${student.first_name} ${student.last_name}`,
                    percentage: percentage,
                    totalScore: totalScore
                });
            }

            // Sort by percentage (higher is better), then by name for ties
            studentScores.sort((a, b) => {
                if (b.percentage !== a.percentage) {
                    return b.percentage - a.percentage;
                }
                return a.name.localeCompare(b.name);
            });

            // Assign ranks with tie handling (1, 2, 2, 4 style)
            let rank = 1;
            let previousPercentage = null;
            let rankDisplay = '';
            const totalStudents = studentScores.length;

            for (let i = 0; i < studentScores.length; i++) {
                const current = studentScores[i];

                if (previousPercentage !== null && current.percentage !== previousPercentage) {
                    rank = i + 1;
                }

                if (current.id == studentId) {
                    if (isNursery) {
                        const rankSuffix = rank === 1 ? 'er' : 'e';
                        rankDisplay = `${rank}${rankSuffix} sur ${totalStudents}`;
                    } else {
                        let ordinal = rank;
                        let suffix = 'th';
                        if (ordinal === 1) suffix = 'st';
                        else if (ordinal === 2) suffix = 'nd';
                        else if (ordinal === 3) suffix = 'rd';
                        rankDisplay = `${ordinal}${suffix} of ${totalStudents}`;
                    }
                    break;
                }

                previousPercentage = current.percentage;
            }

            return rankDisplay || '—';
        }


        /**
         * Full rank object including percentile.
         */
        async function calculateStudentRankFull(studentId, classId, termId) {
            const classStudents = (state.students || []).filter(s => s.class_id == classId && s.status === 'Active');
            const cls = getClassById(classId);
            const subjects = (state.subjects || []).filter(s => (s.level || '').toLowerCase() === (cls?.level || '').toLowerCase() && s.is_active !== false);
            const allAssessments = (state.assessments || []).filter(a => a.class_id == classId && (termId ? a.term_id == termId : true));

            const scores = classStudents.map(student => {
                let totalScore = 0, totalMax = 0;
                const stMarks = (state.marks || []).filter(m => m.student_id === student.id);
                for (const sub of subjects) {
                    const mgMax = sub.mg_max || 50, exMax = sub.ex_max || 50;
                    const subA = allAssessments.filter(a => a.subject_id === sub.id);
                    const quizA = subA.filter(a => !['Exam', 'Final Exam'].includes(a.assessment_type));
                    const examA = subA.filter(a => ['Exam', 'Final Exam'].includes(a.assessment_type));
                    let mg = null, ex = null;
                    if (quizA.length) { const sc = quizA.map(a => stMarks.find(m => m.assessment_id === a.id)?.score).filter(v => v != null); if (sc.length) { const am = quizA.map(a => a.max_marks).reduce((a, b) => a + b, 0) / quizA.length; mg = am > 0 ? (sc.reduce((a, b) => a + b, 0) / sc.length / am) * mgMax : 0; } }
                    if (examA.length) { const sc = examA.map(a => stMarks.find(m => m.assessment_id === a.id)?.score).filter(v => v != null); if (sc.length) { const am = examA.map(a => a.max_marks).reduce((a, b) => a + b, 0) / examA.length; ex = am > 0 ? (sc.reduce((a, b) => a + b, 0) / sc.length / am) * exMax : 0; } }
                    if (sub.appears_only_post_midterm && mg === null && ex !== null) mg = ex;
                    const tot = (mg !== null || ex !== null) ? (mg || 0) + (ex || 0) : null;
                    if (tot !== null) { totalScore += tot; totalMax += mgMax + exMax; }
                }
                return { id: student.id, pct: totalMax > 0 ? (totalScore / totalMax) * 100 : 0 };
            });
            scores.sort((a, b) => b.pct - a.pct);
            const idx = scores.findIndex(x => x.id == studentId);
            return { rank: idx + 1, total: classStudents.length, pct: scores[idx]?.pct || 0, rankDisplay: idx >= 0 ? `${idx + 1} of ${classStudents.length}` : '—' };
        }


        /**
         * Rank all students in a class at once.
         */
        function calculateClassRanks(classId, termId, studentsList = null) {
            const students = studentsList || state.students.filter(s => s.class_id === classId && s.status === 'Active');
            const assessments = state.assessments.filter(a => a.class_id === classId && a.term_id === termId);

            const studentScores = [];
            for (const student of students) {
                let totalScore = 0, totalMax = 0;
                for (const assessment of assessments) {
                    const mark = state.marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
                    if (mark) {
                        totalScore += mark.score;
                        totalMax += assessment.max_marks;
                    }
                }
                const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                studentScores.push({
                    id: student.id,
                    name: `${student.first_name} ${student.last_name}`,
                    code: student.student_code,
                    totalScore: totalScore,
                    totalMax: totalMax,
                    percentage: percentage
                });
            }

            return rankStudents(studentScores);
        }


        /**
         * Compute total marks and percentage for one student.
         */
        function calculateStudentTotals(studentId) {
            const fees = (state.studentFees || []).filter(f =>
                f.student_id == studentId && !f.is_paid && !f.is_waived && !f.is_credit
            );
            let totalAmount = 0, totalPaid = 0, totalRemaining = 0;
            for (const fee of fees) {
                const paid = fee.paid_amount || 0;
                totalAmount += fee.amount;
                totalPaid += paid;
                totalRemaining += (fee.amount - paid);
            }
            const creditFees = (state.studentFees || []).filter(f => f.student_id == studentId && f.is_credit
                === true);
            const totalCredit = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
            return { fees, totalAmount, totalPaid, totalRemaining, totalCredit };
        }


        /**
         * Compute pass rate, average, highest, lowest for a class.
         */
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



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 6 — FEE & FINANCE CALCULATION FORMULAS
