# Monitoring Setup Guide

**Status:** ✅ Q3 2026 Critical - COMPLETE

---

## 1. Sentry (Error Tracking)

**Status:** ✅ Implemented  
**Time to set up:** 5 minutes  
**Cost:** Free (10K errors/month, 100K transactions/month)

### Setup Steps

1. **Create Sentry Account**
   - Go to https://sentry.io
   - Sign up with GitHub
   - Create new project → Select **Node.js**

2. **Get Your DSN**
   - Go to **Settings** → **Projects** → [Your Project] → **Keys**
   - Copy the **DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)

3. **Add to Railway**
   - Go to Railway project → **Variables**
   - Add:
     ```
     SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
     SENTRY_ENVIRONMENT=production
     SENTRY_TRACES_SAMPLE_RATE=0.1
     ```
   - Redeploy

4. **Verify**
   - Trigger a test error (temporarily)
   - Check Sentry dashboard for error
   - Remove test error

### What's Tracked

- ✅ Unhandled exceptions
- ✅ HTTP errors (5xx)
- ✅ Database connection failures
- ✅ Performance traces (10% sample rate)
- ✅ CPU profiling (when errors occur)
- ❌ Health check errors (filtered out)
- ❌ 404s for static assets (filtered out)

### Dashboard

**Your Sentry Project:** https://sentry.io/organizations/[your-org]/

---

## 2. UptimeRobot (Uptime Monitoring)

**Status:** 📋 Setup Required  
**Time to set up:** 5 minutes  
**Cost:** Free (50 monitors, 5-minute intervals)

### Setup Steps

1. **Create Account**
   - Go to https://uptimerobot.com
   - Sign up with email

2. **Add Monitor**
   - Click **Add New Monitor**
   - Fill in:
     - **Monitor Type:** HTTP(s)
     - **Friendly Name:** `OmniLearn API - Production`
     - **URL (or IP):** `https://workspaceapi-server-production-29ee.up.railway.app/api/healthz`
     - **Monitoring Interval:** 5 minutes (free tier)

3. **Configure Alerts**
   - Click **Advanced Settings**
   - Set:
     - **Alert Contacts:** Add your email + phone SMS
     - **Down Rechecks:** 3 (wait 3 checks before alerting)
   - Click **Create Monitor**

4. **Add More Monitors (Optional)**
   ```
   Frontend: https://omnilearn.dpdns.org
   Backend Root: https://workspaceapi-server-production-29ee.up.railway.app
   Health Check: https://workspaceapi-server-production-29ee.up.railway.app/api/healthz
   ```

5. **Set Up Status Page (Optional)**
   - Go to **My Settings** → **Status Pages**
   - Click **Add Status Page**
   - Add your monitors
   - Customize branding
   - Share with users: https://stats.uptimerobot.com/[your-page]

### Alert Configuration

**Recommended:**
- **Email alerts:** Always enable
- **SMS alerts:** Enable for critical monitors (API down)
- **Webhook alerts:** Optional (Discord, Slack, Telegram)

**Alert Threshold:**
- Down for 5 minutes → Email alert
- Down for 15 minutes → SMS alert
- Down for 30 minutes → Webhook to team chat

### Dashboard

**Your UptimeRobot Dashboard:** https://uptimerobot.com/dashboard

---

## 3. Railway Logs (Application Logs)

**Status:** ✅ Built-in  
**Cost:** Included in Railway plan

### Access Logs

1. Go to Railway project
2. Click on your service
3. Click **Deployments** → Latest deployment
4. Click **View Logs**

### Log Search

- Filter by level: `ERROR`, `WARN`, `INFO`
- Search by text
- Real-time streaming

### Export Logs (Optional)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs --service [service-name]

