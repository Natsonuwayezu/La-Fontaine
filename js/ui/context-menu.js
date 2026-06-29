// ============================================================
// CONTEXT MENU - Right-click context menu
// ============================================================

// Context menu manager
class ContextMenuManager {
    constructor() {
        this.menu = null;
        this.isVisible = false;
        this.init();
    }

    init() {
        this.createMenu();
        this.attachEvents();
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';
        this.menu.style.cssText = `
            position: fixed;
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            min-width: 160px;
            z-index: 10000;
            display: none;
            overflow: hidden;
        `;
        document.body.appendChild(this.menu);
    }

    attachEvents() {
        document.addEventListener('contextmenu', (e) => {
            const target = e.target.closest('[data-context-menu]');
            if (target) {
                e.preventDefault();
                const menuId = target.dataset.contextMenu;
                const menuItems = this.getMenuItems(menuId, target);
                if (menuItems && menuItems.length) {
                    this.show(e.clientX, e.clientY, menuItems, target);
                }
            }
        });

        document.addEventListener('click', () => {
            this.hide();
        });
    }

    getMenuItems(menuId, target) {
        // Default menu items - can be overridden by custom menus
        const menus = {
            'student': [
                { label: '👁️ View Details', action: () => this.navigateTo('student-details', { student_id: target.dataset.id }) },
                { label: '✏️ Edit Student', action: () => this.navigateTo('enroll-student', { edit_id: target.dataset.id }) },
                { label: '💰 Record Payment', action: () => this.navigateTo('record-payment', { student_id: target.dataset.id }) },
                { divider: true },
                { label: '📄 Generate Report Card', action: () => this.navigateTo('report-cards', { student_id: target.dataset.id }) }
            ],
            'assessment': [
                { label: '✏️ Edit', action: () => this.navigateTo('marks-entry', { assessment_id: target.dataset.id }) },
                { label: '🔒 Lock', action: () => this.lockAssessment(target.dataset.id) },
                { label: '📊 View Statistics', action: () => this.navigateTo('statistics', { assessment_id: target.dataset.id }) },
                { divider: true },
                { label: '📥 Export to Excel', action: () => this.exportAssessment(target.dataset.id) }
            ],
            'fee': [
                { label: '💰 Record Payment', action: () => this.navigateTo('record-payment', { student_id: target.dataset.studentId }) },
                { label: '🎁 Apply Waiver', action: () => this.applyWaiver(target.dataset.studentId, target.dataset.feeId) },
                { divider: true },
                { label: '📜 View History', action: () => this.navigateTo('payment-history', { student_id: target.dataset.studentId }) }
            ]
        };

        return menus[menuId] || [];
    }

    show(x, y, items, target) {
        this.menu.innerHTML = '';

        for (const item of items) {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                divider.style.cssText = 'height: 1px; background: var(--border-light); margin: 4px 0;';
                this.menu.appendChild(divider);
                continue;
            }

            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.style.cssText = 'padding: 8px 16px; cursor: pointer; transition: background 0.15s;';
            menuItem.textContent = item.label;
            menuItem.onmouseenter = () => menuItem.style.background = 'var(--bg-tertiary)';
            menuItem.onmouseleave = () => menuItem.style.background = '';
            menuItem.onclick = () => {
                item.action(target);
                this.hide();
            };
            this.menu.appendChild(menuItem);
        }

        // Position menu
        const menuRect = this.menu.getBoundingClientRect();
        let left = x;
        let top = y;

        if (x + menuRect.width > window.innerWidth) {
            left = window.innerWidth - menuRect.width - 10;
        }
        if (y + menuRect.height > window.innerHeight) {
            top = window.innerHeight - menuRect.height - 10;
        }

        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
        this.menu.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        if (this.menu) {
            this.menu.style.display = 'none';
        }
        this.isVisible = false;
    }

    navigateTo(module, params) {
        if (window.navigateToWithData) {
            window.navigateToWithData(module, params);
        } else if (window.navigateTo) {
            window.navigateTo(module);
        }
    }

    lockAssessment(id) {
        if (window.lockAssessment) {
            window.lockAssessment(id);
        }
    }

    exportAssessment(id) {
        if (window.exportAssessmentToExcel) {
            window.exportAssessmentToExcel(id);
        }
    }

    applyWaiver(studentId, feeId) {
        if (window.openFullWaiverModalForStudent) {
            window.openFullWaiverModalForStudent(studentId);
        }
    }
}

// Initialize context menu
let contextMenu = null;

function initContextMenu() {
    if (!contextMenu) {
        contextMenu = new ContextMenuManager();
    }
}

// Register context menu for an element
function registerContextMenu(element, menuId, data = {}) {
    if (!element) return;
    element.setAttribute('data-context-menu', menuId);
    for (const [key, value] of Object.entries(data)) {
        element.setAttribute(`data-${key}`, value);
    }
}