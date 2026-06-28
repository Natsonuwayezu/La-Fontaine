// js/mobile/mobile-modals.js
// Mobile Modals Module - Optimized modal handling for mobile devices

export function initMobileModals() {
    if (!isMobileDevice()) return;

    enhanceModalBehavior();
    addSwipeToClose();
    optimizeModalContent();
    handleKeyboardOnMobile();
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function enhanceModalBehavior() {
    // Override showModal to add mobile optimizations
    const originalShowModal = window.showModal;
    if (originalShowModal) {
        window.showModal = function (html) {
            originalShowModal(html);
            setTimeout(() => {
                const modal = document.querySelector('.modal-overlay:last-child');
                if (modal) {
                    optimizeModalForMobile(modal);
                }
            }, 50);
        };
    }

    // Also patch any existing modals
    document.addEventListener('DOMNodeInserted', function (e) {
        if (e.target.classList && e.target.classList.contains('modal-overlay')) {
            optimizeModalForMobile(e.target);
        }
    });
}

function optimizeModalForMobile(modal) {
    const modalContent = modal.querySelector('.modal');
    if (!modalContent) return;

    // Full screen on mobile
    modalContent.style.maxWidth = '95%';
    modalContent.style.width = '95%';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.margin = 'auto';

    // Make modal draggable (pull to dismiss)
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const header = modalContent.querySelector('.modal-header');
    if (header) {
        header.style.cursor = 'grab';
        header.style.touchAction = 'none';

        header.addEventListener('touchstart', function (e) {
            startY = e.touches[0].clientY;
            isDragging = true;
            header.style.cursor = 'grabbing';
        });

        header.addEventListener('touchmove', function (e) {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const delta = currentY - startY;

            if (delta > 0) {
                modalContent.style.transform = `translateY(${delta}px)`;
                modalContent.style.transition = 'none';
            }
        });

        header.addEventListener('touchend', function () {
            isDragging = false;
            header.style.cursor = 'grab';

            const delta = currentY - startY;
            if (delta > 100) {
                // Dismiss modal
                closeModal();
            } else {
                // Snap back
                modalContent.style.transform = '';
                modalContent.style.transition = 'transform 0.2s ease';
                setTimeout(() => {
                    modalContent.style.transition = '';
                }, 200);
            }
            startY = 0;
            currentY = 0;
        });
    }

    // Adjust button sizes for touch
    const buttons = modalContent.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.style.minHeight = '44px';
        btn.style.padding = '12px 16px';
    });

    // Make form inputs larger
    const inputs = modalContent.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.style.fontSize = '16px';
        input.style.padding = '12px';
    });
}

function addSwipeToClose() {
    document.addEventListener('touchstart', function (e) {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;

        const touchStart = e.touches[0].clientY;

        const handleTouchMove = function (e) {
            const touchCurrent = e.touches[0].clientY;
            const delta = touchCurrent - touchStart;

            if (delta > 50) {
                modal.style.transform = `translateY(${delta}px)`;
                modal.style.transition = 'none';
            }
        };

        const handleTouchEnd = function (e) {
            const modal = document.querySelector('.modal-overlay');
            if (modal && modal.style.transform) {
                const transform = modal.style.transform;
                const match = transform.match(/translateY\((\d+)px\)/);
                if (match && parseInt(match[1]) > 100) {
                    closeModal();
                } else {
                    modal.style.transform = '';
                    modal.style.transition = 'transform 0.2s ease';
                    setTimeout(() => {
                        if (modal) modal.style.transition = '';
                    }, 200);
                }
            }
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    });
}

function optimizeModalContent() {
    // Ensure modal content is scrollable
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .modal {
                max-height: 85vh !important;
                display: flex;
                flex-direction: column;
            }
            .modal-body {
                flex: 1;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch;
            }
            .modal-footer {
                flex-shrink: 0;
            }
            .modal-overlay {
                align-items: flex-end !important;
                justify-content: center !important;
            }
            .modal {
                border-radius: 20px 20px 0 0 !important;
                animation: slideUp 0.3s ease !important;
            }
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        }
    `;
    document.head.appendChild(style);
}

function handleKeyboardOnMobile() {
    // When keyboard opens, adjust modal position
    const inputs = document.querySelectorAll('input, textarea');

    inputs.forEach(input => {
        input.addEventListener('focus', function () {
            setTimeout(() => {
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.scrollTop = this.offsetTop - 100;
                }
            }, 300);
        });
    });
}

export function showMobileBottomSheet(content, options = {}) {
    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet';
    sheet.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--bg-secondary);
        border-radius: 20px 20px 0 0;
        z-index: 10001;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    `;

    sheet.innerHTML = `
        <div class="bottom-sheet-handle" style="
            width: 40px;
            height: 4px;
            background: var(--border-medium);
            border-radius: 2px;
            margin: 12px auto;
            cursor: pointer;
        "></div>
        <div class="bottom-sheet-header" style="
            padding: 0 16px 12px;
            border-bottom: 1px solid var(--border-light);
            font-weight: 600;
            font-size: 18px;
        ">${options.title || 'Options'}</div>
        <div class="bottom-sheet-content" style="
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        ">${content}</div>
        ${options.showCancel ? `
            <div class="bottom-sheet-footer" style="
                padding: 12px 16px;
                border-top: 1px solid var(--border-light);
            ">
                <button class="btn btn-outline" style="width:100%" onclick="closeBottomSheet()">Cancel</button>
            </div>
        ` : ''}
    `;

    document.body.appendChild(sheet);

    // Animate in
    setTimeout(() => {
        sheet.style.transform = 'translateY(0)';
    }, 10);

    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    overlay.onclick = closeBottomSheet;
    document.body.appendChild(overlay);
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);

    // Handle pull to dismiss
    const handle = sheet.querySelector('.bottom-sheet-handle');
    let startY = 0;
    let currentY = 0;

    handle.addEventListener('touchstart', function (e) {
        startY = e.touches[0].clientY;
    });

    handle.addEventListener('touchmove', function (e) {
        currentY = e.touches[0].clientY;
        const delta = currentY - startY;
        if (delta > 0) {
            sheet.style.transform = `translateY(${delta}px)`;
        }
    });

    handle.addEventListener('touchend', function () {
        const delta = currentY - startY;
        if (delta > 100) {
            closeBottomSheet();
        } else {
            sheet.style.transform = 'translateY(0)';
        }
        startY = 0;
        currentY = 0;
    });

    window.closeBottomSheet = function () {
        sheet.style.transform = 'translateY(100%)';
        overlay.style.opacity = '0';
        setTimeout(() => {
            sheet.remove();
            overlay.remove();
        }, 300);
        delete window.closeBottomSheet;
    };
}

export function showMobileActionSheet(actions, onSelect) {
    const actionList = actions.map(action => `
        <button class="action-sheet-item" data-value="${action.value}" style="
            width: 100%;
            padding: 16px;
            text-align: center;
            background: none;
            border: none;
            border-bottom: 1px solid var(--border-light);
            font-size: 16px;
            cursor: pointer;
        ">${action.label}</button>
    `).join('');

    showMobileBottomSheet(actionList, { title: 'Select Option', showCancel: true });

    // Attach event listeners
    setTimeout(() => {
        document.querySelectorAll('.action-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                onSelect(item.dataset.value);
                closeBottomSheet();
            });
        });
    }, 100);
}