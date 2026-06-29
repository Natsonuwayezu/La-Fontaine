// js/mobile/mobile-topbar.js
// Mobile Topbar Module - Optimized topbar for mobile devices

function initMobileTopbar() {
    if (!isMobileDevice()) return;

    enhanceTopbar();
    addSearchOverlay();
    optimizeUserMenu();
    addBreadcrumbNavigation();
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function enhanceTopbar() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Make topbar sticky
    topbar.style.position = 'sticky';
    topbar.style.top = '0';
    topbar.style.zIndex = '99';
    topbar.style.backdropFilter = 'blur(10px)';
    topbar.style.background = 'var(--bg-secondary)';

    // Simplify topbar content on mobile
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
        pageTitle.style.fontSize = '1rem';
        pageTitle.style.fontWeight = '600';
        pageTitle.style.whiteSpace = 'nowrap';
        pageTitle.style.overflow = 'hidden';
        pageTitle.style.textOverflow = 'ellipsis';
        pageTitle.style.maxWidth = '150px';
    }

    // Hide less important items
    const phaseBadge = document.querySelector('.phase-badge-compact');
    if (phaseBadge) {
        phaseBadge.style.display = 'none';
    }

    // Add search button if not present
    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight && !document.querySelector('.mobile-search-btn')) {
        const searchBtn = document.createElement('button');
        searchBtn.className = 'mobile-search-btn';
        searchBtn.innerHTML = '🔍';
        searchBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 8px;
        `;
        searchBtn.onclick = showSearchOverlay;
        topbarRight.insertBefore(searchBtn, topbarRight.firstChild);
    }
}

function addSearchOverlay() {
    // Create search overlay if not exists
    if (document.getElementById('mobile-search-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mobile-search-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-primary);
        z-index: 1000;
        display: none;
        flex-direction: column;
        padding: 16px;
    `;

    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <button id="close-search-overlay" style="background: none; border: none; font-size: 24px; cursor: pointer;">←</button>
            <input type="text" id="mobile-search-input" placeholder="Search students, classes, assessments..." style="
                flex: 1;
                padding: 12px 16px;
                border: 1px solid var(--border-medium);
                border-radius: 25px;
                background: var(--bg-secondary);
                font-size: 16px;
            ">
        </div>
        <div id="mobile-search-results" style="flex: 1; overflow-y: auto;"></div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('close-search-overlay')?.addEventListener('click', hideSearchOverlay);

    const searchInput = document.getElementById('mobile-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(performMobileSearch, 300));
        searchInput.addEventListener('focus', () => {
            performMobileSearch();
        });
    }
}

function showSearchOverlay() {
    const overlay = document.getElementById('mobile-search-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('mobile-search-input')?.focus();
    }
}

function hideSearchOverlay() {
    const overlay = document.getElementById('mobile-search-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.getElementById('mobile-search-results').innerHTML = '';
        document.getElementById('mobile-search-input').value = '';
    }
}

async function performMobileSearch() {
    const query = document.getElementById('mobile-search-input')?.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('mobile-search-results');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Type at least 2 characters to search</div>';
        return;
    }

    resultsContainer.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Searching...</p></div>';

    // Search across different data types
    const results = [];

    // Search students
    if (window.state?.students) {
        const students = window.state.students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(query) ||
            (s.student_code || '').toLowerCase().includes(query)
        ).slice(0, 5);

        students.forEach(s => {
            results.push({
                type: 'student',
                title: `${s.first_name} ${s.last_name}`,
                subtitle: `Student • ${s.student_code || 'No code'}`,
                icon: '👨‍🎓',
                action: () => window.goToStudentDetails?.(s.id)
            });
        });
    }

    // Search classes
    if (window.state?.classes) {
        const classes = window.state.classes.filter(c =>
            c.name.toLowerCase().includes(query)
        ).slice(0, 3);

        classes.forEach(c => {
            results.push({
                type: 'class',
                title: c.name,
                subtitle: `Class • ${c.level || 'General'}`,
                icon: '🏛️',
                action: () => window.goToClassRegister?.(c.id)
            });
        });
    }

    // Search assessments
    if (window.state?.assessments) {
        const assessments = window.state.assessments.filter(a =>
            a.assessment_name.toLowerCase().includes(query)
        ).slice(0, 3);

        assessments.forEach(a => {
            results.push({
                type: 'assessment',
                title: a.assessment_name,
                subtitle: `Assessment • ${a.assessment_type}`,
                icon: '📝',
                action: () => window.goToMarksEntry?.(a.id)
            });
        });
    }

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No results found</div>';
        return;
    }

    resultsContainer.innerHTML = results.map(r => `
        <div class="search-result-item" data-type="${r.type}" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-bottom: 1px solid var(--border-light);
            cursor: pointer;
        ">
            <span style="font-size: 24px;">${r.icon}</span>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${escapeHtml(r.title)}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(r.subtitle)}</div>
            </div>
            <span style="color: var(--text-muted);">→</span>
        </div>
    `).join('');

    // Attach click handlers
    document.querySelectorAll('.search-result-item').forEach((el, idx) => {
        el.addEventListener('click', () => {
            results[idx].action();
            hideSearchOverlay();
        });
    });
}

function optimizeUserMenu() {
    const userMenu = document.querySelector('.user-menu');
    if (!userMenu) return;

    // Simplify user menu on mobile
    const userName = userMenu.querySelector('.user-name');
    if (userName) {
        userName.style.display = 'none';
    }

    const userAvatar = userMenu.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.style.width = '36px';
        userAvatar.style.height = '36px';
        userAvatar.style.fontSize = '18px';
    }
}

function addBreadcrumbNavigation() {
    // Add breadcrumb for better navigation on mobile
    const dynamicContent = document.getElementById('dynamic-content');
    if (!dynamicContent) return;

    const breadcrumb = document.createElement('div');
    breadcrumb.id = 'mobile-breadcrumb';
    breadcrumb.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--bg-tertiary);
        font-size: 12px;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: none;
        border-bottom: 1px solid var(--border-light);
    `;
    breadcrumb.innerHTML = '<span style="color: var(--text-muted);">🏠</span> <span>Dashboard</span>';

    dynamicContent.parentNode.insertBefore(breadcrumb, dynamicContent);

    // Update breadcrumb on navigation
    const originalNavigateTo = window.navigateTo;
    if (originalNavigateTo) {
        window.navigateTo = function (page) {
            originalNavigateTo(page);
            updateBreadcrumb(page);
        };
    }
}

function updateBreadcrumb(page) {
    const breadcrumb = document.getElementById('mobile-breadcrumb');
    if (!breadcrumb) return;

    const pageNames = {
        'admin-dashboard': 'Dashboard',
        'accountant-dashboard': 'Dashboard',
        'teacher-dashboard': 'Dashboard',
        'marks-entry': 'Marks Entry',
        'student-list': 'Students',
        'fee-structure': 'Fee Structure',
        'payment-history': 'Payments',
        'timetable': 'Timetable',
        'report-cards': 'Report Cards',
        'settings': 'Settings'
    };

    const pageName = pageNames[page] || page.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    breadcrumb.innerHTML = `<span style="color: var(--text-muted);">🏠</span> <span>›</span> <span>${escapeHtml(pageName)}</span>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}