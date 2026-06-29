# 🏫 ECOLE LA FONTAINE — PROJECT TREE
**Last updated:** 2026-06-28
**Repo:** https://github.com/Natsonuwayezu/La-Fontaine
**Supabase:** ovmymtdrugdljnttiltd.supabase.co

---

## 📋 ROOT FILES

```
/
├── index.html              # SPA shell — imports all CSS + JS (527 lines)
├── offline.html            # Shown when app is offline
├── 404.html                # Not found page
├── README.md               # Project overview
├── AGENT_PROMPT.md         # Universal agent guide — READ FIRST every session
├── progress.txt            # Build tracker — what's done, what's next
├── backend.txt             # All formulas, DB schema, business rules
├── frontend.txt            # All UI wireframes (14,355 lines)
├── LICENSE
```

---

## 🎨 CSS — Stylesheets

```
css/
├── app.css                 # Legacy combined file (not used by index.html)
│
├── core/                   # Foundation — load first, in this order
│   ├── variables.css       # CSS custom properties, role color themes
│   ├── reset.css           # CSS reset & base element styles
│   ├── typography.css      # Font sizes, weights, text utilities
│   ├── layout.css          # Flex/grid layout system
│   ├── spacing.css         # Margin/padding utilities
│   ├── positioning.css     # Position & display utilities
│   ├── borders.css         # Border, outline, radius utilities
│   ├── backgrounds.css     # Background & color utilities
│   ├── cursors.css         # Cursor & pointer utilities
│   ├── sizing.css          # Width, height, sizing utilities
│   ├── animations.css      # Keyframes & animation classes
│   ├── animation-delays.css # Delay & duration utility classes
│   ├── utilities.css       # Helper classes (overflow, visibility, etc.)
│   ├── themes.css          # Dark mode overrides
│   └── inline-extracted.css # Styles pulled out of old JS
│
├── components/             # Reusable UI components
│   ├── sidebar.css
│   ├── topbar.css
│   ├── cards.css
│   ├── tables.css
│   ├── forms.css
│   ├── buttons.css
│   ├── badges.css
│   ├── modals.css
│   ├── toasts.css
│   ├── alerts.css
│   ├── pagination.css
│   ├── dropdowns.css
│   ├── tabs.css
│   ├── charts.css
│   ├── loaders.css
│   ├── skeletons.css
│   └── empty-states.css
│
├── pages/                  # Page-specific styles
│   ├── login.css
│   ├── dashboard.css
│   ├── marks.css
│   ├── attendance.css
│   ├── finance.css
│   ├── teachers.css
│   ├── timetable.css
│   ├── report-cards.css
│   ├── analytics.css
│   ├── notifications.css
│   ├── settings.css
│   ├── class-register.css
│   ├── students.css
│   ├── assessments.css
│   └── statistics.css
│
├── mobile/                 # Responsive & mobile styles
│   ├── mobile.css          # Base responsive breakpoints
│   ├── tablet.css          # Tablet-specific styles
│   ├── mobile-enhanced.css # Enhanced mobile (v9 additions)
│   ├── responsive-sidebar.css
│   ├── responsive-topbar.css
│   ├── touch.css           # Touch gesture styles
│   └── responsive-overrides.css
│
└── print/                  # Print & PDF export styles
    ├── print.css           # Base print styles
    ├── reports-print.css   # Report card print layout
    ├── receipts-print.css  # Receipt print layout
    ├── transcripts-print.css
    ├── marksheets-print.css
    ├── statements-print.css
    └── print-overrides.css
```

---

## ⚙️ JS — JavaScript

