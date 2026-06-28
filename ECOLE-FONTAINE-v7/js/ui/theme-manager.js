// ============================================================
// THEME MANAGER - Light/dark theme management
// ============================================================

import { saveTheme, getSavedTheme } from '../core/storage.js';
import { showToast } from './modals.js';

// Theme constants
export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

// Get current theme
export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || THEMES.LIGHT;
}

// Set theme
export function setTheme(theme) {
    if (theme !== THEMES.LIGHT && theme !== THEMES.DARK) return;

    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);

    // Update UI elements
    const themeIcon = document.getElementById('dropdown-theme-icon');
    const themeText = document.getElementById('dropdown-theme-text');

    if (themeIcon) {
        themeIcon.textContent = theme === THEMES.DARK ? '☀️' : '🌙';
    }
    if (themeText) {
        themeText.textContent = theme === THEMES.DARK ? 'Light Mode' : 'Dark Mode';
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

// Toggle between light and dark
export function toggleTheme() {
    const current = getCurrentTheme();
    const newTheme = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setTheme(newTheme);
    showToast(newTheme === THEMES.DARK ? '🌙 Dark mode activated' : '☀️ Light mode activated', 'info', 1500);
}

// Initialize theme on page load
export function initTheme() {
    const savedTheme = getSavedTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? THEMES.DARK : THEMES.LIGHT);

    setTheme(initialTheme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!getSavedTheme()) {
            setTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
        }
    });
}

// Apply role-based theme colors
export function applyRoleTheme(role) {
    document.body.classList.remove('role-admin', 'role-accountant', 'role-teacher');
    document.body.classList.add(`role-${role}`);
}

// Get theme color for charts
export function getChartThemeColors() {
    const isDark = getCurrentTheme() === THEMES.DARK;
    return {
        textColor: isDark ? '#e2e8f0' : '#1e293b',
        gridColor: isDark ? '#334155' : '#e2e8f0',
        tooltipBg: isDark ? '#1e293b' : '#ffffff',
        tooltipBorder: isDark ? '#334155' : '#e2e8f0'
    };
}