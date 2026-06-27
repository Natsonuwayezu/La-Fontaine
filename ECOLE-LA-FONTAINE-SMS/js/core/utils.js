// js/core/utils.js
// Source lines: 10179–10670 of original monolith
// ============================================================

        // ══════════════════════════════════════════════════════════════════════════



        // ──────────────────────────────────────────────────────────────────────
        // 4.1 — Number & Currency Formatting
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Format a number with thousands separators and optional decimal places.
         */
        function fmt(n, d = 0) {
            if (n === null || n === undefined || isNaN(n)) return '—';
            return Number(n).toLocaleString('en-US', {
                minimumFractionDigits: d,
                maximumFractionDigits: d
            });
        }


        /**
         * Format a number as Rwandan Francs (e.g. 12,500 RWF).
         */
        function fmtCurrency(n) {
            if (n === null || n === undefined || isNaN(n)) return '—';
            return Number(n).toLocaleString('en-US') + ' RWF';
        }


        /**
         * Format a number as a percentage string (e.g. '74.3%').
         */
        function fmtPct(n, d = 1) {
            if (n === null || n === undefined || isNaN(n)) return '—';
            return Number(n).toFixed(d) + '%';
        }


        /**
         * Format a time value for display.
         */
        function fmtTime(s) {
            if (!s) return '—';
            try {
                return new Date(s).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                return s || '—';
            }
        }



        // ──────────────────────────────────────────────────────────────────────
        // 4.2 — Date Formatting
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Format an ISO date string as '14 Jun 2025'.
         */
        function fmtDate(s) {
            if (!s) return '—';
            try {
                return new Date(s).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            } catch (e) {
                return s || '—';
            }
        }


        /**
         * Format an ISO datetime string as '14 Jun 2025, 09:30'.
         */
        function fmtDateTime(s) {
            if (!s) return '—';
            try {
                return new Date(s).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                return s || '—';
            }
        }


        /**
         * Return a human-readable relative time string (e.g. '3h ago', 'just now').
         */
        function fmtAgo(s) {
            if (!s) return '—';
            const secs = Math.floor((Date.now() - new Date(s)) / 1000);
            if (secs < 60) return 'just now';
            const mins = Math.floor(secs / 60);
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            if (days < 7) return `${days}d ago`;
            return fmtDate(s);
        }



        // ──────────────────────────────────────────────────────────────────────
        // 4.3 — String & Security
        // ──────────────────────────────────────────────────────────────────────


        /**
         * HTML-escape a string to prevent XSS injection in innerHTML.
         * Always use this when inserting user-controlled strings into HTML templates.
         */
        function esc(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }



        // ──────────────────────────────────────────────────────────────────────
        // 4.4 — File & Export Helpers
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Trigger a browser file download from in-memory content.
         */
        function downloadBlob(content, filename, mime = 'application/octet-stream') {
            const url = URL.createObjectURL(new Blob([content], { type: mime }));
            const a = Object.assign(document.createElement('a'), { href: url, download: filename });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }


        /**
         * Export a JSON array to an .xlsx file via SheetJS.
         */
        function exportToExcel(data, filename) {
            if (!data?.length) {
                showToast('No data to export', 'warning');
                return;
            }
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        }


        /**
         * Export with custom sheet name.
         */
        function exportArrayToExcel(data, filename, sheetName = 'Data') {
            if (!initXLSX()) return false;

            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
            return true;
        }



        // ──────────────────────────────────────────────────────────────────────
        // 4.5 — Chart Helpers (Chart.js wrappers)
        // ──────────────────────────────────────────────────────────────────────

        let chartInstances = {};

        // Student Details page: tracks the selected student and active tab
        // across switchStudentTab() calls (declared here because 'use strict'
        // forbids assigning to undeclared variables).
        let _currentStudentId = null;
        let _activeStudentTab = 'info';

        // Create a bar chart
        function createBarChart(canvasId, labels, datasets, options = {}) {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            // Destroy existing chart
            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
            }

            const defaultOptions = {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                }
            };

            chartInstances[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: { ...defaultOptions, ...options }
            });

            return chartInstances[canvasId];
        }

        // Create a line chart
        function createLineChart(canvasId, labels, datasets, options = {}) {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
            }

            const defaultOptions = {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                }
            };

            chartInstances[canvasId] = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: { ...defaultOptions, ...options }
            });

            return chartInstances[canvasId];
        }

        // Create a pie/doughnut chart
        function createPieChart(canvasId, labels, data, colors, type = 'doughnut') {
            const ctx = document.getElementById(canvasId)?.getContext('2d');
            if (!ctx) return null;

            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
            }

            chartInstances[canvasId] = new Chart(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'right' },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } }
                    }
                }
            });

            return chartInstances[canvasId];
        }

        // Update chart data
        function updateChart(canvasId, labels, datasets) {
            const chart = chartInstances[canvasId];
            if (!chart) return;

            chart.data.labels = labels;
            chart.data.datasets = datasets;
            chart.update();
        }

        // Destroy chart
        function destroyChart(canvasId) {
            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
                delete chartInstances[canvasId];
            }
        }

        // Destroy all charts
        function destroyAllCharts() {
            for (const id in chartInstances) {
                chartInstances[id].destroy();
            }
            chartInstances = {};
        }

        // Create fee collection chart (for admin dashboard)
        function createFeeCollectionChart(canvasId, classNames, expectedData, collectedData) {
            return createBarChart(canvasId, classNames, [
                {
                    label: 'Expected (M RWF)',
                    data: expectedData,
                    backgroundColor: 'rgba(26, 58, 92, 0.5)',
                    borderRadius: 6
                },
                {
                    label: 'Collected (M RWF)',
                    data: collectedData,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderRadius: 6
                }
            ], {
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Millions RWF' } } }
            });
        }

        // Create class performance comparison chart
        function createClassPerformanceChart(canvasId, classNames, term1Data, term2Data, term3Data) {
            return createLineChart(canvasId, classNames, [
                { label: 'Term 1', data: term1Data, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Term 2', data: term2Data, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Term 3', data: term3Data, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3 }
            ], {
                scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Average %' } } }
            });
        }

        // Create monthly collection trend chart
        function createMonthlyTrendChart(canvasId, months, amounts) {
            return createLineChart(canvasId, months, [{
                label: 'Collected (RWF)',
                data: amounts,
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.15)',
                fill: true,
                tension: 0.4
            }], {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmtCurrency(v) } } }
            });
        }

        // fmtCurrency: see Section 4.1


        // ──────────────────────────────────────────────────────────────────────
        // 4.6 — Print & Logo
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Generate a school-branded header HTML for any printable page.
         * Includes logo, school name, report title, subtitle and date.
         */
        function buildPrintHeader(title) {
            const s = state.schoolSettings || {};
            const logo = s.school_logo || '';
            const logoHtml = getSchoolLogoHtml(logo, '64px');
            const today = new Date().toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric' });
            return `<div style="display:flex;align-items:center;gap:16px;padding:10px 0 10px;border-bottom:2.5px solid #1a3a5c;margin-bottom:14px;page-break-inside:avoid">
                        <div style="flex-shrink:0">${logoHtml}</div>
                        <div style="flex:1;text-align:center;line-height:1.4">
                            <div style="font-size:1.2rem;font-weight:800;color:#1a3a5c;letter-spacing:.3px">${esc(s.school_name || 'ECOLE LA FONTAINE')}</div>
                            ${s.school_motto ? `<div style="font-size:.8rem;font-style:italic;color:#64748b">"${esc(s.school_motto)}"</div>` : ''}
                            ${s.school_address ? `<div style="font-size:.75rem;color:#64748b">${esc(s.school_address)}</div>` : ''}
                            ${s.school_phone ? `<div style="font-size:.75rem;color:#64748b">Tel: ${esc(s.school_phone)}</div>` : ''}
                            ${title ? `<div style="font-size:.95rem;font-weight:700;color:#1a3a5c;margin-top:5px;padding-top:5px;border-top:1px solid #e2e8f0">${esc(title)}</div>` : ''}
                        </div>
                        <div style="flex-shrink:0;text-align:right;font-size:.72rem;color:#64748b;line-height:1.6">
                            <div>${today}</div>
                            ${state.currentTerm?.name ? `<div>${esc(state.currentTerm.name)}</div>` : ''}
                            ${state.currentAcadYear?.name ? `<div>${esc(state.currentAcadYear.name)}</div>` : ''}
                        </div>
                    </div>`;
        }


        /**
         * Inject the school logo into every logo container in the DOM.
         * Accepts base64 data URLs or HTTPS URLs.
         */
        function applySchoolLogo(logoData) {
            if (!logoData) return;
            const logoElements = document.querySelectorAll('.sidebar-logo, .report-logo');
            logoElements.forEach(el => {
                if (logoData.startsWith('data:image')) {
                    el.innerHTML = `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;">`;
                } else if (logoData.startsWith('http')) {
                    el.innerHTML = `<img src="${logoData}" alt="School Logo" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='🏫'">`;
                } else {
                    el.innerHTML = logoData;
                }
            });
        }


        /**
         * Re-apply the logo after navigation (in case new containers were rendered).
         */
        function applyLogoEverywhere() {
            const logo = state.schoolSettings?.school_logo || '';
            if (!logo) return;
            const isImg = logo.startsWith('data:') || logo.startsWith('http');
            const bigHtml = isImg ? `<img src="${logo}" style="width:58px;height:58px;object-fit:contain;border-radius:50%">` : `<span style="font-size:42px">${logo}</span>`;
            const smallHtml = isImg ? `<img src="${logo}" style="width:34px;height:34px;object-fit:contain;border-radius:50%">` : `<span style="font-size:26px">${logo}</span>`;
            const loginBox = document.querySelector('#login-page .logo-box');
            if (loginBox) loginBox.innerHTML = bigHtml;
            const sidebarLogo = document.getElementById('sidebar-logo');
            if (sidebarLogo) sidebarLogo.innerHTML = smallHtml;
            document.querySelectorAll('.report-logo,.receipt-logo,.print-logo').forEach(el => { el.innerHTML = bigHtml; });
        }



        // ──────────────────────────────────────────────────────────────────────
        // 4.7 — UI Helpers
        // ──────────────────────────────────────────────────────────────────────


        /**
         * Show a quick DB record count summary modal (accessible from the top bar).
         */
        async function showApiDataSummary() {
            const { state } = await import('../core/state.js');
            const { showModal, closeModal } = await import('../ui/modals.js');
            const { exportToExcel } = await import('../core/utils.js');

            const tables = [
                ['students', state.students],
                ['teachers', state.teachers],
                ['classes', state.classes],
                ['subjects', state.subjects],
                ['terms', state.terms],
                ['academic_years', state.academicYears],
                ['assessments', state.assessments],
                ['marks', state.marks],
                ['payments', state.payments],
                ['fee_categories', state.feeCategories],
                ['student_fees', state.studentFees],
                ['families', state.families]
            ];

            const total = tables.reduce((sum, [, arr]) => sum + (arr?.length || 0), 0);

            const rows = tables.map(([name, arr]) => {
                const count = arr?.length ?? '—';
                return `<tr><td><code>${name}</code></td><td style="text-align:right;font-weight:600">${count}</td></tr>`;
            }).join('');

            showModal(`<div class="modal-overlay"><div class="modal" style="max-width:480px">
                <div class="modal-header"><h3>📊 Database Summary</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button></div>
                <div class="modal-body">
                    <div class="table-wrapper">
                        <table class="data-table" style="font-size:.85rem">
                            <thead><tr><th>Table</th><th style="text-align:right">Records</th></tr></thead>
                            <tbody>${rows}</tbody>
                            <tfoot><tr style="font-weight:700;background:var(--bg-tertiary)">
                                <td>TOTAL</td><td style="text-align:right">${total.toLocaleString()}</td>
                            </tr></tfoot>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="window._exportApiSummary && window._exportApiSummary()">📥 Export</button>
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div></div>`);

            window._exportApiSummary = () => {
                const data = tables.map(([name, arr]) => ({ Table: name, Count: arr?.length ?? 0 }));
                exportToExcel(data, 'DB_Summary_' + new Date().toISOString().slice(0, 10));
            };
        }



        // ══════════════════════════════════════════════════════════════════════════
        // SECTION 5 — ACADEMIC FORMULAS
