// js/ui/sidebar.js
// Sidebar — build, toggle, collapse, mobile overlay, active state
// No ES module imports — uses globals from window

// ── NAV CONFIG ──────────────────────────────────────────────────────────────
// Single source of truth for navigation per role.
// Items map directly to module IDs passed to navigateTo().

const NAV_CONFIG = {

    // ── ADMIN: Full access ──────────────────────────────────────────────────
    admin: [
        {
            section: '🏠 Dashboard & Overview',
            items: [
                { id: 'admin-dashboard',  icon: '📊', label: 'Dashboard' },
                { id: 'analytics',        icon: '📈', label: 'Analytics' }
            ]
        },
        {
            section: '🔔 Communication',
            items: [
                { id: 'announcements',        icon: '📢', label: 'Announcements' },
                { id: 'notification-center',  icon: '🔔', label: 'Notification Center' },
                { id: 'reminders',            icon: '⏰', label: 'Reminders' }
            ]
        },
        {
            section: '📋 Attendance',
            items: [
                { id: 'attendance',           icon: '✅', label: 'Record Attendance' },
                { id: 'attendance-reports',   icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary',   icon: '📈', label: 'Attendance Summary' },
                { id: 'attendance-analytics', icon: '📊', label: 'Attendance Analytics' }
            ]
        },
        {
            section: '👥 Student Management',
            items: [
                { id: 'student-list',       icon: '👥',      label: 'All Students' },
                { id: 'enroll-student',     icon: '➕',      label: 'Enroll Student' },
                { id: 'student-details',    icon: '🔍',      label: 'Student Details' },
                { id: 'family-management',  icon: '👨‍👩‍👧', label: 'Family Groups' },
                { id: 'student-promotion',  icon: '🎓',      label: 'Student Promotion' },
                { id: 'student-archive',    icon: '📦',      label: 'Student Archive' }
            ]
        },
        {
            section: '📚 Academics Core',
            items: [
                { id: 'marks-entry',      icon: '📝', label: 'Marks Entry' },
                { id: 'marks-database',   icon: '📋', label: 'Marks Database' },
                { id: 'class-register',   icon: '📋', label: 'Class Register' },
                { id: 'report-cards',     icon: '📄', label: 'Report Cards' },
                { id: 'transcripts',      icon: '📜', label: 'Transcripts' },
                { id: 'academic-reports', icon: '📈', label: 'Academic Reports' },
                { id: 'statistics',       icon: '📊', label: 'Statistics' }
            ]
        },
        {
            section: '💰 Finance Management',
            items: [
                { id: 'finance-dashboard',   icon: '💰', label: 'Finance Dashboard' },
                { id: 'fee-structure',        icon: '📋', label: 'Fee Structure' },
                { id: 'record-payment',       icon: '💵', label: 'Record Payment' },
                { id: 'payment-history',      icon: '📜', label: 'Payment History' },
                { id: 'receipt-printing',     icon: '🧾', label: 'Receipts & Printing' },
                { id: 'overdue-payments',     icon: '⚠️', label: 'Overdue Payments' },
                { id: 'fee-waivers',          icon: '🎁', label: 'Fee Waivers' },
                { id: 'balances',             icon: '⚖️', label: 'Student Balances' },
                { id: 'payment-reversals',    icon: '↩️', label: 'Payment Reversals' },
                { id: 'financial-reports',    icon: '📊', label: 'Financial Reports' },
                { id: 'fee-term-status',      icon: '📊', label: 'Fee Term Status' },
                { id: 'carry-forward',        icon: '📅', label: 'Fee Carry Forward' },
                { id: 'family-fee-summary',   icon: '👨‍👩‍👧', label: 'Family Fee Summary' }
            ]
        },
        {
            section: '👨‍🏫 Staff & Timetable',
            items: [
                { id: 'user-management',       icon: '👨‍🏫', label: 'Staff Management' },
                { id: 'subjects',              icon: '📖', label: 'Subjects' },
                { id: 'teacher-assignments',   icon: '📌', label: 'Teacher Assignments' },
                { id: 'teacher-performance',   icon: '⭐', label: 'Teacher Performance' },
                { id: 'timetable',             icon: '🕐', label: 'Master Timetable' }
            ]
        },
        {
            section: '⚙️ Settings & Configuration',
            items: [
                { id: 'school-settings',   icon: '🏫', label: 'School Settings' },
                { id: 'academic-calendar', icon: '📅', label: 'Academic Calendar' },
                { id: 'academic-years',    icon: '📆', label: 'Academic Years' },
                { id: 'class-management',  icon: '🏛️', label: 'Class Management' },
                { id: 'grading-scale',     icon: '📊', label: 'Grading Scale' },
                { id: 'backup-restore',    icon: '💾', label: 'Backup & Restore' },
                { id: 'system-logs',       icon: '📋', label: 'System Logs' },
                { id: 'api-settings',      icon: '🔌', label: 'API Settings' },
                { id: 'settings',          icon: '⚙️', label: 'System Settings' }
            ]
        },
        {
            section: '📦 Bulk Operations',
            items: [
                { id: 'bulk-import', icon: '📤', label: 'Bulk Import' },
                { id: 'bulk-export', icon: '📥', label: 'Bulk Export' }
            ]
        }
    ],

    // ── TEACHER: Academics + own classes ───────────────────────────────────
    teacher: [
        {
            section: '🏠 Dashboard',
            items: [
                { id: 'teacher-dashboard', icon: '📊', label: 'My Dashboard' },
                { id: 'notification-center', icon: '🔔', label: 'Notifications' }
            ]
        },
        {
            section: '📚 Academics',
            items: [
                { id: 'marks-entry',      icon: '📝', label: 'Marks Entry' },
                { id: 'marks-database',   icon: '📋', label: 'Marks Database' },
                { id: 'class-register',   icon: '📋', label: 'Class Register' },
                { id: 'report-cards',     icon: '📄', label: 'Report Cards' },
                { id: 'statistics',       icon: '📊', label: 'Statistics' }
            ]
        },
        {
            section: '👥 Students',
            items: [
                { id: 'student-list',    icon: '👥', label: 'All Students' },
                { id: 'student-details', icon: '🔍', label: 'Student Details' }
            ]
        },
        {
            section: '📋 Attendance',
            items: [
                { id: 'attendance',         icon: '✅', label: 'Record Attendance' },
                { id: 'attendance-reports', icon: '📊', label: 'Attendance Reports' }
            ]
        },
        {
            section: '🕐 Timetable',
            items: [
                { id: 'teacher-timetable', icon: '🕐', label: 'My Timetable' }
            ]
        }
    ],

    // ── ACCOUNTANT: Finance + Attendance ───────────────────────────────────
    accountant: [
        {
            section: '🏠 Dashboard',
            items: [
                { id: 'accountant-dashboard', icon: '💰', label: 'Finance Dashboard' },
                { id: 'notification-center',  icon: '🔔', label: 'Notifications' }
            ]
        },
        {
            section: '📋 Attendance',
            items: [
                { id: 'attendance',           icon: '✅', label: 'Record Attendance' },
                { id: 'attendance-reports',   icon: '📊', label: 'Attendance Reports' },
                { id: 'attendance-summary',   icon: '📈', label: 'Attendance Summary' },
                { id: 'attendance-analytics', icon: '📊', label: 'Attendance Analytics' }
            ]
        },
        {
            section: '👥 Students',
            items: [
                { id: 'student-list',    icon: '👥', label: 'All Students' },
                { id: 'student-details', icon: '🔍', label: 'Student Details' },
                { id: 'student-fees',    icon: '💳', label: 'Student Fees' }
            ]
        },
        {
            section: '💰 Finance',
            items: [
                { id: 'fee-structure',       icon: '📋', label: 'Fee Structure' },
                { id: 'record-payment',      icon: '💵', label: 'Record Payment' },
                { id: 'payment-history',     icon: '📜', label: 'Payment History' },
                { id: 'receipt-printing',    icon: '🧾', label: 'Receipts' },
                { id: 'overdue-payments',    icon: '⚠️', label: 'Overdue Payments' },
                { id: 'fee-waivers',         icon: '🎁', label: 'Fee Waivers' },
                { id: 'balances',            icon: '⚖️', label: 'Student Balances' },
                { id: 'payment-reversals',   icon: '↩️', label: 'Payment Reversals' },
                { id: 'financial-reports',   icon: '📊', label: 'Financial Reports' },
                { id: 'fee-term-status',     icon: '📊', label: 'Fee Term Status' },
                { id: 'carry-forward',       icon: '📅', label: 'Fee Carry Forward' },
                { id: 'family-fee-summary',  icon: '👨‍👩‍👧', label: 'Family Fee Summary' }
            ]
        }
    ]
};

// ── STATE ────────────────────────────────────────────────────────────────────
let _currentRole   = null;
let _currentActive = null;

// ── BUILD ────────────────────────────────────────────────────────────────────
function buildSidebar(role) {
    _currentRole = role;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Build full sidebar HTML (replaces any hardcoded shell in index.html)
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-logo" id="sidebar-logo">🏫</div>
            <div class="sidebar-school-name">
                ECOLE LA FONTAINE
                <small id="sidebar-school-subtitle">School Management</small>
            </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
            <div class="sidebar-user-avatar" id="sidebar-avatar">👤</div>
            <div class="sidebar-user-info">
                <div class="sidebar-user-name"  id="sidebar-username">—</div>
                <div class="sidebar-user-role"  id="sidebar-userrole">—</div>
            </div>
            <button class="sidebar-logout" title="Logout" onclick="window.logout && window.logout()">🚪</button>
        </div>
    `;

    _renderNav(role);
    _restoreCollapsed();
    _initOutsideClick();
}

function _renderNav(role) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    const sections = NAV_CONFIG[role] || [];

    nav.innerHTML = sections.map(sec => {
        const secId = 'sec-' + sec.section.replace(/[^a-zA-Z0-9]/g, '');
        return `
        <div class="nav-section" id="${secId}">
            <div class="nav-section-title" onclick="window.toggleNavSection(this.parentElement)">
                ${_esc(sec.section)}
                <span class="nav-section-arrow">▾</span>
            </div>
            <div class="nav-section-items">
                ${sec.items.map(item => `
                    <div class="nav-item" id="nav-${_esc(item.id)}"
                         onclick="window.navigateTo('${_esc(item.id)}')"
                         data-label="${_esc(item.label)}">
                        <span class="nav-icon">${item.icon}</span>
                        <span>${_esc(item.label)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
}

// ── SECTION COLLAPSE ─────────────────────────────────────────────────────────
function toggleNavSection(sectionEl) {
    if (!sectionEl) return;
    sectionEl.classList.toggle('collapsed');
    _saveCollapsed();
}

function _saveCollapsed() {
    const ids = [];
    document.querySelectorAll('.nav-section.collapsed').forEach(s => ids.push(s.id));
    localStorage.setItem('elf_nav_collapsed', JSON.stringify(ids));
}

function _restoreCollapsed() {
    try {
        const saved = JSON.parse(localStorage.getItem('elf_nav_collapsed') || '[]');
        saved.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('collapsed');
        });
    } catch (_) {}
}

// ── ACTIVE ITEM ───────────────────────────────────────────────────────────────
function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-' + id);
    if (el) {
        el.classList.add('active');
        // Auto-expand the parent section
        const sec = el.closest('.nav-section');
        if (sec) sec.classList.remove('collapsed');
    }
    _currentActive = id;
    localStorage.setItem('elf_module', id);
}

// ── SIDEBAR USER INFO ─────────────────────────────────────────────────────────
function updateSidebarUser(user) {
    const emoji = { admin: '👨‍💼', accountant: '💰', teacher: '👩‍🏫' }[user.role] || '👤';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('sidebar-avatar',   emoji);
    set('sidebar-username', user.name);
    set('sidebar-userrole', _roleLabel(user.role));
    set('sidebar-school-subtitle', _roleLabel(user.role) + ' Portal');

    // Logo: try to use school logo image
    const logoEl = document.getElementById('sidebar-logo');
    if (logoEl) {
        const logoUrl = window.AppState?.settings?.school_logo_url;
        if (logoUrl) {
            logoEl.innerHTML = `<img src="${logoUrl}" alt="Logo" style="width:36px;height:36px;object-fit:contain;border-radius:6px">`;
        } else {
            logoEl.textContent = '🏫';
        }
    }
}

// ── SIDEBAR TOGGLE (works on ALL devices) ─────────────────────────────────────
// Desktop: toggles .collapsed class (80px icon mode)
// Mobile (≤768px): slides in/out with overlay

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (window.innerWidth <= 768) {
        // Mobile: slide in/out
        const isOpen = sidebar.classList.toggle('mobile-open');
        _setOverlay(isOpen);
    } else {
        // Desktop: collapse/expand icon mode
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('elf_sidebar_collapsed', isCollapsed ? '1' : '0');
        // Shift main content
        const main = document.querySelector('.main-content');
        if (main) main.classList.toggle('sidebar-collapsed', isCollapsed);
    }
}

function _setOverlay(show) {
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeSidebarMobile;
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active', show);
}

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    _setOverlay(false);
}

// ── OUTSIDE CLICK (desktop: click outside sidebar closes it) ──────────────────
function _initOutsideClick() {
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const toggle  = document.getElementById('menu-toggle');
        if (!sidebar) return;

        const clickedInside  = sidebar.contains(e.target);
        const clickedToggle  = toggle && toggle.contains(e.target);

        if (!clickedInside && !clickedToggle) {
            if (window.innerWidth <= 768) {
                // Mobile: close if open
                if (sidebar.classList.contains('mobile-open')) closeSidebarMobile();
            }
            // Desktop: don't auto-close on outside click (user uses hamburger to toggle)
        }
    }, true); // capture phase to catch all clicks
}

// ── RESTORE DESKTOP COLLAPSED STATE ──────────────────────────────────────────
function restoreSidebarState() {
    if (window.innerWidth > 768) {
        const wasCollapsed = localStorage.getItem('elf_sidebar_collapsed') === '1';
        const sidebar = document.getElementById('sidebar');
        const main    = document.querySelector('.main-content');
        if (wasCollapsed && sidebar) {
            sidebar.classList.add('collapsed');
            if (main) main.classList.add('sidebar-collapsed');
        }
    }
    // Resize listener: clean up mobile state when resizing to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('mobile-open');
            _setOverlay(false);
        }
    });
    // ESC key: close mobile sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebarMobile();
    });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _roleLabel(role) {
    return { admin: 'Admin', accountant: 'Accountant', teacher: 'Teacher' }[role] || role;
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
    );
}

// ── GLOBALS ───────────────────────────────────────────────────────────────────
window.buildSidebar       = buildSidebar;
window.toggleNavSection   = toggleNavSection;
window.setActiveNav       = setActiveNav;
window.updateSidebarUser  = updateSidebarUser;
window.toggleSidebar      = toggleSidebar;
window.closeSidebarMobile = closeSidebarMobile;
window.restoreSidebarState = restoreSidebarState;
window.NAV_CONFIG         = NAV_CONFIG;
