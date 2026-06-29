// ============================================================
// STORAGE - LocalStorage and session management
// ============================================================


// Session storage keys
const SESSION_KEYS = {
    USER: 'elf_user',
    EXPIRY: 'elf_expiry',
    MODULE: 'elf_module',
    THEME: 'elf_theme',
    BACKUP_HISTORY: 'backup_history',
    AUTO_BACKUP_SETTINGS: 'auto_backup_settings',
    BIOMETRIC_CRED: 'elf_biometric_cred',
    BIOMETRIC_USER: 'elf_biometric_user',
    NOTIFICATIONS_PREFIX: 'notifications_',
    NAV_PREFIX: 'elf_nav_'
};

// Save user session
function saveSession(user) {
    localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(SESSION_KEYS.EXPIRY, Date.now() + APP_CONFIG.sessionDuration);
}

// Get stored user session
function getStoredSession() {
    const stored = localStorage.getItem(SESSION_KEYS.USER);
    const expiry = localStorage.getItem(SESSION_KEYS.EXPIRY);
    
    if (!stored || !expiry) return null;
    if (Date.now() > parseInt(expiry)) {
        clearSession();
        return null;
    }
    
    return JSON.parse(stored);
}

// Clear user session
function clearSession() {
    localStorage.removeItem(SESSION_KEYS.USER);
    localStorage.removeItem(SESSION_KEYS.EXPIRY);
}

// Reset session expiry (extend session)
function resetSessionExpiry() {
    const user = getStoredSession();
    if (user) {
        localStorage.setItem(SESSION_KEYS.EXPIRY, Date.now() + APP_CONFIG.sessionDuration);
    }
}

// Save last active module
function saveLastModule(moduleId) {
    localStorage.setItem(SESSION_KEYS.MODULE, moduleId);
}

// Get last active module
function getLastModule() {
    return localStorage.getItem(SESSION_KEYS.MODULE) || 'dashboard';
}

// Save theme preference
function saveTheme(theme) {
    localStorage.setItem(SESSION_KEYS.THEME, theme);
}

// Get saved theme
function getSavedTheme() {
    return localStorage.getItem(SESSION_KEYS.THEME) || 'light';
}

// Save navigation data for cross-module communication
function setNavData(key, value) {
    if (value !== null && value !== undefined) {
        localStorage.setItem(`${SESSION_KEYS.NAV_PREFIX}${key}`, String(value));
    }
}

// Get and clear navigation data
function getNavData(key) {
    const value = localStorage.getItem(`${SESSION_KEYS.NAV_PREFIX}${key}`);
    localStorage.removeItem(`${SESSION_KEYS.NAV_PREFIX}${key}`);
    return value;
}

// Save user notifications
function saveNotifications(userId, notifications) {
    localStorage.setItem(`${SESSION_KEYS.NOTIFICATIONS_PREFIX}${userId}`, JSON.stringify(notifications));
}

// Load user notifications
function loadNotifications(userId) {
    const stored = localStorage.getItem(`${SESSION_KEYS.NOTIFICATIONS_PREFIX}${userId}`);
    return stored ? JSON.parse(stored) : [];
}

// Save biometric credential
function saveBiometricCredential(credId, userData) {
    localStorage.setItem(SESSION_KEYS.BIOMETRIC_CRED, credId);
    localStorage.setItem(SESSION_KEYS.BIOMETRIC_USER, JSON.stringify(userData));
}

// Get biometric credential
function getBiometricCredential() {
    return {
        credId: localStorage.getItem(SESSION_KEYS.BIOMETRIC_CRED),
        userData: localStorage.getItem(SESSION_KEYS.BIOMETRIC_USER)
    };
}

// Clear biometric data
function clearBiometricCredential() {
    localStorage.removeItem(SESSION_KEYS.BIOMETRIC_CRED);
    localStorage.removeItem(SESSION_KEYS.BIOMETRIC_USER);
}

// Save backup to history
function addBackupToHistory(backup) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(SESSION_KEYS.BACKUP_HISTORY) || '[]');
    } catch (e) {
        history = [];
    }
    
    history.unshift({
        timestamp: backup.timestamp,
        filename: backup.filename,
        size: backup.size,
        records: backup.records
    });
    
    // Keep only last 10
    history = history.slice(0, 10);
    localStorage.setItem(SESSION_KEYS.BACKUP_HISTORY, JSON.stringify(history));
}

// Get backup history
function getBackupHistory() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEYS.BACKUP_HISTORY) || '[]');
    } catch (e) {
        return [];
    }
}

// Clear backup history
function clearBackupHistory() {
    localStorage.removeItem(SESSION_KEYS.BACKUP_HISTORY);
}

// Save auto-backup settings
function saveAutoBackupSettings(settings) {
    localStorage.setItem(SESSION_KEYS.AUTO_BACKUP_SETTINGS, JSON.stringify(settings));
}

// Get auto-backup settings
function getAutoBackupSettings() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEYS.AUTO_BACKUP_SETTINGS) || '{"enabled":true,"frequency":"monthly","keep":3}');
    } catch (e) {
        return { enabled: true, frequency: 'monthly', keep: 3 };
    }
}

// Clear all app storage (logout)
function clearAllAppStorage() {
    // Don't clear theme and API settings on logout
    const theme = getSavedTheme();
    const apiUrl = localStorage.getItem('sb_url');
    const apiKey = localStorage.getItem('sb_key');
    
    localStorage.clear();
    
    // Restore essential settings
    if (theme) localStorage.setItem(SESSION_KEYS.THEME, theme);
    if (apiUrl) localStorage.setItem('sb_url', apiUrl);
    if (apiKey) localStorage.setItem('sb_key', apiKey);
}

// Check if storage is available
function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// Get storage usage estimate
function getStorageUsage() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key?.length || 0) + (value?.length || 0);
    }
    return {
        bytes: total,
        kb: (total / 1024).toFixed(2),
        items: localStorage.length
    };
}