```
js/
├── main.js                 # App entry point (called last)
│
├── config/                 # ① Load first — constants & credentials
│   ├── supabase-config.js  # Supabase URL + anon key
│   ├── app-config.js       # APP_CONFIG, session timers, upload limits
│   ├── constants.js        # Grades, assessment types, currency
│   └── role-permissions.js # TEACHER_BLOCKED / ACCOUNTANT_BLOCKED sets
│
├── core/                   # ② Core engine — load after config
│   ├── state.js            # Global state object & cache
│   ├── logger.js           # Logging system
│   ├── error-handler.js    # Error boundary & recovery
│   ├── storage.js          # localStorage/sessionStorage helpers
│   ├── cache.js            # TTL cache layer (Map-based)
│   ├── supabase-client.js  # Raw Supabase REST client
│   ├── api.js              # API wrappers: get/insert/update/delete_
│   ├── database.js         # Advanced DB helpers
│   ├── db-safe-query.js    # Retry, timeout, fallback cache
│   ├── sanitizers.js       # sanitizeInput(), esc() HTML escaping
│   ├── validators.js       # Validation engine
│   ├── helpers.js          # Generic helpers (dates, strings, arrays)
│   ├── utils.js            # fmt, esc, formatCurrency, fmtDate, export
│   ├── academic-formulas.js # Grade calc, averages, ranking, MG/EX/TOT
│   ├── finance-formulas.js  # Fee totals, balance, FIFO allocation
│   ├── permissions.js      # RBAC permission checks
│   ├── auth.js             # Login, logout, session, password reset
│   ├── data-loader.js      # loadInitialData(), state bootstrapping
│   ├── data-refresh.js     # State accessors & partial refresh
│   ├── offline-engine.js   # IndexedDB offline marks queue
│   ├── sync-engine.js      # Background sync when back online
│   ├── notifications-engine.js # notifyAction(), bell counter
│   ├── search-engine.js    # Universal search
│   ├── export-engine.js    # Excel/CSV/PDF export helpers
│   ├── print-engine.js     # Print helpers
│   ├── analytics-engine.js # School-wide statistics calculations
│   ├── animation-engine.js # Animation manager
│   ├── backup-engine.js    # Full DB backup/restore
│   ├── auto-tasks.js       # Fee reset watcher, auto archive
│   ├── academic-year-engine.js # Academic year switching
│   ├── app-health.js       # Performance monitoring
│   ├── command-palette.js  # Ctrl+K quick navigation
│   ├── pwa.js              # Manifest + service worker registration
│   ├── offline.js          # Offline status detection & UI
│   ├── router.js           # navigateTo(), loadModule(), SPA routing
│   ├── config.js           # App constants (aliases)
│   ├── constants.js        # Enum aliases
│   ├── window-exposure.js  # window.X = fn exports for onclick= use
│   ├── app.js              # App initialization, bootApp()
│   └── boot.js             # Boot sequence (called on DOMContentLoaded)
│
├── ui/                     # ③ UI rendering layer — load after core
│   ├── toasts.js           # showToast() — top-right notifications
│   ├── modals.js           # showModal(), closeModal(), confirmDialog()
│   ├── alerts.js           # Alert banner system
│   ├── loaders.js          # Loading indicators & spinners
│   ├── skeletons.js        # Skeleton screen loaders
│   ├── sidebar.js          # buildSidebar(), toggleSidebar()
│   ├── topbar.js           # Topbar rendering, phase badge
│   ├── shell.js            # App shell rendering (sidebar+topbar+theme)
│   ├── router.js           # UI router (navigateTo wrapper)
│   ├── forms.js            # Reusable form components
│   ├── buttons.js          # Loading button states
│   ├── tables.js           # SmartTable engine
│   ├── cards.js            # Dashboard stat cards
│   ├── charts.js           # ASCII bar helpers + Chart.js wrappers
│   ├── tabs.js             # Tab switching engine
│   ├── dropdowns.js        # Dropdown system
│   ├── accordions.js       # Accordion engine
│   ├── pagination.js       # Pagination engine
│   ├── badges.js           # Badge/pill components
│   ├── empty-states.js     # Reusable empty state renders
│   ├── notifications-ui.js # Notification bell UI
│   ├── tooltips.js         # Tooltip engine
│   ├── theme-manager.js    # Dark/light mode toggle
│   ├── context-menu.js     # Right-click context menu
│   └── responsive-ui.js    # Mobile UI behaviour
│
├── modules/                # ④ Feature screens — one file per screen
│   │
│   ├── dashboard.js        # Admin / Accountant / Teacher dashboards
│   ├── background-services.js # Background polling, auto-tasks
│   │
│   │── ACADEMICS ──────────────────────────────────────────────────
│   ├── marks.js                # Marks entry (inline popup validation)
│   ├── marks-database.js       # View/edit/lock all marks
│   ├── marks-analysis.js       # Per-assessment analysis
│   ├── marks-import-export.js  # Bulk marks Excel import/export
│   ├── assessments.js          # Assessment management
│   ├── assessment-locking.js   # Lock/unlock flow
│   ├── assessment-export.js    # Export assessment data
│   ├── class-register.js       # Class register (6 layouts)
│   ├── annual-register.js      # Annual register (Tot-MG/Tot-EX/G-TOT)
│   ├── register-export.js      # Register Excel export
│   ├── report-cards.js         # Report card generation (6 formats)
│   ├── report-generator.js     # PDF report card generator
│   ├── transcripts.js          # Student transcripts
│   ├── ranking-engine.js       # Class/school ranking engine
│   ├── rankings.js             # Rankings display module
│   ├── academic-reports.js     # Academic summary reports
│   ├── academic-years.js       # Academic year management
│   ├── academic-calendar.js    # Term dates & holiday calendar
│   ├── holidays.js             # Holidays CRUD
│   ├── timetable.js            # Timetable management
│   ├── timetable-import.js     # Import from Excel
│   ├── timetable-generator.js  # Auto-generate timetable
│   ├── timetable-conflicts.js  # Conflict detection
│   ├── teacher-timetable.js    # Per-teacher timetable view
│   ├── class-timetable.js      # Per-class timetable view
│   ├── staff-timetable.js      # Full staff timetable view
│   ├── attendance.js           # Record daily attendance (P/A/L/E)
│   ├── attendance-summary.js   # Per-student attendance rates
│   ├── attendance-reports.js   # Attendance reports & export
│   ├── attendance-analytics.js # Attendance trends & analytics
│   ├── statistics.js           # School-wide statistics & analytics
│   ├── analytics.js            # Analytics dashboard
│   ├── qr-code.js              # QR code system
│   │
│   │── STUDENTS ───────────────────────────────────────────────────
│   ├── students.js             # Student list & management
│   ├── student-registration.js # Enroll new student
│   ├── student-profile.js      # Student detail page (5 tabs)
│   ├── student-promotion.js    # Promotion wizard
│   ├── student-archive.js      # Archive & restore students
│   ├── student-fees.js         # Student fee summary
│   ├── student-statements.js   # Fee statements
│   ├── student-balances.js     # All-student balance view
│   ├── bulk-student-actions.js # Bulk import/export students
│   ├── sibling-linking.js      # Family/sibling management
│   └── family-management.js    # Family groups CRUD
│   ├── family-fee-summary.js   # Family-level fee summary
│   │
│   │── FINANCE ────────────────────────────────────────────────────
│   ├── finance.js              # Finance main module
│   ├── finance-dashboard.js    # Finance dashboard
│   ├── fee-structure.js        # Fee structure management
│   ├── fee-structures.js       # Fee structures list
│   ├── fee-assignments.js      # Fee assignment per student
│   ├── fee-term-status.js      # Fee status per term
│   ├── payments.js             # Payments main module
│   ├── payment-history.js      # Payment history & search
│   ├── payment-reversals.js    # Payment reversal flow
│   ├── record-payment.js       # Record new payment
│   ├── receipts.js             # Receipt management
│   ├── receipt-printing.js     # Thermal + standard receipt print
│   ├── balances.js             # Student balances
│   ├── carry-forward.js        # Balance carry-forward
│   ├── credit-balances.js      # Overpayment credit management
│   ├── discounts.js            # Discount management
│   ├── fee-waivers.js          # Fee waiver management
│   ├── overdue-payments.js     # Overdue payment alerts
│   ├── finance-reports.js      # Financial reports
│   ├── finance-audit.js        # Finance audit log
│   ├── bulk-finance-actions.js # Bulk fee actions
│   └── manual-adjustments.js   # Manual balance adjustments
│   │
│   │── STAFF ──────────────────────────────────────────────────────
│   ├── staff.js                # Staff management main
│   ├── teachers.js             # Teachers list & CRUD
│   ├── subjects.js             # Subjects management
│   ├── teacher-assignments.js  # Subject×class assignment matrix
│   └── teacher-performance.js  # Teacher performance report
│   │
│   │── NOTIFICATIONS ──────────────────────────────────────────────
│   ├── notifications.js        # Notifications list
│   ├── notification-center.js  # Full notification center (tabs)
│   ├── announcements.js        # Admin announcements CRUD
│   └── reminders.js            # Reminders management
│   │
│   │── SETTINGS ───────────────────────────────────────────────────
│   ├── settings.js             # Settings main / tabs
│   ├── school-settings.js      # School info & logo
│   ├── class-management.js     # Class CRUD & promotion rules
│   ├── grading-scale.js        # Grading scale management
│   ├── grading-settings.js     # Grading settings
│   ├── grading-system.js       # Grading system engine
│   ├── user-management.js      # User accounts (admin/teacher/accountant)
│   ├── users.js                # User profile & activity
│   ├── backup-restore.js       # Backup & restore
│   ├── system-logs.js          # System activity logs
│   ├── system-health.js        # System health monitor
│   ├── api-settings.js         # Supabase/API configuration
│   └── analytics-settings.js   # Analytics configuration
│
├── patches/                # Legacy patches (do not add new files here)
│   ├── analytics-helpers.js
│   ├── announcements.js
│   ├── missing-functions-98.js
│   ├── missing-functions.js
│   ├── missing-helpers.js
│   ├── system-logs.js
│   ├── v9-features.js
│   └── window-exposure-98.js
│
├── mobile/                 # Mobile-specific JS
│   ├── gestures.js             # Swipe & touch gestures
│   ├── mobile-navigation.js    # Bottom nav bar
│   ├── touch-optimizations.js  # Touch target sizing
│   ├── mobile-tables.js        # Horizontal scroll tables
│   ├── mobile-modals.js        # Mobile modal adjustments
│   ├── mobile-topbar.js        # Mobile topbar behaviour
│   └── remaining-mobile.js     # Miscellaneous mobile helpers
│
├── integrations/           # Third-party library wrappers
│   ├── chartjs.js          # Chart.js initialization helpers
│   ├── html2pdf.js         # html2pdf wrapper
│   ├── xlsx.js             # SheetJS/XLSX wrapper
│   ├── print.js            # Browser print helpers
│   └── icons.js            # Icon set helpers
│
└── workers/                # Web workers (heavy background tasks)
    ├── export-worker.js        # Excel/PDF export off main thread
    ├── report-worker.js        # Report generation worker
    ├── search-worker.js        # Search indexing worker
    └── analytics-worker.js     # Analytics calculations worker
```

