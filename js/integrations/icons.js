// js/integrations/icons.js
// Icons Integration - Centralized icon management and helpers

// Icon definitions
const ICONS = {
    // Navigation icons
    dashboard: '📊',
    students: '👥',
    teachers: '👩‍🏫',
    finance: '💰',
    academics: '📚',
    settings: '⚙️',
    reports: '📄',
    notifications: '🔔',

    // Action icons
    add: '➕',
    edit: '✏️',
    delete: '🗑️',
    save: '💾',
    cancel: '✕',
    close: '✕',
    search: '🔍',
    filter: '🔽',
    export: '📥',
    import: '📤',
    print: '🖨️',
    download: '📥',
    upload: '📤',
    refresh: '🔄',

    // Status icons
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    pending: '⏳',
    completed: '✅',
    cancelled: '❌',

    // Finance icons
    payment: '💵',
    fee: '🏷️',
    receipt: '🧾',
    invoice: '📄',
    credit: '⭐',
    debit: '📉',
    balance: '💰',

    // Academic icons
    mark: '✏️',
    assessment: '📝',
    class: '🏛️',
    subject: '📖',
    term: '📅',
    grade: '🎓',
    report: '📊',

    // User icons
    user: '👤',
    admin: '👨‍💼',
    teacher: '👩‍🏫',
    accountant: '💰',
    parent: '👨‍👩‍👧',

    // Communication icons
    email: '📧',
    phone: '📞',
    message: '💬',
    notification: '🔔',
    alert: '⚠️',

    // Time icons
    calendar: '📅',
    clock: '🕐',
    schedule: '⏰',
    deadline: '⏳',

    // Misc icons
    home: '🏠',
    help: '❓',
    info: 'ℹ️',
    settings: '⚙️',
    lock: '🔒',
    unlock: '🔓',
    visibility: '👁️',
    visibilityOff: '👁️‍🗨️'
};

function getIcon(name, fallback = '📄') {
    return ICONS[name] || fallback;
}

function setIcon(element, iconName, options = {}) {
    if (!element) return;

    const icon = getIcon(iconName);
    const { size = '1rem', color = null, className = '' } = options;

    if (element.tagName === 'IMG' || element.tagName === 'svg') {
        // For image elements, we'd need to set src
        console.warn('Icon setting for img/svg not implemented');
    } else {
        element.innerHTML = icon;
        if (size) element.style.fontSize = size;
        if (color) element.style.color = color;
        if (className) element.classList.add(className);
    }
}

function createIcon(iconName, options = {}) {
    const { size = '1rem', color = null, className = '' } = options;
    const span = document.createElement('span');
    span.className = `icon ${className}`;
    span.textContent = getIcon(iconName);
    if (size) span.style.fontSize = size;
    if (color) span.style.color = color;
    return span;
}

function getButtonIcon(buttonType) {
    const buttonIcons = {
        primary: '✅',
        success: '✅',
        danger: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        outline: '📄'
    };
    return buttonIcons[buttonType] || '📄';
}

function getGradeIcon(grade) {
    const gradeIcons = {
        'A+': '🏆',
        'A': '⭐',
        'B': '👍',
        'C': '📘',
        'D': '⚠️',
        'F': '❌'
    };
    return gradeIcons[grade] || '📊';
}

function getRoleIcon(role) {
    const roleIcons = {
        admin: '👨‍💼',
        accountant: '💰',
        teacher: '👩‍🏫',
        parent: '👨‍👩‍👧',
        student: '👨‍🎓'
    };
    return roleIcons[role] || '👤';
}

function getPaymentMethodIcon(method) {
    const methodIcons = {
        Cash: '💵',
        'Mobile-Money': '📱',
        'Bank Transfer': '🏦',
        Cheque: '📄',
        Credit: '⭐',
        Refund: '🔄'
    };
    return methodIcons[method] || '💰';
}

function getStatusIcon(status) {
    const statusIcons = {
        active: '✅',
        inactive: '❌',
        pending: '⏳',
        completed: '✅',
        failed: '❌',
        paid: '✅',
        unpaid: '🔴',
        partial: '🟡',
        overdue: '⚠️'
    };
    return statusIcons[status] || '📌';
}

function getFileTypeIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: '📕',
        doc: '📘',
        docx: '📘',
        xls: '📗',
        xlsx: '📗',
        ppt: '📙',
        pptx: '📙',
        jpg: '🖼️',
        jpeg: '🖼️',
        png: '🖼️',
        gif: '🖼️',
        mp3: '🎵',
        mp4: '🎬',
        zip: '📦',
        rar: '📦'
    };
    return icons[ext] || '📄';
}

// Replace emoji icons with Font Awesome or similar if needed
function useFontAwesome() {
    // This would be implemented if switching to Font Awesome
    console.log('Font Awesome integration would go here');
}

// Icon registry for dynamic icon loading
const iconRegistry = new Map();

function registerIcon(name, icon) {
    iconRegistry.set(name, icon);
    ICONS[name] = icon;
}

function getRegisteredIcon(name) {
    return iconRegistry.get(name) || ICONS[name];
}

// Helper to add icons to all elements with data-icon attribute
function renderDataIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
        const iconName = el.dataset.icon;
        const icon = getIcon(iconName);
        if (icon) {
            el.innerHTML = `${icon} ${el.innerHTML}`;
            el.removeAttribute('data-icon');
        }
    });
}

// Auto-render icons when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDataIcons);
} else {
    renderDataIcons();
}