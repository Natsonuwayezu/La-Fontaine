# Academics Workflow

See `backend.txt` Section 2 for all formulas.

## Mark Entry Flow
1. Select class, subject, assessment type, name, max marks, date
2. Per-student score input with live % and grade badge
3. Invalid input → inline popup (no silent correction):
   - Above max → offer auto-correct to max | manual fix | clear
   - Below zero → offer auto-correct to 0 | manual fix | clear
   - Non-numeric → offer clear only
4. All students must have a score OR be marked absent before save is allowed
5. Summary screen shows distribution, avg, pass rate → Confirm & Save
6. After save → notification dispatched to admin

## Calculation Formulas (see backend.txt §2 for full details)
- MG (continuous assessment): avgPct / 100 × mg_max
- EX (exam): avgPct / 100 × ex_max
- Subject total: MG + EX
- Pass mark: state.schoolSettings?.pass_mark || 50 (NEVER hardcode 50)
- Grade: getGrade(pct, state.gradingScale) (NEVER use calculateGrade directly)

## Completion Rate Formula (Dashboard)
totalPossible = students × assessments per class (current term)
totalFilled   = marks entered (locked assessments count as fully filled)
completionPct = totalFilled / totalPossible × 100

## Report Cards
- Decision banner: see backend.txt §7.1 for exact English + French text
- QR code: embedded on every report card, contains full academic data
- Rank: "X of Y" (Olympic ranking — ties share rank)
