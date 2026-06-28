# Architecture — Ecole La Fontaine

## Overview
Single-file SPA: `index.html` (~37,000 lines)
Backend: Supabase (PostgreSQL via REST API)
Language: Vanilla JavaScript ('use strict'), no framework, no bundler

## File Structure in Repo Root
```
index.html       ← The entire application
frontend.txt     ← ASCII wireframes for every screen
backend.txt      ← Formulas, DB schema, business rules, API contracts
progress.txt     ← Build tracker (read this to know what's done/next)
AGENT_PROMPT.md  ← Universal agent guide (read this first every session)
docs/            ← Detailed documentation per domain
```

## JavaScript Organization (inside index.html)
```
Section A  — Config & Constants (APP_CONFIG, GRADE defaults, PROMOTION_MAP, TIMETABLE)
Section B  — Offline Support / IndexedDB (queue marks offline, sync on reconnect)
Section C  — Supabase API Layer (get, getAll, insert, update, delete_, apiRequest)
Section D  — Global State (state object, loadInitialData, refreshTable, lookup helpers)
Section E  — Utilities & Formulas (fmt, fmtCurrency, esc, getGrade, calcMG, calcEX...)
Section F  — Authentication (login, logout, session, biometric)
Section G  — Login Page Logic (card animation, particles, role switch)
Section H  — App Shell (sidebar, topbar, routing, theme, fee reset automation, bootApp)
Section I  — Module Router (loadModule dispatch, 40+ render functions)
Section J+ — All module render functions (dashboard, marks, finance, students, settings...)
Window     — All functions exported to window.* for onclick handlers
```

## CSS Architecture (inside index.html)
- CSS custom properties for all colors, spacing, shadows, z-index
- Role-based theming via body.role-admin / .role-accountant / .role-teacher
- Light/dark mode via [data-theme="light|dark"] on <html>
- Full utility framework (grid, flex, spacing, typography, display, cursor, opacity)
- Component styles (cards, tables, badges, buttons, modals, toasts, tabs)
- Mobile-first responsive (breakpoints: 480px, 768px, 900px, 1024px)

## Data Flow
1. bootApp(user) → loadInitialData() → 14 parallel Supabase fetches → state object
2. navigateTo(moduleId) → loadModule(id) → renderXxx(container) → innerHTML
3. User action → Supabase write → refreshTable(name) → re-render
4. Notifications → polled every 60s → bell badge updated

## Key Design Decisions
- No framework: reduces complexity, single file deployable anywhere
- All rendering via innerHTML with esc() for XSS prevention
- window.* exports required because strict mode + inline onclick handlers
- Supabase anon key in plaintext: acceptable with RLS, upgrade later
- Passwords in plaintext: known issue, upgrade to bcrypt in future
