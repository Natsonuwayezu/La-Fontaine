// js/ui/router.js
// Source lines: 13581–13772 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 12.1 — navigateTo
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Show an access-denied message when navigateTo() blocks a role from
         * a module (e.g. teacher trying to open a finance module). Renders
         * the message into the content area AND shows a toast, so the user
         * gets clear feedback instead of a silent no-op or a console error.
         */
        function showAccessDenied(message) {
            const content = document.getElementById('dynamic-content');
            if (content) {
                content.innerHTML = `<div class="alert alert-danger">🚫 Access denied. ${esc(message || 'You do not have permission to view this module.')}</div>`;
            }
            showToast('🚫 ' + (message || 'Access denied.'), 'warning');
        }

        /**
         * Navigate to a module by ID: updates the URL hash, sidebar highlight,
         * page title, and calls loadModule() to render the content.
         */
        async function navigateTo(moduleId) {
            const role = getCurrentUser()?.role;

            if (role === 'teacher' && TEACHER_BLOCKED_MODULES.has(moduleId)) {
                showAccessDenied('Finance modules are not available for Teacher accounts.');
                return;
            }
            if (role === 'accountant' && ACCOUNTANT_BLOCKED_MODULES.has(moduleId)) {
                showAccessDenied('Academic modules are not available for Accountant accounts.');
                return;
            }

            setActiveNav(moduleId);
            const label = findNavLabel(moduleId, role);
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = label || moduleId;

            currentModuleId = moduleId;
            state.currentModule = moduleId;
            localStorage.setItem('elf_module', moduleId);

            closeSidebarMobile();

            await loadModule(moduleId);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 12.2 — loadModule (Central Registry)
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Map a module ID to its render function and call it.
         * Shows a loading spinner while rendering.
         * Shows an error message if the render function throws.
         * Shows a 'not found' message for unknown module IDs.
         */
        async function loadModule(id) {
            const el = document.getElementById('dynamic-content');
            el.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>`;
            try {
                const modules = {
                    'admin-dashboard': renderAdminDashboard, 'accountant-dashboard': renderAccountantDashboard, 'teacher-dashboard': renderTeacherDashboard,
                    'marks-entry': renderMarksEntry, 'marks-database': renderMarksDatabase, 'class-register': renderClassRegister,
                    'statistics': renderStatistics, 'timetable': renderTimetable, 'report-cards': renderReportCards,
                    'assessments': renderAssessments, 'student-list': renderStudentList, 'enroll-student': renderEnrollStudent,
                    'student-details': renderStudentDetails, 'student-fees': renderStudentFees, 'sibling-linking': renderSiblingLinking,
                    'student-archive': renderStudentArchive, 'bulk-import': renderBulkImport, 'bulk-export': renderBulkExport,
                    'fee-structure': renderFeeStructure, 'payment-history': renderPaymentHistory, 'record-payment': renderRecordPayment,
                    'financial-reports': renderFinancialReports, 'overdue-payments': renderOverduePayments, 'fee-waivers': renderFeeWaivers,
                    'receipts': renderReceipts, 'teachers-list': renderUserManagement, 'subjects': renderSubjects,
                    'teacher-assignments': renderTeacherAssignments, 'staff-timetable': renderStaffTimetable, 'teacher-performance': renderTeacherPerformance,
                    'school-settings': renderSchoolSettings, 'academic-calendar': renderAcademicCalendar, 'class-management': renderClassManagement,
                    'grading-scale': renderGradingScale, 'user-management': renderUserManagement, 'backup-restore': renderBackupRestore,
                    'system-logs': renderSystemLogs, 'analytics': renderAnalytics, 'api-settings': renderApiSettings,
                    'notifications': renderNotifications, 'announcements': renderAnnouncements, 'student-promotion': renderStudentPromotion,

                    // ── Extended Academic Modules ──
                    'marks-import-export': renderMarksImportExport,
                    'assessment-export': renderAssessmentExport,
                    'assessment-locking': renderAssessmentLocking,
                    'register-export': renderRegisterExport,
                    'report-generator': renderReportGenerator,
                    'transcript': renderTranscripts,
                    'transcripts': renderTranscripts,
                    'ranking-engine': renderRankingEngine,
                    'academic-reports': renderAcademicReports,

                    // ── Attendance (previously defined but never wired — sidebar links were dead) ──
                    'attendance': renderAttendanceEntry,
                    'attendance-reports': renderAttendanceReports,
                    'attendance-summary': renderAttendanceSummary,
                    'attendance-analytics': renderAttendanceAnalytics,

                    // ── Academic Registers & Rankings (previously defined but never wired) ──
                    'annual-register': renderAnnualRegister,
                    'rankings': renderRankings,
                    'marks-analysis': renderMarksAnalysis,

                    // ── Academic Settings (previously defined but never wired) ──
                    'academic-years': renderAcademicYears,
                    'grading-settings': renderGradingSettings,

                    // ── Finance Modules (previously defined but never wired) ──
                    'balances': renderBalances,
                    'bulk-finance-actions': renderBulkFinanceActions,
                    'carry-forward': renderCarryForward,
                    'credit-balances': renderCreditBalances,
                    'discounts': renderDiscounts,
                    'family-fee-summary': renderFamilyFeeSummary,
                    'fee-assignments': renderFeeAssignments,
                    'fee-structures': renderFeeStructures,
                    'fee-term-status': renderFeeTermStatus,
                    'finance-dashboard': renderFinanceDashboard,
                    'manual-adjustments': renderManualAdjustments,
                    'payment-reversals': renderPaymentReversals,
                    'receipt-printing': renderReceiptPrinting,
                    'student-statements': renderStudentStatements,

                    // ── Timetable sub-views (previously defined but never wired) ──
                    'class-timetable': renderClassTimetable,
                    'teacher-timetable': renderTeacherTimetable,
                    'timetable-conflicts': renderTimetableConflicts,
                    'timetable-import': renderTimetableImport,

                    // ── Notifications & System (previously defined but never wired) ──
                    'notification-center': renderNotificationCenter,
                    'reminders': renderReminders,
                    'settings': renderSettings,
                    'system-health': renderSystemHealth,
                    'analytics-settings': renderAnalyticsSettings,

                    // ── Family Management ──
                    'family-management': renderFamilyManagement,
                    'student-fee-status': renderStudentFeeStatus,
                    'finance-audit': renderFinanceAudit,
                };
                const fn = modules[id];
                if (fn) await fn(el);
                else el.innerHTML = `<div class="alert alert-warning">Module "<strong>${esc(id)}</strong>" is not yet implemented.</div>`;
            } catch (err) {
                console.error(`[Module ${id}]`, err);
                el.innerHTML = `<div class="alert alert-danger"><strong>Error loading module:</strong> ${esc(err.message)}</div>`;
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 12.3 — Navigation with Data Payload
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Navigate to a module and pass a data context to it.
         * The destination module calls getNavData(moduleId) to retrieve it.
         *
         * Example:
         *   navigateToWithData('student-fees', { fee_student_id: 42 });
         *   // inside renderStudentFees:
         *   const { fee_student_id } = getNavData('student-fees') || {};
         */
        const _navData = {};
        function navigateToWithData(page, data) {
            _navData[page] = data;
            navigateTo(page);
        }
        function getNavData(page) {
            const d = _navData[page];
            delete _navData[page];
            return d;
        }

        // Shortcut navigation helpers used throughout the app
        const goToMarksEntry = id => navigateToWithData('marks-entry', { assessment_id: id });
        const goToReportCard = id => navigateToWithData('report-cards', { report_student_id: id });
        const goToClassRegister = id => navigateToWithData('class-register', { class_id: id });
        const goToStudentFees = id => navigateToWithData('student-fees', { fee_student_id: id });



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 13 — BOOT SEQUENCE
