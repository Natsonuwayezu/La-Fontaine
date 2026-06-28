// ============================================================
// DROPDOWNS UI - Dropdown component management
// ============================================================

// Dropdown manager class
export class DropdownManager {
    constructor(trigger, options = {}) {
        this.trigger = trigger;
        this.menu = null;
        this.isOpen = false;
        this.onSelect = options.onSelect || null;
        this.items = options.items || [];
        this.placement = options.placement || 'bottom-start';
        this.init();
    }

    init() {
        this.createMenu();
        this.attachEvents();
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'dropdown-menu';
        this.menu.style.position = 'absolute';
        this.menu.style.zIndex = '1000';
        this.menu.style.minWidth = '160px';
        this.renderItems();
        document.body.appendChild(this.menu);
    }

    renderItems() {
        this.menu.innerHTML = '';
        for (const item of this.items) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'dropdown-item';
            itemDiv.innerHTML = item.icon ? `${item.icon} ${item.label}` : item.label;
            itemDiv.onclick = () => {
                this.selectItem(item);
                this.close();
            };
            this.menu.appendChild(itemDiv);

            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'dropdown-divider';
                this.menu.appendChild(divider);
            }
        }
    }

    attachEvents() {
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', (e) => {
            if (!this.trigger.contains(e.target) && !this.menu.contains(e.target)) {
                this.close();
            }
        });

        window.addEventListener('scroll', () => {
            if (this.isOpen) this.updatePosition();
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.updatePosition();
        this.menu.style.display = 'block';
        this.isOpen = true;
        this.trigger.classList.add('open');
    }

    close() {
        this.menu.style.display = 'none';
        this.isOpen = false;
        this.trigger.classList.remove('open');
    }

    updatePosition() {
        const rect = this.trigger.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        let top = rect.bottom + scrollTop;
        let left = rect.left + scrollLeft;

        if (this.placement === 'bottom-start') {
            // Default position
        } else if (this.placement === 'bottom-end') {
            left = rect.right + scrollLeft - this.menu.offsetWidth;
        } else if (this.placement === 'top-start') {
            top = rect.top + scrollTop - this.menu.offsetHeight;
        } else if (this.placement === 'top-end') {
            top = rect.top + scrollTop - this.menu.offsetHeight;
            left = rect.right + scrollLeft - this.menu.offsetWidth;
        }

        this.menu.style.top = `${top}px`;
        this.menu.style.left = `${left}px`;
    }

    selectItem(item) {
        if (this.onSelect) {
            this.onSelect(item);
        }
    }

    updateItems(items) {
        this.items = items;
        this.renderItems();
    }
}

// Create a simple dropdown
export function createDropdown(triggerId, items, onSelect) {
    const trigger = document.getElementById(triggerId);
    if (!trigger) return null;

    return new DropdownManager(trigger, { items, onSelect });
}

// Create a select dropdown (replaces select element)
export function createSelectDropdown(selectElement, options = {}) {
    const container = document.createElement('div');
    container.className = 'dropdown';
    container.style.position = 'relative';
    container.style.display = 'inline-block';

    const trigger = document.createElement('button');
    trigger.className = 'btn btn-outline dropdown-trigger';
    trigger.innerHTML = selectElement.options[selectElement.selectedIndex]?.text || 'Select';

    const items = Array.from(selectElement.options).map(opt => ({
        value: opt.value,
        label: opt.text,
        selected: opt.selected
    }));

    const dropdown = new DropdownManager(trigger, {
        items: items,
        onSelect: (item) => {
            trigger.innerHTML = item.label;
            selectElement.value = item.value;
            selectElement.dispatchEvent(new Event('change'));
            if (options.onChange) options.onChange(item.value);
        }
    });

    selectElement.style.display = 'none';
    selectElement.parentNode.insertBefore(container, selectElement);
    container.appendChild(trigger);
    container.appendChild(selectElement);

    return dropdown;
}

// Close all dropdowns
export function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('.dropdown-trigger.open').forEach(trigger => {
        trigger.classList.remove('open');
    });
}

// Initialize user dropdown
export function initUserDropdown() {
    const userMenu = document.querySelector('.user-menu');
    if (!userMenu) return;

    const dropdown = document.getElementById('user-dropdown');
    if (!dropdown) return;

    userMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}