---

## 🌐 HTML — Page Templates & Partials

```
html/
├── partials/               # App shell fragments (injected at runtime)
│   ├── login.html          # Login page HTML
│   ├── sidebar.html        # Sidebar component
│   ├── topbar.html         # Top navigation bar
│   ├── term-progress-bar.html
│   ├── content-container.html # Dynamic content wrapper
│   ├── toast-modal-containers.html
│   ├── modals.html
│   ├── loaders.html
│   ├── empty-states.html
│   └── footer.html
│
├── dashboard/
│   ├── dashboard-home.html
│   ├── dashboard-cards.html
│   └── dashboard-analytics.html
│
├── academics/
│   ├── marks-entry.html
│   ├── marks-database.html
│   ├── assessments.html
│   ├── class-register.html
│   ├── annual-register.html
│   ├── rankings.html
│   ├── report-cards.html
│   ├── transcripts.html
│   ├── timetable.html
│   ├── class-timetable.html
│   ├── teacher-timetable.html
│   ├── attendance-entry.html
│   ├── attendance-summary.html
│   ├── attendance-reports.html
│   ├── academic-calendar.html
│   ├── academic-reports.html
│   ├── analytics.html
│   ├── grading-system.html
│   └── statistics.html
│
├── students/
│   ├── students-list.html
│   ├── student-registration.html
│   ├── student-profile.html
│   ├── student-promotion.html
│   ├── student-archive.html
│   ├── student-fees.html
│   ├── student-statements.html
│   ├── sibling-linking.html
│   └── family-management.html
│
├── finance/
│   ├── finance-dashboard.html
│   ├── fee-structures.html
│   ├── fee-assignments.html
│   ├── fee-term-status.html
│   ├── fee-waivers.html
│   ├── payment-recording.html
│   ├── payment-history.html
│   ├── payment-reversals.html
│   ├── receipts.html
│   ├── statements.html
│   ├── balances.html
│   ├── carry-forward.html
│   ├── discounts.html
│   ├── overdue-payments.html
│   ├── family-fee-summary.html
│   └── finance-reports.html
│
├── teachers/
│   ├── teachers-list.html
│   ├── subjects.html
│   ├── teacher-assignments.html
│   ├── teacher-performance.html
│   └── staff-timetable.html
│
├── notifications/
│   ├── notifications.html
│   ├── notification-center.html
│   ├── announcements.html
│   └── reminders.html
│
├── settings/
│   ├── school-settings.html
│   ├── academic-years.html
│   ├── class-management.html
│   ├── grading-settings.html
│   ├── user-management.html
│   ├── backup-restore.html
│   ├── system-logs.html
│   ├── system-health.html
│   ├── api-settings.html
│   └── analytics-settings.html
│
└── users/
    ├── profile.html
    ├── activity-logs.html
    ├── permissions.html
    └── sessions.html
```

