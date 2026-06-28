# Setup Guide

## Prerequisites

1. **Supabase Account** - Sign up at [supabase.com](https://supabase.com)
2. **Modern Web Browser** - Chrome, Firefox, Edge, or Safari
3. **Basic knowledge** of database tables (for schema setup)

## Step 1: Supabase Setup

### Create a New Project
1. Log into Supabase
2. Click "New Project"
3. Enter project name: `ecole-la-fontaine`
4. Set database password (save it securely)
5. Choose region closest to your location
6. Click "Create new project"

### Run Database Schema
1. Navigate to the "SQL Editor" in Supabase dashboard
2. Copy the schema from `docs/database-schema.md`
3. Paste into SQL editor
4. Click "Run" to create all tables

### Get API Credentials
1. Go to Project Settings → API
2. Copy the **Project URL** (e.g., `https://xxxxx.supabase.co`)
3. Copy the **anon public key** (starts with `eyJ...`)

## Step 2: Application Setup

### Option A: Local File System
1. Extract all project files to a folder
2. Open `index.html` in your browser
3. Go to Settings → API Settings
4. Enter your Supabase URL and anon key
5. Click "Save" (page will reload)

### Option B: Web Server (Recommended)
1. Upload files to your web server
2. Ensure proper MIME types for JS/CSS files
3. Configure HTTPS (required for biometric login)
4. Access via `https://yourdomain.com`

### Option C: PWA Installation
1. On mobile device, open the website
2. Click "Install App" button in top bar
3. Add to home screen when prompted

## Step 3: Initial Configuration

### First Login
- **Username**: admin
- **Password**: admin123

### Change Admin Password
1. Click on user avatar → "Change Password"
2. Enter current password: `admin123`
3. Enter new password (min 4 characters)
4. Confirm and save

### Configure School Settings
1. Go to Settings → School Settings
2. Enter your school name, motto, location
3. Upload school logo (optional)
4. Configure report footer text
5. Click "Save All"

### Set Up Academic Year
1. Go to Settings → Academic Calendar
2. Click "Add Academic Year"
3. Enter year name (e.g., "2025-2026")
4. Set start and end dates
5. Click "Create Year + 3 Terms"

### Create Classes
1. Go to Settings → Class Management
2. Click "Add Class"
3. Add classes in order:
   - NURSERY 1, NURSERY 2, NURSERY 3
   - PRIMARY 1, PRIMARY 2, PRIMARY 3, PRIMARY 4, PRIMARY 5, PRIMARY 6
4. Set capacity for each class (default 40)

### Create Subjects
1. Go to Staff → Subjects
2. Switch between Nursery and Primary tabs
3. Click "Add Subject" for each subject
4. Set MG Max and EX Max marks

### Create Teacher Accounts
1. Go to Staff → Teachers List
2. Click "Add Teacher"
3. Fill name, email, username, password
4. Assign role (teacher/accountant/admin)
5. Save and repeat for all teachers

### Assign Teachers to Classes
1. Go to Staff → Teacher Assignments
2. Click "Assign" for each teacher
3. Select class and subject
4. Or use matrix view to bulk assign

### Enroll Students
1. Go to Students → Enroll Student
2. Fill student details
3. Select class
4. Review applicable fees
5. Check/uncheck fees to apply
6. Click "Enroll Student"

## Step 4: Financial Setup

### Create Fee Categories
1. Go to Finance → Fee Structure
2. Click "Add Category"
3. Enter category name (e.g., "Tuition Fees")
4. Set default amount
5. Choose reset frequency (one_time/termly/monthly/annual)
6. Save

### Set Class-Specific Fee Amounts
1. In Fee Structure page
2. Select academic year
3. Click "Add Amount" for each class
4. Select class, fee category, amount
5. Save

## Step 5: Academic Setup

### Create Assessments
1. Go to Academics → Assessments
2. Click "Create New Assessment"
3. Select class, subject, type
4. Set name and max marks
5. Save

### Enter Marks
1. Go to Academics → Marks Entry
2. Select class and subject
3. Select assessment type
4. Enter assessment name
5. Click "Load Students"
6. Enter marks for each student
7. Click "Save"

## Verification Checklist

After setup, verify:

- [ ] Admin can log in
- [ ] Teacher can log in with assigned credentials
- [ ] Accountant can log in
- [ ] Students can be enrolled
- [ ] Fees can be recorded
- [ ] Marks can be entered
- [ ] Report cards can be generated
- [ ] Receipts can be printed
- [ ] PWA install button appears on mobile
- [ ] Offline mode works (disconnect internet, enter marks)

## Troubleshooting

### "Connection failed" error
- Check API settings (URL and key)
- Verify Supabase project is active
- Check internet connection

### "Table not found" error
- Database schema not run
- Run SQL script from `database-schema.md`

### Login fails
- Default admin password: admin123
- For teachers, ensure account is active
- Check username and password

### Biometric login not working
- Requires HTTPS
- Browser must support WebAuthn
- Device must have fingerprint/face recognition

### Offline sync not working
- Check browser storage permissions
- Clear IndexedDB and reload
- Ensure online after entering marks

## Next Steps

1. Read [permissions.md](permissions.md) for role-based access
2. Review [finance-workflow.md](finance-workflow.md) for financial processes
3. Check [academics-workflow.md](academics-workflow.md) for academic cycles
4. Configure [deployment.md](deployment.md) for production