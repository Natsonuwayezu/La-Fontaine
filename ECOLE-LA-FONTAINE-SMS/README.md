# 🏫 Ecole La Fontaine — School Management System

## Overview
A complete School Management System for **Ecole La Fontaine**, Rubavu, Rwanda.  
Built as a Single Page Application (SPA) with Supabase as the backend database.

## 📁 Project Structure

```
ECOLE-LA-FONTAINE-SMS/
│
├── index.html                          # Main SPA shell (imports all CSS + JS)
│
├── css/
│   ├── core/                           # Foundation styles
│   │   ├── variables.css               # CSS custom properties & role color themes
│   │   ├── reset.css                   # CSS reset & base styles
│   │   ├── typography.css              # Font sizes, weights, text utilities
│   │   ├── layout.css                  # Grid system, flex utilities
│   │   ├── spacing.css                 # Margin & padding utilities
│   │   ├── positioning.css             # Position & display utilities
│   │   ├── borders.css                 # Border & outline utilities
│   │   ├── backgrounds.css             # Background & color utilities
│   │   ├── cursors.css                 # Cursor & pointer utilities
│   │   ├── sizing.css                  # Width, height & sizing utilities
│   │   ├── animations.css              # Keyframes & animation classes
│   │   ├── animation-delays.css        # Animation delay & duration classes
│   │   ├── utilities.css               # Helper classes (additional)
│   │   └── themes.css                  # Dark mode overrides
│   │
│   ├── components/                     # Reusable UI components
│   │   ├── sidebar.css
│   │   ├── topbar.css
│   │   ├── cards.css
│   │   ├── tables.css
│   │   ├── forms.css
│   │   ├── buttons.css
│   │   ├── badges.css
│   │   ├── modals.css
│   │   ├── toasts.css
│   │   ├── alerts.css
│   │   ├── pagination.css
│   │   ├── dropdowns.css
│   │   ├── tabs.css
│   │   ├── charts.css
│   │   ├── loaders.css
│   │   ├── skeletons.css
│   │   └── empty-states.css
│   │
│   ├── pages/                          # Page-specific styles
│   │   ├── login.css
│   │   ├── marks.css
│   │   ├── attendance.css
│   │   ├── finance.css
│   │   ├── teachers.css
│   │   ├── timetable.css
│   │   ├── report-cards.css
│   │   ├── analytics.css
│   │   ├── notifications.css
│   │   ├── settings.css
│   │   └── class-register.css
│   │
│   ├── mobile/                         # Responsive & mobile styles
│   │   ├── mobile.css                  # Base responsive styles
│   │   └── mobile-enhanced.css         # Enhanced mobile (v9)
│   │
│   └── print/
│       └── print.css                   # Print & PDF export styles
│
├── js/
│   ├── config/                         # App configuration (load first)
│   │   ├── supabase-config.js          # Supabase URL & API key
│   │   ├── app-config.js               # APP_CONFIG, UPLOAD_LIMITS, CURRENCY
│   │   ├── constants.js                # Grades, timetable, assessment types, etc.
│   │   └── role-permissions.js         # TEACHER & ACCOUNTANT blocked modules
│   │
│   ├── core/                           # Core engine (load after config)
│   │   ├── state.js                    # Global state object & cache
│   │   ├── api.js                      # Supabase REST wrappers (api, getAll, insert…)
│   │   ├── utils.js                    # Formatting, escaping, export helpers
│   │   ├── academic-formulas.js        # Grade calculation, averages, ranking logic
│   │   ├── finance-formulas.js         # Fee totals, balance calculations
│   │   ├── data-refresh.js             # State accessors & loadInitialData
│   │   ├── auth.js                     # Login, logout, session, password reset
│   │   ├── offline.js                  # IndexedDB offline support & sync
│   │   ├── window-exposure.js          # window.X exports (entry point)
│   │   └── boot.js                     # App boot sequence
│   │
│   ├── ui/                             # UI rendering layer
│   │   ├── shell.js                    # Sidebar, topbar, theme, login particles
│   │   ├── toasts.js                   # Toast notifications & modal system
│   │   └── router.js                   # Module router (navigateTo, loadModule)
│   │
│   ├── modules/                        # Feature modules (one per screen)
│   │   ├── dashboard.js                # All role dashboards
│   │   ├── marks.js                    # Marks entry & analysis
│   │   ├── marks-import-export.js      # Bulk marks import/export
│   │   ├── class-register.js           # Class register & statistics
│   │   ├── register-export.js          # Register export module
│   │   ├── assessments.js              # Assessment management
│   │   ├── report-cards.js             # Report cards, grades & rankings
│   │   ├── report-generator.js         # Report card PDF generator
│   │   ├── transcripts.js              # Student transcripts
│   │   ├── ranking-engine.js           # Class & school ranking engine
│   │   ├── academic-reports.js         # Academic summary reports
│   │   ├── timetable.js                # Timetable management
│   │   ├── attendance.js               # Attendance entry & reports
│   │   ├── students.js                 # Student management & registration
│   │   ├── student-fees.js             # Student fees & family linking
│   │   ├── fee-term-status.js          # Fee status list per term
│   │   ├── payments.js                 # Payment recording & history
│   │   ├── fee-structure.js            # Fee structures & assignments
│   │   ├── finance-reports.js          # Balances, audit & finance reports
│   │   ├── family-management.js        # Family accounts & sibling linking
│   │   ├── staff.js                    # Teachers & staff management
│   │   ├── settings.js                 # School settings & configuration
│   │   └── notifications.js            # Notifications & announcements
│   │
│   ├── patches/                        # Hotfixes & restored functions
│   │   ├── missing-helpers.js          # Section 100: Restored helper functions
│   │   ├── system-logs.js              # Section 101: System logs helpers
│   │   ├── analytics-helpers.js        # Section 102: Analytics helpers
│   │   ├── announcements.js            # Section 103: Announcements helpers
│   │   ├── missing-functions.js        # Section 104: All 79 missing module helpers
│   │   ├── v9-features.js              # Section 97: New features (v9 patch)
│   │   ├── missing-functions-98.js     # Section 98: 67 undefined window functions
│   │   └── window-exposure-98.js       # Section 99c: Window exposure for section 98
│   │
│   ├── mobile/                         # Mobile-specific JS (future)
│   ├── integrations/                   # Third-party library wrappers (future)
│   └── workers/                        # Web workers for heavy tasks (future)
│
├── html/
│   └── partials/                       # HTML fragments loaded by the SPA
│       ├── login.html                  # Login page HTML
│       ├── sidebar.html                # Sidebar component
│       ├── topbar.html                 # Top navigation bar
│       ├── term-progress-bar.html      # Term progress indicator
│       ├── content-container.html      # Dynamic content wrapper
│       └── toast-modal-containers.html # Toast & modal DOM containers
│
├── assets/
│   ├── logos/                          # School logo, favicon, apple-touch-icon
│   ├── images/                         # Backgrounds, avatars, illustrations
│   ├── icons/                          # UI, finance, academic, sidebar icons
│   ├── audio/                          # Notification & alert sounds
│   ├── fonts/                          # Self-hosted fonts (Syne, DM Sans, Inter)
│   └── exports/                        # Generated PDF/Excel export files
│
├── templates/
│   ├── receipts/                       # Receipt HTML templates
│   ├── reports/                        # Report card & transcript templates
│   └── exports/                        # Excel import templates (.xlsx)
│
├── pwa/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker
│   └── icons/                          # PWA icons (192x192, 512x512)
│
├── data/
│   ├── imports/                        # Bulk import files
│   ├── exports/                        # Generated exports
│   ├── backups/                        # Database backups
│   ├── temp/                           # Temporary files
│   └── demo/                           # Demo/seed data
│
├── docs/
│   ├── architecture.md                 # System architecture overview
│   ├── setup-guide.md                  # Installation & setup
│   ├── database-schema.md              # Supabase table schemas
│   ├── supabase-schema.md              # Supabase RLS policies & functions
│   ├── finance-workflow.md             # Finance module workflow
│   ├── academics-workflow.md           # Academics module workflow
│   ├── permissions.md                  # Role-based access control
│   ├── splitting-guide.md              # How the monolith was split
│   └── changelog.md                    # Version history
│
├── tests/
│   ├── auth-tests.js
│   ├── finance-tests.js
│   ├── marks-tests.js
│   ├── timetable-tests.js
│   ├── attendance-tests.js
│   └── ui-tests.js
│
├── backups/
│   ├── daily/
│   ├── weekly/
│   ├── monthly/
│   └── emergency/
│
└── temp/
    ├── uploads/
    ├── generated-pdfs/
    ├── generated-excels/
    ├── report-cache/
    └── print-cache/
```

## 🔑 JS Load Order
Config → Core → UI → Modules → Patches

## 🧰 Tech Stack
- **Frontend:** Vanilla JS SPA, Chart.js, SheetJS, html2pdf.js
- **Backend:** Supabase (PostgreSQL + REST API)
- **Fonts:** Syne, DM Sans (Google Fonts)
- **PWA:** Service Worker + IndexedDB offline support

## 👥 Roles
| Role | Access |
|------|--------|
| Admin | Full access |
| Accountant | Finance only (no academics) |
| Teacher | Academics only (no finance) |

## 📍 School Info
- **School:** Ecole La Fontaine
- **Location:** Rubavu, Rwanda
- **Currency:** RWF (Rwandan Franc)

## 👨‍🏫 Author
Natson Uwayezu — Ecole La Fontaine