---

## 🗂️ OTHER FOLDERS

```
assets/
├── logos/                  # School logo, favicon, PWA icons
│   ├── school-logo.png
│   ├── school-logo-light.png
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── icon-144.png
│   └── site.webmanifest
├── images/                 # backgrounds, avatars, banners, illustrations
├── icons/                  # UI icons by category
├── audio/                  # Notification & alert sounds
└── fonts/                  # Self-hosted fonts (Syne, DM Sans, Inter)

templates/
├── receipts/               # Receipt HTML templates
│   ├── receipt-template.html
│   ├── modern-receipt.html
│   └── compact-receipt.html
├── reports/                # Report card & transcript templates
│   ├── report-card-template.html
│   ├── transcript-template.html
│   ├── attendance-template.html
│   ├── finance-template.html
│   └── ranking-template.html
└── exports/                # Excel import templates
    ├── excel-template.xlsx
    ├── marks-template.xlsx
    └── finance-template.xlsx

pwa/
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── offline-cache.js        # Offline cache management
├── install.js              # PWA install prompt handler
└── icons/                  # PWA icons (192×192, 512×512)

docs/
├── architecture.md         # System architecture overview
├── setup-guide.md          # Installation & setup
├── database-schema.md      # Supabase table schemas
├── finance-workflow.md     # Finance module workflow
├── academics-workflow.md   # Academics module workflow
├── permissions.md          # Role-based access control
├── deployment.md           # Deployment guide
├── troubleshooting.md      # Common issues & fixes
└── changelog.md            # Version history

tests/
├── auth-tests.js
├── finance-tests.js
├── marks-tests.js
├── timetable-tests.js
├── attendance-tests.js
├── ui-tests.js
├── router-tests.js
├── validation-tests.js
├── offline-tests.js
└── performance-tests.js

data/                       # Runtime data (gitignored in production)
├── imports/                # Bulk import staging
├── exports/                # Generated exports
├── backups/                # Local backup files
├── temp/                   # Temporary files
└── demo/                   # Demo/seed data

backups/                    # Scheduled backup storage
├── daily/
├── weekly/
├── monthly/
└── emergency/
```

