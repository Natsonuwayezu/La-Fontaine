// ============================================================
// ANIMATION ENGINE - Smooth animations and transitions
// ============================================================

// Animation configurations
const ANIMATION_DEFAULTS = {
    duration: 300,
    easing: 'ease-in-out'
};

// Fade in an element
function fadeIn(element, duration = ANIMATION_DEFAULTS.duration) {
    if (!element) return;
    element.style.opacity = '0';
    element.style.display = 'block';
    element.style.transition = `opacity ${duration}ms ease`;

    // Force reflow
    element.offsetHeight;
    element.style.opacity = '1';

    setTimeout(() => {
        element.style.transition = '';
    }, duration);
}

// Fade out an element
function fadeOut(element, duration = ANIMATION_DEFAULTS.duration, remove = true) {
    if (!element) return;
    element.style.transition = `opacity ${duration}ms ease`;
    element.style.opacity = '0';

    setTimeout(() => {
        if (remove && element.parentNode) {
            element.style.display = 'none';
        }
        element.style.transition = '';
    }, duration);
}

// Slide down an element
function slideDown(element, duration = ANIMATION_DEFAULTS.duration) {
    if (!element) return;
    const height = element.scrollHeight;
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.display = 'block';
    element.style.transition = `height ${duration}ms ${ANIMATION_DEFAULTS.easing}`;

    // Force reflow
    element.offsetHeight;
    element.style.height = `${height}px`;

    setTimeout(() => {
        element.style.overflow = '';
        element.style.height = '';
        element.style.transition = '';
    }, duration);
}

// Slide up an element
function slideUp(element, duration = ANIMATION_DEFAULTS.duration, remove = true) {
    if (!element) return;
    const height = element.scrollHeight;
    element.style.overflow = 'hidden';
    element.style.height = `${height}px`;
    element.style.transition = `height ${duration}ms ${ANIMATION_DEFAULTS.easing}`;

    // Force reflow
    element.offsetHeight;
    element.style.height = '0';

    setTimeout(() => {
        element.style.overflow = '';
        element.style.height = '';
        element.style.transition = '';
        if (remove) element.style.display = 'none';
    }, duration);
}

// Toggle slide (expand/collapse)
function slideToggle(element, duration = ANIMATION_DEFAULTS.duration) {
    if (!element) return;
    const isVisible = element.style.display !== 'none' && element.offsetHeight > 0;
    if (isVisible) {
        slideUp(element, duration);
    } else {
        slideDown(element, duration);
    }
}

// Pulse animation (attention grabber)
function pulse(element, duration = 500) {
    if (!element) return;
    element.style.transition = `transform ${duration / 2}ms ease`;
    element.style.transform = 'scale(1.05)';

    setTimeout(() => {
        element.style.transform = 'scale(1)';
        setTimeout(() => {
            element.style.transition = '';
        }, duration / 2);
    }, duration / 2);
}

// Shake animation (error indication)
function shake(element, duration = 400) {
    if (!element) return;
    element.style.transition = `transform ${duration / 3}ms ease`;
    element.style.transform = 'translateX(-5px)';

    setTimeout(() => {
        element.style.transform = 'translateX(5px)';
        setTimeout(() => {
            element.style.transform = 'translateX(-3px)';
            setTimeout(() => {
                element.style.transform = 'translateX(3px)';
                setTimeout(() => {
                    element.style.transform = 'translateX(0)';
                    setTimeout(() => {
                        element.style.transition = '';
                    }, duration / 3);
                }, duration / 3);
            }, duration / 3);
        }, duration / 3);
    }, duration / 3);
}

// Highlight animation (flash)
function highlight(element, color = '#fef3c7', duration = 1000) {
    if (!element) return;
    const originalBg = element.style.backgroundColor;
    element.style.transition = `background-color ${duration / 2}ms ease`;
    element.style.backgroundColor = color;

    setTimeout(() => {
        element.style.backgroundColor = originalBg;
        setTimeout(() => {
            element.style.transition = '';
        }, duration / 2);
    }, duration / 2);
}

// Animate number counter
function animateNumber(element, start, end, duration = 1000, suffix = '') {
    if (!element) return;
    const range = end - start;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    const timer = setInterval(() => {
        current += Math.sign(range);
        element.textContent = `${current}${suffix}`;
        if (current === end) {
            clearInterval(timer);
        }
    }, stepTime);
}

// Animate progress bar
function animateProgressBar(element, targetPercent, duration = 500) {
    if (!element) return;
    element.style.transition = `width ${duration}ms ${ANIMATION_DEFAULTS.easing}`;
    element.style.width = `${targetPercent}%`;

    setTimeout(() => {
        element.style.transition = '';
    }, duration);
}

// Page transition
function pageTransition(enterAnimation, exitAnimation, callback) {
    const content = document.getElementById('dynamic-content');
    if (!content) {
        if (callback) callback();
        return;
    }

    fadeOut(content, 150);
    setTimeout(() => {
        if (callback) callback();
        setTimeout(() => {
            fadeIn(content, 150);
        }, 50);
    }, 150);
}

// Loading spinner with animation
function showLoadingSpinner(container) {
    if (!container) container = document.getElementById('dynamic-content');
    if (!container) return;

    const spinner = document.createElement('div');
    spinner.className = 'loading-container';
    spinner.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
    spinner.style.opacity = '0';
    container.innerHTML = '';
    container.appendChild(spinner);
    fadeIn(spinner, 200);
}

// Hide loading spinner
function hideLoadingSpinner(container) {
    const spinner = container?.querySelector('.loading-container');
    if (spinner) {
        fadeOut(spinner, 200, true);
    }
}

// Animate table rows (staggered)
function animateTableRows(tableBody, staggerDelay = 30) {
    if (!tableBody) return;
    const rows = Array.from(tableBody.children);
    rows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px)';
        row.style.transition = `all 0.2s ease ${index * staggerDelay}ms`;
        setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 50);
    });
}