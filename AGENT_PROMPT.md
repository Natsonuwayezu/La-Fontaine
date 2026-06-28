# ECOLE LA FONTAINE — UNIVERSAL AGENT PROMPT
## Read this first. Every agent. Every session. No exceptions.

---

## WHAT THIS PROJECT IS

A complete **school management system** for **Ecole La Fontaine**, a Rwandan school (Nursery through Primary 6).
It is a **single-file SPA** (`index.html`) backed by **Supabase** (PostgreSQL via REST API).
No framework. No bundler. Vanilla JavaScript in `'use strict'` mode.
Currency: **RWF** (Rwandan Franc). Language: English UI, French on report cards.

**Live repo:** https://github.com/Natsonuwayezu/La-Fontaine
**Working file:** `index.html` in repo root (37,000+ lines)
**Supabase project:** `hejdppzparottbcnycjo.supabase.co`

---

## THE FOUR REFERENCE FILES — READ THEM ALL

| File | Purpose |
|------|---------|
| `frontend.txt` | Complete ASCII wireframes for every screen and module |
| `backend.txt` | All formulas, DB schema, business rules, API contracts |
| `progress.txt` | What is done, what is next, what is blocked |
| `AGENT_PROMPT.md` | This file — how to work on this project |

**Before writing a single line of code**, read:
1. `progress.txt` → find out what's done and what's next
2. `backend.txt` → understand the formula or rule you're implementing
3. `frontend.txt` → understand what the UI should look like

---

## ROLES IN THE SYSTEM

| Role | Username | Access |
|------|----------|--------|
| **Admin** | (no username — password only) | Full access to everything |
| **Accountant** | username + password | Finance modules only |
| **Teacher** | username + password | Academic modules only |
| **Class Teacher** | teacher with `classes.class_teacher_id = teacher.id` | + attendance, register, timetable for their class |

---

## CRITICAL RULES — NEVER VIOLATE THESE

### 1. Pass Mark — NEVER hardcode 50
```javascript
// ❌ WRONG
if (pct >= 50) passCount++;

// ✅ CORRECT
const passMark = parseFloat(state.schoolSettings?.pass_mark || 50);
if (pct >= passMark) passCount++;
```

### 2. Grading — NEVER use calculateGrade() directly
```javascript
// ❌ WRONG — ignores school's grading scale
calculateGrade(pct)

// ✅ CORRECT — uses grading_scale table from DB
getGrade(pct, state.gradingScale || null)
```

### 3. Marks validation — NEVER silently clamp
```javascript
// ❌ WRONG — user never knows their value was changed
const n = Math.min(max, Math.max(0, Number(val)));

// ✅ CORRECT — show inline popup on the input field
// See updateMarkGrade() in index.html for the popup implementation
// Popup offers: auto-correct | manual fix | clear
```

### 4. Save marks — ALWAYS gate on completeness
```javascript
// Block save if:
// A) Any popup is open (invalid score)
if (document.querySelectorAll('[id^="val-popup-"]').length > 0) BLOCK;
// B) Any student has empty input and is not marked absent
if (emptyInputs.length > 0) BLOCK;
```

### 5. Notifications — ALWAYS dispatch on payment and marks
```javascript
// Admin records payment → notify accountant
// Accountant records payment → notify admin
// Teacher saves marks → notify admin
// Admin edits marks → notify teacher
// Use: notifyAction(action, details, targetRoles)
```

### 6. window.* exports — ALL functions must be on window
```javascript
// At the bottom of the script, or inline after definition:
window.myFunction = myFunction;
// Every onclick="..." handler calls window.functionName()
```

### 7. Completion rate formula — CORRECT version
```javascript
// WRONG: students_with_any_mark / total_students
// CORRECT:
let totalPossible = 0, totalFilled = 0;
for (const cls of teacherClasses) {
    const studentCount = activeStudents.filter(s => s.class_id === cls.id).length;
    const termAssessments = assessments.filter(a => a.class_id === cls.id && a.term_id === termId);
    for (const a of termAssessments) {
        totalPossible += studentCount;
        totalFilled += a.is_locked ? studentCount : marks.filter(m => m.assessment_id === a.id).length;
    }
}
const completionPct = totalPossible > 0 ? (totalFilled / totalPossible) * 100 : 0;
```

---

## CODE ARCHITECTURE

### State Object
```javascript
state = {
    currentUser, classes, subjects, terms, academicYears,
    students, teachers, assessments, marks, feeCategories,
    feeAmounts, studentFees, payments, schoolSettings, gradingScale,
    families, activityLogs, notifications, reminders,
    currentTerm, currentAcadYear,
    cache: { studentBalances: Map, classStats: Map, ranks: Map }
}
```

### Module Router
```javascript
loadModule(id) → renders to document.getElementById('dynamic-content')
// Access control checked here — TEACHER_BLOCKED_MODULES and ACCOUNTANT_BLOCKED_MODULES Sets
// Class teacher access: classes.class_teacher_id === user.id
```

