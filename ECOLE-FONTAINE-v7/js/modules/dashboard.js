// ============================================================
// DASHBOARD MODULE - Role-specific dashboards
// ============================================================

import { state } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher, isAccountant } from '../core/auth.js';
import { fmtCurrency, fmtPct, getGrade, getGradeClass, formatDate, formatAgo } from '../core/utils.js';
import { getClassById, getStudentById } from '../core/state.js';
import { getAll } from '../core/supabase-client.js';
import { showToast } from '../ui/modals.js';
import { createBarChart, createLineChart, createFeeCollectionChart } from '../ui/charts.js';
import { navigateTo } from '../core/router.js';
import { exportToExcel } from '../core/utils.js';

// Render Admin Dashboard
export async function renderAdminDashboard(container) {
    if (!container) return;

    const students = state.students || [];
    const active = students.filter(s => s.status === 'Active');
    const termObj = state.currentTerm;
    const termAssess = (state.assessments || []).filter(a => a.term_id === termObj?.id);
    const totalMarks = (state.marks || []).length;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const newMarks = (state.marks || []).filter(m => new Date(m.entered_at || m.created_at) >= weekAgo).length;

    // Fee totals
    let totalFees = 0, totalPaid = 0;
    for (const fa of (state.feeAmounts || [])) totalFees += fa.amount;
    for (const p of (state.payments || [])) totalPaid += p.amount;
    const collRate = totalFees > 0 ? Math.round(totalPaid / totalFees * 100) : 0;

    // Activity logs
    let logs = [];
    try { logs = await getAll('activity_logs'); } catch (e) { logs = []; }
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const recent10 = logs.slice(0, 10);

    // Class performance
    const classPerf = (state.classes || []).map(cls => {
        const clsStudents = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');
        const clsAssess = (state.assessments || []).filter(a => a.class_id === cls.id && a.term_id === termObj?.id);
        let totalPct = 0, cnt = 0;
        clsStudents.forEach(st => {
            let score = 0, max = 0;
            clsAssess.forEach(a => {
                const m = (state.marks || []).find(mk => mk.assessment_id === a.id && mk.student_id === st.id);
                if (m) { score += m.score; max += a.max_marks; }
            });
            if (max > 0) { totalPct += (score / max) * 100; cnt++; }
        });
        const avg = cnt > 0 ? totalPct / cnt : 0;
        return { name: cls.name, students: clsStudents.length, avg, grade: getGrade(avg) };
    }).filter(c => c.students > 0);

    // Chart data
    const classNames = (state.classes || []).slice(0, 8).map(c => c.name.substring(0, 3));
    const expectedData = (state.classes || []).slice(0, 8).map(cls =>
        (state.feeAmounts || []).filter(f => f.class_id === cls.id && f.academic_year_id === state.currentAcadYear?.id)
            .reduce((a, f) => a + f.amount, 0) / 1000000
    );
    const collectedData = (state.classes || []).slice(0, 8).map(cls =>
        (state.payments || []).filter(p => {
            const st = getStudentById(p.student_id);
            return st?.class_id === cls.id;
        }).reduce((a, p) => a + p.amount, 0) / 1000000
    );

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${students.length}</div><div class="stat-label">Total Students</div><div class="stat-trend neutral">All enrolled</div></div>
            <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${active.length}</div><div class="stat-label">Active Students</div><div class="stat-trend up">📈 Currently enrolled</div></div>
            <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${termAssess.length}</div><div class="stat-label">Assessments (${state.schoolSettings?.current_term || 'Term 3'})</div><div class="stat-trend neutral">This term</div></div>
            <div class="stat-card"><div class="stat-icon">✏️</div><div class="stat-value">${totalMarks}</div><div class="stat-label">Total Marks in DB</div><div class="stat-trend up">+${newMarks} this week</div></div>
            <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmtCurrency(totalPaid)}</div><div class="stat-label">Collected Fees</div><div class="stat-trend ${collRate >= 70 ? 'up' : 'down'}">${collRate}% of total</div></div>
        </div>
        <div class="two-col">
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">💰 Fee Collection by Class</span><button class="btn btn-sm btn-outline" onclick="window.exportCollectionByClass && exportCollectionByClass()">📥 Export</button></div><div class="dash-card-body"><canvas id="fee-chart" height="220"></canvas></div></div>
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">🔄 Recent Actions (Top 10)</span><span style="font-size:.75rem;color:var(--text-muted)">Live from activity log</span></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Action</th><th>By</th><th>When</th></tr></thead><tbody>${recent10.length ? recent10.map(l => `<tr><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.user_role)}</td><td>${formatAgo(l.created_at)}</td>`).join('') : `<tr><td colspan="3" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No activity yet</td>`}</tbody></table></div></div></div>
        </div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📊 Class Performance Summary</span><button class="btn btn-sm btn-outline" onclick="window.exportClassPerf && exportClassPerf()">📥 Export</button></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Class</th><th>Students</th><th>Avg %</th><th>Grade</th></tr></thead><tbody>${classPerf.length ? classPerf.map(c => `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${c.students}</td><td><span class="badge ${getGradeClass(c.avg)}">${fmtPct(c.avg)}</span></td><td>${c.grade}</td>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No performance data yet</td>`}</tbody></table></div></div></div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">⚡ Quick Actions</span></div><div class="dash-card-body"><div class="quick-actions"><div class="quick-btn" onclick="navigateTo('enroll-student')"><div class="qb-icon">➕</div><div class="qb-title">Enroll Student</div><div class="qb-sub">Add new student</div></div><div class="quick-btn" onclick="navigateTo('fee-structure')"><div class="qb-icon">🏷️</div><div class="qb-title">Fee Structure</div><div class="qb-sub">Manage fees</div></div><div class="quick-btn" onclick="navigateTo('financial-reports')"><div class="qb-icon">📊</div><div class="qb-title">Reports</div><div class="qb-sub">Generate reports</div></div><div class="quick-btn" onclick="window.promptPromoteStudents && promptPromoteStudents()"><div class="qb-icon">👥➡️</div><div class="qb-title">Promote Students</div><div class="qb-sub">Next class</div></div><div class="quick-btn" onclick="window.doFullBackup && doFullBackup()"><div class="qb-icon">💾</div><div class="qb-title">Backup Data</div><div class="qb-sub">Download JSON</div></div><div class="quick-btn" onclick="navigateTo('school-settings')"><div class="qb-icon">⚙️</div><div class="qb-title">Settings</div><div class="qb-sub">Configure</div></div></div></div></div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('fee-chart')?.getContext('2d');
        if (ctx) {
            createFeeCollectionChart('fee-chart', classNames, expectedData, collectedData);
        }
    }, 100);
}

