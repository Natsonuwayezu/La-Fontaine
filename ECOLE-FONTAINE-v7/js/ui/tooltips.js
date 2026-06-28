// ============================================================
// TOOLTIPS UI - Tooltip component for hints and help text
// ============================================================

// Tooltip manager
class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.activeTooltips = new Map();
        this.init();
    }

    init() {
        this.createTooltipElement();
        this.attachGlobalListeners();
    }

    createTooltipElement() {
        if (this.tooltip) return;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 12px;
            color: var(--text-primary);
            max-width: 250px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
            box-shadow: var(--shadow-md);
        `;
        document.body.appendChild(this.tooltip);
    }

    attachGlobalListeners() {
        document.addEventListener('mouseenter', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.show(target, target.dataset.tooltip);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.hide();
            }
        }, true);
    }

    show(element, text) {
        if (!this.tooltip) return;

        this.tooltip.textContent = text;
        this.tooltip.style.opacity = '1';

        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 0) {
            top = rect.bottom + 8;
        }
        if (left < 0) {
            left = 8;
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        this.tooltip.style.top = `${top + window.scrollY}px`;
        this.tooltip.style.left = `${left + window.scrollX}px`;
    }

    hide() {
        if (this.tooltip) {
            this.tooltip.style.opacity = '0';
        }
    }
}

// Initialize tooltips
let tooltipManager = null;

export function initTooltips() {
    if (!tooltipManager) {
        tooltipManager = new TooltipManager();
    }
}

// Add tooltip to element
export function addTooltip(element, text) {
    if (!element) return;
    element.setAttribute('data-tooltip', text);
}

// Remove tooltip from element
export function removeTooltip(element) {
    if (!element) return;
    element.removeAttribute('data-tooltip');
}

// Create a help tooltip button
export function createHelpTooltip(text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'help-tooltip';
    button.innerHTML = '❓';
    button.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 14px; margin-left: 6px; opacity: 0.6;';
    button.setAttribute('data-tooltip', text);
    return button;
}

// Add tooltip to form field
export function addFieldTooltip(labelElement, helpText) {
    if (!labelElement) return;
    const tooltipBtn = createHelpTooltip(helpText);
    labelElement.appendChild(tooltipBtn);
}