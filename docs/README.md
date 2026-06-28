# ECOLE LA FONTAINE - School Management System

## Overview
A complete, production-ready school management system with offline support, biometric login, and comprehensive academic and financial management.

## Features

### Core Modules
- **Role-Based Access** (Admin, Accountant, Teacher)
- **Student Management** - Enrollment, promotion, archive, sibling linking
- **Academic Management** - Marks entry, assessments, class register, report cards
- **Financial Management** - Fee structure, payments, receipts, waivers, credit management
- **Staff Management** - Teachers, subjects, assignments, timetable
- **System Settings** - School info, academic calendar, user management, backup/restore

### Technical Features
- Offline-first with IndexedDB sync
- PWA installable
- Biometric login (WebAuthn)
- Real-time Supabase backend
- Excel import/export
- PDF report generation

## Quick Start

### Prerequisites
- Supabase account (free tier works)
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

1. **Clone or download** the project files
2. **Configure Supabase**:
   - Create a Supabase project
   - Run the database schema (see `docs/database-schema.md`)
   - Get your project URL and anon key

3. **Configure API Settings**:
   - Log in as admin (default password: admin123)
   - Go to Settings → API Settings
   - Enter your Supabase URL and anon key
   - Click Save

4. **Set up initial data**:
   - Add academic years and terms
   - Create classes (Nursery 1-3, Primary 1-6)
   - Add subjects with MG/EX max marks
   - Enroll students

### Default Admin Login
- **Username**: admin
- **Password**: admin123 (change after first login)

## Folder Structure
ecole-la-fontaine/
├── index.html # Main application entry
├── css/ # Stylesheets
├── js/ # JavaScript modules
│ ├── core/ # Core functionality
│ ├── modules/ # Feature modules
│ ├── ui/ # UI components
│ ├── mobile/ # Mobile optimizations
│ ├── integrations/ # Third-party integrations
│ └── workers/ # Web workers
├── html/ # HTML templates
├── pwa/ # PWA files
├── data/ # Data storage
├── docs/ # Documentation
└── tests/ # Test files

## Documentation Index

| Document | Description |
|----------|-------------|
| [setup-guide.md](setup-guide.md) | Detailed setup instructions |
| [database-schema.md](database-schema.md) | Supabase database schema |
| [finance-workflow.md](finance-workflow.md) | Financial management workflows |
| [academics-workflow.md](academics-workflow.md) | Academic workflows |
| [permissions.md](permissions.md) | Role-based permissions |
| [deployment.md](deployment.md) | Production deployment guide |
| [architecture.md](architecture.md) | System architecture |
| [troubleshooting.md](troubleshooting.md) | Common issues and solutions |
| [changelog.md](changelog.md) | Version history |

## Support

For issues or questions, please refer to the documentation or contact your system administrator.

---

**Version**: 7.0.0
**Last Updated**: 2026