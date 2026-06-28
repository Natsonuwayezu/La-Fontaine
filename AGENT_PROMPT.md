# AGENT PROMPT — ÉCOLE LA FONTAINE SCHOOL MANAGEMENT SYSTEM
# ============================================================
# READ THIS FIRST before touching any file in this repository.
# This prompt is designed for any AI agent (Claude, GPT, Gemini,
# Copilot, or any other) to immediately understand the project,
# pick up where the last agent left off, and contribute correctly.
# ============================================================


## 1. WHAT IS THIS PROJECT?

A **school management SPA** (Single-Page Application) for
**École La Fontaine**, a primary school (P1–P6) in Kigali, Rwanda.

The app manages: student enrollment, academic marks, report cards,
attendance, staff, fee collection, receipts, and all school settings.

**Technology stack:**
- Frontend: Pure HTML + CSS + Vanilla JavaScript (no framework)
- Database: Supabase (PostgreSQL), REST API
- Hosting: GitHub Pages / Netlify (static)
- Language: Bilingual — French primary, English secondary
- Currency: RWF (Rwandan Franc)

**School details:**
- Name: École La Fontaine
- Location: Kigali, Rwanda
- Classes: P1, P2, P2B, P3, P4, P5, P6 (7 total, P2B is parallel class)
- Academic year: 2025–2026 (3 terms)

**Repository:** https://github.com/Natsonuwayezu/La-Fontaine
**Supabase project:** ovmymtdrugdljnttiltd (region: eu-west-1)
**Admin login:** username=admin, password=admin123


## 2. FOUR KEY FILES — READ THEM ALL

| File | Purpose |
|------|---------|
| `frontend.txt` | 14,355-line ASCII wireframes of every page/screen |
| `backend.txt`  | All formulas, business logic, DB schema, rules |
| `progress.txt` | Task tracker — shows what's done, in progress, TODO |
| `AGENT_PROMPT.md` | This file — how to contribute correctly |

**Before doing ANY work:**
1. Read `progress.txt` to see current state and what's next
2. Read `backend.txt` for the specific section you'll work on
3. Check `frontend.txt` for the wireframe of the page you're building
4. After completing a task, update `progress.txt` (change [ ] to [x])


## 3. CURRENT STATE OF THE CODE

The main working file is **`index.html`** (37,623 lines).
It contains all HTML, CSS, and JavaScript in one file.
This is intentional — it works as a fully offline-capable SPA.

**Do NOT refactor into separate files** unless specifically asked.
The multi-file structure in `js/`, `css/`, `html/` is aspirational
and currently incomplete (patches folder = 530KB of overflow code).

**Working modules (SHELL + LOGIC exists):**
marks entry, payments, fee structure, staff, students list,
report cards, transcripts, class register, attendance entry,
attendance summary, dashboard, settings, academic years,
grading scale, backup/restore, API settings, system logs,
announcements, reminders, timetable

**Not yet built (TODO):**
student profile, family groups, teacher performance,
fee waivers, student balances, payment reversals,
statistics/analytics, bulk import/export, system health,
attendance reports, academic calendar


## 4. DATABASE — SUPABASE

**Connection:**
```
URL: https://ovmymtdrugdljnttiltd.supabase.co
Anon key: stored in localStorage key 'sb_key'
          (visible in js/config/supabase-config.js — UPDATE THIS)
```

**CRITICAL:** The code currently points to the OLD Supabase project
(hejdppzparottbcnycjo). You MUST update it to use the new project.
See progress.txt task P0-10 / P1-05.

**All 23 tables exist and are seeded** (created 2026-06-28).
See `backend.txt` Section 3 for full schema of every table.

**API pattern used:**
```javascript
// GET
const rows = await api('students?is_deleted=eq.false&order=last_name', 'GET');

// POST (insert)
const result = await api('students', 'POST', { first_name, last_name, ... });

// PATCH (update)
await api('students?id=eq.' + id, 'PATCH', { status: 'Inactive' });

// UPSERT (insert or update)
await api('marks', 'POST', payload);
// with header: 'Prefer': 'resolution=merge-duplicates'
```

