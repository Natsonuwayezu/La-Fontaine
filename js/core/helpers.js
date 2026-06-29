// ============================================================
// HELPERS - Common helper functions used across modules
// ============================================================


// ============================================================
// EXPORTED UTILITIES (MUST BE AT THE TOP)
// ============================================================

function downloadBlob(content, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToExcel(data, filename) {
    if (!data?.length) {
        console.warn('No data to export');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Also add formatDate and formatDateTime if not present
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    return Number(amount).toLocaleString('en-RW') + ' RWF';
}

// String escaping
function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return '&#39;';
    });
}

// ============================================================
// CALCULATION HELPERS
// ============================================================

// Pre-Midterm Calculation for Primary (scaled to 100)
function calcPreMidtermPrimary(scores, maxes) {
    if (!scores?.length) return null;
    const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
    return avgMax > 0 ? (avgRaw / avgMax) * 100 : null;
}

// Pre-Midterm Calculation for Nursery (raw average out of 50)
function calcPreMidtermNursery(scores) {
    if (!scores?.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// MG Calculation (Continuous Assessment)
function calcMG(scores, maxes, mgMax) {
    if (!scores?.length) return null;
    const avgRaw = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgMax = maxes.reduce((a, b) => a + b, 0) / maxes.length;
    return avgMax > 0 ? (avgRaw / avgMax) * mgMax : null;
}

// EX Calculation (Exams)
function calcEX(scores, maxes, exMax) {
    return calcMG(scores, maxes, exMax);
}

// Subject Post-Midterm Calculation
function calcSubjectPostMidterm(sub, assessments, marks, studentId) {
    const mgMax = sub.mg_max || 50;
    const exMax = sub.ex_max || 50;

    const mgA = assessments.filter(a => a.subject_id === sub.id && !['Exam', 'Final Exam'].includes(a.assessment_type));
    const exA = assessments.filter(a => a.subject_id === sub.id && ['Exam', 'Final Exam'].includes(a.assessment_type));

    const mgS = mgA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);
    const exS = exA.map(a => marks.find(m => m.assessment_id === a.id && m.student_id === studentId)?.score).filter(v => v !== undefined);

    let mg = calcMG(mgS, mgA.map(a => a.max_marks), mgMax);
    let ex = calcEX(exS, exA.map(a => a.max_marks), exMax);

    // For Post-Midterm only subjects, copy EX to MG if MG is null
    if (sub.appears_only_post_midterm && mg === null && ex !== null) {
        mg = ex;
    }

    const tot = (mg !== null || ex !== null) ? (mg || 0) + (ex || 0) : null;
    return { mg, ex, tot, mgMax, exMax };
}

// ============================================================
// RANKING HELPERS
// ============================================================

// Rank students by percentage (tie-breaking by name)
function rankStudents(arr) {
    const sorted = [...arr].sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }
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

// Calculate student rank within class
async function calculateStudentRank(studentId, classId, termsToProcess = null, allAssessments = null, allMarks = null) {
    const students = state.students.filter(s => s.class_id === classId && s.status === 'Active');
    const studentScores = [];

    const assessments = allAssessments || state.assessments.filter(a => a.class_id === classId && a.term_id === state.currentTerm?.id);
    const marks = allMarks || state.marks;

    for (const student of students) {
        let totalScore = 0;
        let totalMax = 0;

        for (const assessment of assessments) {
            totalMax += assessment.max_marks;
            const mark = marks.find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark && mark.score !== null && mark.score !== undefined) {
                totalScore += mark.score;
            }
        }

        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        studentScores.push({
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            percentage: percentage
        });
    }

    const ranked = rankStudents(studentScores);
    const found = ranked.find(s => s.id == studentId);
    return found?.rankDisplay || '—';
}

// ============================================================
// STUDENT FEE BALANCE HELPERS
// ============================================================

