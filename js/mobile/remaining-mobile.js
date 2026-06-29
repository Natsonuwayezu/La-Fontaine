// js/mobile/remaining-mobile.js
// Complete Mobile Module - Gestures, Navigation, Tables, Modals, Topbar


// Main initialization function for all mobile features
function initMobileFeatures() {
    if (!isMobileDevice()) return;

    initGestures();
    initSwipeForSidebar();
    initMobileNavigation();
    initTouchOptimizations();
    initMobileTables();
    initMobileModals();
    initMobileTopbar();

    // Enable pull to refresh on dashboard
    enablePullToRefreshTouch(() => {
        return refreshDashboardData();
    });

    // Handle orientation changes
    window.addEventListener('orientationchange', function () {
        setTimeout(() => {
            handleOrientationChange();
            resetTableDisplay();
        }, 100);
    });
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

async function refreshDashboardData() {
    const user = window.state?.currentUser;
    if (!user) return;

    try {
        // Reload dashboard data
        if (user.role === 'admin' && window.renderAdminDashboard) {
            const container = document.getElementById('dynamic-content');
            await window.renderAdminDashboard(container);
        } else if (user.role === 'accountant' && window.renderAccountantDashboard) {
            const container = document.getElementById('dynamic-content');
            await window.renderAccountantDashboard(container);
        } else if (user.role === 'teacher' && window.renderTeacherDashboard) {
            const container = document.getElementById('dynamic-content');
            await window.renderTeacherDashboard(container);
        }

        showToast('Refreshed successfully', 'success', 1500);
    } catch (error) {
        console.error('Refresh failed:', error);
        showToast('Refresh failed', 'error', 1500);
    }
}

// Export individual functions for selective use

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileFeatures);
} else {
    initMobileFeatures();
}

// Also re-initialize after page navigation (for dynamically loaded content)
const originalNavigateTo = window.navigateTo;
if (originalNavigateTo) {
    window.navigateTo = async function (page) {
        await originalNavigateTo(page);
        setTimeout(() => {
            initMobileTables();
            initTouchOptimizations();
        }, 200);
    };
}