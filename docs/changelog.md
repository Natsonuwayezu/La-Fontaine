# Changelog

## 2026-06-28 — Session 3 (Foundation + Dashboard Rebuilds)

### Fixed
- `calculateGrade()` now delegates to `getGrade()` using school grading scale
- All hardcoded `>= 50` pass mark comparisons replaced with `state.schoolSettings?.pass_mark || 50`
- Decision banner full text: "TO SIT FOR SECOND SITTING EXAMINATIONS" (EN) + D'EXAMEN (FR)
- `toggleSidebar` overlay: `.active` class now added via `requestAnimationFrame` (mobile fix)
- `closeSidebarMobile`: overlay fades via `transitionend` before DOM removal
- Windows CRLF line endings converted to LF

### Added — Teacher Dashboard
- Corrected completion rate formula: marks_entered / (students × assessments)
- ASCII horizontal bars: per-class completion, per-assessment completion
- ASCII vertical column chart: class average scores
- Next 3 periods widget (reads from timetable state)
- Students without marks section (cards with missing assessment names)
- Attendance reminder banner (for class teachers)
- Live notifications feed with unread dots

### Added — Accountant Dashboard
- Today's activity banner (payments count + RWF, admin payments, new overdue)
- ASCII horizontal bars: fee collection by class with colour coding
- Live notifications feed with payment deep-links
- Overdue severity breakdown (Critical/High/Medium/Recent ASCII bars)
- Monthly trend ASCII vertical chart (last 6 months)
- Recent payments table with "Recorded By" column (Admin vs You, blue border)
- Quick actions grid

### Added — Marks Entry
- Inline popup validation on score inputs (replaces silent Math.min/max clamping)
  - Above max: offer auto-correct | manual fix | clear
  - Below zero: offer auto-correct | manual fix | clear  
  - Non-numeric: offer clear only
- Save gate: blocks if any popup open OR any student missing score
- Save dispatches notification to admin (notifyAction)

### Added — Teacher Assignments
- Tab 1: Subject assignments table with load indicator
- Tab 2: Class teacher assignments per class (access badges, assign/change)
- Tab 3: Overview matrix (teacher × class, subject codes + 🏠 homeroom)
- Edit modal: subject grid with row/col select-all checkboxes
- Class teacher dropdown in edit modal with access preview
- `saveEditAssignments()`: updates classes.class_teacher_id + teacher_assignments
- Access control: class teacher unlocks attendance, register, timetable, all marks

### Added — Documentation
- frontend.txt: 14,355-line ASCII wireframes for every module
- backend.txt: DB schema, all formulas, business rules, API contracts
- progress.txt: P0–P9 phase tracker with 40+ tasks
- AGENT_PROMPT.md: Universal agent guide
- docs/: architecture, schema, finance workflow, academics workflow, permissions, setup

## 2026-06-27 — Session 2 (Major Rebuilds — previous chat)
- Teacher dashboard preview artifact (React JSX)
- Accountant dashboard preview artifact (React JSX)
- Teacher assignments preview artifact (React JSX)
- Blueprint.txt with all three area specifications

## 2026-06-26 — Session 1 (Analysis)
- Full analysis of index_1.html (v5.0, 18,678 lines)
- Full analysis of index.html (v9.0, 37,019 lines)
- Identified unlinked modules, completion rate formula bug
- Blueprint document for all planned changes
