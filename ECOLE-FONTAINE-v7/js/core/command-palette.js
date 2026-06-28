// ============================================================
// COMMAND PALETTE - Ctrl+K quick navigation and actions
// ============================================================

import { quickSearch } from './search-engine.js';
import { navigateTo } from './router.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './helpers.js';

let isOpen = false;
let commandPalette = null;
let searchInput = null;
let resultsContainer = null;

// Available commands
const COMMANDS = [
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: 'Ctrl+1', action: () => navigateTo('dashboard') },
    { id: 'students', label: 'Go to Student List', shortcut: 'Ctrl+2', action: () => navigateTo('student-list') },
    { id: 'marks', label: 'Go to Marks Entry', shortcut: 'Ctrl+3', action: () => navigateTo('marks-entry') },
    { id: 'payments', label: 'Record Payment', shortcut: 'Ctrl+4', action: () => navigateTo('record-payment') },
    { id: 'reports', label: 'Go to Report Cards', shortcut: 'Ctrl+5', action: () => navigateTo('report-cards') },
    { id: 'assessments', label: 'Go to Assessments', shortcut: 'Ctrl+6', action: () => navigateTo('assessments') },
    { id: 'fees', label: 'Fee Structure', shortcut: 'Ctrl+7', action: () => navigateTo('fee-structure') },
    { id: 'timetable', label: 'Timetable', shortcut: 'Ctrl+8', action: () => navigateTo('timetable') },
    { id: 'settings', label: 'School Settings', shortcut: 'Ctrl+9', action: () => navigateTo('school-settings') },
    { id: 'help', label: 'Show Keyboard Shortcuts', shortcut: 'Ctrl+?', action: () => showShortcutsHelp() },
    { id: 'logout', label: 'Logout', shortcut: '', action: () => window.logout?.() }
];

// Create command palette UI
function createCommandPalette() {
    const palette = document.createElement('div');
    palette.id = 'command-palette';
    palette.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 600px;
        background: var(--bg-secondary);
        border-radius: 12px;
        box-shadow: 0 20px 35px -10px rgba(0,0,0,0.3);
        z-index: 10000;
        display: none;
        border: 1px solid var(--border-light);
        overflow: hidden;
    `;

    palette.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid var(--border-light);">
            <input type="text" 
                   id="command-search" 
                   placeholder="Search commands or navigate to any page..." 
                   style="width: 100%; padding: 12px; border: 1px solid var(--border-medium); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
        </div>
        <div id="command-results" style="max-height: 400px; overflow-y: auto; padding: 8px 0;"></div>
        <div style="padding: 8px 16px; border-top: 1px solid var(--border-light); font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
        </div>
    `;

    document.body.appendChild(palette);
    return palette;
}

// Show command palette
export function showCommandPalette() {
    if (isOpen) return;

    if (!commandPalette) {
        commandPalette = createCommandPalette();
        searchInput = document.getElementById('command-search');
        resultsContainer = document.getElementById('command-results');

        // Event listeners
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keydown', handleKeyNavigation);
    }

    commandPalette.style.display = 'block';
    isOpen = true;
    searchInput.value = '';
    searchInput.focus();
    renderResults(COMMANDS);

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

// Hide command palette
export function hideCommandPalette() {
    if (commandPalette) {
        commandPalette.style.display = 'none';
    }
    isOpen = false;
    document.removeEventListener('click', handleOutsideClick);
    selectedIndex = -1;
}

// Handle search input
let selectedIndex = -1;

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    if (query.length === 0) {
        renderResults(COMMANDS);
        return;
    }

    // Search commands
    const commandResults = COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query)
    );

    // Search pages via search engine
    const pageResults = quickSearch(query);
    const pageItems = pageResults.map(r => ({
        id: r.type,
        label: r.title,
        subtitle: r.subtitle,
        action: () => navigateTo(r.url.split('?')[0])
    }));

    // Combine results
    const allResults = [...commandResults, ...pageItems];
    renderResults(allResults);
}

// Render search results
function renderResults(items) {
    if (!resultsContainer) return;

    if (items.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No results found</div>';
        return;
    }

    resultsContainer.innerHTML = items.map((item, index) => `
        <div class="command-item ${index === selectedIndex ? 'selected' : ''}" 
             data-index="${index}"
             style="padding: 10px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; ${index === selectedIndex ? 'background: var(--bg-tertiary);' : ''}"
             onclick="window.executeCommand(${index})">
            <div>
                <div style="font-weight: 500;">${escapeHtml(item.label)}</div>
                ${item.subtitle ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.subtitle)}</div>` : ''}
            </div>
            ${item.shortcut ? `<span style="font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">${item.shortcut}</span>` : ''}
        </div>
    `).join('');

    // Store items for execution
    window._commandItems = items;
    selectedIndex = -1;
}

// Handle keyboard navigation
function handleKeyNavigation(e) {
    const items = document.querySelectorAll('.command-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelectedItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelectedItem(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && window._commandItems?.[selectedIndex]) {
            window._commandItems[selectedIndex].action();
            hideCommandPalette();
        }
    } else if (e.key === 'Escape') {
        hideCommandPalette();
    }
}

function updateSelectedItem(items) {
    items.forEach((item, idx) => {
        if (idx === selectedIndex) {
            item.classList.add('selected');
            item.style.background = 'var(--bg-tertiary)';
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
            item.style.background = '';
        }
    });
}

function handleOutsideClick(e) {
    if (commandPalette && !commandPalette.contains(e.target)) {
        hideCommandPalette();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showShortcutsHelp() {
    const shortcuts = [
        { key: 'Ctrl+K', description: 'Open Command Palette' },
        { key: 'Ctrl+1-9', description: 'Quick navigate to modules' },
        { key: 'Ctrl+S', description: 'Save current form' },
        { key: 'Ctrl+F', description: 'Focus search' },
        { key: 'Esc', description: 'Close modal / palette' },
        { key: 'Alt+?', description: 'Show this help' }
    ];

    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal modal-sm" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>⌨️ Keyboard Shortcuts</h3>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    ${shortcuts.map(s => `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                            <kbd style="background: var(--bg-tertiary); padding: 2px 10px; border-radius: 6px; font-weight: 700;">${s.key}</kbd>
                            <span>${s.description}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById('modals-container');
    if (container) container.innerHTML = html;
}

// Execute command from result click
window.executeCommand = function (index) {
    if (window._commandItems?.[index]) {
        window._commandItems[index].action();
        hideCommandPalette();
    }
};

// Initialize command palette keyboard shortcut
export function initCommandPalette() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showCommandPalette();
        }

        // Escape to close
        if (e.key === 'Escape' && isOpen) {
            hideCommandPalette();
        }
    });
}