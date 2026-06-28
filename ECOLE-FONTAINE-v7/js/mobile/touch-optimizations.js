// js/mobile/touch-optimizations.js
// Touch Optimizations Module - Improve touch interactions on mobile

export function initTouchOptimizations() {
    if (!isTouchDevice()) return;

    optimizeButtonTouchTargets();
    optimizeTableTouchScrolling();
    optimizeFormInputs();
    disableDoubleTapZoom();
    enableActiveStates();
}

function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function optimizeButtonTouchTargets() {
    // Ensure all buttons have minimum touch target size (44x44)
    const buttons = document.querySelectorAll('button, .btn, [role="button"]');

    buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
            btn.style.minWidth = '44px';
            btn.style.minHeight = '44px';
            btn.style.padding = '8px 12px';
        }
    });

    // Add active state for touch feedback
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', function () {
            this.style.opacity = '0.7';
        });
        btn.addEventListener('touchend', function () {
            this.style.opacity = '1';
        });
        btn.addEventListener('touchcancel', function () {
            this.style.opacity = '1';
        });
    });
}

function optimizeTableTouchScrolling() {
    const tables = document.querySelectorAll('.table-wrapper');

    tables.forEach(table => {
        // Enable smooth scrolling for tables
        table.style.overflowX = 'auto';
        table.style.webkitOverflowScrolling = 'touch';

        // Add scroll indicators
        let isScrollable = table.scrollWidth > table.clientWidth;
        if (isScrollable) {
            addScrollIndicators(table);
        }

        // Update indicators on resize
        window.addEventListener('resize', () => {
            isScrollable = table.scrollWidth > table.clientWidth;
            if (isScrollable) {
                addScrollIndicators(table);
            }
        });
    });
}

function addScrollIndicators(table) {
    const container = table.parentElement;
    let indicator = container.querySelector('.scroll-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'scroll-indicator';
        indicator.style.cssText = `
            text-align: center;
            padding: 4px;
            font-size: 10px;
            color: var(--text-muted);
            background: var(--bg-tertiary);
            border-radius: 4px;
            margin-top: 4px;
        `;
        indicator.innerHTML = '← Swipe to see more →';
        container.appendChild(indicator);

        // Hide indicator after scroll
        table.addEventListener('scroll', () => {
            indicator.style.opacity = '0.5';
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 1000);
        });
    }
}

function optimizeFormInputs() {
    // Increase font size on mobile to prevent zoom
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
        if (window.innerWidth <= 768) {
            input.style.fontSize = '16px';

            // Prevent zoom on focus for iOS
            input.addEventListener('focus', function () {
                this.style.fontSize = '16px';
            });
        }
    });

    // Add clear button for search inputs
    const searchInputs = document.querySelectorAll('input[type="search"], .search-input');
    searchInputs.forEach(input => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = '100%';

        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '✕';
        clearBtn.style.cssText = `
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 14px;
            color: var(--text-muted);
            cursor: pointer;
            display: none;
            padding: 4px 8px;
        `;
        clearBtn.onclick = () => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            clearBtn.style.display = 'none';
        };

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value.length > 0 ? 'block' : 'none';
        });

        wrapper.appendChild(clearBtn);
        input.style.paddingRight = '30px';
    });
}

function disableDoubleTapZoom() {
    let lastTouchEnd = 0;

    document.addEventListener('touchend', function (e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

function enableActiveStates() {
    // Add active state styling for touch feedback
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .btn:active, 
            button:active, 
            .nav-item:active,
            .quick-btn:active,
            .stat-card:active {
                transform: scale(0.98);
                transition: transform 0.05s;
            }
            
            .btn, button, .nav-item, .quick-btn {
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            
            input, select, textarea {
                font-size: 16px !important;
            }
        }
    `;
    document.head.appendChild(style);
}

export function enablePullToRefresh(callback) {
    let startY = 0;
    let isRefreshing = false;
    const threshold = 80;

    let refreshElement = null;

    function createRefreshElement() {
        refreshElement = document.createElement('div');
        refreshElement.id = 'pull-to-refresh';
        refreshElement.style.cssText = `
            position: fixed;
            top: -60px;
            left: 0;
            right: 0;
            height: 60px;
            background: var(--bg-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            z-index: 9999;
            transition: top 0.2s;
            border-bottom: 1px solid var(--border-light);
        `;
        refreshElement.innerHTML = '<span>↓ Pull down to refresh</span>';
        document.body.appendChild(refreshElement);
    }

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0 && !isRefreshing) {
            startY = e.touches[0].clientY;
        }
    });

    document.addEventListener('touchmove', function (e) {
        if (window.scrollY === 0 && !isRefreshing && startY > 0) {
            const currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;

            if (pullDistance > 0 && pullDistance <= threshold) {
                if (!refreshElement) createRefreshElement();
                refreshElement.style.top = `${pullDistance - 60}px`;

                if (pullDistance >= threshold - 10) {
                    refreshElement.innerHTML = '<span>Release to refresh</span>';
                } else {
                    refreshElement.innerHTML = '<span>↓ Pull down to refresh</span>';
                }
            }
        }
    });

    document.addEventListener('touchend', function () {
        if (refreshElement) {
            const top = parseInt(refreshElement.style.top);
            if (top >= -10 && callback && !isRefreshing) {
                isRefreshing = true;
                refreshElement.style.top = '0px';
                refreshElement.innerHTML = '<div class="spinner-sm"></div><span>Refreshing...</span>';

                callback().finally(() => {
                    setTimeout(() => {
                        if (refreshElement) {
                            refreshElement.style.top = '-60px';
                            setTimeout(() => {
                                if (refreshElement) refreshElement.remove();
                                refreshElement = null;
                            }, 300);
                        }
                        isRefreshing = false;
                    }, 500);
                });
            } else {
                refreshElement.style.top = '-60px';
                setTimeout(() => {
                    if (refreshElement) refreshElement.remove();
                    refreshElement = null;
                }, 300);
            }
        }
        startY = 0;
    });
}