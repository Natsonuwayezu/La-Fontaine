# ECOLE LA FONTAINE — UNIVERSAL AGENT PROMPT
## Read this first. Every agent. Every session. No exceptions.

---

## WHAT THIS PROJECT IS

A complete **school management system** for **Ecole La Fontaine**, a school in **Rubavu, Rwanda**
(Nursery 1–3 + Primary 1–5, i.e. 8 classes total — NO Primary 6).
It is a **single-file SPA** (`index.html`) backed by **Supabase** (PostgreSQL via REST API).
No framework. No bundler. Vanilla JavaScript in `'use strict'` mode.
Currency: **RWF** (Rwandan Franc). UI language: English. Report cards: French (Nursery) / English (Primary).

**Live repo:**         https://github.com/Natsonuwayezu/La-Fontaine
**Working file:**      `index.html` in repo root (37,000+ lines)
**Supabase project:**  `ovmymtdrugdljnttiltd.supabase.co`  ← NEW project (not the old one)
**Admin login:**       username=admin  password=admin123

---

## THE FOUR REFERENCE FILES — READ THEM ALL BEFORE CODING

| File | Purpose |
|------|---------|
| `frontend.txt`   | 14,355-line ASCII wireframes for every screen |
| `backend.txt`    | All formulas, DB schema (26 tables), business rules, API contracts |
| `progress.txt`   | What is done, what is next, what is blocked |
| `AGENT_PROMPT.md`| This file — how to work on this project |

**Before writing a single line of code:**
1. `progress.txt` → find what's done and what's next
2. `backend.txt` → understand the formula or rule you're implementing
3. `frontend.txt` → understand what the UI should look like

---

## ROLES IN THE SYSTEM

| Role | Login | Access |
|------|-------|--------|
| **Admin** | password only (no username) | Full access to everything |
| **Accountant** | username + password | Finance modules only |
| **Teacher** | username + password | Academic modules only |
| **Class Teacher** | teacher where `classes.class_teacher_id = teacher.id` | + attendance, register, timetable, marks entry (all subjects) for their class |

Role CSS theming:
  Admin: `body.role-admin` → `--role-primary: #1a3a5c` (navy)
  Accountant: `body.role-accountant` → `--role-primary: #0d9488` (teal)
  Teacher: `body.role-teacher` → `--role-primary: #7c3aed` (purple)

---

## CRITICAL RULES — NEVER VIOLATE THESE

### 1. Pass mark — NEVER hardcode 50
```javascript
// ❌ WRONG
if (pct >= 50) passCount++;

// ✅ CORRECT
const passMark = parseFloat(state.schoolSettings?.pass_mark || 50);
if (pct >= passMark) passCount++;
```

### 2. Grading — NEVER use calculateGrade() directly
```javascript
// ❌ WRONG — ignores school's grading scale from DB
calculateGrade(pct)

// ✅ CORRECT — reads grading_scale table via state
getGrade(pct, state.gradingScale || null)
```

### 3. Marks validation — NEVER silently clamp
```javascript
// ❌ WRONG — user never knows their value was changed
const n = Math.min(max, Math.max(0, Number(val)));

// ✅ CORRECT — show inline popup on the input field
// Popup offers: auto-correct | manual fix | clear
// See updateMarkGrade() in index.html for the implementation
```

### 4. Save marks — ALWAYS gate on completeness
```javascript
// Block save if:
// A) Any validation popup is currently open
if (document.querySelectorAll('[id^="val-popup-"]').length > 0) BLOCK;
// B) Any student has empty input AND is not marked absent
if (emptyInputs.length > 0) BLOCK;
```

### 5. Notifications — ALWAYS dispatch on payment and marks
```javascript
// Admin records payment → notify accountant; Accountant → notify admin
// Teacher saves marks → notify admin
// Admin edits marks → notify original teacher
// Use: notifyAction(action, details, targetRoles)
```

### 6. window.* exports — ALL onclick= functions must be on window
```javascript
window.myFunction = myFunction;  // at bottom of script, or inline after definition
```

### 7. Completion rate — use the CORRECT formula (not students/total)
```javascript
let totalPossible = 0, totalFilled = 0;
for (const cls of teacherClasses) {
  const studentCount = activeStudents.filter(s => s.class_id === cls.id).length;
  const assessmentsInTerm = assessments.filter(a => a.class_id === cls.id && a.term_id === termId);
  for (const a of assessmentsInTerm) {
    totalPossible += studentCount;
    totalFilled += a.is_locked ? studentCount : marks.filter(m => m.assessment_id === a.id).length;
  }
}
const completionPct = totalPossible > 0 ? (totalFilled / totalPossible) * 100 : 0;
```

### 8. Charts — ASCII ONLY, never Chart.js
```javascript
function asciiBar(pct, width=20) {
  const f = Math.round((pct/100)*width);
  return '█'.repeat(f) + '░'.repeat(width-f);
}
// For vertical column charts: build row-by-row from top (height) down to 0
```

### 9. Subjects — post_midterm_only rule
```javascript
// Reading, Creative Arts, Sports (Primary) and Expression Orale,
// Développement Social (Nursery) have appears_only_post_midterm = TRUE
// → Teacher enters EX only; system auto-copies MG = EX
// → Display MG with ★ superscript in register
```

### 10. Class register denominator rule (CRITICAL for correct %)
```javascript
// WRONG: divide by (all subjects × max)
// CORRECT: divide by sum of max marks for subjects that HAVE assessments
const totalMaxPossible = subjects
  .filter(s => hasAssessmentThisTerm(s.id, classId, termId))
  .reduce((sum, s) => sum + s.mg_max + s.ex_max, 0);
```

