// ============================================================
// SIDEBAR UI - Render and manage sidebar navigation
// ============================================================

import { NAV_CONFIG, TEACHER_BLOCKED_MODULES, ACCOUNTANT_BLOCKED_MODULES } from '../core/constants.js';
import { getCurrentUser } from '../core/auth.js';
import { navigateTo } from '../core/router.js';
import { state } from '../core/state.js';

let currentRole = null;
let currentActiveId = null;

// Build sidebar based on user role — injects full shell + nav items
export function buildSidebar(role) {
    currentRole = role;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Render the sidebar shell HTML first (only once)
    if (!document.getElementById('sidebar-nav')) {
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="sidebar-logo">🏫</div>
                <div class="sidebar-brand-text">
                    <div class="sidebar-brand-name">ECOLE LA FONTAINE</div>
                    <div class="sidebar-brand-sub" id="sidebar-school-subtitle">Portal</div>
                </div>
            </div>
            <div class="sidebar-user">
                <div class="sidebar-avatar" id="sidebar-avatar">👤</div>
                <div class="sidebar-user-info">
                    <div class="sidebar-username" id="sidebar-username">—</div>
                    <div class="sidebar-userrole" id="sidebar-userrole">—</div>
                </div>
            </div>
            <nav class="sidebar-nav" id="sidebar-nav"></nav>
            <div class="sidebar-footer">
                <button class="btn btn-outline btn-sm sidebar-logout-btn" onclick="window.logout()">🚪 Logout</button>
            </div>
        `;
    }

    // Build nav items filtered by role
    const config = NAV_CONFIG[role] || [];
    const filteredConfig = config.map(section => ({
        ...section,
        items: section.items.filter(item => {
            if (role === 'teacher'    && TEACHER_BLOCKED_MODULES.has(item.id))    return false;
            if (role === 'accountant' && ACCOUNTANT_BLOCKED_MODULES.has(item.id)) return false;
            return true;
        })
    })).filter(section => section.items.length > 0);

    const navContainer = document.getElementById('sidebar-nav');
    if (!navContainer) return;

    navContainer.innerHTML = filteredConfig.map(section => `
        <div class="nav-section" id="sec-${escapeHtml(section.section.replace(/\s/g, ''))}">
            <div class="nav-section-title" onclick="window.toggleNavSection && window.toggleNavSection(this.parentElement)">
                ${escapeHtml(section.section)} <span class="nav-section-arrow">▾</span>
            </div>
            <div class="nav-section-items">
                ${section.items.map(item => `
                    <div class="nav-item" id="nav-${escapeHtml(item.id)}" onclick="window.navigateTo('${escapeHtml(item.id)}')">
                        <span class="nav-icon">${item.icon}</span>
                        <span>${escapeHtml(item.label)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Restore collapsed sections
    try {
        const savedCollapsed = localStorage.getItem('sidebar_collapsed_sections');
        if (savedCollapsed) {
            JSON.parse(savedCollapsed).forEach(sectionId => {
                const el = document.getElementById(sectionId);
                if (el) el.classList.add('collapsed');
            });
        }
    } catch (_) {}
}

export function toggleNavSection(element) {
    if (!element) return;
    element.classList.toggle('collapsed');
    const collapsed = [];
    document.querySelectorAll('.nav-section.collapsed').forEach(s => collapsed.push(s.id));
    localStorage.setItem('sidebar_collapsed_sections', JSON.stringify(collapsed));
}

export function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`nav-${id}`);
    if (el) {
        el.classList.add('active');
        // Auto-expand section containing this item
        const section = el.closest('.nav-section');
        if (section) section.classList.remove('collapsed');
        currentActiveId = id;
    }
    localStorage.setItem('elf_module', id);
}

export function getActiveNav() { return currentActiveId; }

export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-open');
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay && sidebar.classList.contains('mobile-open')) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    } else if (overlay) {
        overlay.remove();
    }
}

export function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
    }
}

export function updateSidebarUser(user) {
    const avatarEl   = document.getElementById('sidebar-avatar');
    const nameEl     = document.getElementById('sidebar-username');
    const roleEl     = document.getElementById('sidebar-userrole');
    const subtitleEl = document.getElementById('sidebar-school-subtitle');

    const emoji = { admin: '👨‍💼', accountant: '💰', teacher: '👩‍🏫' }[user.role] || '👤';
    if (avatarEl)   avatarEl.textContent   = emoji;
    if (nameEl)     nameEl.textContent     = user.name;
    if (roleEl)     roleEl.textContent     = user.role;
    if (subtitleEl) subtitleEl.textContent = `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Portal`;
}

export function initSidebar() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('sidebar');
            if (sidebar?.classList.contains('mobile-open')) toggleSidebar();
        }
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('mobile-open');
            document.querySelector('.sidebar-overlay')?.remove();
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

window.toggleNavSection = toggleNavSection;
window.toggleSidebar    = toggleSidebar;
