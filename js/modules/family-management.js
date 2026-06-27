// Create/edit/merge/split families, auto-detect siblings, discounts
        // ════════════════════════════════════════════════════════════════════════

        function switchFamilyTab(tabName, event) {
            const tabs = ['list', 'unlinked', 'detected', 'statistics'];
            for (const t of tabs) {
                const el = document.getElementById(`family-${t}-tab`);
                if (el) el.style.display = t === tabName ? 'block' : 'none';
            }
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (event && event.target) event.target.classList.add('active');
        }

        function renderFamilyList(families) {
            const tbody = document.getElementById('family-list-tbody');
            const search = document.getElementById('family-search')?.value.toLowerCase() || '';
            const statusFilter = document.getElementById('family-status-filter')?.value;

            let filtered = [...families];

            if (search) {
                filtered = filtered.filter(f =>
                    f.family.family_code.toLowerCase().includes(search) ||
                    (f.family.guardian_name || '').toLowerCase().includes(search) ||
                    (f.family.guardian_phone || '').includes(search)
                );
            }

            if (statusFilter === 'has_balance') {
                filtered = filtered.filter(f => f.outstanding > 0);
            } else if (statusFilter === 'paid') {
                filtered = filtered.filter(f => f.outstanding === 0 && f.totalFees > 0);
            } else if (statusFilter === 'has_credit') {
                filtered = filtered.filter(f => f.totalCredit > 0);
            }

            const countSpan = document.getElementById('family-count');
            if (countSpan) countSpan.textContent = `${filtered.length} famil${filtered.length !== 1 ? 'ies' : 'y'}`;

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">No families found</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(f => {
                const rateClass = f.collectionRate >= 90 ? 'badge-success' : f.collectionRate >= 50 ? 'badge-warning' : 'badge-danger';
                const outstandingClass = f.outstanding > 0 ? 'text-danger' : '';

                return `
            <tr>
                <td><code><strong>${esc(f.family.family_code)}</strong></code></span>
                <td>${esc(f.family.guardian_name || '—')}</span>
                <td>${esc(f.family.guardian_phone || '—')}</span>
                <td style="text-align:center">${f.studentCount}</span>
                <td style="text-align:right">${fmtCurrency(f.totalFees)}</span>
                <td style="text-align:right">${fmtCurrency(f.totalPaid)}</span>
                <td style="text-align:right" class="${outstandingClass}">${fmtCurrency(f.outstanding)}</span>
                <td style="text-align:center"><span class="badge ${rateClass}">${f.collectionRate.toFixed(1)}%</span></span>
                <td style="text-align:center">
                    <div class="btn-group" style="gap:4px; justify-content:center">
                        <button class="btn btn-sm btn-outline" onclick="window.viewFamilyDetails(${f.family.id})" title="View Details">👁️</button>
                        <button class="btn btn-sm btn-outline" onclick="window.editFamily(${f.family.id})" title="Edit">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteFamily(${f.family.id}, '${esc(f.family.family_code)}')" title="Delete">🗑️</button>
                        <button class="btn btn-sm btn-primary" onclick="window.applyFamilyDiscount(${f.family.id})" title="Apply Discount">💰</button>
                    </div>
                </span>
            </tr>
        `;
            }).join('');
        }

        async function filterFamilyList() {
            const families = state.families || [];
            const students = state.students || [];

            const summaries = [];
            for (const family of families) {
                const familyStudents = students.filter(s => s.family_id === family.id && s.status === 'Active');
                let totalFees = 0, totalPaid = 0, totalCredit = 0;

                for (const student of familyStudents) {
                    const balance = await getFullStudentBalance(student.id);
                    const credit = getStudentCreditBalance(student.id);
                    totalFees += balance.total;
                    totalPaid += balance.paid;
                    totalCredit += credit.available;
                }

                summaries.push({
                    family: family,
                    students: familyStudents,
                    studentCount: familyStudents.length,
                    totalFees: totalFees,
                    totalPaid: totalPaid,
                    outstanding: totalFees - totalPaid,
                    totalCredit: totalCredit,
                    collectionRate: totalFees > 0 ? (totalPaid / totalFees) * 100 : 100
                });
            }

            renderFamilyList(summaries);
        }

        async function renderUnlinkedStudents() {
            const tbody = document.getElementById('unlinked-students-tbody');
            const unlinkedStudents = state.students.filter(s => !s.family_id && s.status === 'Active')
                .sort((a, b) => a.last_name.localeCompare(b.last_name));

            if (unlinkedStudents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No unlinked students found</td></tr>';
                return;
            }

            const rows = [];
            for (const s of unlinkedStudents) {
                const balance = await getFullStudentBalance(s.id);
                const cls = getClassById(s.class_id);

                rows.push(`
            <tr>
                <td style="text-align:center"><input type="checkbox" class="unlinked-cb" data-id="${s.id}" data-name="${esc(s.first_name)} ${esc(s.last_name)}"></span>
                <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                <td>${esc(s.student_code || '—')}</span>
                <td>${esc(cls?.name || '—')}</span>
                <td>${esc(s.guardian_name || '—')}</span>
                <td>${esc(s.guardian_phone || '—')}</span>
                <td>${fmtCurrency(balance.balance)}</span>
                <td style="text-align:center">
                    <button class="btn btn-sm btn-primary" onclick="window.addStudentToFamily(${s.id}, '${esc(s.first_name)} ${esc(s.last_name)}')">🔗 Link</button>
                </span>
            </tr>
        `);
            }
            tbody.innerHTML = rows.join('');
        }

        function filterUnlinkedStudents() {
            const search = document.getElementById('unlinked-search')?.value.toLowerCase();
            const rows = document.querySelectorAll('#unlinked-students-tbody tr');

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = !search || text.includes(search) ? '' : 'none';
            });
        }

        function toggleSelectAllUnlinked() {
            const selectAll = document.getElementById('select-all-unlinked')?.checked || false;
            document.querySelectorAll('.unlinked-cb').forEach(cb => cb.checked = selectAll);
        }

        async function bulkLinkSelected() {
            const selected = [];
            document.querySelectorAll('.unlinked-cb:checked').forEach(cb => {
                selected.push({
                    id: parseInt(cb.dataset.id),
                    name: cb.dataset.name
                });
            });

            if (selected.length === 0) {
                showToast('No students selected', 'warning');
                return;
            }

            // Get or create family
            const familyCode = prompt(`Create a new family for ${selected.length} student(s)?\nEnter family code (or leave empty to select existing):`, `FAM-${Date.now().toString().slice(-6)}`);

            let familyId = null;

            if (familyCode && familyCode.trim()) {
                // Create new family
                const newFamily = await insert('families', {
                    family_code: familyCode.trim().toUpperCase(),
                    guardian_name: selected.length === 1 ? prompt(`Guardian name for ${selected[0].name}:`) || selected[0].name.split(' ')[0] : 'Family',
                    created_at: new Date().toISOString()
                });
                familyId = newFamily?.id;
            } else {
                // Select existing family
                const families = state.families || [];
                const familySelect = await showFamilySelectModal(families);
                if (!familySelect) return;
                familyId = familySelect;
            }

            if (!familyId) {
                showToast('Failed to create/select family', 'error');
                return;
            }

            let linked = 0;
            for (const student of selected) {
                await update('students', student.id, { family_id: familyId, updated_at: new Date().toISOString() });
                linked++;
            }

            await refreshTable('students');
            await refreshTable('families');
            showToast(`✅ Linked ${linked} student(s) to family`, 'success');

            // Refresh all views
            filterFamilyList();
            renderUnlinkedStudents();
            autoDetectFamilies();
        }

        async function showFamilySelectModal(families) {
            return new Promise((resolve) => {
                const modalId = 'family-select-modal';
                const html = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Select Family</h3>
                        <button class="modal-close" onclick="closeModal('${modalId}')">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Choose Family</label>
                            <select id="family-select-dropdown" class="form-control">
                                <option value="">-- Select Family --</option>
                                ${families.map(f => `<option value="${f.id}">${esc(f.family_code)} - ${esc(f.guardian_name || 'No guardian')}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="closeModal('${modalId}'); resolve(null)">Cancel</button>
                        <button class="btn btn-primary" onclick="closeModal('${modalId}'); resolve(document.getElementById('family-select-dropdown').value)">Select</button>
                    </div>
                </div>
            </div>
        `;

                showModal(html);
                window.resolve = resolve;
            });
        }

        async function autoDetectFamilies() {
            const container = document.getElementById('detected-groups-container');
            const unlinkedStudents = state.students.filter(s => !s.family_id && s.status === 'Active');

            // Group by guardian name
            const groups = new Map();
            for (const student of unlinkedStudents) {
                const key = (student.guardian_name || '').toLowerCase().trim();
                if (key && key !== '') {
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(student);
                }
            }

            // Filter groups with 2+ students
            const detectedGroups = Array.from(groups.values()).filter(g => g.length > 1);

            if (detectedGroups.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No potential family groups detected. Students with the same guardian name will appear here.</div>';
                return;
            }

            container.innerHTML = detectedGroups.map((group, idx) => `
        <div class="dash-card" style="margin-bottom:16px">
            <div class="dash-card-header">
                <span class="dash-card-title">👨‍👩‍👧 Group ${idx + 1}: ${esc(group[0].guardian_name)}</span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="window.createFamilyFromGroup(${JSON.stringify(group.map(s => s.id).join(','))})">🏠 Create Family</button>
                </div>
            </div>
            <div class="dash-card-body">
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr><th>Student Name</th><th>Student Code</th><th>Class</th><th>Phone</th></tr>
                        </thead>
                        <tbody>
                            ${group.map(s => {
                const cls = getClassById(s.class_id);
                return `
                                    <tr>
                                        <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></span>
                                        <td>${esc(s.student_code || '—')}</span>
                                        <td>${esc(cls?.name || '—')}</span>
                                        <td>${esc(s.guardian_phone || '—')}</span>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `).join('');
        }

        async function createFamilyFromGroup(studentIdsStr) {
            const studentIds = studentIdsStr.split(',').map(Number);
            const students = studentIds.map(id => getStudentById(id)).filter(Boolean);

            if (students.length < 2) return;

            const familyCode = `FAM-${Date.now().toString().slice(-6)}`;
            const guardianName = students[0].guardian_name || 'Family';
            const guardianPhone = students[0].guardian_phone || '';

            const newFamily = await insert('families', {
                family_code: familyCode,
                guardian_name: guardianName,
                guardian_phone: guardianPhone,
                created_at: new Date().toISOString()
            });

            if (newFamily) {
                for (const s of students) {
                    await update('students', s.id, { family_id: newFamily.id });
                }
                await refreshTable('students');
                await refreshTable('families');
                showToast(`✅ Created family ${familyCode} with ${students.length} students`, 'success');
                filterFamilyList();
                renderUnlinkedStudents();
                autoDetectFamilies();
            }
        }

        function openCreateFamilyModal() {
            const unlinkedStudents = state.students.filter(s => !s.family_id && s.status === 'Active');

            document.getElementById('family-form-title').textContent = 'Create Family';
            document.getElementById('family-code').value = `FAM-${Date.now().toString().slice(-6)}`;
            document.getElementById('family-guardian').value = '';
            document.getElementById('family-phone').value = '';
            document.getElementById('family-email').value = '';
            document.getElementById('family-address').value = '';
            document.getElementById('family-discount').value = '0';

            const memberContainer = document.getElementById('family-member-select');
            memberContainer.innerHTML = unlinkedStudents.map(s => `
        <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer">
            <input type="checkbox" class="family-member-cb" value="${s.id}">
            <span><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong> (${esc(s.student_code || 'No code')})</span>
        </label>
    `).join('') || '<div style="text-align:center;padding:20px;color:var(--text-muted)">No unlinked students available</div>';

            document.getElementById('family-form-modal').style.display = 'flex';
        }

        async function saveFamily() {
            const familyId = window._editingFamilyId;
            const code = document.getElementById('family-code')?.value.trim().toUpperCase();
            const guardian = document.getElementById('family-guardian')?.value;
            const phone = document.getElementById('family-phone')?.value;
            const email = document.getElementById('family-email')?.value;
            const address = document.getElementById('family-address')?.value;
            const discount = parseFloat(document.getElementById('family-discount')?.value) || 0;

            if (!code) {
                showToast('Family code is required', 'warning');
                return;
            }

            const selectedMembers = [...document.querySelectorAll('.family-member-cb:checked')].map(cb => parseInt(cb.value));

            let result;
            if (familyId) {
                result = await update('families', familyId, {
                    family_code: code,
                    guardian_name: guardian,
                    guardian_phone: phone,
                    guardian_email: email,
                    address: address,
                    discount_amount: discount,
                    updated_at: new Date().toISOString()
                });
            } else {
                result = await insert('families', {
                    family_code: code,
                    guardian_name: guardian,
                    guardian_phone: phone,
                    guardian_email: email,
                    address: address,
                    discount_amount: discount,
                    created_at: new Date().toISOString()
                });
                familyId = result?.id;
            }

            if (!result) {
                showToast('Failed to save family', 'error');
                return;
            }

            // Link selected members
            for (const memberId of selectedMembers) {
                await update('students', memberId, { family_id: familyId });
            }

            await refreshTable('families');
            await refreshTable('students');

            closeModal('family-form-modal');
            showToast(`✅ Family ${familyId ? 'updated' : 'created'} successfully`, 'success');

            filterFamilyList();
            renderUnlinkedStudents();
            autoDetectFamilies();

            window._editingFamilyId = null;
        }

        async function editFamily(familyId) {
            const family = state.families.find(f => f.id === familyId);
            if (!family) return;

            const familyStudents = state.students.filter(s => s.family_id === familyId);
            const allUnlinked = state.students.filter(s => !s.family_id && s.status === 'Active');

            document.getElementById('family-form-title').textContent = 'Edit Family';
            document.getElementById('family-code').value = family.family_code;
            document.getElementById('family-guardian').value = family.guardian_name || '';
            document.getElementById('family-phone').value = family.guardian_phone || '';
            document.getElementById('family-email').value = family.guardian_email || '';
            document.getElementById('family-address').value = family.address || '';
            document.getElementById('family-discount').value = family.discount_amount || 0;

            const memberContainer = document.getElementById('family-member-select');
            memberContainer.innerHTML = `
        <div style="padding:6px; background:var(--bg-tertiary); margin-bottom:8px; border-radius:6px">
            <strong>Current Members (${familyStudents.length})</strong>
        </div>
        ${familyStudents.map(s => `
            <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer; background:var(--info-bg); margin-bottom:4px; border-radius:4px">
                <input type="checkbox" class="family-member-cb" value="${s.id}" checked>
                <span><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong> (${esc(s.student_code || 'No code')})</span>
            </label>
        `).join('')}
        ${allUnlinked.length > 0 ? `
            <div style="padding:6px; background:var(--bg-tertiary); margin:8px 0; border-radius:6px">
                <strong>Available to Add (${allUnlinked.length})</strong>
            </div>
            ${allUnlinked.map(s => `
                <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer">
                    <input type="checkbox" class="family-member-cb" value="${s.id}">
                    <span><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong> (${esc(s.student_code || 'No code')})</span>
                </label>
            `).join('')}
        ` : ''}
    `;

            window._editingFamilyId = familyId;
            document.getElementById('family-form-modal').style.display = 'flex';
        }

        async function deleteFamily(familyId, familyCode) {
            const familyStudents = state.students.filter(s => s.family_id === familyId);
            const warning = familyStudents.length > 0
                ? `Family "${familyCode}" has ${familyStudents.length} student(s). They will become unlinked. Continue?`
                : `Delete family "${familyCode}"?`;

            if (!await confirmDialog(warning)) return;

            // Unlink all students
            for (const student of familyStudents) {
                await update('students', student.id, { family_id: null });
            }

            await remove('families', familyId);
            await refreshTable('families');
            await refreshTable('students');

            showToast(`✅ Family "${familyCode}" deleted`, 'success');
            filterFamilyList();
            renderUnlinkedStudents();
            autoDetectFamilies();
        }

        async function viewFamilyDetails(familyId) {
            const family = state.families.find(f => f.id === familyId);
            if (!family) return;

            const members = state.students.filter(s => s.family_id === familyId && s.status === 'Active');
            let totalFees = 0, totalPaid = 0;
            const memberDetails = [];

            for (const member of members) {
                const balance = await getFullStudentBalance(member.id);
                const credit = getStudentCreditBalance(member.id);
                const cls = getClassById(member.class_id);
                totalFees += balance.total;
                totalPaid += balance.paid;

                memberDetails.push({
                    student: member,
                    class: cls,
                    balance: balance,
                    credit: credit
                });
            }

            const outstanding = totalFees - totalPaid;
            const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 100;

            // Get payment history for all family members
            const allPayments = [];
            for (const member of members) {
                const payments = state.payments.filter(p => p.student_id === member.id);
                for (const payment of payments) {
                    allPayments.push({
                        ...payment,
                        studentName: `${member.first_name} ${member.last_name}`
                    });
                }
            }
            allPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const modal = document.getElementById('family-details-modal');
            const title = document.getElementById('family-details-title');
            const content = document.getElementById('family-details-content');

            title.innerHTML = `👨‍👩‍👧 Family Details - ${esc(family.family_code)}`;

            content.innerHTML = `
        <div class="form-grid" style="margin-bottom:16px">
            <div class="form-group"><label>Family Code</label><input readonly value="${esc(family.family_code)}" class="form-control"></div>
            <div class="form-group"><label>Guardian Name</label><input readonly value="${esc(family.guardian_name || '—')}" class="form-control"></div>
            <div class="form-group"><label>Guardian Phone</label><input readonly value="${esc(family.guardian_phone || '—')}" class="form-control"></div>
            <div class="form-group"><label>Guardian Email</label><input readonly value="${esc(family.guardian_email || '—')}" class="form-control"></div>
            <div class="form-group full"><label>Address</label><input readonly value="${esc(family.address || '—')}" class="form-control"></div>
            <div class="form-group"><label>Discount Amount</label><input readonly value="${fmtCurrency(family.discount_amount || 0)}" class="form-control"></div>
        </div>
        
        <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px; margin-bottom:16px">
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; text-align:center">
                <div><div style="font-size:11px; color:var(--text-muted)">Total Fees</div><div style="font-size:18px; font-weight:700">${fmtCurrency(totalFees)}</div></div>
                <div><div style="font-size:11px; color:var(--text-muted)">Total Paid</div><div style="font-size:18px; font-weight:700; color:var(--success)">${fmtCurrency(totalPaid)}</div></div>
                <div><div style="font-size:11px; color:var(--text-muted)">Outstanding</div><div style="font-size:18px; font-weight:700; ${outstanding > 0 ? 'color:var(--danger)' : ''}">${fmtCurrency(outstanding)}</div></div>
                <div><div style="font-size:11px; color:var(--text-muted)">Collection Rate</div><div style="font-size:18px; font-weight:700">${collectionRate.toFixed(1)}%</div></div>
            </div>
            <div style="margin-top:8px; background:var(--border-light); border-radius:99px; height:6px; overflow:hidden">
                <div style="width:${collectionRate}%; height:100%; background:var(--role-primary); border-radius:99px"></div>
            </div>
        </div>
        
        <h4>👥 Family Members (${members.length})</h4>
        <div class="table-wrapper" style="margin-bottom:20px">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Student Code</th>
                        <th>Class</th>
                        <th style="text-align:right">Total Fees</th>
                        <th style="text-align:right">Paid</th>
                        <th style="text-align:right">Balance</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${memberDetails.map(d => `
                        <tr>
                            <td><strong>${esc(d.student.first_name)} ${esc(d.student.last_name)}</strong></span>
                            <td>${esc(d.student.student_code || '—')}</span>
                            <td>${esc(d.class?.name || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(d.balance.total)}</span>
                            <td style="text-align:right">${fmtCurrency(d.balance.paid)}</span>
                            <td style="text-align:right; ${d.balance.balance > 0 ? 'color:var(--danger); font-weight:600' : ''}">${fmtCurrency(d.balance.balance)}</span>
                            <td style="text-align:center"><span class="badge ${d.balance.balance === 0 ? 'badge-success' : (d.balance.paid > 0 ? 'badge-warning' : 'badge-danger')}">${d.balance.balance === 0 ? '✅ Paid' : (d.balance.paid > 0 ? '⚠️ Partial' : '🔴 Due')}</span></span>
                            <td style="text-align:center">
                                <button class="btn btn-sm btn-outline" onclick="window.removeStudentFromFamily(${d.student.id}, '${esc(d.student.first_name)} ${esc(d.student.last_name)}')" title="Remove from Family">🚫</button>
                            </span>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <h4>📜 Family Payment History</h4>
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Student</th>
                        <th>Receipt #</th>
                        <th style="text-align:right">Amount</th>
                        <th>Method</th>
                    </tr>
                </thead>
                <tbody>
                    ${allPayments.length ? allPayments.map(p => `
                        <tr>
                            <td>${fmtDate(p.payment_date || p.created_at)}</span>
                            <td>${esc(p.studentName)}</span>
                            <td><code>${esc(p.receipt_number || '—')}</code></span>
                            <td style="text-align:right">${fmtCurrency(p.amount)}</span>
                            <td>${esc(p.payment_method || '—')}</span>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No payment history</span>'}
                </tbody>
            </table>
        </div>
        
        <div class="btn-group" style="margin-top:16px">
            <button class="btn btn-sm btn-outline" onclick="window.addStudentToFamilyPrompt(${familyId})">➕ Add Student</button>
            <button class="btn btn-sm btn-warning" onclick="window.mergeFamilies(${familyId})">🔄 Merge with Another Family</button>
        </div>
    `;

            modal.style.display = 'flex';
            window._currentFamilyDetails = { family, members, totalFees, totalPaid, outstanding, collectionRate, allPayments };
        }

        function addStudentToFamilyPrompt(familyId) {
            const unlinkedStudents = state.students.filter(s => !s.family_id && s.status === 'Active');
            if (unlinkedStudents.length === 0) {
                showToast('No unlinked students available', 'warning');
                return;
            }

            showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>➕ Add Student to Family</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Select Student</label>
                        <select id="add-student-select" class="form-control">
                            <option value="">-- Select Student --</option>
                            ${unlinkedStudents.map(s => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.student_code || '')})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.addStudentToFamily(document.getElementById('add-student-select').value, '', ${familyId})">Add</button>
                </div>
            </div>
        </div>
    `);
        }

        async function addStudentToFamily(studentId, studentName, familyId) {
            if (!studentId) {
                showToast('Please select a student', 'warning');
                return;
            }

            await update('students', studentId, { family_id: familyId });
            await refreshTable('students');
            showToast(`✅ Student added to family`, 'success');
            closeModal();
            viewFamilyDetails(familyId);
            filterFamilyList();
            renderUnlinkedStudents();
        }

        async function removeStudentFromFamily(studentId, studentName) {
            if (!await confirmDialog(`Remove ${studentName} from this family?`)) return;

            await update('students', studentId, { family_id: null });
            await refreshTable('students');
            showToast(`✅ ${studentName} removed from family`, 'success');

            const familyId = state.students.find(s => s.id === studentId)?.family_id;
            if (familyId) viewFamilyDetails(familyId);
            filterFamilyList();
            renderUnlinkedStudents();
        }

        async function mergeFamilies(sourceFamilyId) {
            const families = state.families.filter(f => f.id !== sourceFamilyId);
            if (families.length === 0) {
                showToast('No other families to merge with', 'warning');
                return;
            }

            showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>🔄 Merge Families</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Select Target Family (students will move to this family)</label>
                        <select id="target-family-select" class="form-control">
                            <option value="">-- Select Family --</option>
                            ${families.map(f => `<option value="${f.id}">${esc(f.family_code)} - ${esc(f.guardian_name || 'No guardian')}</option>`).join('')}
                        </select>
                    </div>
                    <div class="alert alert-warning" style="margin-top:12px">
                        ⚠️ All students from the source family will be moved to the target family.
                        The source family will be deleted.
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-warning" onclick="window.executeMergeFamilies(${sourceFamilyId})">Merge Families</button>
                </div>
            </div>
        </div>
    `);
        }

        async function executeMergeFamilies(sourceFamilyId) {
            const targetFamilyId = parseInt(document.getElementById('target-family-select')?.value);
            if (!targetFamilyId) {
                showToast('Please select a target family', 'warning');
                return;
            }

            const sourceFamily = state.families.find(f => f.id === sourceFamilyId);
            const targetFamily = state.families.find(f => f.id === targetFamilyId);
            const studentsToMove = state.students.filter(s => s.family_id === sourceFamilyId);

            if (!await confirmDialog(`Move ${studentsToMove.length} student(s) from ${sourceFamily?.family_code} to ${targetFamily?.family_code}?`)) return;

            for (const student of studentsToMove) {
                await update('students', student.id, { family_id: targetFamilyId });
            }

            await remove('families', sourceFamilyId);
            await refreshTable('families');
            await refreshTable('students');

            closeModal();
            showToast(`✅ Merged ${sourceFamily?.family_code} into ${targetFamily?.family_code}`, 'success');
            filterFamilyList();
            renderUnlinkedStudents();
            autoDetectFamilies();
        }

        async function applyFamilyDiscount(familyId) {
            const family = state.families.find(f => f.id === familyId);
            if (!family || !family.discount_amount) {
                showToast('No discount configured for this family', 'warning');
                return;
            }

            const members = state.students.filter(s => s.family_id === familyId && s.status === 'Active');
            if (members.length === 0) {
                showToast('No active students in this family', 'warning');
                return;
            }

            if (!await confirmDialog(`Apply ${fmtCurrency(family.discount_amount)} discount to ${members.length} student(s) in family ${family.family_code}?`)) return;

            let applied = 0;
            for (const student of members) {
                await insert('student_fees', {
                    student_id: student.id,
                    fee_category_id: null,
                    term_id: state.currentTerm?.id,
                    academic_year_id: state.currentAcadYear?.id,
                    amount: -family.discount_amount,
                    paid_amount: family.discount_amount,
                    is_paid: true,
                    is_waived: false,
                    is_discount: true,
                    discount_reason: `Family discount - ${family.family_code}`,
                    created_at: new Date().toISOString()
                });
                applied++;
            }

            await refreshTable('student_fees');
            showToast(`✅ Applied discount to ${applied} student(s)`, 'success');
            filterFamilyList();
        }

        async function exportFamiliesData() {
            const families = state.families || [];
            const data = [];
            for (const family of families) {
                const members = state.students.filter(s => s.family_id === family.id);
                let totalFees = 0, totalPaid = 0;

                for (const member of members) {
                    const balance = await getFullStudentBalance(member.id);
                    totalFees += balance.total;
                    totalPaid += balance.paid;
                }

                data.push({
                    'Family Code': family.family_code,
                    'Guardian Name': family.guardian_name || '',
                    'Guardian Phone': family.guardian_phone || '',
                    'Guardian Email': family.guardian_email || '',
                    'Address': family.address || '',
                    'Number of Students': members.length,
                    'Total Fees (RWF)': totalFees,
                    'Total Paid (RWF)': totalPaid,
                    'Outstanding (RWF)': totalFees - totalPaid,
                    'Discount Amount (RWF)': family.discount_amount || 0,
                    'Created': fmtDate(family.created_at)
                });
            }

            exportToExcel(data, `Families_Export_${new Date().toISOString().split('T')[0]}`);
            showToast('✅ Families exported', 'success');
        }

        function printFamilyStatement() {
            const data = window._currentFamilyDetails;
            if (!data) {
                showToast('No family data to print', 'warning');
                return;
            }

            const school = state.schoolSettings || {};
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Family Statement - ${data.family.family_code}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}
                h1{text-align:center;color:#1a3a5c}
                .header{text-align:center;margin-bottom:30px}
                .info{display:flex;justify-content:space-between;margin-bottom:20px;padding:10px;background:#f0f0f0;border-radius:8px}
                table{width:100%;border-collapse:collapse;margin:15px 0}
                th,td{border:1px solid #ccc;padding:8px;text-align:left}
                th{background:#1a3a5c;color:white}
                .total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px;padding:10px;background:#d1fae5;border-radius:8px}
                .footer{text-align:center;margin-top:30px;font-size:11px;color:#666}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏫 ${esc(school.school_name || 'ECOLE LA FONTAINE')}</h1>
                <h3>FAMILY FEE STATEMENT</h3>
            </div>
            <div class="info">
                <div><strong>Family Code:</strong> ${data.family.family_code}</div>
                <div><strong>Guardian:</strong> ${esc(data.family.guardian_name || '—')}</div>
                <div><strong>Phone:</strong> ${esc(data.family.guardian_phone || '—')}</div>
            </div>
            <div class="info">
                <div><strong>Total Fees:</strong> ${fmtCurrency(data.totalFees)}</div>
                <div><strong>Total Paid:</strong> ${fmtCurrency(data.totalPaid)}</div>
                <div><strong>Outstanding:</strong> ${fmtCurrency(data.outstanding)}</div>
            </div>
            <h3>Member Details</h3>
            <table>
                <thead>
                    <tr><th>Student</th><th>Class</th><th>Total Fees</th><th>Paid</th><th>Balance</th>
                </thead>
                <tbody>
                    ${data.members.map(m => `
                        <tr>
                            <td>${esc(m.student.first_name)} ${esc(m.student.last_name)}</span>
                            <td>${esc(getClassById(m.student.class_id)?.name || '—')}</span>
                            <td style="text-align:right">${fmtCurrency(m.balance.total)}</span>
                            <td style="text-align:right">${fmtCurrency(m.balance.paid)}</span>
                            <td style="text-align:right">${fmtCurrency(m.balance.balance)}</span>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <h3>Payment History</h3>
            <table><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Receipt #</th></tr></thead>
            <tbody>
                ${data.allPayments.map(p => `
                    <tr>
                        <td>${fmtDate(p.payment_date || p.created_at)}</span>
                        <td>${esc(p.studentName)}</span>
                        <td style="text-align:right">${fmtCurrency(p.amount)}</span>
                        <td>${p.receipt_number || '—'}</span>
                    </tr>
                `).join('')}
            </tbody></table>
            <div class="total">Family Outstanding Balance: ${fmtCurrency(data.outstanding)}</div>
            <div class="footer">Generated on ${new Date().toLocaleString()} | ECOLE LA FONTAINE School Management System</div>
            <script>window.print();setTimeout(window.close,500);<\/script>
        </body>
        </html>
    `);
            printWindow.document.close();
        }

        function exportFamilyDetails() {
            const data = window._currentFamilyDetails;
            if (!data) {
                showToast('No family data to export', 'warning');
                return;
            }

            const memberData = data.members.map(m => ({
                'Family Code': data.family.family_code,
                'Guardian Name': data.family.guardian_name || '',
                'Student Name': `${m.student.first_name} ${m.student.last_name}`,
                'Student Code': m.student.student_code || '',
                'Class': getClassById(m.student.class_id)?.name || '',
                'Total Fees (RWF)': m.balance.total,
                'Paid (RWF)': m.balance.paid,
                'Balance (RWF)': m.balance.balance,
                'Status': m.balance.balance === 0 ? 'Paid' : (m.balance.paid > 0 ? 'Partial' : 'Due')
            }));

            exportToExcel(memberData, `Family_${data.family.family_code}_Details`);
            showToast('✅ Family details exported', 'success');
        }

        async function splitFamily(familyId) {
            const family = state.families.find(f => f.id === familyId);
            const members = state.students.filter(s => s.family_id === familyId);

            if (members.length < 2) {
                showToast('Family must have at least 2 students to split', 'warning');
                return;
            }

            showModal(`
        <div class="modal-overlay">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>✂️ Split Family</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <p>Select students to move to a new family:</p>
                    ${members.map(s => `
                        <label style="display:flex; align-items:center; gap:8px; margin:8px 0">
                            <input type="checkbox" class="split-student-cb" value="${s.id}">
                            <span><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong> (${esc(s.student_code || '')})</span>
                        </label>
                    `).join('')}
                    <div class="form-group" style="margin-top:16px">
                        <label>New Family Code</label>
                        <input type="text" id="new-family-code" class="form-control" placeholder="e.g., FAM-NEW-001">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.executeSplitFamily(${familyId})">Create New Family</button>
                </div>
            </div>
        </div>
    `);
        }

        async function executeSplitFamily(sourceFamilyId) {
            const selectedStudents = [...document.querySelectorAll('.split-student-cb:checked')].map(cb => parseInt(cb.value));
            const newFamilyCode = document.getElementById('new-family-code')?.value.trim().toUpperCase();

            if (selectedStudents.length === 0) {
                showToast('Please select at least one student to move', 'warning');
                return;
            }

            if (!newFamilyCode) {
                showToast('Please enter a family code for the new family', 'warning');
                return;
            }

            const sourceFamily = state.families.find(f => f.id === sourceFamilyId);

            // Create new family
            const newFamily = await insert('families', {
                family_code: newFamilyCode,
                guardian_name: sourceFamily?.guardian_name,
                guardian_phone: sourceFamily?.guardian_phone,
                created_at: new Date().toISOString()
            });

            if (!newFamily) {
                showToast('Failed to create new family', 'error');
                return;
            }

            // Move selected students
            for (const studentId of selectedStudents) {
                await update('students', studentId, { family_id: newFamily.id });
            }

            await refreshTable('families');
            await refreshTable('students');

            closeModal();
            showToast(`✅ Moved ${selectedStudents.length} student(s) to new family ${newFamilyCode}`, 'success');
            filterFamilyList();
            renderUnlinkedStudents();
        }

        function renderFamilyStatistics(familySummaries) {
            const statsContainer = document.getElementById('family-stats-container');

            const totalFamilies = familySummaries.length;
            const totalStudents = familySummaries.reduce((sum, f) => sum + f.studentCount, 0);
            const totalFees = familySummaries.reduce((sum, f) => sum + f.totalFees, 0);
            const totalOutstanding = familySummaries.reduce((sum, f) => sum + f.outstanding, 0);
            const familiesWithBalance = familySummaries.filter(f => f.outstanding > 0).length;
            const avgFamilySize = totalFamilies > 0 ? (totalStudents / totalFamilies).toFixed(1) : 0;
            const avgOutstanding = totalFamilies > 0 ? totalOutstanding / totalFamilies : 0;

            statsContainer.innerHTML = `
        <div class="stat-card"><div class="stat-icon">🏠</div><div class="stat-value">${totalFamilies}</div><div class="stat-label">Total Families</div></div>
        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${totalStudents}</div><div class="stat-label">Total Students</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmtCurrency(totalFees)}</div><div class="stat-label">Total Family Fees</div></div>
        <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-value">${fmtCurrency(totalOutstanding)}</div><div class="stat-label">Total Outstanding</div></div>
        <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${avgFamilySize}</div><div class="stat-label">Avg Students/Family</div></div>
        <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value">${familiesWithBalance}</div><div class="stat-label">Families with Balance</div></div>
        <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${fmtCurrency(avgOutstanding)}</div><div class="stat-label">Avg Outstanding/Family</div></div>
        <div class="stat-card"><div class="stat-icon">🎁</div><div class="stat-value">${familySummaries.filter(f => f.family.discount_amount > 0).length}</div><div class="stat-label">Families with Discount</div></div>
    `;

            // Create distribution chart
            setTimeout(() => {
                const ctx = document.getElementById('family-distribution-chart')?.getContext('2d');
                if (ctx) {
                    const ranges = [
                        { label: '0 RWF', count: familySummaries.filter(f => f.outstanding === 0).length, color: '#10b981' },
                        { label: '1 - 50K', count: familySummaries.filter(f => f.outstanding > 0 && f.outstanding <= 50000).length, color: '#f59e0b' },
                        { label: '50K - 100K', count: familySummaries.filter(f => f.outstanding > 50000 && f.outstanding <= 100000).length, color: '#f97316' },
                        { label: '100K+', count: familySummaries.filter(f => f.outstanding > 100000).length, color: '#ef4444' }
                    ];

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ranges.map(r => r.label),
                            datasets: [{
                                label: 'Number of Families',
                                data: ranges.map(r => r.count),
                                backgroundColor: ranges.map(r => r.color),
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Families' } } }
                        }
                    });
                }
            }, 100);
        }


        // ════════════════════════════════════════════════════════════════════════
        // WINDOW EXPOSURE — Extended modules
        // ════════════════════════════════════════════════════════════════════════

        window.addStudentToFamily = addStudentToFamily;
        window.addStudentToFamilyPrompt = addStudentToFamilyPrompt;
        window.addToBatchQueue = addToBatchQueue;
        window.addToExportHistory = addToExportHistory;
        window.applyFamilyDiscount = applyFamilyDiscount;
        window.applyTemplate = applyTemplate;
        window.autoDetectFamilies = autoDetectFamilies;
        window.bulkLinkSelected = bulkLinkSelected;
        window.calculateClassRankings = calculateClassRankings;
        window.calculateGPA = calculateGPA;
        window.calculateOverallRankings = calculateOverallRankings;
        window.calculateStudentRankForYear = calculateStudentRankForYear;
        window.calculateSubjectRankings = calculateSubjectRankings;
        window.cancelBatchGeneration = cancelBatchGeneration;
        window.clearExportHistory = clearExportHistory;
        window.clearQueue = clearQueue;
        window.compareClasses = compareClasses;
        window.copyRankingsTable = copyRankingsTable;
        window.createFamilyFromGroup = createFamilyFromGroup;
        window.deleteFamily = deleteFamily;
        window.downloadAsCombinedPDF = downloadAsCombinedPDF;
        window.downloadAsZip = downloadAsZip;
        window.downloadMarksImportTemplate = downloadMarksImportTemplate;
        window.downloadMarksTemplate = downloadMarksTemplate;
        window.editFamily = editFamily;
        window.executeMarksExport = executeMarksExport;
        window.executeMarksImport = executeMarksImport;
        window.executeMergeFamilies = executeMergeFamilies;
        window.executeSplitFamily = executeSplitFamily;
        window.exportAcademicReport = exportAcademicReport;
        window.exportBatchLog = exportBatchLog;
        window.exportBatchTranscriptList = exportBatchTranscriptList;
        window.exportBatchTranscriptsExcel = exportBatchTranscriptsExcel;
        window.exportClassComparison = exportClassComparison;
        window.exportClassMarksToExcel = exportClassMarksToExcel;
        window.exportComparison = exportComparison;
        window.exportFamiliesData = exportFamiliesData;
        window.exportFamilyDetails = exportFamilyDetails;
        window.exportMarksByAssessment = exportMarksByAssessment;
        window.exportOverallRankings = exportOverallRankings;
        window.exportRankingData = exportRankingData;
        window.exportRegisterNow = exportRegisterNow;
        window.exportRegisterToPDF = exportRegisterToPDF;
        window.exportStudentTranscript = exportStudentTranscript;
        window.exportTranscriptsList = exportTranscriptsList;
        window.filterFamilyList = filterFamilyList;
        window.filterUnlinkedStudents = filterUnlinkedStudents;
        window.formatDate = formatDate;
        window.formatNumber = formatNumber;
        window.generateBatchTranscripts = generateBatchTranscripts;
        window.generateClassComparisonReport = generateClassComparisonReport;
        window.generateCombinedTranscriptsPDF = generateCombinedTranscriptsPDF;
        window.generateComparison = generateComparison;
        window.generateHonorRoll = generateHonorRoll;
        window.generateRegisterData = generateRegisterData;
        window.generateRegisterHTML = generateRegisterHTML;
        window.generateReportHTML = generateReportHTML;
        window.generateSeparateTranscriptsZIP = generateSeparateTranscriptsZIP;
        window.generateSingleReport = generateSingleReport;
        window.generateStudentProgress = generateStudentProgress;
        window.generateSubjectAnalysis = generateSubjectAnalysis;
        window.generateTermSummary = generateTermSummary;
        window.generateTranscript = generateTranscript;
        window.generateTranscriptExcel = generateTranscriptExcel;
        window.generateTranscriptHTML = generateTranscriptHTML;
        window.generateTranscriptPDF = generateTranscriptPDF;
        window.generateTrendReport = generateTrendReport;
        window.getSchoolLogoHtml = getSchoolLogoHtml;
        window.getSelectedStudents = getSelectedStudents;
        window.loadBatchStudents = loadBatchStudents;
        window.loadBatchTranscriptStudents = loadBatchTranscriptStudents;
        window.loadComparisonData = loadComparisonData;
        window.loadExportAssessments = loadExportAssessments;
        window.loadExportStudents = loadExportStudents;
        window.loadPerformanceTrends = loadPerformanceTrends;
        window.loadRankingSettings = loadRankingSettings;
        window.loadRegisterSettings = loadRegisterSettings;
        window.loadReportSettings = loadReportSettings;
        window.loadTemplatePreview = loadTemplatePreview;
        window.loadTranscriptData = loadTranscriptData;
        window.loadTranscriptSettings = loadTranscriptSettings;
        window.loadTrendStudents = loadTrendStudents;
        window.logBatchGeneration = logBatchGeneration;
        window.mergeFamilies = mergeFamilies;
        window.openCreateFamilyModal = openCreateFamilyModal;
        window.openPrintView = openPrintView;
        window.openTranscriptPrintView = openTranscriptPrintView;
        window.previewBatch = previewBatch;
        window.previewMarksImport = previewMarksImport;
        window.previewRegister = previewRegister;
        window.previewTemplateData = previewTemplateData;
        window.previewTranscript = previewTranscript;
        window.printAcademicReport = printAcademicReport;
        window.printFamilyStatement = printFamilyStatement;
        window.printHonorRoll = printHonorRoll;
        window.printMarksReport = printMarksReport;
        window.printRankingReport = printRankingReport;
        window.printTranscriptGuide = printTranscriptGuide;
        window.processQueue = processQueue;
        window.processSingleJob = processSingleJob;
        window.refreshExportHistory = refreshExportHistory;
        window.refreshQueueDisplay = refreshQueueDisplay;
        window.removeJob = removeJob;
        window.removeStudentFromFamily = removeStudentFromFamily;
        window.renderFamilyList = renderFamilyList;
        window.renderFamilyStatistics = renderFamilyStatistics;
        window.renderUnlinkedStudents = renderUnlinkedStudents;
        window.repeatExport = repeatExport;
        window.resetBatchForm = resetBatchForm;
        window.resetRankingSettings = resetRankingSettings;
        window.resetRegisterForm = resetRegisterForm;
        window.resetRegisterSettings = resetRegisterSettings;
        window.resetReportSettings = resetReportSettings;
        window.resetTranscriptForm = resetTranscriptForm;
        window.resetTranscriptSettings = resetTranscriptSettings;
        window.saveFamily = saveFamily;
        window.saveRankingSettings = saveRankingSettings;
        window.saveRegisterSettings = saveRegisterSettings;
        window.saveReportSettings = saveReportSettings;
        window.saveTranscriptSettings = saveTranscriptSettings;
        window.selectAllBatchStudents = selectAllBatchStudents;
        window.selectAllStudents = selectAllStudents;
        window.showBatchQueue = showBatchQueue;
        window.showFamilySelectModal = showFamilySelectModal;
        window.splitFamily = splitFamily;
        window.startBatchGeneration = startBatchGeneration;
        window.switchFamilyTab = switchFamilyTab;
        window.switchMarksIETab = switchMarksIETab;
        window.switchRankingTab = switchRankingTab;
        window.switchRegisterTab = switchRegisterTab;
        window.switchReportTab = switchReportTab;
        window.switchTranscriptTab = switchTranscriptTab;
        window.toggleBatchOptions = toggleBatchOptions;
        window.toggleExportOptions = toggleExportOptions;
        window.toggleSelectAllUnlinked = toggleSelectAllUnlinked;
        window.toggleTranscriptOptions = toggleTranscriptOptions;
        window.uploadCustomTemplate = uploadCustomTemplate;
        window.viewFamilyDetails = viewFamilyDetails;


        // ════════════════════════════════════════════════════════════════════
        // SECTION 97 — NEW FEATURES (v9 Patch)