---

## CODE ARCHITECTURE

### State Object
```javascript
state = {
  currentUser, classes, subjects, terms, academicYears,
  students, teachers, assessments, marks, feeCategories,
  feeAmounts, studentFees, payments, schoolSettings, gradingScale,
  families, notifications, reminders, timetableSlots, holidays,
  currentTerm, currentAcadYear,
  cache: { studentBalances: Map, classStats: Map, ranks: Map }
}
```

### Module Router
```javascript
loadModule(id) → renders to document.getElementById('dynamic-content')
// Access control checked here:
//   ACCOUNTANT_BLOCKED_MODULES Set
//   TEACHER_BLOCKED_MODULES Set
//   Class teacher: classes.class_teacher_id === user.id → unlocks extra modules
```

### API Layer
```javascript
get(table, params)          // GET with auto-pagination
getAll(table, filters)      // high-level, limit 50000
getById(table, id)          // single row
insert(table, data)         // POST
update(table, id, data)     // PATCH
delete_(table, id)          // DELETE
apiRequest(endpoint, method, body)  // raw wrapper
// Supabase URL: https://ovmymtdrugdljnttiltd.supabase.co/rest/v1/
```

### UI Patterns
```javascript
showToast(msg, type, duration)   // top-right toast (success/error/warning/info)
showModal(html)                  // inject into #modals-container
closeModal(id)
confirmDialog(msg)               // returns Promise<boolean>
navigateTo(moduleId)
esc(str)                         // HTML-escape — always use before innerHTML
formatCurrency(n)                // 'RWF 1,500'
fmtDate(str)                     // DD/MM/YYYY display
```

---

## HOW TO MAKE A CHANGE TO index.html

```bash
# 1. Clone or pull latest
git clone https://<PAT>@github.com/Natsonuwayezu/La-Fontaine.git /home/claude/La-Fontaine
# or: cd /home/claude/La-Fontaine && git pull

# 2. Edit using Python str_replace (avoids shell escaping issues for large blocks):
python3 - << 'EOF'
with open('/home/claude/La-Fontaine/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(OLD_TEXT, NEW_TEXT, 1)
with open('/home/claude/La-Fontaine/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
EOF

# 3. Verify the replacement
grep -n "your_new_text" /home/claude/La-Fontaine/index.html

# 4. Syntax check
node --check /home/claude/La-Fontaine/index.html 2>&1 | head -20

# 5. Mark progress and commit
cd /home/claude/La-Fontaine
git add index.html progress.txt
git commit -m "feat: description  TASKS: P1-08"
git push origin main
```

---

## COMMIT CONVENTIONS

```
TYPE: Short description

- Detail 1
- Detail 2
TASKS: P1-08, P2-05
```
Types: `FIX` | `FEAT` | `REFACTOR` | `DOCS` | `DB` | `STYLE` | `TEST`
Always list which progress.txt tasks were completed in the commit message.

---

## WHAT TO WORK ON NEXT (as of 2026-06-28)

Read `progress.txt` for the full list. Immediate priorities:

1. **P0-13** — Update Supabase URL in index.html (BLOCKING — nothing connects without this)
   - Find: `hejdppzparottbcnycjo.supabase.co`
   - Replace: `ovmymtdrugdljnttiltd.supabase.co`
   - Also update anon key (get from Supabase dashboard → Settings → API)

2. **P1-08** — Admin dashboard rebuild
   - Replace Chart.js canvas charts with ASCII bars
   - Fee collection by class, marks completion overview, recent activity log

3. **P2-05** — Marks database: edit → notify teacher + admin

4. **P5-01** — Attendance module (record daily per-student P/A/L/E)

5. **P4-06** — Notification center full page (tabs, mark read, deep-link)

---

## COMMON MISTAKES TO AVOID

| ❌ Mistake | ✅ Correct approach |
|-----------|---------------------|
| Using Chart.js | ASCII bar/column charts only |
| Hardcoding `>= 50` | `isPassing(pct)` using schoolSettings.pass_mark |
| Using `calculateGrade()` | `getGrade(pct, state.gradingScale)` |
| Silent `Math.min/max` clamping | Show inline popup (3 choices) |
| Saving marks without completeness check | Gate save — check all students |
| No notification after payment | Always call `notifyAction()` |
| Functions without `window.*` export | Add `window.fn = fn` |
| `innerHTML` with unsanitized data | Wrap in `esc()` |
| Creating new patch files | Put code in the correct module instead |
| Hardcoding class list or subject list | Always read from `state.classes` / `state.subjects` |
| Dividing by all subjects in register | Use denominator rule — assessed subjects only |
| Assuming school is in Kigali | School is in **Rubavu**, Rwanda |
| Assuming Primary goes to P6 | Progression ends at Primary 5 → GRADUATED |

---

## FILE LOCATIONS

| Path | Description |
|------|-------------|
| `/home/claude/La-Fontaine/index.html` | Working copy of the app |
| `/home/claude/La-Fontaine/frontend.txt` | All UI wireframes |
| `/home/claude/La-Fontaine/backend.txt` | All formulas and business rules |
| `/home/claude/La-Fontaine/progress.txt` | Build progress tracker |
| `/mnt/user-data/uploads/` | User-uploaded files (READ ONLY — copy before editing) |

---

## DEPLOYMENT

Any push to `main` branch is the live version.
Connect repo to Netlify (free tier) for a public URL — no build step needed.
`index.html` IS the app — zero configuration required.

---

*Last updated: 2026-06-28. Update this file when you make significant project changes.*