**RLS is currently DISABLED** — all tables are public.
This is a security risk. Task P0-04 needs RLS policies.
Suggested policy (apply to each table):
```sql
-- Allow all authenticated reads, restrict writes to admin
CREATE POLICY "read_all" ON tablename FOR SELECT USING (true);
CREATE POLICY "admin_write" ON tablename FOR ALL
  USING (auth.role() = 'authenticated');
```
NOTE: Since the app uses custom auth (not Supabase Auth), RLS is complex.
For now, the risk is acceptable for a school intranet. Do not block on this.


## 5. HOW TO WORK ON A FEATURE

### If building a new page:
1. Find the wireframe in `frontend.txt` (search by page name)
2. Read the behaviour spec in `backend.txt` Section 7
3. Find the JS module file in `js/modules/` (or `index.html` for inline)
4. Implement: render function → data fetch → event handlers → exports
5. Register in the navigation system (buildSidebar, navigateTo)
6. Expose functions via `window.functionName = functionName`
7. Test: load page, CRUD operations, edge cases (empty state, errors)
8. Update `progress.txt`: change `[ ]` to `[x]`, add DONE_BY + DATE

### If fixing a bug:
1. Find the bug in `backend.txt` Section 11 (BUG-001 to BUG-006)
2. Read the fix instructions
3. Apply the fix in the correct file
4. Update `progress.txt`: find the task (P1-01 to P1-05) and mark done

### If modifying the database:
1. Use Supabase MCP tool or SQL editor
2. Document any new tables/columns in `backend.txt` Section 3
3. Add a migration note to `docs/changelog.md`


## 6. CODE CONVENTIONS

**JavaScript:**
```javascript
// All functions exposed via window for onclick= handlers
window.myFunction = myFunction;

// API calls always go through api() wrapper
async function api(path, method = 'GET', body = null) { ... }

// State is a single global object
const state = { students: [], teachers: [], ... };

// Escape HTML before rendering (prevent XSS)
function esc(str) { return String(str || '').replace(/[&<>"']/g, ...); }

// Format currency
function formatCurrency(amount) { return 'RWF ' + Math.round(amount).toLocaleString(); }

// Format date for display (DD/MM/YYYY)
function fmtDate(dateStr) { ... }
```

**DO NOT:**
- Use React, Vue, Angular, or any framework
- Use Supabase JS client library (uses direct REST fetch instead)
- Use Supabase Auth (uses custom auth stored in localStorage)
- Add new external CDN dependencies without checking if already loaded
- Hardcode grade boundaries or pass marks (always read from state)
- Create new patch files — put code in the correct module instead

**DO:**
- Always call `esc()` before inserting user data into HTML
- Always refresh state after mutations: `await refreshTable('tablename')`
- Always log mutations: `logActivity(action, tableName, recordId)`
- Always show feedback: `showToast('Success message', 'success')`
- Always handle errors: `try { ... } catch(e) { showToast(e.message, 'error') }`


## 7. ROLE SYSTEM

Three roles — always check before rendering admin-only features:

```javascript
const isAdmin = () => state.currentUser?.role === 'admin';
const isTeacher = () => state.currentUser?.role === 'teacher';
const isAccountant = () => state.currentUser?.role === 'accountant';

// Hide/disable admin-only buttons for non-admins
if (!isAdmin()) {
  document.getElementById('delete-btn')?.remove();
}
```

See `backend.txt` Section 2 for full list of which modules each role can access.
See `js/config/role-permissions.js` for the ADMIN_ONLY_MODULES set.


## 8. KEY FORMULAS (quick reference)

**Grade from percentage:**
```javascript
function getGrade(pct) {
  const scale = state.gradingScale.length ? state.gradingScale : DEFAULT_GRADES;
  return scale.find(g => pct >= g.min_percentage && pct <= g.max_percentage)
    || scale[scale.length - 1]; // fallback to lowest
}
```

**Pass/fail:**
```javascript
function isPassing(pct) {
  return pct >= parseFloat(state.schoolSettings?.pass_mark || 50);
}
```

**Student balance:**
```javascript
const totalFees = studentFees.reduce((s, f) => s + (!f.is_waived ? f.amount : 0), 0);
const totalPaid = payments.reduce((s, p) => s + (!p.is_reversed ? p.amount : 0), 0);
const balance = totalFees - totalPaid; // positive = owes money
```

