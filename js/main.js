// js/main.js - Single entry point
// Import all core modules
import './core/config.js';
import './core/constants.js';
import './core/state.js';
import './core/utils.js';
import './core/helpers.js';
import './core/validators.js';
import './core/sanitizers.js';
import './core/supabase-client.js';
import './core/database.js';
import './core/cache.js';
import './core/storage.js';
import './core/logger.js';
import './core/error-handler.js';
import './core/data-loader.js';
import './core/auth.js';
import './core/permissions.js';
import './core/offline-engine.js';
import './core/sync-engine.js';
import './core/auto-tasks.js';
import './core/notifications-engine.js';
import './core/search-engine.js';
import './core/export-engine.js';
import './core/print-engine.js';
import './core/analytics-engine.js';
import './core/animation-engine.js';
import './core/app-health.js';
import './core/command-palette.js';
import './core/pwa.js';
import './core/backup-engine.js';
import './core/academic-year-engine.js';
import './core/router.js';
import './core/app.js';

// Import UI modules
import './ui/sidebar.js';
import './ui/topbar.js';
import './ui/modals.js';
import './ui/forms.js';
import './ui/buttons.js';
import './ui/tables.js';
import './ui/cards.js';
import './ui/charts.js';
import './ui/tabs.js';
import './ui/dropdowns.js';
import './ui/toasts.js';
import './ui/alerts.js';
import './ui/loaders.js';
import './ui/theme-manager.js';

// Import app modules
import './modules/dashboard.js';
import './modules/students.js';
import './modules/marks.js';
import './modules/class-register.js';
import './modules/statistics.js';
import './modules/timetable.js';
import './modules/report-cards.js';
import './modules/assessments.js';
import './modules/finance.js';
import './modules/teachers.js';
import './modules/settings.js';
import './modules/notifications.js';

// Initialize the app
import { initApp } from './core/app.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});