# System Architecture

## Overview

ECOLE LA FONTAINE School Management System is a single-page application (SPA) built with vanilla JavaScript, HTML5, and CSS3. It uses Supabase as the backend database and authentication provider.

## Architecture Diagram
┌─────────────────────────────────────────────────────────────┐
│ Client Browser │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│ │ HTML5 │ │ CSS3 │ │ JavaScript (ES6+) │ │
│ │ Shell │ │ Styles │ │ Application Core │ │
│ └─────────────┘ └─────────────┘ └──────────┬──────────┘ │
│ │ │
│ ┌──────────────────────────────────────────────┼──────────┐ │
│ │ Modules │ │ │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │ │ │
│ │ │Students│ │Finance │ │Academy │ │Reports │ │ │ │
│ │ └────────┘ └────────┘ └────────┘ └────────┘ │ │ │
│ └──────────────────────────────────────────────┼──────────┘ │
│ │ │
│ ┌──────────────────────────────────────────────┼──────────┐ │
│ │ Core │ │ │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │ │ │
│ │ │ Router │ │ State │ │ Auth │ │ Utils │ │ │ │
│ │ └────────┘ └────────┘ └────────┘ └────────┘ │ │ │
│ └──────────────────────────────────────────────┼──────────┘ │
│ │ │
│ ┌──────────────────────────────────────────────┼──────────┐ │
│ │ Offline Layer │ │ │
│ │ ┌──────────────────────────────────────────┐ │ │ │
│ │ │ IndexedDB │ │ │ │
│ │ │ • Offline Marks Storage │ │ │ │
│ │ │ • Pending Sync Queue │ │ │ │
│ │ │ • Cache Manager │ │ │ │
│ │ └──────────────────────────────────────────┘ │ │ │
│ └──────────────────────────────────────────────┼──────────┘ │
└──────────────────────────────────────────────────┼──────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Backend │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ PostgreSQL │ │ Realtime │ │ Authentication │ │
│ │ Database │ │ Subscriptions│ │ (JWT) │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│ │
│ Tables: students, teachers, classes, subjects, assessments, │
│ marks, payments, student_fees, fee_categories, etc. │
└─────────────────────────────────────────────────────────────────┘

## Component Layers

### 1. Presentation Layer (UI)
- **HTML Templates**: Dynamic content loaded via router
- **CSS Styles**: Responsive, theme-aware styling
- **UI Components**: Reusable buttons, modals, tables, forms

### 2. Application Layer (Modules)
- **Module Loader**: Dynamic module loading based on navigation
- **Feature Modules**: Students, Finance, Academics, Reports, Settings
- **UI Handlers**: Sidebar, topbar, notifications, modals

### 3. Core Layer
- **Router**: Hash-based SPA routing
- **State Management**: Centralized state object with reactivity
- **Authentication**: JWT-based session management
- **API Client**: Supabase REST wrapper with retry logic
- **Utilities**: Formatting, validation, helpers

### 4. Offline Layer
- **IndexedDB**: Local storage for offline marks
- **Sync Engine**: Background sync when online
- **Cache Manager**: Caches frequent queries

### 5. Integration Layer
- **Chart.js**: Analytics visualizations
- **SheetJS**: Excel import/export
- **html2pdf**: PDF generation
- **WebAuthn**: Biometric authentication

## Data Flow

### Online Flow
User Action → Module → API Client → Supabase → Response → State Update → UI Re-render

### Offline Flow (Marks Entry)
User Action → Module → Offline Storage (IndexedDB) → Local UI Update
↓
(When online) Sync Engine → API Client → Supabase

## Security Architecture

### Authentication
- JWT tokens stored in localStorage
- Session timeout after 30 minutes inactivity
- Biometric authentication (WebAuthn) for supported devices

### Authorization
- Role-based access control (Admin, Accountant, Teacher)
- Frontend route guarding
- Supabase Row Level Security (RLS) policies (recommended for production)

### Data Protection
- HTTPS required for production
- Input sanitization
- XSS protection via content escaping
- CORS configured on Supabase

## Performance Optimizations

1. **Code Splitting**: Modules loaded on demand
2. **Caching**: Frequent queries cached in memory
3. **Pagination**: Large tables paginated (20 records per page)
4. **Web Workers**: Heavy calculations offloaded to workers
5. **Lazy Loading**: Charts and heavy components loaded when needed
6. **IndexedDB**: Offline marks stored locally

## Deployment Architecture

### Development
- Local file system or local server
- Direct Supabase connection

### Production
- Static hosting (Netlify, Vercel, GitHub Pages)
- CDN for assets
- Supabase production database

## Scalability Considerations

- **Database Indexes**: Foreign keys and frequently queried fields indexed
- **Pagination**: Limits response size
- **Offline Support**: Reduces server load
- **Caching**: Minimizes duplicate requests

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript ES6+ |
| Styling | CSS3 with CSS Variables |
| Backend | Supabase (PostgreSQL) |
| Authentication | Supabase Auth + WebAuthn |
| Charts | Chart.js 4.4 |
| Excel | SheetJS |
| PDF | html2pdf.js |
| Icons | Emoji (fallback) / Font Awesome (optional) |

## Browser Support

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+
- Mobile browsers with PWA support
