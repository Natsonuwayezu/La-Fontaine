// ============================================================
// PWA - Progressive Web App functionality
// ============================================================

import { showToast } from './helpers.js';
import { info, error as logError } from './logger.js';

let deferredPrompt = null;

// Register service worker — path fixed to /pwa/sw.js
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Worker not supported in this browser.');
        return false;
    }

    const proto = window.location.protocol;
    const host  = window.location.hostname;
    if (proto !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') {
        console.log('[PWA] Service Worker requires HTTPS (or localhost).');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.register('/pwa/sw.js', { scope: '/' });
        info('Service Worker registered', { scope: registration.scope }, 'pwa');

        // Notify when a new SW version is waiting
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showToast('🔄 New version available — refresh to update', 'info', 8000);
                }
            });
        });

        return true;
    } catch (error) {
        logError('Service Worker registration failed', error, 'pwa');
        return false;
    }
}

// Listen for the browser's install prompt
export function initPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'inline-flex';
        info('PWA installation prompt available', null, 'pwa');
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'none';
        showToast('✅ App installed successfully!', 'success');
        info('App installed', null, 'pwa');
    });
}

// Trigger PWA install prompt
export async function installPWA() {
    if (!deferredPrompt) {
        showToast('App is already installed or cannot be installed in this browser.', 'info');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('✅ Installing ECOLE LA FONTAINE…', 'success');
    deferredPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
}

// Build and inject a dynamic manifest (picks up school name/logo from state)
export function generateManifest() {
    const settings   = window.state?.schoolSettings || {};
    const schoolName = settings.school_name || 'ECOLE LA FONTAINE';
    const logo       = settings.school_logo  || '';

    const manifest = {
        name: schoolName,
        short_name: schoolName.substring(0, 12),
        description: settings.school_motto || 'School Management System',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1a3a5c',
        background_color: '#0f172a',
        icons: []
    };

    const fallbackIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231a3a5c'/%3E%3Ctext x='50' y='70' font-size='60' text-anchor='middle' fill='white'%3E%F0%9F%8F%AB%3C/text%3E%3C/svg%3E";
    const iconSrc = (logo && (logo.startsWith('data:') || logo.startsWith('http'))) ? logo : fallbackIcon;

    manifest.icons.push({ src: iconSrc, sizes: '192x192', type: 'image/png' });
    manifest.icons.push({ src: iconSrc, sizes: '512x512', type: 'image/png' });

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
    }
    link.href = url;
}

// Pre-cache the offline fallback page
export async function cacheOfflinePage() {
    if (!('caches' in window)) return;
    try {
        const cache = await caches.open('ecole-cache-v1');
        await cache.add('/offline.html');
        info('Offline page cached', null, 'pwa');
    } catch (err) {
        logError('Failed to cache offline page', err, 'pwa');
    }
}

export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Main init — called once after bootApp
export function initPWA() {
    registerServiceWorker();
    initPWAInstall();
    generateManifest();
    cacheOfflinePage();

    if (!isStandalone() && !localStorage.getItem('pwa_prompt_shown')) {
        setTimeout(() => {
            const btn = document.getElementById('pwa-install-btn');
            if (btn && btn.style.display !== 'none') {
                showToast('📲 Install app for a better experience', 'info', 5000);
                localStorage.setItem('pwa_prompt_shown', 'true');
            }
        }, 3000);
    }
}

// Expose for inline button handlers
window.installPWA = installPWA;
