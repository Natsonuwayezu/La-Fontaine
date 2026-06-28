# Troubleshooting Guide

## Common Issues and Solutions

### Login Issues

#### Cannot Log In
**Symptoms:** Invalid credentials error even with correct password

**Solutions:**
1. Verify caps lock is off
2. Check if account is active (admin can check)
3. Reset password via admin
4. Clear browser cache and cookies
5. Try incognito/private mode

#### Session Expires Too Quickly
**Symptoms:** Logged out before 30 minutes

**Solutions:**
1. Check system time is correct
2. Adjust session timeout in Settings → School Settings
3. Clear localStorage and re-login
4. Check for browser extension interference

### Data Loading Issues

#### Data Not Loading
**Symptoms:** Infinite spinner, no data appears

**Solutions:**
1. Check internet connection
2. Verify API settings (Settings → API Settings → Test Connection)
3. Check browser console for errors (F12)
4. Clear browser cache
5. Check Supabase status page

#### Missing Data
**Symptoms:** Some records not appearing

**Solutions:**
1. Refresh the page
2. Clear filters (if any)
3. Check if data exists in database
4. Verify table permissions
5. Run `checkDataCounts()` in console

### Marks Entry Issues

#### Marks Not Saving
**Symptoms:** Save button doesn't work or throws error

**Solutions:**
1. Check if assessment is locked
2. Verify marks are within max limit
3. Check internet connection (online mode)
4. Check offline storage space
5. Try saving fewer marks at once

#### Offline Marks Not Syncing
**Symptoms:** Offline badge shows pending, never clears

**Solutions:**
1. Check internet connection restored
2. Manually click offline badge to sync
3. Check IndexedDB storage limit
4. Clear IndexedDB and re-enter marks
5. Check console for sync errors

#### Import Excel Fails
**Symptoms:** Error reading file or no data imported

**Solutions:**
1. Use the template format
2. Check column names match exactly
3. Remove empty rows
4. Save as .xlsx format
5. Limit file size (max 10MB)

### Finance Issues

#### Payment Not Applying
**Symptoms:** Payment recorded but balance unchanged

**Solutions:**
1. Check if fee is waived
2. Verify payment allocation
3. Check payment date vs fee due date
4. Refresh student balances
5. Check payment reversal status

#### Receipt Not Printing
**Symptoms:** Print button does nothing

**Solutions:**
1. Allow pop-ups for this site
2. Check browser print settings
3. Try PDF export instead
4. Clear browser cache
5. Use different browser

#### Credit Not Showing
**Symptoms:** Credit created but not visible

**Solutions:**
1. Refresh student fee page
2. Check credit tab in student fees
3. Verify credit is for correct term
4. Check if credit was used
5. Run balance recalculation

### Report Card Issues

#### Report Card Generation Fails
**Symptoms:** Error when generating report

**Solutions:**
1. Verify all marks entered
2. Check assessments are not locked
3. Ensure term dates are set
4. Check student has class assigned
5. Verify grading scale exists

#### Incorrect Grades
**Symptoms:** Grades don't match percentage

**Solutions:**
1. Check grading scale settings
2. Verify grade boundaries
3. Recalculate percentages
4. Check for custom grade overrides
5. Reset grading scale to default

#### Rank Calculation Wrong
**Symptoms:** Ranks don't match performance

**Solutions:**
1. Verify all students have marks
2. Check for missing assessments
3. Recalculate class register
4. Check for duplicate entries
5. Run debug function

### Performance Issues

#### Slow Loading
**Symptoms:** Pages take long to load

**Solutions:**
1. Clear browser cache
2. Reduce displayed rows (filters)
3. Check internet speed
4. Disable unused browser extensions
5. Use Chrome/Edge for better performance

#### Memory Issues
**Symptoms:** Browser slows down, crashes

**Solutions:**
1. Close unused tabs
2. Clear browser cache
3. Reduce data displayed per page
4. Restart browser
5. Update browser to latest version

### Mobile Issues

