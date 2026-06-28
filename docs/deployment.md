# Deployment Guide

## Production Deployment Checklist

### Pre-Deployment Verification
- [ ] All tests passing
- [ ] Database schema applied
- [ ] API keys configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Backup system configured
- [ ] Monitoring setup complete

## Deployment Options

### Option 1: Static Hosting (Netlify/Vercel)

#### Netlify Deployment
1. Push code to GitHub repository
2. Log into Netlify
3. Click "New site from Git"
4. Select your repository
5. Build settings:
   - Build command: (none - static site)
   - Publish directory: `./`
6. Click "Deploy site"
7. Configure custom domain (optional)
8. Enable HTTPS automatically

#### Vercel Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow prompts
4. Deploy to production: `vercel --prod`

### Option 2: Traditional Web Server

#### Apache Configuration
```apache
<VirtualHost *:443>
    ServerName school.yourdomain.com
    DocumentRoot /var/www/ecole-la-fontaine
    
    <Directory /var/www/ecole-la-fontaine>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
    
    # Rewrite for SPA routing
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</VirtualHost>
```

#### Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name school.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/ecole-la-fontaine;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 3: Docker Deployment

#### Dockerfile
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  school-app:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./data:/usr/share/nginx/html/data
    restart: unless-stopped
```

## Environment Configuration

### Supabase Setup

1. **Create Production Project**
   - Sign in to Supabase
   - Create new project
   - Select production region
   - Use strong database password

2. **Apply Schema**
   - Copy schema from `database-schema.md`
   - Run in Supabase SQL editor
   - Verify all tables created

3. **Configure API Settings**
   - Get Project URL
   - Get anon public key
   - Configure in app via API Settings page

### Environment Variables (if using build process)

```env
# .env.production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## SSL/TLS Configuration

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d school.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Manual SSL Setup
1. Purchase SSL certificate
2. Install certificate on server
3. Configure web server to use certificate
4. Redirect HTTP to HTTPS

## Performance Optimization

### Asset Optimization
- Minify CSS and JS files
- Compress images
- Enable gzip compression
- Use CDN for static assets

### Caching Strategy
```apache
# Cache HTML (short)
<FilesMatch "\.(html)$">
    Header set Cache-Control "max-age=3600"
</FilesMatch>

# Cache assets (long)
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg)$">
    Header set Cache-Control "max-age=31536000, immutable"
</FilesMatch>
```

### Database Optimization
- Enable connection pooling
- Add indexes on frequently queried columns
- Set up read replicas for high traffic
- Regular VACUUM and ANALYZE

## Monitoring & Logging

### Application Monitoring
- Track error rates
- Monitor API response times
- Watch for failed logins
- Alert on unusual activity

### Server Monitoring
- CPU and memory usage
- Disk space
- Network traffic
- Database connection count

### Logging Setup
```javascript
// Configure log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Send logs to service
function logToService(level, message, data) {
    if (window.navigator.onLine) {
        fetch('/api/logs', {
            method: 'POST',
            body: JSON.stringify({ level, message, data, timestamp: new Date() })
        });
    }
}
```

## Backup Strategy

### Database Backups
- Daily automated backups via Supabase
- Weekly manual backups
- Pre-upgrade backups

### Application Backups
- Configuration files
- Custom templates
- Logo and assets

### Backup Retention
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

## Disaster Recovery

### Recovery Steps
1. Deploy fresh application instance
2. Restore database from latest backup
3. Apply schema migrations
4. Verify data integrity
5. Update DNS to restored instance

### RTO/RPO Targets
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 24 hours

## Security Hardening

### Web Server
- Disable directory listing
- Remove server version headers
- Limit request sizes
- Enable rate limiting

### Application
- Enable Supabase RLS policies
- Validate all user inputs
- Escape output to prevent XSS
- Implement CSP headers

### Network
- Use firewall rules
- Limit access to admin IPs
- Enable DDoS protection
- Regular security scans

## Post-Deployment Validation

### Smoke Tests
- [ ] Login with admin account
- [ ] Create a test student
- [ ] Record a test payment
- [ ] Enter test marks
- [ ] Generate test report card
- [ ] Verify offline mode
- [ ] Test PWA installation

### Load Testing
- Simulate concurrent users
- Test marks entry load
- Verify report card generation
- Monitor response times

## Maintenance Schedule

### Daily
- Verify backups completed
- Check error logs
- Monitor disk space

### Weekly
- Review security logs
- Update documentation
- Check for software updates

### Monthly
- Performance review
- Database optimization
- Security audit

### Quarterly
- Full disaster recovery test
- Security penetration testing
- Capacity planning review