// Get student credit balance
function getStudentCreditBalance(studentId) {
    const creditFees = (state.studentFees || []).filter(f =>
        f.student_id == studentId && f.is_credit === true
    );

    const totalCredit = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
    const usedCredit = creditFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
    const available = totalCredit - usedCredit;

    return { total: totalCredit, used: usedCredit, available: Math.max(0, available) };
}

// Get full student fee balance
function getFullStudentBalance(studentId) {
    const fees = (state.studentFees || []).filter(f =>
        f.student_id == studentId && !f.is_waived && !f.is_credit
    );

    const paidFromFees = fees.reduce((a, f) => a + (f.paid_amount || 0), 0);
    const payments = (state.payments || []).filter(p => p.student_id == studentId);
    const totalPaidFromPayments = payments.reduce((a, p) => a + p.amount, 0);
    const effectivePaid = Math.max(paidFromFees, totalPaidFromPayments);
    const total = fees.reduce((a, f) => a + f.amount, 0);
    const rawBalance = total - effectivePaid;
    const balance = Math.max(0, rawBalance);
    const credit = Math.max(0, -rawBalance);
    const pct = total > 0 ? Math.min(100, (effectivePaid / total) * 100) : (effectivePaid > 0 ? 100 : 0);

    const waivedTotal = (state.studentFees || []).filter(f =>
        f.student_id == studentId && f.is_waived === true
    ).reduce((a, f) => a + f.amount, 0);

    const creditUsed = payments.filter(p => p.is_credit_payment === true).reduce((a, p) => a + p.amount, 0);
    const cashPayments = payments.filter(p => !p.is_credit_payment && !p.is_credit_addition).reduce((a, p) => a + p.amount, 0);

    return { total, paid: effectivePaid, balance, credit, hasCredit: credit > 0, pct, waivedTotal, creditUsed, cashPayments };
}

// Student fee balance (simpler version)
function studentFeeBalance(studentId) {
    const fees = (state.studentFees || []).filter(f =>
        f.student_id == studentId && !f.is_waived && !f.is_credit
    );
    const paidFromFees = fees.reduce((a, f) => a + (f.paid_amount || 0), 0);
    const payments = (state.payments || []).filter(p => p.student_id == studentId);
    const totalPayments = payments.reduce((a, p) => a + p.amount, 0);
    const effectivePaid = Math.max(paidFromFees, totalPayments);
    const total = fees.reduce((a, f) => a + f.amount, 0);
    const rawBalance = total - effectivePaid;
    const balance = Math.max(0, rawBalance);
    const credit = Math.max(0, -rawBalance);
    const pct = total > 0 ? Math.min(100, (effectivePaid / total) * 100) : (effectivePaid > 0 ? 100 : 0);

    return { total, paid: effectivePaid, balance, credit, pct, hasCredit: credit > 0 };
}

// Update student credit balance
async function updateStudentCredit(studentId, newCreditAmount) {
    const creditFees = (state.studentFees || []).filter(f =>
        f.student_id == studentId && f.is_credit === true
    );

    if (creditFees.length === 0 && newCreditAmount > 0) {
        await window.insert('student_fees', {
            student_id: studentId,
            fee_category_id: null,
            term_id: state.currentTerm?.id,
            academic_year_id: state.currentAcadYear?.id,
            amount: 0,
            paid_amount: 0,
            is_paid: false,
            is_waived: false,
            is_credit: true,
            credit_amount: newCreditAmount,
            notes: 'Credit balance',
            created_at: new Date().toISOString()
        });
    } else if (creditFees.length > 0) {
        await window.update('student_fees', creditFees[0].id, {
            credit_amount: newCreditAmount,
            updated_at: new Date().toISOString()
        });
    }
}

// ============================================================
// APPLY FEES HELPERS
// ============================================================

