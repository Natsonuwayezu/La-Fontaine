# 🏫 Ecole La Fontaine — School Management System

**Version:** 9.0.0 | **Location:** Rubavu, Rwanda | **Currency:** RWF

A complete, role-based School Management System built as a Single Page Application (SPA) powered by Supabase. Covers academics, finance, attendance, timetables, report cards, staff, and more.

---

## 👥 Roles & Access

| Role | Access |
|------|--------|
| **Admin** | Full access to everything |
| **Accountant** | Finance only — no academics |
| **Teacher** | Academics only — no finance |

---

## 🗂️ Project Structure

```
/
├── index.html                          # SPA shell — all CSS & JS imports
├── offline.html
├── 404.html
│
├── css/
│   ├── core/                           # Foundation: variables, reset, typography,
│   │   │                               # layout, spacing, animations, themes...
│   │   └── inline-extracted.css        # Styles pulled out of JS (new)
│   ├── components/                     # sidebar, topbar, cards, tables, forms,
│   │                                   # buttons, modals, toasts, charts...
│   ├── pages/                          # Per-page styles: login, marks, finance,
│   │                                   # timetable, report-cards, settings...
│   ├── mobile/                         # mobile.css, mobile-enhanced.css,
│   │                                   # responsive-overrides.css
│   └── print/                          # print.css, print-overrides.css
│
├── js/
│   ├── config/                         # supabase-config, app-config,
│   │                                   # constants, role-permissions
│   ├── core/                           # state, api, utils, auth, offline,
│   │                                   # formulas, data-refresh, boot...
│   ├── ui/                             # shell, toasts, router
│   ├── modules/                        # One file per feature screen (42 modules)
│   └── patches/                        # Restored & hotfix functions
│
├── html/
│   └── partials/                       # login, sidebar, topbar,
│                                       # term-progress-bar, content-container,
│                                       # toast-modal-containers
│
├── assets/                             # logos, images, icons, audio, fonts
├── templates/                          # receipts, reports, excel exports
├── pwa/                                # manifest.json, sw.js, icons
├── data/                               # imports, exports, backups, demo
├── docs/                               # architecture, setup, schema, workflows
├── tests/
└── backups/
```

---

## 📦 Modules (js/modules/)

### Academics
`dashboard` · `marks` · `marks-analysis` · `marks-import-export` · `assessment-locking` · `class-register` · `register-export` · `assessments` · `report-cards` · `report-generator` · `transcripts` · `ranking-engine` · `academic-reports` · `academic-years` · `holidays` · `timetable` · `attendance`

### Students & Finance
`students` · `student-fees` · `fee-term-status` · `payments` · `receipts` · `fee-structure` · `finance-reports` · `student-balances` · `credit-balances` · `carry-forward` · `discounts` · `bulk-finance-actions` · `payment-reversals` · `manual-adjustments` · `family-management`

### Staff & Settings
`staff` · `teacher-performance` · `class-management` · `grading-scale` · `notifications` · `settings` · `backup-restore` · `api-settings` · `system-health` · `analytics-settings`

### System
`background-services` · `qr-code`

---

## ⚙️ JS Load Order

```
config → core → ui → modules → patches
```

---

## 🧰 Tech Stack

- **Frontend:** Vanilla JS SPA
- **Backend:** Supabase (PostgreSQL + REST API)
- **Charts:** Chart.js 4.4
- **Excel:** SheetJS
- **PDF:** html2pdf.js
- **Fonts:** Syne, DM Sans (Google Fonts)
- **PWA:** Service Worker + IndexedDB offline support

---

## 👨‍🏫 Author
Natson Uwayezu — Ecole La Fontaine, Rubavu, Rwanda
