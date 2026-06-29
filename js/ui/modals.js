// ============================================================
// MODALS UI - Modal dialog management
// ============================================================

// Show modal with HTML content
function showModal(html, options = {}) {
    const { closeOnOverlay = true, onClose = null } = options;

    const container = document.getElementById('modals-container');
    if (!container) return;

    container.innerHTML = html;

    const modalOverlay = container.querySelector('.modal-overlay');
    if (modalOverlay && closeOnOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
                if (onClose) onClose();
            }
        });
    }
}

// Close current modal
function closeModal(modalId = null) {
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    } else {
        const container = document.getElementById('modals-container');
        if (container) container.innerHTML = '';
    }
}

// Confirm dialog (Promise-based)
function confirmDialog(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const modalId = `confirm-modal-${Date.now()}`;
        const html = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal modal-sm">
                    <div class="modal-header">
                        <h3>⚠️ ${escapeHtml(title)}</h3>
                        <button class="modal-close" onclick="window.closeModal('${modalId}')">✕</button>
                    </div>
                    <div class="modal-body">
                        <p>${escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="window.closeModal('${modalId}'); window._confirmResolve(false)">Cancel</button>
                        <button class="btn btn-danger" onclick="window.closeModal('${modalId}'); window._confirmResolve(true)">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        showModal(html);
        window._confirmResolve = resolve;
    });
}

// Alert dialog
function alertDialog(message, title = 'Notice') {
    return new Promise((resolve) => {
        const modalId = `alert-modal-${Date.now()}`;
        const html = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal modal-sm">
                    <div class="modal-header">
                        <h3>ℹ️ ${escapeHtml(title)}</h3>
                        <button class="modal-close" onclick="window.closeModal('${modalId}')">✕</button>
                    </div>
                    <div class="modal-body">
                        <p>${escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="window.closeModal('${modalId}'); window._alertResolve(true)">OK</button>
                    </div>
                </div>
            </div>
        `;

        showModal(html);
        window._alertResolve = resolve;
    });
}

// Toast notification
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading modal
function showLoadingModal(message = 'Loading...') {
    const modalId = `loading-modal-${Date.now()}`;
    const html = `
        <div class="modal-overlay" id="${modalId}" style="background: rgba(0,0,0,0.3);">
            <div class="modal modal-sm" style="text-align:center;">
                <div class="modal-body" style="padding: 30px;">
                    <div class="spinner" style="margin: 0 auto 16px;"></div>
                    <p>${escapeHtml(message)}</p>
                </div>
            </div>
        </div>
    `;
    showModal(html);
    return modalId;
}

// Hide loading modal
function hideLoadingModal(modalId) {
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    }
}

// Prompt dialog
function promptDialog(message, defaultValue = '', title = 'Input Required') {
    return new Promise((resolve) => {
        const modalId = `prompt-modal-${Date.now()}`;
        const html = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal modal-sm">
                    <div class="modal-header">
                        <h3>✏️ ${escapeHtml(title)}</h3>
                        <button class="modal-close" onclick="window.closeModal('${modalId}'); window._promptResolve(null)">✕</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 12px;">${escapeHtml(message)}</p>
                        <input type="text" id="prompt-input" class="form-control" value="${escapeHtml(defaultValue)}" style="width: 100%;">
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="window.closeModal('${modalId}'); window._promptResolve(null)">Cancel</button>
                        <button class="btn btn-primary" onclick="window.closeModal('${modalId}'); window._promptResolve(document.getElementById('prompt-input').value)">OK</button>
                    </div>
                </div>
            </div>
        `;

        showModal(html);
        window._promptResolve = resolve;
        setTimeout(() => {
            const input = document.getElementById('prompt-input');
            if (input) input.focus();
        }, 100);
    });
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Expose functions globally
window.showModal = showModal;
window.closeModal = closeModal;
window.confirmDialog = confirmDialog;
window.showToast = showToast;