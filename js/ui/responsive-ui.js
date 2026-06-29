// ============================================================
// RESPONSIVE UI - Mobile and responsive behavior
// ============================================================


// Check if device is mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Check if device is tablet
function isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
}

// Check if device is desktop
function isDesktop() {
    return window.innerWidth > 1024;
}

// Initialize responsive behavior
function initResponsive() {
    // Handle window resize
    window.addEventListener('resize', () => {
        handleResize();
    });

    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 100);
    });

    handleResize();
}

function handleResize() {
    const isMobileView = isMobile();

    // Close sidebar on mobile when switching to desktop
    if (!isMobileView) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) overlay.remove();
        }
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('resize', { detail: { isMobile: isMobileView, isTablet: isTablet(), isDesktop: isDesktop() } }));
}

// Make tables horizontally scrollable on mobile
function makeTablesScrollable() {
    if (!isMobile()) return;

    const tables = document.querySelectorAll('.data-table:not(.no-scroll)');
    tables.forEach(table => {
        if (!table.closest('.table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            wrapper.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// Adjust font sizes for mobile
function adjustFontSizes() {
    if (isMobile()) {
        document.documentElement.style.fontSize = '14px';
    } else {
        document.documentElement.style.fontSize = '16px';
    }
}

// Handle touch events for mobile
function initTouchEvents() {
    if (!isMobile()) return;

    // Add touch-friendly styles
    const buttons = document.querySelectorAll('.btn, .nav-item, .quick-btn, .tab-btn');
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', () => {
            btn.style.opacity = '0.7';
        });
        btn.addEventListener('touchend', () => {
            btn.style.opacity = '1';
        });
    });
}

// Make modals fullscreen on mobile
function initMobileModals() {
    if (!isMobile()) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList?.contains('modal')) {
                    node.style.maxWidth = '95%';
                    node.style.margin = '10px';
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Close sidebar when clicking on overlay (mobile)
function initMobileSidebar() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebarMobile;
    document.body.appendChild(overlay);
}

// Responsive table stacking (convert to cards on mobile)
function stackTableOnMobile(tableId, breakpoint = 768) {
    const table = document.getElementById(tableId);
    if (!table) return;

    function checkAndStack() {
        if (window.innerWidth <= breakpoint) {
            table.classList.add('table-stack-mobile');
        } else {
            table.classList.remove('table-stack-mobile');
        }
    }

    checkAndStack();
    window.addEventListener('resize', checkAndStack);
}

// Set viewport height for mobile (fixes 100vh issues)
function setMobileViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    window.addEventListener('resize', () => {
        const newVh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${newVh}px`);
    });
}