---

## 🗄️ DATABASE — Supabase (ovmymtdrugdljnttiltd)

```
30 tables total:

CORE
  academic_years            — Year labels, start/end dates
  terms                     — 3 terms per year, midterm_date, status
  holidays                  — Public holidays & school breaks
  school_settings           — All school config (name, logo, pass_mark, admin_password)
  grading_scale             — A+/A/B/C/D/F with % ranges (configurable)

CLASSES & SUBJECTS
  classes                   — N1–N3 + P1–P5 (8 classes, no P6)
  subjects                  — 8 nursery + 9 primary, mg_max/ex_max, post_midterm_only flag

STAFF
  teachers                  — All users: admin/teacher/accountant roles
  teacher_assignments       — Subject × class × teacher × year
  timetable_slots           — Day/time/room/teacher/class/subject

STUDENTS
  families                  — Guardian info, discount_amount
  students                  — Student records, class_id, family_id, status

ACADEMICS
  assessments               — Per class/subject/term, is_locked
  marks                     — Score per student per assessment, is_absent

FINANCE
  fee_categories            — Fee types: monthly/termly/annual/one_time
  fee_amounts               — Amount per category × class × year
  student_fees              — Fee assigned to each student (paid_amount, is_paid)
  student_credit_balance    — Overpayment credit per student
  payments                  — Payment records with receipt_number
  payment_allocations       — FIFO allocation of payment to fees
  fee_waivers               — Waiver records with reason & type

ATTENDANCE
  attendance                — Daily P/A/L/E per student per class

PROMOTIONS
  promotion_batches         — Promotion batch header (year→year)
  promotions                — Per-student promotion records (action, annual_percent)

NOTIFICATIONS & LOGS
  notifications             — In-app notifications per recipient
  announcements             — Admin-sent announcements
  reminders                 — Personal reminders per user
  system_logs               — Full audit log of all actions
  activity_logs             — Legacy activity log
  discounts                 — Discount rules per fee category
```

