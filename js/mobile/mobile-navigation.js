// js/mobile/mobile-navigation.js
// Mobile Navigation Module - Handle bottom navigation bar and mobile menus

let bottomNav = null;
let currentMobileTab = 'dashboard';

export function initMobileNavigation() {
    createBottomNav();
    initMobileMenuToggle();
    initMobileSubmenuHandling();
}

function createBottomNav() {
    // Only create on mobile devices
    if (window.innerWidth > 768) return;

    const user = window.state?.currentUser;
    if (!user) return;

    const navItems = getNavItemsForRole(user.role);

    bottomNav = document.createElement('div');
    bottomNav.id = 'bottom-nav';
    bottomNav.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--bg-secondary);
        border-top: 1px solid var(--border-light);
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 8px 12px;
        z-index: 1000;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    `;

    navItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'mobile-nav-btn';
        btn.dataset.page = item.id;
        btn.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 6px;
            border-radius: 8px;
            transition: all 0.2s;
            color: var(--text-muted);
        `;
        btn.innerHTML = `
            <span style="font-size: 20px;">${item.icon}</span>
            <span style="font-size: 10px;">${item.label}</span>
        `;

        btn.onclick = () => {
            document.querySelectorAll('.mobile-nav-btn').forEach(b => {
                b.style.color = 'var(--text-muted)';
                b.style.background = 'transparent';
            });
            btn.style.color = 'var(--role-primary)';
            btn.style.background = 'var(--role-light)';
            currentMobileTab = item.id;
            window.navigateTo(item.id);
        };

        bottomNav.appendChild(btn);
    });

    document.body.appendChild(bottomNav);

    // Add padding to main content to account for bottom nav
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.paddingBottom = '70px';
    }

    // Handle window resize
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768 && bottomNav) {
            bottomNav.style.display = 'none';
            if (mainContent) mainContent.style.paddingBottom = '0';
        } else if (window.innerWidth <= 768 && bottomNav) {
            bottomNav.style.display = 'flex';
            if (mainContent) mainContent.style.paddingBottom = '70px';
        }
    });

    // Trigger initial resize check
    if (window.innerWidth <= 768) {
        bottomNav.style.display = 'flex';
    } else {
        bottomNav.style.display = 'none';
    }
}

function getNavItemsForRole(role) {
    const commonItems = [
        { id: 'dashboard', icon: '📊', label: 'Home' },
        { id: 'notifications', icon: '🔔', label: 'Alerts' }
    ];

    if (role === 'admin') {
        return [
            { id: 'dashboard', icon: '📊', label: 'Home' },
            { id: 'students', icon: '👥', label: 'Students' },
            { id: 'marks-entry', icon: '✏️', label: 'Marks' },
            { id: 'fees', icon: '💰', label: 'Fees' },
            { id: 'settings', icon: '⚙️', label: 'Settings' }
        ];
    } else if (role === 'accountant') {
        return [
            { id: 'dashboard', icon: '📊', label: 'Home' },
            { id: 'students', icon: '👥', label: 'Students' },
            { id: 'payments', icon: '💰', label: 'Payments' },
            { id: 'reports', icon: '📊', label: 'Reports' }
        ];
    } else if (role === 'teacher') {
        return [
            { id: 'dashboard', icon: '📊', label: 'Home' },
            { id: 'marks-entry', icon: '✏️', label: 'Marks' },
            { id: 'students', icon: '👥', label: 'Students' },
            { id: 'timetable', icon: '🕐', label: 'Timetable' }
        ];
    }

    return commonItems;
}

function initMobileMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function (e) {
            if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('mobile-open')) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }
}

function initMobileSubmenuHandling() {
    // Make navigation sections collapsible on mobile
    const navSections = document.querySelectorAll('.nav-section');

    navSections.forEach(section => {
        const title = section.querySelector('.nav-section-title');
        if (title && window.innerWidth <= 768) {
            title.addEventListener('click', function (e) {
                e.preventDefault();
                section.classList.toggle('collapsed');
            });
        }
    });
}

export function updateMobileNavBadge(count) {
    if (!bottomNav) return;

    const notifBtn = bottomNav.querySelector('.mobile-nav-btn[data-page="notifications"]');
    if (notifBtn && count > 0) {
        const existingBadge = notifBtn.querySelector('.badge');
        if (existingBadge) {
            existingBadge.textContent = count > 9 ? '9+' : count;
        } else {
            const badge = document.createElement('span');
            badge.className = 'badge badge-danger';
            badge.style.cssText = 'position:absolute;top:-2px;right:-2px;font-size:9px;padding:2px 4px;min-width:16px';
            badge.textContent = count > 9 ? '9+' : count;
            notifBtn.style.position = 'relative';
            notifBtn.appendChild(badge);
        }
    }
}

export function hideBottomNav() {
    if (bottomNav) {
        bottomNav.style.display = 'none';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.paddingBottom = '0';
    }
}

export function showBottomNav() {
    if (bottomNav && window.innerWidth <= 768) {
        bottomNav.style.display = 'flex';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.paddingBottom = '70px';
    }
}