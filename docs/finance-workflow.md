# Finance Workflow

See `backend.txt` Section 3 for all formulas and business rules.

## Payment Flow
1. Select student → see outstanding balance
2. Enter amount, method, reference
3. Review screen (confirm before saving)
4. FIFO allocation: oldest unpaid fees get paid first
5. Overpayment → credit record created
6. Receipt generated (R-YYYY-XXXX)
7. Notification dispatched:
   - Admin records → notify accountant
   - Accountant records → notify admin

## Fee Generation (Automatic)
- Monthly fees: 1st of each month
- Termly fees: day after term start
- Annual fees: day after academic year start
- One-time fees: manual only
- Sibling discount applied if family.discount_pct > 0

## Overdue Classification
- Critical  > 44 days: 🔴
- High      30–44 days: 🟠
- Medium    14–29 days: 🟡
- Recent    7–13 days:  🟢

## Collection Rate Formula
expected  = sum(student_fees.amount) for active students this term
collected = sum(payments) allocated to those fees
rate = expected > 0 ? (collected / expected) × 100 : 0
