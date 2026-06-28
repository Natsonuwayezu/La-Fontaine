// ============================================================
// BUTTONS UI - Button loading states and actions
// ============================================================

import { showToast } from './modals.js';

// Set button loading state
export function setButtonLoading(button, isLoading, text = null) {
    if (!button) return;

    if (isLoading) {
        button._originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = text || '<span class="spinner-sm"></span> Loading...';
    } else {
        button.disabled = false;
        button.innerHTML = button._originalText || text || button.innerHTML;
    }
}

// Create a loading button
export function createLoadingButton(text, loadingText = 'Loading...') {
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.innerHTML = text;

    button.setLoading = (isLoading) => {
        if (isLoading) {
            button._originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="spinner-sm"></span> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button._originalText || text;
        }
    };

    return button;
}

// Copy to clipboard button handler
export async function handleCopyToClipboard(text, successMessage = 'Copied to clipboard!') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMessage, 'success');
        return true;
    } catch (err) {
        showToast('Failed to copy', 'error');
        return false;
    }
}

// Print button handler
export function handlePrint(elementId, title = 'Print') {
    const element = document.getElementById(elementId);
    if (!element) {
        showToast('Nothing to print', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Please allow popups to print', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                @media print { body { padding: 0; } }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; }
            </style>
        </head>
        <body>
            ${element.outerHTML}
            <script>window.print(); setTimeout(window.close, 500);<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Confirm delete button handler
export function confirmDelete(onConfirm, itemName = 'item') {
    if (confirm(`Are you sure you want to delete ${itemName}?`)) {
        onConfirm();
    }
}

// Expose functions globally
window.setButtonLoading = setButtonLoading;
window.handleCopyToClipboard = handleCopyToClipboard;
window.handlePrint = handlePrint;
window.confirmDelete = confirmDelete;