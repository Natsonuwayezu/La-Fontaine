// js/core/window-exposure.js
// Source lines: 23290–23657 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 99.1 — Expose functions to global scope
        // ──────────────────────────────────────────────────────────────────────


        // All functions used in HTML onclick="" handlers or called cross-module
        // must be exposed on window. This is the complete registry.

        // ── Core navigation ──
        window.navigateTo = navigateTo;

        // ════════════════════════════════════════════════════════════════════════
        // WINDOW EXPOSURE — ALL FUNCTIONS
        // Every function that may be called from HTML onclick= or cross-module
        // must be exposed on window. This replaces all previous partial exposures.
        // ════════════════════════════════════════════════════════════════════════

        // ── Navigation & Boot ──
        window.navigateTo = navigateTo;
        window.loadModule = loadModule;
        window.navigateToWithData = navigateToWithData;
        window.getNavData = getNavData;
        window.bootApp = bootApp;
        window.initApp = initApp;
        window.logout = logout;
        window.doLogin = doLogin;
        window.openLoginCard = openLoginCard;
        window.onRoleChange = onRoleChange;
        window.toggleLoginPw = toggleLoginPw;
        window.setupBiometricLogin = setupBiometricLogin;
        window.doBiometricLogin = doBiometricLogin;
        window.resetIdleTimer = resetIdleTimer;
        window.installPWA = installPWA;

        // ── UI Shell ──
        window.toggleSidebar = toggleSidebar;
        window.toggleUserDropdown = toggleUserDropdown;
        window.toggleTheme = toggleTheme;
        window.toggleNavSection = toggleNavSection;
        window.showProfileModal = showProfileModal;
        window.showChangePasswordModal = showChangePasswordModal;
        window.submitChangePassword = submitChangePassword;
        window.showNotificationsModal = showNotificationsModal;
        window.showApiDataSummary = showApiDataSummary;
        window.updateProgressBar = updateProgressBar;

        // ── Toast & Modal ──
        window.showToast = showToast;
        window.showModal = showModal;
        window.closeModal = closeModal;
        window.confirmDialog = confirmDialog;

        // ── Data & API ──
        window.state = state;
        window.insert = insert;
        window.update = update;
        window.updateWhere = updateWhere;
        window.remove = remove;
        window.removeWhere = removeWhere;
        window.getAll = getAll;
        window.getById = getById;
        window.getCount = getCount;
        window.logActivity = logActivity;
        window.updateSchoolSetting = updateSchoolSetting;
        window.getSchoolSettings = getSchoolSettings;
        window.getSchoolSetting = getSchoolSetting;
        window.refreshTable = refreshTable;
        window.ensureStateLoaded = ensureStateLoaded;
        window.loadInitialData = loadInitialData;
        window.invalidateCache = invalidateCache;

        // ── Lookups ──
        window.getClassById = getClassById;
        window.getSubjectById = getSubjectById;
        window.getTermById = getTermById;
        window.getStudentById = getStudentById;
        window.getTeacherById = getTeacherById;
        window.getFamilyById = getFamilyById;
        window.getCurrentUser = getCurrentUser;
        window.isAdmin = isAdmin;
        window.isTeacher = isTeacher;
        window.isAccountant = isAccountant;
        window.sortStudentsAlphabetically = sortStudentsAlphabetically;
        window.studentFullName = studentFullName;

        // ── Formatting ──
        window.fmt = fmt;
        window.fmtCurrency = fmtCurrency;
        window.fmtDate = fmtDate;
        window.fmtDateTime = fmtDateTime;
        window.fmtAgo = fmtAgo;
        window.fmtPct = fmtPct;
        window.formatDate = formatDate;
        window.formatNumber = formatNumber;
        window.esc = esc;
        window.downloadBlob = downloadBlob;
        window.exportToExcel = exportToExcel;
        window.exportArrayToExcel = exportArrayToExcel;
        window.buildPrintHeader = buildPrintHeader;
        window.applySchoolLogo = applySchoolLogo;
        window.createBarChart = createBarChart;
        window.createLineChart = createLineChart;
        window.isBreakSlot = isBreakSlot;
        window.getBreakIcon = getBreakIcon;

        // ── Academic Formulas ──
        window.calcMG = calcMG;
        window.calcEX = calcEX;
        window.calcSubjectPostMidterm = calcSubjectPostMidterm;
        window.calcSubjectAnnual = calcSubjectAnnual;
        window.calcPreMidtermPrimary = calcPreMidtermPrimary;
        window.calcPreMidtermNursery = calcPreMidtermNursery;
        window.getGrade = getGrade;
        window.getGradeClass = getGradeClass;
        window.rankStudents = rankStudents;
        window.calculateStudentRankFair = calculateStudentRankFair;
        window.calculateClassRankings = calculateClassRankings;
        window.calculateStudentTotals = calculateStudentTotals;
        window.termProgress = termProgress;
        window.getCurrentPhase = getCurrentPhase;
        window.calculateGPA = calculateGPA;
        window.getSchoolLogoHtml = getSchoolLogoHtml;

        // ── Fee Formulas ──
        window.studentFeeBalance = studentFeeBalance;
        window.getFullStudentBalance = getFullStudentBalance;
        window.getStudentCreditBalance = getStudentCreditBalance;
        window.calculateFinancialStats = calculateFinancialStats;

        // ── Offline ──
        window.syncOfflineMarks = syncOfflineMarks;
        window.saveMarksOffline = saveMarksOffline;
        window.updatePendingBadge = updatePendingBadge;

        // ── Shortcut navigation ──
        window.goToMarksEntry = id => navigateToWithData('marks-entry', { assessment_id: id });
        window.goToReportCard = id => navigateToWithData('report-cards', { report_student_id: id });
        window.goToClassRegister = id => navigateToWithData('class-register', { class_id: id });
        window.goToStudentFees = id => navigateToWithData('student-fees', { fee_student_id: id });

        // ── All render functions ──
        window.renderAcademicCalendar = renderAcademicCalendar;
        window.renderAcademicReports = renderAcademicReports;
        window.renderAcademicYears = renderAcademicYears;
        window.renderAccountantDashboard = renderAccountantDashboard;
        window.renderAdminDashboard = renderAdminDashboard;
        window.renderAnalytics = renderAnalytics;
        window.renderAnalyticsSettings = renderAnalyticsSettings;
        window.renderAnnouncements = renderAnnouncements;
        window.renderAnnualRegister = renderAnnualRegister;
        window.renderApiSettings = renderApiSettings;
        window.renderAssessmentExport = renderAssessmentExport;
        window.renderAssessmentLocking = renderAssessmentLocking;
        window.renderAssessments = renderAssessments;
        window.renderAttendanceAnalytics = renderAttendanceAnalytics;
        window.renderAttendanceEntry = renderAttendanceEntry;
        window.renderAttendanceReports = renderAttendanceReports;
        window.renderAttendanceSummary = renderAttendanceSummary;
        window.renderBackupRestore = renderBackupRestore;
        window.renderBalances = renderBalances;
        window.renderBulkExport = renderBulkExport;
        window.renderBulkFinanceActions = renderBulkFinanceActions;
        window.renderBulkImport = renderBulkImport;
        window.renderBulkStudentActions = renderBulkStudentActions;
        window.renderCarryForward = renderCarryForward;
        window.renderClassManagement = renderClassManagement;
        window.renderClassRegister = renderClassRegister;
        window.renderClassTimetable = renderClassTimetable;
        window.renderCreditBalances = renderCreditBalances;
        window.renderDiscounts = renderDiscounts;
        window.renderEnrollStudent = renderEnrollStudent;
        window.renderFamilyFeeSummary = renderFamilyFeeSummary;
        window.renderFamilyManagement = renderFamilyManagement;
        window.renderFeeAssignments = renderFeeAssignments;
        window.renderFeeStructure = renderFeeStructure;
        window.renderFeeStructures = renderFeeStructures;
        window.renderFeeTermStatus = renderFeeTermStatus;
        window.renderFeeWaivers = renderFeeWaivers;
        window.renderFinanceAudit = renderFinanceAudit;
        window.renderFinanceDashboard = renderFinanceDashboard;
        window.renderFinanceReports = renderFinanceReports;
        window.renderFinancialReports = renderFinancialReports;
        window.renderGradingScale = renderGradingScale;
        window.renderGradingSettings = renderGradingSettings;
        window.renderManualAdjustments = renderManualAdjustments;
        window.renderMarksAnalysis = renderMarksAnalysis;
        window.renderMarksDatabase = renderMarksDatabase;
        window.renderMarksEntry = renderMarksEntry;
        window.renderMarksImportExport = renderMarksImportExport;
        window.renderNotificationCenter = renderNotificationCenter;
        window.renderNotifications = renderNotifications;
        window.renderOverduePayments = renderOverduePayments;
        window.renderPaymentHistory = renderPaymentHistory;
        window.renderPaymentReversals = renderPaymentReversals;
        window.renderRankingEngine = renderRankingEngine;
        window.renderRankings = renderRankings;
        window.renderReceiptPrinting = renderReceiptPrinting;
        window.renderReceipts = renderReceipts;
        window.renderRecordPayment = renderRecordPayment;
        window.renderRegisterExport = renderRegisterExport;
        window.renderReminders = renderReminders;
        window.renderReportCards = renderReportCards;
        window.renderReportGenerator = renderReportGenerator;
        window.renderSchoolSettings = renderSchoolSettings;
        window.renderSettings = renderSettings;
        window.renderSiblingLinking = renderSiblingLinking;
        window.renderStaffTimetable = renderStaffTimetable;
        window.renderStatistics = renderStatistics;
        window.renderStudentArchive = renderStudentArchive;
        window.renderStudentDetails = renderStudentDetails;
        window.renderStudentFees = renderStudentFees;
        window.renderStudentList = renderStudentList;
        window.renderStudentPromotion = renderStudentPromotion;
        window.renderStudentStatements = renderStudentStatements;
        window.renderSubjects = renderSubjects;
        window.renderSystemHealth = renderSystemHealth;
        window.renderSystemLogs = renderSystemLogs;
        window.renderTeacherAssignments = renderTeacherAssignments;
        window.renderTeacherDashboard = renderTeacherDashboard;
        window.renderTeacherPerformance = renderTeacherPerformance;
        window.renderTeacherProfile = renderTeacherProfile;
        window.renderTeacherTimetable = renderTeacherTimetable;
        window.renderTeachersList = renderTeachersList;
        window.renderTimetable = renderTimetable;
        window.renderTimetableConflicts = renderTimetableConflicts;
        window.renderTimetableImport = renderTimetableImport;
        window.renderTranscripts = renderTranscripts;
        window.renderUserManagement = renderUserManagement;

        // ── Module helper functions ──
        window.switchMarksIETab = switchMarksIETab;
        window.toggleExportOptions = toggleExportOptions;
        window.loadExportAssessments = loadExportAssessments;
        window.loadExportStudents = loadExportStudents;
        window.executeMarksExport = executeMarksExport;
        window.exportMarksByAssessment = exportMarksByAssessment;
        window.exportClassMarksToExcel = exportClassMarksToExcel;
        window.exportStudentTranscript = exportStudentTranscript;
        window.printMarksReport = printMarksReport;
        window.previewMarksImport = previewMarksImport;
        window.executeMarksImport = executeMarksImport;
        window.downloadMarksImportTemplate = downloadMarksImportTemplate;
        window.downloadMarksTemplate = downloadMarksTemplate;
        window.previewTemplateData = previewTemplateData;
        window.switchRegisterTab = switchRegisterTab;
        window.loadRegisterSettings = loadRegisterSettings;
        window.saveRegisterSettings = saveRegisterSettings;
        window.resetRegisterSettings = resetRegisterSettings;
        window.previewRegister = previewRegister;
        window.generateRegisterData = generateRegisterData;
        window.exportRegisterNow = exportRegisterNow;
        window.exportRegisterToPDF = exportRegisterToPDF;
        window.generateRegisterHTML = generateRegisterHTML;
        window.addToExportHistory = addToExportHistory;
        window.refreshExportHistory = refreshExportHistory;
        window.clearExportHistory = clearExportHistory;
        window.repeatExport = repeatExport;
        window.switchReportTab = switchReportTab;
        window.loadBatchStudents = loadBatchStudents;
        window.toggleBatchOptions = toggleBatchOptions;
        window.selectAllStudents = selectAllStudents;
        window.resetBatchForm = resetBatchForm;
        window.addToBatchQueue = addToBatchQueue;
        window.getSelectedStudents = getSelectedStudents;
        window.startBatchGeneration = startBatchGeneration;
        window.generateSingleReport = generateSingleReport;
        window.downloadAsZip = downloadAsZip;
        window.downloadAsCombinedPDF = downloadAsCombinedPDF;
        window.generateReportHTML = generateReportHTML;
        window.openPrintView = openPrintView;
        window.previewBatch = previewBatch;
        window.refreshQueueDisplay = refreshQueueDisplay;
        window.processQueue = processQueue;
        window.processSingleJob = processSingleJob;
        window.removeJob = removeJob;
        window.clearQueue = clearQueue;
        window.showBatchQueue = showBatchQueue;
        window.loadTemplatePreview = loadTemplatePreview;
        window.applyTemplate = applyTemplate;
        window.uploadCustomTemplate = uploadCustomTemplate;
        window.loadReportSettings = loadReportSettings;
        window.saveReportSettings = saveReportSettings;
        window.resetReportSettings = resetReportSettings;
        window.cancelBatchGeneration = cancelBatchGeneration;
        window.exportBatchLog = exportBatchLog;
        window.logBatchGeneration = logBatchGeneration;
        window.switchTranscriptTab = switchTranscriptTab;
        window.toggleTranscriptOptions = toggleTranscriptOptions;
        window.loadTranscriptData = loadTranscriptData;
        window.calculateGPA = calculateGPA;
        window.calculateStudentRankForYear = calculateStudentRankForYear;
        window.generateTranscript = generateTranscript;
        window.generateTranscriptPDF = generateTranscriptPDF;
        window.generateTranscriptExcel = generateTranscriptExcel;
        window.generateTranscriptHTML = generateTranscriptHTML;
        window.openTranscriptPrintView = openTranscriptPrintView;
        window.previewTranscript = previewTranscript;
        window.resetTranscriptForm = resetTranscriptForm;
        window.loadBatchTranscriptStudents = loadBatchTranscriptStudents;
        window.selectAllBatchStudents = selectAllBatchStudents;
        window.generateBatchTranscripts = generateBatchTranscripts;
        window.exportBatchTranscriptsExcel = exportBatchTranscriptsExcel;
        window.generateCombinedTranscriptsPDF = generateCombinedTranscriptsPDF;
        window.generateSeparateTranscriptsZIP = generateSeparateTranscriptsZIP;
        window.exportBatchTranscriptList = exportBatchTranscriptList;
        window.loadComparisonData = loadComparisonData;
        window.generateComparison = generateComparison;
        window.exportComparison = exportComparison;
        window.saveTranscriptSettings = saveTranscriptSettings;
        window.resetTranscriptSettings = resetTranscriptSettings;
        window.loadTranscriptSettings = loadTranscriptSettings;
        window.exportTranscriptsList = exportTranscriptsList;
        window.printTranscriptGuide = printTranscriptGuide;
        window.switchRankingTab = switchRankingTab;
        window.loadTrendStudents = loadTrendStudents;
        window.calculateSubjectRankings = calculateSubjectRankings;
        window.calculateOverallRankings = calculateOverallRankings;
        window.generateHonorRoll = generateHonorRoll;
        window.loadPerformanceTrends = loadPerformanceTrends;
        window.saveRankingSettings = saveRankingSettings;
        window.resetRankingSettings = resetRankingSettings;
        window.loadRankingSettings = loadRankingSettings;
        window.exportRankingData = exportRankingData;
        window.printRankingReport = printRankingReport;
        window.copyRankingsTable = copyRankingsTable;
        window.printHonorRoll = printHonorRoll;
        window.exportOverallRankings = exportOverallRankings;
        window.compareClasses = compareClasses;
        window.exportClassComparison = exportClassComparison;
        window.generateTermSummary = generateTermSummary;
        window.generateSubjectAnalysis = generateSubjectAnalysis;
        window.generateStudentProgress = generateStudentProgress;
        window.generateClassComparisonReport = generateClassComparisonReport;
        window.generateTrendReport = generateTrendReport;
        window.exportAcademicReport = exportAcademicReport;
        window.printAcademicReport = printAcademicReport;
        window.switchFamilyTab = switchFamilyTab;
        window.filterFamilyList = filterFamilyList;
        window.filterUnlinkedStudents = filterUnlinkedStudents;
        window.toggleSelectAllUnlinked = toggleSelectAllUnlinked;
        window.bulkLinkSelected = bulkLinkSelected;
        window.showFamilySelectModal = showFamilySelectModal;
        window.autoDetectFamilies = autoDetectFamilies;
        window.createFamilyFromGroup = createFamilyFromGroup;
        window.openCreateFamilyModal = openCreateFamilyModal;
        window.saveFamily = saveFamily;
        window.editFamily = editFamily;
        window.deleteFamily = deleteFamily;
        window.viewFamilyDetails = viewFamilyDetails;
        window.addStudentToFamilyPrompt = addStudentToFamilyPrompt;
        window.addStudentToFamily = addStudentToFamily;
        window.removeStudentFromFamily = removeStudentFromFamily;
        window.mergeFamilies = mergeFamilies;
        window.executeMergeFamilies = executeMergeFamilies;
        window.applyFamilyDiscount = applyFamilyDiscount;
        window.exportFamiliesData = exportFamiliesData;
        window.printFamilyStatement = printFamilyStatement;
        window.exportFamilyDetails = exportFamilyDetails;
        window.splitFamily = splitFamily;
        window.executeSplitFamily = executeSplitFamily;


        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 100 — MISSING HELPER FUNCTIONS (restored from original scripts)
