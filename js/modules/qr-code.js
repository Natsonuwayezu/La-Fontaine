// ================================================================

        function generateQRCodeDataURL(text, size = 150) {
            if (typeof QRCode === 'undefined') return '';
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
            document.body.appendChild(container);
            try {
                new QRCode(container, {
                    text,
                    width: size,
                    height: size,
                    colorDark: '#0f2744',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
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
            let text = JSON.stringify(payload);
            if (text.length > 2000) {
                payload.academic.subjects = payload.academic.subjects.map(s => ({
                    name: s.name, total: s.total, pct: s.pct,
                    grade: s.grade
                }));
                text = JSON.stringify(payload);
            }
            return generateQRCodeDataURL(text, 160);
        }

        function addQRCodeToReport(reportElement, student, reportData, reportType) {
            if (!reportElement || typeof QRCode === 'undefined') return;
            if (reportElement.querySelector('.report-qr-block')) return;
            const qrDataURL = generateStudentReportQR(student, reportData, reportType);
            if (!qrDataURL) return;
            const block = document.createElement('div');
            block.className = 'report-qr-block';
            block.style.cssText =
                'display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:8px 12px;border-top:1px solid #e2e8f0;margin-top:8px;background:#f8fafc;border-radius:0 0 8px 8px';
            block.innerHTML =
                `<div class="qr-image"><img src="${qrDataURL}" alt="QR" style="width:90px;height:90px;border:1px solid #e2e8f0;border-radius:4px;display:block"></div><div class="qr-info"><div><strong>${esc(student.first_name || '')} ${esc(student.last_name || '')}</strong></div><div>Code: ${esc(student.student_code || '—')}</div><div>${esc(reportData.className || '')}</div><div style="margin-top:3px;font-style:italic">📱 Scan to verify</div></div>`;
            reportElement.appendChild(block);
        }

        function displayQRCodeResults(qrData) {
            try {
                const data = JSON.parse(qrData);
                const s = data.student || {};
                const a = data.academic || {};
                const pct = a.pct ?? 0;
                const passed = pct >= (parseFloat(state.schoolSettings?.pass_mark) || 50);
                const subjectRows = (a.subjects || []).map(sub =>
                    `<tr><td><strong>${esc(sub.name)}</strong></td><td style="text-align:center">${sub.mg !== null ? Number(sub.mg).toFixed(1) : '—'}</td><td style="text-align:center">${sub.ex !== null ? Number(sub.ex).toFixed(1) : '—'}</td><td style="text-align:center;font-weight:700">${sub.total !== null ? Number(sub.total).toFixed(1) : '—'}</td><td style="text-align:center">${sub.max || '—'}</td><td style="text-align:center"><span class="badge ${getGradeClass(sub.pct)}">${sub.pct !== null ? Number(sub.pct).toFixed(1) + '%' : '—'}</span></td><td style="text-align:center"><span class="badge ${getGradeClass(sub.pct)}">${sub.grade || '—'}</span></td></tr>`
                ).join('');
                const html =
                    `<div class="modal-overlay" id="qr-result-modal" style="display:flex"><div class="modal" style="max-width:820px;max-height:95vh;overflow-y:auto;padding:0"><div class="modal-header" style="position:sticky;top:0;z-index:10"><h3>📱 QR Code — Student Report</h3><button class="modal-close" onclick="closeModal('qr-result-modal')">✕</button></div><div class="modal-body" style="padding:16px 20px"><div style="text-align:center;padding:12px 0;border-bottom:2px solid var(--navy);margin-bottom:16px"><h2 style="color:var(--navy);margin:0">${esc(data.school?.name || 'ECOLE LA FONTAINE')}</h2><p style="color:var(--text-muted);font-size:12px;margin:4px 0">${esc(data.school?.address || '')} | ${esc(data.school?.phone || '')}</p><span class="badge badge-success">🔒 OFFICIAL DOCUMENT — SCAN VERIFIED</span></div><div class="dash-card" style="margin-bottom:12px"><div class="dash-card-header"><span class="dash-card-title">👤 Student</span></div><div class="dash-card-body"><div class="form-grid"><div class="form-group"><label>Full Name</label><div style="font-weight:600;font-size:15px">${esc((s.firstName || '') + ' ' + (s.lastName || ''))}</div></div><div class="form-group"><label>Student Code</label><div><code>${esc(s.code || '—')}</code></div></div><div class="form-group"><label>Class</label><div>${esc(s.class || '—')}</div></div><div class="form-group"><label>Gender</label><div>${esc(s.gender || '—')}</div></div><div class="form-group"><label>Guardian</label><div>${esc(s.guardian || '—')}</div></div><div class="form-group"><label>Guardian Phone</label><div>${esc(s.guardianPhone || '—')}</div></div></div></div></div><div class="dash-card" style="margin-bottom:12px"><div class="dash-card-header"><span class="dash-card-title">📊 Academic Summary — ${esc(a.term || '')}</span></div><div class="dash-card-body"><div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px"><div class="stat-card"><div class="stat-value">${Number(a.totalScore || 0).toFixed(1)}</div><div class="stat-label">Total Score</div></div><div class="stat-card"><div class="stat-value">${a.totalMax || 0}</div><div class="stat-label">Max</div></div><div class="stat-card"><div class="stat-value" style="color:${passed ? 'var(--success)' : 'var(--danger)'}">${Number(pct).toFixed(1)}%</div><div class="stat-label">Average</div></div><div class="stat-card"><div class="stat-value"><span class="badge ${getGradeClass(pct)}">${esc(a.grade || getGrade(pct))}</span></div><div class="stat-label">Grade</div></div><div class="stat-card"><div class="stat-value">${esc(String(a.rank || '—'))}</div><div class="stat-label">Rank</div></div></div><div style="text-align:center;padding:10px;border-radius:8px;background:${passed ? 'var(--success-bg,#dcfce7)' : '#fee2e2'}'><strong style="color:${passed ? 'var(--success,#15803d)' : 'var(--danger,#991b1b)'}">${passed ? '✅ PASSED — PROMOTED TO NEXT CLASS' : '❌ FAILED — HOLIDAY REMEDIAL COURSES'}</strong></div></div></div>${a.subjects?.length ? `<div class="dash-card" style="margin-bottom:12px"><div class="dash-card-header"><span class="dash-card-title">📖 Subject Marks</span></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table" style="font-size:12px"><thead><tr><th>Subject</th><th style="text-align:center">MG</th><th style="text-align:center">EX</th><th style="text-align:center">TOTAL</th><th style="text-align:center">MAX</th><th style="text-align:center">%</th><th style="text-align:center">GRADE</th></tr></thead><tbody>${subjectRows}</tbody></table></div></div></div>` : ''}<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);padding:10px;border-top:1px solid var(--border-light)"><span>Head Teacher: ${esc(data.headTeacher || 'UWAYO GANZA Eugene')}</span><span>Generated: ${data.gen ? new Date(data.gen).toLocaleString() : '—'}</span><span>Scanned: ${new Date().toLocaleString()}</span></div></div><div class="modal-footer" style="position:sticky;bottom:0"><button class="btn btn-outline" onclick="closeModal('qr-result-modal')">Close</button><button class="btn btn-primary" onclick="window.print()">🖨️ Print</button></div></div></div>`;
                const existing = document.getElementById('qr-result-modal');
                if (existing) existing.remove();
                (document.getElementById('modals-container') || document.body).insertAdjacentHTML('beforeend', html);
            } catch (e) {
                console.error('[QR] Parse error:', e);
                showToast('Invalid QR code: ' + e.message, 'error');
            }
        }

        window.generateQRCodeDataURL = generateQRCodeDataURL;
        window.generateStudentReportQR = generateStudentReportQR;
        window.addQRCodeToReport = addQRCodeToReport;
        window.displayQRCodeResults = displayQRCodeResults;

        // ================================================================
        // SECTION 45: DASHBOARDS
