// js/patches/window-exposure-98.js
// Source lines: 36583–36677 of original monolith
// ============================================================

        // ════════════════════════════════════════════════════════════════════════

        window.openLoginCard = openLoginCard;
        window.onRoleChange = onRoleChange;
        window.toggleLoginPw = toggleLoginPw;
        window.doLogin = doLogin;
        window.setupBiometricLogin = setupBiometricLogin;
        window.doBiometricLogin = doBiometricLogin;
        window.logout = logout;
        window.toggleSidebar = toggleSidebar;
        window.saveMarks = saveMarks;
        window.clearMarksTable = clearMarksTable;
        window.refreshMarksData = refreshMarksData;
        window.exportAllMarksToExcel = exportAllMarksToExcel;
        window.exportMarksExcel = exportMarksExcel;
        window.importMarksExcel = importMarksExcel;
        window.previewMarksImport = previewMarksImport;
        window.executeMarksImport = executeMarksImport;
        window.loadMEStudentsTable = loadMEStudentsTable;
        window.loadMESubjectsAndStudents = loadMESubjectsAndStudents;
        window.loadMarksDatabase = loadMarksDatabase;
        window.loadDatabaseAssessments = loadDatabaseAssessments;
        window.loadDatabaseSubjects = loadDatabaseSubjects;
        window.updateMEMaxFromSubject = updateMEMaxFromSubject;
        window.showExistingAssessments = showExistingAssessments;
        window.addGradeLevel = addGradeLevel;
        window.removeGradeLevel = removeGradeLevel;
        window.moveGradeUp = moveGradeUp;
        window.moveGradeDown = moveGradeDown;
        window.refreshGradePreview = refreshGradePreview;
        window.saveGradingSettings = saveGradingSettings;
        window.resetToDefaultGrading = resetToDefaultGrading;
        window.exportGradingSettings = exportGradingSettings;
        window.saveApiSettings = saveApiSettings;
        window.resetApiSettings = resetApiSettings;
        window.testApiConnection = testApiConnection;
        window.toggleApiKeyVisibility = toggleApiKeyVisibility;
        window.filterUsersList = filterUsersList;
        window.openAddUserModal = openAddUserModal;
        window.exportUsersData = exportUsersData;
        window.refreshUserActivityLog = refreshUserActivityLog;
        window.showRemindersTab = showRemindersTab;
        window.openAddReminderModal = openAddReminderModal;
        window.exportReminders = exportReminders;
        window.showDiscountTab = showDiscountTab;
        window.openAddDiscountRuleModal = openAddDiscountRuleModal;
        window.exportDiscountsData = exportDiscountsData;
        window.applyBulkDiscountToClass = applyBulkDiscountToClass;
        window.applyFamilyDiscountToAll = applyFamilyDiscountToAll;
        window.applySiblingDiscount = applySiblingDiscount;
        window.previewBulkDiscount = previewBulkDiscount;
        window.editFamilyDiscount = editFamilyDiscount;
        window.openAddYearModal = openAddYearModal;
        window.editAcademicYear = editAcademicYear;
        window.deleteAcademicYear = deleteAcademicYear;
        window.cloneAcademicYear = cloneAcademicYear;
        window.setAcademicYearStatus = setAcademicYearStatus;
        window.viewYearTerms = viewYearTerms;
        window.exportAcademicYearsData = exportAcademicYearsData;
        window.createSystemNotification = createSystemNotification;
        window.clearAllNotificationsData = clearAllNotificationsData;
        window.exportNotificationsData = exportNotificationsData;
        window.markAllNotificationsRead = markAllNotificationsRead;
        window.filterNotificationsList = filterNotificationsList;
        window.runSystemHealthCheck = runSystemHealthCheck;
        window.exportHealthReport = exportHealthReport;
        window.showDatabaseSummary = showDatabaseSummary;
        window.renderCRTable = renderCRTable;
        window.exportCRToExcel = exportCRToExcel;
        window.createFamilyFromSiblings = createFamilyFromSiblings;
        window.generateStudentStatement = generateStudentStatement;
        window.printStudentStatement = printStudentStatement;
        window.exportStatementToExcel = exportStatementToExcel;
        window.printReceiptById = printReceiptById;
        window.exportAccountantDashboard = exportAccountantDashboard;
        window.exportCollectionByClass = exportCollectionByClass;
        window.exportClassPerf = exportClassPerf;
        window.downloadReceiptPDF = downloadReceiptPDF;
        window.initBackgroundService = initBackgroundService;
        window.notifyAction = notifyAction;
        window.showRoleNotification = showRoleNotification;
        window.autoWaiveExpiredFees = autoWaiveExpiredFees;
        window.carryOverWaiversToNewYear = carryOverWaiversToNewYear;
        window.applySpecificFeeWaiver = applySpecificFeeWaiver;
        window.processPaymentWithReceipt = processPaymentWithReceipt;
        window.renderFamilyTable = renderFamilyTable;
        window.renderSingleFamilyBlock = renderSingleFamilyBlock;
        window.saveBackupWithRotation = saveBackupWithRotation;
        window.doFullBackup = () => saveBackupWithRotation(false);
        window.doAutoBackup = () => saveBackupWithRotation(true);

        console.log('✅ ECOLE LA FONTAINE v9.0 — All modules implemented. Ready for deployment!');
    </script>
</body >

