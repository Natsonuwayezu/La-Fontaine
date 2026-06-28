# Finance Workflow Guide

## Overview

The financial management system handles fee structures, payment collection, receipt generation, credit management, and financial reporting.

## Core Components

### Fee Categories
- Define different types of fees (Tuition, Activity, Transport, Meals, etc.)
- Set default amounts and reset frequencies (one_time, termly, monthly, annual)
- Configure active/inactive status

### Fee Assignments
- Assign fee categories to specific classes
- Override default amounts per class per academic year
- Apply fees to individual students or entire classes

### Payments
- Record payments with FIFO allocation to oldest unpaid fees
- Multiple payment methods (Cash, Mobile-Money, Bank Transfer, Cheque)
- Automatic receipt generation with unique receipt numbers
- Partial payment handling with credit creation for overpayments

### Credit Management
- Overpayments automatically converted to credit
- Credits can be applied to future fees
- Credit refund processing with proper audit trail

## Workflow Diagrams

### Fee Setup Workflow
```
1. Create Fee Category
   ↓
2. Set Default Amount & Frequency
   ↓
3. (Optional) Create Class Overrides
   ↓
4. Apply to Class/Students
   ↓
5. Student Fees Created
```

### Payment Collection Workflow
```
1. Select Student
   ↓
2. View Outstanding Fees
   ↓
3. Select Fees to Pay (or Pay All)
   ↓
4. Enter Amount & Method
   ↓
5. System Allocates Payment (FIFO)
   ↓
6. Receipt Generated
   ↓
7. (If Overpayment) Credit Created
```

### Credit Refund Workflow
```
1. Student Has Credit Balance
   ↓
2. Process Refund Request
   ↓
3. Enter Refund Amount & Method
   ↓
4. System Creates Refund Record
   ↓
5. Credit Balance Reduced
   ↓
6. Parent Receives Refund
```

## Fee Reset Automation

### Monthly Reset (1st of each month)
- Automatically applies monthly fees
- Checks for existing fees to avoid duplicates
- Applies available credits first

### Termly Reset (Term end date + 1 day)
- Applies termly fees
- Archives previous term fees
- Updates balances

### Annual Reset (Academic year end + 1 day)
- Applies annual fees
- Archives previous year fees
- Prompts for carry-over of unpaid fees

## Key Features

### Bulk Payments
- Upload Excel with student codes and amounts
- Process multiple payments at once
- Generate receipts for all

### Manual Adjustments
- Add fees (increase balance)
- Add payments (decrease balance)
- Add credits (overpayment/refund)
- Waive fees (remove from balance)

### Fee Waivers
- Apply discounts/scholarships
- Specify reason for waiver
- Track waiver history
- Remove waiver (restores balance)

### Family Discounts
- Link students to families
- Set family discount amount
- Automatically apply to all family members
- Discount applies to selected fee categories

## Financial Reports

### Collection Report
- Date range filtering
- Payment method breakdown
- Total collected by period

### Outstanding Report
- Class filtering
- Minimum balance threshold
- Sort by balance amount

### Waivers Report
- Date range filtering
- Total waived amount
- Student and category breakdown

### Credit Report
- Students with credit balances
- Available credit amount
- Refundable amount

### Class Summary Report
- Term filtering
- Expected vs collected per class
- Collection rate by class

## Audit Trail

Every financial transaction is logged:

| Action | Logged Data |
|--------|-------------|
| Payment Recorded | Amount, student, method, receipt #, user |
| Fee Assignment | Category, amount, term, assigned by |
| Fee Waiver | Amount, reason, approved by |
| Credit Addition | Amount, reason, added by |
| Refund Processed | Amount, method, reference, processed by |
| Manual Adjustment | Type, amount, reason, adjusted by |

## Reconciliation Process

### Daily Reconciliation
1. Verify total payments recorded matches cash collected
2. Review receipt numbers for gaps
3. Check for unallocated payments

### Monthly Reconciliation
1. Generate monthly collection report
2. Compare with bank deposits
3. Review outstanding balances
4. Verify credit balances

### Term-End Reconciliation
1. Process fee resets
2. Archive completed term data
3. Identify unpaid fees for carry-over

## Best Practices

### Fee Setup
- Use descriptive category names
- Set realistic due dates
- Enable auto-reset for recurring fees
- Review fee amounts annually

### Payment Handling
- Always issue receipts
- Record payment method accurately
- Add notes for unusual transactions
- Verify student identity before recording

### Credit Management
- Issue refunds promptly for overpayments
- Document credit usage reason
- Review credit balances monthly
- Expire old credits after 12 months

### Security
- Only authorized staff can record payments
- Admin approval required for waivers over threshold
- All adjustments require reason documentation
- Regular audit log review

## Troubleshooting

### Payment Not Allocating Correctly
1. Check if fees are locked or waived
2. Verify payment date is valid
3. Check for existing credit balance
4. Review fee due dates

### Credit Not Applying
1. Verify credit is for same term/year
2. Check if credit is expired
3. Ensure fee category matches
4. Review credit amount

### Duplicate Receipt Numbers
1. System generates unique numbers automatically
2. If collision occurs, retry with different number
3. Manual receipts should follow naming convention

### Fee Reset Not Running
1. Verify auto-reset is enabled in settings
2. Check term/end dates are set correctly
3. Review server timezone settings
4. Manual reset available in Academic Calendar

## Integration Points

### Supabase Tables
- `fee_categories` - Fee category definitions
- `fee_amounts` - Class-specific overrides
- `student_fees` - Individual student fee assignments
- `payments` - Payment records
- `payment_allocations` - Payment to fee allocations

### Related Modules
- Student Management (fee assignment)
- Academic Calendar (fee reset triggers)
- Reporting (financial reports)
- User Management (permission control)
```