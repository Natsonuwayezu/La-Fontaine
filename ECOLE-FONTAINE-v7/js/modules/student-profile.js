// ============================================================
// STUDENT PROFILE MODULE - 5-tab student details view
// ============================================================

import { state } from '../core/state.js';
import { getClassById, getStudentById, getTeacherById } from '../core/state.js';
import { getCurrentUser, isAdmin, isTeacher, isAccountant } from '../core/auth.js';
import { fmtCurrency, fmtDate, fmtDateTime, esc, getGrade, getGradeClass } from '../core/utils.js';
import { getFullStudentBalance } from '../core/helpers.js';;
import { getAll } from '../core/supabase-client.js';
import { refreshTable } from '../core/data-loader.js';
import { showToast } from '../ui/modals.js';
import { navigateTo } from '../core/router.js';
import { openEditStudentModal, deleteStudentPrompt } from './students.js';

let _currentStudentId = null;
let _activeStudentTab = 'info';

// Render Student Details page
export async function renderStudentDetails(container) {
    const id = parseInt(localStorage.getItem('elf_view_student'));
    const s = id ? getStudentById(id) : null;

    if (!s) {
        container.innerHTML = `
            <div class="dash-card">
                <div class="dash-card-header"><span class="dash-card-title">ℹ️ Student Details</span></div>
                <div class="dash-card-body"><p>No student selected. Go to <a href="#" onclick="navigateTo('student-list')">Student List</a> and click 👁️.</p></div>
            </div>`;
        return;
    }

    _currentStudentId = s.id;
    const cls = getClassById(s.class_id);
    const age = s.date_of_birth ? Math.floor((new Date() - new Date(s.date_of_birth)) / (1000 * 60 * 60 * 24 * 365.25)) : null;
    const bal = getFullStudentBalance(s.id);
    const role = getCurrentUser()?.role;

    // Determine which tabs to show based on role
    const showFeesTab = role === 'admin' || role === 'accountant';
    const showAcademicsTab = role === 'admin' || role === 'teacher';
    const showFamilyTab = true;
    const showHistoryTab = role === 'admin' || role === 'accountant';

    container.innerHTML = `
        <div class="btn-group" style="margin-bottom:var(--md)">
            <button class="btn btn-outline" onclick="navigateTo('student-list')">← Back to List</button>
            ${isAdmin() ? `<button class="btn btn-primary" onclick="openEditStudentModal(${s.id})">✏️ Edit</button>` : ''}
        </div>
        <div class="tabs" style="display:flex; gap:2px; border-bottom:2px solid var(--border-light); margin-bottom:20px; flex-wrap:wrap">
            <button class="tab-btn ${_activeStudentTab === 'info' ? 'active' : ''}" onclick="switchStudentTab('info', ${s.id}, event)" style="padding:10px 20px;">📋 Info</button>
            ${showFeesTab ? `<button class="tab-btn ${_activeStudentTab === 'fees' ? 'active' : ''}" onclick="switchStudentTab('fees', ${s.id}, event)">💰 Fees</button>` : ''}
            ${showAcademicsTab ? `<button class="tab-btn ${_activeStudentTab === 'academics' ? 'active' : ''}" onclick="switchStudentTab('academics', ${s.id}, event)">📊 Academics</button>` : ''}
            ${showFamilyTab ? `<button class="tab-btn ${_activeStudentTab === 'family' ? 'active' : ''}" onclick="switchStudentTab('family', ${s.id}, event)">👨‍👩‍👧 Family</button>` : ''}
            ${showHistoryTab ? `<button class="tab-btn ${_activeStudentTab === 'history' ? 'active' : ''}" onclick="switchStudentTab('history', ${s.id}, event)">📜 History</button>` : ''}
        </div>
        <div id="student-tab-content"><div class="loading-container"><div class="spinner"></div><p>Loading...</p></div></div>
    `;

    await loadStudentTabContent(_activeStudentTab, s.id);
}