// Render Accountant Dashboard
export async function renderAccountantDashboard(container) {
    if (!container) return;

    // Calculate totals
    let totalFees = 0, totalPaid = 0;
    for (const sf of (state.studentFees || [])) {
        if (!sf.is_waived && !sf.is_credit) totalFees += sf.amount;
    }
    for (const fa of (state.feeAmounts || [])) totalFees += fa.amount;
    for (const p of (state.payments || [])) totalPaid += p.amount;

    const pending = Math.max(0, totalFees - totalPaid);
    const collRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    // Overdue students
    const overdueStudents = [];
    const activeStudents = (state.students || []).filter(s => s.status === 'Active');
    for (const s of activeStudents) {
        const studentFees = (state.studentFees || []).filter(f => f.student_id === s.id && !f.is_waived && !f.is_credit);
        const studentPaid = studentFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
        const studentTotal = studentFees.reduce((sum, f) => sum + f.amount, 0);
        const balance = studentTotal - studentPaid;
        if (balance <= 0) continue;
        const unpaidFees = (state.studentFees || []).filter(f => f.student_id === s.id && !f.is_paid && !f.is_waived && !f.is_credit);
        const oldest = unpaidFees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
        if (!oldest?.due_date) continue;
        const days = Math.ceil((Date.now() - new Date(oldest.due_date)) / 86400000);
        if (days < 7) continue;
        const cls = getClassById(s.class_id);
        overdueStudents.push({ id: s.id, name: `${s.first_name} ${s.last_name}`, class_name: cls?.name || '—', amount: balance, days });
    }
    overdueStudents.sort((a, b) => b.days - a.days);

    // Recent payments
    const recent = [...(state.payments || [])].sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at)).slice(0, 5);

    // Class data for chart
    const classData = [];
    for (const cls of (state.classes || [])) {
        let expected = 0, collected = 0;
        const classFeeAmounts = (state.feeAmounts || []).filter(f => f.class_id === cls.id);
        if (classFeeAmounts.length > 0) {
            expected = classFeeAmounts.reduce((sum, f) => sum + f.amount, 0);
        } else {
            for (const fc of (state.feeCategories || [])) if (fc.amount) expected += fc.amount;
        }
        const studentsInClass = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');
        for (const student of studentsInClass) {
            const studentPayments = (state.payments || []).filter(p => p.student_id === student.id);
            collected += studentPayments.reduce((sum, p) => sum + p.amount, 0);
        }
        classData.push({ name: cls.name, expected: expected / 1000, collected: collected / 1000 });
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:16px">
            <button class="btn btn-sm btn-outline" onclick="window.refreshAccountantDashboard && refreshAccountantDashboard()">🔄 Refresh Data</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value">${fmtCurrency(totalFees)}</div><div class="stat-label">Total Fees</div><div class="stat-trend neutral">All categories</div></div>
            <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${fmtCurrency(totalPaid)}</div><div class="stat-label">Collected</div><div class="stat-trend up">${fmtPct(collRate)} of total</div></div>
            <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-value">${fmtCurrency(pending)}</div><div class="stat-label">Pending</div><div class="stat-trend down">${fmtPct(100 - collRate)} remaining</div></div>
            <div class="stat-card"><div class="stat-icon">🔴</div><div class="stat-value">${overdueStudents.length}</div><div class="stat-label">Overdue Students</div><div class="stat-trend down">7+ days late</div></div>
            <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${fmtPct(collRate)}</div><div class="stat-label">Collection Rate</div><div style="background:var(--border-light);border-radius:99px;height:6px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${Math.min(100, collRate)}%;background:var(--accountant-primary);border-radius:99px;"></div></div></div>
        </div>
        <div class="two-col">
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📊 Collection by Class</span></div><div class="dash-card-body"><canvas id="acc-class-chart" height="220"></canvas></div></div>
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">💳 Recent Payments</span><button class="btn btn-sm btn-outline" onclick="navigateTo('payment-history')">View All</button></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Student</th><th>Amount</th></tr></thead><tbody>${recent.length ? recent.map(p => { const st = getStudentById(p.student_id); return `<tr><td>${formatDate(p.payment_date || p.created_at)}</td><td>${st ? escapeHtml(st.first_name + ' ' + st.last_name) : '—'}</td><td><strong>${fmtCurrency(p.amount)}</strong></td></tr>`; }).join('') : `<tr><td colspan="3" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No payments recorded yet</td></tr>`}</tbody></table></div></div></div>
        </div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">⚠️ Overdue Payments (Action Required)</span><span style="font-size:.75rem;color:var(--danger)">${overdueStudents.length} students</span></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th style="text-align:right">Balance</th><th style="text-align:center">Days Overdue</th><th style="text-align:center">Action</th></tr></thead><tbody>${overdueStudents.length ? overdueStudents.map(s => `<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.class_name)}</td><td style="text-align:right">${fmtCurrency(s.amount)}</td><td style="text-align:center"><span class="${s.days >= 44 ? 'overdue-red' : s.days >= 30 ? 'overdue-orange' : 'overdue-yellow'}">${s.days} days</span></td><td style="text-align:center"><button class="btn btn-sm btn-primary" onclick="localStorage.setItem('elf_pay_student','${s.id}');navigateTo('record-payment')">💰 Pay</button></td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:var(--lg);color:var(--text-muted)">🎉 No overdue payments! All fees are up to date.</td></tr>`}</tbody></table></div></div></div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">⚡ Quick Actions</span></div><div class="dash-card-body"><div class="quick-actions"><div class="quick-btn" onclick="navigateTo('record-payment')"><div class="qb-icon">💰</div><div class="qb-title">Record Payment</div><div class="qb-sub">Add payment</div></div><div class="quick-btn" onclick="navigateTo('receipts')"><div class="qb-icon">📄</div><div class="qb-title">Generate Receipt</div><div class="qb-sub">Print PDF</div></div><div class="quick-btn" onclick="navigateTo('student-fees')"><div class="qb-icon">👥</div><div class="qb-title">Student Fees</div><div class="qb-sub">View balances</div></div><div class="quick-btn" onclick="navigateTo('fee-structure')"><div class="qb-icon">🏷️</div><div class="qb-title">Fee Structure</div><div class="qb-sub">Manage categories</div></div><div class="quick-btn" onclick="navigateTo('financial-reports')"><div class="qb-icon">📊</div><div class="qb-title">Export Report</div><div class="qb-sub">Financial summary</div></div><div class="quick-btn" onclick="navigateTo('overdue-payments')"><div class="qb-icon">⚠️</div><div class="qb-title">Overdue</div><div class="qb-sub">Follow up</div></div></div></div></div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('acc-class-chart')?.getContext('2d');
        if (ctx) {
            const labels = classData.map(c => c.name);
            const expectedData = classData.map(c => c.expected);
            const collectedData = classData.map(c => c.collected);
            if (expectedData.some(v => v > 0) || collectedData.some(v => v > 0)) {
                createBarChart('acc-class-chart', labels, [
                    { label: 'Expected (K RWF)', data: expectedData, backgroundColor: 'rgba(13,148,136,0.3)', borderColor: '#0d9488', borderWidth: 1, borderRadius: 6 },
                    { label: 'Collected (K RWF)', data: collectedData, backgroundColor: 'rgba(20,184,166,0.6)', borderColor: '#14b8a6', borderWidth: 1, borderRadius: 6 }
                ], { scales: { y: { beginAtZero: true, title: { display: true, text: 'Thousands (RWF)' } } } });
            }
        }
    }, 100);
}

// Render Teacher Dashboard
export async function renderTeacherDashboard(container) {
    if (!container) return;

    const user = getCurrentUser();
    const termObj = state.currentTerm;
    let teacherClasses = (state.classes || []).filter(c => c.is_active);

    if (user?.role === 'teacher') {
        let assignments = [];
        try { assignments = await getAll('teacher_assignments', { teacher_id: user.id }); } catch (e) { assignments = []; }
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        teacherClasses = teacherClasses.filter(c => classIds.includes(c.id));
    }

    const classPerf = teacherClasses.map(cls => {
        const studs = (state.students || []).filter(s => s.class_id === cls.id && s.status === 'Active');
        const assess = (state.assessments || []).filter(a => a.class_id === cls.id && a.term_id === termObj?.id);
        let tot = 0, cnt = 0;
        studs.forEach(st => {
            let s = 0, m = 0;
            assess.forEach(a => {
                const mk = (state.marks || []).find(x => x.assessment_id === a.id && x.student_id === st.id);
                if (mk) { s += mk.score; m += a.max_marks; }
            });
            if (m > 0) { tot += (s / m) * 100; cnt++; }
        });
        return { name: cls.name, count: studs.length, avg: cnt > 0 ? tot / cnt : 0 };
    });

    const myAssess = (state.assessments || []).filter(a => a.term_id === termObj?.id && teacherClasses.some(c => c.id === a.class_id));
    const pending = [];
    for (const a of myAssess) {
        const expected = (state.students || []).filter(s => s.class_id === a.class_id && s.status === 'Active').length;
        const entered = (state.marks || []).filter(m => m.assessment_id === a.id).length;
        if (entered < expected) {
            const cls = getClassById(a.class_id), sub = getSubjectById(a.subject_id);
            const due = a.due_date ? new Date(a.due_date) : null;
            const days = due ? Math.ceil((due - Date.now()) / 86400000) : null;
            pending.push({ id: a.id, name: a.assessment_name, type: a.assessment_type, cls: cls?.name, sub: sub?.name, entered, expected, due: a.due_date, priority: days === null ? 'medium' : days < 0 ? 'overdue' : days <= 3 ? 'high' : 'medium' });
        }
    }

    const totalMarksEntered = (state.marks || []).filter(m => {
        const a = (state.assessments || []).find(x => x.id === m.assessment_id);
        return a && teacherClasses.some(c => c.id === a.class_id);
    }).length;

    const avgScore = classPerf.length ? classPerf.reduce((a, c) => a + c.avg, 0) / classPerf.length : 0;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${classPerf.reduce((a, c) => a + c.count, 0)}</div><div class="stat-label">My Students</div></div>
            <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-value">${myAssess.length}</div><div class="stat-label">Assessments</div></div>
            <div class="stat-card"><div class="stat-icon">✏️</div><div class="stat-value">${totalMarksEntered}</div><div class="stat-label">Marks Entered</div></div>
            <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${fmtPct(avgScore)}</div><div class="stat-label">Avg Class Score</div></div>
            <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${pending.length}</div><div class="stat-label">Pending Tasks</div></div>
        </div>
        <div class="two-col">
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📊 My Classes</span></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Class</th><th>Students</th><th>Avg %</th><th>Grade</th></tr></thead><tbody>${classPerf.map(c => `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${c.count}</td><td><span class="badge ${getGradeClass(c.avg)}">${fmtPct(c.avg)}</span></td><td>${getGrade(c.avg)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No classes assigned</td></tr>'}</tbody></table></div></div></div>
            <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">⏰ Pending Marks (${pending.length})</span><button class="btn btn-sm btn-primary" onclick="navigateTo('marks-entry')">✏️ Enter Marks</button></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Assessment</th><th>Class</th><th>Progress</th><th>Priority</th></tr></thead><tbody>${pending.length ? pending.slice(0, 8).map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.sub)}</small></td><td>${escapeHtml(p.cls)}</td><td>${p.entered}/${p.expected}</td><td><span class="badge ${p.priority === 'overdue' ? 'badge-danger' : p.priority === 'high' ? 'badge-warning' : 'badge-info'}">${p.priority}</span></td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:var(--lg);color:var(--text-muted)">No pending tasks 🎉</td></tr>'}</tbody></table></div></div></div>
        </div>
        <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">⚡ Quick Actions</span></div><div class="dash-card-body"><div class="quick-actions"><div class="quick-btn" onclick="navigateTo('marks-entry')"><div class="qb-icon">✏️</div><div class="qb-title">Enter Marks</div></div><div class="quick-btn" onclick="navigateTo('class-register')"><div class="qb-icon">📋</div><div class="qb-title">Class Register</div></div><div class="quick-btn" onclick="navigateTo('report-cards')"><div class="qb-icon">📄</div><div class="qb-title">Report Cards</div></div><div class="quick-btn" onclick="navigateTo('statistics')"><div class="qb-icon">📈</div><div class="qb-title">Statistics</div></div><div class="quick-btn" onclick="navigateTo('assessments')"><div class="qb-icon">📝</div><div class="qb-title">Assessments</div></div><div class="quick-btn" onclick="navigateTo('student-list')"><div class="qb-icon">👥</div><div class="qb-title">Students</div></div></div></div></div>
    `;
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getSubjectById(id) {
    return (state.subjects || []).find(s => s.id == id);
}