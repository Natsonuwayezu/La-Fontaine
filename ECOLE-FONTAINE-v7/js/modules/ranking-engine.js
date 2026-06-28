// ============================================================
// RANKING ENGINE - Core ranking and position calculations
// ============================================================

import { state } from '../core/state.js';
import { getStudentById, getClassById } from '../core/state.js';

// Calculate student ranks for a class
export function calculateClassRanks(classId, termId, studentsList = null) {
    const students = studentsList || (state.students || []).filter(s => s.class_id === classId && s.status === 'Active');
    const assessments = (state.assessments || []).filter(a => a.class_id === classId && a.term_id === termId);

    const studentScores = [];
    for (const student of students) {
        let totalScore = 0, totalMax = 0;
        for (const assessment of assessments) {
            const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === student.id);
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

// Rank students with tie-breaking
export function rankStudents(students) {
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

// Get student rank within class
export function getStudentRank(studentId, classId, termId) {
    const ranked = calculateClassRanks(classId, termId);
    const found = ranked.find(r => r.id === studentId);
    return found?.rankDisplay || '—';
}

// Get position as percentile
export function getPercentileRank(studentId, classId, termId) {
    const ranked = calculateClassRanks(classId, termId);
    const index = ranked.findIndex(r => r.id === studentId);
    if (index === -1) return null;
    return ((ranked.length - index) / ranked.length) * 100;
}

// Compare two students' ranks
export function compareRanks(studentId1, studentId2, classId, termId) {
    const ranked = calculateClassRanks(classId, termId);
    const rank1 = ranked.findIndex(r => r.id === studentId1);
    const rank2 = ranked.findIndex(r => r.id === studentId2);
    if (rank1 === -1 || rank2 === -1) return null;
    if (rank1 < rank2) return `${getStudentById(studentId1)?.first_name} is ranked higher`;
    if (rank2 < rank1) return `${getStudentById(studentId2)?.first_name} is ranked higher`;
    return 'Both students have the same rank';
}

// Get top N students
export function getTopStudents(classId, termId, n = 10) {
    const ranked = calculateClassRanks(classId, termId);
    return ranked.slice(0, n);
}

// Get bottom N students
export function getBottomStudents(classId, termId, n = 5) {
    const ranked = calculateClassRanks(classId, termId);
    return ranked.slice(-n).reverse();
}

// Get students who need improvement (below 50%)
export function getStudentsNeedingImprovement(classId, termId) {
    const ranked = calculateClassRanks(classId, termId);
    return ranked.filter(s => s.percentage < 50);
}

// Calculate improvement between terms
export function calculateImprovement(studentId, termId1, termId2) {
    const ranks1 = calculateClassRanks(null, termId1);
    const ranks2 = calculateClassRanks(null, termId2);
    const rank1 = ranks1.find(r => r.id === studentId);
    const rank2 = ranks2.find(r => r.id === studentId);
    if (!rank1 || !rank2) return null;
    const improvement = rank2.percentage - rank1.percentage;
    return {
        previousPercentage: rank1.percentage,
        currentPercentage: rank2.percentage,
        improvement: improvement,
        improved: improvement > 0,
        message: improvement > 0 ? `Improved by ${improvement.toFixed(1)}%` : (improvement < 0 ? `Declined by ${Math.abs(improvement).toFixed(1)}%` : 'No change')
    };
}
// ── Page render entry point ─────────────────────────────────
export async function renderRankingEngine(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="dash-card">
            <div class="dash-card-header"><h2>🏆 Ranking Engine</h2></div>
            <div class="dash-card-body">
                <p class="text-muted">This module provides utility functions used by other modules. 
                Select a specific action from the relevant section.</p>
            </div>
        </div>
    `;
}
