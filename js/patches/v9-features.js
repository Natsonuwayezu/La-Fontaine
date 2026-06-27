// ════════════════════════════════════════════════════════════════════

        async function apiRequest(path, method = 'GET', body = null, returnHeaders = false) {
            try {
                const headers = {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                    'Range-Unit': 'items',
                    'Range': '0-'
                };
                const opts = { method, headers };
                if (body) opts.body = JSON.stringify(body);
                const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
                if (res.status === 204) return { success: true, data: [], headers: res.headers };
                const data = await res.json();
                if (!res.ok) {
                    const msg = (Array.isArray(data) ? data[0]?.message : data?.message) || data?.hint || `HTTP ${res.status}`;
                    console.error('[API] ' + method + ' ' + path + ' failed:', msg);
                    return { success: false, error: msg, data: [] };
                }
                if (returnHeaders) return { success: true, data: Array.isArray(data) ? data : [data], headers: res.headers };
                return { success: true, data: Array.isArray(data) ? data : [data] };
            } catch (err) {
                // fetch() threw, meaning the request never reached the server —
                // no internet, DNS failure, or the project is unreachable.
                // Use the shared, de-duplicated offline notice instead of
                // logging this raw browser error for every failed call.
                notifyOffline();
                return { success: false, error: 'Offline — could not reach the server.', data: [] };
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function initXLSX() {
            if (typeof XLSX === 'undefined') { showToast('SheetJS library not loaded — cannot export Excel.', 'error'); return false; }
            return true;
        }

        async function get(table, filterStr = '') { return getAllRecords(table, filterStr); }

        async function autoWaiveExpiredFees() {
            try {
                const today = new Date().toISOString().slice(0, 10);
                const oneTimeCategoryIds = new Set((state.feeCategories || []).filter(c => c.is_one_time === true).map(c => c.id));
                const toWaive = (state.studentFees || []).filter(f => f.due_date && f.due_date < today && !f.is_paid && !f.is_waived && !f.is_credit && oneTimeCategoryIds.has(f.fee_category_id));
                if (!toWaive.length) return;
                console.log('[AutoWaive] Waiving ' + toWaive.length + ' expired fees…');
                for (const fee of toWaive) {
                    await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, waiver_reason: 'Auto-waived: activity/event deadline passed', waived_at: new Date().toISOString(), waived_by: state.currentUser?.id || null });
                    const idx = state.studentFees.findIndex(f => f.id === fee.id);
                    if (idx !== -1) { state.studentFees[idx].is_waived = true; state.studentFees[idx].waiver_reason = 'Auto-waived: activity/event deadline passed'; }
                }
                await logActivity(state.currentUser?.id, state.currentUser?.role, 'auto_waive_expired_fees', 'student_fees', null, { count: toWaive.length, date: today });
                invalidateCache();
                console.log('[AutoWaive] Done. ' + toWaive.length + ' fee(s) waived.');
            } catch (err) { console.warn('[AutoWaive] Failed:', err); }
        }

        async function carryOverWaiversToNewYear(studentId, newAcademicYearId) {
            try {
                const waivedFees = (state.studentFees || []).filter(f => f.student_id == studentId && f.is_waived === true && f.waiver_reason !== 'Auto-waived: activity/event deadline passed');
                if (!waivedFees.length) return;
                const waivedCategoryIds = [...new Set(waivedFees.map(f => f.fee_category_id))];
                const newFees = (state.studentFees || []).filter(f => f.student_id == studentId && waivedCategoryIds.includes(f.fee_category_id) && !f.is_waived && !f.is_paid);
                for (const fee of newFees) {
                    const orig = waivedFees.find(w => w.fee_category_id === fee.fee_category_id);
                    const reason = orig ? 'Carried over: ' + (orig.waiver_reason || 'Previous year waiver') : 'Carried over from previous academic year';
                    await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, waiver_reason: reason, waived_at: new Date().toISOString(), waived_by: state.currentUser?.id || null });
                    const idx = state.studentFees.findIndex(f2 => f2.id === fee.id);
                    if (idx !== -1) state.studentFees[idx].is_waived = true;
                }
            } catch (err) { console.warn('[CarryWaivers] Failed:', err); }
        }

        async function applySpecificFeeWaiver(studentId, feeCategoryId, reason, waivedBy) {
            const fee = (state.studentFees || []).find(f => f.student_id == studentId && f.fee_category_id == feeCategoryId && !f.is_paid && !f.is_waived);
            if (!fee) { showToast('Fee not found or already paid/waived', 'warning'); return false; }
            const result = await apiRequest('student_fees?id=eq.' + fee.id, 'PATCH', { is_waived: true, waiver_reason: reason || 'Manual waiver', waived_at: new Date().toISOString(), waived_by: waivedBy || state.currentUser?.id });
            if (!result.success) { showToast('Failed to apply waiver: ' + result.error, 'error'); return false; }
            const idx = state.studentFees.findIndex(f => f.id === fee.id);
            if (idx !== -1) { state.studentFees[idx].is_waived = true; state.studentFees[idx].waiver_reason = reason; }
            await logActivity(state.currentUser?.id, state.currentUser?.role, 'waive_fee', 'student_fees', fee.id, { studentId, feeCategoryId, reason });
            await notifyAction('fee_waived', { message: 'Fee waiver applied to student ' + studentId + ' for category ' + feeCategoryId }, ['admin', 'accountant']);
            invalidateCache();
            showToast('✅ Waiver applied to specific fee category', 'success');
            return true;
        }

        /**
 * Download a Waiver Receipt PDF
 * @param {Object} waiverData - Waiver details
 */
        async function downloadWaiverReceipt(waiverData) {
            const {
                studentName, studentCode, className, feeName,
                originalAmount, waivedAmount, reason,
                receiptNumber, date, approvedBy,
                schoolName = 'ECOLE LA FONTAINE',
                schoolAddress = 'Rubavu, Rwanda',
                logo = '🏫'
            } = waiverData;

            const remaining = originalAmount - waivedAmount;
            const isFullWaiver = remaining === 0;

            const logoHtml = (typeof logo === 'string' && (logo.startsWith('data:') || logo.startsWith('http')))
                ? `<img src="${logo}" alt="logo" style="width:38px;height:38px;object-fit:contain;border-radius:4px">`
                : `<span style="font-size:26px;line-height:1">${logo || '🏫'}</span>`;

            const html = `<div id="waiver-pdf-content" style="font-family:'Courier New',Monaco,Menlo,monospace;width:350px;margin:0 auto;background:#fff;padding:10px;font-size:9.5px;line-height:1.25">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">
            <div style="width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center">${logoHtml}</div>
            <div style="text-align:center">
                <div style="font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;line-height:1.2">${esc(schoolName)}</div>
                ${schoolAddress ? `<div style="font-size:7px;color:#666;margin-top:1px">${esc(schoolAddress)}</div>` : ''}
                <div style="font-size:9px;font-weight:600;letter-spacing:1px;color:#444;margin-top:2px">FEE WAIVER RECEIPT</div>
                <div style="font-size:8px;font-family:monospace;background:#f0f0f0;display:inline-block;padding:1px 5px;margin-top:2px">${esc(receiptNumber)}</div>
            </div>
        </div>
        <div style="border-top:1px dashed #999;margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Student:</span><span style="font-weight:500;text-align:right">${esc(studentName)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Code:</span><span style="font-weight:500;text-align:right">${esc(studentCode)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Class:</span><span style="font-weight:500;text-align:right">${esc(className)}</span></div>
        <div style="border-top:1px dotted #999;margin:5px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Fee Category:</span><span style="font-weight:500;text-align:right">${esc(feeName)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Original Amount:</span><span style="font-weight:500;text-align:right">${fmtCurrency(originalAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;background:#d1fae5;padding:4px 8px;border-radius:4px">
            <span style="font-weight:700;color:#065f46">WAIVED AMOUNT:</span>
            <span style="font-weight:700;color:#065f46">${fmtCurrency(waivedAmount)}</span>
        </div>
        ${remaining > 0 ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Remaining Balance:</span><span style="font-weight:600;color:#dc2626">${fmtCurrency(remaining)}</span></div>` : ''}
        <div style="border-top:1px dashed #999;margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Reason:</span><span style="font-weight:500;text-align:right">${esc(reason)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Date:</span><span style="font-weight:500;text-align:right">${esc(date)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Approved By:</span><span style="font-weight:500;text-align:right">${esc(approvedBy)}</span></div>
        <div style="border-top:1px solid #000;margin:6px 0"></div>
        <div style="text-align:center;font-size:8px;color:#666;margin-top:8px">
            <div style="background:#d1fae5;padding:4px 12px;border-radius:12px;display:inline-block;font-weight:700;color:#065f46;font-size:9px">
                ${isFullWaiver ? '✅ FULLY WAIVED' : '⚡ PARTIALLY WAIVED'}
            </div>
            <div style="margin-top:6px">${isFullWaiver ? 'This fee has been fully waived' : 'A partial waiver has been applied'}</div>
            <div style="margin-top:4px">\u2729 ${esc(schoolName)} \u2729</div>
        </div>
    </div>`;

            const container = document.createElement('div');
            container.innerHTML = html;
            container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:350px';
            document.body.appendChild(container);

            try {
                if (typeof html2pdf === 'undefined') throw new Error('html2pdf not loaded');
                await html2pdf().set({
                    margin: [4, 4, 4, 4],
                    filename: `Waiver_${esc(studentName).replace(/\s+/g, '_')}_${esc(receiptNumber)}.pdf`,
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
                }).from(container.querySelector('#waiver-pdf-content')).save();
                return true;
            } catch (err) {
                console.warn('[Waiver PDF] Failed:', err);
                return false;
            } finally {
                document.body.removeChild(container);
            }
        }

        async function downloadReceiptPDF(receiptData) {
            const {
                receiptNum, studentName, studentCode = '—', className,
                parentName = '—', amount, method, date, recordedBy = null,
                fees = [], schoolName = 'ECOLE LA FONTAINE',
                schoolAddress = '', logo = '🏫'
            } = receiptData;

            // ── Totals / status ─────────────────────────────────────────
            const total = fees.reduce((s, f) => s + (f.amount || 0), 0);
            const paidSoFar = fees.reduce((s, f) => s + (f.paid || 0), 0);
            const due = Math.max(0, total - paidSoFar);
            let statusText = 'PAID IN FULL', statusBg = '#d1fae5', statusColor = '#065f46';
            if (due > 0 && paidSoFar > 0) { statusText = 'PARTIALLY PAID'; statusBg = '#fef3c7'; statusColor = '#92400e'; }
            else if (due > 0 && paidSoFar === 0) { statusText = 'OUTSTANDING'; statusBg = '#fee2e2'; statusColor = '#991b1b'; }

            // ── Received by (admin -> fixed headteacher name; accountant -> own name) ──
            const HEADTEACHER_NAME = 'UWAYO GANZA Eugene';
            let receivedByName = '—';
            if (recordedBy) {
                if (recordedBy.role === 'admin') receivedByName = HEADTEACHER_NAME;
                else receivedByName = recordedBy.name || '—';
            }

            // ── Logo ─────────────────────────────────────────────────────
            const logoHtml = (typeof logo === 'string' && (logo.startsWith('data:') || logo.startsWith('http')))
                ? '<img src="' + logo + '" alt="logo" style="width:38px;height:38px;object-fit:contain;border-radius:4px">'
                : '<span style="font-size:26px;line-height:1">' + (logo || '🏫') + '</span>';

            // ── Fee rows ─────────────────────────────────────────────────
            const feeRows = fees.map(f => {
                const fDue = Math.max(0, (f.amount || 0) - (f.paid || 0));
                return '<tr>'
                    + '<td style="padding:3px 0">' + esc(f.name) + '</td>'
                    + '<td class="text-right" style="padding:3px 0;text-align:right">' + fmtCurrency(f.amount || 0) + '</td>'
                    + '<td class="text-right" style="padding:3px 0;text-align:right">' + fmtCurrency(f.paid || 0) + '</td>'
                    + '<td class="text-right" style="padding:3px 0;text-align:right;' + (fDue > 0 ? 'color:#dc2626;font-weight:600' : 'color:#10b981') + '">' + fmtCurrency(fDue) + '</td>'
                    + '</tr>';
            }).join('');

            // ── Receipt HTML (quarter-page thermal style) ───────────────────
            const html = '<div id="receipt-pdf-content" style="font-family:\'Courier New\',Monaco,Menlo,monospace;width:350px;margin:0 auto;background:#fff;padding:10px;font-size:9.5px;line-height:1.25">'
                + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">'
                + '<div style="width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + logoHtml + '</div>'
                + '<div style="text-align:center">'
                + '<div style="font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;line-height:1.2">' + esc(schoolName) + '</div>'
                + (schoolAddress ? '<div style="font-size:7px;color:#666;margin-top:1px">' + esc(schoolAddress) + '</div>' : '')
                + '<div style="font-size:9px;font-weight:600;letter-spacing:1px;color:#444;margin-top:2px">PAYMENT RECEIPT</div>'
                + '<div style="font-size:8px;font-family:monospace;background:#f0f0f0;display:inline-block;padding:1px 5px;margin-top:2px">' + esc(receiptNum) + '</div>'
                + '</div>'
                + '</div>'
                + '<div style="border-top:1px dashed #999;margin:6px 0"></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Student:</span><span style="font-weight:500;text-align:right">' + esc(studentName) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Code:</span><span style="font-weight:500;text-align:right">' + esc(studentCode) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Class:</span><span style="font-weight:500;text-align:right">' + esc(className) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Parent/Guardian:</span><span style="font-weight:500;text-align:right">' + esc(parentName) + '</span></div>'
                + '<div style="border-top:1px dotted #999;margin:5px 0"></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Date:</span><span style="font-weight:500;text-align:right">' + esc(date) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Method:</span><span style="font-weight:500;text-align:right">' + esc(method) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0"><span style="font-weight:600;color:#555">Received By:</span><span style="font-weight:500;text-align:right">' + esc(receivedByName) + '</span></div>'
                + '<div style="border-top:1px dashed #999;margin:6px 0"></div>'
                + (fees.length
                    ? '<table style="width:100%;border-collapse:collapse;font-size:8px;margin:8px 0">'
                    + '<thead><tr>'
                    + '<th style="text-align:left;border-bottom:1px solid #ccc;padding:3px 0;font-size:7px;text-transform:uppercase;letter-spacing:.5px">Fee Category</th>'
                    + '<th style="text-align:right;border-bottom:1px solid #ccc;padding:3px 0;font-size:7px;text-transform:uppercase;letter-spacing:.5px">Amount</th>'
                    + '<th style="text-align:right;border-bottom:1px solid #ccc;padding:3px 0;font-size:7px;text-transform:uppercase;letter-spacing:.5px">Paid</th>'
                    + '<th style="text-align:right;border-bottom:1px solid #ccc;padding:3px 0;font-size:7px;text-transform:uppercase;letter-spacing:.5px">Due</th>'
                    + '</tr></thead><tbody>' + feeRows + '</tbody></table>'
                    + '<div style="border-top:1px dashed #999;margin:6px 0"></div>'
                    : '')
                + '<div style="display:flex;justify-content:space-between;margin:4px 0;font-weight:600"><span>TOTAL FEES</span><span>' + fmtCurrency(total) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0;font-weight:600"><span>THIS PAYMENT</span><span style="font-size:12px;font-weight:800;color:#065f46">' + fmtCurrency(amount) + '</span></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0;font-weight:600"><span>REMAINING</span><span style="color:#dc2626">' + fmtCurrency(due) + '</span></div>'
                + '<div style="border-top:1px dashed #999;margin:6px 0"></div>'
                + '<div style="display:flex;justify-content:space-between;margin:4px 0;font-size:9px"><span style="font-weight:600;color:#555">Overall Status:</span>'
                + '<span style="background:' + statusBg + ';color:' + statusColor + ';padding:1px 8px;border-radius:12px;font-size:8px;font-weight:600;display:inline-block">' + statusText + '</span></div>'
                + '<div style="border-top:1px solid #000;margin:6px 0"></div>'
                + '<div style="text-align:center;font-size:7px;color:#666;margin-top:8px">'
                + '<div>Thank you for your payment</div>'
                + '<div style="margin-top:4px">\u2729 ' + esc(schoolName) + ' \u2729</div>'
                + '</div>'
                + '</div>';

            const container = document.createElement('div'); container.innerHTML = html; container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:350px';
            document.body.appendChild(container);
            try {
                if (typeof html2pdf === 'undefined') throw new Error('html2pdf not loaded');
                await html2pdf().set({
                    margin: [4, 4, 4, 4],
                    filename: 'Receipt_' + esc(studentName).replace(/\s+/g, '_') + '_' + esc(receiptNum) + '.pdf',
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
                }).from(container.querySelector('#receipt-pdf-content')).save();
            } finally { document.body.removeChild(container); }
        }

        async function processPaymentWithReceipt(student, amount, method, ref, notes, selectedFees, state_ref) {
            const receiptNum = 'RCP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(((state_ref.payments || []).length + 1)).padStart(4, '0');
            const schoolSettings = state_ref.schoolSettings || {};
            const schoolName = schoolSettings.school_name || 'ECOLE LA FONTAINE';
            const schoolAddress = schoolSettings.school_address || schoolSettings.address || '';
            const logo = schoolSettings.school_logo || schoolSettings.logo_url || '🏫';
            const cls = getClassById(student.class_id); const studentName = student.first_name + ' ' + student.last_name;
            const studentCode = student.student_code || '—';
            const parentName = student.guardian_name || '—';
            const recordedBy = state_ref.currentUser ? { role: state_ref.currentUser.role, name: state_ref.currentUser.name } : null;
            const selectedFeeDetails = [];
            if (selectedFees) { for (const [feeId, selected] of selectedFees.entries()) { if (!selected) continue; const fee = state_ref.studentFees.find(f => f.id === feeId); if (!fee) continue; const cat = state_ref.feeCategories.find(c => c.id === fee.fee_category_id); selectedFeeDetails.push({ name: cat?.name || 'Fee', amount: fee.amount, paid: fee.paid_amount || 0, thisPayment: Math.min(amount, fee.amount - (fee.paid_amount || 0)) }); } }
            try {
                await downloadReceiptPDF({ receiptNum, studentName, studentCode, className: cls?.name || '—', parentName, amount, method, date: new Date().toLocaleDateString(), recordedBy, fees: selectedFeeDetails, schoolName, schoolAddress, logo });
                showToast('✅ Payment recorded & receipt downloaded (' + receiptNum + ')', 'success');
            } catch (pdfErr) { console.warn('[Receipt PDF] Failed:', pdfErr); showToast('✅ Payment recorded (' + receiptNum + ') — PDF download failed', 'warning'); }
        }

        // ── BACKGROUND SERVICE & NOTIFICATIONS ─────────────────────────────────

        async function initBackgroundService() {
            if (!('serviceWorker' in navigator)) { console.warn('[BG] Service workers not supported'); return; }
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('[BG] SW registered:', reg.scope);
                navigator.serviceWorker.addEventListener('message', (event) => { const { type, action } = event.data || {}; if (type === 'NOTIFICATION_CLICK' && action) navigateTo(action); });
                if (Notification.permission === 'default') await Notification.requestPermission();
                startRealtimePolling(reg);
            } catch (err) { console.error('[BG] SW registration failed:', err); }
        }

        let _pollingInterval = null, _lastNotifCheck = Date.now();

        function startRealtimePolling(swReg) {
            if (_pollingInterval) clearInterval(_pollingInterval);
            _pollingInterval = setInterval(async () => { if (state.currentUser) await checkForNewNotifications(swReg); }, 30000);
            document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && state.currentUser) await checkForNewNotifications(swReg); });
            window.addEventListener('online', async () => { if (state.currentUser) await checkForNewNotifications(swReg); });
        }

        async function checkForNewNotifications(swReg) {
            try {
                const since = new Date(_lastNotifCheck).toISOString(); _lastNotifCheck = Date.now();
                const user = state.currentUser; if (!user) return;
                const result = await apiRequest('announcements?created_at=gt.' + encodeURIComponent(since) + '&status=eq.published&order=created_at.desc&limit=20');
                if (!result.success || !result.data.length) return;
                for (const notif of result.data) {
                    if (!shouldShowNotificationForRole(notif, user.role)) continue;
                    state.notifications = state.notifications || [];
                    if (!state.notifications.find(n => n.id === notif.id)) state.notifications.unshift(notif);
                    if (Notification.permission === 'granted' && swReg) {
                        await swReg.showNotification(notif.title || 'ECOLE LA FONTAINE', { body: notif.message || '', icon: '/icons/icon-192x192.png', badge: '/icons/badge-72x72.png', tag: 'notif-' + notif.id, data: { action: getNotifNavTarget(notif), type: notif.type }, vibrate: [200, 100, 200], requireInteraction: notif.type === 'urgent' });
                    }
                }
                updateNotificationBadgeCount((state.notifications || []).filter(n => !n.is_read).length);
            } catch (err) { console.warn('[BG] Notification check failed:', err); }
        }

        function shouldShowNotificationForRole(notif, role) {
            if (role === 'admin') return true;
            const recipients = notif.recipients || 'all';
            if (recipients === 'all') return true;
            if (recipients === 'teachers' && role === 'teacher') return true;
            if (recipients === 'accountants' && role === 'accountant') return true;
            const category = (notif.category || '').toLowerCase();
            const TEACHER_BLOCKED = ['finance', 'payment', 'fee', 'receipt', 'balance'];
            const ACCOUNTANT_BLOCKED = ['marks', 'academic', 'assessment', 'grades', 'register'];
            if (role === 'teacher' && TEACHER_BLOCKED.some(c => category.includes(c))) return false;
            if (role === 'accountant' && ACCOUNTANT_BLOCKED.some(c => category.includes(c))) return false;
            return true;
        }

        function getNotifNavTarget(notif) {
            const cat = (notif.category || '').toLowerCase();
            if (cat.includes('mark') || cat.includes('academic')) return 'marks';
            if (cat.includes('payment') || cat.includes('fee')) return 'record-payment';
            if (cat.includes('student')) return 'students';
            if (cat.includes('backup')) return 'backup-restore';
            if (cat.includes('setting')) return 'school-settings';
            return 'notifications';
        }

        async function notifyAction(action, details = {}, targetRoles = ['admin']) {
            const user = state.currentUser; if (!user) return;
            const categoryMap = { marks_import: 'academic', payment_recorded: 'payment', payment_reversed: 'payment', setting_updated: 'system', backup_created: 'system', student_enrolled: 'student', fee_waived: 'finance', fee_structure_changed: 'finance' };
            const iconMap = { marks_import: '📝', payment_recorded: '💰', payment_reversed: '↩️', setting_updated: '⚙️', backup_created: '💾', student_enrolled: '🎓', fee_waived: '🎁', fee_structure_changed: '🏷️' };
            try {
                await apiRequest('announcements', 'POST', { title: (iconMap[action] || '🔔') + ' ' + action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), message: details.message || JSON.stringify(details), type: 'info', status: 'published', recipients: targetRoles.includes('all') ? 'all' : targetRoles.length === 1 ? (targetRoles[0] === 'teachers' ? 'teachers' : targetRoles[0] === 'accountants' ? 'accountants' : 'all') : 'all', category: categoryMap[action] || 'system', created_by: user.id, created_at: new Date().toISOString() });
            } catch (err) { console.warn('[notifyAction] Failed:', err); }
        }

        function showRoleNotification(message, type = 'info', roles = ['admin', 'accountant', 'teacher']) {
            const user = state.currentUser; if (!user) return;
            if (!roles.includes(user.role) && !roles.includes('all')) return;
            showToast(message, type, 5000);
        }

        async function renderFamilyTable(container) {
            await ensureStateLoaded();
            const families = state.families || []; const students = state.students || []; const feeCategories = state.feeCategories || [];
            if (!families.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👨\u200D👩\u200D👧</div><div class="empty-state-title">No families linked yet</div></div>'; return; }
            const familySummaries = families.map(family => {
                const members = students.filter(s => s.family_id === family.id && s.status === 'Active');
                const memberData = members.map(student => {
                    const fees = (state.studentFees || []).filter(f => f.student_id === student.id);
                    const activeFees = fees.filter(f => !f.is_waived && !f.is_credit);
                    const waivedFees = fees.filter(f => f.is_waived);
                    const totalFee = activeFees.reduce((s2, f) => s2 + (f.amount || 0), 0);
                    const totalPaid = activeFees.reduce((s2, f) => s2 + (f.paid_amount || 0), 0);
                    const feeBreakdown = activeFees.map(f => { const cat = feeCategories.find(c => c.id === f.fee_category_id); return { name: cat?.name || 'Unknown', amount: f.amount, paid: f.paid_amount || 0, id: f.id, fee_category_id: f.fee_category_id }; });
                    const waiversBreakdown = waivedFees.map(f => { const cat = feeCategories.find(c => c.id === f.fee_category_id); return { name: cat?.name || 'Unknown', amount: f.amount, reason: f.waiver_reason }; });
                    return { student, cls: getClassById(student.class_id), totalFee, totalPaid, balance: totalFee - totalPaid, feeBreakdown, waiversBreakdown };
                });
                const familyTotal = memberData.reduce((s2, m) => s2 + m.totalFee, 0); const familyPaid = memberData.reduce((s2, m) => s2 + m.totalPaid, 0);
                return { family, members: memberData, familyTotal, familyPaid, familyBalance: familyTotal - familyPaid };
            });
            container.innerHTML = '<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">👨‍👩‍👧 Family Fee Summary</span><div class="btn-group"><input type="text" id="family-search-input" class="form-control" placeholder="🔍 Search family..." oninput="window.filterFamilyTableView()" style="width:200px"><button class="btn btn-sm btn-outline" onclick="window.exportFamilyTable()">📥 Export</button></div></div><div class="dash-card-body" id="family-table-body">' + familySummaries.map(fam => renderSingleFamilyBlock(fam)).join('') + '</div></div>';
            window.filterFamilyTableView = function () { const q = document.getElementById('family-search-input')?.value.toLowerCase() || ''; document.querySelectorAll('.family-block').forEach(block => { block.style.display = block.dataset.search.includes(q) ? '' : 'none'; }); };
            window.exportFamilyTable = function () {
                if (!initXLSX()) return;
                const rows = [['Family Code', 'Guardian', 'Student', 'Class', 'Fee Category', 'Amount', 'Paid', 'Balance', 'Waived']];
                for (const fam of familySummaries) { for (const mem of fam.members) { for (const fee of mem.feeBreakdown) rows.push([fam.family.family_code, fam.family.guardian_name || '', mem.student.first_name + ' ' + mem.student.last_name, mem.cls?.name || '', fee.name, fee.amount, fee.paid, fee.amount - fee.paid, 'No']); for (const w of mem.waiversBreakdown) rows.push([fam.family.family_code, fam.family.guardian_name || '', mem.student.first_name + ' ' + mem.student.last_name, mem.cls?.name || '', w.name, w.amount, w.amount, 0, 'YES - ' + w.reason]); } }
                const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Families'); XLSX.writeFile(wb, 'FamilyFees_' + new Date().toISOString().slice(0, 10) + '.xlsx');
            };
        }

        function renderSingleFamilyBlock(fam) {
            const { family, members, familyTotal, familyPaid, familyBalance } = fam;
            const searchStr = (family.family_code + ' ' + (family.guardian_name || '') + ' ' + members.map(m => m.student.first_name + ' ' + m.student.last_name).join(' ')).toLowerCase();
            const balClass = familyBalance > 0 ? 'color:var(--danger)' : 'color:var(--success)';
            const memberRows = members.map(mem => {
                const catRows = mem.feeBreakdown.map((fee, feeIdx) => '<tr style="background:var(--bg-tertiary)"><td style="padding:4px 12px 4px 32px;font-size:12px;color:var(--text-secondary)">' + esc(fee.name) + '</td><td style="padding:4px 8px;text-align:right;font-size:12px">' + fmtCurrency(fee.amount) + '</td><td style="padding:4px 8px;text-align:right;font-size:12px;color:var(--success)">' + fmtCurrency(fee.paid) + '</td><td style="padding:4px 8px;text-align:right;font-size:12px;' + (fee.amount - fee.paid > 0 ? 'color:var(--danger);font-weight:600' : '') + '">' + fmtCurrency(fee.amount - fee.paid) + '</td><td style="padding:4px 8px;text-align:center"><button class="btn btn-xs btn-outline-danger" onclick="window.openWaiverForFee(' + mem.student.id + ',' + fee.fee_category_id + ')" title="Waive this fee">🎁 Waive</button></td></tr>').join('');
                const waivedRows = mem.waiversBreakdown.map(w => '<tr style="background:#d1fae5;opacity:.85"><td style="padding:4px 12px 4px 32px;font-size:12px;color:#065f46">✓ ' + esc(w.name) + ' <em style="font-size:11px">(waived: ' + esc(w.reason || '') + ')</em></td><td style="padding:4px 8px;text-align:right;font-size:12px;text-decoration:line-through;color:#94a3b8">' + fmtCurrency(w.amount) + '</td><td colspan="3" style="padding:4px 8px;font-size:11px;color:#065f46">WAIVED</td></tr>').join('');
                return '<tr style="border-top:1px solid var(--border-light)"><td style="padding:8px 12px;font-weight:600">' + esc(mem.student.first_name) + ' ' + esc(mem.student.last_name) + '</td><td style="padding:8px 12px;color:var(--text-muted)">' + esc(mem.cls?.name || '—') + '</td><td style="padding:8px 12px;text-align:right;font-weight:600">' + fmtCurrency(mem.totalFee) + '</td><td style="padding:8px 12px;text-align:right;color:var(--success);font-weight:600">' + fmtCurrency(mem.totalPaid) + '</td><td style="padding:8px 12px;text-align:right;font-weight:700;' + (mem.balance > 0 ? 'color:var(--danger)' : 'color:var(--success)') + '">' + fmtCurrency(mem.balance) + '</td><td></td></tr>' + catRows + waivedRows;
            }).join('');
            return '<div class="family-block" data-search="' + esc(searchStr) + '" style="border:1px solid var(--border-light);border-radius:var(--r-lg);margin-bottom:var(--lg);overflow:hidden"><div style="background:var(--role-light);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><strong style="font-size:15px">👨‍👩‍👧 ' + esc(family.family_code) + '</strong>' + (family.guardian_name ? ' <span style="margin-left:12px;color:var(--text-secondary);font-size:13px">Guardian: ' + esc(family.guardian_name) + '</span>' : '') + (family.guardian_phone ? ' <span style="margin-left:12px;color:var(--text-muted);font-size:12px">📞 ' + esc(family.guardian_phone) + '</span>' : '') + '</div><div style="display:flex;gap:16px;font-size:13px"><span>Total: <strong>' + fmtCurrency(familyTotal) + '</strong></span><span style="color:var(--success)">Paid: <strong>' + fmtCurrency(familyPaid) + '</strong></span><span style="' + balClass + '">Balance: <strong>' + fmtCurrency(familyBalance) + '</strong></span><button class="btn btn-xs btn-primary" onclick="window.applyFamilyDiscount(' + family.id + ')">💰 Discount</button></div></div><div class="table-wrapper"><table class="data-table" style="min-width:600px"><thead><tr><th>Student</th><th>Class</th><th style="text-align:right">Total Fees</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th><th style="text-align:center">Action</th></tr></thead><tbody>' + memberRows + '</tbody><tfoot><tr style="background:var(--bg-tertiary);font-weight:700;border-top:2px solid var(--border-medium)"><td colspan="2" style="padding:10px 12px">FAMILY TOTAL (' + members.length + ' student' + (members.length !== 1 ? 's' : '') + ')</td><td style="padding:10px 12px;text-align:right">' + fmtCurrency(familyTotal) + '</td><td style="padding:10px 12px;text-align:right;color:var(--success)">' + fmtCurrency(familyPaid) + '</td><td style="padding:10px 12px;text-align:right;' + balClass + '">' + fmtCurrency(familyBalance) + '</td><td></td></tr></tfoot></table></div></div>';
        }

        window.openWaiverForFee = async function (studentId, feeCategoryId) {
            const student = state.students.find(s => s.id === studentId); const cat = state.feeCategories.find(c => c.id === feeCategoryId);
            const fee = (state.studentFees || []).find(f => f.student_id == studentId && f.fee_category_id == feeCategoryId && !f.is_waived && !f.is_paid);
            if (!fee) return showToast('Fee not found', 'error');
            const name = (student?.first_name || '') + ' ' + (student?.last_name || '');
            showModal(`<div class="modal-overlay" id="waiver-modal">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h4>🎁 Waive Fee</h4>
            <button class="modal-close" onclick="closeModal('waiver-modal')">✕</button>
        </div>
        <div class="modal-body">
            <p>Waiving <strong>${esc(cat?.name || 'Fee')}</strong> (${fmtCurrency(fee.amount)}) for <strong>${esc(name)}</strong>.</p>
            <div class="form-group" style="margin-top:16px">
                <label>Reason for waiver</label>
                <select id="waiver-reason-select" class="form-control" onchange="document.getElementById('waiver-reason-custom').style.display=this.value==='custom'?'block':'none'">
                    <option value="Financial hardship">Financial hardship</option>
                    <option value="Scholarship">Scholarship</option>
                    <option value="School fees only — partial waiver">School fees only — partial waiver</option>
                    <option value="Staff child benefit">Staff child benefit</option>
                    <option value="custom">Custom reason…</option>
                </select>
                <textarea id="waiver-reason-custom" class="form-control" style="display:none;margin-top:8px" rows="2" placeholder="Enter reason…"></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('waiver-modal')">Cancel</button>
            <button class="btn btn-danger" onclick="window._confirmWaiver(${studentId}, ${feeCategoryId})">✅ Apply Waiver</button>
        </div>
    </div>
