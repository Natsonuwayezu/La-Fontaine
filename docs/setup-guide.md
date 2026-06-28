# Setup Guide

## Running Locally
The app is a single HTML file. Open in any modern browser.
Note: Supabase API calls require internet connection.
Do NOT open via file:// for CORS reasons — use a local server:
  npx serve . 
  # or
  python3 -m http.server 8080

## Supabase Setup
Project: hejdppzparottbcnycjo.supabase.co
The anon key is embedded in index.html (APP_CONFIG section).
Can be overridden via Settings > API Settings in the app.

Required DB tables: see docs/database-schema.md and backend.txt §1

CRITICAL: Run this migration if not done yet:
  ALTER TABLE classes ADD COLUMN class_teacher_id INTEGER REFERENCES teachers(id);

## Deployment (Netlify — free)
1. Connect GitHub repo to Netlify
2. No build command needed
3. Publish directory: . (repo root)
4. index.html is served as the app

## School Settings to Configure (first login)
1. Admin password (Settings > School Settings)
2. School name, address, phone, email, logo
3. Current academic year and term
4. Pass mark (default 50)
5. Grading scale (if different from default)
6. Fee structure per class

## Default Login
Role: Admin
Password: (check school_settings table, key='admin_password')
Default is usually: admin123 or admin

## Adding Staff
Settings > Staff Management > Add Teacher/Accountant
Each staff member needs: name, email, username, password, role
