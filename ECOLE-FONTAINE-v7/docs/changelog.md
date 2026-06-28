# Changelog

All notable changes to ECOLE LA FONTAINE School Management System.

## [7.0.0] - 2026-05-27

### Major Features
- **Complete Modular Architecture** - Split monolithic HTML into organized folder structure
- **Biometric Login** - WebAuthn fingerprint/face recognition support
- **PWA Installation** - Install as native app on mobile devices
- **Offline Marks Entry** - IndexedDB storage with auto-sync
- **Bulk Payment Recording** - Process multiple payments via Excel import
- **Timetable Auto-Generator** - Automatic schedule creation from teacher assignments
- **Conflict Detection** - Identify teacher, classroom, and overload conflicts
- **Rwanda Holidays Import** - One-click import of public holidays
- **3-Term Year Creation** - Auto-create terms when adding academic year

### Enhancements
- **Family Fee Summary** - View combined balances for all siblings
- **Credit Refund Processing** - Full refund workflow with audit trail
- **Bulk Assessment Lock** - Lock/unlock multiple assessments at once
- **Apply Fee to Class** - Add fee to all students in a class
- **Teacher Performance Dashboard** - Track teacher effectiveness
- **Class Performance Analytics** - Compare across terms and classes
- **Enhanced Receipt Design** - Professional layout with signature lines
- **Print Optimization** - A4-optimized print styles for all reports

### Security Improvements
- Idle timeout (25min warning, 30min logout)
- Session management enhancements
- Input sanitization across all forms
- XSS protection improvements

### Bug Fixes
- Fixed duplicate receipt number generation
- Resolved offline sync conflict issues
- Fixed rank calculation in report cards
- Corrected post-midterm only subject handling
- Fixed assessment locking state persistence

### Performance
- Lazy loading for chart components
- Optimized pagination for large tables
- Reduced initial bundle size
- Improved IndexedDB query performance

## [6.0.0] - 2026-05-15

### Features
- Full financial management system
- Credit balance tracking
- Fee waiver management
- Payment reversal capability
- Bulk student import/export
- Sibling linking with family discounts
- Student promotion wizard
- Class register with 6 formats
- Report card generation (Nursery/Primary)
- Statistics and analytics dashboard

### Improvements
- Enhanced mobile responsiveness
- Dark/light theme toggle
- Keyboard shortcuts (Alt+1, Alt+2, etc.)
- Back-to-top button
- Improved error handling

## [5.0.0] - 2026-04-01

### Initial Release
- Role-based authentication (Admin, Accountant, Teacher)
- Student enrollment and management
- Basic marks entry
- Fee structure management
- Payment recording
- Receipt generation
- Teacher assignments
- Timetable management
- Supabase backend integration

## Upgrade Guide

### From 6.0.0 to 7.0.0

1. **Backup your database**
   ```sql
   -- Export all tables before upgrading
   ```

2. **Update files**
   - Replace all existing files with new modular structure
   - Preserve `data/backups/` folder

3. **Run database migrations** (if any)
   - Check for new table schemas
   - Apply any column additions

4. **Clear browser cache**
   - Users should clear cache or perform hard refresh

5. **Test critical functions**
   - Login with all roles
   - Marks entry (online and offline)
   - Payment recording
   - Report card generation

### Rollback Procedure

If issues occur:
1. Restore previous version files
2. Restore database from pre-upgrade backup
3. Clear application cache
4. Notify users of temporary outage

## Future Roadmap

### Version 7.1 (Planned)
- Two-factor authentication
- Email notifications
- SMS payment alerts
- Advanced analytics dashboard

### Version 8.0 (Planned)
- Parent portal
- Student portal
- Mobile app (React Native)
- API rate limiting
- Webhook support

## Version Numbering

- **Major**: Breaking changes, architecture overhaul
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes, security updates

## Compatibility

| Version | Supabase | Browsers | Mobile |
|---------|----------|----------|--------|
| 7.0.0 | ^1.0.0 | Modern | PWA |
| 6.0.0 | ^1.0.0 | Modern | Responsive |
| 5.0.0 | ^1.0.0 | Modern | Responsive |

## Credits

Developed by ECOLE LA FONTAINE IT Department

---

**Last Updated**: 2026-05-27
