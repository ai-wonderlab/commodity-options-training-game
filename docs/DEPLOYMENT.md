# 🚀 Production Deployment Guide

## Overview

This guide covers multiple deployment options for the Commodity Options Training Game.

## Prerequisites

- Node.js 18+ and npm 9+
- Git repository with your code
- Supabase account (for database and auth)
- Domain name (optional but recommended)

## Deployment Options

### Option 1: Vercel (Recommended) ✅

**Pros:** Zero-config, automatic HTTPS, global CDN, preview deployments

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Configure Environment Variables**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project
   - Go to Settings → Environment Variables
   - Add:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_key
     ```

4. **Connect Custom Domain**
   - Go to Settings → Domains
   - Add your domain
   - Update DNS records

### Option 2: Docker 🐳

**Pros:** Portable, consistent environment, self-hosted control

1. **Build Image**
   ```bash
   docker build -t commodity-options-game .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e NEXT_PUBLIC_SUPABASE_URL=your_url \
     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
     --name options-game \
     commodity-options-game
   ```

3. **Using Docker Compose**
   ```bash
   # Create .env file with your variables
   cp .env.example .env
   
   # Start services
   docker-compose up -d
   ```

### Option 3: Netlify 📦

**Pros:** Great for static sites, form handling, serverless functions

1. **Install Netlify CLI**
   ```bash
   npm i -g netlify-cli
   ```

2. **Build & Deploy**
   ```bash
   npm run build
   netlify deploy --prod --dir=apps/web/.next
   ```

3. **Configure Environment Variables**
   - Go to Site Settings → Environment
   - Add your Supabase credentials

### Option 4: Railway 🚂

**Pros:** Simple deployment from GitHub, built-in database

1. **Connect GitHub**
   - Go to [Railway](https://railway.app)
   - Create new project from GitHub repo

2. **Add Environment Variables**
   ```bash
   railway variables set NEXT_PUBLIC_SUPABASE_URL=your_url
   railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### Option 5: AWS (EC2 + RDS) ☁️

**Pros:** Full control, scalable, enterprise-ready

1. **Setup EC2 Instance**
   ```bash
   # SSH into instance
   ssh ec2-user@your-instance
   
   # Install Node.js
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install nodejs -y
   
   # Clone repository
   git clone https://github.com/your-repo/commodity-options-game.git
   cd commodity-options-game
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   ```

2. **Setup PM2 Process Manager**
   ```bash
   sudo npm install -g pm2
   
   # Start application
   pm2 start npm --name "options-game" -- start --workspace=@game/web
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

3. **Setup Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Setup SSL with Certbot**
   ```bash
   sudo yum install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Supabase Setup

### 1. Create Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create new project in EU region
3. Note your project URL and keys

### 2. Push Database Schema

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy
```

### 3. Configure Authentication

1. **Enable OAuth Providers**
   - Go to Authentication → Providers
   - Enable Google:
     - Client ID: from Google Cloud Console
     - Client Secret: from Google Cloud Console
     - Redirect URL: `https://your-domain.com/auth/callback`
   
   - Enable Microsoft:
     - Application ID: from Azure Portal
     - Secret Value: from Azure Portal
     - Redirect URL: `https://your-domain.com/auth/callback`

2. **Configure JWT Settings**
   - Go to Settings → API
   - Note JWT Secret for Edge Functions

### 4. Setup Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies (already in migrations)
```

## Environment Variables

### Required Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Security Best Practices

1. **Never commit secrets to Git**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use different keys for different environments**
   - Development: `.env.local`
   - Staging: `.env.staging`
   - Production: `.env.production`

3. **Rotate keys regularly**
   - Supabase Dashboard → Settings → API → Regenerate Keys

## Monitoring & Logging

### 1. Application Monitoring

**Sentry Setup**
```javascript
// apps/web/lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### 2. Performance Monitoring

**Vercel Analytics**
```bash
npm install @vercel/analytics
```

```javascript
// apps/web/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 3. Error Tracking

**LogRocket Setup**
```bash
npm install logrocket
```

```javascript
// apps/web/lib/logrocket.ts
import LogRocket from 'logrocket';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  LogRocket.init('your-app-id');
}
```

## Performance Optimization

### 1. Enable Caching

```javascript
// next.config.js
module.exports = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600, must-revalidate',
        },
      ],
    },
  ],
};
```

### 2. Enable Image Optimization

```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['your-supabase-project.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },
};
```

### 3. Enable Compression

```bash
npm install compression
```

### 4. Database Indexes

```sql
-- Add indexes for common queries
CREATE INDEX idx_orders_session_id ON orders(session_id);
CREATE INDEX idx_participants_session_id ON participants(session_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

## Scaling Considerations

### Horizontal Scaling

1. **Multiple Instances**
   - Use load balancer (AWS ALB, Nginx)
   - Enable session affinity for WebSockets
   - Share Redis for session storage

2. **Database Scaling**
   - Enable connection pooling
   - Use read replicas for analytics
   - Implement caching layer (Redis)

### Vertical Scaling

1. **Optimize Build**
   ```bash
   # Reduce bundle size
   npm run analyze
   
   # Tree shake unused code
   npm run build -- --analyze
   ```

2. **Database Optimization**
   - Use database connection pooling
   - Optimize queries with EXPLAIN ANALYZE
   - Add appropriate indexes

## Backup & Recovery

### Database Backups

1. **Automated Backups**
   - Supabase: Daily automatic backups
   - Self-hosted: Setup pg_dump cron job

2. **Manual Backup**
   ```bash
   # Export database
   supabase db dump > backup.sql
   
   # Restore database
   psql -h localhost -U postgres < backup.sql
   ```

### Application Backups

```bash
# Backup application files
tar -czf app-backup.tar.gz --exclude=node_modules .

# Backup Docker volumes
docker run --rm -v commodity-options-game_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache
   rm -rf .next node_modules
   npm install
   npm run build
   ```

2. **Database Connection Issues**
   - Check firewall rules
   - Verify connection string
   - Check SSL requirements

3. **WebSocket Issues**
   - Enable WebSocket support in proxy
   - Check CORS settings
   - Verify Supabase Realtime is enabled

### Health Checks

```javascript
// apps/web/app/api/health/route.ts
export async function GET() {
  try {
    // Check database
    const { error } = await supabase.from('sessions').select('count').single();
    
    if (error) throw error;
    
    return Response.json({ status: 'healthy' });
  } catch (error) {
    return Response.json({ status: 'unhealthy', error }, { status: 500 });
  }
}
```

## Security Checklist

- [ ] Enable HTTPS everywhere
- [ ] Set secure headers (CSP, HSTS, etc.)
- [ ] Enable rate limiting
- [ ] Implement DDoS protection
- [ ] Regular security updates
- [ ] Audit logs enabled
- [ ] Backup strategy in place
- [ ] Incident response plan
- [ ] GDPR compliance (EU)

## Cost Optimization

### Supabase
- Free tier: 500MB database, 2GB bandwidth
- Pro: $25/month per project
- Scale as needed

### Vercel
- Hobby: Free for personal use
- Pro: $20/month per member
- Enterprise: Custom pricing

### AWS
- EC2 t3.small: ~$15/month
- RDS db.t3.micro: ~$15/month
- Data transfer: ~$0.09/GB

## Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Community: GitHub Discussions
- Email: support@your-domain.com

---

**Last Updated:** August 2024
**Version:** 1.0.0
