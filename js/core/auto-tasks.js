// ============================================================
// AUTO TASKS - Scheduled tasks (fee resets, auto-archive, backups)
// ============================================================

import { state, updateState } from './state.js';
import { insert, update, getAll, removeWhere } from './supabase-client.js';
import { getStudentCreditBalance, updateStudentCredit, getFullStudentBalance } from './helpers.js';
import { showToast } from './helpers.js';
import { info, error as logError } from './logger.js';
import { refreshTable } from './data-loader.js';

// Fee reset watcher
export async function checkAndApplyFeeResets() {
    info('[FeeReset] Checking for fee resets...', null, 'auto-tasks');
    const today = new Date();
    const currentTerm = state.currentTerm;
    const currentYear = state.currentAcadYear;

    // Check monthly fees (1st of month)
    if (today.getDate() === 1) {
        await applyFeesByFrequency('monthly');
    }

    // Check termly fees (on term end date + 1)
    if (currentTerm && currentTerm.end_date) {
        const termEnd = new Date(currentTerm.end_date);
        const nextDay = new Date(termEnd);
        nextDay.setDate(termEnd.getDate() + 1);
        if (today.toDateString() === nextDay.toDateString()) {
            await applyFeesByFrequency('termly');
        }
    }

    // Check annual fees (on academic year end + 1)
    if (currentYear && currentYear.end_date) {
        const yearEnd = new Date(currentYear.end_date);
        const nextDay = new Date(yearEnd);
        nextDay.setDate(yearEnd.getDate() + 1);
        if (today.toDateString() === nextDay.toDateString()) {
            await applyFeesByFrequency('annual');
            await archivePreviousYearFees();
        }
    }
}

// Apply fees by frequency
async function applyFeesByFrequency(frequency) {
    const categories = (state.feeCategories || []).filter(c =>
        c.reset_frequency === frequency && c.is_active !== false
    );

    if (categories.length === 0) return;

    const activeStudents = state.students.filter(s => s.status === 'Active');
    const termId = state.currentTerm?.id;
    const yearId = state.currentAcadYear?.id;
    const dueDate = state.currentTerm?.end_date || new Date();

    let applied = 0;
    let credited = 0;
    let totalCreditUsed = 0;

    for (const category of categories) {
        for (const student of activeStudents) {
            let amount = category.amount || 0;
            const classAmount = state.feeAmounts?.find(fa =>
                fa.fee_category_id === category.id &&
                fa.class_id == student.class_id &&
                fa.academic_year_id === yearId
            );
            if (classAmount) amount = classAmount.amount;
            if (amount <= 0) continue;

            const existing = state.studentFees?.find(f =>
                f.student_id === student.id &&
                f.fee_category_id === category.id &&
                f.term_id === termId &&
                !f.is_waived &&
                !f.manually_deleted
            );
            if (existing) continue;

            // Check for credit balance
            const balance = getStudentCreditBalance(student.id);
            let amountToAdd = amount;
            let creditUsed = 0;
            let creditPaymentId = null;

            if (balance.available > 0) {
                creditUsed = Math.min(balance.available, amount);
                amountToAdd = amount - creditUsed;
                totalCreditUsed += creditUsed;

                const creditPayment = await window.recordCreditAsPayment?.(
                    student.id, creditUsed, null,
                    `Credit applied to ${category.name} (${frequency} reset)`
                );
                creditPaymentId = creditPayment?.id;

                await updateStudentCredit(student.id, balance.available - creditUsed);
                credited++;
            }

            if (amountToAdd > 0 || creditUsed > 0) {
                const feeResult = await insert('student_fees', {
                    student_id: student.id,
                    fee_category_id: category.id,
                    term_id: termId,
                    academic_year_id: yearId,
                    amount: amountToAdd,
                    paid_amount: creditUsed,
                    is_paid: amountToAdd === 0,
                    is_waived: false,
                    manually_deleted: false,
                    is_template_based: true,
                    due_date: dueDate,
                    created_at: new Date().toISOString()
                });

                if (creditPaymentId && feeResult?.id) {
                    try {
                        await insert('payment_allocations', {
                            payment_id: creditPaymentId,
                            student_fee_id: feeResult.id,
                            amount: creditUsed,
                            created_at: new Date().toISOString()
                        });
                    } catch (e) { }
                }
                applied++;
            }
        }
    }

    await refreshTable('payments');
    await refreshTable('student_fees');

    if (applied > 0 || credited > 0) {
        info(`[FeeReset] Applied ${applied} ${frequency} fees, ${credited} used credit (${totalCreditUsed} RWF)`, null, 'auto-tasks');
        if (totalCreditUsed > 0) {
            showToast(`💰 ${totalCreditUsed.toLocaleString()} RWF credit applied and recorded as payment`, 'info');
        }
    }
}