**Attendance rate:**
```javascript
const presentDays = attendance.filter(a => a.status === 'present').length
  + attendance.filter(a => a.status === 'late').length * 0.5;
const rate = (presentDays / schoolDays) * 100;
```

Full formulas: `backend.txt` Sections 4 and 5.


## 9. WHAT TO DO RIGHT NOW (Priority Order)

Based on `progress.txt` current state:

**BLOCKING (do first):**
1. **P0-10 / P1-05** — Update Supabase URL in `index.html` and
   `js/config/supabase-config.js` from old project to new one.
   Old: `hejdppzparottbcnycjo.supabase.co`
   New: `ovmymtdrugdljnttiltd.supabase.co`
   Also update the anon key (get it from Supabase dashboard → Settings → API)

**HIGH PRIORITY:**
2. **P1-01** — Fix `calculateGrade()` to use `getGrade()` from DB
3. **P1-02** — Fix hardcoded `>= 50` pass mark checks (10 places)
4. **P1-03** — Fix decision banner full text (EN + FR)
5. **P1-04** — Fix mobile sidebar overlay `.active` bug

**THEN (in order):**
6. P3-01 to P3-03 — Core academic + finance formula implementations
7. P2-07 — Student profile page
8. P2-28 to P2-30 — Fee waivers, student balances, payment reversals
9. P2-18 — Statistics/analytics page
10. P4-01 to P4-04 — Merge patch files into proper modules


## 10. COMMIT CONVENTIONS

When you push changes to GitHub:
```
git add -A
git commit -m "TYPE: Short description

- Detail 1
- Detail 2
TASKS: P1-01, P1-02"
git push origin main
```

Types: FIX | FEAT | REFACTOR | DOCS | DB | STYLE | TEST

Always include which progress.txt tasks were completed in the commit message.


## 11. TESTING YOUR CHANGES

After making changes, verify:
1. Open `index.html` in a browser (needs a local server for JS modules,
   use `python3 -m http.server 8080` or VS Code Live Server)
2. Log in with admin/admin123 — if Supabase URL is updated correctly,
   this will work against the real DB
3. Navigate to the page you changed
4. Test happy path: create, read, update, delete
5. Test error path: invalid input, network error (disconnect wifi)
6. Check browser console for JavaScript errors (should be 0)
7. Check mobile view (Chrome DevTools → toggle device toolbar)


## 12. FILES OVERVIEW

```
La-Fontaine/
├── index.html              ← MAIN FILE — entire SPA (37,623 lines)
├── frontend.txt            ← Wireframes for all pages
├── backend.txt             ← Logic, formulas, schema reference
├── progress.txt            ← Task tracker (UPDATE WHEN DONE)
├── AGENT_PROMPT.md         ← This file
├── js/
│   ├── config/             ← app-config, constants, roles, supabase-config
│   ├── core/               ← api, auth, boot, state, utils, formulas
│   ├── modules/            ← One file per feature (25 modules)
│   ├── patches/            ← TEMPORARY overflow (merge into modules)
│   └── mobile/             ← Mobile-specific enhancements
├── css/                    ← Stylesheets by category
├── html/partials/          ← Shell HTML fragments (mostly empty)
├── docs/                   ← Architecture docs (all empty — fill these)
├── assets/                 ← Images, logos, exports
└── data/                   ← Static data files
```


## 13. CONTACTS & CREDENTIALS

| Item | Value |
|------|-------|
| School | École La Fontaine, Kigali, Rwanda |
| Owner/Dev | Natson Uwayezu |
| GitHub | Natsonuwayezu/La-Fontaine |
| GitHub PAT | [REDACTED-USE-YOUR-OWN-PAT] |
| Supabase project | School Demo (ovmymtdrugdljnttiltd) |
| Supabase region | eu-west-1 |
| App admin | username: admin / password: admin123 |

---

**You are now fully briefed. Check `progress.txt`, pick the highest-priority
TODO task, implement it correctly using `backend.txt` and `frontend.txt` as
your guide, then mark it done in `progress.txt` and commit.**
