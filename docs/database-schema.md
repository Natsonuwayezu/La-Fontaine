# Database Schema

See `backend.txt` Section 1 for the full schema with all columns, types, and constraints.

## Quick Reference — Table List

### Academic
- academic_years, terms, classes, subjects
- teacher_assignments, assessments, marks, grading_scale

### Students
- students, families

### Staff
- teachers (includes accountants — differentiated by role column)

### Finance
- fee_categories, fee_amounts, student_fees
- payments, payment_allocations, payment_reversals

### Communication
- notifications, announcements

### Attendance
- attendance

### System
- school_settings (key-value store), activity_logs

## Critical Column Notes
- classes.class_teacher_id → INTEGER, references teachers(id), NULLABLE
  This is the homeroom/class teacher assignment. Add with:
  ALTER TABLE classes ADD COLUMN class_teacher_id INTEGER REFERENCES teachers(id);

- school_settings.pass_mark → TEXT value, default '50'
  Read as: parseFloat(state.schoolSettings?.pass_mark || 50)
  NEVER hardcode >= 50 anywhere

- students.student_code → auto-generated format: ELF-YYYY-XXXX
- payments.receipt_number → auto-generated format: R-YYYY-XXXX
- families.family_code → auto-generated format: FAM-XXXX