// Archive previous year fees
async function archivePreviousYearFees() {
    const currentYearId = state.currentAcadYear?.id;
    const oldFees = state.studentFees?.filter(f => f.academic_year_id !== currentYearId && !f.is_paid) || [];

    for (const fee of oldFees) {
        await update('student_fees', fee.id, { is_archived: true });
    }
    await refreshTable('student_fees');
    info(`[FeeReset] Archived ${oldFees.length} previous year fees`, null, 'auto-tasks');
}

// Start fee reset watcher
export function startFeeResetWatcher() {
    checkAndApplyFeeResets();
    setInterval(checkAndApplyFeeResets, 24 * 60 * 60 * 1000); // Check daily
}

// Auto-archive inactive students
export async function runAutoArchive() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const candidates = state.students.filter(s =>
        s.status === 'Inactive' && !s.is_deleted && new Date(s.updated_at || s.created_at) < oneYearAgo
    );
    let archived = 0;

    for (const s of candidates) {
        await update('students', s.id, { is_deleted: true, archived_at: new Date().toISOString() });
        try {
            await insert('student_archive', {
                original_student_id: s.id,
                student_code: s.student_code,
                first_name: s.first_name,
                last_name: s.last_name,
                class_name: state.classes?.find(c => c.id === s.class_id)?.name,
                archived_date: new Date().toISOString().split('T')[0],
                archived_reason: 'Auto-archived after 1 year of inactivity',
                original_data: JSON.stringify(s)
            });
        } catch (e) { }
        archived++;
    }

    if (archived > 0) {
        await refreshTable('students');
        showToast(`✅ Auto-archived ${archived} inactive students`, 'success');
    }
}

// Start auto-archive watcher
export function startAutoArchiveWatcher() {
    setInterval(() => {
        runAutoArchive();
    }, 24 * 60 * 60 * 1000); // Run daily
}

// Notification watcher
export function startNotificationWatcher() {
    setInterval(() => {
        if (window.updateNotificationBadge) {
            window.updateNotificationBadge();
        }
    }, 60000); // Update badge every minute
}
// ── Field Trip / One-Time Fee Archiver ─────────────────────
// Handles completed activity fees: paid → archive, unpaid → waive
export async function handleCompletedActivityFee(feeCategoryId, reason = 'Activity completed') {
    const currentTerm = state.currentTerm;
    if (!currentTerm) { showToast('No active term found', 'warning'); return; }

    const fees = state.studentFees.filter(f =>
        f.fee_category_id === feeCategoryId &&
        f.term_id === currentTerm.id &&
        !f.is_archived
    );

    let archived = 0, waived = 0, errors = 0;
    for (const fee of fees) {
        try {
            if ((fee.paid_amount || 0) > 0) {
                await update('student_fees', fee.id, {
                    is_archived: true,
                    notes: `Activity completed — ${reason} — ${new Date().toLocaleDateString()}`,
                    updated_at: new Date().toISOString()
                });
                archived++;
            } else {
                await update('student_fees', fee.id, {
                    is_waived: true,
                    waiver_reason: `Activity completed — ${reason}`,
                    updated_at: new Date().toISOString()
                });
                waived++;
            }
        } catch (e) { errors++; }
    }

    await refreshTable('student_fees');
    showToast(`✅ ${archived} fees archived, ${waived} waived${errors ? ', ' + errors + ' errors' : ''}`, 'success');
    return { archived, waived, errors };
}

// Auto-archive completed one-time activity fees at term end
export async function archiveCompletedActivities() {
    const currentTerm = state.currentTerm;
    if (!currentTerm?.end_date) return;
    if (new Date() < new Date(currentTerm.end_date)) return; // Term not ended yet

    const oneTimeCategories = (state.feeCategories || []).filter(c =>
        c.reset_frequency === 'one_time' && c.is_active !== false
    );

    for (const cat of oneTimeCategories) {
        await handleCompletedActivityFee(cat.id, `Term ended - ${currentTerm.name}`);
    }
}

// Expose to console for manual use (as described in pasted doc)
if (typeof window !== 'undefined') {
    window.handleCompletedFieldTrip = async function(feeCategoryNameOrId) {
        let cat;
        if (typeof feeCategoryNameOrId === 'number') {
            cat = state.feeCategories.find(c => c.id === feeCategoryNameOrId);
        } else {
            cat = state.feeCategories.find(c =>
                c.name.toLowerCase().includes((feeCategoryNameOrId || 'field').toLowerCase())
            );
        }
        if (!cat) { console.error('Fee category not found'); return; }
        console.log('🔄 Processing:', cat.name);
        return handleCompletedActivityFee(cat.id, 'Field trip completed');
    };
}
