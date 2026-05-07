# Deployment Guide for OmniLearn

## Quick Deploy Checklist

### 1. Push Changes to GitHub
```bash
cd /mnt/data/openclaw/workspace/.openclaw/workspace/omnilearn-agent
git push origin main
```

### 2. Deploy Backend (Railway)
1. Go to https://railway.app/
2. Import your GitHub repo: `Cloud99p/omnilearn-agent`
3. Set environment variables:
   - `DATABASE_URL` (from Supabase)
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `PORT` (set to `8080` - Railway default)
4. Deploy → Railway will auto-detect the app

### 3. Deploy Frontend (Vercel)
1. Go to https://vercel.com/new
2. Import your GitHub repo: `Cloud99p/omnilearn-agent`
3. Set environment variable:
   - `VITE_API_URL` = `https://workspaceapi-server-production-29ee.up.railway.app`
4. Deploy

### 4. Verify Health Check
After deployment, test the health endpoint:
```bash
curl https://workspaceapi-server-production-29ee.up.railway.app/api/healthz
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.0.0",
  "uptime": 123,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "database": { "status": "connected", "latencyMs": 45 },
  "clerk": { "status": "configured" }
}
```

## CI/CD Status

Your GitHub Actions CI pipeline now includes:
- ✅ Format check (Prettier)
- ✅ Type checking (TypeScript)
- ✅ Build verification
- ✅ Deployment config validation

**View CI status:** https://github.com/Cloud99p/omnilearn-agent/actions

## Troubleshooting

### Railway Build Fails
- Check Railway logs for specific errors
- Ensure `DATABASE_URL` and `CLERK_*` keys are set
- Try `PORT=8080` in Railway settings

### Vercel Build Fails
- Check Vercel logs
- Ensure `VITE_API_URL` is set correctly
- Try `pnpm build` locally first

### Health Check Returns "degraded"
- `database.status: error` → Check DATABASE_URL connection string
- `clerk.status: missing` → Add Clerk keys to Railway env vars

## Monitoring

### Add Sentry (Optional)
```bash
pnpm add @sentry/node
```

Configure in `artifacts/api-server/src/lib/logger.ts` for error tracking.

### Add Uptime Monitoring
- Use UptimeRobot (free tier) to monitor `/api/healthz`
- Set alerts for downtime