#### PWA Won't Install
**Symptoms:** Install button missing or doesn't work

**Solutions:**
1. Use HTTPS (required for PWA)
2. Check service worker registration
3. Clear browser data and retry
4. Use Chrome on Android or Safari on iOS
5. Check manifest.json is accessible

#### Touch Gestures Not Working
**Symptoms:** Swipe/pull to refresh not responding

**Solutions:**
1. Check if mobile features are initialized
2. Refresh the page
3. Clear browser cache
4. Check for conflicting touch events
5. Use different browser

### Database Issues

#### Connection Failed
**Symptoms:** API connection test fails

**Solutions:**
1. Verify Supabase URL is correct
2. Check anon key is valid
3. Check Supabase project is active
4. Verify network allows Supabase access
5. Check CORS settings

#### Table Not Found
**Symptoms:** Error about missing table

**Solutions:**
1. Run database schema from `database-schema.md`
2. Verify table name spelling
3. Check Supabase SQL editor for errors
4. Re-run schema creation
5. Contact support

### Biometric Login Issues

#### Biometric Setup Fails
**Symptoms:** Error during registration

**Solutions:**
1. Ensure HTTPS is enabled
2. Check device has fingerprint/face recognition
3. Update browser to latest version
4. Check WebAuthn support (caniuse.com)
5. Try different browser

#### Biometric Login Not Working
**Symptoms:** Authentication fails

**Solutions:**
1. Re-register biometric credential
2. Clear saved credentials in browser
3. Check if device biometrics are working
4. Use password as fallback
5. Update browser

## Debugging Tools

### Browser Console Commands

```javascript
// Check data counts
checkDataCounts();

// Debug data loading
debugDataLoading();

// Check offline pending sync
getUnsyncedOfflineMarks().then(r => console.log(r));

// Force sync offline marks
syncOfflineMarks();

// Check state data
console.log(state);

// Check current user
console.log(getCurrentUser());

// Check API settings
console.log({ url: SUPABASE_URL, key: SUPABASE_KEY });
```

### Supabase Studio Queries

```sql
-- Check table row counts
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM teachers;
SELECT COUNT(*) FROM marks;

-- Check for orphaned records
SELECT * FROM marks WHERE assessment_id NOT IN (SELECT id FROM assessments);

-- Check duplicate receipt numbers
SELECT receipt_number, COUNT(*) FROM payments GROUP BY receipt_number HAVING COUNT(*) > 1;

-- Check unpaid fees
SELECT student_id, SUM(amount - paid_amount) as balance 
FROM student_fees 
WHERE is_paid = false AND is_waived = false 
GROUP BY student_id 
HAVING SUM(amount - paid_amount) > 0;
```

### Log Analysis

```javascript
// View recent activity logs
getAll('activity_logs', { order: 'created_at.desc', limit: 50 }).then(logs => console.table(logs));

// Filter logs by user
getAll('activity_logs', { user_id: 1 }).then(logs => console.table(logs));

// Filter by action
getAll('activity_logs', { action: 'insert' }).then(logs => console.table(logs));
```

## Error Messages Reference

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Network Error" | No internet | Check connection |
| "HTTP 401" | Invalid API key | Check API settings |
| "HTTP 404" | URL not found | Verify Supabase URL |
| "Duplicate key" | Receipt # exists | System retries automatically |
| "Table not found" | Missing schema | Run database schema |
| "Permission denied" | RLS blocking | Check RLS policies |
| "Offline mode active" | No connection | Marks saved locally |
| "Session expired" | Inactivity | Re-login |

## Support Resources

### Self-Help
1. Check this troubleshooting guide
2. Review browser console (F12)
3. Check Supabase logs
4. Review application logs (Settings → System Logs)

### Contact Support
- System Administrator
- IT Department
- Supabase Support (for database issues)

### Diagnostic Information to Collect
1. Browser and version
2. Device type (desktop/mobile)
3. Steps to reproduce
4. Error message (screenshot)
5. Console logs
6. Network tab screenshots
7. Supabase project status