### API Layer
```javascript
// All Supabase calls go through these wrappers:
get(table, params)          // GET with auto-pagination
getAll(table, filters)      // high-level, limit 50000
getById(table, id)          // single row
insert(table, data)         // POST
update(table, id, data)     // PATCH
delete_(table, id)          // DELETE
apiRequest(endpoint, method, body)  // raw wrapper
```

### UI Patterns
```javascript
showToast(msg, type, duration)   // bottom-right toast notification
showModal(html)                  // inject modal into #modals-container
closeModal(id)                   // remove modal
confirmDialog(msg)               // returns Promise<boolean>
navigateTo(moduleId)             // route to a module
```

### CSS Variables (role-based theming)
```css
/* Admin:      --role-primary: #1a3a5c (navy) */
/* Accountant: --role-primary: #0d9488 (teal) */
/* Teacher:    --role-primary: #7c3aed (purple) */
/* Applied via body.role-admin / .role-accountant / .role-teacher */
```

---

## ASCII CHART PATTERN (used in dashboards — NO Chart.js)

```javascript
// Horizontal bar
function asciiBar(pct, width=20) {
    const f = Math.round((pct/100)*width);
    return '█'.repeat(f) + '░'.repeat(width-f);
}

// Vertical column chart
// Build row by row from top (height) to bottom (0)
// Each column gets '▓▓' if its value fills that row
```

---

## HOW TO MAKE A CHANGE TO index.html

1. Copy `index.html` to working directory
2. Use Python str_replace for large blocks (avoids escaping issues):
```python
with open('/home/claude/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(OLD, NEW, 1)
with open('/home/claude/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
```
3. Verify the replacement landed: `grep -n "your_new_text" /home/claude/index.html`
4. Check no syntax errors: `node --check /home/claude/index.html 2>&1 | head -20` (or python3 html.parser)
5. Copy to repo and push:
```bash
cp /home/claude/index.html /tmp/La-Fontaine/index.html
cd /tmp/La-Fontaine
git add index.html progress.txt
git commit -m "feat: description of what changed"
git push origin main
```
6. Update `progress.txt` — mark tasks [x] with date

---

## HOW TO CLONE THE REPO IN A NEW SESSION

```bash
git clone https://<YOUR_GITHUB_PAT>@github.com/Natsonuwayezu/La-Fontaine.git /tmp/La-Fontaine
cd /tmp/La-Fontaine
# Working file is index.html
# Reference files: frontend.txt, backend.txt, progress.txt
```

---

## WHAT TO WORK ON NEXT (as of 2026-06-28)

Read `progress.txt` for the full list. The immediate next tasks are:

1. **P1-08** — Admin dashboard rebuild
   - Replace Chart.js canvas charts with ASCII bars
   - Fee collection by class (ASCII horizontal bars)
   - Marks completion overview (ASCII)
   - Recent activity log
   - Quick actions grid

2. **P2-05** — Marks database: edit → notify teacher + admin
   - When admin edits a mark → notifyAction to the teacher who entered it

3. **P5-01** — Attendance module (record attendance)
   - Class teacher only
   - Per-student Present/Absent/Late/Excused grid
   - Save triggers notification if not recorded by end of day

4. **P4-06** — Notification center full page
   - Tabs: All / Unread / Payments / Marks / System
   - Mark read individually or all
   - Deep link buttons to resource

---

## COMMON MISTAKES TO AVOID

| Mistake | Correct approach |
|---------|-----------------|
| Using Chart.js | Use ASCII bar/column charts instead |
| Hardcoding `>= 50` | Use `state.schoolSettings?.pass_mark \|\| 50` |
| Using `calculateGrade()` | Use `getGrade(pct, state.gradingScale)` |
| Silent `Math.min/Math.max` clamping | Show inline popup on input |
| Saving marks without checking all students | Gate save on completeness |
| Not dispatching notification after payment | Always call notifyAction() |
| Creating functions without `window.*` export | Add `window.fn = fn` at bottom |
| Using `innerHTML` with unsanitized user data | Wrap in `esc()` function |
| Modifying files in /mnt/user-data/uploads/ | Always copy to /home/claude/ first |

---

## FILE LOCATIONS

| Path | Description |
|------|-------------|
| `/tmp/La-Fontaine/index.html` | Working copy of the app (after cloning) |
| `/tmp/La-Fontaine/frontend.txt` | All UI wireframes |
| `/tmp/La-Fontaine/backend.txt` | All formulas and business rules |
| `/tmp/La-Fontaine/progress.txt` | Build progress tracker |
| `/mnt/user-data/uploads/` | User-uploaded files (READ ONLY) |
| `/home/claude/` | Agent working directory |

---

## DEPLOYMENT

The app is deployed via GitHub. Any push to `main` branch is the live version.
To make it publicly accessible, connect the repo to Netlify (free tier):
- Site URL will be: `https://la-fontaine.netlify.app` (or similar)
- No build step needed — `index.html` is the app

---

*This file was last updated: 2026-06-28*
*If you update the project significantly, update this file too.*
