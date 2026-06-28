# Role-Based Permissions Guide

## Overview

ECOLE LA FONTAINE implements three distinct user roles: Admin, Accountant, and Teacher. Each role has specific permissions tailored to their responsibilities.

## Role Comparison

| Module | Admin | Accountant | Teacher |
|--------|-------|------------|---------|
| **Dashboard** | Full analytics | Finance summary | Class summary |
| **Students** | Full CRUD | View only | View assigned |
| **Student Details** | All tabs | Info, Family, History | Info, Academics, History |
| **Student Fees** | Full access | Full access | ❌ No access |
| **Student Promotion** | ✅ | ❌ | ❌ |
| **Enroll Student** | ✅ | ❌ | ❌ |
| **Bulk Import/Export** | ✅ | ❌ | ❌ |
| **Sibling Linking** | ✅ | ✅ | ❌ |
| **Student Archive** | ✅ | ❌ | ❌ |
| **Marks Entry** | All classes | ❌ | Assigned classes |
| **Marks Database** | All classes | ❌ | Assigned classes |
| **Class Register** | All classes | All classes | Assigned classes |
| **Statistics** | Full | View only | View only |
| **Assessments** | Full | ❌ | Assigned classes |
| **Timetable** | Edit all | View only | View own |
| **Report Cards** | All students | ❌ | Assigned classes |
| **Fee Structure** | Full | View/Apply | ❌ |
| **Payment History** | Full | Full | ❌ |
| **Record Payment** | Full | Full | ❌ |
| **Financial Reports** | Full | Full | ❌ |
| **Overdue Payments** | Full | Full | ❌ |
| **Fee Waivers** | Full | Full | ❌ |
| **Receipts** | Full | Full | ❌ |
| **Teachers** | Full | ❌ | View only |
| **Subjects** | Full | ❌ | View only |
| **Teacher Assignments** | Full | ❌ | ❌ |
| **Teacher Performance** | Full | ❌ | ❌ |
| **School Settings** | Full | ❌ | ❌ |
| **Academic Calendar** | Full | ❌ | ❌ |
| **Class Management** | Full | ❌ | ❌ |
| **Grading Scale** | Full | ❌ | ❌ |
| **User Management** | Full | ❌ | ❌ |
| **Backup & Restore** | Full | ❌ | ❌ |
| **System Logs** | Full | ❌ | ❌ |
| **Analytics** | Full | ❌ | ❌ |
| **API Settings** | Full | ❌ | ❌ |
| **Notifications** | Create/View | View | View |
| **Announcements** | Create/View | View | View |

## Admin Permissions

### Full System Access
- All modules accessible
- Create, read, update, delete all data
- System configuration
- User management
- Backup and restore

### Financial Controls
- Complete fee structure management
- Payment recording and reversal
- Credit and refund processing
- Financial report generation
- Audit log viewing

### Academic Controls
- All assessment management
- Marks entry for any class
- Report card generation for all
- Promotion processing

### Security Responsibilities
- User account creation/deactivation
- Password resets
- Permission management
- API configuration

## Accountant Permissions

### Financial Operations
- Fee structure viewing and application
- Payment recording
- Receipt generation
- Financial report viewing
- Overdue payment tracking
- Fee waiver management

### Student Information
- View student details (limited to Info, Family, History tabs)
- View student fee balances
- View sibling links

### Academic Information
- View class registers (read-only)
- View statistics (read-only)

### Restricted Actions
- Cannot edit student information
- Cannot enter marks
- Cannot modify fee structure
- Cannot create announcements

## Teacher Permissions

### Academic Operations
- Marks entry for assigned classes
- View marks database for assigned classes
- View class register for assigned classes
- Create assessments for assigned classes
- Generate report cards for assigned classes

### Student Information
- View student details (limited)
- View student list (assigned classes only)

### Timetable
- View own timetable
- View staff timetable

### Restricted Actions
- No financial access
- Cannot modify system settings
- Cannot manage users
- Cannot access fee structure
- Cannot access payment functions

## Permission Implementation

### Frontend Guards
```javascript
// Navigation items filtered by role
const NAV_CONFIG = {
    admin: [...allModules],
    accountant: [...financeModules, ...viewModules],
    teacher: [...academicModules, ...viewModules]
};

// Module load guard
if (user.role !== 'admin' && restrictedModules.includes(moduleId)) {
    showToast('Access denied', 'error');
    return;
}
```

### Action Guards
```javascript
// Finance function guard
if (state.currentUser?.role === 'teacher') {
    showToast('Teachers cannot access financial functions', 'error');
    return;
}

// Edit student guard (admin only)
if (state.currentUser?.role !== 'admin') {
    editButton.disabled = true;
}
```

## Best Practices

### For Administrators
1. Regularly review user accounts and deactivate inactive ones
2. Use strong passwords for admin accounts
3. Enable biometric login for additional security
4. Review audit logs weekly
5. Perform regular backups

### For Accountants
1. Verify student identity before recording payments
2. Document all manual adjustments with reasons
3. Review credit balances monthly
4. Issue receipts for all payments
5. Reconcile daily collections

### For Teachers
1. Enter marks promptly after assessments
2. Verify marks before saving
3. Lock assessments after final review
4. Report suspicious activity to admin
5. Use offline mode when connectivity is poor

## Security Recommendations

### Production Deployment
1. Enable HTTPS (required for biometric login)
2. Configure Supabase Row Level Security (RLS)
3. Set up session timeout (default 30 minutes)
4. Enable rate limiting for API endpoints
5. Regular security audits

### Password Policy
- Minimum 4 characters (configurable)
- Encourage strong passwords
- Force password change on first login
- No password reuse across roles

### Session Management
- Automatic logout after 30 minutes inactivity
- Warning banner at 25 minutes
- Single session per user (optional)
- Session invalidation on password change

## Role Change Workflow

### Promoting Teacher to Admin
1. Admin edits teacher account
2. Changes role to 'admin'
3. Saves changes
4. User must log out and log in

### Demoting Admin to Teacher
1. Admin edits the user account
2. Changes role to 'teacher'
3. Saves changes
4. User loses admin access immediately

### Adding New Roles (Custom)
1. Add role to NAV_CONFIG
2. Add role checks in relevant modules
3. Update database role column constraints
4. Test thoroughly before deployment

