// ============================================================
// TABS UI - Tab component management
// ============================================================

// Tab manager class
export class TabManager {
    constructor(container, options = {}) {
        this.container = container;
        this.tabs = [];
        this.activeTab = null;
        this.onTabChange = options.onTabChange || null;
        this.render();
    }

    addTab(id, label, content, icon = null) {
        this.tabs.push({ id, label, content, icon });
        return this;
    }

    render() {
        if (!this.container) return;

        // Create tab headers
        const headerDiv = document.createElement('div');
        headerDiv.className = 'tabs';

        for (const tab of this.tabs) {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = tab.id;
            btn.innerHTML = tab.icon ? `${tab.icon} ${tab.label}` : tab.label;
            btn.onclick = () => this.switchTab(tab.id);
            headerDiv.appendChild(btn);
        }

        // Create content containers
        const contentDiv = document.createElement('div');
        contentDiv.className = 'tab-contents';

        for (const tab of this.tabs) {
            const panel = document.createElement('div');
            panel.id = `tab-${tab.id}`;
            panel.className = 'tab-content';
            panel.innerHTML = typeof tab.content === 'string' ? tab.content : '';
            if (typeof tab.content === 'function') {
                tab.content(panel);
            }
            contentDiv.appendChild(panel);
        }

        this.container.innerHTML = '';
        this.container.appendChild(headerDiv);
        this.container.appendChild(contentDiv);

        // Activate first tab by default
        if (this.tabs.length > 0) {
            this.switchTab(this.tabs[0].id);
        }
    }

    switchTab(tabId) {
        // Update active tab tracking
        this.activeTab = tabId;

        // Update button styles
        const buttons = this.container.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update content visibility
        const panels = this.container.querySelectorAll('.tab-content');
        panels.forEach(panel => {
            if (panel.id === `tab-${tabId}`) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });

        // Callback
        if (this.onTabChange) {
            this.onTabChange(tabId);
        }
    }

    getActiveTab() {
        return this.activeTab;
    }

    updateTabContent(tabId, content) {
        const panel = this.container.querySelector(`#tab-${tabId}`);
        if (panel) {
            if (typeof content === 'string') {
                panel.innerHTML = content;
            } else if (typeof content === 'function') {
                content(panel);
            }
        }
    }
}

// Create a simple tab component
export function createTabs(containerId, tabs, defaultTab = null) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const tabManager = new TabManager(container);

    for (const tab of tabs) {
        tabManager.addTab(tab.id, tab.label, tab.content, tab.icon || null);
    }

    tabManager.render();

    if (defaultTab) {
        tabManager.switchTab(defaultTab);
    }

    return tabManager;
}

// Role-based student tabs
export function getStudentTabsByRole(role, studentId) {
    const allTabs = [
        { id: 'info', label: '📋 Info', icon: '📋', roles: ['admin', 'teacher', 'accountant'] },
        { id: 'fees', label: '💰 Fees', icon: '💰', roles: ['admin', 'accountant'] },
        { id: 'academics', label: '📊 Academics', icon: '📊', roles: ['admin', 'teacher'] },
        { id: 'family', label: '👨‍👩‍👧 Family', icon: '👨‍👩‍👧', roles: ['admin', 'teacher', 'accountant'] },
        { id: 'history', label: '📜 History', icon: '📜', roles: ['admin', 'accountant'] }
    ];

    return allTabs.filter(tab => tab.roles.includes(role));
}

// Switch student tab (used in student details)
export function switchStudentTab(tabName, studentId, event) {
    // Update tab button styles
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = 'none';
        btn.style.color = 'var(--text-muted)';
    });

    if (event && event.target) {
        event.target.classList.add('active');
        event.target.style.borderBottom = '2px solid var(--role-primary)';
        event.target.style.color = 'var(--role-primary)';
    }

    // Load tab content (to be implemented by student module)
    if (window.loadStudentTabContent) {
        window.loadStudentTabContent(tabName, studentId);
    }
}

// Simple tab switching without manager
export function switchTab(tabId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Update buttons
    const buttons = container.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update content
    const panels = container.querySelectorAll('.tab-content');
    panels.forEach(panel => {
        if (panel.id === `tab-${tabId}`) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });
}