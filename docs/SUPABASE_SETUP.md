# 🚀 Supabase Setup Guide

## Overview

This guide will help you set up Supabase for the Commodity Options Training Game. The setup includes database, authentication, edge functions, and realtime features.

## Prerequisites

- Node.js 18+
- Supabase account (free tier is sufficient)
- Google OAuth credentials (optional)
- Microsoft Azure OAuth credentials (optional)

## Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# Make script executable
chmod +x scripts/setup-supabase.sh

# Run setup script
./scripts/setup-supabase.sh
```

The script will guide you through:
1. Creating/linking a Supabase project
2. Running migrations
3. Configuring auth providers
4. Deploying edge functions
5. Setting environment variables

### Option 2: Manual Setup

#### 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Configure:
   - **Name:** commodity-options-game
   - **Database Password:** (save securely!)
   - **Region:** EU (Frankfurt) - IMPORTANT for compliance
   - **Pricing Plan:** Free tier is fine for development

#### 2. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux
wget -qO- https://github.com/supabase/cli/releases/download/v1.187.10/supabase_linux_amd64.tar.gz | tar xvz
sudo mv supabase /usr/local/bin

# Verify installation
supabase --version
```

#### 3. Link Project

```bash
# Get your project reference from dashboard
supabase link --project-ref YOUR_PROJECT_REF --password YOUR_DB_PASSWORD
```

#### 4. Run Migrations

```bash
# Apply database schema
supabase db push

# This creates all tables:
# - sessions, participants, orders, positions
# - greek_snapshots, breach_events
# - ticks, iv_surface_snapshots, leaderboard
```

#### 5. Configure Authentication

In Supabase Dashboard > Authentication > Providers:

**Google OAuth:**
1. Enable Google provider
2. Add Client ID and Secret
3. Set redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

**Microsoft Azure:**
1. Enable Azure provider
2. Add Client ID and Secret
3. Set redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

#### 6. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy session-create --no-verify-jwt
supabase functions deploy session-join --no-verify-jwt
supabase functions deploy session-state --no-verify-jwt
supabase functions deploy order-submit --no-verify-jwt
supabase functions deploy host-shock --no-verify-jwt
supabase functions deploy export-csv --no-verify-jwt
```

#### 7. Set Environment Variables

```bash
# Copy example file
cp supabase/env.production.example supabase/.env.production

# Edit with your values
nano supabase/.env.production

# Set as Supabase secrets
supabase secrets set --env-file supabase/.env.production
```

#### 8. Enable Realtime

In SQL Editor, run:

```sql
-- Enable Realtime for game tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE ticks;
ALTER PUBLICATION supabase_realtime ADD TABLE greek_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE breach_events;
```

#### 9. Create Local Environment File

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## GitHub Actions Setup

Add these secrets to your GitHub repository (Settings > Secrets):

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `SUPABASE_URL` | Project API URL | Dashboard > Settings > API |
| `SUPABASE_ANON_KEY` | Anonymous/Public key | Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Dashboard > Settings > API |
| `SUPABASE_ACCESS_TOKEN` | Personal access token | Account Settings > Access Tokens |
| `SUPABASE_DB_PASSWORD` | Database password | What you set during creation |
| `PROJECT_REF` | Project reference ID | Dashboard > Settings > General |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL | For client-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY | For client-side |

## Testing the Setup

### 1. Test Database Connection

```bash
# In project root
npx supabase status
```

### 2. Test Local Development

```bash
cd apps/web
npm run dev

# Visit http://localhost:3000
# Try creating a session
```

### 3. Test Edge Functions

```bash
# Test session creation
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/session-create \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "live", "bankroll": 100000}'
```

### 4. Test Authentication

1. Go to your app
2. Click "Sign in with Google" or "Sign in with Microsoft"
3. Should redirect and authenticate successfully

## Troubleshooting

### Common Issues

#### "Project not found"
- Verify PROJECT_REF is correct
- Check you're in the right directory
- Ensure Supabase CLI is logged in: `supabase login`

#### "Authentication failed"
- Check OAuth credentials are correct
- Verify redirect URLs match exactly
- Ensure providers are enabled in dashboard

#### "Edge function not found"
- Deploy functions with `--no-verify-jwt` flag
- Check function names match exactly
- Verify functions are enabled in dashboard

#### "Database connection failed"
- Check database password is correct
- Verify project is not paused (free tier pauses after 1 week)
- Check network/firewall settings

### Debug Commands

```bash
# Check project status
supabase status

# View function logs
supabase functions logs session-create

# Test database connection
supabase db remote list

# Check migrations status
supabase db migrations list
```

## Security Checklist

- [ ] Database password is strong and stored securely
- [ ] Service role key is never exposed client-side
- [ ] RLS policies are enabled and tested
- [ ] OAuth redirect URLs are whitelisted
- [ ] Environment variables are properly set
- [ ] GitHub secrets are configured
- [ ] CORS is properly configured for your domain

## EU Compliance Notes

- **Data Residency:** Project MUST be in EU region (Frankfurt)
- **Data Retention:** Set to 30 days in config
- **Educational Use:** Clearly marked in UI
- **No Analytics:** Disabled by default
- **GDPR Ready:** User data deletion available via API

## Production Deployment

1. **Domain Setup:**
   - Add your domain to Supabase auth settings
   - Update redirect URLs

2. **SSL/TLS:**
   - Automatically handled by Supabase
   - Enforce HTTPS in application

3. **Monitoring:**
   - Enable logs in dashboard
   - Set up alerts for errors
   - Monitor usage metrics

4. **Backup:**
   - Enable point-in-time recovery (paid feature)
   - Regular exports via pg_dump

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Discord:** https://discord.supabase.com
- **GitHub Issues:** Report bugs in our repo
- **Dashboard:** https://app.supabase.com/project/YOUR_PROJECT_REF

## Next Steps

After setup is complete:

1. ✅ Test all edge functions
2. ✅ Verify auth flow works
3. ✅ Check realtime updates
4. ✅ Test with multiple users
5. ✅ Deploy to production
