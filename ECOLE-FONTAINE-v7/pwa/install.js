// pwa/install.js
// PWA Installation Handler

let deferredPrompt = null;
let isInstalled = false;

export function initPWAInstall() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('PWA: beforeinstallprompt fired');
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA: appinstalled fired');
        isInstalled = true;
        deferredPrompt = null;
        hideInstallButton();
        showInstallSuccessMessage();
    });

    // Check if already installed
    checkIfInstalled();

    // Check for display mode
    checkDisplayMode();
}

function showInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'inline-flex';
        installBtn.addEventListener('click', promptInstall);
    }
}

function hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'none';
        installBtn.removeEventListener('click', promptInstall);
    }
}

async function promptInstall() {
    if (!deferredPrompt) {
        console.log('PWA: No installation prompt available');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA: User ${outcome} the installation`);

    deferredPrompt = null;
    hideInstallButton();

    if (outcome === 'accepted') {
        isInstalled = true;
    }
}

function checkIfInstalled() {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
        isInstalled = true;
        hideInstallButton();
    }
}

function checkDisplayMode() {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
        if (e.matches) {
            console.log('PWA: Now running in standalone mode');
            isInstalled = true;
            hideInstallButton();
        }
    });
}

function showInstallSuccessMessage() {
    // Show toast notification
    if (window.showToast) {
        window.showToast('✅ App installed successfully!', 'success');
    }
}

// Check if the app is running as PWA
export function isRunningAsPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

// Get installation status
export function getInstallStatus() {
    return {
        isInstalled: isInstalled || isRunningAsPWA(),
        canInstall: deferredPrompt !== null,
        isStandalone: isRunningAsPWA()
    };
}

// Manual trigger for installation (from settings)
export async function manualInstall() {
    if (deferredPrompt) {
        await promptInstall();
    } else {
        console.log('PWA: No installation prompt available');
        return false;
    }
    return true;
}