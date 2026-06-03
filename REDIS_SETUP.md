# Redis Setup for Omnilearn

## Quick Setup (Upstash - Recommended)

### Step 1: Create Upstash Account
1. Go to https://upstash.com
2. Sign up with GitHub/Google (free)
3. Create a new Redis database

### Step 2: Get Connection URL
1. In Upstash dashboard, click your database
2. Copy the **REST API URL** and **Token**
3. Or use the direct Redis URL (starts with `redis://`)

### Step 3: Add Environment Variables

**Railway Dashboard** → Your project → Settings → Variables:

```bash
# Redis Configuration
REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_HOST:6379
# OR if using Upstash REST API:
# REDIS_URL=https://YOUR_DATABASE.upstash.io

# Optional: Redis host/port if not using URL
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_TLS=false
```

### Step 4: Deploy
```bash
cd omnilearn-current
git add -A
git commit -m "feat: Add Redis caching infrastructure"
git push origin main
```

Railway will auto-deploy with Redis support.

---

## Alternative: Railway Redis Addon

If you prefer Railway's built-in Redis:

1. Railway Dashboard → Your project → Add-ons
2. Click "Add Redis"
3. Railway automatically adds `REDIS_URL` to your environment
4. Deploy your app

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Optional | - | Full Redis connection URL |
| `REDIS_HOST` | Optional | - | Redis host (if not using URL) |
| `REDIS_PORT` | Optional | 6379 | Redis port |
| `REDIS_PASSWORD` | Optional | - | Redis password |
| `REDIS_TLS` | Optional | false | Enable TLS |

---

## Cache TTL Configuration

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| Query Cache | 1 hour | Knowledge retrieval results |
| Permission Cache | 5 minutes | User roles/permissions |
| Network Stats | 1 minute | Network health data |
| Character State | 5 minutes | Character traits |
| Ontology Cache | 10 minutes | Ontology proposals |
| Proposal Cache | 5 minutes | Hebbian proposals |
| Rate Limit | 1 minute | Rate limiting windows |
| Session Data | 24 hours | Session state |

---

## Health Check

After deploying, check Redis status:

```bash
# In Railway logs, look for:
"Redis connected"
```

Or add a health endpoint:
```bash
curl https://your-api.up.railway.app/api/health
```

---

## Fallback Behavior

If Redis is unavailable:
- ✅ Query cache falls back to in-memory (NodeCache)
- ✅ Permission cache falls back to in-memory (Map)
- ✅ No errors thrown
- ✅ Graceful degradation

Redis is optional but recommended for production.