// Apply selected fees to a new student
async function applySelectedFeesToNewStudent(studentId, classId, selectedCategoryIds) {
    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date().toISOString().split('T')[0];
    let appliedCount = 0;

    for (const categoryId of selectedCategoryIds) {
        const category = state.feeCategories.find(c => c.id === categoryId);
        if (!category) continue;

        let amount = category.amount || 0;
        const classAmount = state.feeAmounts.find(fa =>
            fa.fee_category_id === categoryId && fa.class_id == classId && fa.academic_year_id === yearId
        );
        if (classAmount) amount = classAmount.amount;
        if (amount <= 0) continue;

        const existing = state.studentFees.find(f =>
            f.student_id == studentId && f.fee_category_id === categoryId && f.term_id === termId &&
            !f.is_waived && !f.manually_deleted
        );
        if (existing) continue;

        await window.insert('student_fees', {
            student_id: studentId,
            fee_category_id: categoryId,
            term_id: termId,
            academic_year_id: yearId,
            amount,
            paid_amount: 0,
            is_paid: false,
            is_waived: false,
            manually_deleted: false,
            due_date: dueDate,
            created_at: new Date().toISOString()
        });
        appliedCount++;
    }
    return appliedCount;
}

// Apply all active fees to a new student
async function applyFeesToNewStudent(studentId, classId) {
    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date();
    const activeCategories = state.feeCategories.filter(c => c.is_active !== false);
    let appliedCount = 0;
    let creditUsed = 0;
    const studentCredit = getStudentCreditBalance(studentId);

    for (const category of activeCategories) {
        let amount = category.amount || 0;
        const classAmount = state.feeAmounts.find(fa =>
            fa.fee_category_id === category.id && fa.class_id == classId && fa.academic_year_id === yearId
        );
        if (classAmount) amount = classAmount.amount;
        if (amount <= 0) continue;

        const existingFee = state.studentFees.find(f =>
            f.student_id == studentId && f.fee_category_id === category.id && f.term_id === termId &&
            !f.is_waived && !f.manually_deleted
        );
        if (existingFee) continue;

        let amountToAdd = amount;
        let appliedCredit = 0;
        let creditPaymentId = null;

        if (studentCredit.available > 0 && amountToAdd > 0) {
            appliedCredit = Math.min(studentCredit.available, amountToAdd);
            amountToAdd = amountToAdd - appliedCredit;
            creditUsed += appliedCredit;

            const creditPayment = await window.recordCreditAsPayment?.(
                studentId, appliedCredit, null,
                `Credit applied to ${category.name} for new student enrollment`
            );
            creditPaymentId = creditPayment?.id;

            await updateStudentCredit(studentId, studentCredit.available - appliedCredit);
            studentCredit.available -= appliedCredit;
        }

        const feeResult = await window.insert('student_fees', {
            student_id: studentId,
            fee_category_id: category.id,
            term_id: termId,
            academic_year_id: yearId,
            amount: amountToAdd,
            paid_amount: appliedCredit,
            is_paid: amountToAdd === 0,
            is_waived: false,
            manually_deleted: false,
            is_template_based: true,
            due_date: dueDate,
            created_at: new Date().toISOString()
        });

        if (creditPaymentId && feeResult?.id) {
            try {
                await window.insert('payment_allocations', {
                    payment_id: creditPaymentId,
                    student_fee_id: feeResult.id,
                    amount: appliedCredit,
                    created_at: new Date().toISOString()
                });
            } catch (e) { }
        }
        appliedCount++;
    }

    await window.refreshTable?.('payments');
    await window.refreshTable?.('student_fees');
    return { appliedCount, creditUsed };
}

// ============================================================
// MARK ENTRY HELPERS
// ============================================================