</div>`);
            window._confirmWaiver = async (sid, catId) => {
                const sel = document.getElementById('waiver-reason-select'); const reason = sel.value === 'custom' ? (document.getElementById('waiver-reason-custom')?.value.trim() || 'Custom waiver') : sel.value;
                closeModal('waiver-modal');
                const ok = await applySpecificFeeWaiver(sid, catId, reason, state.currentUser?.id);
                if (ok) { await refreshTable('student_fees'); const ftb = document.getElementById('family-table-body'); if (ftb) await renderFamilyTable(ftb.closest('.dash-card').parentElement || ftb.parentElement); }
            };
        };

        async function saveBackupWithRotation(isAuto = false) {
            const BACKUP_KEY = 'elf_backup_history'; const MAX_BACKUPS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.maxBackups) || 5;
            const btn = document.getElementById('backup-btn'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader-inline"></span> Backing up…'; }
            try {
                showToast('⏳ Starting full backup (paginated)…', 'info', 3000);
                const LARGE_TABLES = ['marks', 'payments', 'student_fees', 'activity_logs'];
                const STANDARD_TABLES = ['students', 'teachers', 'classes', 'subjects', 'terms', 'academic_years', 'fee_categories', 'fee_amounts', 'assessments', 'announcements', 'families', 'reminders', 'school_settings', 'grading_scales', 'teacher_assignments', 'timetable_slots', 'discounts', 'credit_balances', 'payment_reversals', 'payment_allocations', 'users', 'notifications', 'fee_templates'];
                const backup = { version: '9.0', created_at: new Date().toISOString(), created_by: state.currentUser?.name || 'system', type: isAuto ? 'auto' : 'manual', tables: {} };
                let totalRecords = 0;
                for (const table of LARGE_TABLES) { try { backup.tables[table] = await getAllRecords(table, '', 1000); totalRecords += backup.tables[table].length; } catch (e) { backup.tables[table] = []; } }
                for (const table of STANDARD_TABLES) { try { const res = await apiRequest(table + '?limit=50000'); backup.tables[table] = res.success ? res.data : []; totalRecords += backup.tables[table].length; } catch (e) { backup.tables[table] = []; } }
                backup.totalRecords = totalRecords;
                const json = JSON.stringify(backup, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const dateStr = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'); a.href = url; a.download = 'ECOLE-FONTAINE-Backup-' + dateStr + '.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                let history = []; try { history = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { history = []; }
                history.unshift({ date: new Date().toISOString(), type: isAuto ? 'auto' : 'manual', records: totalRecords, sizeKB: Math.round(json.length / 1024) });
                if (history.length > MAX_BACKUPS) history = history.slice(0, MAX_BACKUPS);
                localStorage.setItem(BACKUP_KEY, JSON.stringify(history));
                await notifyAction('backup_created', { message: 'Backup: ' + totalRecords + ' records across ' + Object.keys(backup.tables).length + ' tables' }, ['admin']);
                showToast('✅ Backup complete! ' + totalRecords.toLocaleString() + ' records saved.', 'success', 5000);
                return true;
            } catch (err) { console.error('[Backup] Failed:', err); showToast('❌ Backup failed: ' + err.message, 'error'); return false; }
            finally { if (btn) { btn.disabled = false; btn.innerHTML = '💾 Full Backup'; } }
        }

        // ════════════════════════════════════════════════════════════════════════
        // SECTION 98 — MISSING FUNCTIONS (all 67 undefined window.X defined here)
