// 1.2 — Application Configuration
        // ──────────────────────────────────────────────────────────────────────


        const APP_CONFIG = {
            name: 'ECOLE LA FONTAINE',
            version: '9.0.0',
            sessionDuration: 60 * 60 * 1000,          // 1 hour
            idleWarningMs: 25 * 60 * 1000,            // warn at 25 min
            idleLogoutMs: 30 * 60 * 1000,             // logout at 30 min
            autoBackupInterval: 6 * 60 * 60 * 1000,   // 6 hours
            maxBackups: 5,
            itemsPerPage: 20,
            maxLoginAttempts: 5,
            lockoutDuration: 15 * 60 * 1000,          // 15 minutes
            cacheTTL: 5 * 60 * 1000                   // 5 minutes
        };

        // File upload limits
        const UPLOAD_LIMITS = {
            maxLogoSize: 2 * 1024 * 1024,             // 2 MB
            maxBulkImportRows: 500,
            allowedImageTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
            allowedExcelTypes: ['.xlsx', '.xls', '.csv'],
            maxAvatarSize: 1 * 1024 * 1024            // 1 MB
        };

        // Currency settings (Rwandan Franc)
        const CURRENCY = {
            code: 'RWF',
            symbol: 'RWF',
            locale: 'en-RW',
            decimalPlaces: 0
        };


        // ──────────────────────────────────────────────────────────────────────
        // 1.3 — Academic Constants
        // ──────────────────────────────────────────────────────────────────────