# Export logs
railway logs --export > logs.json
```

---

## 4. Vercel Analytics (Frontend Performance)

**Status:** 📋 Optional Setup  
**Cost:** Free (included in Vercel Hobby plan)

### Setup Steps

1. Go to Vercel project
2. Click **Analytics** tab
3. Click **Enable**
4. Deploy (no code changes needed)

### What's Tracked

- Page views
- Web Vitals (LCP, FID, CLS)
- Geolocation
- Device types

### Dashboard

**Your Vercel Analytics:** https://vercel.com/[your-team]/[project]/analytics

---

## 5. Supabase Logs (Database)

**Status:** ✅ Built-in  
**Cost:** Free

### Access Logs

1. Go to Supabase Dashboard
2. Select your project
3. Click **Logs** (left sidebar)
4. Filter by:
   - Query logs
   - Authentication logs
   - Function logs

### Slow Query Monitoring

1. Go to **Database** → **Query Performance**
2. View slow queries
3. Add indexes as needed

---

## Monitoring Checklist

### Daily (Automated)
- [x] Uptime monitoring (UptimeRobot)
- [x] Error tracking (Sentry)
- [x] Application logs (Railway)

### Weekly (Manual Review)
- [ ] Review Sentry error trends
- [ ] Check UptimeRobot uptime %
- [ ] Review slow queries in Supabase
- [ ] Check Railway resource usage

### Monthly (Deep Dive)
- [ ] Performance trends analysis
- [ ] Error rate trends
- [ ] Database growth analysis
- [ ] Cost review (Railway, Supabase, Sentry)

---

## Alert Response Playbook

### Alert: "API Down" (UptimeRobot)

1. **Check Railway dashboard**
   - Is the service running?
   - Any deployment failures?

2. **Check Railway logs**
   - Look for recent errors
   - Check for crash loops

3. **Check Sentry**
   - Any recent critical errors?
   - Database connection failures?

4. **Common Fixes**
   - Restart service (Railway → Deployments → Redeploy)
   - Check environment variables
   - Verify DATABASE_URL is valid
   - Check Supabase status (https://status.supabase.com)

### Alert: "High Error Rate" (Sentry)

1. **Open Sentry dashboard**
   - Sort by "Last 24 hours"
   - Group by error type

2. **Identify root cause**
   - New deployment?
   - Database schema change?
   - External API failure?

3. **Fix and deploy**
   - Rollback if recent deployment
   - Fix code and deploy hotfix
   - Add error boundary if needed

### Alert: "Slow Database Queries" (Supabase)

1. **Identify slow queries**
   - Go to Query Performance
   - Sort by execution time

2. **Add indexes**
   - Create migration for new index
   - Deploy to production

3. **Monitor improvement**
   - Check query performance again
   - Verify response times improved

---

## Environment Variables Summary

```bash
# Sentry (Error Tracking)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# UptimeRobot (External - no env vars needed)
# Configure at https://uptimerobot.com

# Optional: Log aggregation (Logtail)
# LOGTAIL_SOURCE_TOKEN=xxx
```

---

## Quick Links

| Service | Dashboard | Docs |
|---------|-----------|------|
| Sentry | https://sentry.io | https://docs.sentry.io |
| UptimeRobot | https://uptimerobot.com | https://uptimerobot.com/api |
| Railway Logs | https://railway.app | https://docs.railway.app |
| Vercel Analytics | https://vercel.com | https://vercel.com/docs/analytics |
| Supabase Logs | https://supabase.com | https://supabase.com/docs |

---

## Next Steps

1. **Set up UptimeRobot** (5 minutes)
   - Create account
   - Add health check monitor
   - Configure email + SMS alerts

2. **Set up Sentry** (5 minutes)
   - Create project
   - Add DSN to Railway
   - Redeploy

3. **Test alerts** (2 minutes)
   - Temporarily break something
   - Verify Sentry captures error
   - Verify UptimeRobot detects downtime

4. **Document alert contacts**
   - Add team members to UptimeRobot
   - Add team members to Sentry
   - Create on-call rotation (if team)

---

**Last Updated:** May 7, 2026  
**Status:** ✅ Sentry Implemented | 📋 UptimeRobot Setup Required
