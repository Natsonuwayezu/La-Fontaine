// js/config/supabase-config.js
// Source lines: 9583–9590 of original monolith
// ============================================================


        const SUPABASE_URL_DEFAULT = localStorage.getItem('sb_url') || 'https://hejdppzparottbcnycjo.supabase.co';
        const SUPABASE_KEY_DEFAULT = localStorage.getItem('sb_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlamRwcHpwYXJvdHRiY255Y2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Nzg3OTMsImV4cCI6MjA5NDQ1NDc5M30.vi7Xa3eF9D9OTCkDZUYn6ScsyuQPwb0eN9nNazPpFcc';

        let SUPABASE_URL = SUPABASE_URL_DEFAULT;
        let SUPABASE_KEY = SUPABASE_KEY_DEFAULT;


