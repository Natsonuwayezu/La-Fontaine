# Academics Workflow Guide

## Overview

The academic management system handles class registers, marks entry, assessments, report cards, and academic reporting.

## Core Components

### Class Register
- Displays all subjects and marks for a class
- Six formats: Nursery Pre/Post/Annual, Primary Pre/Post/Annual
- Automatic calculation of totals, percentages, grades, and ranks
- Excel export capability

### Marks Entry
- Offline-first design (works without internet)
- Assessment creation with type, name, max marks
- Real-time percentage and grade calculation
- Import/Export Excel functionality

### Assessments
- Create quizzes, assignments, mid-terms, exams
- Set due dates and max marks
- Lock assessments to prevent further edits
- Bulk lock/unlock for term end

### Report Cards
- Individual student report generation
- Multiple formats by level and phase
- Automatic rank calculation
- Print and PDF export
- Batch generation for entire class

## Workflow Diagrams

### Assessment Lifecycle
```
1. Create Assessment
   ↓
2. Set Due Date & Max Marks
   ↓
3. Enter Marks (Online or Offline)
   ↓
4. Review & Edit
   ↓
5. Lock Assessment (Admin Only)
   ↓
6. Marks Finalized
```

### Marks Entry Workflow (Online)
```
1. Select Class & Subject
   ↓
2. Select/Add Assessment
   ↓
3. Load Students
   ↓
4. Enter Marks
   ↓
5. Real-time Validation
   ↓
6. Save to Database
```

### Marks Entry Workflow (Offline)
```
1. Internet Disconnected
   ↓
2. Enter Marks as Usual
   ↓
3. Marks Saved to IndexedDB
   ↓
4. Offline Badge Shows Pending
   ↓
5. Internet Restored
   ↓
6. Auto-Sync to Database
   ↓
7. Confirmation Toast
```

### Term Progression
```
Pre-Midterm Phase
   ↓
   • Only Continuous Assessment (MG)
   • No Exam marks entered
   • Phase indicator shows "PRE"
   ↓
Midterm Date Passes
   ↓
Post-Midterm Phase
   ↓
   • Both MG and EX allowed
   • Exam marks can be entered
   • Phase indicator shows "POST"
   ↓
Term End
   ↓
   • Assessments auto-lock
   • Report cards generated
   • Promotion processed
```

## Grading System

### Grade Boundaries (Configurable)

| Grade | Percentage | Description |
|-------|------------|-------------|
| A+ | 90-100% | Excellent |
| A | 80-89% | Very Good |
| B | 70-79% | Good |
| C | 60-69% | Average |
| D | 50-59% | Below Average |
| F | 0-49% | Fail |

### Calculation Formulas

#### Pre-Midterm (Primary)
```
Score = (Total Raw Score / Total Max Marks) × 100
```

#### Pre-Midterm (Nursery)
```
Score = Average of all scores (max 50)
```

#### Post-Midterm
```
MG Score = (Avg Raw MG / Avg Max MG) × MG_Max
EX Score = (Avg Raw EX / Avg Max EX) × EX_Max
Total = MG + EX
Percentage = (Total / (MG_Max + EX_Max)) × 100
```

## Class Register Formats

### Primary Pre-Midterm
- Columns: SCORE, GRADE per subject
- Total displayed as percentage
- Includes class average

### Primary Post-Midterm
- Columns: MG, EX, TOT per subject
- Totals: TOT_MG, TOT_EX, G_TOT
- Includes class average

### Nursery Pre-Midterm (French)
- Columns: NOTE, COTE per subject
- French terminology
- Maternelle level display

### Nursery Post-Midterm (French)
- Columns: MG, EX, TOTAL
- French terminology
- Includes rank in French

### Annual Views (Both Levels)
- Combines all terms
- Shows yearly totals
- Promotion message based on performance

## Report Card Features

### Information Displayed
- Student personal information
- Class and grade level
- Subject-wise scores and grades
- Term totals and averages
- Overall percentage and grade
- Class rank
- Promotion status (annual reports)

### Footer Information
- Parent/guardian signature line
- Cashier/teacher signature
- School stamp area
- Generation date
- Head teacher name

### Language Support
- Primary level: English
- Nursery level: French
- Mix of English/French for bilingual schools

## Assessment Types

| Type | Phase | Description |
|------|-------|-------------|
| Quiz | Pre/Post | Short assessments, multiple per term |
| Assignment | Pre/Post | Take-home work |
| Mid-term | Pre/Post (allowed in Pre) | Mid-term examination |
| Exam | Post only | End of term exam |
| Final Exam | Post only | Final comprehensive exam |

## Promotion Rules

### Automatic Promotion Mapping
```
NURSERY 1 → NURSERY 2
NURSERY 2 → NURSERY 3
NURSERY 3 → PRIMARY 1
PRIMARY 1 → PRIMARY 2
PRIMARY 2 → PRIMARY 3
PRIMARY 3 → PRIMARY 4
PRIMARY 4 → PRIMARY 5
PRIMARY 5 → PRIMARY 6
PRIMARY 6 → GRADUATED
```

### Promotion Criteria
- Annual average ≥ 50% = Promoted
- Annual average < 50% = Repeat class
- Admin can override individual student promotion

## Statistics & Analytics

### Performance Metrics
- Class averages by term
- Subject performance trends
- Grade distribution
- Pass rates
- Top performers

### Charts Available
- Term performance comparison (line chart)
- Grade distribution (pie/doughnut)
- Subject analysis (bar chart)
- Annual comparison (bar chart)

## Best Practices

### Assessment Planning
- Schedule assessments evenly throughout term
- Set realistic due dates
- Communicate schedule to students
- Create assessments before marks entry

### Marks Entry
- Enter marks promptly after assessment
- Use Excel import for large classes
- Verify marks before saving
- Lock assessments after final review

### Report Cards
- Generate after all marks entered
- Review before distribution
- Print on quality paper
- Keep digital copies

### Data Integrity
- Regular backups before term end
- Verify calculations match manual checks
- Review rank calculations
- Audit marks changes

## Troubleshooting

### Marks Not Saving
- Check internet connection (online mode)
- Verify assessment is not locked
- Check max marks limit
- Review browser console for errors

### Offline Sync Issues
- Check IndexedDB storage limit
- Clear browser cache
- Manually trigger sync via offline badge
- Check pending sync count

### Report Card Generation Fails
- Verify all marks entered
- Check assessment locking status
- Ensure term dates are set
- Review student class assignment

### Rank Calculation Discrepancies
- Verify all students have marks
- Check for missing assessments
- Review grade boundaries
- Recalculate with debug function

## Integration Points

### Supabase Tables
- `assessments` - Assessment definitions
- `marks` - Student marks
- `terms` - Term definitions
- `grading_scale` - Grade boundaries

### Related Modules
- Student Management (student data)
- Class Management (class definitions)
- Subject Management (subject definitions)
- Settings (grading scale, terms)