---

## 🔄 JS LOAD ORDER (in index.html)

```
① config/       supabase-config → app-config → constants → role-permissions
② core/         state → logger → error-handler → storage → cache →
                supabase-client → api → database → db-safe-query →
                sanitizers → validators → helpers → utils →
                academic-formulas → finance-formulas → permissions →
                auth → data-loader → data-refresh →
                offline-engine → sync-engine → notifications-engine →
                search-engine → export-engine → print-engine →
                analytics-engine → animation-engine → backup-engine →
                auto-tasks → academic-year-engine → app-health →
                command-palette → pwa → offline
③ ui/           toasts → modals → alerts → loaders → skeletons →
                sidebar → topbar → shell → router → forms → buttons →
                tables → cards → charts → tabs → dropdowns →
                accordions → pagination → badges → empty-states →
                notifications-ui → tooltips → theme-manager →
                context-menu → responsive-ui
④ modules/      dashboard → background-services → [all feature modules]
⑤ mobile/       gestures → mobile-navigation → touch-optimizations →
                mobile-tables → mobile-modals → mobile-topbar → remaining-mobile
⑥ integrations/ xlsx → html2pdf → print → icons
⑦ boot/         core/router → core/config → core/constants →
                core/window-exposure → core/app → core/boot → main.js
```

---

## 👥 ROLES & ACCESS

| Role | Login | Sidebar |
|------|-------|---------|
| Admin | password only | Everything |
| Accountant | username + password | Finance only |
| Teacher | username + password | Academics only |
| Class Teacher | teacher where `classes.class_teacher_id = id` | + attendance, register, timetable, marks (their class) |

Role CSS: `body.role-admin` (navy) · `body.role-accountant` (teal) · `body.role-teacher` (purple)

---

*This file is auto-generated. Update after major structural changes.*