// Switch between tabs
window.switchStudentTab = async function (tabName, studentId, event) {
    const role = getCurrentUser()?.role;
    if (tabName === 'fees' && role === 'teacher') {
        showToast('Fee information is not available for Teacher accounts', 'warning');
        return;
    }
    if (tabName === 'academics' && role === 'accountant') {
        showToast('Academic information is not available for Accountant accounts', 'warning');
        return;
    }

    _activeStudentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = 'none';
        btn.style.color = 'var(--text-muted)';
    });
    if (event?.target) {
        event.target.classList.add('active');
        event.target.style.borderBottom = '2px solid var(--role-primary)';
        event.target.style.color = 'var(--role-primary)';
    }

    await loadStudentTabContent(tabName, studentId);
};

// Load tab content
export async function loadStudentTabContent(tabName, studentId) {
    const container = document.getElementById('student-tab-content');
    if (!container) return;

    const student = getStudentById(studentId);
    if (!student) return;

    const cls = getClassById(student.class_id);
    const bal = getFullStudentBalance(studentId);
    const role = getCurrentUser()?.role;

    switch (tabName) {
        case 'info':
            const canRecordPayment = role === 'admin' || role === 'accountant';
            container.innerHTML = `
                <div class="two-col">
                    <div class="dash-card"><div class="dash-card-body" style="text-align:center"><div style="font-size:6rem; margin-bottom:var(--sm)">${student.gender === 'Female' ? '👧' : '👦'}</div><button class="btn btn-sm btn-outline" onclick="alert('Photo upload coming soon')">📸 Change Photo</button></div></div>
                    <div class="dash-card"><div class="dash-card-body"><h2 style="margin-bottom:4px">${esc(student.first_name)} ${esc(student.last_name)}</h2><p style="color:var(--text-muted); margin-bottom:16px">Code: ${esc(student.student_code || '—')}</p>
                    <div class="form-grid" style="grid-template-columns:1fr 1fr">
                        <div class="form-group"><label>Class</label><input readonly value="${esc(cls?.name || '—')}"></div>
                        <div class="form-group"><label>Status</label><input readonly value="${esc(student.status)}" class="badge ${student.status === 'Active' ? 'badge-success' : 'badge-danger'}"></div>
                        <div class="form-group"><label>Gender</label><input readonly value="${esc(student.gender || '—')}"></div>
                        <div class="form-group"><label>Date of Birth</label><input readonly value="${fmtDate(student.date_of_birth)}"></div>
                        <div class="form-group"><label>Age</label><input readonly value="${age ? age + ' years' : '—'}"></div>
                        <div class="form-group"><label>Enrolled</label><input readonly value="${fmtDate(student.enrollment_date)}"></div>
                    </div></div></div>
                </div>
                <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📋 PARENT/GUARDIAN INFORMATION</span></div><div class="dash-card-body"><div class="form-grid"><div class="form-group"><label>Guardian Name</label><input readonly value="${esc(student.guardian_name || '—')}"></div><div class="form-group"><label>Contact</label><input readonly value="${esc(student.guardian_phone || '—')}"></div><div class="form-group"><label>Email</label><input readonly value="${esc(student.guardian_email || '—')}"></div><div class="form-group"><label>Address</label><input readonly value="${esc(student.address || '—')}"></div></div></div></div>
                <div class="btn-group" style="margin-top:20px">
                    ${isAdmin() ? `<button class="btn btn-primary" onclick="openEditStudentModal(${studentId})">✏️ Edit</button>` : ''}
                    ${canRecordPayment ? `<button class="btn btn-success" onclick="localStorage.setItem('elf_pay_student','${studentId}'); navigateTo('record-payment')">💰 Record Payment</button>` : ''}
                    <button class="btn btn-outline" onclick="generateReportCardForStudent(${studentId})">📄 Generate Report</button>
                    ${isAdmin() ? `<button class="btn btn-danger" onclick="deleteStudentPrompt(${studentId},'${esc(student.first_name)} ${esc(student.last_name)}')">🗑️ Archive</button>` : ''}
                </div>
            `;
            break;

        case 'fees':
            const canManagePayments = role === 'admin' || role === 'accountant';
            const studentFees = (state.studentFees || []).filter(f => f.student_id === studentId && !f.is_credit);
            const payments = (state.payments || []).filter(p => p.student_id === studentId);

            const feeBreakdown = studentFees.map(fee => {
                const category = (state.feeCategories || []).find(c => c.id === fee.fee_category_id);
                const paid = fee.paid_amount || 0;
                const remaining = fee.amount - paid;
                const status = fee.is_waived ? '✅ Waived' : (paid >= fee.amount ? '✅ Paid' : (paid > 0 ? '🟡 Partial' : '🔴 Due'));
                return { name: category?.name || 'Unknown', amount: fee.amount, paid, remaining, status, isWaived: fee.is_waived };
            });

            const paymentHistory = payments.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));

            container.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px">
                    <div class="stat-card" style="text-align:center"><div class="stat-value">${fmtCurrency(bal.total)}</div><div class="stat-label">Total Fees</div></div>
                    <div class="stat-card" style="text-align:center"><div class="stat-value">${fmtCurrency(bal.paid)}</div><div class="stat-label">Paid</div></div>
                    <div class="stat-card" style="text-align:center"><div class="stat-value" style="color:${bal.balance > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtCurrency(bal.balance)}</div><div class="stat-label">Balance</div></div>
                </div>
                <div style="margin-bottom:24px; background:var(--border-light); border-radius:99px; height:12px; overflow:hidden"><div style="width:${bal.pct}%; height:100%; background:var(--role-primary); border-radius:99px;"></div></div>
                <p style="text-align:center; margin-bottom:24px; font-size:.8rem">${bal.pct.toFixed(1)}% collected</p>
                <div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">💰 FEE BREAKDOWN</span>${canManagePayments ? `<button class="btn btn-sm btn-primary" onclick="openRecordPaymentForStudent(${studentId})">➕ Add Payment</button>` : ''}</div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Remaining</th><th style="text-align:center">Status</th></tr></thead><tbody>${feeBreakdown.length ? feeBreakdown.map(f => `<tr><td><strong>${esc(f.name)}</strong>${f.isWaived ? ' <span class="badge badge-success">Waived</span>' : ''}</td><td style="text-align:right">${fmtCurrency(f.amount)}</span><td style="text-align:right">${fmtCurrency(f.paid)}</span><td style="text-align:right; ${f.remaining > 0 ? 'color:var(--danger); font-weight:600' : ''}">${fmtCurrency(f.remaining)}</span><td style="text-align:center"><span class="badge ${f.status.includes('Paid') ? 'badge-success' : (f.status.includes('Partial') ? 'badge-warning' : 'badge-danger')}">${f.status}</span></td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:40px">No fees recorded for this student</span>`}</tbody></table></div></div></div>
                <div class="dash-card" style="margin-top:20px"><div class="dash-card-header"><span class="dash-card-title">📜 PAYMENT HISTORY</span><button class="btn btn-sm btn-outline" onclick="printStudentStatement(${studentId})">📄 Print Statement</button></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th style="text-align:right">Amount</th><th>Method</th><th>Receipt #</th><th>Recorded By</th><th>Action</th></tr></thead><tbody>${paymentHistory.length ? paymentHistory.map(p => { const recordedBy = (state.teachers || []).find(t => t.id === p.recorded_by)?.name || 'System'; return `<tr><td>${fmtDate(p.payment_date || p.created_at)}</span><td style="text-align:right"><strong>${fmtCurrency(p.amount)}</strong></span><td>${esc(p.payment_method || '—')}</span><td><code>${esc(p.receipt_number || '—')}</code></span><td>${esc(recordedBy)}</span><td><button class="btn btn-sm btn-outline" onclick="printReceipt(${p.id})">🖨️</button></span>`; }).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px">No payments recorded</span>`}</tbody></table></div></div></div>
                <div class="btn-group" style="margin-top:20px">${canManagePayments ? `<button class="btn btn-outline" onclick="openManualBalanceModal(${studentId}, '${esc(student.first_name)} ${esc(student.last_name)}')">⚙️ Adjust Balance</button>` : ''}<button class="btn btn-sm btn-primary" onclick="openStudentFeeManagement(${studentId}, '${esc(student.first_name)} ${esc(student.last_name)}')">✏️ Manage Individual Fees</button>${canManagePayments ? `<button class="btn btn-outline" onclick="openFullWaiverModalForStudent(${studentId})">🎁 Apply Waiver</button>` : ''}</div>
            `;
            break;

        case 'academics':
            const currentTermId = state.currentTerm?.id;
            const terms = (state.terms || []).filter(t => t.academic_year_id === state.currentAcadYear?.id);
            let subjects = (state.subjects || []).filter(s => s.level === cls?.level && s.is_active !== false);
            subjects.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
            const assessments = (state.assessments || []).filter(a => a.class_id === student.class_id && a.term_id === currentTermId);
            const studentMarks = (state.marks || []).filter(m => m.student_id === studentId);

            let academicRows = '', totalPercentage = 0, subjectCount = 0;
            for (const subject of subjects) {
                const subjectAssessments = assessments.filter(a => a.subject_id === subject.id);
                let quizMarks = [], midtermMark = null, examMark = null, finalMark = null;
                for (const assessment of subjectAssessments) {
                    const mark = studentMarks.find(m => m.assessment_id === assessment.id);
                    const scoreDisplay = mark ? `${mark.score}/${assessment.max_marks}` : null;
                    const percentage = mark ? (mark.score / assessment.max_marks * 100).toFixed(1) : null;
                    if (assessment.assessment_type === 'Quiz') quizMarks.push({ score: scoreDisplay, percentage });
                    else if (assessment.assessment_type === 'Mid-term') midtermMark = { score: scoreDisplay, percentage };
                    else if (assessment.assessment_type === 'Exam') examMark = { score: scoreDisplay, percentage };
                    else if (assessment.assessment_type === 'Final Exam') finalMark = { score: scoreDisplay, percentage };
                }
                while (quizMarks.length < 2) quizMarks.push({ score: null, percentage: null });
                let subjTotalPct = 0, subjCount = 0;
                [...quizMarks, midtermMark, examMark, finalMark].forEach(m => { if (m && m.percentage) { subjTotalPct += parseFloat(m.percentage); subjCount++; } });
                const avgPct = subjCount > 0 ? (subjTotalPct / subjCount).toFixed(1) : null;
                if (avgPct && !isNaN(avgPct)) { totalPercentage += parseFloat(avgPct); subjectCount++; }
                academicRows += `<tr><td><strong>${subject.name}</strong></span><td style="text-align:center">${quizMarks[0]?.score || '—'}</span><td style="text-align:center">${quizMarks[1]?.score || '—'}</span><td style="text-align:center">${midtermMark?.score || '—'}</span><td style="text-align:center">${examMark?.score || '—'}</span><td style="text-align:center">${finalMark?.score || '—'}</span><td style="text-align:center"><span class="badge ${getGradeClass(avgPct)}">${avgPct ? avgPct + '%' : '—'}</span><td style="text-align:center">${avgPct ? getGrade(avgPct) : '—'}</span></tr>`;
            }
            const overallAvg = subjectCount > 0 ? (totalPercentage / subjectCount).toFixed(1) : 0;
            let rankDisplay = '—';
            try { rankDisplay = await calculateStudentRank(studentId, student.class_id); } catch (e) { rankDisplay = '—'; }
            container.innerHTML = `<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📊 ACADEMIC PERFORMANCE - ${esc(student.first_name)} ${esc(student.last_name)}</span><select id="academic-term-select" onchange="loadStudentAcademicData(${studentId}, this.value)" style="padding:6px 12px;border-radius:var(--r-md);border:1px solid var(--border-medium)">${terms.map(t => `<option value="${t.id}" ${t.id === currentTermId ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Subject</th><th>Quiz 1</th><th>Quiz 2</th><th>Mid-term</th><th>Exam 1</th><th>Final</th><th>Avg %</th><th>Grade</th></tr></thead><tbody id="academic-performance-tbody">${academicRows || '<tr><td colspan="8" style="text-align:center;padding:40px">No academic data available</span>'}</tbody></table></div></div></div><div style="margin-top:20px; padding:16px; background:var(--bg-tertiary); border-radius:var(--r-lg); text-align:center"><strong>Overall Average: ${overallAvg}%</strong> &nbsp;|&nbsp; <strong>Grade: ${getGrade(overallAvg)}</strong> &nbsp;|&nbsp; <strong>Rank: ${rankDisplay}</strong></div><div class="btn-group" style="margin-top:20px"><button class="btn btn-primary" onclick="generateReportCardForStudent(${studentId})">📄 Generate Report Card</button></div>`;
            break;

        case 'family':
            const family = student.family_id ? (state.families || []).find(f => f.id === student.family_id) : null;
            const siblings = family ? (state.students || []).filter(s => s.family_id === family.id && s.id !== studentId) : [];
            container.innerHTML = `<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">👨‍👩‍👧 FAMILY INFORMATION</span><div class="btn-group"><button class="btn btn-sm btn-outline" onclick="openEditFamilyModal(${family?.id || ''})">✏️ Edit Family</button><button class="btn btn-sm btn-primary" onclick="openLinkStudentModal(${studentId}, '${esc(student.first_name)} ${esc(student.last_name)}')">🔗 Link Another Student</button></div></div><div class="dash-card-body"><div class="form-grid" style="margin-bottom:20px"><div class="form-group"><label>Family Code</label><input readonly value="${esc(family?.family_code || '—')}"></div><div class="form-group"><label>Guardian Name</label><input readonly value="${esc(family?.guardian_name || student.guardian_name || '—')}"></div><div class="form-group"><label>Guardian Phone</label><input readonly value="${esc(family?.guardian_phone || student.guardian_phone || '—')}"></div><div class="form-group"><label>Guardian Email</label><input readonly value="${esc(family?.guardian_email || student.guardian_email || '—')}"></div><div class="form-group full"><label>Address</label><input readonly value="${esc(family?.address || student.address || '—')}"></div><div class="form-group"><label>Family Discount</label><input readonly value="${fmtCurrency(family?.discount_amount || 0)} per term"></div></div><h4 style="margin:20px 0 12px">👨‍👩‍👧 Siblings in School (${siblings.length})</h4><div class="table-wrapper"><table class="data-table"><thead><tr><th>Name</th><th>Class</th><th>Status</th><th>Action</th></tr></thead><tbody>${siblings.length ? siblings.map(sib => { const sibCls = getClassById(sib.class_id); return `<tr><td><strong>${esc(sib.first_name)} ${esc(sib.last_name)}</strong></span><td>${esc(sibCls?.name || '—')}</span><td><span class="badge ${sib.status === 'Active' ? 'badge-success' : 'badge-danger'}">${sib.status}</span><td><button class="btn btn-sm btn-outline" onclick="viewStudentDetail(${sib.id})">👁️ View</button></span>`; }).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px">No siblings found in school</span>'}</tbody></table></div></div></div>`;
            break;

        case 'history':
            const logs = (state.activityLogs || []).filter(l => l.entity_type === 'students' && l.entity_id === studentId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            container.innerHTML = `<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">📜 ACTIVITY HISTORY</span><button class="btn btn-sm btn-outline" onclick="exportStudentHistory(${studentId})">📥 Export</button></div><div class="dash-card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Action</th><th>By</th><th>Details</th></tr></thead><tbody>${logs.length ? logs.map(log => `<tr><td style="white-space:nowrap">${fmtDateTime(log.created_at)}</span><td>${esc(log.action)}</span><td>${esc(log.user_role || 'System')}</span><td>${esc(log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '—')}</span>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px">No activity history available</span>'}</tbody></table></div></div></div>`;
            break;
    }
}

// Helper functions
async function calculateStudentRank(studentId, classId) {
    const students = (state.students || []).filter(s => s.class_id === classId && s.status === 'Active');
    const studentPercentages = [];
    const currentTermId = state.currentTerm?.id;
    const allAssessments = (state.assessments || []).filter(a => a.class_id === classId && a.term_id === currentTermId);
    if (!allAssessments || allAssessments.length === 0) return '—';
    for (const student of students) {
        let totalScore = 0, totalMax = 0;
        for (const assessment of allAssessments) {
            const mark = (state.marks || []).find(m => m.assessment_id === assessment.id && m.student_id === student.id);
            if (mark && mark.score !== null && mark.score !== undefined) { totalScore += mark.score; totalMax += assessment.max_marks; }
        }
        const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
        studentPercentages.push({ id: student.id, percentage });
    }
    studentPercentages.sort((a, b) => b.percentage - a.percentage);
    const rank = studentPercentages.findIndex(s => s.id === studentId) + 1;
    const total = studentPercentages.length;
    return total > 0 ? `${rank} of ${total}` : '—';
}

async function generateReportCardForStudent(studentId) {
    const student = getStudentById(studentId);
    if (!student) return;
    const classSelect = document.getElementById('report-class');
    const studentSelect = document.getElementById('report-student');
    if (classSelect && studentSelect) {
        classSelect.value = student.class_id;
        await loadReportStudents();
        setTimeout(() => { studentSelect.value = studentId; generateReportCard(); }, 200);
    }
    navigateTo('report-cards');
}

async function printStudentStatement(studentId) {
    const student = getStudentById(studentId);
    const cls = getClassById(student?.class_id);
    const bal = getFullStudentBalance(studentId);
    const fees = (state.studentFees || []).filter(f => f.student_id === studentId && !f.is_credit);
    const payments = (state.payments || []).filter(p => p.student_id === studentId);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Fee Statement - ${student?.first_name} ${student?.last_name}</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{text-align:center;color:#1a3a5c}.header{text-align:center;margin-bottom:30px}.info{display:flex;justify-content:space-between;margin-bottom:20px;padding:10px;background:#f0f0f0;border-radius:8px}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#1a3a5c;color:white}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px;padding:10px;background:#d1fae5;border-radius:8px}.footer{text-align:center;margin-top:30px;font-size:11px;color:#666}</style></head><body><div class="header"><h1>🏫 ECOLE LA FONTAINE</h1><h3>FEE STATEMENT</h3></div><div class="info"><div><strong>Student:</strong> ${student?.first_name} ${student?.last_name}</div><div><strong>Code:</strong> ${student?.student_code}</div><div><strong>Class:</strong> ${cls?.name}</div></div><div class="info"><div><strong>Total Fees:</strong> ${fmtCurrency(bal.total)}</div><div><strong>Total Paid:</strong> ${fmtCurrency(bal.paid)}</div><div><strong>Balance:</strong> ${fmtCurrency(bal.balance)}</div></div><h3>Fee Breakdown</h3><table><thead><tr><th>Category</th><th>Amount</th><th>Paid</th><th>Remaining</th></tr></thead><tbody>${fees.map(f => { const cat = (state.feeCategories || []).find(c => c.id === f.fee_category_id); return `<tr><td>${cat?.name}</td><td>${fmtCurrency(f.amount)}</td><td>${fmtCurrency(f.paid_amount || 0)}</td><td>${fmtCurrency(f.amount - (f.paid_amount || 0))}</td></tr>`; }).join('')}</tbody></table><h3>Payment History</h3><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt #</th></tr></thead><tbody>${payments.map(p => `<tr><td>${fmtDate(p.payment_date || p.created_at)}</td><td>${fmtCurrency(p.amount)}</td><td>${p.payment_method}</td><td>${p.receipt_number}</td></tr>`).join('')}</tbody></table><div class="total">Outstanding Balance: ${fmtCurrency(bal.balance)}</div><div class="footer">Generated on ${new Date().toLocaleString()} | ECOLE LA FONTAINE School Management System</div></body></html>`);
    printWindow.document.close();
    printWindow.print();
}

async function exportStudentHistory(studentId) {
    const logs = (state.activityLogs || []).filter(l => l.entity_type === 'students' && l.entity_id === studentId);
    const exportData = logs.map(log => ({ 'Date': fmtDateTime(log.created_at), 'Action': log.action, 'Performed By': log.user_role || 'System', 'Details': log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '—' }));
    exportToExcel(exportData, `Student_History_${studentId}`);
}

function exportToExcel(data, filename) {
    if (!data?.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Placeholder functions (to be implemented in other modules)
async function loadReportStudents() { }
function generateReportCard() { }
function openRecordPaymentForStudent(studentId) { }
function openManualBalanceModal(studentId, studentName) { }
function openFullWaiverModalForStudent(studentId) { }
function printReceipt(paymentId) { }
function openEditFamilyModal(familyId) { }
function openLinkStudentModal(studentId, studentName) { }
function loadStudentAcademicData(studentId, termId) { }

// Export functions to window
window.switchStudentTab = window.switchStudentTab;
window.generateReportCardForStudent = generateReportCardForStudent;
window.printStudentStatement = printStudentStatement;
window.exportStudentHistory = exportStudentHistory;