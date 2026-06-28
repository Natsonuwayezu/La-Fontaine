// ============================================================
// ACCORDIONS UI - Accordion component management
// ============================================================

// Accordion manager class
export class AccordionManager {
    constructor(container, options = {}) {
        this.container = container;
        this.items = [];
        this.multiple = options.multiple || false;
        this.onToggle = options.onToggle || null;
    }

    addItem(title, content, isOpen = false) {
        this.items.push({ title, content, isOpen });
        return this;
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const itemDiv = document.createElement('div');
            itemDiv.className = 'accordion-item';
            itemDiv.style.border = '1px solid var(--border-light)';
            itemDiv.style.borderRadius = 'var(--r-md)';
            itemDiv.style.marginBottom = 'var(--sm)';
            itemDiv.style.overflow = 'hidden';

            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.style.cssText = 'padding: var(--md) var(--lg); background: var(--bg-tertiary); cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 600;';
            header.innerHTML = `${item.title} <span class="accordion-arrow">${item.isOpen ? '▾' : '▸'}</span>`;

            const content = document.createElement('div');
            content.className = 'accordion-content';
            content.style.cssText = `padding: var(--md) var(--lg); border-top: 1px solid var(--border-light); display: ${item.isOpen ? 'block' : 'none'};`;
            content.innerHTML = typeof item.content === 'string' ? item.content : '';
            if (typeof item.content === 'function') {
                item.content(content);
            }

            header.onclick = () => this.toggleItem(i);

            itemDiv.appendChild(header);
            itemDiv.appendChild(content);
            this.container.appendChild(itemDiv);
        }
    }

    toggleItem(index) {
        const item = this.items[index];

        if (!this.multiple) {
            // Close all others
            for (let i = 0; i < this.items.length; i++) {
                if (i !== index && this.items[i].isOpen) {
                    this.items[i].isOpen = false;
                    this.updateItemUI(i);
                }
            }
        }

        item.isOpen = !item.isOpen;
        this.updateItemUI(index);

        if (this.onToggle) {
            this.onToggle(index, item.isOpen);
        }
    }

    updateItemUI(index) {
        const itemDiv = this.container.children[index];
        if (!itemDiv) return;

        const arrow = itemDiv.querySelector('.accordion-arrow');
        const content = itemDiv.querySelector('.accordion-content');

        if (this.items[index].isOpen) {
            arrow.textContent = '▾';
            content.style.display = 'block';
        } else {
            arrow.textContent = '▸';
            content.style.display = 'none';
        }
    }

    openAll() {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].isOpen = true;
            this.updateItemUI(i);
        }
    }

    closeAll() {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].isOpen = false;
            this.updateItemUI(i);
        }
    }
}

// Create a simple accordion
export function createAccordion(containerId, items, multiple = false) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const accordion = new AccordionManager(container, { multiple });
    for (const item of items) {
        accordion.addItem(item.title, item.content, item.isOpen || false);
    }
    accordion.render();
    return accordion;
}

// Bulk payment student card toggle
export function toggleBulkStudentCard(studentId) {
    const el = document.getElementById(`bulk-student-${studentId}`);
    if (el) {
        if (el.style.display === 'none') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }
}

// Toggle all fees for a student (bulk payment)
export function toggleAllFeesForStudent(studentId, checked) {
    const feeRows = document.querySelectorAll(`#bulk-student-${studentId} .bulk-fee-select`);
    feeRows.forEach(cb => {
        cb.checked = checked;
        const amountInput = cb.closest('tr')?.querySelector('.bulk-fee-amount');
        if (amountInput) {
            amountInput.disabled = !checked;
            if (!checked) amountInput.value = 0;
            else amountInput.value = amountInput.dataset.max || 0;
        }
    });
    if (window.updateBulkStudentTotal) {
        window.updateBulkStudentTotal(studentId);
    }
}