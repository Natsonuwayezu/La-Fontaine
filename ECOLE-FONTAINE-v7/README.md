# ECOLE LA FONTAINE — School Management System

## Overview
Complete school management system with role-based access (Admin, Accountant, Teacher).

## Features
- ✅ Role-based dashboards (Admin/Accountant/Teacher)
- ✅ Student management (enroll, edit, archive, promote)
- ✅ Marks entry & class register (pre/post midterm phases)
- ✅ Report cards (6 formats: Nursery/Pre, Nursery/Post, Nursery/Annual, Primary/Pre, Primary/Post, Primary/Annual)
- ✅ Finance management (fee structures, payments, receipts, waivers)
- ✅ Timetable (class + teacher views, Excel import)
- ✅ Assessments with lock/unlock
- ✅ Sibling linking & family discounts
- ✅ Offline marks entry with IndexedDB
- ✅ PWA installable
- ✅ Biometric login (WebAuthn)
- ✅ Auto-backup & restore
- ✅ Rwanda public holidays import

## Tech Stack
- HTML5, CSS3, Vanilla JavaScript (ES6+)
- Supabase (PostgreSQL backend)
- Chart.js, SheetJS, html2pdf.js

## Folder Structure
ECOLE-LA-FONTAINE-SMS/
├── index.html # Main entry point
├── offline.html # Offline fallback
├── 404.html # Not found page
├── css/ # All stylesheets
├── js/ # All JavaScript modules
├── html/ # HTML partials
├── assets/ # Images, fonts, icons
├── pwa/ # PWA manifest & service worker
├── templates/ # Report & receipt templates
├── data/ # Imports, exports, backups
├── docs/ # Documentation
└── tests/ # Test files


## Installation
1. Clone the repository
2. Deploy to Netlify (or any static host)
3. Configure Supabase URL & API key in `js/core/config.js`

## Default Login
| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Teacher | teacher | teacher123 |
| Accountant | accountant | acc123 |

## License
Proprietary — ECOLE LA FONTAINE