// Update mark row and real-time calculations
function updateMERow(studentId, max) {
    const input = document.getElementById(`score-${studentId}`);
    if (!input) return;

    let val = parseFloat(input.value);
    if (isNaN(val) || input.value.trim() === '') {
        const pctEl = document.getElementById(`pct-${studentId}`);
        const statusEl = document.getElementById(`status-${studentId}`);
        if (pctEl) pctEl.textContent = '—';
        if (statusEl) statusEl.innerHTML = '<span style="color:#94a3b8">❌ Empty</span>';
        return;
    }

    const clamped = Math.min(max, Math.max(0, val));
    if (clamped !== val) input.value = clamped;

    const pct = (clamped / max) * 100;
    const pctEl = document.getElementById(`pct-${studentId}`);
    const statusEl = document.getElementById(`status-${studentId}`);

    if (pctEl) pctEl.textContent = `${pct.toFixed(1)}% ${getGrade(pct)}`;
    if (statusEl) {
        statusEl.innerHTML = pct < 50
            ? '<span style="color:#f59e0b">⚠️ Low</span>'
            : '<span style="color:#10b981">✅</span>';
    }
}

// Get mark background color based on percentage
function getMarkBg(pct) {
    if (pct === null || isNaN(pct)) return '';
    if (pct >= 80) return '#d1fae5';
    if (pct >= 60) return '#fef3c7';
    if (pct >= 50) return '#ffedd5';
    return '#fee2e2';
}

// Update marks summary
function updateMESummary(students, max) {
    if (!students?.length) return;

    const scores = [];
    students.forEach(s => {
        const input = document.getElementById(`score-${s.id}`);
        if (input) {
            const v = parseFloat(input.value);
            if (!isNaN(v)) scores.push(v);
        }
    });

    const total = students.length;
    const count = scores.length;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
    const avg = count ? (scores.reduce((a, b) => a + b, 0) / count / max * 100).toFixed(1) : '—';
    const passing = scores.filter(v => v / max * 100 >= 50).length;
    const passRate = count ? ((passing / count) * 100).toFixed(0) + '%' : '—';

    const summaryEl = document.getElementById('me-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `📊 <strong>${count}/${total}</strong> entered (${pct}%) | Avg: <strong>${avg}%</strong> | Pass Rate: <strong>${passRate}</strong>`;
    }
}

// ============================================================
// TOAST & ALERT HELPERS
// ============================================================

// Global toast notification

// Global modal system
function showModal(html) {
    const container = document.getElementById('modals-container');
    if (container) container.innerHTML = html;
}

function closeModal(id = null) {
    const el = id ? document.getElementById(id) : document.querySelector('.modal-overlay');
    if (el) el.remove();
}

// Confirm dialog (Promise-based)
function confirmDialog(msg) {
    return new Promise(resolve => {
        showModal(`
            <div class="modal-overlay">
                <div class="modal modal-sm">
                    <div class="modal-header">
                        <h3>⚠️ Confirm</h3>
                        <button class="modal-close" onclick="closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <p>${esc(msg)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal(); window._confirmResolve(false)">Cancel</button>
                        <button class="btn btn-danger" onclick="closeModal(); window._confirmResolve(true)">Confirm</button>
                    </div>
                </div>
            </div>
        `);
        window._confirmResolve = resolve;
    });
}

// ============================================================
// LOGGING HELPERS
// ============================================================

// Log activity to database
async function logActivity(userId, userRole, action, entityType = null, entityId = null, details = null) {
    try {
        const newLog = {
            user_id: userId,
            user_role: userRole,
            action: action,
            entity_type: entityType,
            entity_id: entityId,
            details: details,
            created_at: new Date().toISOString()
        };
        const result = await window.insert?.('activity_logs', newLog);
        if (result && state.activityLogs) {
            state.activityLogs.unshift({ id: result.id, ...newLog });
            if (state.activityLogs.length > 500) state.activityLogs.pop();
        }
    } catch (e) {
        console.warn('Activity log failed:', e);
    }
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

// Check if teacher has access to a specific class/subject

async function hasTeacherAccess(classId, subjectId = null) {
    const user = getCurrentUser();
    if (!user || user.role !== 'teacher') return true;

    const assignments = await window.getAll?.('teacher_assignments', { teacher_id: user.id }) || [];

    if (subjectId) {
        return assignments.some(a => a.class_id === classId && a.subject_id === subjectId);
    } else {
        return assignments.some(a => a.class_id === classId);
    }
}