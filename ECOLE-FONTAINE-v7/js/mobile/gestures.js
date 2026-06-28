// js/mobile/gestures.js
// Gestures Module - Handle touch gestures for mobile devices

export function initGestures() {
    if (!isTouchDevice()) return;

    initSwipeGestures();
    initPinchGestures();
    initLongPressGestures();
}

function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function initSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let minSwipeDistance = 50;

    document.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) return;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                triggerEvent('swiperight', { delta: deltaX });
            } else {
                triggerEvent('swipeleft', { delta: Math.abs(deltaX) });
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                triggerEvent('swipedown', { delta: deltaY });
            } else {
                triggerEvent('swipeup', { delta: Math.abs(deltaY) });
            }
        }
    }
}

function initPinchGestures() {
    let initialDistance = 0;
    let isPinching = false;

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            isPinching = true;
        }
    });

    document.addEventListener('touchmove', function (e) {
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const delta = currentDistance - initialDistance;

            if (Math.abs(delta) > 20) {
                if (delta > 0) {
                    triggerEvent('pinchout', { delta: delta });
                } else {
                    triggerEvent('pinchin', { delta: Math.abs(delta) });
                }
                initialDistance = currentDistance;
            }
        }
    });

    document.addEventListener('touchend', function () {
        isPinching = false;
        initialDistance = 0;
    });

    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

function initLongPressGestures() {
    let pressTimer = null;
    let longPressDuration = 500;

    document.addEventListener('touchstart', function (e) {
        pressTimer = setTimeout(function () {
            triggerEvent('longpress', {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                target: e.target
            });
        }, longPressDuration);
    });

    document.addEventListener('touchend', function () {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });

    document.addEventListener('touchmove', function () {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });
}

function triggerEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail: detail });
    document.dispatchEvent(event);
}

// Swipe handlers for specific UI elements
export function initSwipeForSidebar() {
    const sidebar = document.getElementById('sidebar');
    let touchStartX = 0;

    if (!sidebar) return;

    document.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        const touchEndX = e.changedTouches[0].screenX;
        const deltaX = touchEndX - touchStartX;

        // Swipe from left edge to open sidebar
        if (touchStartX < 30 && deltaX > 50) {
            sidebar.classList.add('mobile-open');
            triggerEvent('sidebaropened', {});
        }

        // Swipe left to close sidebar when open
        if (sidebar.classList.contains('mobile-open') && deltaX < -50) {
            sidebar.classList.remove('mobile-open');
            triggerEvent('sidebarclosed', {});
        }
    }, { passive: true });
}

export function initSwipeForTables() {
    const tables = document.querySelectorAll('.table-wrapper');

    tables.forEach(table => {
        let touchStartX = 0;
        let scrollLeft = 0;

        table.addEventListener('touchstart', function (e) {
            touchStartX = e.changedTouches[0].screenX;
            scrollLeft = table.scrollLeft;
        }, { passive: true });

        table.addEventListener('touchmove', function (e) {
            const touchX = e.changedTouches[0].screenX;
            const deltaX = touchX - touchStartX;
            table.scrollLeft = scrollLeft - deltaX;
        }, { passive: false });
    });
}

export function initPullToRefresh(callback) {
    let startY = 0;
    let isRefreshing = false;
    let pullDistance = 0;
    const threshold = 80;
    let refreshIndicator = null;

    function createRefreshIndicator() {
        refreshIndicator = document.createElement('div');
        refreshIndicator.id = 'pull-to-refresh';
        refreshIndicator.style.cssText = `
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
            font-size: 14px;
            color: var(--text-primary);
            z-index: 10000;
            transition: top 0.2s ease;
            border-bottom: 1px solid var(--border-light);
        `;
        refreshIndicator.innerHTML = `
            <div class="spinner-sm" style="width:20px;height:20px;border:2px solid var(--border-light);border-top-color:var(--role-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <span>Refreshing...</span>
        `;
        document.body.appendChild(refreshIndicator);
    }

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0 && !isRefreshing) {
            startY = e.touches[0].clientY;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (window.scrollY === 0 && !isRefreshing && startY > 0) {
            const currentY = e.touches[0].clientY;
            pullDistance = currentY - startY;

            if (pullDistance > 0 && pullDistance <= threshold) {
                e.preventDefault();
                if (!refreshIndicator) createRefreshIndicator();
                refreshIndicator.style.top = `${pullDistance - 60}px`;

                if (pullDistance >= threshold - 10) {
                    refreshIndicator.innerHTML = `
                        <span>Release to refresh...</span>
                    `;
                } else {
                    refreshIndicator.innerHTML = `
                        <span>↓ Pull down to refresh</span>
                    `;
                }
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', function () {
        if (pullDistance >= threshold && !isRefreshing && callback) {
            isRefreshing = true;
            if (refreshIndicator) {
                refreshIndicator.style.top = '0px';
                refreshIndicator.innerHTML = `
                    <div class="spinner-sm" style="width:20px;height:20px;border:2px solid var(--border-light);border-top-color:var(--role-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                    <span>Refreshing...</span>
                `;
            }

            callback().finally(() => {
                setTimeout(() => {
                    if (refreshIndicator) {
                        refreshIndicator.style.top = '-60px';
                        setTimeout(() => {
                            if (refreshIndicator) refreshIndicator.remove();
                            refreshIndicator = null;
                        }, 300);
                    }
                    isRefreshing = false;
                }, 1000);
            });
        } else if (refreshIndicator) {
            refreshIndicator.style.top = '-60px';
            setTimeout(() => {
                if (refreshIndicator) refreshIndicator.remove();
                refreshIndicator = null;
            }, 300);
        }

        startY = 0;
        pullDistance = 0;
    });
}