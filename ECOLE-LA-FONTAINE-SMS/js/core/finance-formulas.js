// js/core/finance-formulas.js
// Source lines: 11260–11431 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════


        /**
         * Compute the complete fee balance for one student.
         * Accounts for: active fees, waived fees, credit fees, and actual payments.
         * @returns {{ total, paid, balance, credit, pct, hasCredit, waivedTotal }}
         */
        function studentFeeBalance(studentId) {
            const allFees = (state.studentFees || []).filter(f => f.student_id == studentId);

            // Waived fees: excluded from total but tracked separately for display
            const waivedFees = allFees.filter(f => f.is_waived === true);
            const activeFees = allFees.filter(f => !f.is_waived && !f.is_credit);
            const creditFees = allFees.filter(f => f.is_credit === true);

            const total = activeFees.reduce((a, f) => a + (f.amount || 0), 0);
            const waivedTotal = waivedFees.reduce((a, f) => a + (f.amount || 0), 0);
            const creditBal = creditFees.reduce((a, f) => a + (f.paid_amount || f.credit_amount || 0), 0);

            const paidFromFees = activeFees.reduce((a, f) => a + (f.paid_amount || 0), 0);
            const payments = (state.payments || []).filter(p => p.student_id == studentId);
            const totalPmts = payments.reduce((a, p) => a + (p.amount || 0), 0);
            const effectivePaid = Math.max(paidFromFees, totalPmts);

            const rawBalance = total - effectivePaid;
            const balance = Math.max(0, rawBalance);
            const credit = Math.max(0, -rawBalance) + creditBal;
            const pct = total > 0 ? Math.min(100, Math.round((effectivePaid / total) * 100)) : (effectivePaid > 0 ? 100 : 0);

            return {
                total, paid: effectivePaid, balance, credit, pct,
                hasCredit: credit > 0, waivedTotal
            };
        }


        // Alias used by newer modules and external calls
        /**
         * Compute the full fee balance for a student.
         * Tries the Supabase VIEW student_balances first (accurate server-side calc),
         * then falls back to in-memory calculation from state.
         *
         * @param {number} studentId
         * @returns {Promise<{total,paid,balance,credit,hasCredit,pct,waivedTotal}>}
         */
        async function getFullStudentBalance(studentId) {
            // ── Try the DB view first (most accurate) ──────────────────────
            try {
                const result = await apiRequest(`student_balances?student_id=eq.${studentId}`, 'GET');
                if (result.success && result.data?.length > 0) {
                    const v = result.data[0];
                    const total  = v.total_fees  || 0;
                    const paid   = v.total_paid  || 0;
                    const balance = v.balance    || Math.max(0, total - paid);
                    const credit  = Math.max(0, paid - total);
                    return {
                        total, paid, balance, credit,
                        hasCredit: credit > 0,
                        pct:       total > 0 ? Math.min(100, (paid / total) * 100) : (paid > 0 ? 100 : 0),
                        waivedTotal: 0
                    };
                }
            } catch (e) {
                // View doesn't exist yet — fall through to manual calc
            }

            // ── Fallback: in-memory calculation ────────────────────────────
            const fees = (state.studentFees || []).filter(f =>
                f.student_id == studentId && !f.is_credit && !f.manually_deleted
            );

            // For waived fees only count the paid portion toward total
            const total = fees.reduce((a, f) => {
                return f.is_waived ? a + (f.paid_amount || 0) : a + (f.amount || 0);
            }, 0);

            const paid        = fees.reduce((a, f) => a + (f.paid_amount || 0), 0);
            const rawBalance  = total - paid;
            const balance     = Math.max(0, rawBalance);
            const credit      = Math.max(0, -rawBalance);
            const pct         = total > 0 ? Math.min(100, (paid / total) * 100) : (paid > 0 ? 100 : 0);
            const waivedTotal = fees.filter(f => f.is_waived).reduce((a, f) => a + (f.amount || 0), 0);

            return { total, paid, balance, credit, hasCredit: credit > 0, pct, waivedTotal };
        }


        /**
         * Return the credit balance for a student (overpayments/prepayments).
         * @returns {{ total, used, available }}
         */
        function getStudentCreditBalance(studentId) {
            const creditFees = state.studentFees.filter(f =>
                f.student_id == studentId &&
                f.is_credit === true
            );

            const totalCredit = creditFees.reduce((sum, f) => sum + (f.credit_amount || 0), 0);
            const usedCredit = creditFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
            const available = totalCredit - usedCredit;

            return { total: totalCredit, used: usedCredit, available: Math.max(0, available) };
        }


        /**
         * Aggregate financial statistics across all students or a class.
         * Used by dashboards and financial reports.
         */
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



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 7 — STATE ACCESSORS & DATA REFRESH
