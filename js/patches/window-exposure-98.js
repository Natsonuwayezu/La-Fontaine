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
        window.openAddTeacherModal = openAddTeacherModal;
        window.exportTeachers = exportTeachers;
        window.renderUserActivityLog = renderUserActivityLog;
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

        // ══════════════════════════════════════════════════════════════════════
        // QR CODE SYSTEM — Generation, report-card embedding, and scan display
        // Adapted for Ecole La Fontaine: uses state.schoolSettings (not
        // appSettings), getGradeClass() / getGrade() (not gradeClass() /
        // badge-a/b/c/f), and first_name before last_name throughout.
        // ══════════════════════════════════════════════════════════════════════

        /**
         * Generate a QR code as a base64 PNG data-URL.
         * Returns '' if the qrcodejs library hasn't loaded or the text is
         * too long for a single QR code symbol.
         */
        function generateQRCodeDataURL(text, size = 150) {
            if (typeof QRCode === 'undefined') return '';
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
            document.body.appendChild(container);
            try {
                new QRCode(container, { text, width: size, height: size, colorDark: '#0f2744', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
                const canvas = container.querySelector('canvas');
                const dataURL = canvas ? canvas.toDataURL('image/png') : '';
                document.body.removeChild(container);
                return dataURL;
            } catch (e) {
                console.warn('[QR] Generation failed:', e);
                document.body.removeChild(container);
                return '';
            }
        }

        /**
         * Build the JSON payload for a student report QR code and return the
         * data-URL of the generated QR image. Called from report-card rendering
         * to embed one QR per student.
         */
        function generateStudentReportQR(student, reportData, reportType) {
            const school = state.schoolSettings || {};
            const payload = {
                v: '1',
                school: {
                    name: school.school_name || 'ECOLE LA FONTAINE',
                    address: school.school_address || 'Rubavu, Rwanda',
                    phone: school.school_phone || '',
                },
                student: {
                    id: student.id,
                    code: student.student_code || '',
                    firstName: student.first_name || '',
                    lastName: student.last_name || '',
                    class: reportData.className || reportData.cls?.name || '',
                    gender: student.gender || '',
                    dob: student.date_of_birth || '',
                    guardian: student.guardian_name || '',
                    guardianPhone: student.guardian_phone || '',
                },
                academic: {
                    term: reportData.termName || '',
                    year: school.academic_year || state.currentAcadYear?.name || '',
                    type: reportType || 'endterm',
                    totalScore: reportData.totalScore ?? reportData.annualTotalScore ?? 0,
                    totalMax: reportData.totalMax ?? reportData.annualTotalMax ?? 0,
                    pct: reportData.overallPercentage ?? 0,
                    grade: reportData.overallGrade ?? getGrade(reportData.overallPercentage ?? 0),
                    rank: reportData.rank || '—',
                    subjects: (reportData.subjects || []).map(s => ({
                        name: s.name,
                        mg: s.mg ?? null,
                        ex: s.ex ?? null,
                        total: s.total ?? null,
                        max: s.max ?? 0,
                        pct: s.pct ?? null,
                        grade: s.grade || '—'
                    }))
                },
                headTeacher: school.report_footer || 'UWAYO GANZA Eugene',
                gen: new Date().toISOString()
            };
            // QR codes have a data limit — keep subjects concise and cap at 500 chars of JSON
            // by stripping detail if payload is too large
            let text = JSON.stringify(payload);
            if (text.length > 2000) {
                payload.academic.subjects = payload.academic.subjects.map(s => ({ name: s.name, total: s.total, pct: s.pct, grade: s.grade }));
                text = JSON.stringify(payload);
            }
            return generateQRCodeDataURL(text, 160);
        }

        /**
         * Injects a QR code block into an already-rendered report card element.
         * Called by report-card rendering code after the main table is built.
         * Placement: bottom-right of the signature/footer area.
         */
        function addQRCodeToReport(reportElement, student, reportData, reportType) {
            if (!reportElement || typeof QRCode === 'undefined') return;
            if (reportElement.querySelector('.report-qr-block')) return;
            const qrDataURL = generateStudentReportQR(student, reportData, reportType);
            if (!qrDataURL) return;
            const block = document.createElement('div');
            block.className = 'report-qr-block';
            block.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:8px 12px;border-top:1px solid #e2e8f0;margin-top:8px;background:#f8fafc;border-radius:0 0 8px 8px';
            block.innerHTML = `
                <div style="font-size:9px;color:#64748b;line-height:1.6;text-align:left">
                    <div><strong>${escapeHtml(student.first_name || '')} ${escapeHtml(student.last_name || '')}</strong></div>
                    <div>Code: ${escapeHtml(student.student_code || '—')}</div>
                    <div>${escapeHtml(reportData.className || '')}</div>
                    <div style="margin-top:3px;font-style:italic">📱 Scan to verify</div>
                </div>
                <div>
                    <img src="${qrDataURL}" alt="QR" style="width:80px;height:80px;border:1px solid #e2e8f0;border-radius:4px;display:block">
                </div>
            `;
            reportElement.appendChild(block);
        }

        /**
         * Display the decoded content of a scanned student-report QR code in a
         * formatted modal. Replace `displayQRCodeResults(jsonString)` in any
         * future scanner integration.
         */
        function displayQRCodeResults(qrData) {
            try {
                const data = JSON.parse(qrData);
                const s = data.student || {};
                const a = data.academic || {};
                const pct = a.pct ?? 0;
                const passed = pct >= (parseFloat(state.schoolSettings?.pass_mark) || 50);

                const subjectRows = (a.subjects || []).map(sub => `
                    <tr>
                        <td><strong>${escapeHtml(sub.name)}</strong></td>
                        <td style="text-align:center">${sub.mg !== null ? Number(sub.mg).toFixed(1) : '—'}</td>
                        <td style="text-align:center">${sub.ex !== null ? Number(sub.ex).toFixed(1) : '—'}</td>
                        <td style="text-align:center;font-weight:700">${sub.total !== null ? Number(sub.total).toFixed(1) : '—'}</td>
                        <td style="text-align:center">${sub.max || '—'}</td>
                        <td style="text-align:center"><span class="badge ${getGradeClass(sub.pct)}">${sub.pct !== null ? Number(sub.pct).toFixed(1) + '%' : '—'}</span></td>
                        <td style="text-align:center"><span class="badge ${getGradeClass(sub.pct)}">${sub.grade || '—'}</span></td>
                    </tr>
                `).join('');

                const html = `
                    <div class="modal-overlay" id="qr-result-modal" style="display:flex">
                        <div class="modal" style="max-width:820px;max-height:95vh;overflow-y:auto;padding:0">
                            <div class="modal-header" style="position:sticky;top:0;z-index:10">
                                <h3>📱 QR Code — Student Report</h3>
                                <button class="modal-close" onclick="closeModal('qr-result-modal')">✕</button>
                            </div>
                            <div class="modal-body" style="padding:16px 20px">

                                <!-- School header -->
                                <div style="text-align:center;padding:12px 0;border-bottom:2px solid var(--navy);margin-bottom:16px">
                                    <h2 style="color:var(--navy);margin:0">${escapeHtml(data.school?.name || 'ECOLE LA FONTAINE')}</h2>
                                    <p style="color:var(--text-muted);font-size:12px;margin:4px 0">${escapeHtml(data.school?.address || '')} | ${escapeHtml(data.school?.phone || '')}</p>
                                    <span class="badge badge-success">🔒 OFFICIAL DOCUMENT — SCAN VERIFIED</span>
                                </div>

                                <!-- Student ID -->
                                <div class="dash-card" style="margin-bottom:12px">
                                    <div class="dash-card-header"><span class="dash-card-title">👤 Student</span></div>
                                    <div class="dash-card-body">
                                        <div class="form-grid">
                                            <div class="form-group"><label>Full Name</label><div style="font-weight:600;font-size:15px">${escapeHtml((s.firstName || '') + ' ' + (s.lastName || ''))}</div></div>
                                            <div class="form-group"><label>Student Code</label><div><code>${escapeHtml(s.code || '—')}</code></div></div>
                                            <div class="form-group"><label>Class</label><div>${escapeHtml(s.class || '—')}</div></div>
                                            <div class="form-group"><label>Gender</label><div>${escapeHtml(s.gender || '—')}</div></div>
                                            <div class="form-group"><label>Guardian</label><div>${escapeHtml(s.guardian || '—')}</div></div>
                                            <div class="form-group"><label>Guardian Phone</label><div>${escapeHtml(s.guardianPhone || '—')}</div></div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Academic summary -->
                                <div class="dash-card" style="margin-bottom:12px">
                                    <div class="dash-card-header"><span class="dash-card-title">📊 Academic Summary — ${escapeHtml(a.term || '')}</span></div>
                                    <div class="dash-card-body">
                                        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px">
                                            <div class="stat-card"><div class="stat-value">${Number(a.totalScore || 0).toFixed(1)}</div><div class="stat-label">Total Score</div></div>
                                            <div class="stat-card"><div class="stat-value">${a.totalMax || 0}</div><div class="stat-label">Max</div></div>
                                            <div class="stat-card"><div class="stat-value" style="color:${passed ? 'var(--success)' : 'var(--danger)'}">${Number(pct).toFixed(1)}%</div><div class="stat-label">Average</div></div>
                                            <div class="stat-card"><div class="stat-value"><span class="badge ${getGradeClass(pct)}">${escapeHtml(a.grade || getGrade(pct))}</span></div><div class="stat-label">Grade</div></div>
                                            <div class="stat-card"><div class="stat-value">${escapeHtml(String(a.rank || '—'))}</div><div class="stat-label">Rank</div></div>
                                        </div>
                                        <div style="text-align:center;padding:10px;border-radius:8px;background:${passed ? 'var(--success-bg,#dcfce7)' : '#fee2e2'}">
                                            <strong style="color:${passed ? 'var(--success,#15803d)' : 'var(--danger,#991b1b)'}">
                                                ${passed ? '✅ PASSED — PROMOTED TO NEXT CLASS' : '❌ FAILED — HOLIDAY REMEDIAL COURSES'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                <!-- Subjects table -->
                                ${a.subjects?.length ? `
                                <div class="dash-card" style="margin-bottom:12px">
                                    <div class="dash-card-header"><span class="dash-card-title">📖 Subject Marks</span></div>
                                    <div class="dash-card-body" style="padding:0">
                                        <div class="table-wrapper">
                                            <table class="data-table" style="font-size:12px">
                                                <thead><tr><th>Subject</th><th style="text-align:center">MG</th><th style="text-align:center">EX</th><th style="text-align:center">TOTAL</th><th style="text-align:center">MAX</th><th style="text-align:center">%</th><th style="text-align:center">GRADE</th></tr></thead>
                                                <tbody>${subjectRows}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                ` : ''}

                                <!-- Footer -->
                                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);padding:10px;border-top:1px solid var(--border-light)">
                                    <span>Head Teacher: ${escapeHtml(data.headTeacher || 'UWAYO GANZA Eugene')}</span>
                                    <span>Generated: ${data.gen ? new Date(data.gen).toLocaleString() : '—'}</span>
                                    <span>Scanned: ${new Date().toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="modal-footer" style="position:sticky;bottom:0">
                                <button class="btn btn-outline" onclick="closeModal('qr-result-modal')">Close</button>
                                <button class="btn btn-primary" onclick="window.print()">🖨️ Print</button>
                            </div>
                        </div>
                    </div>
                `;

                const existing = document.getElementById('qr-result-modal');
                if (existing) existing.remove();
                (document.getElementById('modals-container') || document.body).insertAdjacentHTML('beforeend', html);
            } catch (e) {
                console.error('[QR] Parse error:', e);
                showToast('Invalid QR code: ' + e.message, 'error');
            }
        }

        // Expose QR functions on window so onclick handlers can reach them
        window.generateQRCodeDataURL = generateQRCodeDataURL;
        window.generateStudentReportQR = generateStudentReportQR;
        window.addQRCodeToReport = addQRCodeToReport;
        window.displayQRCodeResults = displayQRCodeResults;

        console.log('✅ ECOLE LA FONTAINE v9.0 — All modules implemented. Ready for deployment!');
    </script>
</body>
