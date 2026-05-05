# OmniLearn Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)           Backend (Railway)              │
│  - React + Vite              - Express API server           │
│  - Free static hosting       - $5 free credit/month         │
│  - /api/* → proxy to backend - PostgreSQL (Neon - free)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Step 1: Create Neon Database (Free)

### 1.1 Go to Neon
1. Open [neon.tech](https://neon.tech)
2. Sign up with GitHub (free, no credit card)

### 1.2 Create Project
1. Click **Create a project**
2. Name: `omnilearn`
3. Region: Choose closest to you (e.g., `us-east`)
4. Click **Create project**

### 1.3 Get Connection String
1. On the project dashboard, find **Connection string**
2. Copy the **URI** (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
3. **Save this** — you'll need it for Railway

---

## 🚀 Step 2: Deploy API Server to Railway

### 2.1 Go to Railway
1. Open [railway.app](https://railway.app)
2. Sign up with GitHub
3. You get **$5 free credit/month** (no credit card required)

### 2.2 Deploy from GitHub
1. Click **New Project**
2. Click **Deploy from GitHub repo**
3. Select `Cloud99p/omnilearn-agent`
4. Railway will auto-detect the `Dockerfile`

### 2.3 Set Environment Variables
Click on your project → **Variables** → Add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (paste from Neon - step 1.3) |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `PORT` | `3000` |

### 2.4 Deploy
1. Click **Deploy** at the top
2. Wait ~3-5 minutes for build
3. Once deployed, click **Settings** → **Domains**
4. Copy your Railway URL (e.g., `https://omnilearn-production-xyz.up.railway.app`)

---

## 🚀 Step 3: Update Vercel Frontend

### 3.1 Update vercel.json
Replace `YOUR-RAILWAY-URL` with your actual Railway URL:

```json
{
  "buildCommand": "pnpm -r --filter @workspace/omnilearn run build",
  "outputDirectory": "artifacts/omnilearn/dist/public",
  "installCommand": "pnpm install",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RAILWAY-URL.up.railway.app/api/:path*"
    }
  ]
}
```

### 3.2 Push to GitHub
```bash
cd /mnt/data/openclaw/workspace/.openclaw/workspace/omnilearn-agent

git add -A
git commit -m "chore: update vercel.json with Railway backend URL"
git push origin main
```

### 3.3 Vercel Auto-Deploy
Vercel will automatically redeploy with the working API proxy.

---

## ✅ Verify Deployment

### 1. Backend Health Check
Visit: `https://your-railway-url.up.railway.app/api/healthz`

Should return:
```json
{"status":"healthy"}
```

### 2. Frontend
Visit your Vercel URL:
- Sign up should work
- Chat should connect to backend
- No 404 errors on `/api/*` routes

### 3. Test API
Visit: `https://your-vercel-url.app/api/healthz`

Should proxy to Railway and return `{"status":"healthy"}`

---

## 🔧 Environment Variables

### Backend (Railway)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | From Neon PostgreSQL |
| `CLERK_SECRET_KEY` | Clerk API secret |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `PORT` | 3000 (default) |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Client-side Clerk key |

---

## 📊 Cost Breakdown

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | **Free** |
| Railway | Hobby | **$5 credit/month** (free) |
| Neon | Free | **Free** |
| Clerk | Free | 10,000 MAU free |
| Anthropic | Pay-as-you-go | ~$0.01-0.10/conversation |

**Total: ~$0-5/month** (Railway credit lasts ~1-2 months for small apps)

---

## 🐛 Troubleshooting

### Railway build fails
- Check logs in Railway dashboard
- Verify `Dockerfile` is at repo root
- Ensure all dependencies install correctly

### Database connection error
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check Neon project is active
- Test connection in Neon SQL editor

### Frontend 404 on /api/*
- Check `vercel.json` rewrites — URL must match Railway exactly
- Verify Railway service is running (not crashed)
- Check Railway logs for errors

### Clerk auth fails
- Verify both Clerk keys are correct
- Check Clerk dashboard → API Keys
- Enable OAuth (Google/GitHub) in Clerk if needed

---

## 🎯 When Railway Credit Runs Out

After ~1-2 months, Railway's $5 credit may run out. Options:

1. **Add $5/month** to Railway (still cheap)
2. **Move to Render** (~$14/month, more reliable)
3. **Stay on Replit** (free, already working)

---

Questions? Open an issue on GitHub.
